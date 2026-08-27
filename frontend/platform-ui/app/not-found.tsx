"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

import {
  ShieldAlert,
  LayoutDashboard,
  Search,
  ArrowLeft,
  Terminal,
  Compass,
  Lock,
} from "lucide-react";

export default function NotFound() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);


  return (
    <div className="min-h-screen w-full bg-[#0B0F17] text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Ambient Glows & Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(225,29,72,0.15),rgba(255,255,255,0))]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cyber Grid Lines */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      <div className="relative z-10 max-w-2xl w-full text-center space-y-8">
        {/* Top Security Status Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-mono font-medium tracking-wide shadow-lg shadow-rose-500/5">
          <ShieldAlert className="h-4 w-4 animate-pulse" />
          <span>HTTP 401 / 404 — TARGET ENDPOINT NOT FOUND</span>
        </div>

        {/* Hero 404 Graphic Heading */}
        <div className="space-y-3">
          <h1 className="text-8xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 select-none">
            404
          </h1>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Security Resource Unreachable
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            The endpoint, report URL, or security asset you requested does not exist, has been relocated, or is restricted under your active organization boundary.
          </p>
        </div>

        {/* Quick Diagnostic Card */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 text-left max-w-md mx-auto space-y-3 shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono border-b border-slate-800/80 pb-2.5">
            <span className="flex items-center gap-2 text-slate-300 font-semibold">
              <Terminal className="h-3.5 w-3.5 text-emerald-400" />
              Route Telemetry Diagnostics
            </span>
            <span className="text-rose-400 font-bold">STATUS_FAIL</span>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Target Route:</span>
              <span className="text-slate-200 truncate max-w-[200px]">{mounted ? pathname : "/unreachable"}</span>

            </div>
            <div className="flex justify-between text-slate-400">
              <span>Security Perimeter:</span>
              <span className="text-emerald-400">ENFORCED (Active)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Recommended Action:</span>
              <span className="text-amber-400">Return to Posture Dashboard</span>
            </div>
          </div>
        </div>

        {/* Interactive Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
          <button
            onClick={() => router.back()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-medium text-xs transition flex items-center justify-center gap-2 shadow-sm"
          >
            <ArrowLeft className="h-4 w-4 text-slate-400" />
            Go Back
          </button>

          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <LayoutDashboard className="h-4 w-4" />
            Return to Dashboard
          </Link>

          <Link
            href="/scans"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-medium text-xs transition flex items-center justify-center gap-2"
          >
            <Search className="h-4 w-4 text-indigo-400" />
            View Active Scans
          </Link>
        </div>

        {/* Footer Hint */}
        <div className="pt-6 text-xs text-slate-500 flex items-center justify-center gap-1.5 font-mono">
          <Compass className="h-3.5 w-3.5 text-slate-600" />
          <span>Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-sans border border-slate-700 text-[10px]">Ctrl + K</kbd> anywhere to launch the Command Palette</span>
        </div>
      </div>
    </div>
  );
}
