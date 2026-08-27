# Client Demo Preparation — Month 2 Milestone

> Platform: SigmaSec Security Intelligence Platform  
> Demo duration: 5 minutes (see [DEMO.md](file:///c:/Users/tkart/Dev/products/security%20Platform/security-platform/DEMO.md))  
> Status: Month 1 + Month 2 features complete

---

## 🔢 Step 1 — Clean Compilation

Run these in order. Each must pass before the next.

### Backend (Docker)
```powershell
cd security-platform

# Pull latest code
git pull origin main

# Rebuild containers (picks up any Dockerfile changes)
docker compose build --no-cache

# Start all 6 services
docker compose up -d

# Verify all 6 are healthy
docker compose ps
```

Expected — all containers show `Up` or `healthy`:
`postgres` · `redis` · `minio` · `backend` · `worker` · `flower`

```powershell
# Must return: {"status":"ok","version":"0.1.0","db_ok":true}
curl http://localhost:8000/health
```

### Database Migrations
```powershell
cd backend
.venv\Scripts\activate
alembic upgrade head
python app/seed.py
```

Expected seed output:
```
Seeded successfully:
  Org    : SigmaSec (slug=SS)
  Admin  : admin@sigmasec.com / Admin@12345!
  Analyst: analyst@sigmasec.com / Analyst@12345!
```

### Frontend
```powershell
cd frontend/platform-ui
npm install --legacy-peer-deps
npm run build       # catch type errors before the demo
npm run dev         # switch back to dev server for live demo
```

> If `npm run build` errors: run `npm run lint` first, fix, then rebuild.

---

## 🌱 Step 2 — Seed Demo Data

The demo needs a **pre-completed scan** so you don't wait live.

### Run against testphp.vulnweb.com (legal, intentionally vulnerable)

Via Swagger at `http://localhost:8000/docs` → POST /scans:
```json
{
  "target": "http://testphp.vulnweb.com",
  "scan_types": ["vuln"],
  "active_validation": false
}
```

Monitor completion at `http://localhost:5555` (Flower). Takes ~2–5 min.

### Verify findings exist
```powershell
# Must return non-empty array
curl -H "Authorization: Bearer <token>" http://localhost:8000/findings
```

> A completed scan PDF already exists in the repo at  
> `frontend/platform-ui/scan-report-testphp-vulnweb-com-2026-07-17-07-51.pdf`  
> confirming this target was scanned successfully before.

---

## 🔧 Step 3 — Configure Integrations

Set these in **Settings → Integrations** before the demo:

### Jira ✅ Required for demo

| Field | Value |
|---|---|
| Base URL | `https://sigmasec-intel.atlassian.net` |
| Project Key | `SEC` |
| Email | Your Atlassian email |
| API Token | From https://id.atlassian.com/manage-profile/security |

> [!IMPORTANT]
> The project key `SEC` must exist in Jira **before** connecting. If not: go to https://sigmasec-intel.atlassian.net/jira/projects and create a Software project with key `SEC`.

Click **Test Connection** → must show a green ✓ badge.

### Slack (optional but impressive)
Add a Slack incoming webhook URL → test → it fires on scan completion.

---

## ✅ Step 4 — Smoke Test Every Feature

Run through this checklist **the night before**:

### Authentication & Layout
- [ ] Login as `admin@sigmasec.com` / `Admin@12345!` → Dashboard
- [ ] Topbar shows: latency ms, "Agents: 3/3 Connected", correct user name
- [ ] Dark mode toggle works in both directions
- [ ] Logout → redirected to login page

### Dashboard
- [ ] KPI cards show real numbers (requires completed scan in DB)
- [ ] Posture score ring displays a value
- [ ] Week-over-week trend chart renders

### Scans
- [ ] Scans table lists at least 1 `complete` scan
- [ ] "Launch Scan" dialog opens, validates all fields
- [ ] Click scan row → navigates to `/scans/{id}` detail
- [ ] Scan detail: findings list renders, SSE progress bar works on active scan

### Findings (most of the demo lives here)
- [ ] Global Findings page: table loads with ≥10 findings
- [ ] KEV-only filter: table narrows to CISA-listed CVEs only
- [ ] High EPSS filter: table narrows to ≥70% EPSS findings
- [ ] Click a finding row → right-side sheet drawer opens
- [ ] **Summary tab**: Claude AI explanation renders (not blank/placeholder)
- [ ] **Remediation tab**: Numbered step-by-step plan renders
- [ ] **Reachability tab**: Shows reachability analysis (if git scan was run)
- [ ] EPSS percentile progress bar: correct color (green < 30%, amber 30–70%, red > 70%)
- [ ] "EXPLOITED IN WILD" KEV badge appears on KEV-listed findings
- [ ] Tag combobox: can add/remove tags; colored chip renders
- [ ] Keyboard nav: J/K moves between findings, Esc closes sheet

### Jira Ticket (money moment)
- [ ] Open a Critical finding sheet
- [ ] Click **"Create Jira Ticket"** button
- [ ] Green `SEC-XX` badge appears in the drawer
- [ ] Clicking badge opens the Jira issue in a new tab
- [ ] Jira issue has CVE, severity, EPSS, and Claude remediation in description

### Reports
- [ ] Navigate to `/reports`
- [ ] Select **Executive Summary** template
- [ ] Click **Download PDF** → PDF opens/downloads
- [ ] PDF contains: org name, posture score, findings table, AI paragraph

### Settings
- [ ] **API Tokens tab**: generate a token, copy it, revoke it
- [ ] **Org Info tab**: user email and org name display correctly
- [ ] **Integrations tab**: Jira shows "Connected" green badge
- [ ] **Notifications tab**: preference toggles save without error

### Admin AI Usage (if showing)
- [ ] Navigate to `/admin/ai-usage`
- [ ] Bar chart shows daily token usage split by `enrich` vs `agent`
- [ ] Cumulative cost curve renders
- [ ] Total USD cost displayed

---

## 🧊 Step 5 — Freeze the Demo Environment

**Night before the demo:**

1. **Stop all background scans** — no live changes to data during the demo
2. **Note the scan ID** of your best pre-completed scan for direct navigation
3. **Pre-open tabs in this order:**
   - Tab 1: `http://localhost:3000` (logged out, fresh login)
   - Tab 2: `http://localhost:3000/scans` (scans list)
   - Tab 3: `https://sigmasec-intel.atlassian.net/jira/projects/SEC` (Jira)
   - Tab 4: `DEMO.md` for your speaker notes
4. **Browser setup:**
   - Dark mode ON (looks sharper on screen share)
   - Zoom to 90% (fits more content)
   - All OS/browser notifications disabled
   - Browser history cleared (no embarrassing autocomplete)
5. **Test the full 5-min flow once** end-to-end against the real data

---

## 🚨 Known Issues & Workarounds

| Issue | Workaround |
|---|---|
| Jira error: "No project found with key SEC" | Pre-create the `SEC` project in Jira (Software type) |
| AI summary/remediation is blank | Check `ANTHROPIC_API_KEY` in `backend/.env` is valid; re-run enrichment via API |
| Topbar shows "Gateway Offline" | `docker compose up -d` — backend container stopped |
| Live scan takes too long during demo | Always use the pre-seeded completed scan — never launch live during demo |
| PDF downloads blank | MinIO container must be running — `docker compose ps` |
| Tags combobox shows no suggestions | Add 2–3 tags to a few findings manually before demo |
| `db_ok: false` on health check | `docker compose restart postgres`, wait 10s, retry |

---

## 📦 Month 2 Feature Inventory

Confirm each demo touchpoint before the client session:

| Feature | Where | Demo step |
|---|---|---|
| Jira one-click ticket | Finding detail sheet | Min 3:30 |
| Slack completion alert | Auto-fires on scan complete | Can show in Settings |
| ReAct Agent chat | Floating `?` on scan detail | Optional bonus |
| Claude AI explanation | Finding → Summary tab | Min 2:30 |
| Claude remediation plan | Finding → Remediation tab | Min 2:30 |
| Source-call reachability | Finding → Reachability tab | Min 2:30 |
| EPSS percentile bar | Finding detail | Min 2:30 |
| KEV "Exploited in Wild" | Findings table | Min 1:30 |
| Tag system + combobox | Findings table | Min 1:30 |
| PDF / CSV export | /reports | Min 4:15 |
| Admin AI cost analytics | /admin/ai-usage | Optional bonus |
| Remediation Hub | /remediation-hub | Optional bonus |
| GitHub Autofix PR | Settings → GitHub | Optional bonus |

---

## 🗣️ 5 Talking Points for the Client

1. **"Not a scanner dump"** — CVSS alone is noise. We compute Priority Score = CVSS × KEV signal × EPSS × asset criticality. You fix the right thing first.

2. **"AI that writes the fix, not just names the CVE"** — Claude generates a step-by-step remediation plan specific to the finding. Not a copy from NVD.

3. **"One click to Jira"** — finding becomes a backlog ticket in seconds, pre-filled with CVE, EPSS, and the Claude fix plan. Zero copy-pasting.

4. **"Multi-tenant RBAC from day one"** — strict org isolation, Admin/Analyst/Viewer roles. Onboard your developers today with read-only access.

5. **"For devs and CISOs"** — keyboard shortcuts (J/K/Esc), tag system, AI chat. Plus a PDF-ready executive summary for the board.

---

## ⚡ Day-of Quick Startup Checklist

```
[ ] Docker Desktop is open and running
[ ] docker compose up -d  →  all 6 containers healthy
[ ] http://localhost:8000/health  →  db_ok: true
[ ] npm run dev running in frontend/platform-ui
[ ] http://localhost:3000  →  login page renders
[ ] Login as admin@sigmasec.com  →  dashboard KPIs show real data
[ ] Jira integration: "Connected" green badge visible in Settings
[ ] Pre-completed scan with ≥10 findings exists in DB
[ ] Browser: dark mode ✓  zoom 90% ✓  notifications off ✓
[ ] DEMO.md open in a second window as speaker reference
```
