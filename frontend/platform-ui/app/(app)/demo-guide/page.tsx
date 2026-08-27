"use client";

import * as React from "react";
import Link from "next/link";
import {
  Play,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Shield,
  Sparkles,
  Layers,
  Terminal,
  ExternalLink,
  HelpCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  Award,
  Zap,
  Globe,
  Database,
  KeyRound,
  FileCheck2,
} from "lucide-react";
import { toast } from "sonner";

export default function DemoGuidePage() {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [checklist, setChecklist] = React.useState<Record<string, boolean>>({
    backend: true,
    frontend: true,
    login: true,
    prescan: false,
    darkmode: true,
    fullscreen: false,
  });

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copied to clipboard!", {
      description: text,
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleCheck = (key: string) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const checkedCount = Object.values(checklist).filter(Boolean).length;
  const totalChecks = Object.keys(checklist).length;

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto pb-16 text-foreground">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-card via-card/90 to-primary/10 p-6 md:p-8 shadow-xl">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/30">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              CONFIDENTIAL — INVESTOR DEMO RUNBOOK
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Award className="h-8 w-8 text-primary" />
              SigmaSec Live Demo Playbook
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Step-by-step live demonstration guide, copy-paste inputs, talking points, and investor objection handling for tonight's presentation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/scans"
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition shadow-lg shadow-primary/25 flex items-center gap-2"
            >
              <Play className="h-4 w-4 fill-current" />
              Jump to Scans
            </Link>
            <Link
              href="/executive"
              className="px-4 py-2.5 rounded-xl border border-border bg-card/80 text-foreground font-medium text-sm hover:bg-muted transition flex items-center gap-2"
            >
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Executive View
            </Link>
          </div>
        </div>
      </div>

      {/* Grid: Pre-flight Checklist & Pitch Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pre-Flight Checklist */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card/60 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <h2 className="text-base font-bold text-foreground">Pre-Demo Verification Checklist</h2>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {checkedCount} / {totalChecks} Ready
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {[
              { id: "backend", label: "Backend running (FastAPI + Celery + Redis)", tip: "docker compose up -d" },
              { id: "frontend", label: "Frontend active on localhost:3000", tip: "npm run dev" },
              { id: "login", label: "Logged into test admin account", tip: "Session active" },
              { id: "prescan", label: "1 Pre-warmed scan completed (Fallback data ready)", tip: "Go to Scans" },
              { id: "darkmode", label: "Dark mode active (Maximum contrast & polish)", tip: "TopBar Toggle" },
              { id: "fullscreen", label: "Browser full-screened (F11)", tip: "Zero tab clutter" },
            ].map((item) => (
              <div
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  checklist[item.id]
                    ? "bg-emerald-500/5 border-emerald-500/30 text-foreground"
                    : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <div
                  className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 transition ${
                    checklist[item.id]
                      ? "bg-emerald-500 border-emerald-500 text-slate-950"
                      : "border-muted-foreground/40 bg-transparent"
                  }`}
                >
                  {checklist[item.id] && <Check className="h-3 w-3 stroke-[3]" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{item.tip}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pitch Quick Numbers */}
        <div className="rounded-xl border border-border bg-card/60 p-6 space-y-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-1 border-b border-border/80 pb-3">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              30-Sec Value Hook
            </h2>
            <p className="text-xs text-muted-foreground">The killer ROI statement for investors.</p>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-xs italic text-slate-200 leading-relaxed">
            "Before SigmaSec, an AppSec team spent 3 days triaging 800 noisy CVEs in spreadsheets. We filter that down to the 14 vulnerabilities actively weaponized in the wild with AI-written code PRs — in 90 seconds."
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
              <div className="text-[10px] text-muted-foreground uppercase font-semibold">Triage Speed</div>
              <div className="text-lg font-bold text-emerald-400 font-mono">90s <span className="text-xs text-muted-foreground font-normal">vs 3 days</span></div>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
              <div className="text-[10px] text-muted-foreground uppercase font-semibold">AI Cost / Scan</div>
              <div className="text-lg font-bold text-blue-400 font-mono">&lt; $0.30</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Demo Targets — Copy/Paste Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              Copy-Ready Demo Targets
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click "Copy" on any target to instantly copy and paste into the New Scan modal.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Target 1: Web Vulnerability (DAST + Nmap) */}
          <div className="relative rounded-xl border border-rose-500/30 bg-card/80 p-5 space-y-3 shadow-md flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 uppercase tracking-wider flex items-center gap-1">
                  <Flame className="h-3 w-3" />
                  Primary Choice
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">DAST + Nmap</span>
              </div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Globe className="h-4 w-4 text-rose-400" />
                Live Web App (Real CVEs)
              </h3>
              <p className="text-xs text-muted-foreground">
                Triggers CVE-2023-4863 (libwebp heap overflow on CISA KEV), missing headers, and open network ports.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <code className="text-xs font-mono text-emerald-400 select-all truncate mr-2">
                  http://testphp.vulnweb.com
                </code>
                <button
                  onClick={() => copyToClipboard("http://testphp.vulnweb.com", "target1")}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition shrink-0 flex items-center gap-1"
                >
                  {copiedKey === "target1" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedKey === "target1" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Select Scanners:</span>
                <span className="font-semibold text-slate-200">Nuclei + Nmap</span>
              </div>
            </div>
          </div>

          {/* Target 2: Container / SCA */}
          <div className="rounded-xl border border-blue-500/30 bg-card/80 p-5 space-y-3 shadow-md flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  Container SCA
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">Trivy</span>
              </div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-400" />
                Vulnerable Docker Image
              </h3>
              <p className="text-xs text-muted-foreground">
                Scans public Docker container dependencies for OS packages and CVEs with EPSS risk percentiles.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <code className="text-xs font-mono text-blue-400 select-all truncate mr-2">
                  nginx:1.21.0
                </code>
                <button
                  onClick={() => copyToClipboard("nginx:1.21.0", "target2")}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition shrink-0 flex items-center gap-1"
                >
                  {copiedKey === "target2" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedKey === "target2" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Select Scanners:</span>
                <span className="font-semibold text-slate-200">Trivy (Container)</span>
              </div>
            </div>
          </div>

          {/* Target 3: Secrets Detection */}
          <div className="rounded-xl border border-amber-500/30 bg-card/80 p-5 space-y-3 shadow-md flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase tracking-wider flex items-center gap-1">
                  <KeyRound className="h-3 w-3" />
                  Secrets
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">Gitleaks</span>
              </div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-400" />
                Git Repo Leaked Secrets
              </h3>
              <p className="text-xs text-muted-foreground">
                Finds hardcoded API keys, JWT secrets, and AWS credentials in Git history with line citations.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <code className="text-xs font-mono text-amber-400 select-all truncate mr-2">
                  https://github.com/OWASP/WebGoat
                </code>
                <button
                  onClick={() => copyToClipboard("https://github.com/OWASP/WebGoat", "target3")}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition shrink-0 flex items-center gap-1"
                >
                  {copiedKey === "target3" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedKey === "target3" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Select Scanners:</span>
                <span className="font-semibold text-slate-200">Gitleaks</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 8-Minute Live Walkthrough Flow */}
      <div className="rounded-xl border border-border bg-card/60 p-6 space-y-6 shadow-sm">
        <div className="border-b border-border/80 pb-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            The 8-Minute Investor Demo Script
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Exact steps and talking tracks from opening to close.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            {
              step: "01",
              time: "0:00 - 1:00",
              title: "Launch Scan",
              action: "Go to Scans -> New Scan -> Paste testphp.vulnweb.com",
              say: "We ingest your URL or repo. Behind the scenes, Celery dispatches Nuclei, Trivy, Gitleaks, and Nmap simultaneously in parallel sandboxes.",
            },
            {
              step: "02",
              time: "1:00 - 2:30",
              title: "Real-Time Terminal",
              action: "Watch SSE terminal streaming logs",
              say: "Real-time streaming over Server-Sent Events. As each CVE is detected, our chord task immediately hits NVD, CISA KEV, and FIRST EPSS for live enrichment.",
            },
            {
              step: "03",
              time: "2:30 - 4:30",
              title: "Intelligent Triage",
              action: "Show Findings table -> filter KEV -> open finding drawer",
              say: "Notice the red 'EXPLOITED IN WILD' badge. Plain scanners give 800 items. We bubble up the 14 that have active zero-day exploits. Claude gives developer-friendly fix instructions.",
            },
            {
              step: "04",
              time: "4:30 - 6:30",
              title: "Compliance & Remediation",
              action: "Click Compliance Matrix -> Remediation Hub",
              say: "Technical findings are automatically linked to SOC 2 and PCI-DSS controls with audit readiness scores. Engineers can click 1-click 'Generate Fix PR' or push to Jira.",
            },
            {
              step: "05",
              time: "6:30 - 8:00",
              title: "Executive View & Close",
              action: "Navigate to Executive View dashboard",
              say: "This is the single screen the CISO shows their board on Monday. Posture score 0-100, weekly delta, and AI executive summary.",
            },
          ].map((s) => (
            <div key={s.step} className="rounded-lg border border-border bg-background/50 p-4 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                  <span className="font-bold text-primary">STEP {s.step}</span>
                  <span>{s.time}</span>
                </div>
                <h4 className="font-bold text-sm text-foreground mt-1">{s.title}</h4>
                <div className="mt-2 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                  <strong>Action:</strong> {s.action}
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic border-t border-border pt-2 leading-relaxed">
                "{s.say}"
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Investor Q&A Shield */}
      <div className="rounded-xl border border-border bg-card/60 p-6 space-y-4 shadow-sm">
        <div className="border-b border-border/80 pb-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-amber-400" />
            Investor Tough Questions & Winning Answers
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Defensive answers to common venture and angel queries.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {[
            {
              q: "How is this different from Snyk or Wiz?",
              a: "Snyk & Wiz dump hundreds of CVEs on engineers without exploitation context, leading to alert fatigue. We combine active exploit validation (confirming if it's reachable in code AST), live CISA KEV feeds, and AI auto-generated Pull Requests in a mid-market priced package ($200–$1,500/mo vs. Wiz's $30k+ enterprise contracts).",
            },
            {
              q: "Who is the ideal customer and who signs the cheque?",
              a: "Mid-market tech companies (20–300 engineers, Series A–C) undergoing their first SOC 2 or PCI-DSS audit. The CISO, VP of Engineering, or CTO pays because we give them immediate audit readiness evidence and reduce developer triage time by 80%.",
            },
            {
              q: "What keeps competitors from copying the AI summary?",
              a: "The moat is not raw LLM prompts. Our structural moats are: 1) Active exploit validation (running live probes), 2) Code AST reachability (checking if vulnerable functions are invoked), and 3) Deep integration with the GitHub App for inline PR-time blocking.",
            },
            {
              q: "What are your unit economics on AI tokens?",
              a: "We batch findings 5-at-a-time and employ prompt caching on repetitive scanner output. Average LLM cost is under $0.30 per scan, which is less than 5% of gross margins on our $200/mo starter subscription.",
            },
          ].map((item, idx) => (
            <div key={idx} className="p-4 rounded-lg border border-border bg-background/40 space-y-2">
              <h4 className="text-xs font-bold text-primary flex items-start gap-1.5">
                <span>Q:</span> {item.q}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed pl-4 border-l border-primary/30">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
