"use client";

import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Box,
  ChevronRight,
  Container,
  GitBranch,
  Globe,
  Loader2,
  Play,
  Plus,
  Server,
  ShieldAlert,
  ShieldCheck
} from "lucide-react";
import { useSession } from "next-auth/react";
import * as React from "react";
import { toast } from "sonner";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
} from "@tanstack/react-table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Types mirroring the backend AssetOut schema exactly ───────────────────
interface Asset {
  id: string;
  org_id: string;
  name: string;
  target: string;
  asset_type: "url" | "docker_image" | "git_repo" | "host";
  asset_weight: number; // 0.5 | 1.0 | 1.5 | 2.0
  owner_email: string | null;
  last_scan: string | null;    // ISO datetime string or null
  findings_count: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  } | null;
}

interface ApiRawFinding {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  status: string;
  raw_output?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const WEIGHT_LABEL: Record<number, string> = {
  0.5: "Low",
  1.0: "Medium",
  1.5: "High",
  2.0: "Critical",
};

const TYPE_LABEL: Record<string, string> = {
  url: "Web App",
  docker_image: "Container",
  git_repo: "Repository",
  host: "Host / IP",
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-muted px-2 py-0.5 rounded text-muted-foreground">
      {type === "url" && <Globe className="h-3 w-3" />}
      {type === "docker_image" && <Container className="h-3 w-3" />}
      {type === "git_repo" && <GitBranch className="h-3 w-3" />}
      {type === "host" && <Server className="h-3 w-3" />}
      {TYPE_LABEL[type] ?? type}
    </span>
  );
}

function WeightBadge({ weight }: { weight: number }) {
  const color =
    weight >= 2.0
      ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
      : weight >= 1.5
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
      : weight >= 1.0
      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border",
        color
      )}
    >
      {WEIGHT_LABEL[weight] ?? weight}
    </span>
  );
}

