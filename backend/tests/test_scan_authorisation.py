"""
Scan authorisation: web (Nuclei) and network (Nmap) scans may only target
public addresses that the organisation has proven it controls.
"""

import socket
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException

from app.security import ownership, targets
from app.security.targets import TargetNotAllowed

# ── deterministic DNS ────────────────────────────────────────────────────────

FAKE_DNS = {
    "acme.example": ["93.184.216.34"],
    "api.acme.example": ["93.184.216.35"],
    "deep.api.acme.example": ["93.184.216.36"],
    "evilacme.example": ["93.184.216.37"],
    "other.example": ["93.184.216.38"],
    "rebind.example": ["127.0.0.1"],
    "mixed.example": ["93.184.216.39", "10.0.0.5"],
    "meta.example": ["169.254.169.254"],
    "v6loop.example": ["::1"],
    "mapped.example": ["::ffff:192.168.1.10"],
}


@pytest.fixture(autouse=True)
def fake_dns(monkeypatch):
    def getaddrinfo(host, port, *args, **kwargs):
        try:
            import ipaddress
            ipaddress.ip_address(host)
            addrs = [host]
        except ValueError:
            if host not in FAKE_DNS:
                raise socket.gaierror("not found")
            addrs = FAKE_DNS[host]
        return [(socket.AF_INET6 if ":" in a else socket.AF_INET, socket.SOCK_STREAM, 6, "", (a, 0)) for a in addrs]

    monkeypatch.setattr(socket, "getaddrinfo", getaddrinfo)


# ── targets ──────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw,host", [
    ("https://API.Acme.example:8443/login?x=1", "api.acme.example"),
    ("acme.example", "acme.example"),
    ("http://user:pw@[2001:db8::1]:80/", "2001:db8::1"),
    ("acme.example.", "acme.example"),
    ("93.184.216.34:22", "93.184.216.34"),
])
def test_extract_host(raw, host):
    assert targets.extract_host(raw) == host


@pytest.mark.parametrize("target", [
    "127.0.0.1", "10.1.2.3", "192.168.0.1", "172.16.0.9", "169.254.169.254", "0.0.0.0",
    "[::1]", "localhost", "db.internal", "printer.local",
    "rebind.example",      # public-looking name resolving to loopback
    "mixed.example",       # one public + one private address
    "meta.example",        # cloud metadata address
    "v6loop.example", "mapped.example",
    "2130706433",          # decimal form of 127.0.0.1
    "does-not-exist.example",
])
def test_non_public_targets_are_refused(target, monkeypatch):
    if target == "2130706433":
        # libc turns the decimal form into 127.0.0.1; emulate that here.
        FAKE_DNS["2130706433"] = ["127.0.0.1"]
    with pytest.raises(TargetNotAllowed):
        targets.assert_public_target(target)


def test_public_target_allowed():
    assert targets.assert_public_target("https://acme.example/x") == ["93.184.216.34"]


def test_coverage_rules():
    dns = [("acme.example", "dns_txt")]
    assert targets.covering_scope("acme.example", dns)
    assert targets.covering_scope("deep.api.acme.example", dns)
    assert targets.covering_scope("evilacme.example", dns) is None  # suffix trick
    http = [("api.acme.example", "http_file")]
    assert targets.covering_scope("api.acme.example", http)
    assert targets.covering_scope("deep.api.acme.example", http) is None  # file proves one host only
    assert targets.covering_scope("acme.example", http) is None
    ip = [("93.184.216.34", "http_file")]
    assert targets.covering_scope("93.184.216.34", ip)
    assert targets.covering_scope("93.184.216.35", ip) is None


def test_scope_normalisation_and_method_rules():
    assert targets.normalise_scope("https://Acme.Example/path") == "acme.example"
    with pytest.raises(TargetNotAllowed):
        targets.normalise_scope("intranet")
    with pytest.raises(TargetNotAllowed):
        ownership.validate_method_for_scope("93.184.216.34", "dns_txt")


# ── ownership checks ─────────────────────────────────────────────────────────

