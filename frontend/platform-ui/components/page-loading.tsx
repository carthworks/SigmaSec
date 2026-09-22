"use client";

import { Activity, Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";

const routeLabels: Array<[string, string]> = [
  ["/dashboard", "Preparing your security overview"],
  ["/scans", "Loading scan operations"],
  ["/findings", "Loading findings intelligence"],
  ["/assets", "Loading asset inventory"],
  ["/compliance", "Loading compliance posture"],
  ["/reports", "Preparing security reports"],
  ["/settings", "Loading workspace settings"],
  ["/login", "Securing your sign-in"],
  ["/signup", "Preparing your account"],
];

function getLoadingLabel(pathname: string | null) {
  const match = routeLabels.find(([route]) => pathname?.startsWith(route));
  return match?.[1] ?? "Loading SigmaSec workspace";
}

export function PageLoading() {
  const pathname = usePathname();
  const label = getLoadingLabel(pathname);

  return (
    <main
      className="flex min-h-[70vh] w-full items-center justify-center px-6 py-12"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
          <Activity className="h-6 w-6 text-primary motion-safe:animate-pulse" />
          <Loader2 className="absolute -right-2 -top-2 h-5 w-5 text-primary motion-safe:animate-spin" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">SigmaSec</p>
          <p className="text-xs font-medium tracking-wide text-muted-foreground">{label}</p>
        </div>
        <div className="h-1 w-full max-w-55 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/5 rounded-full bg-primary motion-safe:animate-[loading-slide_1.4s_ease-in-out_infinite]" />
        </div>
      </div>
    </main>
  );
}
