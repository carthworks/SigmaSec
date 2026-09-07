"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { 
  FileText, 
  Download, 
  Calendar, 
  Filter, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight, 
  RefreshCw, 
  XCircle,
  FileSpreadsheet,
  FileJson,
  Printer,
  ChevronRight,
  TrendingDown,
  Info,
  ShieldAlert
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
} from "@tanstack/react-table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

interface Finding {
  id: string;
  org_id: string;
  scan_id: string;
  asset_id: string | null;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  cve_id: string | null;
  tool: string;
  cvss_score: number | null;
  cvss_vector: string | null;
  cwe?: string[] | null;
  epss_score: number | null;
  epss_percentile?: number | null;
  kev_listed: boolean;
  priority_score: number | null;
  priority_rank: number | null;
  ai_plain_english: string | null;
  reachability: "reachable" | "unreachable" | "uncertain" | null;
  exploit_validated: boolean;
  jira_issue_key: string | null;
  pr_url: string | null;
  fp_candidate: boolean;
  status: "new" | "investigating" | "in_progress" | "fixed" | "accepted_risk" | "false_positive" | null;
  raw_output: string | null;
  tags: string[];
}

interface Asset {
  id: string;
  org_id: string;
  name: string;
  target: string;
  asset_type: "url" | "docker_image" | "git_repo";
  asset_weight: number;
  owner_email: string | null;
  last_scan: string | null;
  findings_count: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  } | null;
}

interface GeneratedReport {
  id: string;
  timestamp: string;
  template: "executive" | "technical" | "compliance";
  format: "pdf" | "csv" | "json";
  scope: string;
  size: string;
  status: "Ready";
  filters: {
    assetScope: string;
    severity: string;
    tool: string;
    onlyKev: boolean;
    onlyExploited: boolean;
  };
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  // Form Configurations
  const [selectedTemplate, setSelectedTemplate] = React.useState<"executive" | "technical" | "compliance">("executive");
  const [selectedFormat, setSelectedFormat] = React.useState<"pdf" | "csv" | "json">("pdf");
  const [selectedAssetScope, setSelectedAssetScope] = React.useState<string>("all");
  const [selectedSeverity, setSelectedSeverity] = React.useState<string>("all");
  const [selectedTool, setSelectedTool] = React.useState<string>("all");
  const [onlyKev, setOnlyKev] = React.useState<boolean>(false);
  const [onlyExploited, setOnlyExploited] = React.useState<boolean>(false);

  // Download History
  const [history, setHistory] = React.useState<GeneratedReport[]>([]);
  const [reportId, setReportId] = React.useState<number>(1000);
  const [mounted, setMounted] = React.useState<boolean>(false);

