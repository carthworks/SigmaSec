"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  Layers,
  Sparkles,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  TrendingUp,
  XCircle,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

interface ControlDetail {
  control_id: string;
  title: string;
  category: string;
  description: string;
  status: "compliant" | "non_compliant";
  total_findings: number;
  critical_findings: number;
  high_findings: number;
  medium_findings: number;
  low_findings: number;
}

interface FrameworkSummary {
  name: string;
  version: string;
  description: string;
  readiness_score: number;
  passing_controls: number;
  total_controls: number;
  controls: ControlDetail[];
}

interface ComplianceData {
  org_id: string;
  total_active_findings: number;
  frameworks: Record<string, FrameworkSummary>;
}

const FRAMEWORKS = [
  {
    id: "soc2",
    label: "SOC 2 Type II",
    subtitle: "2023 Trust Criteria",
    icon: "🛡️",
    color: "emerald",
  },
  {
    id: "pci_dss",
    label: "PCI-DSS v4.0",
    subtitle: "Payment Card Security",
    icon: "💳",
    color: "blue",
  },
  {
    id: "iso_27001",
    label: "ISO 27001:2022",
    subtitle: "Information Security",
    icon: "🌐",
    color: "violet",
  },
  {
    id: "nist_800_53",
    label: "NIST SP 800-53",
    subtitle: "Federal Controls R5",
    icon: "🏛️",
    color: "amber",
  },
] as const;

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

const colorMap: Record<string, { ring: string; badge: string; text: string; bar: string; glow: string }> = {
  emerald: {
    ring: "ring-emerald-500/40 border-emerald-500/50 shadow-emerald-500/10",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    text: "text-emerald-400",
    bar: "bg-emerald-400",
    glow: "shadow-emerald-500/20",
  },
  blue: {
    ring: "ring-blue-500/40 border-blue-500/50 shadow-blue-500/10",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/25",
    text: "text-blue-400",
    bar: "bg-blue-400",
    glow: "shadow-blue-500/20",
  },
  violet: {
    ring: "ring-violet-500/40 border-violet-500/50 shadow-violet-500/10",
    badge: "bg-violet-500/10 text-violet-400 border-violet-500/25",
    text: "text-violet-400",
    bar: "bg-violet-400",
    glow: "shadow-violet-500/20",
  },
  amber: {
    ring: "ring-amber-500/40 border-amber-500/50 shadow-amber-500/10",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    text: "text-amber-400",
    bar: "bg-amber-400",
    glow: "shadow-amber-500/20",
  },
};

function ScoreRing({ score }: { score: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color =
    score >= 80 ? "#34d399" : score >= 50 ? "#f59e0b" : "#f87171";
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" className="shrink-0">
      <circle
        cx="34" cy="34" r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        className="text-slate-800"
      />
      <circle
        cx="34" cy="34" r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 34 34)"
        style={{ transition: "stroke-dasharray 0.7s cubic-bezier(.4,0,.2,1)" }}
      />
      <text
        x="34" y="34"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="13"
        fontWeight="700"
        fill={color}
      >
        {score}%
      </text>
    </svg>
  );
}

