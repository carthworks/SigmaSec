"use client";

import * as React from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, RefreshCw, Layers, ShieldCheck, Eye } from "lucide-react"

import { SeverityBadge } from "@/components/severity-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function DevBadgesPage() {
  // Gate check for development environment only
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const severities = ["critical", "high", "medium", "low", "info"];
  const [pulseDemo, setPulseDemo] = React.useState(false);

  return (
    <div className="min-h-screen bg-background/50 p-6 md:p-12 space-y-8 max-w-5xl mx-auto">
      {/* Header breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            <span>Developer Sandbox</span>
            <span>/</span>
            <span className="text-foreground">Visual QA Component Spec</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Severity Badges Showcase</h1>
          <p className="text-sm text-muted-foreground">
            Visual QA testbed displaying color-coded configurations for threat analysis badges.
          </p>
        </div>

        <Button asChild variant="outline" size="sm" className="gap-1.5 self-start sm:self-center">
          <Link href="/dashboard">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Showcase catalog */}
        <Card className="border border-border/80 bg-card/60 backdrop-blur shadow-sm">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-primary" />
              Severity Level Badges
            </CardTitle>
            <CardDescription className="text-xs">
              Color mappings for critical, high, medium, low, and info vulnerabilities.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-4">
              {severities.map((sev) => (
                <div key={sev} className="flex items-center justify-between border-b border-border/40 pb-2.5 last:border-b-0 last:pb-0">
                  <span className="text-xs font-mono font-semibold capitalize text-muted-foreground">{sev}</span>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={sev} className={pulseDemo ? "animate-pulse" : ""} />
                    <SeverityBadge severity={sev} className={`uppercase ${pulseDemo ? "animate-pulse" : ""}`} />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-border/50 flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground font-medium">Toggle Micro-animations:</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setPulseDemo(!pulseDemo)} 
                className="h-8 text-xs font-semibold gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${pulseDemo ? "animate-spin" : ""}`} />
                {pulseDemo ? "Disable Pulse" : "Enable Pulse"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* CSS Specs and custom sizes */}
        <Card className="border border-border/80 bg-card/60 backdrop-blur shadow-sm">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Eye className="h-4.5 w-4.5 text-primary" />
              Tailwind Color Specifications
            </CardTitle>
            <CardDescription className="text-xs">
              Classes injected by each variant mapped to the Tailwind utility engine.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-6 text-xs">
            {/* Critical */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <SeverityBadge severity="critical" />
                <span className="font-mono text-muted-foreground">bg-red-500/15 text-red-700 border-red-500/20</span>
              </div>
              <p className="text-[10px] text-muted-foreground/80 pl-2 border-l border-red-500/30">
                Used for CVSS 9.0–10.0 vulnerabilities requiring immediate triage.
              </p>
            </div>

            {/* High */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <SeverityBadge severity="high" />
                <span className="font-mono text-muted-foreground">bg-orange-500/15 text-orange-700 border-orange-500/20</span>
              </div>
              <p className="text-[10px] text-muted-foreground/80 pl-2 border-l border-orange-500/30">
                Used for CVSS 7.0–8.9 vectors exposing sensitive access paths.
              </p>
            </div>

            {/* Medium */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <SeverityBadge severity="medium" />
                <span className="font-mono text-muted-foreground">bg-amber-500/15 text-amber-700 border-amber-500/20</span>
              </div>
              <p className="text-[10px] text-muted-foreground/80 pl-2 border-l border-amber-500/30">
                Used for CVSS 4.0–6.9 configuration deficiencies.
              </p>
            </div>

            {/* Low */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <SeverityBadge severity="low" />
                <span className="font-mono text-muted-foreground">bg-blue-500/15 text-blue-700 border-blue-500/20</span>
              </div>
              <p className="text-[10px] text-muted-foreground/80 pl-2 border-l border-blue-500/30">
                Used for CVSS 0.1–3.9 minimal impact vulnerabilities.
              </p>
            </div>

            {/* Info */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <SeverityBadge severity="info" />
                <span className="font-mono text-muted-foreground">bg-slate-500/15 text-slate-700 border-slate-500/20</span>
              </div>
              <p className="text-[10px] text-muted-foreground/80 pl-2 border-l border-slate-500/30">
                Exposes scanning info or coordinates with no immediate severity impact.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
