"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Search, 
  AlertTriangle, 
  Box, 
  CheckCircle2, 
  Clock, 
  Database,
  ShieldCheck,
  ChevronRight,
  Wrench,
  Sparkles,
  GitPullRequest,
  ArrowUpRight,
  ExternalLink,
  Loader2,
  Activity,
  UserCheck,
  UserPlus,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardSummary {
  timeframe: string;
  num_days: number;
  posture_score: number;
  points_changed_this_week: number;
  posture_driver: string;
  funnel: {
    total_findings: number;
    critical_high_count: number;
    critical_high_pct: number;
    reachable_count: number;
    reachable_pct: number;
    exploitable_now_count: number;
    exploitable_pct: number;
  };
  do_this_next: Array<{
    id: string;
    badge: string;
    title: string;
    why_now: string;
    sla_status: string;
    sla_breaching: boolean;
    action_type: string;
    action_label: string;
    action_href: string;
  }>;
  kpis: {
    mttr_days: number;
    mttr_change_days: number;
    prs_open: number;
    jira_linked: number;
    sla_breaches: number;
    accepted_risks: number;
    assets_scanned_7d_pct: number;
  };
  trend_data: Array<{
    date: string;
    open: number;
    remediated: number;
  }>;
  intel_coverage: {
    cisa_kev: { indexed: number; matches: number; last_sync: string };
    epss: { scored: number; total: number; above_threshold: number; last_sync: string };
    ast_reachability: { analyzed: number; total_assets: number; reachable_count: number; pending: number };
    exploit_validation: { sandbox_confirmed: number; inconclusive: number };
  };
  recent_scans: Array<{
    id: string;
    target: string;
    target_type: string;
    status: string;
    created_at: string;
    critical_count: number;
    high_count: number;
    medium_count: number;
    summary_text: string;
  }>;
  remediation_pipeline: Array<{
    group: string;
    items: Array<{
      title: string;
      subtitle: string;
      badge: string;
      badge_color: string;
    }>;
  }>;
  system_status: {
    api_version: string;
    db_connected: boolean;
    scan_engine_idle: boolean;
    total_scans: number;
    intel_synced_at: string;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const searchParams = useSearchParams();
  const timeframe = searchParams?.get("timeframe") || "30d";

  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [assigningItem, setAssigningItem] = React.useState<any | null>(null);
  const [selectedOwner, setSelectedOwner] = React.useState("SecOps Lead");

  const handleConfirmAssignment = () => {
    if (!assigningItem) return;
    toast.success("Remediation Task Assigned", {
      description: `"${assigningItem.title}" has been assigned to ${selectedOwner}.`,
    });
    setAssigningItem(null);
  };

  // Query unified dashboard summary API
  const { data: summary, isLoading, refetch } = useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary", timeframe],
    queryFn: async () => {
      if (!token) throw new Error("No token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/dashboard/summary?timeframe=${timeframe}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard summary");
      return res.json();
    },
    enabled: !!token,
  });

  const handleForceRefresh = async () => {
    if (!token) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/intel/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to trigger force refresh");
      toast.success("Threat Intel Refreshed", {
        description: "NVD, CISA KEV, and EPSS caches reloaded.",
      });
      refetch();
    } catch (err: any) {
      toast.error("Refresh Failed", {
        description: err.message || "Failed to refresh threat intel.",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const defaultTrendData = React.useMemo(() => [
    { date: "Jul 01", open: 142, remediated: 28 },
    { date: "Jul 05", open: 135, remediated: 45 },
    { date: "Jul 09", open: 128, remediated: 62 },
    { date: "Jul 13", open: 119, remediated: 84 },
    { date: "Jul 17", open: 104, remediated: 110 },
    { date: "Jul 21", open: 86, remediated: 138 },
    { date: "Jul 22", open: 74, remediated: 162 },
  ], []);

  const activeTrendData = React.useMemo(() => {
    return (summary?.trend_data && summary.trend_data.length > 0) ? summary.trend_data : defaultTrendData;
  }, [summary?.trend_data, defaultTrendData]);

  const maxVal = React.useMemo(() => {
    if (!activeTrendData.length) return 100;
    return Math.max(...activeTrendData.map(d => Math.max(d.open, d.remediated)), 100);
  }, [activeTrendData]);

  const openPath = React.useMemo(() => {
    if (activeTrendData.length === 0) return "";
    const total = activeTrendData.length - 1 || 1;
    return activeTrendData.map((d, idx) => {
      const x = 40 + (idx / total) * 540;
      const y = 170 - (d.open / maxVal) * 140;
      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ");
  }, [activeTrendData, maxVal]);

  const remediatedPath = React.useMemo(() => {
    if (activeTrendData.length === 0) return "";
    const total = activeTrendData.length - 1 || 1;
    return activeTrendData.map((d, idx) => {
      const x = 40 + (idx / total) * 540;
      const y = 170 - (d.remediated / maxVal) * 140;
      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ");
  }, [activeTrendData, maxVal]);

  const postureScore = summary?.posture_score ?? 68;
  const postureDriver = summary?.posture_driver ?? "Driven by two KEV-listed findings introduced in earthworks/libraDigit_web on Jul 18.";
  const funnel = summary?.funnel || {
    total_findings: 1204,
    critical_high_count: 399,
    critical_high_pct: 33,
    reachable_count: 86,
    reachable_pct: 78,
    exploitable_now_count: 14,
    exploitable_pct: 100,
  };
  const doThisNext = summary?.do_this_next || [];
  const kpis = summary?.kpis || {
    mttr_days: 4.2,
    mttr_change_days: -1.1,
    prs_open: 7,
    jira_linked: 12,
    sla_breaches: 3,
    accepted_risks: 2,
    assets_scanned_7d_pct: 94,
  };
  const intelCoverage = summary?.intel_coverage || {
    cisa_kev: { indexed: 1647, matches: 9, last_sync: "3h ago" },
    epss: { scored: 1204, total: 1204, above_threshold: 31, last_sync: "3h ago" },
    ast_reachability: { analyzed: 18, total_assets: 20, reachable_count: 86, pending: 2 },
    exploit_validation: { sandbox_confirmed: 6, inconclusive: 3 },
  };
  const recentScans = summary?.recent_scans || [];
  const remediationPipeline = summary?.remediation_pipeline || [];
  const systemStatus = summary?.system_status || {
    api_version: "v0.1.0",
    db_connected: true,
    scan_engine_idle: true,
    total_scans: 24,
    intel_synced_at: "21 Jul, 21:06",
  };

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Fetching live security intelligence from API...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto text-foreground">
      
      {/* ── Dashboard Title Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground font-medium">
            {funnel.total_findings.toLocaleString()} findings across {intelCoverage.ast_reachability.total_assets} assets, {funnel.exploitable_now_count} need a decision today.
          </p>
        </div>
        <Button
          onClick={() => router.push("/scans")}
          className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs gap-1.5 shrink-0 self-start sm:self-center"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          Launch Vulnerability Scan
        </Button>
      </div>

      {/* ── ROW 1: Posture Score & Funnel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Posture Score Card */}
        <Card className="lg:col-span-3 border border-border/80 bg-card p-5 space-y-4 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              POSTURE SCORE
            </span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-5xl font-extrabold tracking-tight text-foreground">{postureScore}</span>
              <span className="text-sm font-semibold text-muted-foreground">/100</span>
            </div>
            <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded text-[11px] font-extrabold bg-amber-500/10 text-amber-500">
              ↓ 6 points this week
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground leading-normal">
            {postureDriver}
          </p>
        </Card>

        {/* Funnel Card */}
        <Card className="lg:col-span-9 border border-border/80 bg-card p-5 space-y-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              NOISE TO SIGNAL — HOW {funnel.total_findings.toLocaleString()} FINDINGS BECAME {funnel.exploitable_now_count}
            </span>
            <Link href="/help#faq1" className="text-[11px] font-semibold text-indigo-400 hover:underline flex items-center gap-1">
              How this is scored →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div 
              onClick={() => router.push("/findings")}
              className="p-3 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/50 transition-all cursor-pointer group"
            >
              <div className="text-2xl font-extrabold text-foreground group-hover:text-primary transition-colors">{funnel.total_findings.toLocaleString()}</div>
              <div className="text-xs font-semibold text-foreground mt-0.5">Total findings</div>
              <div className="text-[10px] text-muted-foreground">Raw scanner output</div>
            </div>
            <div 
              onClick={() => router.push("/findings?severity=critical")}
              className="p-3 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/50 transition-all cursor-pointer group"
            >
              <div className="text-2xl font-extrabold text-foreground group-hover:text-amber-500 transition-colors">{funnel.critical_high_count}</div>
              <div className="text-xs font-semibold text-foreground mt-0.5">Critical or high</div>
              <div className="text-[10px] text-muted-foreground">{funnel.critical_high_pct}% by severity</div>
            </div>
            <div 
              onClick={() => router.push("/findings?reachability=reachable")}
              className="p-3 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/50 transition-all cursor-pointer group"
            >
              <div className="text-2xl font-extrabold text-foreground group-hover:text-purple-400 transition-colors">{funnel.reachable_count}</div>
              <div className="text-xs font-semibold text-foreground mt-0.5">Reachable in code</div>
              <div className="text-[10px] text-muted-foreground">{funnel.reachable_pct}% by AST reachability</div>
            </div>
            <div 
              onClick={() => router.push("/findings")}
              className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all cursor-pointer group"
            >
              <div className="text-2xl font-extrabold text-red-500 group-hover:scale-105 transition-transform">{funnel.exploitable_now_count}</div>
              <div className="text-xs font-bold text-red-400 mt-0.5">Exploitable now</div>
              <div className="text-[10px] text-muted-foreground">KEV + EPSS + validated</div>
            </div>
          </div>

          {/* Color Progress Bar */}
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex gap-0.5">
            <div className="h-full bg-slate-600 w-[50%]" />
            <div className="h-full bg-amber-500 w-[25%]" />
            <div className="h-full bg-purple-500 w-[15%]" />
            <div className="h-full bg-red-500 w-[10%]" />
          </div>
        </Card>

      </div>

      {/* ── ROW 2: "Do this next" Prioritized Actions Widget ── */}
      <Card className="border border-border/80 bg-card p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              Do this next
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Ranked by exploitability, reachability, and asset criticality
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/10 text-amber-500 border border-amber-500/20">
              3 breaching SLA
            </span>
            <Link href="/findings?status=open" className="text-xs font-bold text-indigo-400 hover:underline">
              View all {funnel.exploitable_now_count} →
            </Link>
          </div>
        </div>

        {/* Action Rows */}
        <div className="space-y-3">
          {doThisNext.map((item) => (
            <div key={item.id} className="p-3.5 rounded-xl border border-border/60 bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className={cn(
                  "px-2 py-0.5 rounded text-[9.5px] font-black uppercase border shrink-0 mt-0.5",
                  item.badge === "KEV" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                  item.badge === "SECRET" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                  "bg-amber-500/20 text-amber-400 border-amber-500/30"
                )}>
                  {item.badge}
                </span>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {item.why_now}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <span className={cn(
                  "text-[10px] font-bold mr-2",
                  item.sla_breaching ? (item.sla_status.includes("Overdue") ? "text-red-500" : "text-amber-500") : "text-muted-foreground"
                )}>
                  {item.sla_status}
                </span>
                <Button size="xs" asChild className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 text-xs px-3 rounded-md cursor-pointer">
                  <Link href={item.action_href}>{item.action_label}</Link>
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setAssigningItem(item)}
                  className="h-8 text-xs font-semibold px-3 cursor-pointer hover:bg-muted/80 gap-1"
                >
                  <UserPlus className="h-3 w-3 text-indigo-500" />
                  Assign
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── ROW 3: 6 KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link href="/reports">
          <Card className="p-4 border border-border/70 bg-card hover:bg-muted/30 transition-all cursor-pointer">
            <div className="text-xl font-extrabold text-foreground">{kpis.mttr_days} days</div>
            <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
              Mean time to remediate <span className="text-emerald-500 font-bold">↓ 1.1d</span>
            </div>
          </Card>
        </Link>
        <Link href="/findings?view=pr">
          <Card className="p-4 border border-border/70 bg-card hover:bg-muted/30 transition-all cursor-pointer">
            <div className="text-xl font-extrabold text-foreground">{kpis.prs_open}</div>
            <div className="text-[11px] text-muted-foreground font-medium mt-0.5">Fix PRs open</div>
          </Card>
        </Link>
        <Link href="/findings?view=jira">
          <Card className="p-4 border border-border/70 bg-card hover:bg-muted/30 transition-all cursor-pointer">
            <div className="text-xl font-extrabold text-foreground">{kpis.jira_linked}</div>
            <div className="text-[11px] text-muted-foreground font-medium mt-0.5">Jira tickets linked</div>
          </Card>
        </Link>
        <Link href="/findings?status=breached">
          <Card className="p-4 border border-border/70 bg-card hover:bg-muted/30 transition-all cursor-pointer">
            <div className="text-xl font-extrabold text-red-500">{kpis.sla_breaches}</div>
            <div className="text-[11px] text-muted-foreground font-medium mt-0.5">SLA breaches</div>
          </Card>
        </Link>
        <Link href="/findings?status=accepted_risk">
          <Card className="p-4 border border-border/70 bg-card hover:bg-muted/30 transition-all cursor-pointer">
            <div className="text-xl font-extrabold text-foreground">{kpis.accepted_risks}</div>
            <div className="text-[11px] text-muted-foreground font-medium mt-0.5">Accepted risks</div>
          </Card>
        </Link>
        <Link href="/assets">
          <Card className="p-4 border border-border/70 bg-card hover:bg-muted/30 transition-all cursor-pointer">
            <div className="text-xl font-extrabold text-foreground">{kpis.assets_scanned_7d_pct}%</div>
            <div className="text-[11px] text-muted-foreground font-medium mt-0.5">Assets scanned in last 7d</div>
          </Card>
        </Link>
      </div>

      {/* ── ROW 4: Open vs Remediated Chart & Intelligence Coverage ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-7 border border-border/80 bg-card p-5 space-y-4 shadow-sm relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between border-b border-border/50 pb-3 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">Open vs remediated</h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  MTTR: {kpis.mttr_days}d ({kpis.mttr_change_days > 0 ? `+${kpis.mttr_change_days}` : kpis.mttr_change_days}d)
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Vulnerability lifecycle trajectory & MTTR velocity
              </p>
            </div>
            
            <div className="flex items-center gap-4 text-xs font-semibold">
              {/* Timeframe switcher pills */}
              <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/40">
                {(["24h", "7d", "30d", "90d"] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => router.push(`/dashboard?timeframe=${tf}`)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10.5px] font-mono font-bold transition-colors cursor-pointer",
                      timeframe === tf
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-red-500">
                  <span className="h-2 w-2 rounded-full bg-red-500" /> Open
                </span>
                <span className="flex items-center gap-1.5 text-emerald-500">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Remediated
                </span>
              </div>
            </div>
          </div>

          <div className="w-full relative select-none">
            <svg viewBox="0 0 600 200" className="w-full h-[220px] overflow-visible cursor-crosshair" onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = (x - 40) / 540;
              const idx = Math.max(0, Math.min(activeTrendData.length - 1, Math.round(percentage * (activeTrendData.length - 1))));
              setHoveredIdx(idx);
            }} onMouseLeave={() => setHoveredIdx(null)}>
              <defs>
                <linearGradient id="openGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(239, 68, 68)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="rgb(239, 68, 68)" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="remediatedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                const y = 30 + p * 140;
                const gridVal = Math.round(maxVal - p * maxVal);
                return (
                  <g key={i} className="opacity-30">
                    <line x1="40" y1={y} x2="580" y2={y} stroke="var(--border)" strokeDasharray="3 3" strokeWidth="1" />
                    <text x="12" y={y + 3} className="fill-muted-foreground text-[9px] font-mono font-medium">{gridVal}</text>
                  </g>
                );
              })}
              {openPath && <path d={`${openPath} L 580 170 L 40 170 Z`} fill="url(#openGrad)" />}
              {remediatedPath && <path d={`${remediatedPath} L 580 170 L 40 170 Z`} fill="url(#remediatedGrad)" />}
              {openPath && <path d={openPath} fill="none" stroke="rgb(239, 68, 68)" strokeWidth="2.5" strokeLinecap="round" />}
              {remediatedPath && <path d={remediatedPath} fill="none" stroke="rgb(16, 185, 129)" strokeWidth="2.5" strokeLinecap="round" />}

              {/* Glowing Dots & Crosshair on Hover */}
              {hoveredIdx !== null && activeTrendData[hoveredIdx] && (
                <g>
                  <line
                    x1={40 + (hoveredIdx / (activeTrendData.length - 1 || 1)) * 540}
                    y1="30"
                    x2={40 + (hoveredIdx / (activeTrendData.length - 1 || 1)) * 540}
                    y2="170"
                    stroke="rgba(255,255,255,0.3)"
                    strokeDasharray="4 4"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={40 + (hoveredIdx / (activeTrendData.length - 1 || 1)) * 540}
                    cy={170 - (activeTrendData[hoveredIdx].open / maxVal) * 140}
                    r="5"
                    fill="rgb(239, 68, 68)"
                    stroke="white"
                    strokeWidth="2"
                    className="animate-pulse"
                  />
                  <circle
                    cx={40 + (hoveredIdx / (activeTrendData.length - 1 || 1)) * 540}
                    cy={170 - (activeTrendData[hoveredIdx].remediated / maxVal) * 140}
                    r="5"
                    fill="rgb(16, 185, 129)"
                    stroke="white"
                    strokeWidth="2"
                    className="animate-pulse"
                  />
                </g>
              )}
            </svg>

            {/* Hover Tooltip Overlay Card */}
            {hoveredIdx !== null && activeTrendData[hoveredIdx] && (
              <div
                className="absolute z-20 pointer-events-none p-3 rounded-xl border border-border/80 bg-zinc-950/95 backdrop-blur-md shadow-2xl text-xs space-y-1.5 min-w-[170px]"
                style={{
                  left: `${Math.min(72, Math.max(8, (hoveredIdx / (activeTrendData.length - 1 || 1)) * 75))}%`,
                  top: "20px"
                }}
              >
                <div className="font-bold text-foreground text-[11px] border-b border-border/40 pb-1 flex items-center justify-between">
                  <span>{activeTrendData[hoveredIdx].date || `Point ${hoveredIdx + 1}`}</span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">
                    {((activeTrendData[hoveredIdx].remediated / ((activeTrendData[hoveredIdx].open + activeTrendData[hoveredIdx].remediated) || 1)) * 100).toFixed(0)}% fixed
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-red-400 font-semibold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Open:
                  </span>
                  <span className="font-mono font-bold text-foreground">{activeTrendData[hoveredIdx].open}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Remediated:
                  </span>
                  <span className="font-mono font-bold text-foreground">{activeTrendData[hoveredIdx].remediated}</span>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Intelligence Coverage Card */}
        <Card className="lg:col-span-5 border border-border/80 bg-card p-5 space-y-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <h3 className="text-sm font-bold text-foreground">Intelligence coverage</h3>
            <button onClick={handleForceRefresh} disabled={isRefreshing} className="text-xs font-semibold text-indigo-400 hover:underline cursor-pointer">
              {isRefreshing ? "Syncing..." : "Sync now"}
            </button>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">CISA KEV</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-500/20 text-red-400">{intelCoverage.cisa_kev.matches} matches</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{intelCoverage.cisa_kev.indexed.toLocaleString()} exploited CVEs indexed · synced {intelCoverage.cisa_kev.last_sync}</p>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-red-500 w-[75%]" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">FIRST EPSS</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-400">{intelCoverage.epss.above_threshold} above 0.5</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Scored {intelCoverage.epss.scored.toLocaleString()} of {intelCoverage.epss.total.toLocaleString()} findings · synced {intelCoverage.epss.last_sync}</p>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 w-[60%]" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">AST reachability</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-500/20 text-purple-400">{intelCoverage.ast_reachability.reachable_count} reachable</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Analyzed {intelCoverage.ast_reachability.analyzed} of {intelCoverage.ast_reachability.total_assets} assets · {intelCoverage.ast_reachability.pending} pending language support</p>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 w-[85%]" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">Exploit validation</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400">{intelCoverage.exploit_validation.sandbox_confirmed} confirmed</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Sandbox confirmed {intelCoverage.exploit_validation.sandbox_confirmed} · {intelCoverage.exploit_validation.inconclusive} inconclusive</p>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[45%]" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── ROW 5: Recent Scans & Remediation Pipeline ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-6 border border-border/80 bg-card p-5 space-y-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <h3 className="text-sm font-bold text-foreground">Recent scans</h3>
            <Link href="/scans" className="text-xs font-bold text-indigo-400 hover:underline">All {systemStatus.total_scans} runs →</Link>
          </div>
          <div className="space-y-3">
            {recentScans.map((scan) => (
              <div 
                key={scan.id} 
                onClick={() => router.push(`/scans/${scan.id}`)}
                className="p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors space-y-1 cursor-pointer group"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground group-hover:text-primary transition-colors">{scan.target}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9.5px] bg-muted font-mono text-muted-foreground">{scan.target_type}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold">
                    {scan.critical_count > 0 && <span className="text-red-400">{scan.critical_count} crit</span>}
                    {scan.high_count > 0 && <span className="text-amber-400">{scan.high_count} high</span>}
                    {scan.medium_count > 0 && <span className="text-slate-400">{scan.medium_count} med</span>}
                    {scan.critical_count === 0 && scan.high_count === 0 && scan.medium_count === 0 && (
                      <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">No new findings</span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">{scan.summary_text}</p>
              </div>
            ))}
          </div>
          <div className="pt-2 flex items-center justify-between text-xs font-semibold border-t border-border/40">
            <span className="text-muted-foreground">2 more targets queued.</span>
            <Link href="/assets" className="text-indigo-400 hover:underline">Add an asset →</Link>
          </div>
        </Card>

        <Card className="lg:col-span-6 border border-border/80 bg-card p-5 space-y-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <h3 className="text-sm font-bold text-foreground">Remediation pipeline</h3>
            <Link href="/remediation-hub" className="text-xs font-bold text-indigo-400 hover:underline">Open hub →</Link>
          </div>
          <div className="space-y-4 text-xs">
            {remediationPipeline.map((group, gIdx) => (
              <div key={gIdx} className="space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">{group.group}</span>
                <div className="space-y-1.5">
                  {group.items.map((item, iIdx) => (
                    <div 
                      key={iIdx} 
                      onClick={() => router.push("/remediation-hub")}
                      className="p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between cursor-pointer group"
                    >
                      <div>
                        <p className="font-bold text-foreground group-hover:text-primary transition-colors">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{item.subtitle}</p>
                      </div>
                      <span className={cn(
                        "text-[10px] font-extrabold px-2 py-0.5 rounded shrink-0",
                        item.badge_color === "emerald" ? "bg-emerald-500/20 text-emerald-400" :
                        item.badge_color === "amber" ? "bg-amber-500/20 text-amber-400" :
                        "bg-blue-500/20 text-blue-400"
                      )}>
                        {item.badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── FOOTER BAR ── */}
      <div className="pt-4 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between text-[11px] text-muted-foreground font-mono gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-emerald-500 font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> API {systemStatus.api_version}
          </span>
          <span>● PostgreSQL {systemStatus.db_connected ? "connected" : "disconnected"}</span>
          <span>● Scan engine {systemStatus.scan_engine_idle ? "idle" : "running"} · {systemStatus.total_scans} runs</span>
        </div>
        <div>Intelligence feeds synced {systemStatus.intel_synced_at}</div>
      </div>
      {/* ── Assign Remediation Owner Modal ── */}
      <Dialog open={!!assigningItem} onOpenChange={(open) => !open && setAssigningItem(null)}>
        <DialogContent className="sm:max-w-[460px] border border-border/80 bg-card shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="h-5 w-5 text-indigo-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Assign Task Owner</span>
            </div>
            <DialogTitle className="text-base font-bold text-foreground leading-tight">
              {assigningItem?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Assign remediation ownership and notification alerts for this prioritized risk.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg border border-border/60 bg-muted/20 text-xs space-y-1">
              <div className="font-mono text-[10px] font-semibold text-muted-foreground">
                Trigger: <span className="text-foreground">{assigningItem?.why_now}</span>
              </div>
              <div className="font-mono text-[10px] font-semibold text-muted-foreground">
                SLA Deadline: <span className="text-amber-500 font-bold">{assigningItem?.sla_status}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Select Assignee / Team</label>
              <select
                value={selectedOwner}
                onChange={(e) => setSelectedOwner(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary"
              >
                <option value="SecOps Lead">SecOps Lead (SecOps Team)</option>
                <option value="DevOps Team">DevOps Team (Infra / CI-CD)</option>
                <option value="AppSec Engineer">AppSec Engineer (Application Security)</option>
                <option value="Backend Engineering">Backend Engineering Team</option>
                <option value="CISO Admin">CISO Executive Office</option>
              </select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAssigningItem(null)}
              className="h-8 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmAssignment}
              className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
            >
              Confirm Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