class _FakeResolver:
    def __init__(self, records=None, exc=None):
        self.records, self.exc, self.lifetime = records or [], exc, None
        self.asked = None

    def resolve(self, name, rtype):
        self.asked = (name, rtype)
        if self.exc:
            raise self.exc
        return [SimpleNamespace(strings=[v.encode()]) for v in self.records]


def test_dns_txt_check():
    import dns.resolver
    ok = _FakeResolver(records=["unrelated", "sigmasec-verification=tok123"])
    res = ownership.check_dns_txt("acme.example", "tok123", resolver=ok)
    assert res.ok and ok.asked == ("_sigmasec-challenge.acme.example", "TXT")
    assert not ownership.check_dns_txt("acme.example", "tok123", resolver=_FakeResolver(records=["sigmasec-verification=other"])).ok
    assert not ownership.check_dns_txt("acme.example", "tok123", resolver=_FakeResolver(exc=dns.resolver.NXDOMAIN())).ok


def _client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=False)


def test_http_file_check_success_and_failures():
    good = _client(lambda req: httpx.Response(200, text="tok123\n"))
    assert ownership.check_http_file("acme.example", "tok123", client=good).ok

    wrong = _client(lambda req: httpx.Response(200, text="nope"))
    assert not ownership.check_http_file("acme.example", "tok123", client=wrong).ok

    # Redirects are not followed, even to a page that contains the token.
    redirect = _client(lambda req: httpx.Response(302, headers={"Location": "https://other.example/tok123"}))
    assert not ownership.check_http_file("acme.example", "tok123", client=redirect).ok


def test_http_file_check_never_fetches_internal_hosts():
    calls = []
    spy = _client(lambda req: calls.append(req) or httpx.Response(200, text="tok123"))
    res = ownership.check_http_file("rebind.example", "tok123", client=spy)
    assert not res.ok and calls == []


# ── API + enforcement against the real database ──────────────────────────────

@pytest.fixture
def org_ctx(monkeypatch):
    from app.database import SessionLocal
    from app.models import Org, User
    from app.models.user import UserRole

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("SIGMASEC_ALLOW_UNVERIFIED_TARGETS", raising=False)

    db = SessionLocal()
    org = Org(id=uuid.uuid4(), name="Authz", slug=f"authz-{uuid.uuid4().hex[:10]}")
    db.add(org)
    db.commit()
    admin = User(id=uuid.uuid4(), org_id=org.id, email=f"a-{uuid.uuid4().hex[:8]}@t.example",
                 hashed_password="x", role=UserRole.admin)
    db.add(admin)
    db.commit()

    queued = []
    import app.routers.scans as scans_mod
    monkeypatch.setattr(scans_mod.run_scan_task, "delay",
                        lambda **kw: queued.append(kw) or SimpleNamespace(id="task-1"))

    class FakeRedis:
        def __init__(self):
            self.n = {}

        def incr(self, k):
            self.n[k] = self.n.get(k, 0) + 1
            return self.n[k]

        def expire(self, k, s):
            pass

    fake_redis = FakeRedis()
    import app.security.enforcement as enf
    real_check = enf.check_rate_limit
    monkeypatch.setattr(enf, "check_rate_limit", lambda org_id, redis_client=None: real_check(org_id, redis_client=fake_redis))

    yield SimpleNamespace(db=db, org=org, admin=admin, queued=queued)

    from app.models import AuditLog, Scan, Asset, TargetVerification
    for model in (Scan, Asset, TargetVerification, AuditLog):
        db.query(model).filter(model.org_id == org.id).delete()
    db.query(User).filter(User.org_id == org.id).delete()
    db.query(Org).filter(Org.id == org.id).delete()
    db.commit()
    db.close()


def _scan(ctx, target, types):
    from app.routers.scans import create_scan
    from app.schemas.scan import ScanIn
    return create_scan(request=None, payload=ScanIn(target=target, scan_types=types), db=ctx.db,
                       org_id=ctx.org.id, current_user=ctx.admin, _rate_check=None)


def _verify(ctx, target, method="dns_txt", ok=True, monkeypatch=None):
    from app.routers.verifications import VerificationIn, check_verification, start_verification
    v = start_verification(VerificationIn(target=target, method=method), db=ctx.db, org_id=ctx.org.id, current_user=ctx.admin)
    monkeypatch.setattr(ownership, "run_check", lambda scope, m, tok: ownership.CheckResult(ok, "test"))
    return check_verification(v.id, db=ctx.db, org_id=ctx.org.id, current_user=ctx.admin)


