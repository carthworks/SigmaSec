"use client";

import * as React from "react";
import { 
  Search, 
  HelpCircle, 
  Send, 
  BookOpen, 
  ArrowRight, 
  ShieldCheck, 
  LifeBuoy,
  ChevronDown,
  ChevronUp,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// FAQ data structure
interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: "scoring" | "scanning" | "workflow" | "general";
}

const FAQS: FAQ[] = [
  {
    id: "faq-1",
    category: "scoring",
    question: "How does the platform calculate an Asset's Risk Score?",
    answer: "The risk score is a value from 0 to 100 calculated dynamically based on three core variables: 1) Business Criticality (Low, Medium, High, Critical) which acts as a severity multiplier, 2) Exposure Type (Public/Internet-facing targets receive a 1.4x risk multiplier), and 3) Active Severity Findings. Critical findings add 30 points, High findings add 12 points, and Medium findings add 2 points. The total score is capped at 100."
  },
  {
    id: "faq-2",
    category: "scoring",
    question: "What is the formula and rules for the organization Posture Score (0-100)?",
    answer: "The Posture Score starts at a baseline of 100 and subtracts points for open vulnerabilities: -10 pts per Critical finding, -3 pts per High finding, and -1 pt per Medium finding, multiplied by the asset's criticality weight (1.0x to 2.0x for internet-facing targets). You earn +1 pt for every vulnerability fixed in the past 7 days (capped at +20 max). Resolved findings, False Positives, and Accepted Risks carry zero score penalty."
  },
  {
    id: "faq-3",
    category: "scanning",
    question: "What scanners are run during an automated target scan?",
    answer: "The scanning engine coordinates five parallel, integrated security scanners: Nuclei (for web application vulnerabilities and configuration pings), Trivy (for container image filesystem checks and software composition analysis/SCA), Gitleaks (for scanning repositories and detecting hardcoded secrets), OpenGroup (for static security analysis and SAST rules), and Nmap (for host port and service version discovery)."
  },
  {
    id: "faq-4",
    category: "workflow",
    question: "How does the Vulnerability Findings lifecycle work?",
    answer: "Each finding transitions through six audit states: 1) New (newly reported), 2) Investigating (triaged by analyst), 3) In Progress (remediation under dev execution), 4) Fixed (resolved and re-scanned), 5) Accepted Risk (documented business exception), and 6) False Positive (invalid scanner signal). Changing a status updates the audit history logs."
  },
  {
    id: "faq-5",
    category: "scoring",
    question: "What external threat intelligence models are used for enrichment?",
    answer: "Scans are enriched with three databases: NVD CVSS (National Vulnerability Database base severity metrics), CISA KEV (Known Exploited Vulnerabilities catalog for wild exploit indicators), and FIRST EPSS (Exploit Prediction Scoring System, indicating the probability of exploitation within the next 30 days)."
  },
  {
    id: "faq-6",
    category: "scoring",
    question: "What does the red 'EXPLOITED IN WILD' badge and CISA KEV Deadline represent?",
    answer: "The red 'EXPLOITED IN WILD' badge indicates that the CVE is part of CISA's Known Exploited Vulnerabilities catalog, confirming active exploitation in the wild. The accompanying 'CISA KEV Deadline' shows the official date by which the security community and federal agencies are required to patch the flaw."
  },
  {
    id: "faq-7",
    category: "scoring",
    question: "How is the EPSS Percentile Rank calculated and colored?",
    answer: "The EPSS Percentile Rank indicates the vulnerability's likelihood of active exploitation relative to all other tracked CVEs. It is visualized using a colored Progress bar: green (0–30% percentile rank, indicating low immediate exploitation threat), amber (30–70% percentile, medium threat), and red (70–100% percentile, high immediate threat requiring rapid patching)."
  },
  {
    id: "faq-8",
    category: "general",
    question: "Can I automatically patch vulnerabilities?",
    answer: "Yes, using our v1.0 AI-generated Fix PRs feature (FR-OUT-04). For secret findings (Gitleaks) or outdated library dependencies (Trivy SCA), the platform opens actual pull requests with the corrected code changes (such as bumping lockfile versions or masking credentials) directly in your connected repository."
  },
  {
    id: "faq-9",
    category: "scanning",
    question: "How does the Trivy Software Composition Analysis (SCA) scanner work?",
    answer: "The Trivy integration executes container image filesystem vulnerability checks in a background Celery task. In addition to flagging package CVEs, it extracts the target package's fixed version (if available) and saves it in the finding's metadata payload. When displayed in the findings catalog, it renders a visual 'Fix: x.y.z' badge next to the CVE, allowing developers to quickly identify updates."
  },
  {
    id: "faq-10",
    category: "scanning",
    question: "What is Active Exploit Validation (FR-SCN-13)?",
    answer: "Active Exploit Validation allows analysts to trigger active confirmation checks on web vulnerabilities. When launching a scan with this option enabled, the scanner engine invokes Nuclei's active '-validate' module. If Nuclei confirms that a vulnerability is actively exploitable, the finding's score receives an immediate priority boost."
  },
  {
    id: "faq-11",
    category: "scanning",
    question: "How does real-time scan progress tracking work?",
    answer: "When a scan is running, the page establishes a Server-Sent Events (SSE) connection using a Next.js proxy route to fetch live Redis progress milestones pushed by parallel Celery task workers. In case of network errors or proxy interruptions, the client automatically shuts down the EventSource listener and switches to fallback polling (fetching scan state coordinates every 5 seconds) to ensure continuous monitoring without UI disruption."
  },
  {
    id: "faq-12",
    category: "workflow",
    question: "How do I trigger the global Command Palette & Search Center (Cmd+K)?",
    answer: "Press Cmd+K (on macOS) or Ctrl+K (on Windows/Linux) anywhere in the application to launch the global Command Palette. You can also click the ⌘K Search button in the top navigation bar. It allows instant search and direct jump to any platform view (Dashboard, Findings, Assets, Scans, Remediation Hub, Reports, Settings) as well as quick actions like launching scans, filtering KEV exploits, or toggling dark mode."
  },
  {
    id: "faq-13",
    category: "workflow",
    question: "How does Vulnerability SLA & Aging Tracking work?",
    answer: "Vulnerability SLAs are automatically calculated based on severity: Critical = 7 days, High = 15 days, Medium = 30 days, Low = 60 days. Each finding displays a real-time SLA status badge ('SLA: 4d left', 'SLA: 18h left', or 'SLA Breached by 3d'). Overdue items trigger SLA breach alerts on the dashboard and executive views."
  },
  {
    id: "faq-14",
    category: "scanning",
    question: "What is the Live Scan Execution Terminal Streamer?",
    answer: "The Live Terminal Log Streamer on the Scan Details page (/scans/[id]) displays real-time stdout/stderr execution output from scanner containers (Nuclei, Semgrep, Trivy, Gitleaks, Zap, Nmap). It supports ANSI log highlighting, auto-scroll pause/resume, keyword searching, log copying, and `.log` file export."
  },
  {
    id: "faq-15",
    category: "workflow",
    question: "How do I customize DataGrid columns and save table views?",
    answer: "Click the 'Customize Columns' button on the top right of any DataGrid toolbar. You can toggle column visibility, which automatically persists your column preferences in your browser's localStorage for future sessions."
  },
  {
    id: "faq-16",
    category: "general",
    question: "How can I manage API Tokens, Organization coordinates, and Alert Notifications?",
    answer: "API tokens, organization access details, and notification thresholds are managed under the **Settings** tab. The section is organized via shadcn Tabs: 1) **API Tokens** lets admins generate and revoke secure keys (with copy-to-clipboard access) for automation pipelines, 2) **Org Info** shows read-only identity records and access role permissions, and 3) **Notifications** configures custom email triggers for scans and vulnerability updates."
  },
  {
    id: "faq-17",
    category: "workflow",
    question: "What does the green 'Confirmed' / 'CONFIRMED EXPLOITABLE' badge mean on findings?",
    answer: "The green 'Confirmed' badge sits next to the severity label on vulnerability cards. It indicates that the vulnerability's exploitability has been actively verified by the scanner engine (using custom outbound probes with `-validate` mode enabled). Findings that receive this active validation boost get their priority score increased by +0.5 to highlight actionable threats. Unvalidated findings receive a -0.2 penalty to reduce false confidence."
  },
  {
    id: "faq-18",
    category: "workflow",
    question: "How does the Security Reports template system work?",
    answer: "The Reports page compiles real-time findings into audit-ready documents using three templates: 1) Executive Summary (high-level posture trends, threat-model risk summaries, and Claude-generated text), 2) Technical Vulnerabilities Ledger (detailed tabular registry of CVSS/EPSS vectors and CISA KEV listings), and 3) Compliance Mapping (framework readiness grids for SOC 2, ISO 27001, and PCI-DSS). Reports can be downloaded directly as CSV or JSON spreadsheets, or saved as formatted PDFs by launching the browser's system print dialog (which uses custom stylesheet resets to display only the report layout at 100% width)."
  },
  {
    id: "faq-19",
    category: "general",
    question: "How does the Automated Compliance Control Mapping Engine work?",
    answer: "SigmaSec's Automated Compliance Control Mapping Engine automatically translates technical findings from Trivy (SCA), Gitleaks (Secrets), Nuclei (DAST), OpenGroup (SAST), and Nmap (Network) into four major regulatory control frameworks: **SOC 2 Type II** (CC6.1, CC6.6, CC6.8, CC7.1), **PCI-DSS v4.0** (Req 6.3, 6.4, 8.3, 11.3), **ISO 27001:2022** (A.8.8, A.8.28, A.8.24, A.5.15), and **NIST SP 800-53 R5** (SI-2, RA-5, SA-11, IA-5). The **Compliance Hub** calculates real-time framework readiness scores and generates CISO audit-ready reports for external auditors."
  },
  {
    id: "faq-21",
    category: "scanning",
    question: "How does the Nmap Network & Port Scanner work?",
    answer: "When scanning host or IP assets, the Nmap adapter executes `nmap -sV -sC --open` to detect open network ports, service names, software versions, and run safe default scripts. Open ports are automatically classified into risk severity tiers: High (SSH 22, Telnet 23, RDP 3389, VNC 5900, shell 4444), Medium (FTP 21, SMB 445/139, MySQL 3306, Postgres 5432, Redis 6379, MongoDB 27017), and Info/Low (HTTP/others)."
  },
  {
    id: "faq-20",
    category: "workflow",
    question: "How can I filter and view Jira tickets, active PRs, and False Positives?",
    answer: "The **Findings** page includes dedicated Smart Views for **Jira Tickets**, **PRs Opened**, and **False Positives**, pre-filtering findings with direct badges (`🎟️ SEC-102`, `🔀 PR Active`, `🚫 False Positive`). Additionally, the **Dashboard** features real-time KPI governance cards and a Remediation Pipeline Activity widget that link directly to these pre-filtered views."
  },
  {
    id: "faq-21",
    category: "general",
    question: "How do I toggle the Dimmed Slate theme?",
    answer: "Click the sun/moon theme icon in the top header bar to cycle between **Light Mode** (☀️), **Dimmed Slate Mode** (🌤️ mid-dark blue-gray for low eye strain), and **Dark Mode** (🌙 OLED pitch black). Your theme choice is persisted across browser sessions."
  },
  {
    id: "faq-22",
    category: "general",
    question: "What do the live status indicators in the top bar header represent?",
    answer: "The top bar header features three real-time telemetry indicators: 1) Active Scan/Queue Ticker (displays details of running tasks or shows pending jobs in an orange queue badge), 2) Scanner Agents status (monitors online health state of external scanners Trivy, Nuclei, and Gitleaks), and 3) Network Latency check (polls the /health endpoint every 15 seconds to display connection latency in milliseconds, shifting color from green to amber or showing red if the server is offline)."
  },
  {
    id: "faq-23",
    category: "workflow",
    question: "What is the ReAct Security Copilot Agent, and how do I ask questions?",
    answer: "The Security Agent is a reasoning-capable copilot available via the floating indigo question mark icon in the bottom-right of any individual Scan details page. When you ask a question, the agent executes multiple reasoning cycles and database tool calls (e.g., querying active scan findings, comparing CVEs, or loading asset parameters) to construct contextual responses. Citations returned by the agent are displayed as clickable badges linking directly to the respective vulnerability detail panels."
  },
  {
    id: "faq-24",
    category: "workflow",
    question: "What keyboard shortcuts are available for triaging findings?",
    answer: "You can navigate scan findings using keyboard shortcuts: press 'J' to move to the next finding, 'K' to move to the previous finding, and 'Esc' to close the active details panel. These shortcuts are automatically deactivated when you are focused on input fields or typing in the agent chat box."
  },
  {
    id: "faq-25",
    category: "workflow",
    question: "How do I configure Jira Ticket Integration?",
    answer: "You can link your Atlassian Jira Cloud workspace in the Settings page under the Jira tab. Provide your Jira URL, project key (e.g. SEC), user email, and API token. Once configured, you can click 'Create Jira Ticket' from any finding's drawer panel to auto-generate a ticket pre-populated with AI explanations, severity level, reachability analysis, and NVD/CISA metadata."
  },
  {
    id: "faq-26",
    category: "general",
    question: "How do Slack Scan Completion notifications work?",
    answer: "Under Settings -> Slack, you can configure an incoming Webhook URL and channel. When enabled, a Celery worker automatically compiles scan metrics (total findings, critical counts, KEV flags) and dispatches a summary card to your channel upon scan completion. You can also send test messages and view the 'Last Slack alert sent' timestamp directly on the settings page."
  },
  {
    id: "faq-27",
    category: "workflow",
    question: "How do I configure GitHub App Integration?",
    answer: "You can link your GitHub account or organization in the Settings page under the GitHub tab. You can click 'Install GitHub App / OAuth' to complete the automated authorization redirect flow (or use the simulated mock sandbox), or manually configure Installation IDs and Personal Access Tokens."
  },
  {
    id: "faq-28",
    category: "workflow",
    question: "How does the AI-generated Fix PR pipeline work?",
    answer: "For findings of auto-fixable types (Gitleaks secrets or Trivy SCA package versions), a 'Create Fix PR' button is shown in the detail drawer. When clicked, our backend clones the repository, checks out a new branch 'fix/{finding_id}', applies the mitigation, runs lockfile updates or checks patch size, pushes the branch, and opens a GitHub Pull Request, storing details directly on the finding."
  },
  {
    id: "faq-29",
    category: "workflow",
    question: "How do I add and remove custom tags on a finding?",
    answer: "Open any finding's detail drawer and scroll to the 'Finding Tags' section. Click the Combobox input (labelled 'Add tag') to see all existing org-wide tags as suggestions. Start typing to filter the list — if the tag doesn't exist yet, a 'Create …' option will appear at the top. Press Enter or click the + button to add it. To remove a tag, click the × icon inside the colored chip. Tags are stored as a JSONB array and synced across all views instantly."
  },
  {
    id: "faq-30",
    category: "workflow",
    question: "How does the multi-select tag filter on the Findings page work?",
    answer: "Above the findings table, the Tag filter row displays all tags used in your organization as colored pill buttons. Click one or more pills to toggle them — active pills are highlighted in their assigned color. The table updates in real time to show findings that contain at least one of your selected tags (OR logic). Click the 'All' pill or deselect all pills to show all findings regardless of tags."
  },
  {
    id: "faq-31",
    category: "general",
    question: "Why do my tags always appear in the same color?",
    answer: "Tag colors are determined by a deterministic hash of the tag text. This means the same tag name ('compliance', 'tech-debt', etc.) always maps to the same color across all findings, all drawers, and all sessions — no configuration required. There are 8 distinct muted color palettes (indigo, emerald, amber, rose, violet, cyan, orange, sky) that tags are distributed across."
  }
];


