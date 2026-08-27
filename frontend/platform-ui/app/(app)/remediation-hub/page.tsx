"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wrench,
  GitPullRequest,
  ShieldAlert,
  Cpu,
  Sparkles,
  ChevronRight,
  Loader2,
  ArrowRight,
  FileCode
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";

interface RemediationFinding {
  id: string;
  title: string;
  cve_id: string;
  severity: string;
  reachability: string;
  patch: string;
  remediation: string;
  package: string;
  installed_version: string;
  fixed_version: string;
  pr_url: string | null;
  ai_why_now?: string | null;
  breaking_change_risk?: string | null;
  confidence?: number | null;
}

interface RemediationHubAsset {
  asset_id: string;
  asset_name: string;
  target: string;
  asset_type: string;
  findings_count: number;
  reachable_count: number;
  patches_count: number;
  findings: RemediationFinding[];
}

interface SessionWithToken {
  accessToken?: string;
}

export default function RemediationHubPage() {
  const { data: session } = useSession();
  const token = (session as SessionWithToken | null)?.accessToken;
  const queryClient = useQueryClient();

  const [selectedAssetId, setSelectedAssetId] = React.useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = React.useState(false);
  const [selectedFindingIds, setSelectedFindingIds] = React.useState<Set<string>>(new Set());
  const [previewFinding, setPreviewFinding] = React.useState<RemediationFinding | null>(null);

  // Fetch Remediation Hub stats and asset list
  const { data: assets = [], isLoading, error } = useQuery<RemediationHubAsset[]>({
    queryKey: ["remediation-hub"],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/findings/remediation-hub`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch remediation hub data");
      return res.json();
    },
    enabled: !!token
  });

  // Bulk PR creation mutation
  const bulkPrMutation = useMutation({
    mutationFn: async ({ assetId, findingIds }: { assetId: string; findingIds: string[] }) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/findings/remediation-hub/bulk-pr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          asset_id: assetId,
          finding_ids: findingIds
        })
      });
      if (!res.ok) throw new Error("Failed to generate bulk Pull Request");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["remediation-hub"] });
      queryClient.invalidateQueries({ queryKey: ["findings"] });
      toast.success("Consolidated Pull Request opened!", {
        description: `Consolidated patch opened for review: ${data.pr_url}`,
      });
      setWorkspaceOpen(false);
      setSelectedFindingIds(new Set());
      setPreviewFinding(null);
    },
    onError: (e: Error) => {
      toast.error("Remediation consolidation failed", { description: e.message });
    }
  });

  // Derive the selected asset from live query data (stays in sync after refetch)
  const selectedAsset = React.useMemo(
    () => assets.find(a => a.asset_id === selectedAssetId) ?? null,
    [assets, selectedAssetId]
  );

  // Calculate Aggregates
  const stats = React.useMemo(() => {
    let totalFindings = 0;
    let reachableCount = 0;
    let totalPatches = 0;
    const activePrs = new Set<string>();

    assets.forEach(asset => {
      totalFindings += asset.findings_count;
      reachableCount += asset.reachable_count;
      totalPatches += asset.patches_count;
      asset.findings.forEach(f => {
        if (f.pr_url) {
          activePrs.add(f.pr_url);
        }
      });
    });

    return {
      totalFindings,
      reachableCount,
      totalPatches,
      activePrsCount: activePrs.size
    };
  }, [assets]);

  const handleOpenWorkspace = (asset: RemediationHubAsset) => {
    setSelectedAssetId(asset.asset_id);
    // Pre-select only findings that don't already have an open PR
    setSelectedFindingIds(new Set(asset.findings.filter(f => !f.pr_url).map(f => f.id)));
    setPreviewFinding(asset.findings[0] ?? null);
    setWorkspaceOpen(true);
  };

  const handleWorkspaceOpenChange = (open: boolean) => {
    setWorkspaceOpen(open);
    if (!open) {
      setSelectedFindingIds(new Set());
      setPreviewFinding(null);
    }
  };

  const handleToggleSelectFinding = (id: string) => {
    const next = new Set(selectedFindingIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedFindingIds(next);
  };

  const handleSelectAll = (findings: RemediationFinding[]) => {
    if (selectedFindingIds.size === findings.length) {
      setSelectedFindingIds(new Set());
    } else {
      setSelectedFindingIds(new Set(findings.map(f => f.id)));
    }
  };

  const handleTriggerBulkPr = () => {
    if (!selectedAsset || selectedFindingIds.size === 0) return;
    bulkPrMutation.mutate({
      assetId: selectedAsset.asset_id,
      findingIds: Array.from(selectedFindingIds)
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-xs font-semibold text-muted-foreground animate-pulse">
          Analyzing organization repositories for available AI patches...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 border border-destructive/20 rounded-lg bg-destructive/5 text-destructive max-w-lg mx-auto">
        <ShieldAlert className="h-8 w-8 text-destructive mx-auto mb-2" />
        <h3 className="font-semibold text-sm">Failed to load Remediation Hub</h3>
        <p className="text-xs text-muted-foreground mt-1">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <Wrench className="h-6 w-6 text-primary" />
          Remediation Hub
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consolidate AI patch code patches and resolve package vulnerabilities across repositories in a single combined PR.
        </p>
      </div>

      {/* Aggregate metrics block */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/50 border-border/80 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Total Open SCA Risks
            </CardTitle>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-extrabold tracking-tight text-foreground">{stats.totalFindings}</div>
            <p className="text-xs text-muted-foreground/80 leading-snug">Vulnerabilities detected across projects</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/80 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Reachable Path Risks
            </CardTitle>
            <Cpu className="h-4 w-4 text-amber-500 animate-pulse" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-extrabold tracking-tight text-foreground">{stats.reachableCount}</div>
            <p className="text-xs text-muted-foreground/80 leading-snug">Executing package call paths in AST</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/80 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Available AI Patches
            </CardTitle>
            <Sparkles className="h-4 w-4 text-emerald-500 animate-bounce" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-extrabold tracking-tight text-foreground">{stats.totalPatches}</div>
            <p className="text-xs text-muted-foreground/80 leading-snug">Automated patches ready for commit</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/80 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Consolidated Pull Requests
            </CardTitle>
            <GitPullRequest className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-extrabold tracking-tight text-foreground">{stats.activePrsCount}</div>
            <p className="text-xs text-muted-foreground/80 leading-snug">Consolidated PRs opened on GitHub</p>
          </CardContent>
        </Card>
      </div>

      {/* Projects list workspace */}
      <Card className="bg-card/50 border-border/80 overflow-hidden shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-lg font-semibold tracking-tight">Active Repositories & Packages</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Review vulnerabilities by scanned targets and consolidated patch availabilities.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-6">Repository Name / Target</th>
                  <th className="py-3 px-4 text-center">Open Risks</th>
                  <th className="py-3 px-4 text-center">Reachable Paths</th>
                  <th className="py-3 px-4 text-center">Patches Available</th>
                  <th className="py-3 px-4 min-w-[200px]">Remediation Coverage</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs">
                {assets.map((asset) => {
                  const coveragePct = asset.findings_count > 0 
                    ? Math.round((asset.patches_count / asset.findings_count) * 100) 
                    : 0;

                  return (
                    <tr key={asset.asset_id} className="hover:bg-muted/10 transition-colors border-b border-border/40">
                      <td className="py-3.5 px-6 max-w-sm">
                        <div className="font-semibold text-foreground truncate">{asset.asset_name}</div>
                        {asset.asset_name !== asset.target && (
                          <div className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">{asset.target}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-foreground/90">
                        {asset.findings_count}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge variant={asset.reachable_count > 0 ? "destructive" : "secondary"} className="font-semibold text-[9px] uppercase px-1.5 py-0.5">
                          {asset.reachable_count} Reachable
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        {asset.patches_count}
                      </td>
                      <td className="py-3.5 px-4 min-w-[200px]">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                            <span>{coveragePct}% auto-patch ready</span>
                          </div>
                          <Progress
                            value={coveragePct}
                            className={`h-1.5 w-full bg-muted/60 ${
                              coveragePct > 70
                                ? "[&>div]:bg-emerald-500"
                                : coveragePct > 30
                                  ? "[&>div]:bg-amber-500"
                                  : "[&>div]:bg-rose-500"
                            }`}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-right whitespace-nowrap">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleOpenWorkspace(asset)}
                          disabled={asset.patches_count === 0}
                          className="h-8 font-semibold text-xs border border-border/80 cursor-pointer text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-500/10 disabled:opacity-50"
                        >
                          Open Workspace
                          <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {assets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground font-semibold">
                      No assets with vulnerability scans found. Add assets and trigger scans to populate the Remediation Hub.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Workspace Panel Drawer (Full-Width Sheet) */}
      <Sheet open={workspaceOpen} onOpenChange={handleWorkspaceOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:w-full sm:max-w-none sm:max-w-full h-screen border-none bg-background p-0 overflow-hidden flex flex-col inset-0"
        >
          <div className="flex flex-col h-full overflow-hidden">
          {selectedAsset && (<>
              {/* ── Sticky Header ── */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-border/60 bg-card px-6 py-4 pr-16 gap-3 shrink-0">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5" />
                    Patch Consolidation Workspace
                  </span>
                  <SheetTitle className="text-xl font-bold text-foreground mt-0.5 truncate">
                    {selectedAsset.asset_name}
                  </SheetTitle>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">
                    Target: {selectedAsset.target}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-xl font-bold text-foreground">{selectedFindingIds.size} / {selectedAsset.findings.length}</div>
                    <div className="text-[10px] text-muted-foreground font-medium">patches selected</div>
                  </div>
                  <Button
                    onClick={handleTriggerBulkPr}
                    disabled={bulkPrMutation.isPending || selectedFindingIds.size === 0}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-5 text-sm flex items-center gap-2 cursor-pointer shadow-md rounded-lg"
                  >
                    {bulkPrMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Consolidating...</>
                    ) : (
                      <>
                        <GitPullRequest className="h-4 w-4" />
                        Generate Consolidated Fix PR
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* ── Body ── */}
              <div className="flex flex-1 min-h-0 overflow-hidden">

                {/* Left: Findings selector */}
                <div className="w-[340px] lg:w-[380px] xl:w-[420px] shrink-0 flex flex-col border-r border-border/60 overflow-hidden">
                  {/* Column header */}
                  <div className="flex justify-between items-center px-4 py-3 bg-muted/30 border-b border-border/40 shrink-0">
                    <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider">Available Patches</span>
                    <button
                      onClick={() => handleSelectAll(selectedAsset.findings)}
                      className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-400 cursor-pointer transition-colors"
                    >
                      {selectedFindingIds.size === selectedAsset.findings.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  {/* Scrollable list */}
                  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                    {selectedAsset.findings.map((f) => {
                      const isSelected = selectedFindingIds.has(f.id);
                      const isReachable = f.reachability === "reachable";

                      return (
                        <div
                          key={f.id}
                          onClick={() => setPreviewFinding(f)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                            previewFinding?.id === f.id
                              ? "border-primary/60 bg-primary/5 shadow-sm ring-1 ring-primary/20"
                              : "border-border/50 bg-card hover:bg-muted/40 hover:border-border"
                          }`}
                        >
                          {/* Row 1: checkbox + CVE + severity badge */}
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectFinding(f.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600 shrink-0"
                            />
                            <span className="font-mono text-[11px] font-extrabold text-foreground/90">
                              {f.cve_id}
                            </span>
                            <Badge
                              variant={f.severity === "critical" || f.severity === "high" ? "destructive" : "secondary"}
                              className="text-[9px] font-extrabold uppercase px-1.5 py-0 ml-auto"
                            >
                              {f.severity?.toUpperCase().slice(0, 2)}
                            </Badge>
                            {isReachable && (
                              <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-bold uppercase px-1.5 py-0">
                                REACH
                              </Badge>
                            )}
                          </div>

                          {/* Row 2: title */}
                          <div className="mt-2 text-xs font-semibold text-foreground/80 leading-snug" title={f.title}>
                            {f.title}
                          </div>

                          {/* Row 3: package + version arrow */}
                          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="bg-muted/60 rounded px-1.5 py-0.5 font-mono font-semibold text-foreground/70">
                              {f.package || "pkg"}
                            </span>
                            <span className="font-mono text-[10px]">{f.installed_version}</span>
                            <ArrowRight className="h-3 w-3 text-emerald-500 shrink-0" />
                            <span className="font-mono text-[10px] text-emerald-500 font-bold">{f.fixed_version}</span>
                          </div>

                          {/* Row 4: PR badge */}
                          {f.pr_url && (
                            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-emerald-500 font-semibold">
                              <GitPullRequest className="h-3 w-3" />
                              PR opened
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Patch preview */}
                <div className="flex-1 flex flex-col overflow-hidden bg-muted/10">
                  {previewFinding ? (
                    <div className="flex flex-col h-full overflow-hidden">
                      {/* Preview header */}
                      <div className="bg-muted/30 px-6 py-4 border-b border-border/50 flex justify-between items-start gap-4 shrink-0">
                        <div>
                          <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-emerald-500" />
                            Vulnerability Code Patch Preview
                          </h4>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Unified git diff for{" "}
                            <strong className="font-mono text-foreground/80">{previewFinding.cve_id}</strong>
                          </p>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px] bg-background/60 border-border/60 shrink-0">
                          {previewFinding.package}
                        </Badge>
                      </div>

                      {/* Preview body */}
                      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                        {/* Version comparison */}
                        <div className="grid grid-cols-2 gap-4 bg-card p-4 rounded-xl border border-border/50">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">Installed Version</span>
                            <div className="font-mono font-bold text-foreground text-sm">{previewFinding.installed_version}</div>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">Recommended Fix Version</span>
                            <div className="font-mono font-bold text-emerald-500 text-sm">{previewFinding.fixed_version}</div>
                          </div>
                        </div>

                        {/* AI Mitigation */}
                        {previewFinding.remediation && (
                          <div className="space-y-2">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 text-primary" />
                              AI Mitigation Guidance
                            </span>
                            <div className="bg-card p-4 rounded-xl border border-border/40 text-sm text-foreground/80 leading-relaxed">
                              {previewFinding.remediation}
                            </div>
                          </div>
                        )}

                        {/* Patch diff */}
                        {previewFinding.patch ? (
                          <div className="space-y-2">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
                              <FileCode className="h-3.5 w-3.5 text-primary" />
                              Patch Diff Snippet
                            </span>
                            <pre className="bg-zinc-950 text-slate-200 p-4 rounded-xl border border-zinc-800 font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed shadow-inner select-all min-h-[120px]">
                              {previewFinding.patch}
                            </pre>
                          </div>
                        ) : (
                          <div className="bg-amber-500/5 border border-amber-500/20 text-amber-500 p-4 rounded-xl text-sm font-medium text-center">
                            No direct code patch diff generated.{" "}
                            <span className="text-amber-400/80">AI recommends package configuration upgrades shown above.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full space-y-3 text-muted-foreground">
                      <Sparkles className="h-10 w-10 opacity-30 animate-pulse" />
                      <p className="text-sm font-semibold">Select a patch to preview its diff</p>
                      <p className="text-xs text-muted-foreground/60">Click any finding on the left to load its code preview.</p>
                    </div>
                  )}
                </div>

              </div>
          </>)}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
