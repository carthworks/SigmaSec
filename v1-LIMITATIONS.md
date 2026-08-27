# v1 Known Limitations

> This document captures **all known limitations, deferred capabilities, and hard edges** of the v1.0 platform.  
> It exists so that customers, the support team, and future engineers can set expectations correctly.  
> Items marked `v1.1` or `v1.2` have tracking in the roadmap.

---

## 🔍 Scanning

### No cloud infrastructure scanning
**Status:** Deferred to v1.1  
Prowler (AWS/Azure/GCP CIS benchmarks) and Checkov (Terraform/CloudFormation IaC) are not integrated.  
The platform currently scans web endpoints (Nuclei), container images (Trivy), and Git repositories (Gitleaks) only.

### No network / host scanning
**Status:** ✅ Implemented in v1.0.x  
Nmap port and service scanning is now available via the `network` scan type. The `NmapAdapter` runs `nmap -sV -sC --open` against a registered `host` asset, emitting one finding per open port with severity tiered by port risk (high: SSH/RDP/VNC/Telnet; medium: FTP/mail/SMB/databases; info: HTTP). OS detection (`-O`) is not enabled (no elevated container capabilities required).

### No recurring / scheduled scans
**Status:** Deferred to v1.1  
Scans must be triggered manually via the UI or the `POST /scans` API. There is no built-in cron scheduler or recurring scan configuration.

### Nuclei template updates require a Docker image rebuild
**Status:** ✅ Resolved in v1.0.x  
Nuclei templates now live in a Docker named volume (`nuclei_templates`) mounted at `/home/appuser/nuclei-templates` on both the API and worker containers. A `POST /admin/nuclei/update-templates` endpoint dispatches a Celery task that runs `nuclei -update-templates -ud <volume_path>`. The next scan automatically uses the updated templates — no container rebuild or redeploy required.

### Active exploit validation only runs on Nuclei findings
**Status:** By design, v1.0  
The `active_validation` flag (FR-SCN-13) fires Nuclei `-validate` probes. Trivy (SCA) and Gitleaks (secrets) findings are not actively probed — they rely on static analysis only.

### PR-time scanning requires a GitHub App installation
**Status:** Manual setup required  
FR-SCN-12 (PR scanning) depends on a GitHub App installed on the target organisation. Self-service installation is not yet available through the UI — it must be configured manually per the `runGuide.md`.

---

## 🤖 AI & Enrichment

### Requires Anthropic API key — no self-hosted LLM option
**Status:** Deferred to v1.3+  
All AI enrichment and the agentic chat (FR-AI-10) require an active `ANTHROPIC_API_KEY` pointed at the Anthropic Cloud API. Running a local or self-hosted model (e.g., Ollama, vLLM) is not supported in v1.

### AI enrichment is best-effort — not guaranteed per scan
**Status:** Known behaviour  
If the Anthropic API is rate-limited, slow, or returns an error, the Celery enrichment task logs the failure and stores `null` in `ai_plain_english`. The finding is still saved; only the plain-English summary and remediation plan are missing.

### Source-call reachability analysis (FR-AI-08) only works on cloned Git repos
**Status:** By design, v1.0  
AST-based reachability parsing requires the source repository to be cloned. Web-only scans (Nuclei against a URL) will always show `reachability: null`.

---

## 🔗 Integrations

### Jira Cloud only — no Jira Server / Data Center
**Status:** Deferred to v1.1  
The Jira adapter calls the Jira Cloud REST API v3. Jira Server (on-prem) and Jira Data Center use a different API surface and are not supported.

### Jira project key must exist before connecting
**Status:** Known setup requirement  
The `POST /admin/jira/test` endpoint validates your Jira credentials by querying the project key provided. The project must already exist in Jira — the platform does not create projects automatically.

### Slack webhook only — no Slack app installation
**Status:** By design, v1.0  
Slack notifications use an incoming webhook URL. Full Slack App installation (with OAuth, slash commands, or interactive messages) is not implemented.

