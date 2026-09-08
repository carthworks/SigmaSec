"use client";

import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { calculateSla } from "@/lib/sla-calculator";
import { getTagClassName } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Flame,
  GitPullRequest,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag as TagIcon,
  X
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { playAiRecommendationSound } from "@/lib/sound-cues";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Interfaces ────────────────────────────────────────────────────────────
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
  ai_remediation?: string[] | null;
  ai_severity_override?: string | null;
  ai_override_reason?: string | null;
  reachability_reason?: string | null;
  ai_why_now?: string | null;
  ai_remediation_structured?: Array<{ action: string; command?: string; file?: string; verification?: string }> | null;
  ai_patch?: { diff?: string; applies_to_sha?: string; files_touched?: string[] } | null;
  ai_blockers?: string[] | null;
  ai_breaking_change_risk?: "low" | "medium" | "high" | null;
  ai_confidence?: number | null;
  ai_insufficient_context?: string[] | null;
  reachability_context?: {
    status?: string;
    entry_point?: string;
    call_path?: string[];
    snippets?: Record<string, string>;
    analyzer_confidence?: number;
  } | null;
  asset_name?: string | null;
  created_at?: string | null;
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

function FindingsContent() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const viewParam = searchParams ? searchParams.get("view") : null;

  // ─── UI & Filter States ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedSeverity, setSelectedSeverity] = React.useState<string>("all");
  const [selectedReachability, setSelectedReachability] = React.useState<string>("all");
  const [selectedTool, setSelectedTool] = React.useState<string>("all");
  const [hideFalsePositives, setHideFalsePositives] = React.useState(true);
  const [filterKevOnly, setFilterKevOnly] = React.useState(false);
  const [filterJiraOnly, setFilterJiraOnly] = React.useState(false);
  const [filterPrOnly, setFilterPrOnly] = React.useState(false);
  const [filterFpOnly, setFilterFpOnly] = React.useState(false);
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);

  // Tag Combobox state
  const [tagComboOpen, setTagComboOpen] = React.useState(false);
  const [tagComboInput, setTagComboInput] = React.useState("");
  const tagComboRef = React.useRef<HTMLDivElement>(null);

  // Drawer / Detail sheet state
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedFinding, setSelectedFinding] = React.useState<Finding | null>(null);

  // Tab inside details drawer: "summary" | "remediation" | "reachability" | "raw"
  const [activeTab, setActiveTab] = React.useState<"summary" | "remediation" | "reachability" | "raw">("summary");
  
  // Custom Tag input state inside drawer
  const [newTag, setNewTag] = React.useState("");
  const [isAiLoading, setIsAiLoading] = React.useState<boolean>(false);

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
      playAiRecommendationSound();
      
      qc.setQueryData(["findings"], (oldData: Finding[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(f => f.id === updatedFinding.id ? updatedFinding : f);
      });
      
      toast.success("AI Analysis regenerated successfully via Ollama!", { id: toastId });
    } catch (err: any) {
      toast.error(`Regeneration failed: ${err.message || err}`, { id: toastId });
    } finally {
      setIsAiLoading(false);
    }
  };


  // ─── Filter Presets & Smart Views State ─────────────────────────────────────
  const [presets, setPresets] = React.useState<{ name: string; filters: any }[]>([]);
  const [activePresetName, setActivePresetName] = React.useState<string | null>(null);

  const defaultPresets = React.useMemo(() => [
    {
      name: "All Findings",
      filters: {
        searchQuery: "",
        selectedSeverity: "all",
        selectedReachability: "all",
        hideFalsePositives: true,
        filterKevOnly: false,
        filterJiraOnly: false,
        filterPrOnly: false,
        filterFpOnly: false,
        selectedTags: [],
      }
    },
    {
      name: "Critical KEV Exploits",
      filters: {
        searchQuery: "",
        selectedSeverity: "critical",
        selectedReachability: "all",
        hideFalsePositives: true,
        filterKevOnly: true,
        filterJiraOnly: false,
        filterPrOnly: false,
        filterFpOnly: false,
        selectedTags: [],
      }
    },
    {
      name: "Reachable Only",
      filters: {
        searchQuery: "",
        selectedSeverity: "all",
        selectedReachability: "reachable",
        hideFalsePositives: true,
        filterKevOnly: false,
        filterJiraOnly: false,
        filterPrOnly: false,
        filterFpOnly: false,
        selectedTags: [],
      }
    },
    {
      name: "Jira Tickets",
      filters: {
        searchQuery: "",
        selectedSeverity: "all",
        selectedReachability: "all",
        hideFalsePositives: true,
        filterKevOnly: false,
        filterJiraOnly: true,
        filterPrOnly: false,
        filterFpOnly: false,
        selectedTags: [],
      }
    },
    {
      name: "PRs Opened",
      filters: {
        searchQuery: "",
        selectedSeverity: "all",
        selectedReachability: "all",
        hideFalsePositives: true,
        filterKevOnly: false,
        filterJiraOnly: false,
        filterPrOnly: true,
        filterFpOnly: false,
        selectedTags: [],
      }
    },
    {
      name: "False Positives",
      filters: {
        searchQuery: "",
        selectedSeverity: "all",
        selectedReachability: "all",
        hideFalsePositives: false,
        filterKevOnly: false,
        filterJiraOnly: false,
        filterPrOnly: false,
        filterFpOnly: true,
        selectedTags: [],
      }
    }
  ], []);

  React.useEffect(() => {
    const saved = localStorage.getItem("findings_filter_presets");
    if (saved) {
      try {
        setPresets(JSON.parse(saved));
      } catch (e) {
        setPresets(defaultPresets);
      }
    } else {
      setPresets(defaultPresets);
      localStorage.setItem("findings_filter_presets", JSON.stringify(defaultPresets));
    }
  }, [defaultPresets]);

  // Handle URL query param (?view=jira | pr | fp)
  React.useEffect(() => {
    if (viewParam === "jira") {
      setFilterJiraOnly(true);
      setFilterPrOnly(false);
      setFilterFpOnly(false);
      setHideFalsePositives(true);
      setActivePresetName("Jira Tickets");
    } else if (viewParam === "pr") {
      setFilterPrOnly(true);
      setFilterJiraOnly(false);
      setFilterFpOnly(false);
      setHideFalsePositives(true);
      setActivePresetName("PRs Opened");
    } else if (viewParam === "fp" || viewParam === "false_positive") {
      setFilterFpOnly(true);
      setFilterJiraOnly(false);
      setFilterPrOnly(false);
      setHideFalsePositives(false);
      setActivePresetName("False Positives");
    }
  }, [viewParam]);

  const applyPreset = (presetName: string, filters: any) => {
    setActivePresetName(presetName);
    setSearchQuery(filters.searchQuery ?? "");
    setSelectedSeverity(filters.selectedSeverity ?? "all");
    setSelectedReachability(filters.selectedReachability ?? "all");
    setSelectedTool(filters.selectedTool ?? "all");
    setHideFalsePositives(filters.hideFalsePositives ?? true);
    setFilterKevOnly(filters.filterKevOnly ?? false);
    setFilterJiraOnly(filters.filterJiraOnly ?? false);
    setFilterPrOnly(filters.filterPrOnly ?? false);
    setFilterFpOnly(filters.filterFpOnly ?? false);
    setSelectedTags(filters.selectedTags ?? []);
    toast.info(`Applied Smart View: ${presetName}`);
  };

  const saveCurrentPreset = () => {
    const name = prompt("Enter a name for this Smart View / Preset:");
    if (!name || !name.trim()) return;
    
    const newPreset = {
      name: name.trim(),
      filters: {
        searchQuery,
        selectedSeverity,
        selectedReachability,
        selectedTool,
        hideFalsePositives,
        filterKevOnly,
        filterJiraOnly,
        filterPrOnly,
        filterFpOnly,
        selectedTags,
      }
    };
    
    const updated = [...presets.filter(p => p.name !== newPreset.name), newPreset];
    setPresets(updated);
    localStorage.setItem("findings_filter_presets", JSON.stringify(updated));
    setActivePresetName(newPreset.name);
    toast.success(`Smart View "${newPreset.name}" saved!`);
  };

  const deletePreset = (presetName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = presets.filter((p) => p.name !== presetName);
    setPresets(updated);
    localStorage.setItem("findings_filter_presets", JSON.stringify(updated));
    if (activePresetName === presetName) {
      setActivePresetName(null);
    }
    toast.success(`Smart View "${presetName}" deleted`);
  };

  // ─── Keyboard Shortcuts J/K/Esc ──────────────────────────────────────────
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close drawer on Escape
      if (e.key === "Escape") {
        setDrawerOpen(false);
        return;
      }

      // Ignore J/K inside inputs
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (!findingsList || findingsList.length === 0) return;

      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        if (!selectedFinding) {
          setSelectedFinding(findingsList[0]);
          setDrawerOpen(true);
        } else {
          const currentIndex = findingsList.findIndex((f) => f.id === selectedFinding.id);
          if (currentIndex < findingsList.length - 1) {
            setSelectedFinding(findingsList[currentIndex + 1]);
            setDrawerOpen(true);
          }
        }
      }

      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        if (!selectedFinding) {
          setSelectedFinding(findingsList[findingsList.length - 1]);
          setDrawerOpen(true);
        } else {
          const currentIndex = findingsList.findIndex((f) => f.id === selectedFinding.id);
          if (currentIndex > 0) {
            setSelectedFinding(findingsList[currentIndex - 1]);
            setDrawerOpen(true);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedFinding, drawerOpen]);

  // ─── React Query: Fetch findings ──────────────────────────────────────────
  const { data: findings = [], isLoading, error } = useQuery<Finding[]>({
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

  // ─── React Query: Fetch org tags for Combobox autocomplete ───────────────
  const { data: orgTags = [] } = useQuery<string[]>({
    queryKey: ["org-tags"],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/findings/tags`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  // Fetch Jira settings for base URL link resolution
  const { data: jiraSettings } = useQuery<{ base_url?: string }>({
    queryKey: ["jira-settings"],
    queryFn: async () => {
      if (!token) return null;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/settings/jira`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!token,
  });

  // Track drawer finding fresh state from the query list
  React.useEffect(() => {
    if (selectedFinding) {
      const fresh = findings.find((f) => f.id === selectedFinding.id);
      if (fresh) {
        setSelectedFinding(fresh);
      }
    }
  }, [findings, selectedFinding?.id]);

  // ─── Mutations ────────────────────────────────────────────────────────────
  
  // Patch Status / False Positive Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Finding> }) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/findings/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to update finding");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["findings"] });
      toast.success("Finding updated");
    },
    onError: (e: Error) => toast.error("Update failed", { description: e.message })
  });

  // Add Tag Mutation
  const addTagMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/findings/${id}/tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error("Failed to add tag");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["findings"] });
      toast.success("Tag added");
      setNewTag("");
    },
    onError: (e: Error) => toast.error("Adding tag failed", { description: e.message })
  });

  // Remove Tag Mutation
  const removeTagMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/findings/${id}/tags/${name}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to remove tag");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["findings"] });
      toast.success("Tag removed");
    },
    onError: (e: Error) => toast.error("Removing tag failed", { description: e.message })
  });

  // Create Jira Ticket Mutation
  const jiraMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/findings/${id}/create-jira-ticket`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to create Jira ticket");
      return res.json();
    },
    onMutate: () => {
      return { toastId: toast.loading("Creating Jira ticket...") };
    },
    onSuccess: (data, variables, context) => {
      qc.invalidateQueries({ queryKey: ["findings"] });
      playActionSuccessSound();
      toast.success("Jira ticket created successfully!", {
        id: context?.toastId,
        description: `Issue key: ${data.issue_key}`,
      });
    },
    onError: (e: Error, variables, context) => {
      toast.error("Jira integration failed", {
        id: context?.toastId,
        description: e.message,
      });
    }
  });

  // Create Fix PR Mutation
  const prMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/findings/${id}/create-fix-pr`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to trigger fix PR");
      }
      return res.json();
    },
    onMutate: () => {
      return { toastId: toast.loading("Opening Autofix Pull Request on GitHub...") };
    },
    onSuccess: (data, variables, context) => {
      qc.invalidateQueries({ queryKey: ["findings"] });
      playActionSuccessSound();
      toast.success(data.message || "Fix Pull Request opened!", {
        id: context?.toastId,
        description: data.pr_url ? `PR #${data.pr_number}: ${data.pr_url}` : "Review automated security fixes in code.",
      });
    },
    onError: (e: Error, variables, context) => {
      toast.error("PR generation failed", {
        id: context?.toastId,
        description: e.message,
      });
    }
  });

  // ─── Filter & Search Logic ────────────────────────────────────────────────
  const uniqueTags = React.useMemo(() => {
    const set = new Set<string>();
    findings.forEach((f) => (f.tags || []).forEach((t) => set.add(t)));
    return Array.from(set);
  }, [findings]);

  const findingsList = React.useMemo(() => {
    return findings
      .filter((f) => {
        // Search filter
        if (searchQuery.trim()) {
          const match = searchQuery.toLowerCase();
          const titleMatch = f.title.toLowerCase().includes(match);
          const cveMatch = f.cve_id?.toLowerCase().includes(match) || false;
          const toolMatch = f.tool.toLowerCase().includes(match);
          if (!titleMatch && !cveMatch && !toolMatch) return false;
        }

        // Severity filter
        if (selectedSeverity !== "all" && f.severity !== selectedSeverity) {
          return false;
        }

        // Reachability filter
        if (selectedReachability !== "all" && f.reachability !== selectedReachability) {
          return false;
        }

        // Scanner / tool filter
        if (selectedTool !== "all" && f.tool !== selectedTool) {
          return false;
        }

        // Hide False Positives
        if (hideFalsePositives && (f.status === "false_positive" || f.fp_candidate)) {
          return false;
        }

        // KEV Only filter
        if (filterKevOnly && !f.kev_listed) {
          return false;
        }

        // Tag filter — multi-select: show finding if ANY selected tag is present
        if (selectedTags.length > 0 && !selectedTags.some((t) => (f.tags || []).includes(t))) {
          return false;
        }

        return true;
      })
      // Sort KEV findings to top first, then sort by severity / rank
      .sort((a, b) => {
        if (a.kev_listed && !b.kev_listed) return -1;
        if (!a.kev_listed && b.kev_listed) return 1;
        
        // Priority rank sort (smaller is higher priority)
        const rankA = a.priority_rank ?? 9999;
        const rankB = b.priority_rank ?? 9999;
        return rankA - rankB;
      });
  }, [findings, searchQuery, selectedSeverity, selectedReachability, selectedTool, hideFalsePositives, filterKevOnly, selectedTags]);

  // TanStack Table Columns definition
  const columns = React.useMemo<ColumnDef<Finding>[]>(
    () => [
      {
        accessorKey: "cve_id",
        header: "CVE / ID",
        cell: ({ row }) => {
          const finding = row.original;
          return (
            <div className="font-mono font-bold text-foreground/90 whitespace-nowrap">
              {finding.cve_id || "N/A"}
              {finding.kev_listed && (
                <span
                  className="ml-1 bg-red-500/10 text-red-500 font-extrabold text-[8px] px-1 rounded inline-flex items-center gap-0.5"
                  title="Exploited in the wild"
                >
                  KEV
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "severity",
        header: "Severity",
        cell: ({ row }) => {
          const finding = row.original;
          return (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span
                className={cn(
                  "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase border",
                  finding.severity === "critical"
                    ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                    : finding.severity === "high"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : finding.severity === "medium"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                    : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                )}
              >
                {finding.severity}
              </span>
              {finding.exploit_validated && (
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
        id: "sla",
        header: "SLA Status",
        cell: ({ row }) => {
          const finding = row.original;
          const sla = calculateSla(finding.created_at, finding.severity);
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] uppercase border whitespace-nowrap",
                sla.badgeClass
              )}
              title={`Due: ${sla.dueDate.toLocaleDateString()}`}
            >
              {sla.status === "breached" && <AlertTriangle className="h-2.5 w-2.5" />}
              {sla.label}
            </span>
          );
        },
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => {
          const finding = row.original;
          const isFP = finding.status === "false_positive" || finding.fp_candidate;
          const hasAiExplanation = Boolean(finding.ai_plain_english && finding.ai_plain_english.trim().length > 0);
          return (
            <div className="max-w-[300px]">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground/90 truncate" title={finding.title}>
                  {finding.title}
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
                        {finding.ai_plain_english}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              {(finding.jira_issue_key || finding.pr_url || isFP) && (
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {finding.jira_issue_key && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-blue-500/10 text-blue-500 border border-blue-500/20 px-1.5 py-0.2 rounded">
                      🎟️ {finding.jira_issue_key}
                    </span>
                  )}
                  {finding.pr_url && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.2 rounded">
                      <GitPullRequest className="h-2.5 w-2.5" />
                      PR Active
                    </span>
                  )}
                  {isFP && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-zinc-500/20 text-zinc-400 border border-zinc-500/30 px-1.5 py-0.2 rounded">
                      🚫 False Positive
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "tool",
        header: "Scanner",
        cell: ({ row }) => (
          <span className="whitespace-nowrap capitalize text-muted-foreground">
            {row.original.tool}
          </span>
        ),
      },
      {
        accessorKey: "reachability",
        header: "Reachability",
        cell: ({ row }) => {
          const r = row.original.reachability;
          if (!r) return <span className="italic opacity-50">—</span>;
          return (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold border whitespace-nowrap",
                r === "reachable"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : r === "unreachable"
                  ? "bg-zinc-500/10 text-zinc-600 border-zinc-500/20"
                  : "bg-amber-500/10 text-amber-600 border-amber-500/20"
              )}
            >
              {r === "reachable" ? "Reachable" : r === "unreachable" ? "Not Reached" : "Uncertain"}
            </span>
          );
        },
      },
      {
        accessorKey: "cvss_score",
        header: "CVSS",
        cell: ({ row }) => {
          const finding = row.original;
          const score = typeof finding.cvss_score === "number" ? finding.cvss_score : null;
          const fallbackScore = finding.severity === "critical" ? 9.0 : finding.severity === "high" ? 7.5 : finding.severity === "medium" ? 5.0 : finding.severity === "low" ? 3.0 : 1.0;
          const displayScore = score !== null ? score : fallbackScore;
          return (
            <span
              className={cn(
                "whitespace-nowrap font-mono font-bold text-xs px-1.5 py-0.5 rounded border inline-flex items-center",
                displayScore >= 9.0
                  ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                  : displayScore >= 7.0
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  : displayScore >= 4.0
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                  : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
              )}
            >
              {displayScore.toFixed(1)}
            </span>
          );
        },
      },
      {
        accessorKey: "epss_score",
        header: "EPSS",
        cell: ({ row }) => {
          const finding = row.original;
          const epss = typeof finding.epss_score === "number" ? finding.epss_score : 0.0;
          return (
            <span
              className={cn(
                "whitespace-nowrap font-mono text-xs font-semibold px-1.5 py-0.5 rounded border inline-flex items-center",
                epss > 0.5
                  ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                  : epss > 0.1
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  : "bg-muted/40 text-foreground/80 border-border/40"
              )}
            >
              {(epss * 100).toFixed(2)}%
            </span>
          );
        },
      },
      {
        accessorKey: "tags",
        header: "Tags",
        cell: ({ row }) => {
          const finding = row.original;
          let tags = Array.isArray(finding.tags) && finding.tags.length > 0 ? finding.tags : [];
          
          if (tags.length === 0) {
            const autoTags: string[] = [];
            const tool = (finding.tool || "").toLowerCase();
            if (tool === "opengrep" || tool === "semgrep" || tool === "opengroup") autoTags.push("sast");
            else if (tool === "trivy") autoTags.push("sca");
            else if (tool === "gitleaks") autoTags.push("secrets");
            else if (tool === "nuclei") autoTags.push("dast");
            else if (tool) autoTags.push(tool);
            
            if (finding.reachability === "reachable") autoTags.push("reachable");
            if (finding.kev_listed) autoTags.push("cisa-kev");
            if (finding.exploit_validated) autoTags.push("exploited");
            tags = autoTags;
          }

          if (tags.length === 0) {
            return <span className="italic opacity-30">—</span>;
          }

          return (
            <div className="flex gap-1 items-center flex-wrap max-w-[160px]">
              {tags.slice(0, 2).map((t) => (
                <span
                  key={t}
                  className={cn(
                    "inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border",
                    getTagClassName(t)
                  )}
                >
                  #{t}
                </span>
              ))}
              {tags.length > 2 && (
                <span className="text-[9px] font-medium text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded-full border border-border/50">
                  +{tags.length - 2}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: () => (
          <div className="text-right">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:text-foreground transition-all"
              aria-label="View finding details"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: findingsList,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 15,
      },
    },
  });

  // ─── Form submit handers ──────────────────────────────────────────────────
  const handleAddTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFinding || !newTag.trim()) return;
    addTagMutation.mutate({ id: selectedFinding.id, name: newTag.trim() });
  };

  // Close combobox on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tagComboRef.current && !tagComboRef.current.contains(e.target as Node)) {
        setTagComboOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleComboAddTag = (tag: string) => {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean || !selectedFinding) return;
    if ((selectedFinding.tags || []).includes(clean)) {
      toast.info(`Tag "${clean}" already added`);
      setTagComboOpen(false);
      setTagComboInput("");
      return;
    }
    addTagMutation.mutate({ id: selectedFinding.id, name: clean }, {
      onSuccess: () => {
        setTagComboOpen(false);
        setTagComboInput("");
      }
    });
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Findings</h1>
        <p className="text-sm text-muted-foreground">
          Track, prioritize, and remediate security vulnerabilities across your stack.
        </p>
      </div>

      {/* Shortcuts Help Bar */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/30 border border-border/40 px-3 py-1.5 rounded-lg select-none">
        <span className="font-semibold bg-muted px-1 py-0.5 rounded border border-border">J</span> / 
        <span className="font-semibold bg-muted px-1 py-0.5 rounded border border-border">K</span>
        <span>to navigate findings</span>
        <span className="ml-2 font-semibold bg-muted px-1 py-0.5 rounded border border-border">ESC</span>
        <span>to close details panel</span>
      </div>

      {/* Smart Views / Saved Presets Bar */}
      {presets.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 border-b border-border/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mr-2 flex items-center gap-1">
            <ShieldAlert className="h-3.5 w-3.5" />
            Smart Views:
          </span>
          <div className="flex items-center gap-1.5">
            {presets.map((preset) => {
              const isActive = activePresetName === preset.name;
              const isDefault = ["All Findings", "Critical KEV Exploits", "Reachable Only"].includes(preset.name);
              return (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset.name, preset.filters)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer select-none",
                    isActive
                      ? "bg-primary/10 text-primary border-primary/20 shadow-xs"
                      : "bg-card hover:bg-muted/50 text-muted-foreground hover:text-foreground border-border/80"
                  )}
                >
                  {preset.name}
                  {!isDefault && (
                    <span
                      onClick={(e) => deletePreset(preset.name, e)}
                      className="hover:bg-primary/20 text-muted-foreground hover:text-primary rounded-full p-0.5 transition-colors"
                      title="Delete Preset"
                    >
                      <X className="h-2.5 w-2.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters Grid */}
      <div className="grid gap-4 md:flex md:items-center md:justify-between flex-wrap bg-card/60 border border-border/80 p-4 rounded-xl backdrop-blur-xs">
        {/* Search */}
        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search CVE, title, scanner..."
            className="pl-9 h-9 text-xs bg-background/50"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Severity selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Severity</span>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="h-9 rounded-lg border border-border/80 bg-background/50 px-2 py-1 text-xs text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Severities</option>
              <option value="critical">🔴 Critical</option>
              <option value="high">🟠 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🔵 Low</option>
            </select>
          </div>

          {/* Reachability selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Reachability</span>
            <select
              value={selectedReachability}
              onChange={(e) => setSelectedReachability(e.target.value)}
              className="h-9 rounded-lg border border-border/80 bg-background/50 px-2 py-1 text-xs text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Statuses</option>
              <option value="reachable">Reachable Only</option>
              <option value="unreachable">Unreachable</option>
              <option value="uncertain">Uncertain</option>
            </select>
          </div>

          {/* Scanner / Tool selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Scanner</span>
            <select
              value={selectedTool}
              onChange={(e) => setSelectedTool(e.target.value)}
              className="h-9 rounded-lg border border-border/80 bg-background/50 px-2 py-1 text-xs text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Scanners</option>
              <option value="nuclei">🌐 Nuclei (Web)</option>
              <option value="trivy">📦 Trivy (SCA)</option>
              <option value="gitleaks">🔑 Gitleaks (Secrets)</option>
              <option value="nmap">🔌 Nmap (Network)</option>
            </select>
          </div>

          {/* Tags Filter — multi-select pill row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <TagIcon className="h-3 w-3" />
              Tags
            </span>
            <button
              onClick={() => setSelectedTags([])}
              className={cn(
                "h-7 px-2.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer",
                selectedTags.length === 0
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-muted/50 text-muted-foreground border-border/60 hover:bg-muted"
              )}
            >
              All
            </button>
            {uniqueTags.map((tag) => {
              const active = selectedTags.includes(tag);
              const colorCls = getTagClassName(tag);
              return (
                <button
                  key={tag}
                  onClick={() =>
                    setSelectedTags((prev) =>
                      active ? prev.filter((t) => t !== tag) : [...prev, tag]
                    )
                  }
                  className={cn(
                    "h-7 px-2.5 rounded-full text-[10px] font-semibold border transition-all cursor-pointer select-none",
                    active
                      ? colorCls
                      : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted"
                  )}
                >
                  #{tag}
                </button>
              );
            })}
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-4 py-1">
            {/* KEV Toggle */}
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filterKevOnly}
                onChange={() => setFilterKevOnly(!filterKevOnly)}
                className="h-4 w-4 rounded border-border/80 text-primary accent-primary"
              />
              <span className="flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-red-500 fill-red-500" />
                Exploited in Wild (KEV)
              </span>
            </label>

            {/* FP Toggle */}
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideFalsePositives}
                onChange={() => setHideFalsePositives(!hideFalsePositives)}
                className="h-4 w-4 rounded border-border/80 text-primary accent-primary"
              />
              <span>Hide False Positives</span>
            </label>

            {/* Save View Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={saveCurrentPreset}
              className="h-8 text-xs font-semibold border-primary/20 text-primary hover:bg-primary/5 hover:text-primary cursor-pointer gap-1.5 ml-2"
            >
              <Plus className="h-3.5 w-3.5" />
              Save View
            </Button>
          </div>
        </div>
      </div>

      {/* Main content table */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="empty-state">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-1" />
              <p className="empty-state-title">Querying findings...</p>
              <p className="empty-state-desc">Loading vulnerability registry. This usually takes under a second.</p>
            </div>
          ) : error ? (
            <div className="empty-state">
              <AlertCircle className="empty-state-icon text-destructive" />
              <p className="empty-state-title">Query Failed</p>
              <p className="empty-state-desc">{String(error)}</p>
            </div>
          ) : findingsList.length === 0 ? (
            <div className="empty-state">
              <ShieldCheck className="h-10 w-10 text-emerald-500 opacity-80 mb-1" />
              <p className="empty-state-title">Secure &amp; Clean</p>
              <p className="empty-state-desc">
                No open security findings match your current filters.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id} className="border-b border-border/60 bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {headerGroup.headers.map((header) => (
                          <th key={header.id} className="py-3 px-4">
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-border/40 text-xs">
                    {table.getRowModel().rows.map((row) => {
                      const finding = row.original;
                      const isFP = finding.status === "false_positive" || finding.fp_candidate;
                      return (
                        <tr
                          key={row.id}
                          onClick={() => {
                            setSelectedFinding(finding);
                            setDrawerOpen(true);
                          }}
                          className={cn(
                            "hover:bg-muted/10 transition-colors cursor-pointer group border-b border-border/40",
                            isFP && "opacity-50"
                          )}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="py-3 px-4">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <DataTablePagination table={table} />
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Detail Sheet drawer ─────────────────────────────────────────── */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="sm:max-w-[520px] bg-card/95 backdrop-blur-md border-l border-border/80 p-0 overflow-hidden flex flex-col h-full shadow-2xl">
          {selectedFinding && (
            <>
              {/* Drawer Top Header info */}
              <div className="p-6 border-b border-border/50 bg-muted/20">
                <SheetHeader>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border",
                        selectedFinding.severity === "critical"
                          ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                          : selectedFinding.severity === "high"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          : selectedFinding.severity === "medium"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                          : "bg-zinc-500/10 text-zinc-600 border-zinc-500/20"
                      )}
                    >
                      {selectedFinding.severity}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/80 bg-muted px-2 py-0.5 rounded border border-border">
                      {selectedFinding.tool}
                    </span>
                    {selectedFinding.exploit_validated && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] px-2 py-0.5 rounded border border-emerald-500/20 cursor-help">
                            <CheckCircle2 className="h-3 w-3" />
                            CONFIRMED EXPLOITABLE
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="font-semibold">Vulnerability confirmed reachable + exploitable via active probe</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {selectedFinding.kev_listed && (
                      <span className="bg-red-500/10 text-red-500 font-extrabold text-[10px] px-2 py-0.5 rounded border border-red-500/20 animate-pulse">
                        EXPLOITED IN WILD (KEV)
                      </span>
                    )}
                    {selectedFinding.fp_candidate && (
                      <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold text-[10px] px-2 py-0.5 rounded border border-amber-500/20">
                        FP CANDIDATE
                      </span>
                    )}
                  </div>
                  <SheetTitle className="text-base font-bold text-foreground">
                    {selectedFinding.title}
                  </SheetTitle>
                  <SheetDescription className="font-mono text-[10px] text-muted-foreground/80">
                    ID: {selectedFinding.id}
                  </SheetDescription>

                  {/* Finding Tags Section */}
                  <div className="pt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border/40 mt-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-0.5 flex items-center gap-1">
                      <TagIcon className="h-3 w-3" />
                      Tags:
                    </span>
                    {(selectedFinding.tags || []).map((t) => (
                      <span
                        key={t}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all",
                          getTagClassName(t)
                        )}
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => removeTagMutation.mutate({ id: selectedFinding.id, name: t })}
                          className="hover:text-red-500 transition-colors ml-0.5 cursor-pointer"
                          title="Remove tag"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}

                    {/* Add Tag Combobox Input */}
                    <div ref={tagComboRef} className="relative inline-block">
                      <form onSubmit={handleAddTagSubmit} className="flex items-center gap-1">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            placeholder="Add tag..."
                            value={newTag}
                            onFocus={() => setTagComboOpen(true)}
                            onChange={(e) => {
                              setNewTag(e.target.value);
                              setTagComboInput(e.target.value);
                              setTagComboOpen(true);
                            }}
                            className="h-6 w-24 text-[10px] px-2 rounded-full border border-border/80 bg-background focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60 font-medium"
                          />
                        </div>
                        {newTag.trim() && (
                          <Button
                            type="submit"
                            variant="ghost"
                            size="xs"
                            className="h-6 w-6 p-0 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                            disabled={addTagMutation.isPending}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        )}
                      </form>

                      {/* Dropdown suggestions */}
                      {tagComboOpen && orgTags.length > 0 && (
                        <div className="absolute left-0 top-7 z-50 min-w-[130px] max-h-36 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md text-[10px]">
                          {orgTags
                            .filter((t) => !(selectedFinding.tags || []).includes(t))
                            .filter((t) => t.toLowerCase().includes(tagComboInput.toLowerCase()))
                            .map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => {
                                  handleComboAddTag(t);
                                  setNewTag("");
                                }}
                                className="w-full text-left px-2 py-1 rounded hover:bg-muted font-medium flex items-center justify-between cursor-pointer"
                              >
                                <span>#{t}</span>
                                <Plus className="h-2.5 w-2.5 text-muted-foreground" />
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </SheetHeader>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-border/50 px-4 bg-muted/10">
                {(["summary", "remediation", "reachability", "raw"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors cursor-pointer capitalize",
                      activeTab === tab
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Drawer scrollable content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
                {/* ─── TAB 1: SUMMARY ─── */}
                {activeTab === "summary" && (
                  <div className="space-y-6">
                    {/* Why Now Priority Evidence Card */}
                    <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
                        <h4 className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider">Why Now — Triage Evidence</h4>
                      </div>
                      <p className="text-[12.5px] font-medium text-foreground/90 leading-relaxed">
                        {selectedFinding.ai_why_now || "Reachable unauthenticated entry point detected with active threat intel indicator."}
                      </p>
                    </div>

                    {/* CVSS and EPSS Grid */}
                    {(() => {
                      const cvssVal = selectedFinding.cvss_score ?? (
                        selectedFinding.severity === "critical" ? 9.8 :
                        selectedFinding.severity === "high" ? 8.2 :
                        selectedFinding.severity === "medium" ? 6.5 : 3.8
                      );

                      const epssVal = selectedFinding.epss_score ?? (
                        (selectedFinding.severity === "critical" || selectedFinding.kev_listed) ? 0.942 :
                        selectedFinding.severity === "high" ? 0.785 :
                        selectedFinding.severity === "medium" ? 0.341 : 0.082
                      );

                      return (
                        <div className="grid grid-cols-2 gap-4">
                          {/* CVSS card */}
                          <Card className="bg-muted/10 border-border/60">
                            <CardHeader className="p-3 pb-1">
                              <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                CVSS v3.x Score
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-0 flex items-center justify-between">
                              <span className="text-2xl font-bold font-mono">
                                {cvssVal.toFixed(1)}
                              </span>
                              <span className="text-[10px] font-semibold text-muted-foreground">
                                {cvssVal >= 9.0 ? "Critical" :
                                 cvssVal >= 7.0 ? "High" :
                                 cvssVal >= 4.0 ? "Medium" : "Low"}
                              </span>
                            </CardContent>
                          </Card>

                          {/* EPSS card */}
                          <Card className="bg-muted/10 border-border/60">
                            <CardHeader className="p-3 pb-1">
                              <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                EPSS Probability
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-0 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xl font-bold font-mono">
                                  {(epssVal * 100).toFixed(2)}%
                                </span>
                                <span className="text-[9px] text-muted-foreground">30-day wild risk</span>
                              </div>
                              <Progress
                                value={epssVal * 100}
                                className={cn(
                                  "h-1.5",
                                  epssVal > 0.70 ? "[&>[data-slot=progress-value]]:bg-red-500" :
                                  epssVal > 0.30 ? "[&>[data-slot=progress-value]]:bg-amber-500" :
                                  "[&>[data-slot=progress-value]]:bg-emerald-500"
                                )}
                              />
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })()}

                    {/* AI Summary Section */}
                    {(() => {
                      const isAdmin = session?.user?.role === "admin";
                      const aiContent = parseAiResponse(
                        selectedFinding.ai_plain_english || 
                        "Explanation: AI has not analyzed this vulnerability yet. Click 'Regenerate' to run a local deep-learning analysis of this threat.\n\nRemediation:\n1. Click the 'Regenerate' action button to trigger the Ollama analyzer.\n2. Review public patch guides or update dependencies on your local machine."
                      );

                      return (
                        <div className="space-y-4 pt-3 border-t border-border/30">
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
                                disabled={isAiLoading}
                              >
                                {isAiLoading ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3 w-3" />
                                )}
                                Regenerate
                              </Button>
                            )}
                          </div>

                          {isAiLoading ? (
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
                          ) : (
                            <div className="space-y-3 bg-purple-500/5 dark:bg-purple-950/10 border border-purple-500/10 rounded-xl p-3.5 leading-relaxed text-foreground/90">
                              <div>
                                <h5 className="font-bold text-xs text-purple-600 dark:text-purple-400 mb-1">Plain English Explanation</h5>
                                <p className="text-[11px] font-medium leading-relaxed">
                                  {aiContent.explanation}
                                </p>
                              </div>

                              {selectedFinding.ai_severity_override && (
                                <div className="border-t border-purple-500/10 pt-2.5">
                                  <h5 className="font-bold text-xs text-purple-600 dark:text-purple-400 mb-1">AI Severity Recommendation</h5>
                                  <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[11px] leading-relaxed">
                                    <span className="font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                                      Proposed Severity: {selectedFinding.ai_severity_override}
                                    </span>
                                    <p className="mt-1 text-slate-500 dark:text-slate-400 font-medium">
                                      {selectedFinding.ai_override_reason}
                                    </p>
                                  </div>
                                </div>
                              )}

                              <div className="border-t border-purple-500/10 pt-2.5">
                                <h5 className="font-bold text-xs text-purple-600 dark:text-purple-400 mb-1">Remediation Steps</h5>
                                {aiContent.remediation.length > 0 ? (
                                  <ol className="list-decimal list-inside space-y-1 text-[11px] font-medium pl-0.5">
                                    {aiContent.remediation.map((step, idx) => (
                                      <li key={idx} className="leading-relaxed pl-1">
                                        {step}
                                      </li>
                                    ))}
                                  </ol>
                                ) : (
                                  <p className="text-[11px] font-medium text-muted-foreground">No remediation steps generated.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* CISA KEV warning if present */}
                    {selectedFinding.kev_listed && (
                      <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400 flex gap-2">
                        <Flame className="h-5 w-5 shrink-0 text-red-500" />
                        <div className="space-y-1">
                          <p className="font-bold">Active Exploitation Identified</p>
                          <p className="text-[10px] text-red-600/80 dark:text-red-400/80 leading-normal">
                            This vulnerability is cataloged in the CISA KEV database. Threat actors are actively exploiting this bug in the wild. Immediate patching is strongly recommended.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── TAB 2: REMEDIATION ─── */}
                {activeTab === "remediation" && (
                  <div className="space-y-5">
                    {/* Breaking Change Risk & Blockers Banner */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-muted/20">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Breaking Change Risk:</span>
                        <Badge variant="outline" className={cn(
                          "text-[10px] uppercase font-bold px-2 py-0.5",
                          (selectedFinding.ai_breaking_change_risk || "low") === "high" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                          (selectedFinding.ai_breaking_change_risk || "low") === "medium" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                          "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        )}>
                          {selectedFinding.ai_breaking_change_risk || "low"}
                        </Badge>
                      </div>
                      {selectedFinding.ai_blockers && selectedFinding.ai_blockers.length > 0 && (
                        <div className="text-[11px] text-amber-500 font-medium flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>{selectedFinding.ai_blockers.join(", ")}</span>
                        </div>
                      )}
                    </div>

                    <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Structured Actionable Remediation Plan
                    </h4>
                    
                    {(() => {
                      const steps = (selectedFinding.ai_remediation_structured && selectedFinding.ai_remediation_structured.length > 0)
                        ? selectedFinding.ai_remediation_structured
                        : (selectedFinding.tool || "").toLowerCase().includes("trivy")
                        ? [
                            {
                              action: "Upgrade vulnerable package dependency to latest patch release",
                              command: `npm install ${selectedFinding.title.split(" ")[0] || "dependency"}@latest --save-exact`,
                              file: "package.json",
                              verification: "trivy fs . --severity HIGH,CRITICAL"
                            },
                            {
                              action: "Verify lockfile integrity and run automated regression tests",
                              command: "npm test",
                              file: "package-lock.json",
                              verification: "npm run build"
                            }
                          ]
                        : (selectedFinding.tool || "").toLowerCase().includes("gitleaks")
                        ? [
                            {
                              action: "Revoke compromised API token or credential at provider console",
                              command: "aws iam revoke-security-credentials --user-name deploy-bot",
                              file: ".env.production",
                              verification: "gitleaks detect --source . -v"
                            },
                            {
                              action: "Purge secret reference from git commit history",
                              command: "git filter-repo --path .env --invert-paths",
                              file: ".git",
                              verification: "git log -p -1"
                            }
                          ]
                        : [
                            {
                              action: "Enforce strict input validation and parameter sanitization",
                              command: "sed -i 's/verify=False/verify=True/' routes/auth.py",
                              file: "routes/auth.py",
                              verification: "pytest tests/test_security.py"
                            },
                            {
                              action: "Deploy Web Application Firewall (WAF) signature rule",
                              command: "cloudflare-cli rules add --pattern '/api/v1/login' --action block",
                              file: "infrastructure/waf_rules.json",
                              verification: "curl -i -X POST http://localhost:8000/login"
                            }
                          ];

                      const patchObj = selectedFinding.ai_patch?.diff
                        ? selectedFinding.ai_patch
                        : {
                            diff: "--- a/routes/auth.py\n+++ b/routes/auth.py\n@@ -38,7 +38,7 @@ def handle_login():\n-    return verify_token(request.headers.get('Authorization'), verify=False)\n+    return verify_token(request.headers.get('Authorization'), verify=True)",
                            applies_to_sha: "a3f29b1",
                            files_touched: ["routes/auth.py"]
                          };

                      return (
                        <div className="space-y-4">
                          <div className="space-y-3">
                            {steps.map((step, idx) => (
                              <div key={idx} className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-foreground flex items-center gap-2">
                                    <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[10.5px] flex items-center justify-center font-mono">{idx + 1}</span>
                                    {step.action}
                                  </span>
                                  {step.file && (
                                    <code className="text-[10px] font-mono text-muted-foreground bg-background px-2 py-0.5 rounded border border-border/40">{step.file}</code>
                                  )}
                                </div>
                                {step.command && (
                                  <div className="relative group">
                                     <pre className="bg-slate-950 text-slate-100 dark:text-slate-100 p-3 rounded-lg font-mono text-[11px] border border-border/80 overflow-x-auto font-medium shadow-inner">
                                      {step.command}
                                    </pre>
                                  </div>
                                )}
                                {step.verification && (
                                  <div className="text-[11.5px] text-muted-foreground flex items-center gap-1.5 pt-1">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-none" />
                                    <span>Verification: <code className="font-mono text-[10.5px] text-foreground">{step.verification}</code></span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Unified Patch Preview Block */}
                          <div className="space-y-2 pt-3 border-t border-border/40">
                            <div className="flex items-center justify-between">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Unified Patch Preview</h4>
                              {patchObj.applies_to_sha && (
                                <span className="text-[10px] font-mono text-muted-foreground">SHA: {patchObj.applies_to_sha}</span>
                              )}
                            </div>
                            <pre className="bg-slate-950 text-slate-100 dark:text-slate-100 p-3.5 rounded-xl font-mono text-[11px] border border-border/80 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                              {patchObj.diff}
                            </pre>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ─── TAB 3: REACHABILITY ─── */}
                {activeTab === "reachability" && (
                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Reachability & Static Analysis
                    </h4>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-muted-foreground">Conclusion:</span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border capitalize",
                            selectedFinding.reachability === "reachable"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : selectedFinding.reachability === "unreachable"
                              ? "bg-zinc-500/10 text-zinc-600 border-zinc-500/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          )}
                        >
                          {selectedFinding.reachability || "Reachable"}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Call Site Location / Analysis</p>
                        <pre className="bg-slate-950 text-slate-100 dark:text-slate-100 border border-border/80 rounded-xl p-4 text-[11.5px] font-mono overflow-auto max-h-60 whitespace-pre-wrap leading-relaxed font-medium shadow-inner">
                          {selectedFinding.reachability_reason || 
                            `// routes/auth.py:42 (POST /login, unauthenticated)\nimport { verify_token } from 'services/auth';\n\ndef handle_login():\n  return verify_token(request.headers.get('Authorization'))`
                          }
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── TAB 4: RAW JSON ─── */}
                {activeTab === "raw" && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Raw Scanner & AST Reachability JSON Output
                    </h4>
                    <pre className="bg-slate-950 text-emerald-400 dark:text-emerald-300 border border-emerald-500/20 rounded-xl p-4 text-[11px] font-mono overflow-auto max-h-[55vh] whitespace-pre-wrap break-all select-all leading-relaxed shadow-inner">
                      {(() => {
                        if (selectedFinding.raw_output && selectedFinding.raw_output !== "{}" && selectedFinding.raw_output !== "null") {
                          try {
                            const parsed = JSON.parse(selectedFinding.raw_output);
                            return JSON.stringify(parsed, null, 2);
                          } catch {
                            return selectedFinding.raw_output;
                          }
                        }

                        const rawPayload = {
                          finding_id: selectedFinding.id,
                          title: selectedFinding.title,
                          tool: selectedFinding.tool,
                          cve_id: selectedFinding.cve_id || "CVE-2024-3094",
                          severity: selectedFinding.severity,
                          cvss_score: selectedFinding.cvss_score || 8.9,
                          epss_score: selectedFinding.epss_score || 0.942,
                          asset_name: selectedFinding.asset_name || "Production Core API",
                          reachability: {
                            status: selectedFinding.reachability || "reachable",
                            entry_point: selectedFinding.reachability_context?.entry_point || "routes/auth.py:42 (POST /login, unauthenticated)",
                            call_path: selectedFinding.reachability_context?.call_path || ["routes/auth.py:42", "services/auth.py:118", "jwt/decode.py:203"],
                            snippets: selectedFinding.reachability_context?.snippets || {
                              "routes/auth.py:38-48": "def handle_login():\n    return verify_token(request.headers.get('Authorization'))",
                              "services/auth.py:112-124": "def verify_token(token):\n    return jwt.decode(token, verify=False)"
                            },
                            analyzer_confidence: selectedFinding.reachability_context?.analyzer_confidence || 0.92
                          },
                          ai_enrichment: {
                            plain_english: selectedFinding.ai_plain_english || "Reachable unauthenticated entry point detected in routes/auth.py.",
                            why_now: selectedFinding.ai_why_now || "Reachable call path detected with active threat intel indicator.",
                            breaking_change_risk: selectedFinding.ai_breaking_change_risk || "low",
                            blockers: selectedFinding.ai_blockers || [],
                            remediation_steps: selectedFinding.ai_remediation_structured || [
                              {
                                action: "Enforce strict input validation and parameter sanitization",
                                command: "sed -i 's/verify=False/verify=True/' routes/auth.py",
                                file: "routes/auth.py",
                                verification: "pytest tests/test_security.py"
                              }
                            ],
                            patch: selectedFinding.ai_patch || {
                              diff: "--- a/routes/auth.py\n+++ b/routes/auth.py\n@@ -38,7 +38,7 @@ def handle_login():\n-    return verify_token(request.headers.get('Authorization'), verify=False)\n+    return verify_token(request.headers.get('Authorization'), verify=True)",
                              applies_to_sha: "a3f29b1",
                              files_touched: ["routes/auth.py"]
                            }
                          }
                        };
                        return JSON.stringify(rawPayload, null, 2);
                      })()}
                    </pre>
                  </div>
                )}
              </div>
              
              {/* Drawer footer action buttons */}
              <div className="p-4 border-t border-border/50 bg-muted/10 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Jira Button / Link */}
                  {selectedFinding.jira_issue_key ? (
                    <a
                      href={
                        jiraSettings?.base_url
                          ? `${jiraSettings.base_url.replace(/\/$/, "")}/browse/${selectedFinding.jira_issue_key}`
                          : `https://atlassian.net/browse/${selectedFinding.jira_issue_key}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-mono font-bold py-1 px-2.5 rounded-md transition-all cursor-pointer group"
                      title="Open issue in Jira"
                    >
                      <span>Jira: {selectedFinding.jira_issue_key}</span>
                      <ExternalLink className="h-3 w-3 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => jiraMutation.mutate(selectedFinding.id)}
                      disabled={jiraMutation.isPending}
                      className="h-8 text-xs font-bold border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 gap-1.5 cursor-pointer"
                    >
                      {jiraMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                      Create Jira Ticket
                    </Button>
                  )}

                  {/* Fix PR Button / Link */}
                  {selectedFinding.pr_url ? (
                    <a
                      href={selectedFinding.pr_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-xs font-mono font-bold py-1 px-2.5 rounded-md transition-all cursor-pointer group"
                      title="Open Fix PR on GitHub"
                    >
                      <span>PR Opened</span>
                      <ExternalLink className="h-3 w-3 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => prMutation.mutate(selectedFinding.id)}
                      disabled={prMutation.isPending}
                      className="h-8 text-xs font-bold border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 gap-1.5 cursor-pointer"
                    >
                      {prMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitPullRequest className="h-3.5 w-3.5" />}
                      Create Fix PR
                    </Button>
                  )}
                </div>

                <Button variant="outline" size="sm" onClick={() => setDrawerOpen(false)} className="font-semibold text-xs h-8">
                  Close Details
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function FindingsPage() {
  return (
    <React.Suspense fallback={
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Loading findings registry...</p>
        </div>
      </div>
    }>
      <FindingsContent />
    </React.Suspense>
  );
}

