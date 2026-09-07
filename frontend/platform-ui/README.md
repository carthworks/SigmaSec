# 🛡️ Platform UI — Frontend Dashboard

This is the Next.js 16 frontend interface for the **AI-Augmented Security Posture Intelligence Platform**, providing a unified dashboard to manage target assets, launch vulnerability scans, audit findings, and view threat intelligence.

---

## 📸 Screenshots & Visual Walkthrough

### 1. Unified Security Dashboard & Posture Telemetry
![SigmaSec Security Platform — Redesigned Dashboard](/dashboard.jpeg)
*Real-time CISO Executive Dashboard featuring 0-100 Posture Score, Noise-to-Signal Funnel breakdown, "Do this next" SLA-ranked action items, and live Threat Intelligence coverage.*

### 2. Findings Catalog & Smart Views Navigation
![Findings Catalog — Smart Views & Tag Filtering](/findings.png)
*Vulnerability triage workspace featuring TanStack Table v8 pagination, pre-filtered Smart Views (`Jira Tickets`, `PRs Opened`, `False Positives`), multi-select tag filtering, and real-time scanning agent status.*

### 3. Live Scan Execution Terminal Streamer
![Live Terminal Streamer — Scanner Logs](/screencapture-localhost-3000-scans-54985538-2462-4078-933b-a102a0f98738-2026-07-22-12_09_29.png)
*Embedded real-time terminal stdout/stderr execution stream from Nuclei, Trivy, Gitleaks, Opengrep, and Nmap containers with ANSI syntax highlighting, auto-scroll, and log export.*


### 4. Posture Score Mathematical Model & Rules
![Posture Score Formula & Rules](/formula.jpeg)
*Comprehensive Posture Score reference card in Help & Onboarding detailing severity penalties, asset exposure weight multipliers, and remediation bonuses.*

---

## ✨ Key Platform UI Features & Enhancements

- **⌘K Command Palette & Search Center**: Trigger global search with `Cmd+K` / `Ctrl+K` for instant page jumps, tool shortcuts, and theme toggling.
- **TanStack Table v8 DataGrid & Pagination**: Reusable DataGrid component with customizable page sizes, entry range indicators, and column visibility toggle with `localStorage` persistence.
- **Live Terminal Log Streamer**: Real-time stdout/stderr log stream viewer with ANSI color highlighting, keyword search, auto-scroll pause/resume, and `.log` file export download.
- **Vulnerability SLA & Aging Tracking**: Automated SLA calculation (Critical 7d, High 15d, Medium 30d, Low 60d) with real-time status badges (`SLA: 2d left`, `SLA Breached by 3d`).
- **Remediation Task Assignment Modal**: Interactive dialog to assign risk items directly to team owners (`SecOps Lead`, `DevOps Team`, `AppSec Engineer`).

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have **Node.js 20 LTS** or later installed.

### 2. Installation
Navigate to this directory and install the packages:
```bash
npm install
```

### 3. Environment Variables
Create a `.env.local` file in this folder to configure the target backend API Gateway address:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### 4. Running the Development Server
Start the Next.js local development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. The root path (`/`) automatically redirects sessions to `/dashboard`.

---

## 📂 Project Structure

```bash
platform-ui/
├── app/                  # Next.js App Router Structure
│   ├── (auth)/           # Authentication Routes (Full Screen)
│   │   ├── login/        # Custom Glassmorphic Login Page
│   │   └── layout.tsx    # Auth layout structure (no dashboard shell)
│   ├── (app)/            # Application Workspace Shell Routes
│   │   ├── dashboard/    # Main Security Posture Stats Overview
│   │   ├── assets/       # Security Posture Management Center (Upgraded)
│   │   ├── findings/     # Unified Vulnerabilities Catalog
│   │   ├── scans/        # Scans Execution Lists
│   │   ├── scans/[id]/   # Detailed findings per scan (Async Params)
│   │   ├── reports/      # PDF Export and Templates Dashboard (New)
│   │   ├── integrations/ # Jira / Slack Integration Panel (New)
│   │   ├── settings/     # Global configurations
│   │   └── layout.tsx    # Persistent layout: Sidebar navigation & TopBar
│   ├── globals.css       # Tailwind v4 theme, OKLCH styles, & base layers
│   └── layout.tsx        # Global HTML Document configuration (Inter font)
├── components/           # Custom Reusable UI Components
│   ├── ui/               # shadcn UI components (Card, Button, Dialog, etc.)
│   ├── login-form.tsx    # Zod-validated Login Component with Sonner popups
│   ├── mode-toggle.tsx   # Light / Dark mode switcher button
│   └── theme-provider.tsx# next-themes wrap provider
├── lib/                  
│   └── utils.ts          # Class merging cn() utility (clsx + tailwind-merge)
└── package.json          
```

---

## ✨ Features Implemented

1.  **Security Posture Management (Assets Module):**
    *   **Add Asset Dialog:** Configures target assets with metadata details.
    *   **Custom Risk Scoring Model:** Automatically computes a posture risk score (0-100) based on target exposure, asset criticality, and active findings.
    *   **Vulnerability Severity Badges:** Displays findings count segmented by criticality using color-coded badges (🔴 Critical, 🟠 High, 🟡 Medium, 🔵 Low).
    *   **Vulnerabilities Audit Drawer:** Click any asset to review individual findings, update lifecycle status, assign engineers, and write comments.
