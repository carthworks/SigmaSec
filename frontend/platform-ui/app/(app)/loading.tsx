"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full gap-4 text-center select-none animate-in fade-in duration-300">
      <div className="relative flex items-center justify-center">
        {/* Core spinner */}
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        
        {/* Outer glowing pulsing aura */}
        <div className="absolute h-10 w-10 rounded-full border border-primary/20 animate-ping opacity-45 pointer-events-none" />
      </div>
      
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-foreground">SigmaSec</h3>
        <p className="text-[11px] text-muted-foreground tracking-wider uppercase font-semibold animate-pulse">
          Loading intelligence workspace...
        </p>
      </div>
    </div>
  );
}
