# SigmaSec — Claims Audit (Phase 0)

**Audited:** 2 October 2026 · commit `f3235c4` (`main`)
**Scope:** every public claim on the landing page (`frontend/platform-ui/app/page.tsx`), `/privacy`, `/help`, the README, and the customer-facing dashboard API — checked against the backend code.
**Method:** read-only. No code was changed.

> **Update — branch `fix/pre-pilot-trust`:** fixes S1–S5 and claim 22 (dashboard shows only real data), removes the fake "exploit validated" flag (claim 5, backend and scan dialog), stops the Opengrep file-exists "reachable" shortcut (claim 4), and adds a migration for eight `findings` columns that had none. Landing-page copy (claims 1–3, 6–21) is **not** changed yet.
>
> **Update — branch `fix/honest-copy`:** corrects the landing, privacy, terms and help copy for claims 1–21, removes invented fallback data from the finding drawer, scan terminal and settings, unifies the posture score, and clears stale `exploit_validated` flags. Facts only the founders can confirm are listed in `docs/FOUNDER_TODO.md`.

Status key:
- **Implemented** — the code does what the copy says.
- **Partial** — something real exists, but the copy overstates it.
- **Missing** — no code backs the claim.
- **Misleading** — the code does something different from what the copy implies, or shows invented data.
- **Unverified** — depends on a contract or deployment fact the code can't show (`TODO(founder)`).

---

## Summary

| Status | Count |
|---|---|
| Implemented | 3 |
| Partial | 7 |
| Missing | 7 |
| Misleading | 4 |
| Unverified | 4 |

The scanning pipeline and threat-intel enrichment are real and tested. The parts buyers will scrutinise hardest — noise-reduction numbers, reachability, exploit validation, AI fix PRs, private deployment and data residency — are overstated or absent. Two problems need fixing **before any pilot**, ahead of all marketing work:

1. **The customer dashboard shows invented data** when real data is thin (claim 22).
2. **Fix-PR creation can leak the customer's GitHub token** in an API error, and silently reports fake PRs as opened (S1, S2, claim 10).

---

## Claims table

