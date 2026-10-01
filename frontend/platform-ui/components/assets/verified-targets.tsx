"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Copy, Loader2, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Method = "dns_txt" | "http_file";

interface Verification {
  id: string;
  scope: string;
  method: Method;
  status: "verified" | "pending" | "expired";
  verified_at: string | null;
  last_checked_at: string | null;
  last_check_detail: string | null;
  instructions: {
    method: Method;
    covers: string;
    record_type?: string;
    record_name?: string;
    record_value?: string;
    url?: string;
    alternate_url?: string;
    file_contents?: string;
  };
}

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

async function apiError(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({}));
  throw new Error(typeof body?.detail === "string" ? body.detail : fallback);
}

function CopyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded border border-border/60 bg-background/80 px-2 py-1.5 font-mono text-[11px] text-foreground">
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2"
          aria-label={`Copy ${label}`}
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success("Copied");
          }}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<Verification["status"], string> = {
  verified: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  pending: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  expired: "bg-red-500/10 text-red-500 border-red-500/30",
};

/**
 * Domains and IPs the organisation has proven it controls. Web (Nuclei) and
 * network (Nmap) scans are only allowed against these.
 */
export function VerifiedTargets() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const [target, setTarget] = React.useState("");
  const [method, setMethod] = React.useState<Method>("dns_txt");

  const headers = React.useMemo(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }),
    [token]
  );

  const { data: rows = [], isLoading } = useQuery<Verification[]>({
    queryKey: ["target-verifications"],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`${API}/target-verifications`, { headers });
      if (!res.ok) return apiError(res, "Couldn't load verified targets");
      return res.json();
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["target-verifications"] });

  const start = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/target-verifications`, {
        method: "POST",
        headers,
        body: JSON.stringify({ target, method }),
      });
      if (!res.ok) return apiError(res, "Couldn't start verification");
      return res.json();
    },
    onSuccess: () => {
      setTarget("");
      refresh();
      toast.success("Verification started", { description: "Follow the instructions, then click Check now." });
    },
    onError: (e: Error) => toast.error("Couldn't start verification", { description: e.message }),
  });

  const check = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API}/target-verifications/${id}/check`, { method: "POST", headers });
      if (!res.ok) return apiError(res, "Check failed");
      return (await res.json()) as Verification;
    },
    onSuccess: (v) => {
      refresh();
      if (v.status === "verified") toast.success(`${v.scope} verified`);
      else toast.error("Not verified yet", { description: v.last_check_detail ?? undefined });
    },
    onError: (e: Error) => toast.error("Check failed", { description: e.message }),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API}/target-verifications/${id}`, { method: "DELETE", headers });
      if (!res.ok) return apiError(res, "Couldn't remove");
    },
    onSuccess: () => {
      refresh();
      toast.success("Verified target removed");
    },
    onError: (e: Error) => toast.error("Couldn't remove", { description: e.message }),
  });

  return (
    <Card className="border border-border/80 bg-card/60 shadow-sm">
      <CardHeader className="border-b border-border/60">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Verified targets
        </CardTitle>
        <CardDescription className="text-xs">
          Web and network scans only run against domains and IPs your organisation has proven it controls.
          Code, dependency and image scans don&apos;t need this. Verification lasts 90 days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (target.trim()) start.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="vt-target" className="text-xs font-semibold">Domain or IP</Label>
            <Input
              id="vt-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="example.com or 203.0.113.10"
              className="h-9 text-xs"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="vt-method" className="text-xs font-semibold">Method</Label>
            <select
              id="vt-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
              className="h-9 rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="dns_txt">DNS TXT record (domain + subdomains)</option>
              <option value="http_file">File on web server (this host only)</option>
            </select>
          </div>
          <Button type="submit" size="sm" className="h-9" disabled={!target.trim() || start.isPending}>
            {start.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Start verification"}
          </Button>
        </form>

        {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!isLoading && rows.length === 0 && (
          <p className="text-xs text-muted-foreground">No verified targets yet.</p>
        )}

        <div className="space-y-3">
          {rows.map((v) => (
            <div key={v.id} className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-foreground">{v.scope}</span>
                  <span className={cn("rounded border px-2 py-0.5 text-[10px] font-bold capitalize", STATUS_STYLE[v.status])}>
                    {v.status === "verified" ? <CheckCircle2 className="mr-1 inline h-3 w-3" /> : <Clock className="mr-1 inline h-3 w-3" />}
                    {v.status}
                  </span>
                  <span className="text-[11px] text-muted-foreground">covers {v.instructions.covers}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => check.mutate(v.id)} disabled={check.isPending}>
                    <RefreshCw className={cn("mr-1 h-3 w-3", check.isPending && "animate-spin")} />
                    {v.status === "verified" ? "Re-check" : "Check now"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    aria-label={`Remove ${v.scope}`}
                    onClick={() => revoke.mutate(v.id)}
                    disabled={revoke.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {v.status !== "verified" && (
                <div className="grid gap-2">
                  {v.method === "dns_txt" ? (
                    <>
                      <p className="text-[11px] text-muted-foreground">Add this TXT record at your DNS provider, then click Check now. DNS can take a few minutes to update.</p>
                      <CopyValue label="Name" value={v.instructions.record_name ?? ""} />
                      <CopyValue label="Value" value={v.instructions.record_value ?? ""} />
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] text-muted-foreground">Serve a file with this content at the URL below (HTTPS or HTTP, no redirects), then click Check now.</p>
                      <CopyValue label="URL" value={v.instructions.url ?? ""} />
                      <CopyValue label="File contents" value={v.instructions.file_contents ?? ""} />
                    </>
                  )}
                </div>
              )}

              {v.last_check_detail && (
                <p className="text-[11px] text-muted-foreground">
                  Last check{v.last_checked_at ? ` (${new Date(v.last_checked_at).toLocaleString()})` : ""}: {v.last_check_detail}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
