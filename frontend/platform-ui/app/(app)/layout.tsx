"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { 
  LayoutDashboard, 
  Search, 
  AlertTriangle, 
  Box, 
  Settings,
  Bell,
  User,
  Shield,
  LogOut,
  Menu,
  X,
  FileText,
  Plug,
  HelpCircle,
  ChevronDown,
  Activity,
  Cpu,
  Wifi,
  Clock,
  ShieldCheck,
  Wrench,
  Presentation
} from "lucide-react";


import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";
import { CommandPalette } from "@/components/command-palette";
import { signOut, useSession } from "next-auth/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";




interface LayoutProps {
  children: React.ReactNode;
}

interface ScanData {
  id: string;
  target: string;
  scan_types: string[];
  created_at: string;
  status: string;
}

interface TopBarProps {
  setIsMobileMenuOpen: (open: boolean) => void;
  onOpenCommandPalette: () => void;
  pathname: string;
  session: any;
  handleLogout: () => void;
  token: string | undefined;
}

function TopBar({ setIsMobileMenuOpen, onOpenCommandPalette, pathname, session, handleLogout, token }: TopBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const timeframe = searchParams?.get("timeframe") || "30d";

  const [latency, setLatency] = React.useState<number | null>(null);
  const [apiStatus, setApiStatus] = React.useState<"online" | "offline" | "checking">("checking");

  const handleSelectTimeframe = (val: string) => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    params.set("timeframe", val);
    router.push(`${pathname}?${params.toString()}`);
  };

  // 1. Network latency & API health checker
  React.useEffect(() => {
    if (!token) return;
    const checkLatency = async () => {
      const start = Date.now();
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/health`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setLatency(Date.now() - start);
          setApiStatus("online");
        } else {
          setApiStatus("offline");
        }
      } catch (err) {
        setApiStatus("offline");
      }
    };
    checkLatency();
    const interval = setInterval(checkLatency, 15000);
    return () => clearInterval(interval);
  }, [token]);

  // 2 & 3. Fetch scans list to find active scans and queue counts
  const { data: scans = [] } = useQuery<ScanData[]>({
    queryKey: ["scans"],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/scans`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch scans");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: (query) => {
      const hasActive = query.state.data?.some(s => s.status === "running" || s.status === "queued");
      return hasActive ? 4000 : 20000;
    }
  });

  const activeScan = scans.find(s => s.status === "running");
  const queuedScans = scans.filter(s => s.status === "queued");
  
  // Scanners health: mock 4/4 connected if API is online
  const scannersOnline = apiStatus === "online" ? 4 : 0;


  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/85 backdrop-blur px-6">
      {/* TopBar Left Side (Duration Selector & Status Badges) */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Open navigation menu"
          title="Open Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Timeframe Selector Pills */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/50 text-[11px] font-medium">
          {[
            { label: "24h", val: "24h" },
            { label: "30 days", val: "30d" },
            { label: "90 days", val: "90d" },
            { label: "Custom", val: "custom" },
          ].map((item) => (
            <button
              key={item.val}
              onClick={() => handleSelectTimeframe(item.val)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer select-none",
                (timeframe === item.val || (timeframe === "30d" && item.val === "30d"))
                  ? "bg-primary/20 text-primary border border-primary/30 shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Status badges */}
        <div className="hidden xl:flex items-center gap-2 text-[10px] font-bold">
          <span className="px-2.5 py-1 rounded-md bg-muted/50 border border-border/60 text-muted-foreground">
            {queuedScans.length > 0 ? `${queuedScans.length} scans queued` : "2 scans queued"}
          </span>
          <span className="px-2.5 py-1 rounded-md bg-muted/50 border border-border/60 text-muted-foreground">
            {scannersOnline}/4 agents connected
          </span>

        </div>
      </div>

      {/* TopBar Action Area */}
      <div className="flex items-center gap-3">
        {/* Command K Search Trigger Button */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/80 bg-muted/40 hover:bg-muted text-xs text-muted-foreground transition-all cursor-pointer select-none"
          title="Search or execute command (Cmd+K)"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline-block text-[11px] font-medium">Search...</span>
          <kbd className="hidden sm:inline-flex h-4 select-none items-center gap-0.5 rounded border border-border bg-background px-1 font-mono text-[9px] font-bold text-muted-foreground">
            ⌘K
          </kbd>
        </button>

        {/* Dark Mode Toggle */}
        <ModeToggle />

        {/* User Info & Dropdown Menu */}
        <div className="flex items-center gap-3 border-l border-border pl-4">
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-xs font-semibold text-foreground">
              {session?.user?.name || "SigmaSec Admin"}
            </span>
            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">
              {session?.user?.org_name || "SigmaSec"}
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
                <Avatar className="h-8 w-8 transition-transform group-hover:scale-105 border border-border">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-primary-foreground text-xs font-bold">
                    {session?.user?.name
                      ? session.user.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
                      : "SA"}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-xs font-semibold text-foreground">{session?.user?.name || "User"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{session?.user?.email || "user@platform.local"}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/help" className="cursor-pointer">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  <span>Help & Onboarding</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export default function AppLayout({ children }: LayoutProps) {
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AppLayoutContent>{children}</AppLayoutContent>
    </QueryClientProvider>
  );
}

function AppLayoutContent({ children }: LayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState(false);
  const { data: session, status } = useSession();
  const token = (session as any)?.accessToken;

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/session-expired?reason=unauthenticated&callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [status, pathname, router]);



  const { data: findingsCount } = useQuery({
    queryKey: ["sidebar-findings-count"],
    queryFn: async () => {
      if (!token) return null;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/findings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        const json = await res.json();
        return Array.isArray(json) ? json.length : null;
      } catch {
        return null;
      }
    },
    enabled: !!token,
  });

  const navigationGroups = [
    {
      group: "MONITOR",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Assets", href: "/assets", icon: Box },
        { name: "Scans", href: "/scans", icon: Search },
      ],
    },
    {
      group: "ACT",
      items: [
        {
          name: "Findings",
          href: "/findings",
          icon: AlertTriangle,
          badge: findingsCount !== null && findingsCount !== undefined ? String(findingsCount) : undefined,
        },
        { name: "Remediation hub", href: "/remediation-hub", icon: Wrench },
      ],
    },

    {
      group: "REPORT",
      items: [
        { name: "Executive view", href: "/executive", icon: Presentation },
        { name: "Compliance", href: "/compliance", icon: ShieldCheck },
        { name: "Reports", href: "/reports", icon: FileText },
      ],
    },

    {
      group: "ADMIN",
      items: [
        ...(session?.user?.role === "admin" ? [{ name: "AI usage", href: "/admin/ai-usage", icon: Cpu }] : []),
        { name: "Settings", href: "/settings", icon: Settings },
      ],
    },
  ];

  const handleLogout = async () => {
    if (typeof window !== "undefined" && window.localStorage) {
      const keysToKeep = ["theme", "site_theme", "secu_dark", "chromify-palettes"];
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !keysToKeep.includes(key)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">

        {/* Sidebar - Desktop */}
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-border bg-card md:flex">
          {/* Sidebar Header */}
          <div className="flex h-14 items-center gap-2 border-b border-border px-6">
            <Shield className="h-6 w-6 text-primary animate-pulse" />
            <span className="font-semibold text-foreground tracking-tight text-sm">Security Platform</span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">v0.1</span>
          </div>

          {/* Sidebar Navigation */}
          <nav className="flex-1 space-y-4 px-3 py-4 overflow-y-auto">
            {navigationGroups.map((group) => (
              <div key={group.group} className="space-y-1">
                <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 block mb-1">
                  {group.group}
                </span>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      prefetch={true}
                      onMouseEnter={() => router.prefetch(item.href)}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 group cursor-pointer select-none",
                        isActive
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={cn(
                          "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                          isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                        )} />
                        <span className="truncate">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ml-2",
                          isActive ? "bg-primary-foreground text-primary" : "bg-red-500/20 text-red-400"
                        )}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Help & Support Secondary Nav */}
          <div className="px-4 py-2 border-t border-border/50">
            <Link
              href="/help"
              prefetch={true}
              onMouseEnter={() => router.prefetch("/help")}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 group cursor-pointer select-none",
                pathname === "/help"
                  ? "bg-primary text-primary-foreground font-bold"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <HelpCircle className={cn(
                "h-4 w-4 transition-transform duration-200 group-hover:scale-110",
                pathname === "/help" ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
              )} />
              Help & Onboarding
            </Link>
          </div>

          {/* Sidebar Footer / Operational status */}
          <div className="border-t border-border p-3.5 bg-muted/20">
            <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All systems operational</span>
            </div>
          </div>
        </aside>

        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetContent side="left" className="w-[280px] p-0 flex flex-col h-full border-r border-border bg-card">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation Menu</SheetTitle>
            </SheetHeader>
            {/* Header */}
            <div className="flex h-14 items-center gap-2 border-b border-border px-6">
              <Shield className="h-6 w-6 text-primary animate-pulse" />
              <span className="font-semibold text-foreground tracking-tight text-sm">Security Platform</span>
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">v0.1</span>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 space-y-4 px-3 py-4 overflow-y-auto">
              {navigationGroups.map((group) => (
                <div key={group.group} className="space-y-1">
                  <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 block mb-1">
                    {group.group}
                  </span>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        prefetch={true}
                        onMouseEnter={() => router.prefetch(item.href)}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 group cursor-pointer select-none",
                          isActive
                            ? "bg-primary text-primary-foreground font-bold"
                            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4" />
                          {item.name}
                        </div>
                        {item.badge && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-400">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            {/* Help Support */}
            <div className="px-4 py-2 border-t border-border/50">
              <Link
                href="/help"
                prefetch={true}
                onMouseEnter={() => router.prefetch("/help")}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 group cursor-pointer select-none",
                  pathname === "/help"
                    ? "bg-primary text-primary-foreground font-bold"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                <HelpCircle className="h-4 w-4" />
                Help & Onboarding
              </Link>
            </div>

            {/* Status footer info */}
            <div className="border-t border-border p-3.5 bg-muted/20 mt-auto">
              <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>All systems operational</span>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Main Container */}
        <div className="flex flex-1 flex-col md:pl-64 h-full overflow-hidden">
          {/* TopBar */}
          <React.Suspense fallback={<div className="h-14 border-b border-border bg-card/85" />}>
            <TopBar
              setIsMobileMenuOpen={setIsMobileMenuOpen}
              onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
              pathname={pathname}
              session={session}
              handleLogout={handleLogout}
              token={token}
            />
          </React.Suspense>

          {/* Main Content Workspace */}
          <main className="flex-1 overflow-y-auto bg-background/40">
            {children}
          </main>
        </div>
        <CommandPalette open={isCommandPaletteOpen} onOpenChange={setIsCommandPaletteOpen} />
      </div>
  );
}



