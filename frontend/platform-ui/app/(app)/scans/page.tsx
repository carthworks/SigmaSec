"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  Loader2, 
  Play, 
  Calendar, 
  AlertOctagon, 
  AlertTriangle,
  ArrowUpRight,
  Activity,
  Globe,
  Box,
  GitBranch,
} from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
} from "@tanstack/react-table";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LaunchScanDialog } from "@/components/scans/launch-scan-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
} from "@/components/ui/form";

// Define TypeScript interfaces matching FastAPI models
interface ScanData {
  id: string;
  target: string;
  scan_types: string[];
  created_at: string;
  status: string;
  findings_count?: {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
    info?: number;
  };
}

// Zod Validation Schema for Launching Scan
const scanFormSchema = z.object({
  target: z.string().min(1, "Target URL or repository path is required."),
  vuln: z.boolean(),
  sca: z.boolean(),
  secret: z.boolean(),
  active_validation: z.boolean(),
  docker_image: z.string().optional(),
  git_repo: z.string().optional(),
}).refine((data) => data.vuln || data.sca || data.secret, {
  message: "At least one scan type must be selected.",
  path: ["vuln"],
}).superRefine((data, ctx) => {
  if (data.sca) {
    if (!data.docker_image || data.docker_image.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Docker image is required when SCA is checked.",
        path: ["docker_image"],
      });
    } else if (!/^[a-z0-9-_/.:@]+$/.test(data.docker_image)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid format (use e.g. nginx:1.24).",
        path: ["docker_image"],
      });
    }
  }
  if (data.secret) {
    if (!data.git_repo || data.git_repo.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Git repository URL is required when Secrets Scan is checked.",
        path: ["git_repo"],
      });
    } else if (!/^https:\/\/(github|gitlab|bitbucket)\.com\/.+\.git$/.test(data.git_repo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must be a valid Git HTTPS URL ending with .git (e.g. github, gitlab, or bitbucket).",
        path: ["git_repo"],
      });
    }
  }
});

type ScanFormValues = z.infer<typeof scanFormSchema>;