export default function HelpPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeFaq, setActiveFaq] = React.useState<string | null>(null);
  
  // Support Form State
  const [subject, setSubject] = React.useState("");
  const [category, setCategory] = React.useState("general");
  const [message, setMessage] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Filter FAQs based on query
  const filteredFaqs = FAQS.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      toast.warning("Validation Warning", { description: "Please enter a subject for the support request." });
      return;
    }
    if (!message.trim()) {
      toast.warning("Validation Warning", { description: "Please describe the assistance you need." });
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      toast.success("Support Ticket Submitted", {
        description: "Your ticket has been enqueued. An engineer will follow up shortly.",
      });
      setSubject("");
      setCategory("general");
      setMessage("");
      setIsSubmitting(false);
    }, 1200);
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto">
      
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Help & Onboarding</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Learn how to manage assets, interpret posture scores, and contact engineering support.
        </p>
      </div>

      {/* Application Workflow Visual Flow */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Core Platform Workflow
          </CardTitle>
          <CardDescription>
            Step-by-step lifecycle from adding assets to remediating vulnerabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-4 text-xs relative">
            
            {/* Step 1 */}
            <div className="space-y-2 relative">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">1</span>
                <span className="font-bold text-foreground">Configure Assets</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Add target web URLs, repositories, or container images in the **Assets** tab. Set ownership and environment details.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">2</span>
                <span className="font-bold text-foreground">Execute Scans</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Trigger parallel scanner engines (Nuclei, Trivy, Gitleaks) manually or automatically on PR commits via GitHub App integrations.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">3</span>
                <span className="font-bold text-foreground">Enrich Threat Intel</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Scanners query NVD, CISA KEV, and FIRST EPSS. The platform calculates a 0-100 asset **Risk Score** dynamically.
              </p>
            </div>

            {/* Step 4 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">4</span>
                <span className="font-bold text-foreground">Remediate & Audit</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Assign vulnerabilities, change statuses, track SLA aging deadlines, and open automated AI Fix PRs to patch findings.
              </p>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Posture Score Formula & Scoring Rules Card */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              Posture Score Formula &amp; Scoring Rules
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              0 - 100 Scale
            </span>
          </CardTitle>
          <CardDescription>
            Unified mathematical model used to compute overall security posture across your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-xs">
          {/* Formula Display Box */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/80 font-mono space-y-2">
            <div className="text-[11px] font-bold text-foreground uppercase tracking-wider">
              Mathematical Formula:
            </div>
            <div className="text-sm font-black text-primary p-2.5 rounded bg-background/80 border border-border/60 overflow-x-auto">
              Posture Score = Clamp[0, 100] ( 100 − Σ [ Vulnerability Deductions × Asset Weight ] + Remediation Bonus )
            </div>
          </div>

          {/* Deductions & Rules Grid */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="p-3.5 rounded-lg border border-border/60 bg-card space-y-1.5">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> Base Score (+100)
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Starting baseline score representing a completely clean, uncompromised infrastructure.
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-red-500/20 bg-red-500/5 space-y-1.5">
              <span className="font-bold text-red-500 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" /> Critical Penalty (-10 pts)
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Subtracted per open Critical severity finding (multiplied by asset exposure weight).
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-1.5">
              <span className="font-bold text-amber-500 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> High Penalty (-3 pts)
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Subtracted per open High severity finding (multiplied by asset exposure weight).
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-1.5">
              <span className="font-bold text-blue-500 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Medium Penalty (-1 pt)
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Subtracted per open Medium severity finding (multiplied by asset exposure weight).
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-purple-500/20 bg-purple-500/5 space-y-1.5">
              <span className="font-bold text-purple-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-purple-500" /> Asset Weight (1.0x - 2.0x)
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Internet-facing or high-criticality assets multiply finding deductions up to 2.0x.
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
              <span className="font-bold text-emerald-500 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Fix Bonus (+1 pt / fix)
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Awarded per vulnerability resolved in the last 7 days (capped at +20 points max).
              </p>
            </div>
          </div>

          {/* Scoring Rules List */}
          <div className="p-3.5 rounded-lg bg-muted/20 border border-border/50 space-y-2">
            <span className="font-bold text-foreground block text-[11px] uppercase tracking-wider">
              Scoring Rules &amp; Exemptions:
            </span>
            <ul className="list-disc list-inside text-[11px] text-muted-foreground space-y-1 font-mono">
              <li><strong className="text-foreground">Fixed &amp; Remediated:</strong> Resolved findings are exempt from deductions and contribute to the 7-day bonus.</li>
              <li><strong className="text-foreground">False Positives:</strong> Findings marked False Positive carry zero score penalty.</li>
              <li><strong className="text-foreground">Accepted Risks:</strong> Formally approved risk exceptions do not reduce your score.</li>
              <li><strong className="text-foreground">KEV Acceleration:</strong> CISA KEV-listed vulnerabilities trigger priority escalation and high penalty multipliers.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Main Help Grid (FAQs Left, Support Form Right) */}
      <div className="grid gap-6 md:grid-cols-3">
        
        {/* FAQs list */}
        <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm md:col-span-2">
          <CardHeader className="space-y-2 pb-3 border-b border-border/50">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center justify-between">
              <span>Frequently Asked Questions</span>
            </CardTitle>
            <CardDescription>
              Quick assistance on scanning, risk calculation, and integrations
            </CardDescription>
            {/* Search Bar */}
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search FAQ repository..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background/50 border-border/80 h-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border/40">
            {filteredFaqs.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-12">No matching topics found.</p>
            ) : (
              filteredFaqs.map((faq, idx) => {
                const isOpen = activeFaq === faq.id;
                return (
                  <div key={`${faq.id}-${idx}`} className="p-4 space-y-2 hover:bg-muted/10 transition-colors">
                    <button
                      onClick={() => setActiveFaq(isOpen ? null : faq.id)}
                      className="w-full flex items-center justify-between gap-3 text-left font-semibold text-foreground text-xs"
                    >
                      <span>{faq.question}</span>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    {isOpen && (
                      <p className="text-[11px] leading-relaxed text-muted-foreground bg-muted/30 rounded p-3 border border-border/20">
                        {faq.answer}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Contact Support Form */}
        <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm h-fit">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-primary animate-spin-slow" />
              Support Portal
            </CardTitle>
            <CardDescription>
              Submit a support ticket directly to our security engineers
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 px-4">
            <form onSubmit={handleSupportSubmit} className="space-y-4 text-xs">
              
              {/* Category */}
              <div className="space-y-1.5">
                <Label htmlFor="support-cat" className="font-semibold text-foreground/80">Issue Category</Label>
                <select
                  id="support-cat"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="general">General Question</option>
                  <option value="bug">Report a Bug</option>
                  <option value="feature">Request a Feature</option>
                  <option value="billing">Scans Quota & Billing</option>
                </select>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label htmlFor="subject" className="font-semibold text-foreground/80">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Issue connecting GitHub App"
                  disabled={isSubmitting}
                  className="bg-background/50 border-border/80 h-9"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="message" className="font-semibold text-foreground/80">Message Description</Label>
                <textarea
                  id="message"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Provide detailed information..."
                  disabled={isSubmitting}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Submit */}
              <Button type="submit" disabled={isSubmitting} className="w-full flex items-center gap-2 font-semibold">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" /> Submit Ticket
                  </>
                )}
              </Button>
              
            </form>
          </CardContent>
        </Card>

      </div>

    </div>
  );
}
