"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/theme-provider";

import {
  LayoutDashboard,
  Box,
  Search as SearchIcon,
  AlertTriangle,
  Wrench,
  Presentation,
  FileText,
  Cpu,
  Settings,
  HelpCircle,
  Plus,
  Flame,
  Sun,
  Moon,
  Command,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = React.useState("");

  // Keyboard shortcut Cmd+K / Ctrl+K listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, category: "Navigation" },
    { name: "Assets Inventory", href: "/assets", icon: Box, category: "Navigation" },
    { name: "Scan History", href: "/scans", icon: SearchIcon, category: "Navigation" },
    { name: "Vulnerability Findings", href: "/findings", icon: AlertTriangle, category: "Navigation" },
    { name: "Remediation Hub", href: "/remediation-hub", icon: Wrench, category: "Navigation" },
    { name: "Executive View", href: "/executive", icon: Presentation, category: "Navigation" },
    { name: "Security Reports", href: "/reports", icon: FileText, category: "Navigation" },
    { name: "AI Usage & Costs", href: "/admin/ai-usage", icon: Cpu, category: "Navigation" },
    { name: "Settings & Integrations", href: "/settings", icon: Settings, category: "Navigation" },
    { name: "Help & Onboarding", href: "/help", icon: HelpCircle, category: "Navigation" },
  ];

  const actionItems = [
    {
      name: "Launch New Scan",
      icon: Plus,
      category: "Quick Actions",
      action: () => {
        router.push("/scans");
        onOpenChange(false);
      },
    },
    {
      name: "View Critical KEV Exploits",
      icon: Flame,
      category: "Quick Actions",
      action: () => {
        router.push("/findings");
        onOpenChange(false);
      },
    },
    {
      name: "Export Security Report",
      icon: FileText,
      category: "Quick Actions",
      action: () => {
        router.push("/reports");
        onOpenChange(false);
      },
    },
    {
      name: theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
      icon: theme === "dark" ? Sun : Moon,
      category: "Quick Actions",
      action: () => {
        setTheme(theme === "dark" ? "light" : "dark");
        toast.info(`Switched theme to ${theme === "dark" ? "light" : "dark"} mode`);
        onOpenChange(false);
      },
    },
  ];

  const filteredNav = navItems.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase())
  );
  const filteredActions = actionItems.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleNavigate = (href: string) => {
    router.push(href);
    onOpenChange(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] p-0 gap-0 border border-border bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden">
        {/* Search header */}
        <div className="flex items-center px-4 border-b border-border/60 bg-muted/20">
          <SearchIcon className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
          <Input
            placeholder="Type a command or search platform (e.g. Scans, KEV, Settings)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-foreground placeholder:text-muted-foreground/60"
            autoFocus
          />
          <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            Esc
          </kbd>
        </div>

        {/* Command list content */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-4">
          {filteredNav.length === 0 && filteredActions.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground flex flex-col items-center gap-1.5">
              <ShieldAlert className="h-6 w-6 text-muted-foreground/50" />
              <span>No command or page found matching &quot;{query}&quot;</span>
            </div>
          ) : (
            <>
              {/* Navigation Items */}
              {filteredNav.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    Navigation Pages
                  </div>
                  {filteredNav.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.name}
                        onClick={() => handleNavigate(item.href)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-foreground/90 hover:bg-primary/10 hover:text-primary transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          <span>{item.name}</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Action Items */}
              {filteredActions.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    Quick Actions & Shortcuts
                  </div>
                  {filteredActions.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.name}
                        onClick={item.action}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-foreground/90 hover:bg-primary/10 hover:text-primary transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 text-indigo-500 group-hover:text-primary transition-colors" />
                          <span>{item.name}</span>
                        </div>
                        <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[9px] font-semibold text-muted-foreground">
                          Enter ↵
                        </kbd>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2 border-t border-border/60 bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <Command className="h-3 w-3 text-primary" />
            <span>SigmaSec Command Center</span>
          </div>
          <span>Use <kbd className="font-mono text-[9px] font-bold">Cmd+K</kbd> anywhere to trigger</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