export default function ScansListPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = React.useState(false);
  const [filterInput, setFilterInput] = React.useState("");

  const form = useForm<ScanFormValues>({
    resolver: zodResolver(scanFormSchema),
    defaultValues: {
      target: "",
      vuln: true,
      sca: false,
      secret: false,
      active_validation: false,
      docker_image: "",
      git_repo: "",
    },
  });

  const scaChecked = form.watch("sca");
  const secretChecked = form.watch("secret");

  // Query scans from FastAPI backend
  const { 
    data: scans = [], 
    isLoading: isFetchingScans, 
    error: fetchError 
  } = useQuery<ScanData[]>({
    queryKey: ["scans"],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/scans`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch scans");
      }
      return res.json();
    },
    enabled: !!token,
  });

  React.useEffect(() => {
    if (fetchError) {
      toast.error("Failed to load scans", {
        description: fetchError instanceof Error ? fetchError.message : "An error occurred while communicating with the backend API."
      });
    }
  }, [fetchError]);

  // Mutation to launch a new scan
  const launchScanMutation = useMutation({
    mutationFn: async (payload: { target: string; scan_types: string[]; active_validation?: boolean; docker_image?: string; git_repo?: string }) => {
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
      // Invalidate query to refresh scans list
      queryClient.invalidateQueries({ queryKey: ["scans"] });
      
      toast.success("Scan Launched Successfully", {
        description: `New scan for ${data.target} has been queued.`,
      });

      setIsOpen(false);
      form.reset();
    },
    onError: (err: any) => {
      toast.error("Failed to launch scan", {
        description: err.message || "An unexpected error occurred. Please try again.",
      });
    },
  });

  const onSubmit = (values: ScanFormValues) => {
    const selectedTypes: string[] = [];
    if (values.vuln) selectedTypes.push("vuln");
    if (values.sca) selectedTypes.push("sca");
    if (values.secret) selectedTypes.push("secret");

    launchScanMutation.mutate({
      target: values.target,
      scan_types: selectedTypes,
      active_validation: values.active_validation,
      docker_image: values.sca ? values.docker_image : undefined,
      git_repo: values.secret ? values.git_repo : undefined,
    });
  };

  // Filter scans list based on user search input
  const filteredData = React.useMemo(() => {
    return scans.filter((scan) =>
      scan.target.toLowerCase().includes(filterInput.toLowerCase())
    );
  }, [scans, filterInput]);

  // TanStack Table Columns definition
  const columns = React.useMemo<ColumnDef<ScanData>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: "Date",
        cell: ({ row }) => {
          const date = new Date(row.original.created_at);
          return (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Calendar className="h-3.5 w-3.5 opacity-60" />
              <span>{date.toLocaleString()}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "target",
        header: "Target",
        cell: ({ row }) => {
          return (
            <div className="flex flex-col gap-1 max-w-[280px]">
              <span className="font-semibold text-sm text-foreground truncate" title={row.original.target}>
                {row.original.target}
              </span>
              <div className="flex flex-wrap gap-1">
                {row.original.scan_types.map((type) => (
                  <span
                    key={type}
                    className="inline-flex text-[9px] font-semibold bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground capitalize border border-border/40"
                  >
                    {type === "vuln" ? "vulnerabilities" : type}
                  </span>
                ))}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                status === "complete"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : status === "running"
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 animate-pulse"
                  : status === "failed"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${
                status === "complete" ? "bg-emerald-500" :
                status === "running" ? "bg-blue-500" :
                status === "failed" ? "bg-destructive" : "bg-amber-500"
              }`} />
              {status}
            </span>
          );
        },
      },
      {
        accessorKey: "findings_count",
        header: "Findings",
        cell: ({ row }) => {
          const counts = row.original.findings_count || {};
          const critical = counts.critical || 0;
          const high = counts.high || 0;
          const medium = counts.medium || 0;
          const low = counts.low || 0;
          
          if (row.original.status !== "complete") {
            return (
              <span className="text-xs text-muted-foreground/60 italic font-medium">
                {row.original.status === "running" ? "Analyzing..." : "Pending"}
              </span>
            );
          }

          const hasFindings = critical > 0 || high > 0 || medium > 0 || low > 0;
          if (!hasFindings) {
            return <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Clean</span>;
          }

          return (
            <div className="flex items-center gap-1.5 text-xs font-bold font-mono">
              <span
                className={`px-1.5 py-0.5 rounded ${
                  critical > 0 
                    ? "bg-destructive/20 text-destructive border border-destructive/30" 
                    : "bg-muted/30 text-muted-foreground/20 font-normal border border-transparent"
                }`}
                title="Critical"
              >
                {critical}C
              </span>
              <span
                className={`px-1.5 py-0.5 rounded ${
                  high > 0 
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" 
                    : "bg-muted/30 text-muted-foreground/20 font-normal border border-transparent"
                }`}
                title="High"
              >
                {high}H
              </span>
              <span
                className={`px-1.5 py-0.5 rounded ${
                  medium > 0 
                    ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" 
                    : "bg-muted/30 text-muted-foreground/20 font-normal border border-transparent"
                }`}
                title="Medium"
              >
                {medium}M
              </span>
              <span
                className={`px-1.5 py-0.5 rounded ${
                  low > 0 
                    ? "bg-muted/50 text-muted-foreground border border-border/40" 
                    : "bg-muted/30 text-muted-foreground/20 font-normal border border-transparent"
                }`}
                title="Low"
              >
                {low}L
              </span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          return (
            <div className="flex items-center gap-2">
              <Link
                href={`/scans/${row.original.id}`}
                onClick={(e) => e.stopPropagation()} // Stop propagation to avoid firing Row onClick redirect twice
                className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-card px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 gap-1"
              >
                <span>View</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
              </Link>
            </div>
          );
        },
      },
    ],
    []
  );

  // TanStack Table Instance
  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 15,
      },
    },
  });

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Scans</h1>
          <p className="text-sm text-muted-foreground">
            Manage targets, trigger vulnerability modules, and analyze scanner run progress.
          </p>
        </div>

        {/* Launch New Scan Dialog Trigger */}
        <Button onClick={() => setIsOpen(true)} className="font-semibold tracking-wide gap-2 cursor-pointer">
          <Plus className="h-4 w-4" />
          Launch Scan
        </Button>

        <LaunchScanDialog open={isOpen} onOpenChange={setIsOpen} />
      </div>

      {/* Main Scans List Container */}
      {!isFetchingScans && !fetchError && scans.length === 0 ? (
        <Card className="border border-dashed rounded-lg bg-card/45 border-border/80 p-12 text-center max-w-2xl mx-auto shadow-sm">
          <Activity className="h-12 w-12 text-muted-foreground/35 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground">No scans yet</h3>
          <p className="text-xs text-muted-foreground/70 max-w-md mx-auto mt-1 mb-6">
            Start your first scan to analyze vulnerabilities, secrets, and software composition security vectors.
          </p>
          <Button onClick={() => setIsOpen(true)} className="font-semibold tracking-wide gap-2">
            <Plus className="h-4 w-4" />
            Start your first scan
          </Button>
        </Card>
      ) : (
        <Card className="border border-border/85 bg-card/60 backdrop-blur-sm shadow-sm">
          <div className="p-5 flex items-center justify-between border-b border-border/60 gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/80" />
              <Input
                placeholder="Search targets..."
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                className="pl-9 max-w-sm bg-background/50 border-border/80 focus:bg-background/80"
              />
            </div>
            <div className="text-xs text-muted-foreground/80 font-medium">
              Total Scans: <strong className="font-semibold text-foreground">{filteredData.length}</strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isFetchingScans ? (
                  Array.from({ length: 4 }).map((_, rowIndex) => (
                    <TableRow key={rowIndex} className="hover:bg-transparent border-b border-border/40">
                      <TableCell>
                        <Skeleton className="h-4 w-[180px]" />
                        <Skeleton className="h-3 w-[80px] mt-2 opacity-60" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-[85px] rounded-full" />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1.5">
                          <Skeleton className="h-5 w-[30px] rounded" />
                          <Skeleton className="h-5 w-[30px] rounded" />
                          <Skeleton className="h-5 w-[30px] rounded" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-8 w-[72px] rounded-md" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : fetchError ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-destructive font-semibold text-xs"
                    >
                      Failed to fetch scans. Please check your network connection or API status.
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="cursor-pointer hover:bg-muted/30 transition-all duration-200"
                      onClick={() => router.push(`/scans/${row.original.id}`)}
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
                  ))
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={columns.length}
                      className="py-0"
                    >
                      <div className="empty-state">
                        <Search className="empty-state-icon" />
                        <p className="empty-state-title">No matching scans</p>
                        <p className="empty-state-desc">
                          No scan targets match &ldquo;{filterInput}&rdquo;. Try a different search term.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {!isFetchingScans && !fetchError && filteredData.length > 0 && (
            <DataTablePagination table={table} />
          )}
        </Card>
      )}
    </div>
  );
}