function FindingsPills({
  counts,
}: {
  counts: Asset["findings_count"];
}) {
  if (!counts) return <span className="text-muted-foreground/60 text-[10px]">—</span>;
  const total =
    (counts.critical ?? 0) +
    (counts.high ?? 0) +
    (counts.medium ?? 0) +
    (counts.low ?? 0);
  if (total === 0) return <span className="text-muted-foreground/60 text-[10px]">—</span>;
  return (
    <div className="flex gap-1.5 text-[10px] font-extrabold">
      {counts.critical > 0 && (
        <span className="bg-red-500/10 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
          🔴 {counts.critical}
        </span>
      )}
      {counts.high > 0 && (
        <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
          🟠 {counts.high}
        </span>
      )}
      {counts.medium > 0 && (
        <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
          🟡 {counts.medium}
        </span>
      )}
      {counts.low > 0 && (
        <span className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded">
          🔵 {counts.low}
        </span>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function AssetsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();

  // Add-dialog state
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [formName, setFormName] = React.useState("");
  const [formType, setFormType] = React.useState<"url" | "docker_image" | "git_repo" | "host">("url");
  const [formTarget, setFormTarget] = React.useState("");
  const [formWeight, setFormWeight] = React.useState<number>(1.0);
  const [formEmail, setFormEmail] = React.useState("");

  // Findings drawer state
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerAssetId, setDrawerAssetId] = React.useState<string | null>(null);
  const [drawerAssetName, setDrawerAssetName] = React.useState<string>("");
  const [selectedFinding, setSelectedFinding] = React.useState<ApiRawFinding | null>(null);

  // ── Fetch all assets (real API) ──────────────────────────────────────────
  const {
    data: assets = [],
    isLoading,
    error,
  } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/assets`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed to fetch assets");
      return res.json();
    },
    enabled: !!token,
  });

  // ── Fetch findings for selected asset (real API) ─────────────────────────
  const { data: findings = [], isLoading: findingsLoading } = useQuery<ApiRawFinding[]>({
    queryKey: ["asset-findings", drawerAssetId],
    queryFn: async () => {
      if (!token || !drawerAssetId) return [];
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/assets/${drawerAssetId}/findings`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed to fetch findings");
      return res.json();
    },
    enabled: !!token && !!drawerAssetId,
  });

  React.useEffect(() => {
    if (findings.length > 0) setSelectedFinding(findings[0]);
    else setSelectedFinding(null);
  }, [findings]);

  // ── Create asset mutation ────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/assets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formName.trim(),
          target: formTarget.trim(),
          asset_type: formType,
          asset_weight: formWeight,
          owner_email: formEmail.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Failed to create asset");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["assets-count"] });
      toast.success("Asset created successfully");
      setIsAddOpen(false);
      setFormName("");
      setFormTarget("");
      setFormType("url");
      setFormWeight(1.0);
      setFormEmail("");
    },
    onError: (e: Error) => toast.error("Failed to create asset", { description: e.message }),
  });

  // ── Patch weight mutation ────────────────────────────────────────────────
  const weightMutation = useMutation({
    mutationFn: async ({ id, weight }: { id: string; weight: number }) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/assets/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ asset_weight: weight }),
        }
      );
      if (!res.ok) throw new Error("Failed to update weight");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Weight updated");
    },
    onError: (e: Error) => toast.error("Failed to update weight", { description: e.message }),
  });

  // ── Trigger scan mutation ────────────────────────────────────────────────
  const scanMutation = useMutation({
    mutationFn: async (asset: Asset) => {
      const scanTypes =
        asset.asset_type === "url"
          ? ["vuln"]
          : asset.asset_type === "docker_image"
          ? ["sca"]
          : ["secret"];
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/scans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          target: asset.target,
          scan_types: scanTypes,
          asset_id: asset.id,
        }),
      });
      if (!res.ok) throw new Error("Failed to trigger scan");
      return res.json();
    },
    onSuccess: () =>
      toast.success("Scan triggered", {
        description: "Check the Scans page to track progress.",
      }),
    onError: (e: Error) => toast.error("Failed to trigger scan", { description: e.message }),
  });

  // ── Derived summary stats (all from real data) ───────────────────────────
  const totalCriticalFindings = React.useMemo(
    () => assets.reduce((s, a) => s + (a.findings_count?.critical ?? 0), 0),
    [assets]
  );
  const totalFindings = React.useMemo(
    () =>
      assets.reduce(
        (s, a) =>
          s +
          (a.findings_count?.critical ?? 0) +
          (a.findings_count?.high ?? 0) +
          (a.findings_count?.medium ?? 0) +
          (a.findings_count?.low ?? 0),
        0
      ),
    [assets]
  );
  const assetsWithFindings = React.useMemo(
    () =>
      assets.filter(
        (a) =>
          (a.findings_count?.critical ?? 0) +
            (a.findings_count?.high ?? 0) +
            (a.findings_count?.medium ?? 0) +
            (a.findings_count?.low ?? 0) >
          0
      ).length,
    [assets]
  );
  const mostCriticalAsset = React.useMemo(
    () =>
      assets.reduce<Asset | null>((worst, a) => {
        const score = (a.findings_count?.critical ?? 0) * 4 + (a.findings_count?.high ?? 0) * 2 + (a.findings_count?.medium ?? 0);
        const worstScore = worst
          ? (worst.findings_count?.critical ?? 0) * 4 + (worst.findings_count?.high ?? 0) * 2 + (worst.findings_count?.medium ?? 0)
          : -1;
        return score > worstScore ? a : worst;
      }, null),
    [assets]
  );

  const columns = React.useMemo<ColumnDef<Asset>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name/Target",
        cell: ({ row }) => {
          const asset = row.original;
          return (
            <div>
              <div className="font-semibold text-foreground">{asset.name}</div>
              <div className="font-mono text-[11px] text-muted-foreground truncate max-w-[220px]" title={asset.target}>
                {asset.target}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "asset_type",
        header: "Type",
        cell: ({ row }) => <TypeBadge type={row.original.asset_type} />,
      },
      {
        accessorKey: "owner_email",
        header: "Owner",
        cell: ({ row }) => (
          <span className="text-[11px] text-muted-foreground">
            {row.original.owner_email ?? <span className="italic opacity-50">—</span>}
          </span>
        ),
      },
      {
        accessorKey: "asset_weight",
        header: "Weight",
        cell: ({ row }) => {
          const asset = row.original;
          return (
            <select
              value={asset.asset_weight}
              onChange={(e) =>
                weightMutation.mutate({
                  id: asset.id,
                  weight: parseFloat(e.target.value),
                })
              }
              className="rounded border border-border/80 bg-background/50 px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              <option value="0.5">Low (0.5)</option>
              <option value="1.0">Medium (1.0)</option>
              <option value="1.5">High (1.5)</option>
              <option value="2.0">Critical (2.0)</option>
            </select>
          );
        },
      },
      {
        id: "findings",
        header: "Findings",
        cell: ({ row }) => <FindingsPills counts={row.original.findings_count} />,
      },
      {
        accessorKey: "last_scan",
        header: "Last Scan",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {row.original.last_scan
              ? new Date(row.original.last_scan).toLocaleString()
              : <span className="italic opacity-50">Never</span>}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const asset = row.original;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => scanMutation.mutate(asset)}
                disabled={scanMutation.isPending}
                className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                title="Trigger scan"
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setDrawerAssetId(asset.id);
                  setDrawerAssetName(asset.name);
                  setDrawerOpen(true);
                }}
                className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="View findings"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [scanMutation, weightMutation]
  );

  const table = useReactTable({
    data: assets,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 15,
      },
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return toast.warning("Asset name is required.");
    if (!formTarget.trim()) return toast.warning("Scan target is required.");
    createMutation.mutate();
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Assets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and monitor your organization&apos;s scanned asset inventory.
          </p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2 font-semibold shadow-sm">
              <Plus className="h-4 w-4" /> Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[460px] border border-border bg-card/90 backdrop-blur-md shadow-2xl">
            <form onSubmit={handleAddSubmit}>
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-xl font-bold">Track New Asset</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Register a new target to the organization's security monitoring scope.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4 text-sm">
                {/* Name */}
                <div className="grid gap-1.5">
                  <Label htmlFor="f-name" className="text-xs font-semibold text-foreground/80">Asset Name</Label>
                  <Input
                    id="f-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Production API Gateway"
                    className="bg-background/50 border-border/80 text-xs"
                  />
                </div>

                {/* Type buttons */}
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold text-foreground/80">Asset Type</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["url", "docker_image", "git_repo", "host"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormType(t)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer",
                          formType === t
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/80 bg-background/50 hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {t === "url" && <Globe className="h-4 w-4" />}
                        {t === "docker_image" && <Container className="h-4 w-4" />}
                        {t === "git_repo" && <GitBranch className="h-4 w-4" />}
                        {t === "host" && <Server className="h-4 w-4" />}
                        {TYPE_LABEL[t]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target */}
                <div className="grid gap-1.5">
                  <Label htmlFor="f-target" className="text-xs font-semibold text-foreground/80">Scan Target</Label>
                  <Input
                    id="f-target"
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    placeholder={
                      formType === "url"
                        ? "https://api.mycorp.com"
                        : formType === "docker_image"
                        ? "nginx:alpine"
                        : formType === "host"
                        ? "192.168.1.1 or hostname.corp"
                        : "https://github.com/org/repo"
                    }
                    className="bg-background/50 border-border/80 font-mono text-xs"
                  />
                </div>

                {/* Weight */}
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold text-foreground/80">Business Weight</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {([0.5, 1.0, 1.5, 2.0] as const).map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setFormWeight(w)}
                        className={cn(
                          "py-2 rounded border text-[10px] font-bold uppercase transition-all cursor-pointer",
                          formWeight === w
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/80 bg-background/50 hover:bg-muted/80 text-muted-foreground"
                        )}
                      >
                        {WEIGHT_LABEL[w]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Owner email */}
                <div className="grid gap-1.5">
                  <Label htmlFor="f-email" className="text-xs font-semibold text-foreground/80">
                    Owner Email <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="f-email"
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="team@mycorp.com"
                    className="bg-background/50 border-border/80 text-xs"
                  />
                </div>
              </div>

              <DialogFooter className="border-t border-border/60 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  disabled={createMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</>
                  ) : (
                    "Create Asset"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Summary cards (all real data) ──────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total assets */}
        <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Assets
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-extrabold tracking-tight text-foreground">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : assets.length}
            </div>
            <div className="p-2 bg-blue-500/10 rounded-full text-blue-600 dark:text-blue-400">
              <Box className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Assets with findings */}
        <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Assets with Findings
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-extrabold tracking-tight text-foreground">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : assetsWithFindings}
            </div>
            <div className="p-2 bg-amber-500/10 rounded-full text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total critical findings */}
        <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Critical Findings
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-extrabold tracking-tight text-foreground">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : totalCriticalFindings}
            </div>
            <div className="p-2 bg-red-500/10 rounded-full text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Most at-risk asset */}
        <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Most At-Risk Asset
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : mostCriticalAsset ? (
              <>
                <div className="text-xs font-semibold text-foreground truncate">{mostCriticalAsset.name}</div>
                <div className="text-[10px] text-muted-foreground font-mono truncate">{mostCriticalAsset.target}</div>
                <FindingsPills counts={mostCriticalAsset.findings_count} />
              </>
            ) : (
              <div className="text-xs text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Assets table ───────────────────────────────────────────────── */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-lg font-semibold text-foreground">Asset Inventory</CardTitle>
          <CardDescription>
            All registered targets. Inline-edit weight · click ▶ to trigger a scan · click › to view findings.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-14">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading asset inventory…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-14">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm font-semibold text-foreground">Failed to load assets</p>
              <p className="text-xs text-muted-foreground">{String(error)}</p>
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14">
              <Box className="h-9 w-9 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">No assets yet</p>
              <p className="text-xs text-muted-foreground">
                Click <strong>Add Asset</strong> above, or run a scan — targets are auto-registered.
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
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/10 transition-colors group border-b border-border/40">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="py-3 px-4">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DataTablePagination table={table} />
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Findings drawer ────────────────────────────────────────────── */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="sm:max-w-[680px] border border-border bg-card/95 backdrop-blur-md shadow-2xl overflow-y-auto max-h-[85vh]">
          <DialogHeader className="border-b border-border pb-3">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Findings — {drawerAssetName}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Vulnerabilities linked to this asset from scanner output.
            </DialogDescription>
          </DialogHeader>

          {findingsLoading ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading findings…</p>
            </div>
          ) : findings.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <ShieldCheck className="h-10 w-10 text-emerald-500" />
              <p className="text-sm font-semibold text-foreground">No findings for this asset</p>
              <p className="text-xs text-muted-foreground">
                Run a scan first, or this target is currently clean.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-5 py-2">
              {/* Left: findings list */}
              <div className="md:col-span-2 border-r border-border/50 pr-4 space-y-2 max-h-[50vh] overflow-y-auto">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  {findings.length} finding{findings.length !== 1 ? "s" : ""}
                </p>
                {findings.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFinding(f)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border text-xs transition-all flex flex-col gap-1 cursor-pointer",
                      selectedFinding?.id === f.id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border/60 hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-foreground line-clamp-2">{f.title}</span>
                      <span
                        className={cn(
                          "shrink-0 inline-flex rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase",
                          f.severity === "critical"
                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                            : f.severity === "high"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : f.severity === "medium"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                        )}
                      >
                        {f.severity}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {f.status?.replace(/_/g, " ") ?? "new"}
                    </span>
                  </button>
                ))}
              </div>

              {/* Right: detail */}
              {selectedFinding && (
                <div className="md:col-span-3 space-y-4 text-xs">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{selectedFinding.title}</h3>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          selectedFinding.severity === "critical"
                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                            : selectedFinding.severity === "high"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : selectedFinding.severity === "medium"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                        )}
                      >
                        {selectedFinding.severity}
                      </span>
                      <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground capitalize">
                        {selectedFinding.status?.replace(/_/g, " ") ?? "new"}
                      </span>
                    </div>
                  </div>

                  {selectedFinding.raw_output && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Raw Output</p>
                      <pre className="bg-muted/40 border border-border/60 rounded p-3 text-[10px] font-mono overflow-auto max-h-48 whitespace-pre-wrap break-all">
                        {selectedFinding.raw_output}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="border-t border-border/60 pt-3">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
