"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Globe,
  Loader2,
  Play,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useSession } from "next-auth/react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

interface LaunchScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTarget?: string;
}

interface Asset {
  id: string;
  name: string;
  target: string;
  asset_type: string;
}

interface ScanData {
  id: string;
  target: string;
  created_at: string;
}

export function detectTargetType(target: string): "git" | "url" | "docker" {
  const trimmed = target.trim().toLowerCase();
  if (!trimmed) return "git";

  if (
    trimmed.includes("github.com") ||
    trimmed.includes("gitlab.com") ||
    trimmed.includes("bitbucket.org") ||
    trimmed.endsWith(".git") ||
    trimmed.startsWith("git@")
  ) {
    return "git";
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    /^[a-z0-9-]+(\.[a-z0-9-]+)+/.test(trimmed)
  ) {
    return "url";
  }

  if (trimmed.includes(":") || trimmed.includes("/")) {
    return "docker";
  }

  return "git";
}

export function LaunchScanDialog({
  open,
  onOpenChange,
  defaultTarget = "github.com/carthworks/LibraDigit_web",
}: LaunchScanDialogProps) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const queryClient = useQueryClient();

  // Form states
  const [target, setTarget] = React.useState(defaultTarget);
  const [schedule, setSchedule] = React.useState<"once" | "pr" | "daily" | "weekly">("once");

  // Scanner toggles
  const [trivyEnabled, setTrivyEnabled] = React.useState(true);
  const [gitleaksEnabled, setGitleaksEnabled] = React.useState(true);
  const [nucleiEnabled, setNucleiEnabled] = React.useState(false);
  const [openGroupEnabled, setOpenGroupEnabled] = React.useState(true);
  const [nmapEnabled, setNmapEnabled] = React.useState(false);

  // Dedicated Scanner Inputs
  const [nucleiTargetUrl, setNucleiTargetUrl] = React.useState("");
  const [gitleaksRepoUrl, setGitleaksRepoUrl] = React.useState("");
  const [trivyDockerImage, setTrivyDockerImage] = React.useState("");

  // Accordion states
  const [repoAccessOpen, setRepoAccessOpen] = React.useState(true);
  const [scopeOpen, setScopeOpen] = React.useState(true);

  // Scope options
  const [skipVendor, setSkipVendor] = React.useState(true);
  const [defaultBranchOnly, setDefaultBranchOnly] = React.useState(true);
  const [fullCommitHistory, setFullCommitHistory] = React.useState(false);
  const [excludePatterns, setExcludePatterns] = React.useState("docs/**, *.min.js");

  // Active testing states
  const [activeValidation, setActiveValidation] = React.useState(false);
  const [authorizedCheck, setAuthorizedCheck] = React.useState(false);

  const targetType = React.useMemo(() => detectTargetType(target), [target]);

  // Sync default input values when primary target changes
  React.useEffect(() => {
    if (targetType === "git") {
      setTrivyEnabled(true);
      setGitleaksEnabled(true);
      setNucleiEnabled(false);
      setOpenGroupEnabled(true);
      setNmapEnabled(false);
      setGitleaksRepoUrl(target);
    } else if (targetType === "url") {
      setTrivyEnabled(false);
      setGitleaksEnabled(false);
      setNucleiEnabled(true);
      setOpenGroupEnabled(false);
      setNmapEnabled(true);
      setNucleiTargetUrl(target);
    } else if (targetType === "docker") {
      setTrivyEnabled(true);
      setGitleaksEnabled(false);
      setNucleiEnabled(false);
      setOpenGroupEnabled(false);
      setNmapEnabled(false);
      setTrivyDockerImage(target);
    }
  }, [target, targetType]);

  // Fetch organization assets
  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/assets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token && open,
  });

  // Fetch previous scans
  const { data: scans = [] } = useQuery<ScanData[]>({
    queryKey: ["scans"],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/scans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token && open,
  });

  // Extract unique previous target strings
  const previousTargets = React.useMemo(() => {
    const list: string[] = [];
    scans.forEach((s) => {
      if (s.target && !list.includes(s.target)) {
        list.push(s.target);
      }
    });
    return list.slice(0, 10);
  }, [scans]);

  // Calculated active scanner count & time estimate
  const activeScannersCount =
    (trivyEnabled ? 1 : 0) +
    (gitleaksEnabled ? 1 : 0) +
    (nucleiEnabled ? 1 : 0) +
    (openGroupEnabled ? 1 : 0) +
    (nmapEnabled ? 1 : 0);

  const estimatedMinutes =
    (trivyEnabled ? 2 : 0) +
    (gitleaksEnabled ? 4 : 0) +
    (nucleiEnabled ? 3 : 0) +
    (openGroupEnabled ? 3 : 0) +
    (nmapEnabled ? 3 : 0);

  // Mutation to launch scan
  const launchScanMutation = useMutation({
    mutationFn: async (payload: {
      target: string;
      scan_types: string[];
      active_validation?: boolean;
      docker_image?: string;
      git_repo?: string;
    }) => {
      console.log("Scanning details" , payload);  
      if (!token) throw new Error("No session token available");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/scans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to launch scan");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["scans"] });
      toast.success("Scan Launched Successfully", {
        description: `Scan queued for target ${data.target}.`,
      });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error("Failed to launch scan", {
        description: err.message || "An error occurred while launching scan.",
      });
    },
  });

  const cleanUrlString = (str: string) => {
    if (!str) return "";
    return str.trim().replace(/^['"]|['"]$/g, "").trim();
  };

  const handleRunScan = () => {
    const cleanedTarget = cleanUrlString(target);
    if (!cleanedTarget) {
      toast.error("Target required", { description: "Please enter a target URL or repository." });
      return;
    }

    const selectedTypes: string[] = [];
    if (trivyEnabled) selectedTypes.push("sca");
    if (gitleaksEnabled) selectedTypes.push("secret");
    if (nucleiEnabled) selectedTypes.push("vuln");
    if (openGroupEnabled) selectedTypes.push("opengroup");
    if (nmapEnabled) selectedTypes.push("network");


    if (selectedTypes.length === 0) {
      toast.error("Select scanner", { description: "Please enable at least one scanner module." });
      return;
    }

    let effectiveTarget = cleanedTarget;
    let git_repo: string | undefined;
    let docker_image: string | undefined;

    // 1. Gitleaks Git repo URL handling
    if (gitleaksEnabled) {
      let repoInput = cleanUrlString(gitleaksRepoUrl) || (targetType === "git" ? cleanedTarget : "");
      if (!repoInput) {
        toast.error("Git Repository URL required", {
          description: "Gitleaks scanner requires a Git repository URL (e.g. github.com/org/repo).",
        });
        return;
      }
      if (!repoInput.startsWith("http://") && !repoInput.startsWith("https://") && !repoInput.startsWith("git@")) {
        repoInput = `https://${repoInput}`;
      }
      git_repo = repoInput;
    }

    // 2. Nuclei Live URL handling
    if (nucleiEnabled) {
      let urlInput = cleanUrlString(nucleiTargetUrl) || (targetType === "url" ? cleanedTarget : "");
      if (!urlInput) {
        toast.error("Live URL required for Nuclei", {
          description: "Nuclei scanner requires a Live Deployed URL (e.g. https://api.example.com).",
        });
        return;
      }
      if (!urlInput.startsWith("http://") && !urlInput.startsWith("https://")) {
        urlInput = `https://${urlInput}`;
      }
      effectiveTarget = urlInput;
    }

    // 3. Trivy Docker image handling
    if (trivyEnabled) {
      const dockerInput = cleanUrlString(trivyDockerImage);
      if (targetType === "docker") {
        docker_image = cleanedTarget;
      } else if (dockerInput) {
        docker_image = dockerInput;
      } else if (targetType === "git") {
        git_repo = git_repo || (cleanedTarget.startsWith("http") ? cleanedTarget : `https://${cleanedTarget}`);
      }
    }

    if (!authorizedCheck) {
      toast.error("Authorization required", {
        description: "You must confirm that you own this target or hold written authorisation to test it.",
      });
      return;
    }

    launchScanMutation.mutate({
      target: effectiveTarget,
      scan_types: selectedTypes,
      active_validation: activeValidation,
      docker_image,
      git_repo,
    });
  };

  const resetExclusions = () => {
    setSkipVendor(true);
    setDefaultBranchOnly(true);
    setFullCommitHistory(false);
    setExcludePatterns("docs/**, *.min.js");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl lg:max-w-5xl bg-[#0b0f19] border border-slate-800/80 text-slate-100 p-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-start justify-between">
          <div>
            <DialogTitle className="text-xl font-bold text-white tracking-tight">
              Launch scan
            </DialogTitle>
            <p className="text-xs text-slate-400 mt-1">
              Pick a target. We'll enable the scanners that can read it.
            </p>
          </div>
        </div>

        {/* Modal Body: Two Columns */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[75vh] overflow-y-auto">
          {/* Left Column */}
          <div className="lg:col-span-6 space-y-6">
            {/* Target Input Section */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-200 block">Target</label>
              <div className="relative flex items-center">
                <Input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="github.com/org/repo or https://example.com"
                  disabled={launchScanMutation.isPending}
                  className="bg-[#131b2e] border-slate-700/80 text-white placeholder:text-slate-500 pr-36 text-xs font-mono h-10 focus:border-indigo-500 focus:ring-indigo-500/20"
                />

                {/* Target Type Pill Badge */}
                <div className="absolute right-2 flex items-center pointer-events-none">
                  {targetType === "git" && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Git repository
                    </span>
                  )}
                  {targetType === "url" && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-950/80 text-blue-400 border border-blue-800/80">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                      Live URL
                    </span>
                  )}
                  {targetType === "docker" && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-800/80">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      Container image
                    </span>
                  )}
                </div>
              </div>

              {/* Target Quick Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {/* Rescan Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] bg-[#131b2e] border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Rescan a previous target
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-[#131b2e] border-slate-800 text-slate-200 max-w-xs">
                    <DropdownMenuLabel className="text-[11px] text-slate-400">Previous targets</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-slate-800" />
                    {previousTargets.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-slate-500">No previous targets found</div>
                    ) : (
                      previousTargets.map((pt, i) => (
                        <DropdownMenuItem
                          key={i}
                          onClick={() => setTarget(pt)}
                          className="text-xs font-mono hover:bg-slate-800 cursor-pointer truncate"
                        >
                          {pt}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Pick from Assets Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] bg-[#131b2e] border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 gap-1.5 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      Pick from Assets ({assets.length})
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-[#131b2e] border-slate-800 text-slate-200 max-w-xs">
                    <DropdownMenuLabel className="text-[11px] text-slate-400">Organization Assets</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-slate-800" />
                    {assets.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-slate-500">No assets registered yet</div>
                    ) : (
                      assets.map((ast) => (
                        <DropdownMenuItem
                          key={ast.id}
                          onClick={() => setTarget(ast.target || ast.name)}
                          className="text-xs hover:bg-slate-800 cursor-pointer justify-between"
                        >
                          <span className="font-medium truncate">{ast.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono ml-2">{ast.asset_type}</span>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                A domain or URL, a container image, or a Git repository. We detect the type automatically.
              </p>
            </div>

            {/* SCANNERS Section */}
            <div className="space-y-3 pt-2">
              <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                SCANNERS
              </h3>

              <div className="space-y-2.5">
                {/* Trivy Scanner */}
                <div
                  onClick={() => setTrivyEnabled(!trivyEnabled)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                    trivyEnabled
                      ? "bg-[#131b2e]/80 border-indigo-500/50"
                      : "bg-[#0f172a]/40 border-slate-800/80 opacity-70"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={trivyEnabled}
                    onChange={(e) => setTrivyEnabled(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500/20 accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Trivy</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-950/70 text-purple-300 border border-purple-800/60">
                          Recommended
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">~2 min</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Vulnerable dependencies in lockfiles and package manifests.
                    </p>
                  </div>
                </div>

                {/* Gitleaks Scanner */}
                <div
                  onClick={() => setGitleaksEnabled(!gitleaksEnabled)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                    gitleaksEnabled
                      ? "bg-[#131b2e]/80 border-indigo-500/50"
                      : "bg-[#0f172a]/40 border-slate-800/80 opacity-70"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={gitleaksEnabled}
                    onChange={(e) => setGitleaksEnabled(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500/20 accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Gitleaks</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-950/70 text-purple-300 border border-purple-800/60">
                          Recommended
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">~4 min</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      API keys, tokens, and certificates across commit history.
                    </p>
                  </div>
                </div>

                {/* Nuclei Scanner */}
                <div
                  onClick={() => setNucleiEnabled(!nucleiEnabled)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                    nucleiEnabled
                      ? "bg-[#131b2e]/80 border-indigo-500/50"
                      : "bg-[#0f172a]/40 border-slate-800/80 opacity-70"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={nucleiEnabled}
                    onChange={(e) => setNucleiEnabled(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500/20 accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Nuclei</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-950/70 text-purple-300 border border-purple-800/60">
                          {targetType === "url" ? "Recommended" : "Requires Live URL"}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">~3 min</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Web endpoints, ports, and configuration exposure. Scans live endpoints.
                    </p>
                  </div>
                </div>

                {/* OpenGroup Scanner */}
                <div
                  onClick={() => setOpenGroupEnabled(!openGroupEnabled)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                    openGroupEnabled
                      ? "bg-[#131b2e]/80 border-indigo-500/50"
                      : "bg-[#0f172a]/40 border-slate-800/80 opacity-70"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={openGroupEnabled}
                    onChange={(e) => setOpenGroupEnabled(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500/20 accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">OpenGroup</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-950/70 text-purple-300 border border-purple-800/60">
                          Recommended
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">~3 min</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Static security analysis (SAST) and code vulnerability rules across repository files.
                    </p>
                  </div>
                </div>

                {/* Nmap Port & Service Scanner */}
                <div
                  onClick={() => setNmapEnabled(!nmapEnabled)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                    nmapEnabled
                      ? "bg-[#131b2e]/80 border-indigo-500/50"
                      : "bg-[#0f172a]/40 border-slate-800/80 opacity-70"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={nmapEnabled}
                    onChange={(e) => setNmapEnabled(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500/20 accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Nmap</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-950/70 text-purple-300 border border-purple-800/60">
                          Network / Ports
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">~3 min</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Port scanning, service version detection, and exposed network service discovery.
                    </p>
                  </div>
                </div>

              </div>

              {/* DYNAMIC DEDICATED INPUTS FOR ENABLED SCANNERS */}
              <div className="space-y-3 pt-2">
                {/* 1. Gitleaks GitHub / Git Repo Input (when Gitleaks is enabled) */}
                {gitleaksEnabled && (
                  <div className="p-3.5 rounded-lg border border-purple-800/60 bg-purple-950/20 space-y-1.5 animate-in fade-in-50 duration-200">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <GitBranch className="h-3.5 w-3.5 text-purple-400" />
                        Git Repository URL (Gitleaks)
                      </label>
                      <span className="text-[10px] text-purple-400/80 font-medium">GitHub Input</span>
                    </div>
                    <Input
                      value={gitleaksRepoUrl}
                      onChange={(e) => setGitleaksRepoUrl(e.target.value)}
                      placeholder="github.com/carthworks/LibraDigit_web"
                      className="bg-[#0b0f19] border-purple-800/80 text-white placeholder:text-slate-500 font-mono text-xs h-9 focus:border-purple-500"
                    />
                    <p className="text-[10px] text-purple-300/70 leading-tight">
                      Gitleaks clones the GitHub repository and inspects commit history for leaked secrets and credentials.
                    </p>
                  </div>
                )}

                {/* 2. Nuclei Target Live URL Input (when Nuclei is enabled) */}
                {nucleiEnabled && (
                  <div className="p-3.5 rounded-lg border border-purple-800/60 bg-purple-950/20 space-y-1.5 animate-in fade-in-50 duration-200">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-purple-400" />
                        Target Deployed URL (Nuclei)
                      </label>
                      <span className="text-[10px] text-purple-400/80 font-medium">Live URL Input</span>
                    </div>
                    <Input
                      value={nucleiTargetUrl}
                      onChange={(e) => setNucleiTargetUrl(e.target.value)}
                      placeholder="e.g. https://api.libradigit.com or http://10.0.1.5"
                      className="bg-[#0b0f19] border-purple-800/80 text-white placeholder:text-slate-500 font-mono text-xs h-9 focus:border-purple-500"
                    />
                    <p className="text-[10px] text-purple-300/70 leading-tight">
                      Nuclei requires a live web URL or IP endpoint to send vulnerability assessment probes.
                    </p>
                  </div>
                )}

                {/* 3. Trivy Docker Container Image Input (when Trivy is enabled and primary target is Live URL) */}
                {trivyEnabled && targetType === "url" && (
                  <div className="p-3.5 rounded-lg border border-purple-800/60 bg-purple-950/20 space-y-1.5 animate-in fade-in-50 duration-200">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <Box className="h-3.5 w-3.5 text-purple-400" />
                        Docker Container Image (Trivy)
                      </label>
                      <span className="text-[10px] text-purple-400/80 font-medium">Container Input</span>
                    </div>
                    <Input
                      value={trivyDockerImage}
                      onChange={(e) => setTrivyDockerImage(e.target.value)}
                      placeholder="e.g. nginx:1.24 or myorg/api:latest"
                      className="bg-[#0b0f19] border-purple-800/80 text-white placeholder:text-slate-500 font-mono text-xs h-9 focus:border-purple-500"
                    />
                    <p className="text-[10px] text-purple-300/70 leading-tight">
                      Trivy checks container images and package manifests for vulnerable dependencies.
                    </p>
                  </div>
                )}
              </div>

              {/* Dynamic Note */}
              <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                {activeScannersCount > 0
                  ? `${activeScannersCount} ${activeScannersCount === 1 ? "scanner" : "scanners"} enabled for this run.`
                  : "Select at least one scanner module to launch scan."}
              </p>
            </div>

            {/* WHEN TO RUN Section */}
            <div className="space-y-2 pt-2">
              <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                WHEN TO RUN
              </h3>

              <div className="grid grid-cols-4 gap-1 p-1 bg-[#131b2e] border border-slate-800 rounded-lg text-xs font-medium text-slate-400">
                <button
                  type="button"
                  onClick={() => setSchedule("once")}
                  className={`py-1.5 text-center rounded transition-all cursor-pointer ${
                    schedule === "once"
                      ? "bg-slate-800 text-white font-semibold shadow-xs"
                      : "hover:text-slate-200"
                  }`}
                >
                  Once, now
                </button>
                <button
                  type="button"
                  onClick={() => setSchedule("pr")}
                  className={`py-1.5 text-center rounded transition-all cursor-pointer ${
                    schedule === "pr"
                      ? "bg-slate-800 text-white font-semibold shadow-xs"
                      : "hover:text-slate-200"
                  }`}
                >
                  Every PR
                </button>
                <button
                  type="button"
                  onClick={() => setSchedule("daily")}
                  className={`py-1.5 text-center rounded transition-all cursor-pointer ${
                    schedule === "daily"
                      ? "bg-slate-800 text-white font-semibold shadow-xs"
                      : "hover:text-slate-200"
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setSchedule("weekly")}
                  className={`py-1.5 text-center rounded transition-all cursor-pointer ${
                    schedule === "weekly"
                      ? "bg-slate-800 text-white font-semibold shadow-xs"
                      : "hover:text-slate-200"
                  }`}
                >
                  Weekly
                </button>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed pt-0.5">
                Continuous scanning catches regressions. A one-off scan goes stale within days.
              </p>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-6 space-y-6 lg:border-l lg:border-slate-800/80 lg:pl-6">
            {/* ACCESS AND SCOPE Header */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                ACCESS AND SCOPE
              </h3>

              {/* Accordion 1: Repository access */}
              <div className="border border-slate-800/80 rounded-lg bg-[#0f172a]/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setRepoAccessOpen(!repoAccessOpen)}
                  className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-white hover:bg-slate-800/40 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {repoAccessOpen ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                    <span>Repository access</span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">Connected</span>
                </button>

                {repoAccessOpen && (
                  <div className="px-4 pb-4 pt-1 space-y-2 border-t border-slate-800/60 bg-[#131b2e]/40 text-xs">
                    <div className="font-bold text-white">carthworks organisation</div>
                    <div className="text-slate-400 leading-relaxed text-[11px]">
                      GitHub App · read access to 12 repositories · connected 14 Jun 2026
                    </div>
                    {/* <div className="p-2.5 rounded bg-[#0b0f19] border border-slate-800/80 text-[11px] text-slate-300 leading-relaxed my-2">
                      <span className="font-bold text-white block mb-0.5">What permissions are granted?</span>
                      SigmaSec requests minimal permissions to write contents, create code branches (<code className="text-indigo-300 font-mono text-[10px]">fix/*</code>), commit patches, and open pull requests on repositories enabled in your installation.
                    </div> */}
                    <p className="text-[11px] text-slate-500 pt-1">
                      Private repositories need a connected app or deploy key. Public targets need no access.
                    </p>
                  </div>
                )}
              </div>

              {/* Accordion 2: Scope and exclusions */}
              <div className="border border-slate-800/80 rounded-lg bg-[#0f172a]/50 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => setScopeOpen(!scopeOpen)}
                    className="flex items-center gap-2 text-xs font-semibold text-white hover:bg-slate-800/40 cursor-pointer"
                  >
                    {scopeOpen ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                    <span>Scope and exclusions</span>
                  </button>

                  <button
                    type="button"
                    onClick={resetExclusions}
                    className="text-[11px] font-medium text-slate-400 hover:text-white cursor-pointer"
                  >
                    Defaults
                  </button>
                </div>

                {scopeOpen && (
                  <div className="p-4 space-y-3.5 text-xs bg-[#131b2e]/40">
                    {/* Skip test/vendor */}
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skipVendor}
                        onChange={(e) => setSkipVendor(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500/20 accent-indigo-600 cursor-pointer"
                      />
                      <div>
                        <span className="font-bold text-white block">Skip test and vendor directories</span>
                        <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                          **/test/** . **/fixtures/** . **/vendor/**
                        </span>
                      </div>
                    </label>

                    {/* Default branch only */}
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={defaultBranchOnly}
                        onChange={(e) => setDefaultBranchOnly(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500/20 accent-indigo-600 cursor-pointer"
                      />
                      <div>
                        <span className="font-bold text-white block">Default branch only</span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Uncheck to scan all branches — roughly 4x runtime.
                        </span>
                      </div>
                    </label>

                    {/* Full commit history */}
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fullCommitHistory}
                        onChange={(e) => setFullCommitHistory(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500/20 accent-indigo-600 cursor-pointer"
                      />
                      <div>
                        <span className="font-bold text-white block">Full commit history for secrets</span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Slower, but finds credentials that were committed then removed.
                        </span>
                      </div>
                    </label>

                    {/* Additional exclude patterns */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[11px] font-bold text-slate-300 block">
                        Additional exclude patterns
                      </label>
                      <Input
                        value={excludePatterns}
                        onChange={(e) => setExcludePatterns(e.target.value)}
                        placeholder="docs/**, *.min.js"
                        className="bg-[#0b0f19] border-slate-700/80 text-white font-mono text-xs h-9"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ACTIVE TESTING Section */}
            <div className="space-y-3 pt-2">
              <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                ACTIVE TESTING
              </h3>

              <div className="border border-red-900/60 bg-red-950/15 p-4 rounded-lg space-y-3.5">
                {/* Active exploit validation */}
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeValidation}
                    onChange={(e) => setActiveValidation(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-red-800 bg-slate-900 text-red-600 focus:ring-red-500/20 accent-red-600 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-red-400 text-xs block">Active exploit validation</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                      Sends real exploit probes to confirm findings are genuinely exploitable. Sharply reduces false positives, but generates live traffic and may trigger alerts, rate limits, or WAF blocks on the target.
                    </p>
                  </div>
                </label>

                {/* Authorization check */}
                <label className="flex items-start gap-2.5 cursor-pointer pt-1 border-t border-red-900/30">
                  <input
                    type="checkbox"
                    checked={authorizedCheck}
                    onChange={(e) => setAuthorizedCheck(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500/20 accent-indigo-600 cursor-pointer"
                  />
                  <div>
                    <span className="text-[11px] text-slate-300 leading-relaxed block font-medium">
                      I own this target or hold written authorisation to test it. <span className="text-red-400 font-bold">*</span>
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-slate-800/80 bg-[#0f172a]/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-300 font-medium">
            <span className="font-bold text-white">{activeScannersCount} scanners</span>
            {" · "}
            <span>about <strong className="text-white">{estimatedMinutes} minutes</strong></span>
            {" · "}
            <span className="text-slate-400">results appear in Findings</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={launchScanMutation.isPending}
              className="bg-[#131b2e] border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold h-9 px-4 cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleRunScan}
              disabled={launchScanMutation.isPending || activeScannersCount === 0}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 px-5 gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              {launchScanMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Queueing...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Run {activeScannersCount} {activeScannersCount === 1 ? "scanner" : "scanners"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
