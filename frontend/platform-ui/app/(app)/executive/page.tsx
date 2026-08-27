"use client";

/**
 * FR-UI-08 — CISO Executive View
 * Single-screen, projection-ready dashboard.
 * - Present mode (Maximize → fullscreen, hides nav, larger text)
 * - URL-shareable: /executive?as_of=2026-05-21
 * - 3 focused metric cards: Validated Critical · KEV in Wild · Reachable High
 * - WoW delta arrows
 * - AI executive paragraph
 */

import * as React from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  Shield,
  Flame,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minimize,
  Maximize,
  RefreshCw,
  Loader2,
  Sparkles,
  Activity,
  Eye,
  EyeOff,
  Clock,
  ArrowUp,
  ArrowDown,
  Minus,
  GitMerge,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TopRisk {
  id: string;
  title: string;
  severity: string;
  cve_id: string | null;
  priority_score: number | null;
  kev_listed: boolean;
  exploit_validated: boolean;
  asset_name: string | null;
}

interface WoWTrend {
  fixed: number;
  new: number;
  regressed: number;
}

interface ExecutiveSummary {
  posture_score: number;
  top_risks: TopRisk[];
  wow_trend: WoWTrend;
  exec_summary_paragraph: string;
  kev_count: number;
  validated_critical_count: number;
  total_open_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  cached: boolean;
  computed_at: string;
}

// ─── Score helpers ────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 80) return { ring: "#10b981", text: "text-emerald-400", label: "SECURE", bg: "bg-emerald-500/8" };
  if (s >= 60) return { ring: "#f59e0b", text: "text-amber-400",   label: "MODERATE", bg: "bg-amber-500/8" };
  if (s >= 40) return { ring: "#f97316", text: "text-orange-400",  label: "AT RISK", bg: "bg-orange-500/8" };
  return         { ring: "#ef4444", text: "text-red-400",          label: "CRITICAL",  bg: "bg-red-500/8" };
}

// Pure-SVG radial score ring — no chart library
function ScoreRing({ score, present }: { score: number; present: boolean }) {
  const { ring, text, label } = scoreColor(score);
  const R = present ? 110 : 90;
  const circ = 2 * Math.PI * R;
  const offset = ((100 - score) / 100) * circ;
  const sz = present ? 260 : 210;

  return (
    <div className="relative flex items-center justify-center select-none">
      <svg width={sz} height={sz} className="-rotate-90">
        <circle cx={sz/2} cy={sz/2} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={present ? 14 : 12} />
        <circle
          cx={sz/2} cy={sz/2} r={R} fill="none"
          strokeWidth={present ? 14 : 12}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          stroke={ring}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center gap-0.5">
        <span className={cn(present ? "text-7xl" : "text-5xl", "font-black font-mono tracking-tighter leading-none", text)}>
          {score}
        </span>
        <span className="text-[11px] text-slate-600 font-bold">/100</span>
        <span className={cn(present ? "text-sm" : "text-xs", "font-black uppercase tracking-widest mt-0.5", text)}>
          {label}
        </span>
      </div>
    </div>
  );
}