### No inbound webhooks
**Status:** Deferred to v1.1  
The platform does not expose any inbound webhook receiver. There is no way to trigger a scan from an external CI/CD event (e.g., GitHub Actions push webhook) without calling the REST API directly.

### GitHub App Autofix (FR-OUT-04) requires write permissions on the target repository
**Status:** Known requirement  
The GitHub App must be granted "Contents: Read & Write" and "Pull Requests: Read & Write" permissions on the target org/repo. Repos without these permissions will fail the autofix PR step silently.

---

## 🔐 Authentication & Access

### No SSO (SAML / OIDC)
**Status:** Deferred to v1.2  
Users must log in with email + password credentials managed by the platform. SAML 2.0 and OIDC (e.g., Google Workspace, Okta, Azure AD) SSO is not supported.

### No self-serve Stripe checkout / billing
**Status:** Deferred to v1.1  
Tenant creation and billing are handled manually. There is no in-app subscription flow, free-trial management, or Stripe payment integration.

### Password reset is admin-only
**Status:** Known limitation, v1.0  
Users cannot self-serve reset their password. An admin must update the password hash directly via the API (`PATCH /admin/users/{id}`).

### API tokens are org-scoped only — no user-scoped tokens
**Status:** By design, v1.0  
API tokens generated in Settings apply to the entire organisation. Fine-grained per-user token scopes are not yet implemented.

---

## 🖥️ Infrastructure & Deployment

### Single-region deployment — no geographic HA
**Status:** Deferred to v1.3+  
The reference deployment is a single Hetzner CX31 VPS running Docker Compose. There is no multi-region, cross-availability-zone, or active-active failover configuration.

### No horizontal scan worker scaling via UI
**Status:** Operational task  
Adding more Celery workers requires running additional `docker compose up --scale worker=N` instances. There is no auto-scaling or worker management UI.

### MinIO is bundled — not S3-compatible cloud storage by default
**Status:** Can be swapped, v1.0  
PDF reports and cloned repos are stored in the bundled MinIO instance. To use AWS S3 or another S3-compatible service, update `MINIO_URL`, `MINIO_ROOT_USER`, and `MINIO_ROOT_PASSWORD` in `.env` and point them at your bucket endpoint.

### No audit log UI
**Status:** Deferred to v1.0.x  
Audit events (scan creation, user login, settings changes) are written to the `audit_logs` table but there is no UI to browse or export them yet.

---

## 📊 Reporting & UI

### Scan delta / diff comparison UI is deferred
**Status:** Deferred to v1.1  
Delta metadata (new/fixed/regressed findings between two scans) is computed and stored, but the side-by-side comparison UI is not implemented.

### Compliance report packs are templates only
**Status:** Partial, v1.0  
The Reports page includes SOC2/PCI/HIPAA checklist templates, but they are pre-populated with static evidence placeholder text. Dynamic evidence collection from scan findings is deferred to v1.2.

### MITRE ATT&CK and OWASP Top 10 heatmaps are deferred
**Status:** Deferred to v1.2  
Findings are not yet tagged with ATT&CK techniques or OWASP Top 10 categories. The mapping logic and heatmap visualisations are planned for v1.2.

---

## 🗺️ Roadmap Reference

| Limitation | Target Version |
|---|---|
| Cloud scanning (Prowler, Checkov) | v1.1 |
| Recurring / scheduled scans | v1.1 |
| Jira Server / Data Center | v1.1 |
| Self-serve billing (Stripe) | v1.1 |
| Scan delta comparison UI | v1.1 |
| Inbound webhooks (CI/CD triggers) | v1.1 |
| Audit log UI | v1.0.x |
| SSO (SAML / OIDC) | v1.2 |
| Compliance report packs (dynamic) | v1.2 |
| MITRE ATT&CK / OWASP heatmaps | v1.2 |
| Network / host scanning (Nmap) | ✅ v1.0.x |
| Self-hosted LLM option | v1.3+ |
| Geo-HA / multi-region | v1.3+ |

---

*Last updated: 2026-08-26 · Platform version: v1.0.x*
