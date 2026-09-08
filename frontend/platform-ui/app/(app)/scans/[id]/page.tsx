"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState
} from "@tanstack/react-table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { LiveTerminal } from "@/components/live-terminal";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,

  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  Globe,
  Hash,
  Loader2,
  MessageCircleQuestion,
  RefreshCw,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  XCircle,
  ExternalLink,
  Plus,
  Copy,
  GitPullRequest
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { SeverityBadge } from "@/components/severity-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useHotkeys } from "react-hotkeys-hook";


interface PageProps {
  params: Promise<{ id: string }>;
}

interface ScanData {
  id: string;
  target: string;
  scan_types: string[];
  created_at: string;
  status: string;
  celery_task_id: string | null;
  exec_summary?: string | null;
  findings_count?: {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
    info?: number;
  };
}

interface FindingData {
  id: string;
  scan_id: string;
  title: string;
  severity: string;
  cve_id: string | null;
  tool: string;
  url: string | null;
  description: string | null;
  created_at: string;
  metadata?: {
    fixed_version?: string;
    pkg_name?: string;
    package?: string;
    installed_version?: string;
    occurrences?: Array<{
      file: string;
      line: number;
      commit: string;
    }>;
    // Secrets scanner attributes
    secret_type?: string;
    file?: string;
    line?: number;
    commit?: string;
    partial_secret?: string;
  } | null;
  scan_metadata?: any;
  exploit_validated?: boolean;
  cvss_score?: number | null;
  cvss_vector?: string | null;
  cwe?: string[] | null;
  kev_listed?: boolean;
  kev_due_date?: string | null;
  epss_score?: number | null;
  epss_percentile?: number | null;
  priority_score?: number | null;
  priority_rank?: number | null;
  ai_plain_english?: string | null;
  raw_output?: string | null;
  reachability?: string | null;
  reachability_reason?: string | null;
  jira_issue_key?: string | null;
  pr_url?: string | null;
  pr_status?: string | null;
}

// Sub-component: Collapsible
interface CollapsibleProps {
  title: string;
  children: React.ReactNode;
}

function Collapsible({ title, children }: CollapsibleProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <div className="border border-border/80 rounded-lg overflow-hidden bg-muted/20">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-xs font-semibold text-foreground/80 hover:bg-muted/40 transition-colors select-none cursor-pointer no-print"
      >
        <span>{title}</span>
        {isOpen ? <ChevronUp className="h-4 w-4 opacity-70" /> : <ChevronDown className="h-4 w-4 opacity-70" />}
      </button>
      {/* Print-only title banner */}
      <div className="hidden print:block p-3 text-xs font-bold text-foreground border-b border-border/50 bg-muted/30">
        {title}
      </div>
      <div className={cn(
        "border-t border-border/50 p-3 bg-background/50 font-mono text-[10px] whitespace-pre-wrap break-all overflow-x-auto max-h-[300px]",
        !isOpen && "hidden print:block"
      )}>
        {children}
      </div>
    </div>
  );
}

function ReachabilityBadge({ status }: { status?: string | null }) {
  const val = status ? status.toLowerCase() : "uncertain";
  
  if (val === "reachable") {
    return (
      <Badge className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold text-[9px] tracking-wider uppercase px-2 py-0.5 rounded whitespace-nowrap">
        REACHABLE
      </Badge>
    );
  } else if (val === "unreachable") {
    return (
      <Badge className="bg-muted hover:bg-muted/80 text-muted-foreground border border-muted-foreground/20 font-semibold text-[9px] tracking-wider uppercase px-2 py-0.5 rounded whitespace-nowrap">
        NOT REACHED IN CODE
      </Badge>
    );
  } else {
    return (
      <Badge className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold text-[9px] tracking-wider uppercase px-2 py-0.5 rounded whitespace-nowrap">
        UNCERTAIN
      </Badge>
    );
  }
}

const CWE_NAMES: Record<string, string> = {
  "CWE-20": "Improper Input Validation",
  "CWE-22": "Path Traversal",
  "CWE-78": "OS Command Injection",
  "CWE-79": "Cross-site Scripting (XSS)",
  "CWE-89": "SQL Injection",
  "CWE-94": "Code Injection",
  "CWE-200": "Information Exposure",
  "CWE-287": "Improper Authentication",
  "CWE-352": "Cross-Site Request Forgery (CSRF)",
  "CWE-400": "Uncontrolled Resource Consumption",
  "CWE-502": "Deserialization of Untrusted Data",
  "CWE-798": "Use of Hard-coded Credentials",
  "CWE-918": "Server-Side Request Forgery (SSRF)",
};

// Sub-component: FindingsTable
interface FindingsTableProps {
  scanId: string;
  scanStatus: string;
  scanTarget: string;
  onOpenFinding: (finding: FindingData) => void;
  findings: FindingData[];
  isLoading: boolean;
  error: any;
}