| # | Claim as written | Where on the site | Where in the code | Status | Evidence | Recommended copy |
|---|---|---|---|---|---|---|
| 1 | "1,204 problems… Fourteen were real"; sieve 1,204 → 399 → 86 → 14 → 7; "−99% Noise Dropped (Only ~1% critical)" | `page.tsx` L83–86, L544, L785, L1590–1627 | None. The same 86 and 14 appear as hardcoded fallbacks in `routers/dashboard.py` L108–113 | **Missing** | No benchmark, dataset or script produces these numbers | Label the sieve "Illustrative example". Replace with real numbers from the Phase 1 benchmark, stating which repos they came from |
| 2 | "Claude AI Verified (Zero false alarms)" | `page.tsx` L789 | None | **Missing** | The LLM writes explanations; nothing verifies findings or measures false positives | Remove. No scanner can claim zero false alarms |
| 3 | "Posture Score · SOC 2 Ready" | `page.tsx` L793 | — | **Misleading** | Contradicts the site's own trust table (SOC 2 "In progress", L2040–2045) | Remove "SOC 2 Ready" |
| 4 | "AST reachability from entry points"; "The vulnerable function is actually reachable from your entry points"; Opengrep feeds "Reachability from entry points"; team bio "AST graph generation" | `page.tsx` L536–544, L1612, L1709–1710, L1959, L2079–2088 | `ai/reachability.py`; `tasks/scan_tasks.py` L281–322 | **Partial** | Python: `ast` finds imports and direct call sites of the package. Other languages: plain string matching. An LLM then guesses reachable/unreachable. There is no call graph and no entry-point analysis. Opengrep "reachability" only checks the file exists in the repo (L304–316), so every Opengrep finding becomes "reachable" | "Import-level usage check for Python dependencies (beta), with AI-assisted review. Every result shows its evidence." Drop "entry points" until a real call graph exists |
| 5 | "Exploited in a sandbox against your build. Evidence attached."; "Sandbox exploit validation"; "Claude AI confirms memory corruption"; "We confirmed it against your staging build on 18 Aug" | `page.tsx` L560, L1619, L1759, L1960; `dashboard.py` L143 | `adapters/nuclei.py` L61–62, L131 | **Missing** | There is no sandbox. The `active_validation` option adds Nuclei's `-validate` flag, which only checks template **syntax** (Nuclei help: "validate the passed templates to nuclei"). The adapter then sets `exploit_validated=True` on every finding and boosts its priority | Remove all sandbox/exploit-confirmed copy. Describe Nuclei results as "matched by a Nuclei detection template against your endpoint". Rename `exploit_validated` internally, or put it behind a flag until real validation exists |
| 6a | Five engines marked "Live" (Trivy, Gitleaks, Nuclei, Opengrep, Nmap) | `page.tsx` L1689–1718 | `adapters/*.py` | **Implemented** | All five adapters exist and run | Keep. Fix the hero lede, which says "Four engines" (L1598) |
| 6b | Trivy feeds "Dependency graph and SBOM" | `page.tsx` L1692 | — | **Missing** | No SBOM/CycloneDX output anywhere in the backend | "Dependency and container vulnerability findings" |
| 6c | Gitleaks reads "full commit history" | `page.tsx` L1697 | `adapters/gitleaks.py` L67, L83 | **Partial** | Clones `--depth 50 --single-branch`: last 50 commits of one branch | "Recent history (last 50 commits) of the default branch" — or remove the depth limit |
| 6d | Gitleaks feeds a "Credential validation queue"; dashboard "credential validated as active" | `page.tsx` L1698; `dashboard.py` L154 | — | **Missing** | No secret is ever checked for liveness. The dashboard text is hardcoded | Remove until liveness checks exist |
| 7 | "Duplicates across engines collapse into one record" | `page.tsx` L1673, L1933–1937 | `adapters/base.py` L87; each adapter's fingerprint | **Partial** | Fingerprints include the tool name, so dedup works within one engine and across repeat scans, but never across engines | "Deterministic dedup by fingerprint within each engine and across scans" |
| 8 | Enrichment with CISA KEV, FIRST EPSS, NVD CVSS | `page.tsx` L523–530, L1956–1958 | `intel/kev.py`, `intel/epss.py`, `intel/nvd.py`; `scan_tasks.py` L349–382; tests `test_kev.py`, `test_epss.py`, `test_nvd.py` | **Implemented** | Real lookups, with tests | Keep |
| 9 | AI plain-English explanation of each finding | `page.tsx` L1971–1977 | `ai/claude_client.py`, `ai/prompt_builder.py` | **Implemented** | Works with Anthropic or a local Ollama model | Keep. Drop "audio completion earcons" and "table sparkle indicators" — they read as unserious to a security buyer |
| 10 | AI-written patches; "a pull request you can review and merge"; "7… already had a pull request open"; "AutoFix PR #402 generated with passing CI" | `page.tsx` L86, L567–577, L1626, L1734–1736, L1972–1980 | `routers/findings.py` L360–640 | **Partial** | Fixes are deterministic templates, not AI: version bumps for npm/pip/Go; a regex swap for Slack/GitHub tokens only (the raw secret isn't stored, so other secret types aren't fixed); a `REMEDIATION.md` file for Nuclei, Opengrep and Nmap findings. Nothing runs CI. If the GitHub token is missing, a mock, or fails to decrypt, it **silently switches to simulation** and records a fake PR URL as `open` (L383–401, L597–599) | "One-click dependency-upgrade PRs for npm, pip and Go; remediation advisories for everything else." Remove "passing CI" and "AI-written patch" until true. Make simulation mode explicit, or remove it from production |
| 11 | Example finding: "CVE-2024-31497 — weak SSH key exchange (`diffie-hellman-group1-sha1`)… KEV listed, EPSS 0.82"; "SSH session logs show no client negotiated… in the past 90 days" | `page.tsx` L1745–1764, L1861, L1897–1899 | — | **Misleading** | CVE-2024-31497 is the PuTTY P-521 ECDSA nonce flaw, not a weak DH key exchange. Security buyers will spot this immediately. The product also never reads SSH logs | Use a real, correctly described CVE and label the panel "Example". Remove the SSH-log claim |
| 12 | "Your code stays in your environment"; "Scanning and reachability analysis run inside your own infrastructure… Terraform modules (`infra/`)… We receive finding metadata, not your repository" — chip "Available today"; README L184 "Production-ready Terraform infrastructure modules" | `page.tsx` L1572, L2016–2022; `README.md` L184 | `infra/` contains only `.gitkeep` | **Missing** | No Terraform exists. The hosted service clones customer repos into its own workers (`gitleaks.py`, `opengrep.py`, `scan_tasks.py` L255–263). Self-hosting the whole stack with `docker-compose.yml` is possible | "Self-host the full stack with Docker Compose today. Private-VPC Terraform modules: coming soon." Change the chip to "Coming" and fix the README |
| 13 | "No training on customer data"; "Inference runs under zero-retention terms with our model providers" — chip "Contractual"; privacy page "Zero Data Retention" | `page.tsx` L1573, L2025–2030; `privacy/page.tsx` L60, L98 | `ai/claude_client.py` L34–37, L222–256 | **Unverified** | Zero retention with Anthropic needs a separate agreement; nothing in code shows one. Positive: the default provider is local Ollama, so by default nothing leaves the deployment | `TODO(founder)`: keep "zero retention" only if a signed ZDR agreement exists. Otherwise say "Run fully local with Ollama, or use Claude under its standard commercial terms" |
| 14 | "India data residency available"; "India-region hosting for DPDP Act 2023 obligations" — chip "Available today" | `page.tsx` L1574, L2033–2037; `privacy/page.tsx` L66–68 | `vercel.json` (no region); `v1-LIMITATIONS.md` L102 (single Hetzner VPS) | **Unverified** | No India region is configured for the hosted service. The reference backend is one Hetzner VPS; Hetzner has no India region. Self-hosting in an Indian region is possible | `TODO(founder)`: "Self-host in an Indian cloud region today; managed India hosting on request" — unless the hosted backend really runs in India |
| 15 | "Cryptographic audit logging and access controls are in place" | `page.tsx` L2042 | `models/audit_log.py` | **Partial** | A plain audit table exists with no hashing, signing or tamper evidence, and no UI (`v1-LIMITATIONS.md` L112–114) | "Audit logging and role-based access control are in place" |
| 16 | SOC 2 Type II "audit is scheduled" | `page.tsx` L2040–2045 | — | **Unverified** | Can't be shown from code | `TODO(founder)`: keep only if an auditor is engaged; otherwise "on our roadmap" |
| 17 | "Read the full trust documentation — architecture diagram, subprocessor list, retention policy, incident response" | `page.tsx` L2050–2056 | `/help` | **Missing** | `/help` is a product FAQ. None of the four documents exist | Remove the promise until Phase 2's `/trust` page exists |
| 18 | "Mandatory TLS 1.3 across all public and internal service boundaries"; "AES-256 encryption applied to all database records and storage volumes" | `privacy/page.tsx` L111–112 | `utils/encryption.py` | **Misleading** | Only integration tokens are encrypted, using Fernet (AES-128-CBC + HMAC), with a hardcoded fallback key (see S2). Nothing configures TLS between internal services (Postgres, Redis, MinIO) | "Integration credentials are encrypted at the application layer. Traffic to SigmaSec is encrypted with TLS." `TODO(founder)`: add disk-encryption details per hosting provider |
| 19 | Compliance mapping "automatically translates findings into SOC 2, PCI-DSS, ISO 27001, NIST 800-53… audit-ready reports for external auditors" | `help/page.tsx` L138, L144 | `compliance/mapper.py`; `v1-LIMITATIONS.md` L124–126 | **Partial** | A mapper exists, but the project's own limitations doc says report packs are static templates with placeholder evidence | "Findings are tagged to common control families to help audit preparation." Drop "audit-ready" |
| 20 | Team: "Ex-AppSec leads… built autonomous triage and reachability analysis for internal use"; "background in sandboxed build infrastructure" | `page.tsx` L2079–2088 | — | **Unverified** | Can't be shown from code. Given claims 4 and 5, this will be questioned | `TODO(founder)`: replace with specific, checkable backgrounds |
| 21 | Footer "Data isolated. Encrypted. Never shared."; domain "sigmasec.ai"; `founders@sigmasec.ai` | `page.tsx` L1472, L2174–2175 | — | **Partial** | The site runs on `sigmasec.vercel.app`; whether `sigmasec.ai` is owned and the mailbox works can't be checked from code | `TODO(founder)`: confirm domain ownership and mail delivery; use the custom domain or remove it |
| 22 | Customer dashboard ("Do this next", funnel counts, posture driver, remediation workstreams) | In-product, `/dashboard` | `routers/dashboard.py` L104, L108–113, L127–192, L183, L288–320 | **Misleading** — *highest priority* | When real data is thin, the API returns invented values to customers: reachable = 86 and exploitable = 14 if the real count is 0; a hardcoded posture driver ("…introduced in earthworks/libraDigit_web on Jul 18"); fallback "Do this next" items (sandbox-validated, live AWS key, etc.) whenever fewer than 4 real items exist; every real item labelled "reachable in code" with EPSS defaulting to 0.75 and made-up SLA text; static remediation workstreams. The reachable count also includes every finding not flagged as a false-positive candidate | Show real values only, with empty states ("No reachable findings yet") when data is missing. Move demo data to an explicit seeded demo org |

