"use client";

import * as React from "react";
import { AlertOctagon, RefreshCw, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Global crash captured by Error Boundary:", error);
  }, [error]);

  const handleReportBug = () => {
    const subject = encodeURIComponent("Bug Report: SigmaSec Platform Crash");
    const body = encodeURIComponent(
      `An unexpected crash occurred on the platform.\n\nError details:\n${error?.message || "Unknown error"}\n\nDigest: ${error?.digest || "N/A"}\n\nSteps to reproduce:\n`
    );
    window.location.href = `mailto:support@sigmasec.ai?subject=${subject}&body=${body}`;
  };

  return (
    <html lang="en" className="h-full">
      <head>
        <title>Application Error - SigmaSec</title>
      </head>
      <body className="h-full bg-background text-foreground flex items-center justify-center p-6 antialiased dark">
        <div className="max-w-md w-full bg-card/65 border border-border/80 rounded-2xl shadow-2xl p-8 text-center space-y-6 backdrop-blur-md">
          {/* Visual Alert Icon */}
          <div className="h-16 w-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center text-destructive shadow-inner animate-pulse">
            <AlertOctagon className="h-8 w-8" />
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Something went wrong
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              An unexpected system crash was intercepted. The security agent has safely isolated the error to protect your active session data.
            </p>
          </div>

          {/* Error Details */}
          {error?.message && (
            <div className="rounded-lg bg-muted/40 border border-border/60 p-3 text-[10px] font-mono text-muted-foreground/90 break-words text-left max-h-32 overflow-y-auto">
              <strong>Error:</strong> {error.message}
              {error.digest && (
                <div className="mt-1 opacity-70">
                  <strong>Digest:</strong> {error.digest}
                </div>
              )}
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              className="text-xs font-semibold gap-1.5 cursor-pointer h-9"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleReportBug}
              className="text-xs font-semibold gap-1.5 cursor-pointer h-9 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              <Flag className="h-3.5 w-3.5" />
              Report Bug
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
