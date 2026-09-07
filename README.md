# SigmaSec — AI-Augmented Security Posture Intelligence Platform

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-blue.svg)](LICENSE)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111.0-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15.0-black.svg?logo=next.js)](https://nextjs.org)
[![Anthropic Claude](https://img.shields.io/badge/AI-Claude%20Sonnet%204.5-8A2BE2.svg)](https://anthropic.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg?logo=docker)](https://docker.com)

**SigmaSec** is a unified, multi-tenant security posture and vulnerability intelligence platform designed for fast-moving engineering and security teams (20–500+ engineers). It eliminates scanner noise by integrating web, container, secret, SAST, and network scanners into a single prioritized intelligence pipeline.

Every vulnerability is enriched with real-world threat signals (**CISA KEV**, **FIRST EPSS**, **NVD CVSS**), validated for exploitability, AST-checked for code reachability, and synthesized by **Anthropic Claude** into plain-English explanations, 1-click Jira tickets, and automated GitHub remediation PRs.

---

## 🖼️ From Security Noise to Actionable Intelligence

![SigmaSec: From Security Noise to Actionable Intelligence](poster.png)

---

## ⚡ Quickstart (5 Minutes)

### Option A: One-Click Windows Launcher (Fastest)

```cmd
:: Start Docker infrastructure and start both backend + frontend servers
start.bat

:: When finished, safely stop all running background services
stop.bat
```

### Option B: Manual Setup

```bash
# 1 — Clone & enter repository
git clone https://github.com/cybersigmaINC/security-platform.git
cd security-platform

# 2 — Start core infrastructure (PostgreSQL 16, Redis 7, MinIO S3)
docker compose up -d

# 3 — Backend setup (FastAPI + Celery)
cd backend
cp .env.example .env
# Edit .env and configure ANTHROPIC_API_KEY & SECRET_KEY
uv venv && .venv\Scripts\activate          # (Linux/macOS: source .venv/bin/activate)
uv pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
# In a separate terminal: celery -A app.worker worker --loglevel=info

# 4 — Frontend setup (Next.js 15 App Router)
cd ../frontend/platform-ui
cp .env.local.example .env.local
npm install --legacy-peer-deps
npm run dev
# → Open http://localhost:3000
```

> 📖 **Full Walkthrough & Demo Guide:** See [runGuide.md](./runGuide.md) and [DEMO.md](./DEMO.md).  
> ⚠️ **Known Limitations:** See [v1-LIMITATIONS.md](./v1-LIMITATIONS.md).

---

## 📸 Screenshots & Visual Walkthrough

### 1. Unified Security Dashboard & Posture Telemetry
![SigmaSec Security Platform — Redesigned Dashboard](frontend/platform-ui/public/dashboard.jpeg)
*Real-time CISO & AppSec Executive Dashboard featuring a **0–100 Posture Score**, Noise-to-Signal Funnel breakdown, "Do this next" SLA-ranked remediation actions, 30-day vulnerability resolution curves, and live Threat Intelligence coverage (CISA KEV, EPSS, AST Reachability).*

---

### 2. Findings Catalog & Smart Views Navigation
![Findings Catalog — Smart Views & Tag Filtering](frontend/platform-ui/public/findings.png)
*Vulnerability triage workspace featuring DataGrid TanStack Table v8 pagination, pre-filtered Smart Views (`Jira Tickets`, `PRs Opened`, `False Positives`), multi-select tag filtering, keyboard shortcuts (`J`/`K`/`Esc`), and real-time scanning agent status.*

---

### 3. Live Scan Execution Terminal Streamer
![Live Scan Execution Terminal Streamer](frontend/platform-ui/public/screencapture-localhost-3000-scans-54985538-2462-4078-933b-a102a0f98738-2026-07-22-12_09_29.png)
*Embedded real-time terminal stdout/stderr log execution stream from Nuclei, Semgrep, Trivy, Gitleaks, and Nmap scanner containers with ANSI syntax colors, auto-scroll, log search, and `.log` download.*

---

### 4. Posture Score Mathematical Model & Rules
![Posture Score Formula & Rules](frontend/platform-ui/public/formula.jpeg)
*Comprehensive Posture Score reference card in Help & Onboarding detailing severity penalties (-10 Critical, -3 High, -1 Medium), asset exposure weight multipliers (1.0x to 2.0x), and remediation bonuses (+1 pt per fix in 7 days).*

---

### 5. Architectural Pipeline & Intelligence Flow
![Architectural Pipeline & Intelligence Flow](frontend/platform-ui/public/Unified_Security_Intelligence_Workflow.png)
*End-to-end multi-engine intelligence architecture illustrating discovery, active enrichment with CISA KEV / FIRST EPSS, AST-based reachability filtering, Claude Sonnet 4.5 AI reasoning, and automated Jira/GitHub remediation actions.*

---

| Resource | Details |
|---|---|
| 🎬 **5-Min Demo Script** | [DEMO.md](./DEMO.md) |
| 🚀 **Detailed Run Guide** | [runGuide.md](./runGuide.md) |
| 📋 **v1 Scope & Limitations** | [v1-LIMITATIONS.md](./v1-LIMITATIONS.md) |
| 🔐 **Security & Multi-Tenancy Hardening** | [SECURITY.md](./SECURITY.md) |
| ♿ **Accessibility & WCAG Coverage** | [frontend/ACCESSIBILITY.md](./frontend/ACCESSIBILITY.md) |
| 🗺️ **Backend Call Graph & Map** | [backend-map.html](./backend-map.html) |

---

## 📋 Table of Contents

1. [Why SigmaSec? (The Problem & The 1% Reality)](#-why-sigmasec)
2. [Unified Intelligence Pipeline](#-unified-intelligence-pipeline)
3. [Key Differentiators & Security Moats](#-key-differentiators--security-moats)
4. [Latest Platform Upgrades & Changelog](#-latest-platform-upgrades--changelog)
5. [Scanner & Tool Integrations](#-scanner--tool-integrations)
6. [Mathematical Posture Scoring Model](#-mathematical-posture-scoring-model)
7. [Technical Architecture & Tech Stack](#-technical-architecture--tech-stack)
8. [Setup, Build & Deployment](#-setup-build--deployment)
9. [Environment Variables Reference](#-environment-variables-reference)
10. [Testing & Quality Assurance](#-testing--quality-assurance)

---

## 💡 Why SigmaSec?

Engineering teams are drowning in security noise. Conventional scanners emit hundreds of raw CVEs per scan with little to no prioritization context. Static CVSS scores alone severely overstate risk—**only ~1% of all reported alerts represent critical, actively weaponized business risks.**

```
[Raw Tool Output: 800+ CVEs]
      │  (Disconnected Scanners, Manual Spreadsheets, Alert Fatigue)
      ▼
┌────────────────────────────────────────────────────────┐
│             SigmaSec Intelligence Pipeline             │
│  1. Ingest  ➔  2. Threat Intel  ➔  3. AST & Exploit    │
│  4. Claude AI Analysis  ➔  5. 1-Click Ticket & PR Fix  │
└────────────────────────────────────────────────────────┘
      │
      ▼
[Actionable Truth: Top 8 Real Risks Prioritized & Remediated]
```

---

## 🔄 Unified Intelligence Pipeline

The platform operates across 5 integrated stages:

1. **DISCOVER (Unified Multi-Engine Scanning):**
   Orchestrates **Nuclei** (DAST / web vuln), **Trivy** (container & SCA dependencies), **Gitleaks** (hardcoded secrets), **Opengrep** (SAST static code analysis), and **Nmap** (network port and service discovery) in parallel.
2. **ENRICH (Real-World Threat Intelligence):**
   Cross-references every finding with **CISA KEV** (Known Exploited Vulnerabilities catalog with due dates), **FIRST EPSS v3** (Exploitation Probability percentile), and **NVD CVSS v3.1** scores via Redis-cached O(1) lookups.
3. **PRIORITIZE (Composite Risk Engine & Active Validation):**
   - **AST Code Reachability:** Parses repository Abstract Syntax Trees to verify if vulnerable library functions are actually invoked in runtime paths.
   - **Active Exploit Validation:** Executes targeted active validation probes (`nuclei -validate`) to confirm real-world exploitability.
   - Computes dynamic priority scores weighted by asset criticality (Production vs Staging vs Internal).
4. **UNDERSTAND (Anthropic Claude AI):**
   Synthesizes complex vulnerability data into plain-English explanations, attack scenario walkthroughs, root cause diagnoses, and bespoke remediation plans.
5. **TAKE ACTION (Remediation Hub & Automated PRs):**
   - 1-click **Jira Cloud** ticket creation with pre-populated vulnerability context.
   - **GitHub Autofix Pull Requests:** Automatically generates code patches, removes exposed secrets, and updates dependency lockfiles.
   - Instant **Compliance Hub** auto-mapping to SOC 2, ISO 27001, PCI-DSS v4.0, and NIST SP 800-53 R5.

---

## ✨ Key Differentiators & Security Moats

* **PR-Time Pre-Merge Scanning (FR-SCN-12):** Scans pull request diffs as a GitHub App before merge, posting inline line annotations and blocking risky merges.
* **Exploit Validation (FR-SCN-13):** Actively confirms exploitability of critical vulnerabilities with live validation probes, boosting validated finding scores (+0.5).
* **AST Source-Call Reachability (FR-AI-08):** Evaluates whether vulnerable dependency methods are called by source code, adjusting priority score dynamically (0.7x unreachable vs 1.2x reachable).
* **ReAct Conversational Security Agent (FR-AI-10):** Interactive Claude agent equipped with database querying tools (`list_findings`, `get_finding`, `get_scan`, `get_asset`, `search_cves`) answering ad-hoc triage questions with live citation badges.
* **Automated Compliance Hub (FR-CMP-01):** Automatically maps findings across **SOC 2 Type II** (CC6.1, CC6.6, CC6.8, CC7.1), **PCI-DSS v4.0** (Req 6.3, 6.4, 8.3, 11.3), **ISO 27001:2022** (A.8.8, A.8.28, A.8.24), and **NIST SP 800-53 R5** controls with CISO audit-ready PDF/CSV exports.
* **Consolidated Fix PRs (FR-OUT-04):** Combines multiple CVE remediations into a single unified GitHub PR with code diff previews.
* **Live Scan Terminal Streamer:** Real-time stdout/stderr log stream viewer with ANSI color parsing, auto-scroll, text search, and raw log downloads.

---

## 🚀 Latest Platform Upgrades & Changelog

### 🌟 Recent Updates (Latest Release)
* **Opengrep SAST Static Code Analysis Integration**: Added native `OpengrepAdapter` (`backend/app/adapters/opengrep.py`) for static analysis AST scanning, ruleset customization, and code vulnerability detection.
* **Nmap Network Port & Service Scanner Integration**: Added native network scanning adapter (`backend/app/adapters/nmap.py`) enabling port discovery, service enumeration, and open network attack surface assessment.
* **Live Scan Execution Terminal Streamer**: Embedded real-time terminal output stream for running scanners with ANSI syntax colors, auto-scroll, log search, and `.log` download capabilities.
* **Automation Run Scripts (`start.bat` / `stop.bat`)**: Added one-click script orchestration to start and stop Docker containers, Celery workers, and the Next.js frontend seamlessly.
* **Session Expiry & Protected Route Redirects**: Added graceful authentication expiry guards with automatic login redirects and state preservation.
* **Hero Section & UI Polishing**: Redesigned modern landing page, dark/light theme tokens, badge QA sandbox (`/dev/badges`), and interactive help documentation.

### 🛡️ Month 3 Updates (Tag System, Performance & Security Hardening)
* **Finding Tag System & Autocomplete**: Added JSONB GIN-indexed tagging (`POST /findings/{id}/tags`, `GET /findings/tags`), dynamic `djb2` color hashing (8 palettes), and multi-select pill filtering.
* **Multi-Tenant Security Hardening**: Strict org-isolation enforcement returning HTTP 403 on cross-tenant probes, backed by `hypothesis` property tests (`tests/test_multitenancy.py`).
* **Database Performance Indexes**: Added composite PostgreSQL indexes `(org_id, scan_id)`, `(org_id, severity)`, `(cve_id)`, and `(priority_score DESC)` for high-throughput concurrency.
* **Accessibility (WCAG AA)**: Added `aria-label` coverage across all icon buttons and interactive controls (documented in [frontend/ACCESSIBILITY.md](./frontend/ACCESSIBILITY.md)).

### 🤖 Month 2 Updates (Remediation Hub, ReAct Agent, GitHub Autofix & JIRA)
* **Remediation Hub**: Centralized patch ledger with code diff viewer and **"Generate Consolidated Fix PR"** workflow.
* **ReAct Security Agent**: Floating drawer agent with tool-calling capabilities across findings, assets, scans, and CVE records.
* **Admin AI Usage & Cost Analytics**: Real-time token consumption and USD spend tracking at `/admin/ai-usage`.
* **Jira Cloud & Slack Integrations**: Symmetric Fernet token encryption at rest for Jira API credentials, 1-click bug generation, and automated Slack scan notifications.

### 🔍 Month 1 Updates (Threat Intel & Posture Engine)
* **Threat Intelligence Integrations**: Batch FIRST EPSS client (O(1) Redis caching), CISA KEV feeds with remediation due dates, and NVD CVSS enrichment.
* **Exploit Validation**: Active confirmation flag integration boosting confirmed vulnerabilities.
* **Rate Limiting & SSRF Protection**: `slowapi` rate limits (10 scans/hr/IP) and RFC1918 private IP blocking on target inputs.

---

## 🧰 Scanner & Tool Integrations

| Scanner / Engine | Category | Target Types | Output / Value |
|---|---|---|---|
| **Nuclei** | DAST / Web Vuln | URLs, Web Apps, APIs | Active web vulnerabilities, CVEs, misconfigurations, exploit validation |
| **Trivy** | Container / SCA | Container Images, Git Repos | Vulnerable dependencies, SBOM, OS package CVEs |
| **Gitleaks** | Secret Detection | Git Repositories | Leaked API keys, private tokens, passwords, private keys |
| **Opengrep** | SAST | Source Code (AST) | Static code flaws, unsafe functions, code reachability verification |
| **Nmap** | Network Discovery | IPs, Hostnames, CIDRs | Open ports, exposed services, network service vulnerabilities |
| **Anthropic Claude** | AI Reasoning | Enriched Findings | Plain-English explanations, attack narratives, remediation patches |

---

## 📊 Mathematical Posture Scoring Model

The overall Security Posture Score ($S \in [0, 100]$) provides executive visibility into organizational risk:

$$S = \max\left(0, \min\left(100, 100 - \sum_{i=1}^{N} \left(P_i \times W_{\text{asset}} \times E_i \times R_i\right) + B_{\text{remediation}}\right)\right)$$

Where:
* **Base Severity Penalty ($P_i$):** Critical = $-10$, High = $-3$, Medium = $-1$, Low/Info = $-0.1$.
* **Asset Criticality Multiplier ($W_{\text{asset}}$):** Critical/Production = $2.0\times$, High = $1.5\times$, Medium/Staging = $1.2\times$, Low/Dev = $1.0\times$.
* **Exploitation Factor ($E_i$):**
  * In CISA KEV: $1.5\times$
  * Confirmed Exploitable: $1.3\times$
  * EPSS $> 0.50$: $1.2\times$
* **Reachability Factor ($R_i$):** Reachable via AST = $1.2\times$, Unreachable = $0.7\times$.
* **Remediation Velocity Bonus ($B_{\text{remediation}}$):** $+1$ pt for every finding fixed within a 7-day SLA window (capped at $+15$).

---

## 🛠️ Technical Architecture & Tech Stack

```
                                  ┌────────────────────────┐
                                  │   Next.js 15 App UI    │
                                  │ (Tailwind + shadcn/ui) │
                                  └───────────┬────────────┘
                                              │ HTTP / SSE / Auth.js
                                              ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           FastAPI Gateway (Port 8000)                             │
│  - REST API Routing     - Multi-tenant RBAC Auth     - Audit Logging & Rate Limit │
└─────────────────────────────┬─────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
┌───────────────────────┐           ┌───────────────────────────────────────────────┐
│     PostgreSQL 16     │           │                    Redis 7                    │
│ - Relational Store    │           │ - Celery Task Broker                          │
│ - JSONB GIN Indexes   │           │ - EPSS / KEV Intel Cache (24h)                │
└───────────────────────┘           └───────────────────────┬───────────────────────┘
                                                            │
                                                            ▼
                                    ┌───────────────────────────────────────────────┐
                                    │             Celery Worker Cluster             │
                                    │  - Parallel Scan Tasks (Nuclei, Trivy, Nmap)  │
                                    │  - Threat Intel Enrichment (KEV/EPSS/NVD)     │
                                    │  - Claude Sonnet 4.5 AI Synthesis Engine      │
                                    └───────────────────────────────────────────────┘
```

| Layer | Technology | Key Capabilities |
|---|---|---|
| **Frontend** | Next.js 15, React 18, TypeScript | App Router, TanStack Table v8, Tailwind CSS, shadcn/ui, next-themes |
| **Backend API** | FastAPI, Python 3.12, Pydantic v2 | Async endpoints, SSE streaming, slowapi rate limiting, SQLAlchemy 2 |
| **Database** | PostgreSQL 16 | JSONB columns, GIN index `@>`, composite scan & severity indexes |
| **Queue & Cache** | Redis 7 + Celery 5 | Distributed chords/chains, batch EPSS caching, live terminal streaming |
| **Object Storage** | MinIO (S3 compatible) | Executive PDF reports, code clone storage, scan artifacts |
| **AI Synthesis** | Anthropic Claude (`claude-sonnet-4-5`) | Finding summaries, root cause, code patch PRs, conversational ReAct agent |
| **Authentication** | Auth.js v5 (NextAuth) | JWT session tokens, FastAPI credential bridge, role RBAC |

---

## 🚀 Setup, Build & Deployment

### Prerequisites
* **Python 3.12+** (via `uv` recommended)
* **Node.js 20+** & **npm 10+**
* **Docker Desktop** (or Docker Engine + Compose v2)
* **Git**

### Step-by-Step Installation

```bash
# 1. Start Docker Services
docker compose up -d

# 2. Setup & Run Backend
cd backend
cp .env.example .env
uv venv
.venv\Scripts\activate           # Linux/Mac: source .venv/bin/activate
uv pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 3. Start Celery Worker (In a separate terminal)
cd backend
.venv\Scripts\activate
celery -A app.worker worker --loglevel=info

# 4. Setup & Run Frontend
cd ../frontend/platform-ui
cp .env.local.example .env.local
npm install --legacy-peer-deps
npm run dev
```

### Production Build & Verification

```bash
# Frontend Typecheck, Lint & Build
cd frontend/platform-ui
npm run typecheck
npm run lint
npm run build

# Backend Linting & Test Suite
cd ../../backend
ruff check .
pytest tests/test_integration.py tests/test_multitenancy.py
```

---

## 🔐 Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Description | Default / Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection URI | `postgresql://admin:secret@localhost:5432/mydb` |
| `REDIS_URL` | Redis broker and cache URI | `redis://localhost:6379/0` |
| `MINIO_URL` | MinIO S3 object storage endpoint | `http://localhost:9000` |
| `MINIO_ROOT_USER` | MinIO access key | `minioadmin` |
| `MINIO_ROOT_PASSWORD` | MinIO secret key | `minioadmin` |
| `ANTHROPIC_API_KEY` | Anthropic Claude API Key | `sk-ant-api03-...` *(Required)* |
| `SECRET_KEY` | JWT signing secret key (min 32 chars) | `your-secure-random-secret-key` *(Required)* |
| `ENVIRONMENT` | Runtime environment | `development` \| `production` |

### Frontend (`frontend/platform-ui/.env.local`)

| Variable | Description | Default / Example |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Backend FastAPI base URL | `http://localhost:8000` |
| `NEXTAUTH_URL` | Public frontend URL | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | NextAuth JWT encryption secret | *(Generate: `openssl rand -base64 32`)* |

---

## 🧪 Testing & Quality Assurance

```bash
# Run backend integration tests and multitenancy property tests
cd backend
pytest -v

# Run frontend Vitest unit test suite
cd frontend/platform-ui
npm test
```

---

## 📄 License

Proprietary — All rights reserved. Built with precision for modern security engineering teams.