---

## Security and correctness issues found during the audit

These aren't marketing claims, but a security buyer or pentester would find them in a pilot. Fix before onboarding design partners.

| # | Issue | Location | Severity | Fix |
|---|---|---|---|---|
| S1 | **GitHub token leak.** The token is embedded in the clone URL; if `git clone` fails, `CalledProcessError`'s message (which includes the full command) is logged and **returned to the browser** in the HTTP 400 `detail` | `routers/findings.py` L459–461, L632–639 | High | Pass credentials via `GIT_ASKPASS` or an auth header, never in the URL. Return a generic error message; log a scrubbed one |
| S2 | **Hardcoded fallback encryption key**: if `ENCRYPTION_KEY` is unset, all stored GitHub/Jira/Slack tokens are encrypted with a key that's in the source. `decrypt_value` returns the raw input on failure, and a failed decrypt falls back to the mock token, which triggers fake-PR simulation | `utils/encryption.py` L8–11, L31–36; `routers/findings.py` L383–388 | High | Fail closed at startup if the key is missing. Raise on decrypt failure. Never fall back to a mock token outside development |
| S3 | **Reachability false negatives at confidence 1.0.** A package that isn't imported by name is marked `unreachable` with confidence 1.0 and its priority cut ×0.7. This wrongly demotes OS packages in containers, transitive dependencies, and packages whose import name differs from the package name (e.g. PyYAML → `yaml`, Pillow → `PIL`) | `ai/reachability.py` L254–261; `scan_tasks.py` L296–297 | High (it hides real risk) | Return `uncertain` in these cases; only demote with positive evidence |
| S4 | Simulation mode in the production fix-PR path records a fake PR URL as `open` | `routers/findings.py` L398–401, L597–599 | High (misleads users) | Gate behind an explicit dev-only flag; return a clear error in production |
| S5 | The secret-fix flow appends the edited **source file** to `.gitignore`, leaves the secret in git history, and writes a Python expression into any file type | `routers/findings.py` L467–501 | Medium | Don't touch `.gitignore`. Tell users to rotate the key and purge history; only offer code edits for known file types |
| S6 | Finding lookup by fingerprint isn't scoped to the org | `tasks/scan_tasks.py` L157 | Low (asset IDs make collisions unlikely) | Add `org_id` to the query, as defence in depth |
| S7 | The default Anthropic model string `claude-3-5-sonnet-20241022` may be retired; AI enrichment fails "best effort", so this would go unnoticed | `ai/claude_client.py` L35 | Low | Make the model configurable with a current default, and alert on repeated failures |