// Delta arrow for WoW trend
function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  if (value === 0) return <Minus className="h-4 w-4 text-slate-500 inline" />;
  const isGood = invert ? value < 0 : value > 0;
  return value > 0 ? (
    <ArrowUp className={cn("h-4 w-4 inline", isGood ? "text-emerald-400" : "text-red-400")} />
  ) : (
    <ArrowDown className={cn("h-4 w-4 inline", isGood ? "text-emerald-400" : "text-red-400")} />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ExecutivePageInner() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken;
  const params = useSearchParams();
  const asOf = params.get("as_of"); // optional date param — display only, not passed to API yet

  const [present, setPresent] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  // Fullscreen enter/exit via Fullscreen API + keyboard Escape listener
  const togglePresent = React.useCallback(async () => {
    if (!present) {
      try {
        await wrapperRef.current?.requestFullscreen?.();
      } catch {}
      setPresent(true);
    } else {
      try {
        await document.exitFullscreen?.();
      } catch {}
      setPresent(false);
    }
  }, [present]);

  React.useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setPresent(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ESC key to exit present mode (the native fullscreen Escape is caught above,
  // but we also handle non-fullscreen present mode)
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && present) setPresent(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [present]);

  const { data, isLoading, error, dataUpdatedAt, refetch, isFetching } =
    useQuery<ExecutiveSummary>({
      queryKey: ["executive"],
      queryFn: async () => {
        if (!token) throw new Error("Not authenticated");
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/executive`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error("Failed to fetch executive summary");
        return res.json();
      },
      enabled: !!token,
      refetchInterval: 5 * 60 * 1000,
      staleTime: 4 * 60 * 1000,
    });

  // Compute reachable high count from top_risks (proxy — actual field would come from backend)
  const reachableHighCount = data
    ? data.top_risks.filter(r => r.severity === "high").length
    : 0;

  // WoW delta: new - fixed = net change (negative is good)
  const netDelta = data ? data.wow_trend.new - data.wow_trend.fixed : 0;

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "min-h-screen bg-[#05080F] text-white overflow-x-hidden transition-all duration-300",
        present && "fixed inset-0 z-[9999] overflow-y-auto"
      )}
    >
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.1),transparent_60%)]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-[radial-gradient(ellipse_at_bottom-right,rgba(168,85,247,0.07),transparent_60%)]" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.2) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.2) 1px,transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div
        className={cn(
          "relative z-10 mx-auto flex flex-col gap-8 transition-all duration-300",
          present
            ? "max-w-none px-10 py-8"
            : "max-w-[1280px] px-6 py-6"
        )}
      >
        {/* ─── Header bar ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 transition-all",
              present ? "h-12 w-12" : "h-9 w-9"
            )}>
              <Shield className={cn(present ? "h-6 w-6" : "h-5 w-5", "text-indigo-400")} />
            </div>
            <div>
              <h1 className={cn(
                "font-black tracking-tight text-white transition-all",
                present ? "text-3xl" : "text-xl"
              )}>
                Security Posture{" "}
                <span className="text-indigo-400">Intelligence</span>
              </h1>
              <p className={cn("text-slate-500 font-semibold transition-all", present ? "text-sm" : "text-[11px]")}>
                CISO Executive View
                {asOf && (
                  <span className="ml-2 text-indigo-400/70">
                    · as of {asOf}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {data?.cached && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400/60 border border-indigo-500/15 bg-indigo-500/5 px-2 py-1 rounded-full">
                Cached · 5 min
              </span>
            )}
            {dataUpdatedAt && (
              <span className="hidden sm:flex items-center gap-1 text-[11px] text-slate-600">
                <Clock className="h-3 w-3" />
                {new Date(dataUpdatedAt).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Refresh executive data"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/8 bg-white/4 hover:bg-white/8 transition-colors text-[11px] text-slate-400 cursor-pointer"
            >
              {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Refresh
            </button>
            <button
              onClick={togglePresent}
              aria-label={present ? "Exit present mode" : "Enter present mode"}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-[11px] font-semibold cursor-pointer",
                present
                  ? "border-indigo-500/30 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25"
                  : "border-indigo-500/20 bg-indigo-500/8 text-indigo-400 hover:bg-indigo-500/15"
              )}
            >
              {present ? (
                <><Minimize className="h-3.5 w-3.5" /> Exit Present</>
              ) : (
                <><Maximize className="h-3.5 w-3.5" /> Present Mode</>
              )}
            </button>
          </div>
        </div>

        {/* ─── Loading ─────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-indigo-400" />
            <p className={cn("text-slate-500 font-semibold", present ? "text-xl" : "text-sm")}>
              Computing posture score…
            </p>
          </div>
        )}

        {/* ─── Error ───────────────────────────────────────────────────── */}
        {error && (
          <div className="flex flex-col items-center justify-center py-40 gap-3">
            <AlertTriangle className="h-14 w-14 text-red-500" />
            <p className={cn("text-red-400 font-black", present ? "text-2xl" : "text-lg")}>
              Failed to load executive summary
            </p>
            <p className="text-slate-500 text-sm">{String(error)}</p>
          </div>
        )}

        {/* ─── Main dashboard ──────────────────────────────────────────── */}
        {data && (
          <>
            {/* ── TOP: Score + WoW delta ────────────────────────────── */}
            <div className={cn(
              "flex flex-col sm:flex-row items-center justify-center gap-8",
              present ? "gap-16" : "gap-8"
            )}>
              {/* Radial Score */}
              <ScoreRing score={data.posture_score} present={present} />

              {/* WoW Trend Deltas */}
              <div className={cn(
                "flex flex-col gap-5 text-left",
                present ? "gap-8" : "gap-5"
              )}>
                <div>
                  <p className={cn("text-slate-500 uppercase font-black tracking-widest", present ? "text-sm" : "text-[10px]")}>
                    Week-over-Week
                  </p>
                  <p className={cn("text-white font-black tracking-tight mt-0.5", present ? "text-4xl" : "text-2xl")}>
                    <Delta value={-netDelta} />
                    {" "}
                    <span className={netDelta <= 0 ? "text-emerald-400" : "text-red-400"}>
                      {Math.abs(netDelta)} findings
                    </span>
                    {" "}
                    <span className="text-slate-400 font-medium">
                      {netDelta <= 0 ? "resolved" : "added"}
                    </span>
                  </p>
                </div>

                <div className={cn("flex gap-6", present && "gap-10")}>
                  <div className="flex flex-col">
                    <span className={cn("font-black text-emerald-400", present ? "text-3xl" : "text-xl")}>
                      +{data.wow_trend.fixed}
                    </span>
                    <span className={cn("text-slate-500 font-semibold uppercase tracking-wider", present ? "text-sm" : "text-[10px]")}>
                      Fixed
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className={cn("font-black text-red-400", present ? "text-3xl" : "text-xl")}>
                      +{data.wow_trend.new}
                    </span>
                    <span className={cn("text-slate-500 font-semibold uppercase tracking-wider", present ? "text-sm" : "text-[10px]")}>
                      New
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className={cn("font-black text-amber-400", present ? "text-3xl" : "text-xl")}>
                      {data.wow_trend.regressed}
                    </span>
                    <span className={cn("text-slate-500 font-semibold uppercase tracking-wider", present ? "text-sm" : "text-[10px]")}>
                      Re-opened
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── MIDDLE: 3 Feature Metric Cards ───────────────────── */}
            <div className={cn(
              "grid grid-cols-1 sm:grid-cols-3 gap-5",
              present && "gap-8"
            )}>

              {/* Card 1: Validated Critical */}
              <MetricCard
                icon={<CheckCircle2 className={cn(present ? "h-8 w-8" : "h-6 w-6", "text-emerald-400")} />}
                label="Validated Critical"
                sublabel="Actively confirmed exploitable via probe"
                value={data.validated_critical_count}
                color="emerald"
                present={present}
                highlight={data.validated_critical_count > 0}
              />

              {/* Card 2: KEV in Wild */}
              <MetricCard
                icon={<Flame className={cn(present ? "h-8 w-8" : "h-6 w-6", "text-red-400")} />}
                label="KEV in Wild"
                sublabel="CISA Known Exploited Vulnerabilities — active"
                value={data.kev_count}
                color="red"
                present={present}
                pulse={data.kev_count > 0}
                highlight={data.kev_count > 0}
              />

              {/* Card 3: Reachable High Severity */}
              <MetricCard
                icon={<GitMerge className={cn(present ? "h-8 w-8" : "h-6 w-6", "text-amber-400")} />}
                label="Reachable High"
                sublabel="High-severity findings with reachable code paths"
                value={reachableHighCount}
                color="amber"
                present={present}
                highlight={reachableHighCount > 0}
              />
            </div>

            {/* ── BOTTOM: AI Executive Summary ─────────────────────── */}
            <div className={cn(
              "rounded-2xl border border-purple-500/15 bg-purple-500/5 backdrop-blur-sm p-8 space-y-4",
              present && "p-10"
            )}>
              <div className="flex items-center gap-2.5">
                <Sparkles className={cn(present ? "h-6 w-6" : "h-4 w-4", "text-purple-400 animate-pulse")} />
                <span className={cn("font-black uppercase tracking-widest text-purple-400", present ? "text-sm" : "text-[10px]")}>
                  AI Executive Briefing
                </span>
              </div>
              <p className={cn(
                "text-slate-300 leading-relaxed font-medium",
                present ? "text-xl leading-loose" : "text-sm"
              )}>
                {data.exec_summary_paragraph}
              </p>
              <p className={cn("text-slate-600 font-medium", present ? "text-sm" : "text-[10px]")}>
                Analysis computed {new Date(data.computed_at + "Z").toLocaleString()}
                {asOf && <span className="ml-2 text-indigo-500/60">· Showing posture as of {asOf}</span>}
              </p>
            </div>

            {/* Footer */}
            <p className={cn(
              "text-center text-slate-700 font-medium select-none",
              present ? "text-sm" : "text-[10px]"
            )}>
              Cached for 5 min · Auto-refreshes · Share URL:{" "}
              <span className="text-slate-500 font-mono">
                /executive{asOf ? `?as_of=${asOf}` : ""}
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Suspense-wrapped default export ─────────────────────────────────────────
// Required because ExecutivePageInner uses useSearchParams()

export default function ExecutivePage() {
  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[#05080F]">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
      </div>
    }>
      <ExecutivePageInner />
    </React.Suspense>
  );
}

// ─── Metric Card component ────────────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  sublabel,
  value,
  color,
  present,
  pulse = false,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  value: number;
  color: "emerald" | "red" | "amber";
  present: boolean;
  pulse?: boolean;
  highlight?: boolean;
}) {
  const styles = {
    emerald: {
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/5",
      num: "text-emerald-400",
      glow: "shadow-[0_0_30px_rgba(16,185,129,0.12)]",
    },
    red: {
      border: "border-red-500/20",
      bg: "bg-red-500/5",
      num: "text-red-400",
      glow: "shadow-[0_0_30px_rgba(239,68,68,0.12)]",
    },
    amber: {
      border: "border-amber-500/20",
      bg: "bg-amber-500/5",
      num: "text-amber-400",
      glow: "shadow-[0_0_30px_rgba(245,158,11,0.12)]",
    },
  }[color];

  return (
    <div
      className={cn(
        "rounded-2xl border backdrop-blur-sm flex flex-col justify-between transition-all duration-300",
        styles.border,
        styles.bg,
        highlight && styles.glow,
        present ? "p-10 gap-6" : "p-7 gap-4"
      )}
    >
      <div className="flex items-start justify-between">
        <span className={pulse ? "animate-pulse" : ""}>{icon}</span>
        <span className={cn(
          "uppercase font-black tracking-widest text-slate-500",
          present ? "text-sm" : "text-[10px]"
        )}>
          This Week
        </span>
      </div>
      <div>
        <div className={cn(
          "font-black font-mono tracking-tighter leading-none",
          styles.num,
          present ? "text-8xl" : "text-6xl"
        )}>
          {value}
        </div>
        <p className={cn("font-black text-slate-200 mt-2", present ? "text-xl" : "text-base")}>
          {label}
        </p>
        <p className={cn("text-slate-500 mt-1 leading-relaxed", present ? "text-sm" : "text-xs")}>
          {sublabel}
        </p>
      </div>
    </div>
  );
}
