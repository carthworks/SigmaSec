"use client";

import * as React from "react";
import {
  Terminal as TerminalIcon,
  Play,
  Pause,
  Download,
  Copy,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LiveTerminalProps {
  scanId: string;
  target?: string;
  scanTypes?: string[];
  status?: string;
  initialLogs?: string[];
  className?: string;
}

export function LiveTerminal({
  scanId,
  status = "running",
  initialLogs,
  className = "",
}: LiveTerminalProps) {
  // Shows only real scanner output passed in by the caller. It never generates
  // placeholder lines: a terminal that invents output can't be trusted.
  const logs = React.useMemo(() => initialLogs ?? [], [initialLogs]);
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const terminalEndRef = React.useRef<HTMLDivElement>(null);
  const isActive = status === "running" || status === "queued";

  // Auto-scroll to bottom on log append
  React.useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((line) =>
    line.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join("\n"));
    toast.success("Terminal logs copied to clipboard!");
  };

  const handleDownload = () => {
    const blob = new Blob([logs.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `scan-${scanId.slice(0, 8)}-terminal.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Downloaded terminal log file");
  };

  return (
    <div className={cn("rounded-xl border border-border/80 bg-zinc-950 text-zinc-100 font-mono shadow-2xl overflow-hidden flex flex-col h-[480px]", className)}>
      {/* Terminal Bar Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="text-zinc-400 font-bold flex items-center gap-1.5 ml-2">
            <TerminalIcon className="h-3.5 w-3.5 text-indigo-400" />
            Live Execution Log — {scanId.slice(0, 8)}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-800 text-zinc-300">
            {status}
          </span>
        </div>

        {/* Terminal Controls */}
        <div className="flex items-center gap-2">
          {/* Search Bar */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-36 pl-8 text-[11px] bg-zinc-950 border-zinc-800 text-zinc-200 focus-visible:ring-indigo-500"
            />
          </div>

          {/* Autoscroll toggle */}
          <Button
            size="xs"
            variant="outline"
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              "h-7 text-[11px] font-medium border-zinc-800 text-zinc-300 hover:bg-zinc-800 cursor-pointer gap-1",
              autoScroll && "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
            )}
            title="Toggle Live Auto-Scroll"
          >
            {autoScroll ? <Play className="h-3 w-3 text-indigo-400" /> : <Pause className="h-3 w-3" />}
            Auto-Scroll
          </Button>

          {/* Copy Logs */}
          <Button
            size="xs"
            variant="outline"
            onClick={handleCopy}
            className="h-7 text-[11px] border-zinc-800 text-zinc-300 hover:bg-zinc-800 cursor-pointer gap-1"
            title="Copy all logs"
          >
            <Copy className="h-3 w-3" />
            Copy
          </Button>

          {/* Download Log File */}
          <Button
            size="xs"
            variant="outline"
            onClick={handleDownload}
            className="h-7 text-[11px] border-zinc-800 text-zinc-300 hover:bg-zinc-800 cursor-pointer gap-1"
            title="Download .log file"
          >
            <Download className="h-3 w-3" />
            Export
          </Button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className="flex-1 p-4 overflow-y-auto space-y-1 text-[11.5px] leading-relaxed selection:bg-indigo-500 selection:text-white font-mono">
        {logs.length === 0 && (
          <div className="text-zinc-500">
            {isActive ? "Waiting for scanner output…" : "No scanner output was recorded for this scan."}
          </div>
        )}
        {filteredLogs.map((line, idx) => {
          const isCritical = line.includes("[CRITICAL]") || line.includes("CVE-");
          const isWarn = line.includes("[WARN]") || line.includes("WARNING");
          const isSuccess = line.includes("[SUCCESS]") || line.includes("completed");
          const isSystem = line.includes("[SYSTEM]") || line.includes("[INFO]");

          return (
            <div
              key={idx}
              className={cn(
                "flex items-start gap-2 border-l-2 pl-2 transition-colors hover:bg-zinc-900/40",
                isCritical
                  ? "border-red-500 text-red-400 font-semibold bg-red-950/10"
                  : isWarn
                  ? "border-amber-500 text-amber-300"
                  : isSuccess
                  ? "border-emerald-500 text-emerald-400"
                  : "border-zinc-800 text-zinc-300"
              )}
            >
              <span className="text-zinc-600 text-[10px] select-none min-w-[24px] text-right">
                {idx + 1}
              </span>
              <span className="whitespace-pre-wrap break-all">{line}</span>
            </div>
          );
        })}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