---

## What's genuinely strong (use it in positioning)

- **Local LLM support already works.** `AI_PROVIDER` defaults to `ollama` (`claude_client.py` L34–36). `v1-LIMITATIONS.md` L40–42 wrongly says there's no self-hosted LLM option — fix the doc. This is the base for the private-deployment pitch.
- **Secrets are redacted before any LLM call** (`claude_client.py` L14–31), with guardrail tests (`tests/test_ai_guardrails.py`).
- **Gitleaks stores only a masked secret plus a hash**, never the raw value (`gitleaks.py` L202–239).
- **Scans of private/loopback addresses are blocked** (`routers/scans.py` L59–75).
- **KEV/EPSS/NVD enrichment and multi-tenancy have tests.**
- **Self-hosting the whole stack via `docker-compose.yml`** is already possible.

---

## Suggested order of work

1. Fix S1–S4 and claim 22 (dashboard). These affect anyone who tries the product.
2. Fix the copy for claims 1–5, 10–12, 14 and 18. This is mostly deleting or softening text and can ship the same day.
3. Then Phase 1: the benchmark harness, real reachability, and measured fix PRs, so the numbers can come back with evidence behind them.

## TODO(founder)

- Confirm whether a zero-data-retention agreement with Anthropic exists (claim 13).
- Confirm where the hosted backend actually runs, and whether India hosting is offered (claim 14).
- Confirm SOC 2 status and auditor (claim 16).
- Provide specific, checkable team backgrounds (claim 20).
- Confirm ownership of `sigmasec.ai` and that `founders@sigmasec.ai` receives mail (claim 21).
