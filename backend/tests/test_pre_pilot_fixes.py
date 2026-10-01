"""
Regression tests for the pre-pilot trust fixes:
- S1: GitHub token never appears in fix-PR errors, URLs or argv
- S2: encryption fails closed outside development
- S4: fix PRs are never silently simulated
"""

import importlib
import subprocess
import uuid
from types import SimpleNamespace

import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException

TOKEN = "ghp_RealLookingToken1234567890abcdefghijklmn"


# ── S2: encryption ────────────────────────────────────────────────────────────

def _reload_encryption(monkeypatch, *, environment, key):
    monkeypatch.setenv("ENVIRONMENT", environment)
    if key is None:
        monkeypatch.delenv("ENCRYPTION_KEY", raising=False)
    else:
        monkeypatch.setenv("ENCRYPTION_KEY", key)
    import app.utils.encryption as enc
    return importlib.reload(enc)


def test_encryption_refuses_to_start_in_production_without_key(monkeypatch):
    import app.utils.encryption as enc
    # Reloading re-creates the exception class, so match on its base type + message.
    with pytest.raises(RuntimeError, match="ENCRYPTION_KEY is not set"):
        _reload_encryption(monkeypatch, environment="production", key=None)
    # Missing ENVIRONMENT also counts as production.
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("ENCRYPTION_KEY", raising=False)
    with pytest.raises(RuntimeError, match="ENCRYPTION_KEY is not set"):
        importlib.reload(enc)
    _reload_encryption(monkeypatch, environment="test", key=Fernet.generate_key().decode())


def test_encryption_refuses_invalid_key_in_production(monkeypatch):
    with pytest.raises(RuntimeError, match="not a valid Fernet key"):
        _reload_encryption(monkeypatch, environment="production", key="not-a-fernet-key")
    _reload_encryption(monkeypatch, environment="test", key=Fernet.generate_key().decode())


def test_encryption_dev_fallback_is_not_the_old_published_key(monkeypatch):
    import base64
    enc = _reload_encryption(monkeypatch, environment="development", key=None)
    old_key = base64.urlsafe_b64encode(b"cybersigma_secret_key_32_bytes!!")
    token = enc.encrypt_value("hello")
    with pytest.raises(Exception):
        Fernet(old_key).decrypt(token.encode())
    _reload_encryption(monkeypatch, environment="test", key=Fernet.generate_key().decode())


def test_decrypt_round_trip_and_legacy_plaintext(monkeypatch):
    enc = _reload_encryption(monkeypatch, environment="production", key=Fernet.generate_key().decode())
    assert enc.decrypt_value(enc.encrypt_value(TOKEN)) == TOKEN
    assert enc.decrypt_value("legacy-plaintext-token") == "legacy-plaintext-token"
    assert enc.decrypt_value("") == ""


def test_decrypt_with_wrong_key_raises_instead_of_returning_ciphertext(monkeypatch):
    enc = _reload_encryption(monkeypatch, environment="production", key=Fernet.generate_key().decode())
    foreign = Fernet(Fernet.generate_key()).encrypt(TOKEN.encode()).decode()
    with pytest.raises(enc.DecryptionError):
        enc.decrypt_value(foreign)
    _reload_encryption(monkeypatch, environment="test", key=Fernet.generate_key().decode())


# ── S4: simulation flag ──────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "environment,flag,expected",
    [
        ("production", "1", False),
        ("", "1", False),
        ("development", "", False),
        ("development", "1", True),
        ("test", "true", True),
    ],
)
def test_pr_simulation_only_with_explicit_dev_flag(monkeypatch, environment, flag, expected):
    from app.utils.runtime import pr_simulation_enabled
    if environment:
        monkeypatch.setenv("ENVIRONMENT", environment)
    else:
        monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.setenv("SIGMASEC_PR_SIMULATION", flag)
    assert pr_simulation_enabled() is expected


# ── S1: credential handling helpers ──────────────────────────────────────────

def test_scrub_credentials_removes_token_basic_auth_and_url_userinfo():
    import base64
    from app.routers.findings import _scrub_credentials
    basic = base64.b64encode(f"x-access-token:{TOKEN}".encode()).decode()
    text = (
        f"Command '['git', 'clone', 'https://x-access-token:{TOKEN}@github.com/o/r.git']' failed; "
        f"header AUTHORIZATION: basic {basic}; https://user:pw@example.com/x"
    )
    out = _scrub_credentials(text, TOKEN)
    assert TOKEN not in out
    assert basic not in out
    assert "user:pw" not in out


def test_git_env_authenticates_without_token_in_argv(tmp_path):
    from app.routers.findings import _github_git_env
    env = _github_git_env(TOKEN)
    # git itself sees the header via GIT_CONFIG_* environment entries...
    out = subprocess.run(
        ["git", "config", "--get", "http.https://github.com/.extraheader"],
        env=env, cwd=tmp_path, capture_output=True, text=True,
    )
    assert out.returncode == 0
    assert out.stdout.strip().startswith("AUTHORIZATION: basic ")
    # ...and the raw token is not present anywhere in the environment either.
    assert all(TOKEN not in v for v in env.values())


# ── create-fix-pr endpoint ───────────────────────────────────────────────────

class _FakeQuery:
    def __init__(self, result):
        self._result = result

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._result


class _FakeDB:
    def __init__(self, finding, gh_config):
        self.finding, self.gh_config = finding, gh_config
        self.committed = False

    def query(self, model):
        return _FakeQuery(self.finding if model.__name__ == "Finding" else self.gh_config)

    def commit(self):
        self.committed = True