function FindingsTable({ scanId, scanStatus, scanTarget, onOpenFinding, findings, isLoading, error }: FindingsTableProps) {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "priority_score", desc: true }
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [selectedSeverity, setSelectedSeverity] = React.useState<string>("all");
  const [reachableOnly, setReachableOnly] = React.useState<boolean>(false);

  const slackMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("No session token available");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/scans/${scanId}/slack`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Failed to post Slack notification");
      return res.json();
    },
    onMutate: () => {
      return { toastId: toast.loading("Posting scan summary to Slack...") };
    },
    onSuccess: (data, variables, context) => {
      toast.success("Slack summary sent!", {
        id: context?.toastId,
        description: "Scan summary posted to Slack channel.",
      });
    },
    onError: (e: Error, variables, context) => {
      toast.error("Slack post failed", {
        id: context?.toastId,
        description: e.message,
      });
    }
  });

  const handleExportCSV = () => {
    const safeFindings = Array.isArray(findings) ? findings : [];
    if (safeFindings.length === 0) {
      toast.warning("No findings", {
        description: "There are no findings to export for this scan target.",
      });
      return;
    }
    const headers = ["Title", "Severity", "CVE ID", "Tool", "URL", "Description", "Fixed Version"];
    const rows = safeFindings.map(f => [
      f.title,
      f.severity,
      f.cve_id || "N/A",
      f.tool,
      f.url || "N/A",
      f.description || "N/A",
      f.scan_metadata?.fixed_version || "N/A"
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `scan_${scanId}_findings.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Export Successful", {
      description: "Vulnerability coordinates spreadsheet has been downloaded.",
    });
  };

  const handleExportPDF = () => {
    const originalTitle = document.title;
    
    // Clean scan target address to be filesystem-friendly
    const cleanTarget = scanTarget
      .replace(/^https?:\/\//, "")
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
      
    const now = new Date();
    const formattedDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const formattedTime = now.toTimeString().split(" ")[0].replace(/:/g, "-").slice(0, 5); // HH-MM
    
    // Dynamically set title to enforce PDF download naming convention
    document.title = `scan-report-${cleanTarget}-${formattedDate}-${formattedTime}`;
    window.print();
    
    // Restore original tab title immediately
    document.title = originalTitle;
  };

  // Sync selectedSeverity with columnFilters
  React.useEffect(() => {
    if (selectedSeverity === "all" || selectedSeverity === "kev" || selectedSeverity === "high-epss") {
      setColumnFilters([]);
    } else {
      setColumnFilters([{ id: "severity", value: selectedSeverity }]);
    }
  }, [selectedSeverity]);



  const filteredFindings = React.useMemo(() => {
    let safeFindings = Array.isArray(findings) ? findings : [];
    if (selectedSeverity === "kev") {
      safeFindings = safeFindings.filter((f) => f.kev_listed);
    } else if (selectedSeverity === "high-epss") {
      safeFindings = safeFindings.filter((f) => typeof f.epss_score === "number" && f.epss_score > 0.70);
    }

    if (reachableOnly) {
      safeFindings = safeFindings.filter((f) => f.tool === "trivy" && f.reachability === "reachable");
    }

    return safeFindings;
  }, [findings, selectedSeverity, reachableOnly]);

  // Table Columns Definition
  const columns = React.useMemo<ColumnDef<FindingData>[]>(
    () => [
      {
        accessorKey: "cve_id",
        header: "CVE",
        cell: ({ row }) => {
          const cve = row.original.cve_id;
          const isTrivy = row.original.tool === "trivy";
          const fixedVersion = row.original.scan_metadata?.fixed_version;
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              {cve ? (
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted/60 text-foreground border border-border/40">
                  {cve}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground/50 font-medium">—</span>
              )}
              {isTrivy && fixedVersion && (
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold whitespace-nowrap">
                  Fix: {fixedVersion}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "severity",
        header: "Severity",
        sortingFn: (rowA, rowB, columnId) => {
          const isDesc = sorting.find(s => s.id === columnId)?.desc ?? true;
          const kevA = rowA.original.kev_listed ? 1 : 0;
          const kevB = rowB.original.kev_listed ? 1 : 0;
          if (kevA !== kevB) {
            return isDesc ? (kevA - kevB) : (kevB - kevA);
          }
          const severityWeights: Record<string, number> = {
            critical: 4,
            high: 3,
            medium: 2,
            low: 1,
            info: 0,
          };
          const valA = rowA.getValue(columnId) as string;
          const valB = rowB.getValue(columnId) as string;
          const weightA = severityWeights[valA?.toLowerCase()] ?? -1;
          const weightB = severityWeights[valB?.toLowerCase()] ?? -1;
          return weightA - weightB;
        },
        cell: ({ row }) => {
          return (
            <div className="flex items-center gap-1.5">
              <SeverityBadge severity={row.original.severity} />
              {row.original.kev_listed && (
                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20 whitespace-nowrap">
                  EXPLOITED IN WILD
                </span>
              )}
              {row.original.exploit_validated && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 cursor-help">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Confirmed
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-semibold">Vulnerability confirmed reachable + exploitable via active probe</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "reachability",
        header: "Reachability",
        cell: ({ row }) => {
          const isTrivy = row.original.tool === "trivy";
          if (!isTrivy) return null;
          return <ReachabilityBadge status={row.original.reachability} />;
        }
      },
      {
        accessorKey: "cvss_score",
        header: "CVSS",
        sortingFn: (rowA, rowB, columnId) => {
          const isDesc = sorting.find(s => s.id === columnId)?.desc ?? true;
          const kevA = rowA.original.kev_listed ? 1 : 0;
          const kevB = rowB.original.kev_listed ? 1 : 0;
          if (kevA !== kevB) {
            return isDesc ? (kevA - kevB) : (kevB - kevA);
          }
          const scoreA = rowA.original.cvss_score ?? -1;
          const scoreB = rowB.original.cvss_score ?? -1;
          return scoreA - scoreB;
        },
        cell: ({ row }) => {
          const score = row.original.cvss_score;
          const vector = row.original.cvss_vector;
          const fallbackScore = row.original.severity === "critical" ? 9.0 : row.original.severity === "high" ? 7.5 : row.original.severity === "medium" ? 5.0 : row.original.severity === "low" ? 3.0 : 1.0;
          const displayScore = (score !== undefined && score !== null) ? score : fallbackScore;

          const content = (
            <span className={cn(
              "font-mono text-xs font-bold px-2 py-0.5 rounded border inline-flex items-center",
              displayScore >= 9.0
                ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                : displayScore >= 7.0
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                : displayScore >= 4.0
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
            )}>
              {displayScore.toFixed(1)}
            </span>
          );
          if (vector) {
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">{content}</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-popover border border-border/80 text-popover-foreground text-[10px] font-mono p-2 rounded shadow-md max-w-xs break-all">
                  <p className="font-semibold mb-1">CVSS Vector String:</p>
                  <p className="opacity-90">{vector}</p>
                </TooltipContent>
              </Tooltip>
            );
          }
          return content;
        }
      },
      {
        accessorKey: "epss_score",
        header: "EPSS",
        sortingFn: "alphanumeric",
        cell: ({ row }) => {
          const score = row.original.epss_score;
          const epss = (score !== undefined && score !== null) ? score : 0.0;
          return (
            <span className="font-mono text-xs font-medium text-foreground/90">
              {(epss * 100).toFixed(2)}%
            </span>
          );
        }
      },
      {
        accessorKey: "priority_score",
        header: "Priority Score",
        sortingFn: "alphanumeric",
        cell: ({ row }) => {
          const score = row.original.priority_score;
          if (score === undefined || score === null) {
            return <span className="text-xs text-muted-foreground/50 font-medium">—</span>;
          }
          return (
            <span className="font-mono text-xs font-bold text-foreground bg-primary/10 px-2 py-0.5 rounded border border-primary/25">
              {score.toFixed(3)}
            </span>
          );
        }
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => {
          const rank = row.original.priority_rank;
          const hasAiExplanation = Boolean(row.original.ai_plain_english && row.original.ai_plain_english.trim().length > 0);
          return (
            <div className="flex flex-col gap-0.5 max-w-[280px]">
              <div className="flex items-center gap-1.5">
                {typeof rank === "number" && rank > 0 && rank <= 10 && (
                  <Badge variant="destructive" className="px-1 py-0 text-[9px] font-extrabold h-4 whitespace-nowrap bg-red-600 dark:bg-red-700 text-white rounded">
                    #{rank}
                  </Badge>
                )}
                <span className="font-semibold text-sm text-foreground truncate" title={row.original.title}>
                  {row.original.title}
                </span>
                {hasAiExplanation && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors cursor-help shrink-0">
                        <Sparkles className="h-2.5 w-2.5 text-purple-500 animate-pulse" />
                        AI
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs p-2.5 text-xs bg-popover border border-purple-500/30 shadow-lg">
                      <div className="flex items-center gap-1 font-bold text-purple-600 dark:text-purple-400 mb-1">
                        <Sparkles className="h-3 w-3" />
                        Plain English Explanation
                      </div>
                      <p className="text-[11px] text-muted-foreground font-normal leading-relaxed line-clamp-4">
                        {row.original.ai_plain_english}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              {row.original.description && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[280px]" title={row.original.description}>
                  {row.original.description}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "url",
        header: "Asset Target",
        cell: ({ row }) => {
          const path = row.original.url || scanTarget;
          return (
            <div className="flex items-center gap-1 text-xs text-muted-foreground/80 font-medium truncate max-w-[180px]">
              <span className="truncate" title={path}>{path}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "tool",
        header: "Tool",
        cell: ({ row }) => {
          const toolName = row.original.tool;
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground/80 capitalize bg-muted/40 px-2 py-0.5 rounded border border-border/50">
              <Terminal className="h-3 w-3 opacity-60" />
              {toolName}
            </span>
          );
        },
      },
      {
        accessorKey: "created_at",
        header: "Discovered",
        cell: ({ row }) => {
          const date = new Date(row.original.created_at);
          return (
            <span className="text-xs text-muted-foreground font-medium">
              {date.toLocaleString()}
            </span>
          );
        },
      },
    ],
    [scanTarget]
  );

  // TanStack Table Instance
  const table = useReactTable({
    data: filteredFindings,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize: 15,
      },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg border border-border/50 w-fit select-none">
          {["all", "critical", "high", "medium", "low"].map((sev) => (
            <button
              key={sev}
              className="px-3 py-1 text-xs font-semibold rounded-md opacity-40 capitalize cursor-not-allowed text-muted-foreground"
              disabled
            >
              {sev}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto border rounded-lg border-border/40 bg-card/45 p-4 space-y-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="flex flex-col gap-2.5 pb-4 border-b border-border/30 last:border-0 last:pb-0">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-[120px]" />
                <Skeleton className="h-5 w-[80px]" />
              </div>
              <Skeleton className="h-4 w-[280px]" />
              <div className="flex gap-4">
                <Skeleton className="h-3.5 w-[150px] opacity-70" />
                <Skeleton className="h-3.5 w-[90px] opacity-70" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6 text-xs text-destructive font-semibold">
        Failed to fetch scan findings list from API.
      </div>
    );
  }

  if (findings.length === 0) {
    if (scanStatus === "running" || scanStatus === "queued") {
      return (
        <div className="text-center py-10 border border-dashed rounded-lg bg-muted/10 border-border/60 space-y-3">
          <div className="flex justify-center">
            <Loader2 className="h-7 w-7 text-primary animate-spin" />
          </div>
          <p className="text-sm font-semibold text-foreground">Scan in progress...</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Active security engines are scanning the target. Findings and threat intel will populate here automatically.
          </p>
        </div>
      );
    }

    if (scanStatus === "failed") {
      return (
        <div className="text-center py-10 border border-dashed rounded-lg bg-rose-500/5 border-rose-500/30 space-y-2">
          <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto" />
          <p className="text-sm font-semibold text-rose-400">Scan execution failed</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            The scan engine encountered an error. Check the live terminal logs above for execution details.
          </p>
        </div>
      );
    }

    return (
      <div className="text-center py-10 border border-dashed rounded-lg bg-emerald-500/5 border-emerald-500/20 space-y-2">
        <ShieldCheck className="h-8 w-8 text-emerald-500 mx-auto" />
        <p className="text-sm font-semibold text-emerald-400">Clean Scan — 0 Vulnerabilities Detected</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          No security threats or misconfigurations were found for this target.
        </p>
      </div>
    );
  }

  const severityFilters = ["all", "critical", "high", "medium", "low", "kev", "high-epss"];

  return (
    <div className="space-y-4">
      {/* Filter and Export buttons container */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        {/* Custom styled ToggleGroup (shadcn matching behavior) */}
        <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg border border-border/50 w-fit select-none">
          {severityFilters.map((sev) => (
            <button
              key={sev}
              onClick={() => setSelectedSeverity(sev)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all capitalize cursor-pointer ${
                selectedSeverity === sev
                  ? "bg-background text-foreground shadow-sm border border-border/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              {sev === "kev" ? "KEV Only" : sev === "high-epss" ? "High EPSS (>70%)" : sev}
            </button>
          ))}
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant={reachableOnly ? "secondary" : "outline"}
            size="sm"
            onClick={() => setReachableOnly(!reachableOnly)}
            className={cn(
              "h-8 text-xs font-semibold gap-1.5 border-border/80 cursor-pointer select-none",
              reachableOnly && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30"
            )}
          >
            <Shield className={cn("h-3.5 w-3.5", reachableOnly ? "text-emerald-600 dark:text-emerald-400 animate-pulse" : "text-muted-foreground")} />
            Reachable Only
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => slackMutation.mutate()}
            disabled={slackMutation.isPending}
            className="h-8 text-xs font-semibold gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer select-none"
          >
            {slackMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Post Slack Summary
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-semibold gap-1.5 border-border/80 hover:bg-muted/50"
              >
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card border border-border/80 shadow-lg rounded-md p-1">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-bold px-2 py-1.5">
                Toggle Columns
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1 bg-border/40" />
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize text-xs rounded-sm cursor-pointer py-1.5 px-2 text-foreground focus:bg-muted/60"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id === "cve_id"
                        ? "CVE"
                        : column.id === "cvss_score"
                        ? "CVSS Score"
                        : column.id === "created_at"
                        ? "Discovered"
                        : column.id === "url"
                        ? "Target URL"
                        : column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className="h-8 text-xs font-semibold gap-1.5 border-border/80 hover:bg-muted/50"
          >
            <FileText className="h-3.5 w-3.5 text-red-500" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 text-xs font-semibold gap-1.5 border-border/80 hover:bg-muted/50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="cursor-pointer select-none" onClick={header.column.getToggleSortingHandler()}>
                    <div className="flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      {header.column.getIsSorted() === "asc" && " 🔼"}
                      {header.column.getIsSorted() === "desc" && " 🔽"}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow 
                key={row.id}
                className="cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => onOpenFinding(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {filteredFindings.length > 0 && <DataTablePagination table={table} />}
    </div>
  );
}

const parseAiResponse = (text: string) => {
  if (!text) return { explanation: "", remediation: [] };

  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf("remediation");

  if (index !== -1) {
    const explanationPart = text.slice(0, index).replace(/^(explanation|plain english explanation|risk|impact):?\s*/i, "").trim();
    const remediationPartRaw = text.slice(index).replace(/^remediation\s*(steps|guidance)?:\s*/i, "").trim();

    const lines = remediationPartRaw
      .split(/\n+/)
      .map(line => line.replace(/^(\d+\.|-|\*)\s*/, "").trim())
      .filter(line => line.length > 0);

    return {
      explanation: explanationPart,
      remediation: lines.length > 0 ? lines : [remediationPartRaw]
    };
  }

  const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
  if (paragraphs.length > 1) {
    return {
      explanation: paragraphs[0],
      remediation: paragraphs.slice(1).map(p => p.replace(/^(\d+\.|-|\*)\s*/, "").trim())
    };
  }

  return {
    explanation: text,
    remediation: ["Verify the vulnerable library/host, check public advisory, and apply latest patches."]
  };
};

// Main Page Component
export default function ScanDetailPage({ params }: PageProps) {
  const { id } = React.use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const queryClient = useQueryClient();

  const [progressPct, setProgressPct] = React.useState<number>(0);
  const [currentStep, setCurrentStep] = React.useState<string>("");
  const [sseFailed, setSseFailed] = React.useState<boolean>(false);
  const [logs, setLogs] = React.useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = React.useState<boolean>(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = React.useState(false);
  const [selectedTemplate, setSelectedTemplate] = React.useState<"executive" | "technical">("executive");
  const [isExporting, setIsExporting] = React.useState(false);

  // Lifted Finding Details Panel State
  const [selectedFinding, setSelectedFinding] = React.useState<FindingData | null>(null);
  const [open, setOpen] = React.useState(false);

  // Jira Integration settings check
  const [jiraConfigured, setJiraConfigured] = React.useState(false);
  const [jiraBaseUrl, setJiraBaseUrl] = React.useState("");
  const [isJiraLoading, setIsJiraLoading] = React.useState(false);

  // GitHub Integration settings check
  const [githubConfigured, setGithubConfigured] = React.useState(false);
  const [isGithubLoading, setIsGithubLoading] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    fetch("/api/backend/admin/settings/jira", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data && data.base_url) {
          setJiraConfigured(true);
          setJiraBaseUrl(data.base_url);
        }
      })
      .catch((err) => console.error("Failed to check Jira settings in scan details", err));

    fetch("/api/backend/admin/settings/github", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data && data.is_configured) {
          setGithubConfigured(true);
        }
      })
      .catch((err) => console.error("Failed to check GitHub settings in scan details", err));
  }, [token]);

  const handleCreateJiraTicket = async () => {
    if (!selectedFinding || !token) return;
    setIsJiraLoading(true);
    const toastId = toast.loading("Creating Jira ticket...");
    try {
      const res = await fetch(`/api/backend/findings/${selectedFinding.id}/create-jira-ticket`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create ticket");
      
      toast.success(data.message || `Jira ticket created successfully: ${data.issue_key}`, { id: toastId });
      
      setSelectedFinding((prev) => prev ? { ...prev, jira_issue_key: data.issue_key } : null);
      
      queryClient.setQueryData(["scan-findings", id], (oldData: FindingData[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(f => f.id === selectedFinding.id ? { ...f, jira_issue_key: data.issue_key } : f);
      });
      
      queryClient.invalidateQueries({ queryKey: ["scan-findings", id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to create Jira ticket", { id: toastId });
    } finally {
      setIsJiraLoading(false);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Executive summary copied to clipboard");
  };

  const handleDownloadReport = async () => {
    if (!scan || !token) return;
    setDownloadDialogOpen(false);
    setIsExporting(true);
    const toastId = toast.loading("Generating report PDF. Please wait...");
    try {
      const res = await fetch(`/api/backend/scans/${id}/export?template=${selectedTemplate}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to generate report");
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `scan_${id}_${selectedTemplate}_report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success("Report downloaded successfully!", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Failed to download report", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreateFixPR = async () => {
    if (!selectedFinding || !token) return;
    setIsGithubLoading(true);
    const toastId = toast.loading("Opening Autofix Pull Request on GitHub...");
    try {
      const res = await fetch(`/api/backend/findings/${selectedFinding.id}/create-fix-pr`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create PR");
      
      toast.success(data.message || `Autofix PR #${data.pr_number} successfully opened on GitHub!`, { id: toastId });
      
      setSelectedFinding((prev) => prev ? { ...prev, pr_url: data.pr_url, pr_status: data.pr_status } : null);
      
      queryClient.setQueryData(["scan-findings", id], (oldData: FindingData[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(f => f.id === selectedFinding.id ? { ...f, pr_url: data.pr_url, pr_status: data.pr_status } : f);
      });
      
      queryClient.invalidateQueries({ queryKey: ["scan-findings", id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to create fix PR", { id: toastId });
    } finally {
      setIsGithubLoading(false);
    }
  };

  // Ask Security Agent Chat State
  const [chatOpen, setChatOpen] = React.useState(false);
  const [chatMessages, setChatMessages] = React.useState<Array<{ sender: "user" | "agent"; text: string; citations?: string[] }>>([]);
  const [chatInput, setChatInput] = React.useState("");
  const [chatStreaming, setChatStreaming] = React.useState(false);

  // Keyboard Shortcuts for Finding navigation & panel closure
  useHotkeys("j", () => {
    if (findings.length === 0) return;
    const currentIndex = selectedFinding ? findings.findIndex(f => f.id === selectedFinding.id) : -1;
    const nextIndex = (currentIndex + 1) % findings.length;
    setSelectedFinding(findings[nextIndex]);
    setOpen(true);
  }, { enableOnFormTags: false });

  useHotkeys("k", () => {
    if (findings.length === 0) return;
    const currentIndex = selectedFinding ? findings.findIndex(f => f.id === selectedFinding.id) : -1;
    const prevIndex = currentIndex <= 0 ? findings.length - 1 : currentIndex - 1;
    setSelectedFinding(findings[prevIndex]);
    setOpen(true);
  }, { enableOnFormTags: false });

  useHotkeys("esc", () => {
    setOpen(false);
    setSelectedFinding(null);
  }, { enableOnFormTags: false });

  // Fetch AI Enrichment data for the selected finding
  const {
    data: aiEnrichment,
    isLoading: isAiEnrichmentLoading,
    error: aiEnrichmentError,
  } = useQuery({
    queryKey: ["ai-enrichment", selectedFinding?.id],
    queryFn: async () => {
      if (!selectedFinding?.id || !token) return null;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/findings/${selectedFinding.id}/ai-enrichment`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch AI enrichment data");
      }
      return res.json();
    },
    enabled: !!selectedFinding?.id && !!token,
    staleTime: Infinity,
  });

  const handleRegenerateAi = async () => {
    if (!selectedFinding || !token) return;
    setIsAiLoading(true);
    const toastId = toast.loading("Regenerating AI Analysis...");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/findings/${selectedFinding.id}/regenerate-ai`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to regenerate AI analysis");
      }
      const updatedFinding = await res.json();
      
      setSelectedFinding(updatedFinding);
      
      queryClient.setQueryData(["scan-findings", id], (oldData: FindingData[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(f => f.id === updatedFinding.id ? updatedFinding : f);
      });

      // Also invalidate the query cache for ai-enrichment
      queryClient.invalidateQueries({ queryKey: ["ai-enrichment", selectedFinding.id] });
      
      toast.success("AI Analysis regenerated successfully via Ollama!", { id: toastId });
    } catch (err: any) {
      toast.error(`Regeneration failed: ${err.message || err}`, { id: toastId });
    } finally {
      setIsAiLoading(false);
    }
  };


  // 1. Fetch scan details from FastAPI backend first
  const { 
    data: scan, 
    isLoading, 
    error 
  } = useQuery<ScanData>({
    queryKey: ["scan", id],
    queryFn: async () => {
      if (!token) throw new Error("No token available");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/scans/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Scan not found");
      }
      return res.json();
    },
    enabled: !!token && !!id,
    // Poll scan state coordinates every 3 seconds if not complete
    refetchInterval: (query) => {
      const data = query.state.data as ScanData | undefined;
      return data && data.status !== "complete" && data.status !== "failed" ? 3000 : false;
    }
  });

  // 2. Fetch scan findings list from API at page level
  const { 
    data: findings = [], 
    isLoading: isFindingsLoading,
    error: findingsError
  } = useQuery<FindingData[]>({
    queryKey: ["scan-findings", id],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/scans/${id}/findings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch scan findings");
      }
      return res.json();
    },
    enabled: !!token && !!id,
    refetchInterval: () => {
      // Actively refresh findings while scan is in progress or queued
      const isScanActive = !scan || scan.status === "running" || scan.status === "queued" || (progressPct > 0 && progressPct < 100);
      return isScanActive ? 3000 : false;
    }
  });

  const top10Findings = React.useMemo(() => {
    const safeFindings = Array.isArray(findings) ? findings : [];
    return [...safeFindings]
      .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0))
      .slice(0, 10);
  }, [findings]);

  // Calculate severity counts directly from live findings array (fallback to scan?.findings_count)
  const computedCounts = React.useMemo(() => {
    if (Array.isArray(findings) && findings.length > 0) {
      const c = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      for (const f of findings) {
        const sev = (f.severity || "info").toLowerCase().trim();
        if (sev in c) {
          c[sev as keyof typeof c] += 1;
        }
      }
      return c;
    }
    return scan?.findings_count || { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  }, [findings, scan?.findings_count]);

  const handleSendChatMessage = async (overrideText?: string) => {
    const textToSend = overrideText || chatInput;
    if (!textToSend.trim() || !token || chatStreaming) return;

    // Append user message
    setChatMessages(prev => [...prev, { sender: "user", text: textToSend }]);
    setChatInput("");
    setChatStreaming(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/scans/${id}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ question: textToSend })
      });

      if (!response.body) {
        throw new Error("Unable to read streaming body response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let accumulatedCitations: string[] = [];

      // Append assistant loading placeholder
      setChatMessages(prev => [...prev, { sender: "agent", text: "", citations: [] }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.trim().startsWith("data: ")) {
            try {
              const dataStr = line.replace("data: ", "").trim();
              const parsed = JSON.parse(dataStr);
              if (parsed.chunk) {
                accumulatedText += parsed.chunk;
                setChatMessages(prev => {
                  const copy = [...prev];
                  copy[copy.length - 1] = {
                    sender: "agent",
                    text: accumulatedText,
                    citations: accumulatedCitations
                  };
                  return copy;
                });
              }
              if (parsed.citations) {
                accumulatedCitations = parsed.citations;
                setChatMessages(prev => {
                  const copy = [...prev];
                  copy[copy.length - 1] = {
                    sender: "agent",
                    text: accumulatedText,
                    citations: accumulatedCitations
                  };
                  return copy;
                });
              }
              if (parsed.error) {
                toast.error(parsed.error);
              }
            } catch (err) {
              console.error("SSE parse error", err);
            }
          }
        }
      }
    } catch (err: any) {
      toast.error(`Agent chat failed: ${err.message || err}`);
    } finally {
      setChatStreaming(false);
    }
  };

  const handleSelectSuggestedQuestion = (question: string) => {
    handleSendChatMessage(question);
  };

  React.useEffect(() => {
    if (error) {
      toast.error("Failed to load scan details", {
        description: error instanceof Error ? error.message : "We encountered an issue fetching this scan's metadata coordinates."
      });
    }
  }, [error]);

  React.useEffect(() => {
    if (findingsError) {
      toast.error("Failed to load findings", {
        description: findingsError instanceof Error ? findingsError.message : "We could not fetch the vulnerability findings for this target."
      });
    }
  }, [findingsError]);

  // EventSource SSE Connection for live progress stream
  React.useEffect(() => {
    if (!token || !id || sseFailed || !scan) return;

    if (scan.status === "complete" || scan.status === "failed") {
      setProgressPct(100);
      setCurrentStep(scan.status);
      return;
    }

    const progressUrl = `/api/scans/${id}/progress`;
    const es = new EventSource(progressUrl);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.progress_pct !== undefined) {
          setProgressPct(data.progress_pct);
        }
        if (data.current_step !== undefined) {
          setCurrentStep(data.current_step);
        }
        if (data.logs && data.logs.length > 0) {
          setLogs((prev) => [...prev, ...data.logs]);
        }
        if (data.status === "complete" || data.status === "failed" || data.progress_pct === 100) {
          queryClient.invalidateQueries({ queryKey: ["scan-findings", id] });
          queryClient.invalidateQueries({ queryKey: ["scan", id] });
          es.close();
        }
      } catch (err) {
        console.error("Error parsing progress SSE event:", err);
      }
    };

    es.onerror = () => {
      // EventSource connection closure is normal when scan finishes.
      // Quietly transition to polling fallback.
      setSseFailed(true);
      queryClient.invalidateQueries({ queryKey: ["scan-findings", id] });
      queryClient.invalidateQueries({ queryKey: ["scan", id] });
      es.close();
    };

    return () => {
      es.close();
    };
  }, [id, token, sseFailed, scan, queryClient]);

  // Sync state if scan finishes or if sse is failed and we poll
  React.useEffect(() => {
    if (scan) {
      if (scan.status === "complete") {
        setProgressPct(100);
        setCurrentStep("complete");
        queryClient.invalidateQueries({ queryKey: ["scan-findings", id] });
      } else if (scan.status === "failed") {
        setProgressPct(100);
        setCurrentStep("failed");
        queryClient.invalidateQueries({ queryKey: ["scan-findings", id] });
      } else if (sseFailed && scan.status === "running") {
        setProgressPct(50);
        setCurrentStep("running");
      }
    }
  }, [scan, sseFailed, id, queryClient]);

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Loading scan details...</p>
        </div>
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="p-6 md:p-8 space-y-6 max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
        <Card className="border-destructive/30 bg-destructive/5 text-center p-8">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-destructive mb-2">Failed to load Scan</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            We could not find the requested scan. It may have been deleted, or there might be an issue communicating with the backend.
          </p>
          <Button asChild>
            <Link href="/scans">Return to Scans List</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const date = new Date(scan.created_at);

  const critical = computedCounts.critical || 0;
  const high = computedCounts.high || 0;
  const medium = computedCounts.medium || 0;
  const low = computedCounts.low || 0;
  const info = computedCounts.info || 0;
  const totalFindings = critical + high + medium + low + info;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Back button and title */}
      <div className="flex flex-col gap-2">
        <Link href="/scans" className="no-print inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors gap-1.5 w-fit">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Scans
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Scan Coordinates</h1>
            <p className="text-xs font-mono text-muted-foreground/80 break-all">{scan.id}</p>
          </div>
          <div className="flex items-center gap-3 no-print">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold w-fit ${
                scan.status === "complete"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : scan.status === "running"
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 animate-pulse"
                  : scan.status === "failed"
                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${
                scan.status === "complete" ? "bg-emerald-500" :
                scan.status === "running" ? "bg-blue-500" :
                scan.status === "failed" ? "bg-destructive" : "bg-amber-500"
              }`} />
              <span className="capitalize">{scan.status}</span>
            </span>

            {scan.status === "complete" && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => setDownloadDialogOpen(true)}
                className="h-8 text-xs font-bold gap-1.5 cursor-pointer shadow-sm"
              >
                <FileText className="h-3.5 w-3.5" />
                Download Report
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Progress display bar if scan is running/pending */}
      {(scan.status === "running" || scan.status === "pending") && (
        <Card className="border-primary/20 bg-primary/5 p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center text-xs font-semibold text-foreground">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="capitalize">{currentStep || "Initializing scan..."}</span>
            </div>
            <span>{progressPct}%</span>
          </div>
          <Progress value={progressPct} />
        </Card>
      )}

      {/* Live Scanner Logs Console View */}
      {logs.length > 0 && (
        <Card className="border border-border/80 bg-zinc-950/95 text-zinc-300 font-mono shadow-xl overflow-hidden rounded-xl">
          <div className="flex justify-between items-center bg-zinc-900 px-4 py-2 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider ml-1">Live Scanner Console Logs</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-semibold">{logs.length} lines logged</span>
          </div>
          <CardContent className="p-4 bg-zinc-950">
            <div className="max-h-[220px] overflow-y-auto space-y-1 pr-2 flex flex-col-reverse text-left">
              {logs.slice().reverse().map((log, index) => {
                const isError = log.includes("[error]") || log.includes("[stderr]");
                const isSystem = log.includes("[system]");
                return (
                  <div
                    key={index}
                    className={cn(
                      "text-[10px] leading-normal break-all font-mono py-0.5 border-l-2 pl-2",
                      isError
                        ? "text-red-400 border-red-500 bg-red-500/5"
                        : isSystem
                        ? "text-blue-400 border-blue-500 bg-blue-500/5"
                        : "text-zinc-400 border-zinc-800 hover:bg-zinc-900/50"
                    )}
                  >
                    {log}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Core details card */}
        <Card className="md:col-span-2 border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base font-bold">Metadata Coordinates</CardTitle>
            <CardDescription className="text-xs">Configuration and backend run details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {/* Target URL */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md p-1.5 bg-muted/60 text-muted-foreground border border-border/40">
                <Globe className="h-4 w-4" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs text-muted-foreground/80 font-medium">Scan Target</span>
                <p className="text-sm font-semibold text-foreground break-all">{scan.target}</p>
              </div>
            </div>

            {/* Run Module Badge */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md p-1.5 bg-muted/60 text-muted-foreground border border-border/40">
                <Shield className="h-4 w-4" />
              </div>
              <div className="space-y-1 min-w-0">
                <span className="text-xs text-muted-foreground/80 font-medium">Enabled Scan Types</span>
                <div className="flex flex-wrap gap-1">
                  {scan.scan_types.map((type) => (
                    <span
                      key={type}
                      className="inline-flex text-[10px] font-semibold bg-primary/5 px-2 py-0.5 rounded text-primary capitalize border border-primary/10"
                    >
                      {type === "vuln" ? "vulnerabilities" : type === "opengrep" || type === "opengroup" ? "Opengrep SAST" : type}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Celery task identifier */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md p-1.5 bg-muted/60 text-muted-foreground border border-border/40">
                <Hash className="h-4 w-4" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs text-muted-foreground/80 font-medium">Celery Task ID</span>
                <p className="text-sm font-mono text-foreground break-all">
                  {scan.celery_task_id || <span className="text-xs text-muted-foreground italic font-sans">Not assigned</span>}
                </p>
              </div>
            </div>

            {/* Timestamp */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md p-1.5 bg-muted/60 text-muted-foreground border border-border/40">
                <Calendar className="h-4 w-4" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs text-muted-foreground/80 font-medium">Launched At</span>
                <p className="text-sm font-semibold text-foreground">{date.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Severity Metrics Card */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-sm flex flex-col justify-between">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base font-bold">Severity Summary</CardTitle>
            <CardDescription className="text-xs">Aggregated vulnerability findings count.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 flex-1 flex flex-col justify-center">
            {totalFindings === 0 && (scan.status === "running" || scan.status === "queued") ? (
              <div className="text-center space-y-2 py-4">
                <Activity className="h-8 w-8 text-muted-foreground/50 mx-auto animate-pulse" />
                <p className="text-xs text-muted-foreground/85 italic">
                  Vulnerability findings will populate once scanner modules complete.
                </p>
              </div>
            ) : totalFindings === 0 ? (
              <div className="text-center space-y-2 py-4">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">No vulnerabilities found</p>
                <p className="text-[10px] text-muted-foreground">Target is clean from threats.</p>
              </div>
            ) : (
              <div className="space-y-3 font-mono">
                {/* Critical */}
                <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-destructive font-semibold">
                    <span className="h-2 w-2 rounded-full bg-destructive" />
                    <span>Critical</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{critical}</span>
                </div>

                {/* High */}
                <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-amber-500 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span>High</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{high}</span>
                </div>

                {/* Medium */}
                <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-blue-500 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span>Medium</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{medium}</span>
                </div>

                {/* Low */}
                <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                    <span>Low</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{low}</span>
                </div>

                {/* Info (if present) */}
                {info > 0 && (
                  <div className="flex items-center justify-between pb-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-sky-400 font-semibold">
                      <span className="h-2 w-2 rounded-full bg-sky-400" />
                      <span>Info</span>
                    </div>
                    <span className="text-sm font-bold text-foreground">{info}</span>
                  </div>
                )}

                <div className="border-t border-border pt-3 flex items-center justify-between font-sans">
                  <span className="text-xs font-bold text-foreground">Total Findings</span>
                  <span className="text-base font-black text-foreground">{totalFindings}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CISO Executive Summary Card */}
      {scan.status === "complete" && scan.exec_summary && (
        <Card className="border border-border bg-card/60 backdrop-blur-sm shadow-sm text-left relative overflow-hidden p-6">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-purple-500" />
          <div className="flex items-center justify-between mb-3 pl-2">
            <h2 className="text-base font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              <span>CISO Executive Summary</span>
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopyText(scan.exec_summary || "")}
              className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
              title="Copy Summary"
              aria-label="Copy Summary"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-base leading-relaxed text-foreground/90 pl-2">
            {scan.exec_summary}
          </p>
        </Card>
      )}

      {/* Top 10 prioritized threats section */}
      {scan.status === "complete" && top10Findings.length > 0 && (
        <div className="space-y-3.5 no-print pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
              <span>Top 10 — Fix Immediately</span>
            </h2>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase bg-muted/65 border px-2 py-0.5 rounded">
              Prioritized by composite risk score
            </span>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {top10Findings.map((finding) => {
              const score = finding.priority_score ?? 0;
              const rank = finding.priority_rank ?? 0;
              return (
                <Card 
                  key={finding.id} 
                  onClick={() => {
                    setSelectedFinding(finding);
                    setOpen(true);
                  }}
                  className="group relative cursor-pointer border border-border/80 bg-card/45 hover:bg-muted/15 transition-all shadow-sm hover:shadow hover:border-red-500/30 overflow-hidden flex flex-col justify-between"
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-red-600" />
                  
                  <CardHeader className="p-4 pb-2.5 pl-6 flex flex-row items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="destructive" className="px-1.5 py-0 text-[10px] font-extrabold h-4.5 bg-red-600 text-white rounded">
                          #{rank || 1}
                        </Badge>
                        <SeverityBadge severity={finding.severity} />
                        <span className="font-mono text-[10px] font-bold bg-primary/10 px-1.5 py-0.5 rounded text-primary border border-primary/20">
                          Score: {score.toFixed(3)}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-foreground group-hover:text-red-500 transition-colors line-clamp-1" title={finding.title}>
                        {finding.title}
                      </h3>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 pl-6 space-y-2.5">
                    <p className="text-[11px] font-mono text-muted-foreground break-all line-clamp-1 bg-muted/40 px-2 py-0.5 rounded border border-border/40 w-fit">
                      {finding.url || scan.target}
                    </p>
                    <div className="text-[11px] text-muted-foreground/90 bg-muted/10 p-2.5 rounded border border-border/40 italic leading-relaxed">
                      {finding.ai_plain_english || "AI analysis in progress... Assessing the vulnerability and generating impact and remediation recommendations."}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Scan Execution Terminal Streamer */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <Terminal className="h-4 w-4 text-indigo-500" />
              Scan Engine Live Output Stream
            </h2>
            <p className="text-xs text-muted-foreground">
              Real-time terminal execution stdout/stderr stream from Nuclei, Semgrep, Trivy & Zap scanner containers.
            </p>
          </div>
        </div>
        <LiveTerminal
          scanId={scan.id}
          target={scan.target}
          scanTypes={scan.scan_types}
          status={scan.status}
        />
      </div>

      {/* Findings Table Section */}
      <Card className="border border-border/85 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base font-bold">Vulnerability Findings</CardTitle>
          <CardDescription className="text-xs">
            List of detected threats and configuration vectors found for this scan target.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <FindingsTable 
            scanId={scan.id} 
            scanStatus={scan.status} 
            scanTarget={scan.target} 
            onOpenFinding={(finding) => {
              setSelectedFinding(finding);
              setOpen(true);
            }}
            findings={findings}
            isLoading={isFindingsLoading}
            error={findingsError}
          />
        </CardContent>
      </Card>

      {/* FindingDetailPanel Sheet */}
      <Sheet open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setSelectedFinding(null);
        }
      }}>
        <SheetContent className="sm:max-w-[480px] flex flex-col gap-6 overflow-y-auto border-l border-border/80 bg-card/95 backdrop-blur-md shadow-2xl">
          <SheetHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-5 w-5 text-primary animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Finding details</span>
            </div>
            <SheetTitle className="text-xl font-bold tracking-tight text-foreground pr-6 leading-tight break-words">
              {selectedFinding?.title}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground/80 mt-1">
              Detailed vulnerability report and scan coordinates metadata.
            </SheetDescription>
            {selectedFinding?.cwe && selectedFinding.cwe.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {selectedFinding.cwe.map((cweId) => (
                  <Badge
                    key={cweId}
                    variant="outline"
                    className="text-[10px] font-bold bg-muted/65 text-primary border-border/80"
                  >
                    {cweId in CWE_NAMES ? `${cweId} - ${CWE_NAMES[cweId]}` : cweId}
                  </Badge>
                ))}
              </div>
            )}
          </SheetHeader>
          {selectedFinding && (
            <Tabs defaultValue="summary" className="w-full flex-1 flex flex-col min-h-0 overflow-hidden text-left">
              <TabsList className="grid grid-cols-4 bg-muted/40 border border-border/50 rounded-lg p-1 w-full select-none no-print">
                <TabsTrigger value="summary" className="text-[10px] font-bold py-1.5 uppercase cursor-pointer">Summary</TabsTrigger>
                <TabsTrigger value="remediation" className="text-[10px] font-bold py-1.5 uppercase cursor-pointer">Remediation</TabsTrigger>
                <TabsTrigger value="reachability" className="text-[10px] font-bold py-1.5 uppercase cursor-pointer">Reachability</TabsTrigger>
                <TabsTrigger value="raw" className="text-[10px] font-bold py-1.5 uppercase cursor-pointer">Raw</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-4 pb-6 scrollbar-thin text-xs">
                
                {/* 1. SUMMARY TAB */}
                <TabsContent value="summary" className="space-y-4 outline-none">
                  {/* Summary Section */}
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/85">Description</h4>
                    <div className="rounded-lg bg-muted/40 p-3 text-foreground border border-border/40 leading-relaxed break-words font-medium">
                      {selectedFinding.description || "No description provided."}
                    </div>
                  </div>

                  {/* Coordinates & Metadata list */}
                  <div className="space-y-3 pt-3 border-t border-border/30">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/85">Coordinates Details</h4>
                    
                    {/* CVSS v3 score / vector */}
                    {typeof selectedFinding.cvss_score === "number" && (
                      <div className="flex flex-col gap-1 py-1 border-b border-border/30 pb-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-muted-foreground">CVSS v3 Base Score</span>
                          <span className="font-bold text-xs bg-primary/10 px-2 py-0.5 rounded text-primary border border-primary/20">
                            {selectedFinding.cvss_score.toFixed(1)}
                          </span>
                        </div>
                        {selectedFinding.cvss_vector && (
                          <div className="text-[10px] text-muted-foreground break-all mt-1 bg-muted/20 p-2 rounded border border-border/30">
                            Vector: <span className="font-mono">{selectedFinding.cvss_vector}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* KEV Remediation Deadline */}
                    {selectedFinding.kev_listed && selectedFinding.kev_due_date && (
                      <div className="flex items-center justify-between py-1 border-b border-border/30 pb-2.5">
                        <span className="font-semibold text-red-500">CISA KEV Deadline</span>
                        <span className="text-red-600 dark:text-red-400 font-bold font-mono text-[10px] bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                          {selectedFinding.kev_due_date}
                        </span>
                      </div>
                    )}

                    {/* EPSS Score & Percentile */}
                    {typeof selectedFinding.epss_score === "number" && (
                      <div className="flex flex-col gap-1.5 py-1 border-b border-border/30 pb-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-muted-foreground">EPSS Probability</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-mono text-xs font-bold text-foreground/90 cursor-help border-b border-dashed border-border/80">
                                {(selectedFinding.epss_score * 100).toFixed(2)}%
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-[220px] bg-popover text-popover-foreground text-[10px] p-2 border border-border/85 shadow-md">
                              <p className="font-semibold">Probability this CVE is exploited in the wild in next 30 days</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        {typeof selectedFinding.epss_percentile === "number" && (
                          <div className="space-y-1 mt-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Percentile Rank</span>
                              <span>{(selectedFinding.epss_percentile * 100).toFixed(1)}%</span>
                            </div>
                            <Progress
                              value={selectedFinding.epss_percentile * 100}
                              indicatorClassName={
                                (selectedFinding.epss_percentile * 100) <= 30
                                  ? "bg-emerald-500"
                                  : (selectedFinding.epss_percentile * 100) <= 70
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                              }
                              className="h-1.5"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Asset Target */}
                    <div className="flex flex-col gap-1 py-1 border-b border-border/30 pb-2.5">
                      <span className="font-semibold text-muted-foreground">Asset Target</span>
                      <span className="font-mono text-[11px] text-foreground/90 font-medium break-all bg-muted/30 px-2 py-1 rounded border border-border/50">
                        {selectedFinding.url || scan.target}
                      </span>
                    </div>

                    {/* Tool Source */}
                    <div className="flex items-center justify-between py-1 border-b border-border/30 pb-2.5">
                      <span className="font-semibold text-muted-foreground">Tool Source</span>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-foreground/90 capitalize bg-muted/60 px-2.5 py-1 rounded border border-border/50">
                        <Terminal className="h-3 w-3 opacity-60" />
                        {selectedFinding.tool}
                      </span>
                    </div>

                    {/* Discovered Date */}
                    <div className="flex items-center justify-between py-1 border-b border-border/30 pb-2.5">
                      <span className="font-semibold text-muted-foreground">Discovered Date</span>
                      <span className="text-foreground/90 font-medium font-mono text-[11px]">
                        {new Date(selectedFinding.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Gitleaks specific details */}
                  {selectedFinding.tool === "gitleaks" && selectedFinding.metadata?.occurrences && (
                    <div className="space-y-2 pt-2 border-t border-border/30">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/85">Leaked Secret Occurrences</h4>
                      <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1">
                        {selectedFinding.metadata.occurrences.map((occ: any, idx: number) => (
                          <div key={idx} className="p-2.5 rounded-lg border border-border/60 bg-muted/20 text-[10px] leading-relaxed font-mono">
                            <div className="flex justify-between font-semibold">
                              <span className="text-primary truncate max-w-[200px]" title={occ.file}>{occ.file}</span>
                              <span className="text-muted-foreground">Line {occ.line}</span>
                            </div>
                            <div className="text-muted-foreground mt-0.5 truncate" title={occ.commit}>Commit: {occ.commit}</div>
                            {selectedFinding.metadata?.partial_secret && (
                              <div className="text-destructive font-semibold mt-1">Secret: {selectedFinding.metadata.partial_secret}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trivy specific details */}
                  {selectedFinding.tool === "trivy" && (
                    <div className="space-y-2 pt-2 border-t border-border/30">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/85">Package Vulnerability Details</h4>
                      <div className="grid gap-2.5 rounded-lg border border-border/60 bg-muted/20 p-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-muted-foreground font-semibold">Package Name</span>
                          <span className="font-mono text-foreground/90 font-semibold">
                            {selectedFinding.metadata?.pkg_name || selectedFinding.metadata?.package || "unknown"}
                          </span>
                        </div>
                        {selectedFinding.metadata?.installed_version && (
                          <div className="flex flex-col gap-0.5 pt-1 border-t border-border/30">
                            <span className="text-[10px] text-muted-foreground font-semibold">Installed Version</span>
                            <span className="font-mono text-foreground/90">
                              {selectedFinding.metadata?.installed_version}
                            </span>
                          </div>
                        )}
                        {selectedFinding.metadata?.fixed_version && (
                          <div className="flex flex-col gap-0.5 pt-1 border-t border-border/30">
                            <span className="text-[10px] text-muted-foreground font-semibold">Fixed Version</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                              {selectedFinding.metadata?.fixed_version}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* 2. REMEDIATION TAB */}
                <TabsContent value="remediation" className="space-y-4 outline-none">
                  {(() => {
                    const isAdmin = session?.user?.role === "admin";
                    const isCurrentlyLoading = isAiEnrichmentLoading || isAiLoading;

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-purple-500 animate-pulse" />
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/85">AI Summary</h4>
                          </div>
                          {isAdmin && (
                            <Button
                              variant="outline"
                              size="xs"
                              className="h-7 text-[10px] px-2.5 font-bold border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/5 text-purple-600 dark:text-purple-400 gap-1.5"
                              onClick={handleRegenerateAi}
                              disabled={isCurrentlyLoading}
                            >
                              {isCurrentlyLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                              Regenerate
                            </Button>
                          )}
                        </div>

                        {isCurrentlyLoading ? (
                          <div className="space-y-3">
                            <Skeleton className="h-3 w-full animate-pulse" />
                            <Skeleton className="h-3 w-5/6 animate-pulse" />
                            <Skeleton className="h-3 w-4/5 animate-pulse" />
                            <div className="pt-2 space-y-2">
                              <Skeleton className="h-3 w-2/5 animate-pulse" />
                              <Skeleton className="h-3 w-full animate-pulse" />
                              <Skeleton className="h-3 w-11/12 animate-pulse" />
                            </div>
                          </div>
                        ) : aiEnrichmentError ? (
                          <div className="text-[11px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                            Failed to load AI enrichment data: {(aiEnrichmentError as Error).message}
                          </div>
                        ) : aiEnrichment ? (
                          <div className="space-y-3 bg-purple-500/5 dark:bg-purple-950/10 border border-purple-500/10 rounded-xl p-3.5 leading-relaxed text-foreground/90">
                            {aiEnrichment.severity_override && (
                              <Alert variant="destructive" className="mb-3">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                  Severity escalated: {selectedFinding.severity.toUpperCase()} → {aiEnrichment.severity_override.toUpperCase()}{" "}
                                  {aiEnrichment.override_reason ? `(${aiEnrichment.override_reason})` : ""}
                                </AlertDescription>
                              </Alert>
                            )}

                            <div>
                              <h5 className="font-bold text-xs text-purple-600 dark:text-purple-400 mb-1">Plain English Explanation</h5>
                              <p className="prose prose-sm dark:prose-invert text-[11px] font-medium leading-relaxed">
                                {aiEnrichment.plain_english}
                              </p>
                            </div>

                            <div className="border-t border-purple-500/10 pt-2.5">
                              <h5 className="font-bold text-xs text-purple-600 dark:text-purple-400 mb-1">Remediation Steps</h5>
                              {aiEnrichment.remediation && aiEnrichment.remediation.length > 0 ? (
                                <div className="space-y-3 text-[11px]">
                                  {(() => {
                                    const patchDiff = aiEnrichment.remediation.find((step: string) => step.startsWith("Recommended Patch Diff:\n"));
                                    const stepsOnly = aiEnrichment.remediation.filter((step: string) => !step.startsWith("Recommended Patch Diff:\n"));
                                    
                                    return (
                                      <>
                                        {stepsOnly.length > 0 && (
                                          <ol className="list-decimal list-inside space-y-1 font-medium pl-0.5">
                                            {stepsOnly.map((step: string, idx: number) => (
                                              <li key={idx} className="leading-relaxed pl-1">
                                                {step}
                                              </li>
                                            ))}
                                          </ol>
                                        )}
                                        {patchDiff && (
                                          <div className="space-y-1.5 pt-2 border-t border-border/20">
                                            <span className="text-[9px] uppercase font-bold text-muted-foreground block">AI Recommended Code Patch Diff:</span>
                                            <pre className="bg-zinc-950 text-slate-200 p-3 rounded-lg border border-zinc-800 font-mono text-[9.5px] overflow-x-auto whitespace-pre leading-tight shadow-inner select-all">
                                              {patchDiff.replace("Recommended Patch Diff:\n", "")}
                                            </pre>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              ) : (
                                <p className="text-[11px] font-medium text-muted-foreground">No remediation steps generated.</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-muted-foreground bg-muted/40 border border-border/40 rounded-xl p-3.5 leading-relaxed">
                            AI analysis is pending. Click "Regenerate" to run local analysis of this threat.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </TabsContent>

                {/* 3. REACHABILITY TAB */}
                <TabsContent value="reachability" className="space-y-4 outline-none">
                  {selectedFinding.tool === "trivy" ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5">
                        <Shield className="h-4 w-4 text-emerald-500" />
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/85">Reachability Analysis</h4>
                      </div>
                      
                      <div className="flex items-center gap-2 bg-muted/20 border border-border/40 rounded-lg p-2.5">
                        <span className="text-[11px] text-muted-foreground font-semibold">Status:</span>
                        <ReachabilityBadge status={selectedFinding.reachability} />
                      </div>

                      {selectedFinding.reachability_reason && (
                        <div className="space-y-3 font-sans text-xs text-foreground/80 leading-relaxed pt-2">
                          <div>
                            <span className="font-semibold text-foreground/90 block mb-1">Reasoning:</span>
                            <p className="bg-muted/30 border border-border/40 rounded-lg p-2.5 leading-relaxed text-[11px]">
                              {selectedFinding.reachability_reason}
                            </p>
                          </div>
                          
                          {/* Call-site snippet */}
                          {(() => {
                            let snippetStr = "";
                            try {
                              const raw = selectedFinding.raw_output ? JSON.parse(selectedFinding.raw_output) : null;
                              if (raw && Array.isArray(raw.call_sites) && raw.call_sites.length > 0) {
                                snippetStr = raw.call_sites.map((cs: any, idx: number) => (
                                  `Call Site #${idx+1} in ${cs.file} (Line ${cs.line}):\n${cs.code}`
                                )) .join("\n\n");
                              }
                            } catch {}
                            
                            if (!snippetStr && selectedFinding.metadata?.occurrences) {
                              snippetStr = selectedFinding.metadata.occurrences.map((occ: any, idx: number) => (
                                `Occurrence #${idx+1} in ${occ.file} (Line ${occ.line})`
                              )).join("\n");
                            }

                            if (snippetStr) {
                              return (
                                <div className="space-y-1">
                                  <span className="font-semibold text-foreground/90 block">Call Stack Snippet:</span>
                                  <pre className="p-3 bg-zinc-950 text-slate-200 border border-zinc-800 rounded-lg font-mono text-[9px] whitespace-pre overflow-x-auto select-all leading-tight shadow-inner">
                                    {snippetStr}
                                  </pre>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground italic bg-muted/10 rounded-lg border border-dashed border-border/50">
                      Reachability AST scans are only performed for Trivy Package dependencies.
                    </div>
                  )}
                </TabsContent>

                {/* 4. RAW TAB */}
                <TabsContent value="raw" className="space-y-4 outline-none">
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/85">Raw Scan Tool Output</h4>
                    <pre className="text-[9.5px] leading-relaxed text-muted-foreground/90 bg-zinc-950 border border-zinc-800 p-3.5 rounded-lg font-mono break-all whitespace-pre-wrap select-all shadow-inner max-h-[450px] overflow-y-auto">
                      {selectedFinding.raw_output || "{}"}
                    </pre>
                  </div>
                </TabsContent>

              </div>
            </Tabs>
          )}

          {/* Footer Action buttons: Jira and GitHub Autofix Integrations */}
          {selectedFinding && (
            <div className="border-t border-border/40 pt-4 flex flex-col gap-3 no-print bg-card mt-auto pb-2 text-left">
              {/* Connection Status Row */}
              <div className="grid grid-cols-2 gap-4 text-[11px] text-muted-foreground border-b border-border/40 pb-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-foreground/80">Jira Integration</span>
                  {selectedFinding.jira_issue_key ? (
                    <a 
                      href={`${jiraBaseUrl}/browse/${selectedFinding.jira_issue_key}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-500 font-bold hover:underline"
                    >
                      Jira: {selectedFinding.jira_issue_key}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="italic opacity-60">Not Linked</span>
                  )}
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-foreground/80">GitHub Pull Request</span>
                  {selectedFinding.pr_url ? (
                    <div className="flex items-center gap-1.5">
                      <a 
                        href={selectedFinding.pr_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-500 font-bold hover:underline"
                      >
                        PR #{selectedFinding.pr_url.split("/").pop()}
                        <GitPullRequest className="h-3 w-3" />
                      </a>
                      <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded capitalize ${
                        selectedFinding.pr_status === "merged" 
                          ? "bg-purple-500/10 text-purple-600 border border-purple-500/20" 
                          : selectedFinding.pr_status === "closed"
                          ? "bg-destructive/10 text-destructive border border-destructive/20"
                          : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      }`}>
                        {selectedFinding.pr_status || "open"}
                      </span>
                    </div>
                  ) : (
                    <span className="italic opacity-60">Not Connected</span>
                  )}
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="grid grid-cols-2 gap-3.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold justify-center gap-1.5 cursor-pointer h-9"
                  disabled={!jiraConfigured || !!selectedFinding.jira_issue_key || isJiraLoading}
                  onClick={handleCreateJiraTicket}
                >
                  {isJiraLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {selectedFinding.jira_issue_key ? "Jira Linked" : "Create Jira"}
                </Button>

                {(() => {
                  const isAutofixable = selectedFinding.tool === "gitleaks" || selectedFinding.tool === "trivy";
                  const isPrimaryAutofix = isAutofixable && 
                    (selectedFinding.tool === "gitleaks" || !!(selectedFinding.scan_metadata?.package_name || selectedFinding.scan_metadata?.file));
                  
                  const btnVariant = isPrimaryAutofix && !selectedFinding.pr_url ? "default" : "outline";

                  const disabledReason = !isAutofixable 
                    ? "Autofix is not supported for dynamic web app scans." 
                    : !githubConfigured 
                    ? "GitHub integration is not configured. Setup under Settings." 
                    : !!selectedFinding.pr_url 
                    ? "Autofix PR is already opened."
                    : "";

                  const btnContent = (
                    <Button
                      variant={btnVariant}
                      size="sm"
                      className="w-full text-xs font-semibold justify-center gap-1.5 cursor-pointer h-9"
                      disabled={!!disabledReason || isGithubLoading}
                      onClick={handleCreateFixPR}
                    >
                      {isGithubLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <GitPullRequest className="h-3.5 w-3.5" />
                      )}
                      {selectedFinding.pr_url ? "PR Opened" : "Create Fix PR"}
                    </Button>
                  );

                  if (disabledReason) {
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-full">{btnContent}</div>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px] max-w-[200px] text-left leading-normal">
                          {disabledReason}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return btnContent;
                })()}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Floating Action Button for AskAgent */}
      <div className="fixed bottom-6 right-6 z-50 no-print">
        <Button
          onClick={() => setChatOpen(true)}
          title="Ask Security Agent"
          aria-label="Ask Security Agent"
          className="h-12 w-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200"
        >
          <MessageCircleQuestion className="h-6 w-6" />
        </Button>
      </div>

      {/* AskAgent Chat Sheet Workspace */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent side="right" className="w-[90vw] sm:w-[500px] border-l border-border bg-card p-0 flex flex-col h-full shadow-2xl">
          {/* Header */}
          <div className="p-4 border-b border-border bg-muted/20">
            <SheetHeader>
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Agent Intelligence</span>
              </div>
              <SheetTitle className="text-base font-bold text-foreground">
                Security Agent Workspace
              </SheetTitle>
              <SheetDescription className="text-[10.5px] text-muted-foreground leading-normal mt-0.5">
                Ask questions about vulnerability details, prioritization logic, or sprint remediation strategies.
              </SheetDescription>
            </SheetHeader>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3.5 select-none">
                <div className="rounded-full bg-indigo-500/10 p-3.5 border border-indigo-500/20 text-indigo-500 animate-bounce">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-foreground/90">Interactive Security Copilot</h4>
                  <p className="text-[10.5px] text-muted-foreground max-w-xs mt-1">
                    Ask me about reachability, patch consolidations, or critical CVE vectors.
                  </p>
                </div>
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex flex-col space-y-1.5 max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed",
                    msg.sender === "user"
                      ? "bg-indigo-600 text-white ml-auto rounded-tr-none shadow-md"
                      : "bg-muted/50 text-foreground border border-border/80 mr-auto rounded-tl-none"
                  )}
                >
                  <div className="whitespace-pre-wrap font-medium">{msg.text || (chatStreaming && idx === chatMessages.length - 1 ? "Thinking..." : "")}</div>
                  
                  {/* Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-border/20 flex flex-wrap items-center gap-1.5">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground">Cited Findings:</span>
                      {msg.citations.map((cid) => {
                        const targetF = findings.find(f => f.id === cid);
                        return (
                          <Badge
                            key={cid}
                            variant="outline"
                            onClick={() => {
                              setSelectedFinding(targetF || { id: cid, scan_id: id, title: "Cited Vulnerability", severity: "high", cve_id: "Details", tool: "unknown", url: null, description: null, created_at: new Date().toISOString() });
                              setOpen(true);
                            }}
                            className="bg-background/85 border-border/80 text-[8.5px] font-mono hover:bg-primary/5 cursor-pointer uppercase font-extrabold px-1.5 py-0"
                          >
                            {targetF?.cve_id || "VULN"}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Suggested Questions */}
          {chatMessages.length === 0 && (
            <div className="p-4 border-t border-border/40 bg-muted/10 space-y-2">
              <span className="text-[9px] uppercase font-bold text-muted-foreground block">Suggested Queries:</span>
              <div className="flex flex-col gap-1.5">
                {[
                  "What should I fix this sprint?",
                  "What changed since last scan?",
                  "Why is the highest CVSS score vulnerability critical?"
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSelectSuggestedQuestion(q)}
                    className="text-left text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-500/5 hover:bg-indigo-500/10 p-2.5 rounded-lg border border-indigo-500/20 cursor-pointer transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Box */}
          <div className="p-4 border-t border-border bg-muted/20">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChatMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder={chatStreaming ? "Agent is typing..." : "Ask a question about scan target..."}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={chatStreaming}
                className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
              <Button
                type="submit"
                disabled={chatStreaming || !chatInput.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-9 px-3.5 cursor-pointer disabled:opacity-40"
              >
                Send
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Export Scan Report</DialogTitle>
            <DialogDescription>
              Select the report template type to download as a formatted PDF document.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="template-select" className="text-xs font-bold text-muted-foreground uppercase">
                Report Template
              </label>
              <select
                id="template-select"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value as "executive" | "technical")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                <option value="executive">Executive Summary Report (Cover, AI Summaries, Top 10)</option>
                <option value="technical">Technical Ledger Report (Cover, AI Summaries, Top 10, Full Findings Registry)</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDownloadDialogOpen(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDownloadReport}
              disabled={isExporting}
              className="gap-1.5"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5" />
                  Download PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