export default function CompliancePage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [activeFramework, setActiveFramework] = React.useState<string>("soc2");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const { data, isLoading, refetch, isFetching } = useQuery<ComplianceData>({
    queryKey: ["compliance-summary"],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/compliance/summary`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed to fetch compliance summary");
      return res.json();
    },
    enabled: !!token,
  });

  const currentFw = data?.frameworks?.[activeFramework];
  const activeFwMeta = FRAMEWORKS.find((f) => f.id === activeFramework)!;
  const colors = colorMap[activeFwMeta.color];

  // Reset to page 1 when filters/framework change
  React.useEffect(() => { setPage(1); }, [activeFramework, searchQuery, statusFilter, pageSize]);

  const filteredControls = React.useMemo(() => {
    if (!currentFw) return [];
    return currentFw.controls.filter((ctrl) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        ctrl.control_id.toLowerCase().includes(q) ||
        ctrl.title.toLowerCase().includes(q) ||
        ctrl.category.toLowerCase().includes(q) ||
        ctrl.description.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" || ctrl.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [currentFw, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredControls.length / pageSize));
  const paginatedControls = filteredControls.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handleExportReport = () => {
    toast.success("Generating CISO Compliance Audit Report...", {
      description: "Preparing formatted PDF audit export.",
    });
    window.print();
  };

  // Skeleton loader rows
  const SkeletonRow = () => (
    <tr className="border-b border-slate-800/60">
      {[28, 48, 20, 12, 12, 12, 14].map((w, i) => (
        <td key={i} className="py-3.5 px-4">
          <div
            className="h-3 rounded bg-slate-800 animate-pulse"
            style={{ width: `${w * 2}px`, maxWidth: "100%" }}
          />
        </td>
      ))}
    </tr>
  );

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto pb-12">

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between border-b border-slate-800/80 pb-5 pt-1">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2.5">
            <Sparkles className="h-3 w-3" />
            AI Compliance Engine
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
            Automated Compliance Control Mapping
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 max-w-2xl leading-relaxed">
            Automatically maps technical findings from{" "}
            <span className="text-slate-300">Trivy (SCA)</span>,{" "}
            <span className="text-slate-300">Gitleaks (Secrets)</span>,{" "}
            <span className="text-slate-300">Nuclei (DAST)</span>, and{" "}
            <span className="text-slate-300">Opengrep (SAST)</span> to
            SOC 2, PCI-DSS, ISO 27001, and NIST 800-53 controls in real time.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3.5 py-2 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 text-xs font-medium hover:bg-slate-800 hover:text-white transition flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleExportReport}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs transition flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* ── Framework Scorecard Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {FRAMEWORKS.map((fw) => {
          const fwData = data?.frameworks?.[fw.id];
          const isSelected = activeFramework === fw.id;
          const score = fwData?.readiness_score ?? 0;
          const c = colorMap[fw.color];
          const passing = fwData?.passing_controls ?? 0;
          const total = fwData?.total_controls ?? 0;

          return (
            <button
              key={fw.id}
              onClick={() => setActiveFramework(fw.id)}
              className={`w-full text-left p-4 rounded-xl border transition-all duration-200 relative overflow-hidden ${
                isSelected
                  ? `bg-slate-900 border-current ${c.ring} ring-1 shadow-lg`
                  : "bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70"
              }`}
              style={isSelected ? { borderColor: "transparent" } : {}}
            >
              {isSelected && (
                <div
                  className="absolute inset-0 opacity-5 pointer-events-none"
                  style={{
                    background: `radial-gradient(ellipse at 50% 0%, ${
                      fw.color === "emerald" ? "#34d399"
                      : fw.color === "blue" ? "#60a5fa"
                      : fw.color === "violet" ? "#a78bfa"
                      : "#fbbf24"
                    }, transparent 70%)`,
                  }}
                />
              )}

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-lg mb-0.5">{fw.icon}</div>
                  <div className="text-sm font-bold text-white leading-tight">
                    {fw.label}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {fw.subtitle}
                  </div>
                </div>
                <ScoreRing score={isLoading ? 0 : score} />
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Passing Controls
                </span>
                <span className={`font-mono font-bold ${isLoading ? "text-slate-600" : c.text}`}>
                  {isLoading ? "—" : `${passing} / ${total}`}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Controls Audit Matrix ── */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">

        {/* Matrix Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border-b border-slate-800/80 bg-slate-900/60">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className={`h-4 w-4 ${colors.text}`} />
              {currentFw?.name ?? activeFwMeta.label} — Control Audit Matrix
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {currentFw?.description ?? "Select a framework to view control details."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search controls..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 w-48 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-7 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer transition"
              >
                <option value="all">All Statuses</option>
                <option value="compliant">Compliant</option>
                <option value="non_compliant">Non-Compliant</option>
              </select>
            </div>

            {/* Rows per page */}
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="py-1.5 px-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer transition"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
          </div>
        </div>

        {/* Result count bar */}
        {!isLoading && (
          <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/40 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Showing{" "}
              <span className="text-slate-300 font-medium">
                {filteredControls.length === 0
                  ? "0"
                  : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredControls.length)}`}
              </span>{" "}
              of{" "}
              <span className="text-slate-300 font-medium">{filteredControls.length}</span>{" "}
              controls
              {statusFilter !== "all" && (
                <span className="ml-1 text-slate-500">
                  ({statusFilter === "compliant" ? "compliant only" : "non-compliant only"})
                </span>
              )}
            </span>
            {(searchQuery || statusFilter !== "all") && (
              <button
                onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                className="text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
              >
                <XCircle className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 min-w-[720px]">
            <thead className="bg-slate-900/90 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 w-28 font-semibold">Control ID</th>
                <th className="py-3 px-4 font-semibold">Title &amp; Description</th>
                <th className="py-3 px-4 w-36 font-semibold">Status</th>
                <th className="py-3 px-4 w-20 text-center font-semibold">
                  <span className="text-rose-400">Critical</span>
                </th>
                <th className="py-3 px-4 w-16 text-center font-semibold">
                  <span className="text-amber-400">High</span>
                </th>
                <th className="py-3 px-4 w-16 text-center font-semibold">
                  <span className="text-yellow-300">Med</span>
                </th>
                <th className="py-3 px-4 w-20 text-center font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {isLoading ? (
                Array.from({ length: pageSize }).map((_, i) => <SkeletonRow key={i} />)
              ) : paginatedControls.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <ShieldCheck className="h-10 w-10 text-slate-700" />
                      <p className="text-slate-500 text-sm font-medium">
                        {searchQuery || statusFilter !== "all"
                          ? "No controls match your filters."
                          : "No compliance controls found."}
                      </p>
                      {(searchQuery || statusFilter !== "all") && (
                        <button
                          onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                          className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedControls.map((ctrl) => (
                  <tr
                    key={ctrl.control_id}
                    className="hover:bg-slate-800/25 transition-colors duration-100 group"
                  >
                    {/* Control ID */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-white text-[12px] bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700/50 whitespace-nowrap">
                        {ctrl.control_id}
                      </span>
                    </td>

                    {/* Title & Description */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-100 text-xs leading-snug">
                        {ctrl.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-400">{ctrl.category}</span>
                        <span className="text-slate-700">•</span>
                        <span className="truncate max-w-xs">{ctrl.description}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {ctrl.status === "compliant" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          Compliant
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 whitespace-nowrap">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          Non-Compliant
                        </span>
                      )}
                    </td>

                    {/* Critical */}
                    <td className="py-3.5 px-4 text-center">
                      {ctrl.critical_findings > 0 ? (
                        <span className="inline-block min-w-[28px] px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/20">
                          {ctrl.critical_findings}
                        </span>
                      ) : (
                        <span className="text-slate-700 font-mono">—</span>
                      )}
                    </td>

                    {/* High */}
                    <td className="py-3.5 px-4 text-center">
                      {ctrl.high_findings > 0 ? (
                        <span className="inline-block min-w-[28px] px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                          {ctrl.high_findings}
                        </span>
                      ) : (
                        <span className="text-slate-700 font-mono">—</span>
                      )}
                    </td>

                    {/* Medium */}
                    <td className="py-3.5 px-4 text-center">
                      {ctrl.medium_findings > 0 ? (
                        <span className="inline-block min-w-[28px] px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-yellow-500/10 text-yellow-300 border border-yellow-500/20">
                          {ctrl.medium_findings}
                        </span>
                      ) : (
                        <span className="text-slate-700 font-mono">—</span>
                      )}
                    </td>

                    {/* Total */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                          ctrl.total_findings > 0
                            ? "text-white bg-slate-700/60 border border-slate-600/40"
                            : "text-slate-700"
                        }`}
                      >
                        {ctrl.total_findings > 0 ? ctrl.total_findings : "—"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination Footer ── */}
        {!isLoading && filteredControls.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-800/80 bg-slate-900/40">
            {/* Left: info */}
            <p className="text-[11px] text-slate-500 order-2 sm:order-1">
              Page{" "}
              <span className="text-slate-300 font-medium">{page}</span> of{" "}
              <span className="text-slate-300 font-medium">{totalPages}</span>
              {" "}·{" "}
              <span className="text-slate-300 font-medium">{filteredControls.length}</span> controls total
            </p>

            {/* Right: page buttons */}
            <div className="flex items-center gap-1 order-1 sm:order-2">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                aria-label="First page"
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {/* Page number pills */}
              <div className="flex items-center gap-1 mx-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => {
                    if (totalPages <= 7) return true;
                    if (n === 1 || n === totalPages) return true;
                    if (Math.abs(n - page) <= 1) return true;
                    return false;
                  })
                  .reduce<(number | "…")[]>((acc, n, idx, arr) => {
                    if (idx > 0 && typeof arr[idx - 1] === "number" && n - (arr[idx - 1] as number) > 1) {
                      acc.push("…");
                    }
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === "…" ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-slate-600 text-xs select-none">
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item as number)}
                        className={`min-w-[28px] h-7 px-2 rounded-md text-xs font-medium transition ${
                          page === item
                            ? "bg-emerald-500 text-slate-950 font-bold shadow shadow-emerald-500/30"
                            : "text-slate-400 hover:text-white hover:bg-slate-800"
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                aria-label="Last page"
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