def _finding(org_id, tool="trivy", target="https://github.com/acme/app.git"):
    asset = SimpleNamespace(asset_type=SimpleNamespace(value="git_repo"), target=target)
    scan = SimpleNamespace(asset=asset, target=target)
    return SimpleNamespace(
        id=uuid.uuid4(), org_id=org_id, scan=scan, tool=tool, title="lodash prototype pollution",
        cve_id="CVE-2020-8203", severity=SimpleNamespace(value="high"), remediation=None,
        description="", target=target, pr_url=None, pr_status=None,
        scan_metadata={"package_name": "lodash", "fixed_version": "4.17.21"},
    )


def _call(db, finding, org_id):
    from app.routers.findings import create_fix_pr
    return create_fix_pr(finding_id=finding.id, db=db, org_id=org_id, current_user=None)


@pytest.fixture
def production(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SIGMASEC_PR_SIMULATION", "1")  # must be ignored in production


def test_fix_pr_without_github_config_errors_instead_of_faking(production):
    org = uuid.uuid4()
    finding = _finding(org)
    db = _FakeDB(finding, gh_config=None)
    with pytest.raises(HTTPException) as exc:
        _call(db, finding, org)
    assert exc.value.status_code == 400
    assert "Connect GitHub" in exc.value.detail
    assert finding.pr_url is None and not db.committed


def test_fix_pr_with_mock_token_errors_instead_of_faking(production, monkeypatch):
    import app.utils.encryption as enc
    org = uuid.uuid4()
    finding = _finding(org)
    cfg = SimpleNamespace(access_token=enc.encrypt_value("ghp_mock_developer_access_token_123456"))
    with pytest.raises(HTTPException) as exc:
        _call(_FakeDB(finding, cfg), finding, org)
    assert exc.value.status_code == 400
    assert finding.pr_url is None


def test_fix_pr_for_non_github_target_errors(production):
    import app.utils.encryption as enc
    org = uuid.uuid4()
    finding = _finding(org, target="https://gitlab.com/acme/app.git")
    cfg = SimpleNamespace(access_token=enc.encrypt_value(TOKEN))
    with pytest.raises(HTTPException) as exc:
        _call(_FakeDB(finding, cfg), finding, org)
    assert exc.value.status_code == 400
    assert "GitHub" in exc.value.detail


def test_fix_pr_git_failure_never_leaks_token(production, monkeypatch, caplog):
    import app.utils.encryption as enc
    org = uuid.uuid4()
    finding = _finding(org)
    cfg = SimpleNamespace(access_token=enc.encrypt_value(TOKEN))
    seen_argv = []

    def failing_run(cmd, *args, **kwargs):
        seen_argv.append(" ".join(cmd))
        # Simulate git echoing an authenticated URL in its error.
        raise subprocess.CalledProcessError(
            128, cmd + [f"https://x-access-token:{TOKEN}@github.com/acme/app.git"],
            stderr=f"fatal: could not read from https://x-access-token:{TOKEN}@github.com".encode(),
        )

    monkeypatch.setattr(subprocess, "run", failing_run)
    with pytest.raises(HTTPException) as exc:
        _call(_FakeDB(finding, cfg), finding, org)

    assert exc.value.status_code == 400
    assert TOKEN not in exc.value.detail
    assert all(TOKEN not in a for a in seen_argv), "token must not be passed on the command line"
    assert TOKEN not in caplog.text
    assert finding.pr_url is None


# ── S3: reachability verdicts ────────────────────────────────────────────────

def test_package_not_imported_is_uncertain_not_unreachable(tmp_path):
    from app.ai.reachability import determine_cve_reachability
    from app.tasks.scan_tasks import UNREACHABLE_MIN_CONFIDENCE

    # PyYAML is imported as `yaml`, so a name match finds nothing.
    (tmp_path / "app.py").write_text("import yaml\nyaml.safe_load('a: 1')\n")
    finding = SimpleNamespace(id=uuid.uuid4(), metadata={"package": "PyYAML"}, description="")

    class NoLLM:
        def _call_model_with_model_override(self, **kwargs):
            raise AssertionError("LLM must not be called when nothing is imported")

    result = determine_cve_reachability(finding, str(tmp_path), client=NoLLM())
    assert result.reachability == "uncertain"
    assert result.confidence < UNREACHABLE_MIN_CONFIDENCE


# ── Claim 5: Nuclei findings are never marked exploit-validated ──────────────

def test_nuclei_validate_option_does_not_mark_findings_validated():
    from app.adapters.nuclei import NucleiAdapter

    adapter = NucleiAdapter.__new__(NucleiAdapter)
    data = {
        "template-id": "CVE-2021-44228",
        "matched-at": "https://example.com/",
        "info": {"name": "Log4Shell", "severity": "critical",
                 "classification": {"cve-id": ["CVE-2021-44228"]}},
    }
    f = adapter._parse_finding(data, "s", "o", "a", validate_mode=True)
    assert f["exploit_validated"] is False
    assert f["metadata"]["evidence_type"] == "nuclei_template_match"
    assert f["metadata"]["active_validation_requested"] is True


def test_nuclei_command_never_passes_template_validate_flag(monkeypatch):
    import app.adapters.nuclei as nuclei_mod

    captured = {}

    def fake_run(scan_id, cmd, timeout):
        captured["cmd"] = cmd
        return SimpleNamespace(timed_out=False, returncode=0, stdout="")

    monkeypatch.setattr(nuclei_mod, "run_logged_command", fake_run)
    monkeypatch.setattr(nuclei_mod, "assert_public_target", lambda t: ["93.184.216.34"])  # no live DNS in tests
    adapter = nuclei_mod.NucleiAdapter.__new__(nuclei_mod.NucleiAdapter)
    adapter.binary = "nuclei"
    adapter.run("https://example.com", "s", "o", "a", options={"validate": True})
    assert "-validate" not in captured["cmd"]