def test_active_scan_refused_without_verification_and_audited(org_ctx):
    from app.models import AuditLog
    with pytest.raises(HTTPException) as exc:
        _scan(org_ctx, "https://acme.example", ["vuln"])
    assert exc.value.status_code == 403 and "Verify" in exc.value.detail
    assert org_ctx.queued == []
    blocked = org_ctx.db.query(AuditLog).filter(AuditLog.org_id == org_ctx.org.id, AuditLog.action == "scan_blocked").all()
    assert len(blocked) == 1 and blocked[0].details["target"] == "https://acme.example"


def test_code_scans_do_not_need_verification(org_ctx):
    scan = _scan(org_ctx, "https://github.com/acme/app.git", ["sca", "secret", "opengrep"])
    assert scan.id and len(org_ctx.queued) == 1


def test_private_target_refused_even_if_verified_elsewhere(org_ctx):
    with pytest.raises(HTTPException) as exc:
        _scan(org_ctx, "rebind.example", ["network"])
    assert exc.value.status_code == 422


def test_dns_verification_allows_domain_and_subdomains(org_ctx, monkeypatch):
    v = _verify(org_ctx, "acme.example", monkeypatch=monkeypatch)
    assert v.status == "verified"
    _scan(org_ctx, "https://deep.api.acme.example/login", ["vuln"])
    _scan(org_ctx, "acme.example", ["network"])
    assert len(org_ctx.queued) == 2
    with pytest.raises(HTTPException):
        _scan(org_ctx, "evilacme.example", ["vuln"])

    from app.models import AuditLog
    created = org_ctx.db.query(AuditLog).filter(AuditLog.org_id == org_ctx.org.id, AuditLog.action == "create_scan").all()
    assert {c.details["target_verification_id"] for c in created} == {str(v.id)}


def test_failed_check_does_not_verify(org_ctx, monkeypatch):
    v = _verify(org_ctx, "acme.example", ok=False, monkeypatch=monkeypatch)
    assert v.status == "pending"
    with pytest.raises(HTTPException):
        _scan(org_ctx, "acme.example", ["vuln"])


def test_http_file_verification_covers_exact_host_only(org_ctx, monkeypatch):
    _verify(org_ctx, "api.acme.example", method="http_file", monkeypatch=monkeypatch)
    _scan(org_ctx, "https://api.acme.example", ["vuln"])
    with pytest.raises(HTTPException):
        _scan(org_ctx, "https://deep.api.acme.example", ["vuln"])


def test_expired_verification_is_not_accepted(org_ctx, monkeypatch):
    from app.models import TargetVerification
    _verify(org_ctx, "acme.example", monkeypatch=monkeypatch)
    row = org_ctx.db.query(TargetVerification).filter(TargetVerification.org_id == org_ctx.org.id).one()
    row.verified_at = datetime.now(timezone.utc) - timedelta(days=ownership.VERIFICATION_TTL_DAYS + 1)
    org_ctx.db.commit()
    with pytest.raises(HTTPException) as exc:
        _scan(org_ctx, "acme.example", ["vuln"])
    assert exc.value.status_code == 403


def test_verification_is_per_organisation(org_ctx, monkeypatch):
    from app.models import TargetVerification
    other_org = uuid.uuid4()
    # A verification row belonging to a different org must not count.
    from app.models import Org
    org_ctx.db.add(Org(id=other_org, name="Other", slug=f"other-{uuid.uuid4().hex[:8]}"))
    org_ctx.db.add(TargetVerification(org_id=other_org, scope="acme.example", method="dns_txt", token="t",
                                      verified_at=datetime.now(timezone.utc)))
    org_ctx.db.commit()
    try:
        with pytest.raises(HTTPException) as exc:
            _scan(org_ctx, "acme.example", ["vuln"])
        assert exc.value.status_code == 403
    finally:
        org_ctx.db.query(TargetVerification).filter(TargetVerification.org_id == other_org).delete()
        org_ctx.db.query(Org).filter(Org.id == other_org).delete()
        org_ctx.db.commit()