2.  **Scan Execution Center & Live Tracking:**
    *   **Launch Scan Dialog:** Select from 5 parallel security scanner modules (Trivy SCA, Gitleaks Secrets, Nuclei Web Vuln, Opengrep SAST, Nmap Network), set targets (Git repos, URLs, containers, host IPs), and configure dedicated scan inputs.

    *   **Active Exploit Validation (FR-SCN-13):** Toggle Active Exploit confirmation using Nuclei's `-validate` engine.
    *   **Live SSE Progress Tracking:** Opens a Server-Sent Events (`EventSource`) stream from a Next.js Auth API proxy which tracks parallel Celery task executions (Trivy + Nuclei), rendering a custom progress bar (0–100%) and current execution step.
    *   **Polling Fallback:** Automatically switches to poll the backend every 5 seconds using TanStack Query if the EventSource fails.
    *   **Findings Table:** Displays CVE code list with default severity descending sorting, real-time severity level filter buttons, and custom **Fix: x.y.z** badges for Trivy dependencies.
3.  **Automated Compliance Control Mapping Engine (New Module):**
    *   **Regulatory Control Mapping:** Automatically maps Trivy (SCA), Gitleaks (Secrets), Nuclei (DAST), Opengrep (SAST), and Nmap (Network) findings to **SOC 2 Type II** (CC6.1, CC6.6, CC6.8, CC7.1), **PCI-DSS v4.0** (Req 6.3, 6.4, 8.3, 11.3), **ISO 27001:2022** (A.8.8, A.8.28, A.8.24, A.5.15), and **NIST SP 800-53 R5** (SI-2, RA-5, SA-11, IA-5) controls.
    *   **Compliance Hub Dashboard:** Real-time framework readiness scorecards, interactive control status breakdown matrices, and one-click CISO audit PDF report exports.
4.  **Security Reports Suite (New Module):**

    *   **Interactive Report Configuration Builder**: Tailor reports by template (Executive Posture Summary, Technical Vulnerability Ledger, and SOC2/ISO27001 Compliance checklist), scopes (target assets), and threat intelligence filters (CISA KEV, Active Exploits).
    *   **Live Document Compilation**: Real-time document card rendering showing exactly how the exported document compiles as the analyst selects and customizes scope filters.
    *   **Export Actions Flow**: Download raw files (JSON/CSV) directly or save complete reports to PDF. Custom CSS print stylesheets restructure the HTML layout to span 100% of the print width and reset window frame limits to ensure zero vertical clipping.
    *   **Recent Exports Ledger**: Stores history lists in browser local storage and supports immediate dynamic file regeneration downloads or PDF print triggering.
4.  **UI & UX Polish & Telemetry:**
    *   **TopBar Live Status Indicators**: Displays real-time operational telemetry (network ping latency, online scanning engines status, and background Celery queue tickers) in the header.
    *   **Loading Skeletons:** Premium pulsing skeleton components placeholder indicators show table frames while scans list or findings data loads.
    *   **Empty State CTA:** Displays illustration and clear call-to-action button when no scans are present to quickly prompt target launch.
    *   **Sonner Error Toasts:** Listens to query failures and alerts the user with descriptive toast warnings for API `4xx` or `5xx` errors.
5.  **Security Compliance & Billing Tiers (New Settings Panel):**
    *   **DPDP Act 2023 Compliance Mode:** Configures local user data residency limits, dynamic cookie consent prompts, and 90-day automatic log retention policy.
    *   **SOC 2 Audit Trail Logging:** Cryptographic, tamper-evident logging for administrative operations, team additions, role changes, and API key overrides.
    *   **Subscription Tier Selection:** Interactive management of **Free** (10 scans/mo), **Starter** ($29/mo), **Pro** ($199/mo), and **Enterprise** (Unlimited scans & SLA) billing plans.
6.  **Remediation Pipeline Governance & Smart Views:**
    *   **Smart Filter Views:** Pre-filtered findings views for **Jira Tickets**, **PRs Opened**, and **False Positives** with direct table row badges (`🎟️ SEC-102`, `🔀 PR Active`, `🚫 False Positive`).
    *   **Dashboard Remediation Pipeline Activity:** Live KPI metric cards for Jira, PR, and False Positive counts, paired with a real-time Remediation Activity table.
    *   **Fullscreen Remediation Hub Workspace:** Upgraded `SheetContent` workspace drawer to 100% full-screen layout (`w-screen max-w-none`) with non-overlapping header layout for seamless patch consolidation and code diff inspection.
7.  **Dimmed Slate Theme & Performance Polish:**
    *   **3-State Theme Switcher:** Supports cycling between **Light Mode** (☀️), **Dimmed Slate Mode** (🌤️ indigo-slate mid-dark for reduced eye strain), and **Dark Mode** (🌙 OLED pitch black).
    *   **Instant Navigation Prefetching:** Sidebar links feature `onMouseEnter` prefetching and explicit `prefetch={true}` for sub-30ms page transitions.

---

## 🔑 Mock Credentials (Local Testing)

Since the database connection state is isolated, you can test success and error flows on the login page:

1.  **Test Error Popup (Fields empty / invalid):** Submit the form empty or type an invalid email address. A toast warning pops up.
2.  **Test Mock System Error:** Enter **`error@platform.com`** as the email. A destructive error toast pops up indicating that the account is locked.
3.  **Test Invalid Credentials:** Enter any email and password other than `password123`. A credentials validation error pops up.
4.  **Test Success Flow:** Enter any email address and **`password123`** as the password. A success toast pops up and redirects you to the dashboard workspace.