  React.useEffect(() => {
    setMounted(true);
    setReportId(Math.floor(1000 + Math.random() * 9000));
    const saved = localStorage.getItem("sigmasec_report_history") || localStorage.getItem("cybersigma_report_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load report history", e);
      }
    } else {
      const defaultHistory: GeneratedReport[] = [
        {
          id: "rep-001",
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          template: "executive",
          format: "pdf",
          scope: "All Targets",
          size: "1.2 MB",
          status: "Ready",
          filters: {
            assetScope: "all",
            severity: "all",
            tool: "all",
            onlyKev: false,
            onlyExploited: false
          }
        },
        {
          id: "rep-002",
          timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          template: "technical",
          format: "csv",
          scope: "nginx:1.24",
          size: "45 KB",
          status: "Ready",
          filters: {
            assetScope: "all", // maps to nginx test finding images
            severity: "all",
            tool: "trivy",
            onlyKev: false,
            onlyExploited: false
          }
        }
      ];
      setHistory(defaultHistory);
      localStorage.setItem("sigmasec_report_history", JSON.stringify(defaultHistory));
    }
  }, []);

  // Fetch all findings
  const { data: findings = [], isLoading: findingsLoading } = useQuery<Finding[]>({
    queryKey: ["findings"],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/findings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch findings");
      return res.json();
    },
    enabled: !!token,
  });

  // Fetch all assets
  const { data: assets = [], isLoading: assetsLoading } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/assets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch assets");
      return res.json();
    },
    enabled: !!token,
  });

  // Filter findings based on selected configurations
  const filteredFindings = React.useMemo(() => {
    return findings.filter((finding) => {
      // 1. Asset Scope Filter
      if (selectedAssetScope !== "all" && finding.asset_id !== selectedAssetScope) {
        return false;
      }
      // 2. Severity Filter
      if (selectedSeverity !== "all" && finding.severity !== selectedSeverity) {
        return false;
      }
      // 3. Tool Filter
      if (selectedTool !== "all" && finding.tool.toLowerCase() !== selectedTool.toLowerCase()) {
        return false;
      }
      // 4. KEV list filter
      if (onlyKev && !finding.kev_listed) {
        return false;
      }
      // 5. Confirmed Exploit filter
      if (onlyExploited && !finding.exploit_validated) {
        return false;
      }
      return true;
    });
  }, [findings, selectedAssetScope, selectedSeverity, selectedTool, onlyKev, onlyExploited]);

  // Derived Stats
  const stats = React.useMemo(() => {
    const total = filteredFindings.length;
    const critical = filteredFindings.filter(f => f.severity === "critical").length;
    const high = filteredFindings.filter(f => f.severity === "high").length;
    const medium = filteredFindings.filter(f => f.severity === "medium").length;
    const low = filteredFindings.filter(f => f.severity === "low").length;
    const exploited = filteredFindings.filter(f => f.exploit_validated).length;
    const kev = filteredFindings.filter(f => f.kev_listed).length;

    // Calculate dynamic security posture score (0 - 100)
    // Formula: 100 - weighted sum of findings, capped at 0.
    // Weights: Critical = 15, High = 8, Medium = 3, Low = 1, Exploit verified adds +5 weight.
    const weightedDeduction = (critical * 15) + (high * 8) + (medium * 3) + (low * 1) + (exploited * 5);
    const postureScore = Math.max(0, 100 - weightedDeduction);

    return { total, critical, high, medium, low, exploited, kev, postureScore };
  }, [filteredFindings]);

  const historyColumns = React.useMemo<ColumnDef<GeneratedReport>[]>(
    () => [
      {
        accessorKey: "timestamp",
        header: "Date Generated",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground font-mono">
            {new Date(row.original.timestamp).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "template",
        header: "Report Template",
        cell: ({ row }) => (
          <span className="text-xs font-medium capitalize">
            {row.original.template} Report
          </span>
        ),
      },
      {
        accessorKey: "format",
        header: "Format",
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[10px] font-bold uppercase rounded">
            {row.original.format}
          </Badge>
        ),
      },
      {
        accessorKey: "scope",
        header: "Scope",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.scope}</span>
        ),
      },
      {
        accessorKey: "size",
        header: "File Size",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground font-mono">{row.original.size}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold text-[11px]">
            <CheckCircle className="h-3 w-3" />
            {row.original.status}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Action</div>,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="text-right">
              <Button
                size="xs"
                variant="ghost"
                className="h-7 text-xs gap-1 cursor-pointer"
                onClick={() => handleDownloadHistoryItem(item)}
              >
                <Download className="h-3 w-3" />
                Download
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  const historyTable = useReactTable({
    data: history,
    columns: historyColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  // Mock export size helper
  const calculateMockSize = (count: number, format: "pdf" | "csv" | "json") => {
    if (format === "csv") return `${Math.max(1, Math.round(count * 0.4))} KB`;
    if (format === "json") return `${Math.max(2, Math.round(count * 0.9))} KB`;
    return `${(1.1 + count * 0.05).toFixed(1)} MB`;
  };

  const triggerDownload = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleGenerateReport = () => {
    if (filteredFindings.length === 0) {
      toast.warning("No Vulnerabilities Found", {
        description: "The current filter combination yields zero vulnerabilities. Cannot generate empty report.",
      });
      return;
    }

    const scopeName = selectedAssetScope === "all" 
      ? "All Targets" 
      : (assets.find(a => a.id === selectedAssetScope)?.name || "Selected Target");
    const timestamp = new Date().toISOString();
    const mockSize = calculateMockSize(filteredFindings.length, selectedFormat);

    // If PDF, trigger standard browser print dialog
    if (selectedFormat === "pdf") {
      const originalTitle = document.title;
      const formattedDate = new Date().toISOString().split("T")[0];
      document.title = `${selectedTemplate}-report-${scopeName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-${formattedDate}`;
      
      toast.info("Preparing Print View", {
        description: "Standard PDF output renders through your system print menu. Please choose 'Save as PDF' option.",
      });
      
      setTimeout(() => {
        window.print();
        document.title = originalTitle;
      }, 500);

    } else if (selectedFormat === "csv") {
      // Build CSV
      const headers = ["ID", "Title", "Severity", "CVE ID", "Tool", "EPSS Score", "Kev Listed", "Exploit Confirmed", "Status"];
      const rows = filteredFindings.map(f => [
        f.id,
        f.title,
        f.severity,
        f.cve_id || "N/A",
        f.tool,
        f.epss_score !== null ? f.epss_score.toString() : "N/A",
        f.kev_listed ? "Yes" : "No",
        f.exploit_validated ? "Yes" : "No",
        f.status || "new"
      ]);
      const csvContent = [headers.join(","), ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))].join("\n");
      triggerDownload(`report_${Date.now()}.csv`, csvContent, "text/csv;charset=utf-8;");
      toast.success("CSV Export Initiated", {
        description: `Spreadsheet exported with ${filteredFindings.length} vulnerability records.`,
      });

    } else if (selectedFormat === "json") {
      // Build JSON
      const jsonContent = JSON.stringify({
        generated_at: timestamp,
        template: selectedTemplate,
        scope: scopeName,
        filters: {
          severity: selectedSeverity,
          tool: selectedTool,
          only_kev: onlyKev,
          only_exploited: onlyExploited
        },
        summary: {
          total_findings: stats.total,
          critical: stats.critical,
          high: stats.high,
          medium: stats.medium,
          low: stats.low,
          posture_score: stats.postureScore
        },
        findings: filteredFindings
      }, null, 2);
      triggerDownload(`report_${Date.now()}.json`, jsonContent, "application/json");
      toast.success("JSON Export Initiated", {
        description: `Raw data exported with ${filteredFindings.length} vulnerability records.`,
      });
    }

    // Save to History
    const newReport: GeneratedReport = {
      id: `rep-${Math.floor(100 + Math.random() * 900)}`,
      timestamp,
      template: selectedTemplate,
      format: selectedFormat,
      scope: scopeName,
      size: mockSize,
      status: "Ready",
      filters: {
        assetScope: selectedAssetScope,
        severity: selectedSeverity,
        tool: selectedTool,
        onlyKev,
        onlyExploited
      }
    };

    const updatedHistory = [newReport, ...history];
    setHistory(updatedHistory);
    localStorage.setItem("sigmasec_report_history", JSON.stringify(updatedHistory));
  };

  const handleDownloadHistoryItem = (item: GeneratedReport) => {
    // Determine findings matching the history item's filters
    const itemFindings = findings.filter((finding) => {
      if (item.filters.assetScope !== "all" && finding.asset_id !== item.filters.assetScope) {
        return false;
      }
      if (item.filters.severity !== "all" && finding.severity !== item.filters.severity) {
        return false;
      }
      if (item.filters.tool !== "all" && finding.tool.toLowerCase() !== item.filters.tool.toLowerCase()) {
        return false;
      }
      if (item.filters.onlyKev && !finding.kev_listed) {
        return false;
      }
      if (item.filters.onlyExploited && !finding.exploit_validated) {
        return false;
      }
      return true;
    });

    if (itemFindings.length === 0) {
      toast.warning("No Vulnerabilities Found", {
        description: "The historical filters no longer match any active vulnerabilities in the database.",
      });
      return;
    }

    if (item.format === "pdf") {
      // Set the active UI states to match the history item's filters so the preview updates
      setSelectedTemplate(item.template);
      setSelectedAssetScope(item.filters.assetScope);
      setSelectedSeverity(item.filters.severity);
      setSelectedTool(item.filters.tool);
      setOnlyKev(item.filters.onlyKev);
      setOnlyExploited(item.filters.onlyExploited);

      // Trigger standard browser print dialog
      const originalTitle = document.title;
      const formattedDate = new Date(item.timestamp).toISOString().split("T")[0];
      document.title = `${item.template}-report-${item.scope.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-${formattedDate}`;
      
      toast.info("Preparing Print View", {
        description: "Standard PDF output renders through your system print menu. Please choose 'Save as PDF' option.",
      });
      
      setTimeout(() => {
        window.print();
        document.title = originalTitle;
      }, 500);

    } else if (item.format === "csv") {
      // Build CSV
      const headers = ["ID", "Title", "Severity", "CVE ID", "Tool", "EPSS Score", "Kev Listed", "Exploit Confirmed", "Status"];
      const rows = itemFindings.map(f => [
        f.id,
        f.title,
        f.severity,
        f.cve_id || "N/A",
        f.tool,
        f.epss_score !== null ? f.epss_score.toString() : "N/A",
        f.kev_listed ? "Yes" : "No",
        f.exploit_validated ? "Yes" : "No",
        f.status || "new"
      ]);
      const csvContent = [headers.join(","), ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))].join("\n");
      triggerDownload(`report_${item.id}.csv`, csvContent, "text/csv;charset=utf-8;");
      toast.success("CSV Export Initiated", {
        description: `Spreadsheet exported with ${itemFindings.length} vulnerability records.`,
      });

    } else if (item.format === "json") {
      // Build JSON
      const jsonContent = JSON.stringify({
        generated_at: item.timestamp,
        template: item.template,
        scope: item.scope,
        filters: item.filters,
        findings: itemFindings
      }, null, 2);
      triggerDownload(`report_${item.id}.json`, jsonContent, "application/json");
      toast.success("JSON Export Initiated", {
        description: `Raw data exported with ${itemFindings.length} vulnerability records.`,
      });
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case "critical": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "high": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "medium": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "low": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 50) return "text-amber-500";
    return "text-destructive";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-emerald-500/10 border-emerald-500/20";
    if (score >= 50) return "bg-amber-500/10 border-amber-500/20";
    return "bg-destructive/10 border-destructive/20";
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto print:p-0">
      {/* Header (Hidden on Print) */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Security Reports
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Export executive summaries, technical ledgers, and compliance readiness mappings in multiple formats.
          </p>
        </div>
      </div>

      {/* Metrics Row (Hidden on Print) */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 print:hidden">
        <Card className="border border-border/80 bg-card/60">
          <CardHeader className="p-4 pb-1.5">
            <CardDescription className="text-[10px] font-semibold uppercase tracking-wider">Posture Score</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className={`text-2xl font-black ${getScoreColor(stats.postureScore)}`}>
              {stats.postureScore.toFixed(0)}
              <span className="text-xs text-muted-foreground font-normal ml-0.5">/100</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card/60">
          <CardHeader className="p-4 pb-1.5">
            <CardDescription className="text-[10px] font-semibold uppercase tracking-wider">Filtered Vulnerabilities</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-foreground">
              {stats.total}
              {findingsLoading && <RefreshCw className="h-4 w-4 animate-spin inline ml-2 text-muted-foreground" />}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card/60">
          <CardHeader className="p-4 pb-1.5">
            <CardDescription className="text-[10px] font-semibold uppercase tracking-wider">Critical & High</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 flex items-baseline gap-1">
            <div className="text-2xl font-black text-red-500">{stats.critical}</div>
            <span className="text-xs text-muted-foreground">crit</span>
            <div className="text-2xl font-black text-orange-500 ml-2">{stats.high}</div>
            <span className="text-xs text-muted-foreground">high</span>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card/60">
          <CardHeader className="p-4 pb-1.5">
            <CardDescription className="text-[10px] font-semibold uppercase tracking-wider">Confirmed Exploits</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-amber-500 flex items-center gap-1.5">
              {stats.exploited}
              {stats.exploited > 0 && <AlertTriangle className="h-4 w-4 animate-pulse" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area - Split Panel */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12 items-start print:block">
        
        {/* Left Column: Report Builder Form (Hidden on Print) */}
        <div className="space-y-6 lg:col-span-5 print:hidden">
          <Card className="border border-border/80 bg-card/50 backdrop-blur-sm">
            <CardHeader className="border-b border-border/50 bg-muted/20">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                Configure Report Scope
              </CardTitle>
              <CardDescription className="text-[11px]">Customize targets, templates, and threat-model weights</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              
              {/* Template Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Report Template</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value as any)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="executive">Executive Summary Report</option>
                  <option value="technical">Technical Vulnerabilities Ledger</option>
                  <option value="compliance">Compliance Mapping Report</option>
                </select>
              </div>

              {/* Scope Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Scan Scope (Target Asset)</label>
                <select
                  value={selectedAssetScope}
                  onChange={(e) => setSelectedAssetScope(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">All Targets ({assets.length} scanned)</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} ({asset.asset_type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Severity Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Filter Severity</label>
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical Only</option>
                  <option value="high">High & Above</option>
                  <option value="medium">Medium & Above</option>
                  <option value="low">Low & Above</option>
                </select>
              </div>

              {/* Tool Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Scanner Tool Origin</label>
                <select
                  value={selectedTool}
                  onChange={(e) => setSelectedTool(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">All Scanners</option>
                  <option value="nuclei">Nuclei (Vulnerability)</option>
                  <option value="trivy">Trivy (SCA/Containers)</option>
                  <option value="gitleaks">Gitleaks (Secrets)</option>
                  <option value="opengrep">Opengrep (SAST)</option>
                  <option value="opengroup">OpenGroup (SAST)</option>
                </select>
              </div>

              {/* Format Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Export Format</label>
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    type="button" 
                    variant={selectedFormat === "pdf" ? "default" : "outline"} 
                    className="h-9 gap-1.5 text-xs font-semibold cursor-pointer" 
                    onClick={() => setSelectedFormat("pdf")}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                  <Button 
                    type="button" 
                    variant={selectedFormat === "csv" ? "default" : "outline"} 
                    className="h-9 gap-1.5 text-xs font-semibold cursor-pointer" 
                    onClick={() => setSelectedFormat("csv")}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    CSV
                  </Button>
                  <Button 
                    type="button" 
                    variant={selectedFormat === "json" ? "default" : "outline"} 
                    className="h-9 gap-1.5 text-xs font-semibold cursor-pointer" 
                    onClick={() => setSelectedFormat("json")}
                  >
                    <FileJson className="h-3.5 w-3.5" />
                    JSON
                  </Button>
                </div>
              </div>

              {/* Advanced Toggles */}
              <div className="pt-2 space-y-3">
                <label className="text-xs font-bold text-foreground">Threat Intelligence Focus</label>
                
                <label className="flex items-center gap-2.5 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={onlyKev}
                    onChange={(e) => setOnlyKev(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-primary accent-primary"
                  />
                  <span>Show only KEV-listed items (CISA Active Exploits)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={onlyExploited}
                    onChange={(e) => setOnlyExploited(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-primary accent-primary"
                  />
                  <span>Show only active exploit validated findings (FR-SCN-13)</span>
                </label>
              </div>

            </CardContent>
            <CardFooter className="border-t border-border/50 p-4 bg-muted/10 flex justify-between gap-4">
              <Button 
                onClick={handleGenerateReport} 
                className="w-full gap-2 font-bold cursor-pointer"
                disabled={findingsLoading}
              >
                <Download className="h-4 w-4" />
                {selectedFormat === "pdf" ? "Print / Save PDF" : `Download ${selectedFormat.toUpperCase()}`}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right Column: Live Document Preview Panel */}
        <div className="lg:col-span-7 print:col-span-12 print:w-full">
          <Card className="border border-border bg-white text-slate-900 shadow-xl overflow-hidden print:shadow-none print:border-none print:bg-white print:text-black">
            
            {/* Preview Banner (Hidden on Print) */}
            <div className="bg-gradient-to-r from-primary to-primary-foreground/90 text-white p-3.5 px-6 flex justify-between items-center no-print">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="text-xs font-extrabold uppercase tracking-widest">Interactive Report Preview</span>
              </div>
              <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-[10px] font-bold">
                Live Compilation
              </Badge>
            </div>

            {/* Document Body */}
            <div className="p-8 md:p-12 space-y-8 min-h-[700px] flex flex-col justify-between">
              
              {/* Report Header */}
              <div className="space-y-4">
                <div className="flex justify-between items-start pb-4 border-b border-slate-200">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-800">
                      <div className="p-1 rounded bg-slate-900 text-white font-bold text-sm tracking-tight">SS</div>
                      <span className="font-extrabold text-sm tracking-tight uppercase">SigmaSec Security</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-semibold">Postural Intelligence Report</p>
                  </div>
                  <div className="text-right text-[10px] text-slate-500 space-y-0.5">
                    <p className="font-bold text-slate-800">Generated: {mounted ? new Date().toLocaleDateString() : ""}</p>
                    <p>Scope: {selectedAssetScope === "all" ? "All scanned assets" : assets.find(a => a.id === selectedAssetScope)?.name}</p>
                    <p className="font-mono text-[9px]">ID: RPT-{reportId}</p>
                  </div>
                </div>

                {/* Report Title */}
                <div className="space-y-1.5 pt-2">
                  <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 font-bold text-[9px] uppercase tracking-wider rounded">
                    {selectedTemplate} summary template
                  </Badge>
                  <h2 className="text-xl font-bold tracking-tight text-slate-800 uppercase">
                    {selectedTemplate === "executive" && "Executive Security Posture Report"}
                    {selectedTemplate === "technical" && "Vulnerability Ledger & Technical Findings"}
                    {selectedTemplate === "compliance" && "Framework Alignment & Compliance Readiness"}
                  </h2>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    This report represents the dynamic vulnerability posture generated on {mounted ? new Date().toLocaleDateString() : ""} from our aggregated scanner agents (Nuclei, Trivy, Gitleaks).
                  </p>
                </div>
              </div>

              {/* REPORT TEMPLATE 1: EXECUTIVE */}
              {selectedTemplate === "executive" && (
                <div className="space-y-6 flex-1 pt-4">
                  {/* Gauge & Metrics */}
                  <div className="grid grid-cols-3 gap-4 items-center">
                    <div className="col-span-1 border border-slate-100 rounded-lg p-4 bg-slate-50 text-center space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Posture Score</p>
                      <div className={`text-3xl font-black ${getScoreColor(stats.postureScore)}`}>
                        {stats.postureScore.toFixed(0)}
                      </div>
                      <Badge variant="outline" className={`text-[9px] font-extrabold uppercase ${getScoreBg(stats.postureScore)} rounded mx-auto`}>
                        {stats.postureScore >= 80 ? "secure" : stats.postureScore >= 50 ? "warning" : "critical"}
                      </Badge>
                    </div>

                    <div className="col-span-2 space-y-2">
                      <p className="text-[10px] font-bold text-slate-700">Severity Distribution Matrix</p>
                      <div className="space-y-1.5 text-[9px]">
                        <div className="flex justify-between items-center text-slate-600">
                          <span className="font-semibold flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />Critical Risks</span>
                          <span className="font-bold">{stats.critical}</span>
                        </div>
                        <Progress value={stats.total ? (stats.critical / stats.total) * 100 : 0} className="h-1 bg-slate-100 text-red-500" />
                        
                        <div className="flex justify-between items-center text-slate-600">
                          <span className="font-semibold flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-orange-500" />High Risks</span>
                          <span className="font-bold">{stats.high}</span>
                        </div>
                        <Progress value={stats.total ? (stats.high / stats.total) * 100 : 0} className="h-1 bg-slate-100 text-orange-500" />

                        <div className="flex justify-between items-center text-slate-600">
                          <span className="font-semibold flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />Medium Risks</span>
                          <span className="font-bold">{stats.medium}</span>
                        </div>
                        <Progress value={stats.total ? (stats.medium / stats.total) * 100 : 0} className="h-1 bg-slate-100 text-yellow-500" />
                      </div>
                    </div>
                  </div>

                  {/* Summary Text block */}
                  <div className="border border-slate-100 rounded-lg p-4 space-y-2.5 bg-slate-50">
                    <p className="text-[10px] font-bold text-slate-700 flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-indigo-600" />
                      AI Executive Posture Analysis
                    </p>
                    <p className="text-[10px] text-slate-600 leading-relaxed">
                      Our scanners evaluated the target surface and discovered a total of <strong className="text-slate-800">{stats.total}</strong> active vulnerabilities.
                      {stats.critical > 0 ? (
                        <span> Due to the presence of <strong className="text-red-500">{stats.critical} critical findings</strong>, urgent remediation action is advised. </span>
                      ) : (
                        <span> No critical vulnerabilities were detected in this scope, which maintains a stable posture baseline. </span>
                      )}
                      {stats.exploited > 0 && (
                        <span>We verified <strong className="text-amber-600 font-bold">{stats.exploited} vulnerabilities as actively exploitable</strong> on your network. These should be prioritised for patching immediately. </span>
                      )}
                      {stats.kev > 0 && (
                        <span>Additionally, <strong className="text-red-600 font-bold">{stats.kev} findings are registered on CISA's Known Exploited Vulnerabilities (KEV) list</strong>, indicating active weaponisation in the wild.</span>
                      )}
                    </p>
                  </div>

                  {/* Top Vulnerabilities Table */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-700">Top 3 Critical Risk Vectors</p>
                    <div className="border border-slate-200 rounded-md overflow-hidden">
                      <Table className="bg-white">
                        <TableHeader className="bg-slate-50 border-b border-slate-200">
                          <TableRow>
                            <TableHead className="h-8 text-[9px] text-slate-500 font-bold py-1 px-3">Title</TableHead>
                            <TableHead className="h-8 text-[9px] text-slate-500 font-bold py-1 px-3">Severity</TableHead>
                            <TableHead className="h-8 text-[9px] text-slate-500 font-bold py-1 px-3">Tool</TableHead>
                            <TableHead className="h-8 text-[9px] text-slate-500 font-bold py-1 px-3 text-right">CVE ID</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-[9px] text-slate-700">
                          {filteredFindings.slice(0, 3).map((f) => (
                            <TableRow key={f.id} className="border-b border-slate-100">
                              <TableCell className="font-semibold py-2 px-3 line-clamp-1 max-w-[220px] text-slate-800">{f.title}</TableCell>
                              <TableCell className="py-2 px-3">
                                <Badge variant="outline" className={`text-[8px] font-extrabold uppercase rounded px-1.5 py-0 border ${getSeverityColor(f.severity)}`}>
                                  {f.severity}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2 px-3 font-mono text-slate-500 uppercase">{f.tool}</TableCell>
                              <TableCell className="py-2 px-3 text-right font-mono font-semibold text-slate-600">{f.cve_id || "N/A"}</TableCell>
                            </TableRow>
                          ))}
                          {filteredFindings.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-4 text-slate-400 font-medium italic">
                                No vulnerability records found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}

              {/* REPORT TEMPLATE 2: TECHNICAL */}
              {selectedTemplate === "technical" && (
                <div className="space-y-4 flex-1 pt-4">
                  <p className="text-[10px] font-bold text-slate-700">Vulnerability Ledger ({filteredFindings.length} Items)</p>
                  <div className="border border-slate-200 rounded-md overflow-hidden">
                    <Table className="bg-white">
                      <TableHeader className="bg-slate-50 border-b border-slate-200">
                        <TableRow>
                          <TableHead className="h-8 text-[9px] text-slate-500 font-bold py-1 px-3">Vulnerability Title</TableHead>
                          <TableHead className="h-8 text-[9px] text-slate-500 font-bold py-1 px-3">Severity</TableHead>
                          <TableHead className="h-8 text-[9px] text-slate-500 font-bold py-1 px-3">Tool</TableHead>
                          <TableHead className="h-8 text-[9px] text-slate-500 font-bold py-1 px-3">CVE</TableHead>
                          <TableHead className="h-8 text-[9px] text-slate-500 font-bold py-1 px-3 text-right">EPSS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-[9px] text-slate-700">
                        {filteredFindings.slice(0, 10).map((f) => (
                          <TableRow key={f.id} className="border-b border-slate-100">
                            <TableCell className="font-semibold py-1.5 px-3 line-clamp-1 max-w-[200px] text-slate-800">{f.title}</TableCell>
                            <TableCell className="py-1.5 px-3">
                              <Badge variant="outline" className={`text-[8px] font-extrabold uppercase rounded px-1.5 py-0 border ${getSeverityColor(f.severity)}`}>
                                {f.severity}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-1.5 px-3 font-mono text-slate-500 uppercase">{f.tool}</TableCell>
                            <TableCell className="py-1.5 px-3 font-mono text-slate-500">{f.cve_id || "N/A"}</TableCell>
                            <TableCell className="py-1.5 px-3 text-right font-mono text-slate-500">
                              {f.epss_score !== null ? f.epss_score.toFixed(3) : "N/A"}
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredFindings.length > 10 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-2 text-slate-400 font-bold">
                              + {filteredFindings.length - 10} additional vulnerabilities included in exported file.
                            </TableCell>
                          </TableRow>
                        )}
                        {filteredFindings.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-6 text-slate-400 italic">
                              No vulnerability records found matching filters.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* REPORT TEMPLATE 3: COMPLIANCE */}
              {selectedTemplate === "compliance" && (
                <div className="space-y-5 flex-1 pt-4">
                  <p className="text-[10px] font-bold text-slate-700">Regulatory Framework Scorecard</p>
                  
                  {/* OWASP Checklists */}
                  <div className="border border-slate-100 rounded-lg p-4 space-y-3 bg-slate-50">
                    <p className="text-[9px] font-extrabold text-slate-700 uppercase tracking-wider">OWASP Top 10 (2021) Compliance Check</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[9px] text-slate-700">
                      
                      <div className="flex items-center gap-2 p-1 bg-white border rounded">
                        {findings.filter(f => f.tool === "nuclei").length > 0 ? (
                          <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        )}
                        <div className="leading-tight">
                          <p className="font-bold">A05: Security Misconfig</p>
                          <p className="text-[8px] text-slate-500">{findings.filter(f => f.tool === "nuclei").length} vulnerabilities active</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-1 bg-white border rounded">
                        {findings.filter(f => f.tool === "gitleaks").length > 0 ? (
                          <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        )}
                        <div className="leading-tight">
                          <p className="font-bold">A02: Cryptographic Failures</p>
                          <p className="text-[8px] text-slate-500">{findings.filter(f => f.tool === "gitleaks").length} secrets exposed</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-1 bg-white border rounded">
                        {findings.filter(f => f.tool === "trivy").length > 0 ? (
                          <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        )}
                        <div className="leading-tight">
                          <p className="font-bold">A06: Vulnerable Components</p>
                          <p className="text-[8px] text-slate-500">{findings.filter(f => f.tool === "trivy").length} outdated libraries</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-1 bg-white border rounded">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <div className="leading-tight">
                          <p className="font-bold">A01: Broken Access Control</p>
                          <p className="text-[8px] text-slate-500">No active findings detected</p>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Compliance Audits */}
                  <div className="border border-slate-100 rounded-lg p-4 space-y-3 bg-slate-50">
                    <p className="text-[9px] font-extrabold text-slate-700 uppercase tracking-wider">Enterprise Auditing Framework Alignments</p>
                    <div className="space-y-2 text-[9px] text-slate-700">
                      
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-800">SOC 2 CC7.1 (Vulnerability Management)</p>
                          <p className="text-[8px] text-slate-400">Requires regular scanning and remediation process.</p>
                        </div>
                        <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700 rounded text-[8px] uppercase tracking-wider font-extrabold">
                          aligned
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-800">ISO 27001 A.12.6.1 (Technical Vulnerability Management)</p>
                          <p className="text-[8px] text-slate-400">Requires timely identification and mitigation of threats.</p>
                        </div>
                        <Badge variant="outline" className={stats.critical > 0 ? "bg-amber-50 border-amber-200 text-amber-700 rounded text-[8px] uppercase tracking-wider font-extrabold" : "bg-emerald-50 border-emerald-200 text-emerald-700 rounded text-[8px] uppercase tracking-wider font-extrabold"}>
                          {stats.critical > 0 ? "remediation pending" : "aligned"}
                        </Badge>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* Report Footer */}
              <div className="pt-4 border-t border-slate-200 text-center text-[9px] text-slate-400 flex justify-between items-center">
                <p>SigmaSec platform output. Data subject to customer verification.</p>
                <p className="font-semibold">Classification: Confidential</p>
              </div>

            </div>
          </Card>
        </div>

      </div>

      {/* Report History (Hidden on Print) */}
      <div className="print:hidden">
        <Card className="border border-border/80 bg-card/60">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-sm font-bold">Report Export History</CardTitle>
            <CardDescription className="text-xs">Ledger of previously generated and exported reports</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                {historyTable.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="text-xs font-semibold">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {historyTable.getRowModel().rows.length > 0 ? (
                  historyTable.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs italic">
                      No reports generated yet. Use the scope selector above to export.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {history.length > 0 && <DataTablePagination table={historyTable} />}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