def test_hourly_limit_per_org(org_ctx, monkeypatch):
    monkeypatch.setenv("SIGMASEC_ACTIVE_SCANS_PER_HOUR", "2")
    _verify(org_ctx, "acme.example", monkeypatch=monkeypatch)
    _scan(org_ctx, "acme.example", ["vuln"])
    _scan(org_ctx, "acme.example", ["vuln"])
    with pytest.raises(HTTPException) as exc:
        _scan(org_ctx, "acme.example", ["vuln"])
    assert exc.value.status_code == 429


def test_dev_bypass_only_in_development(org_ctx, monkeypatch):
    monkeypatch.setenv("SIGMASEC_ALLOW_UNVERIFIED_TARGETS", "1")
    with pytest.raises(HTTPException):  # still production
        _scan(org_ctx, "acme.example", ["vuln"])
    monkeypatch.setenv("ENVIRONMENT", "development")
    _scan(org_ctx, "acme.example", ["vuln"])
    with pytest.raises(HTTPException) as exc:  # bypass never allows private targets
        _scan(org_ctx, "rebind.example", ["vuln"])
    assert exc.value.status_code == 422


def test_start_verification_is_idempotent_and_revocable(org_ctx, monkeypatch):
    from app.routers.verifications import (VerificationIn, list_verifications, revoke_verification,
                                           start_verification)
    a = start_verification(VerificationIn(target="https://Acme.example/x", method="dns_txt"),
                           db=org_ctx.db, org_id=org_ctx.org.id, current_user=org_ctx.admin)
    b = start_verification(VerificationIn(target="acme.example", method="dns_txt"),
                           db=org_ctx.db, org_id=org_ctx.org.id, current_user=org_ctx.admin)
    assert a.id == b.id and a.scope == "acme.example"
    assert a.instructions["record_name"] == "_sigmasec-challenge.acme.example"
    assert a.instructions["record_value"].startswith("sigmasec-verification=")
    revoke_verification(a.id, db=org_ctx.db, org_id=org_ctx.org.id, current_user=org_ctx.admin)
    assert list_verifications(db=org_ctx.db, org_id=org_ctx.org.id, current_user=org_ctx.admin) == []


# ── adapters re-check right before sending traffic ───────────────────────────

@pytest.mark.parametrize("module,cls", [("app.adapters.nuclei", "NucleiAdapter"), ("app.adapters.nmap", "NmapAdapter")])
def test_adapters_refuse_non_public_targets_at_run_time(monkeypatch, module, cls):
    import importlib
    mod = importlib.import_module(module)
    ran, refused = [], []
    monkeypatch.setattr(mod, "run_logged_command", lambda **kw: ran.append(kw))
    monkeypatch.setattr(mod, "refuse_target", lambda scan_id, tool, reason: refused.append(reason))
    adapter = getattr(mod, cls).__new__(getattr(mod, cls))
    adapter.binary = "x"
    assert adapter.run("rebind.example", "s", "o", "a") == []
    assert ran == [] and refused


def test_nmap_passes_bare_ipv6_host(monkeypatch):
    import app.adapters.nmap as nmap_mod
    captured = {}
    monkeypatch.setattr(nmap_mod, "run_logged_command",
                        lambda **kw: captured.update(kw) or SimpleNamespace(timed_out=False, returncode=0, stdout="<nmaprun/>"))
    monkeypatch.setattr(nmap_mod, "assert_public_target", lambda t: ["2001:4860:4860::8888"])
    adapter = nmap_mod.NmapAdapter.__new__(nmap_mod.NmapAdapter)
    adapter.binary = "nmap"
    adapter.run("http://[2001:4860:4860::8888]:8080/", "s", "o", "a")
    assert captured["cmd"][-1] == "2001:4860:4860::8888"


# ── demo accounts are never seeded outside development ───────────────────────

def test_seed_refuses_outside_development(monkeypatch):
    import app.seed as seed_mod
    monkeypatch.setenv("ENVIRONMENT", "production")
    opened = []
    monkeypatch.setattr(seed_mod, "SessionLocal", lambda: opened.append(1) or (_ for _ in ()).throw(AssertionError("DB touched")))
    seed_mod.seed()
    assert opened == []
