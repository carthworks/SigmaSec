"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  Clock,
  ShieldAlert,
  LogIn,
  ArrowRight,
  Shield,
  RotateCcw,
} from "lucide-react";

function SessionExpiredContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const reason = searchParams.get("reason") || "timeout";

  const [countdown, setCountdown] = React.useState(15);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [callbackUrl, router]);

  const isDirectUrlAccess = reason === "unauthenticated" || reason === "direct";

  return (
    <div className="min-h-screen w-full bg-[#0B0F17] text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Ambient background glow & grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(244,63,94,0.12),rgba(255,255,255,0))]" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-2/3 right-1/4 w-[350px] h-[350px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cyber Grid Lines */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      <div className="relative z-10 max-w-md w-full text-center space-y-7">
        {/* Shield Icon Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shadow-xl shadow-rose-500/5">
          <Lock className="h-8 w-8 text-rose-400 animate-pulse" />
        </div>

        {/* Heading & Reason Subtitle */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-mono font-medium">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>SECURITY PERIMETER ENFORCED</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white pt-1">
            {isDirectUrlAccess ? "Authentication Required" : "Session Expired"}
          </h1>

          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            {isDirectUrlAccess
              ? "Direct URL access to platform security modules requires an authenticated user session."
              : "Your active security session has timed out due to inactivity or authorization key renewal."}
          </p>
        </div>

        {/* Target Route Diagnostic Card */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 text-left space-y-2.5 shadow-xl">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono border-b border-slate-800/80 pb-2">
            <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Shield className="h-3.5 w-3.5 text-indigo-400" />
              Protected Target Resource
            </span>
            <span className="text-amber-400 font-bold">ACCESS_DENIED</span>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Attempted URL:</span>
              <span className="text-slate-200 truncate max-w-[210px]">{mounted ? callbackUrl : "..."}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Policy Status:</span>
              <span className="text-rose-400">RESTRICTED</span>
            </div>
          </div>
        </div>

        {/* Action Button & Countdown */}
        <div className="space-y-3.5 pt-1">
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 group"
          >
            <LogIn className="h-4 w-4" />
            <span>Authenticate & Re-enter Platform</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-mono">
            <Clock className="h-3.5 w-3.5 text-slate-400 animate-spin" style={{ animationDuration: '4s' }} />
            <span>Auto-redirecting to login in <strong className="text-emerald-400 font-bold">{countdown}s</strong></span>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-800/60 text-[11px] text-slate-500">
          SigmaSec Security Platform • ISO 27001 & SOC 2 Boundary Protection
        </div>
      </div>
    </div>
  );
}

export default function SessionExpiredPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen w-full bg-[#0B0F17] flex items-center justify-center text-slate-500 font-mono text-xs">Verifying session state...</div>}>
      <SessionExpiredContent />
    </React.Suspense>
  );
}
