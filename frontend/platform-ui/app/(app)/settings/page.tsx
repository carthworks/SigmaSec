"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  User, 
  Settings, 
  Plug, 
  Shield, 
  Building2, 
  Mail, 
  Key, 
  CheckCircle2, 
  Bell, 
  Sun,
  Moon,
  Monitor,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  GitBranch,
  GitPullRequest,
  Database,
  UploadCloud,
  Gift,
  Zap,
  Award
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";

const UserIcon = User;

function Slack({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="currentColor"
    >
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52-2.523 2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zm1.261 0a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.043a2.528 2.528 0 0 1-2.522 2.52H8.823a2.528 2.528 0 0 1-2.52-2.52v-5.043zm0-3.783a2.528 2.528 0 0 1 2.52-2.522 2.528 2.528 0 0 1 2.522 2.522v2.52h-2.522a2.528 2.528 0 0 1-2.52-2.52zm0-1.261a2.528 2.528 0 0 1 2.52-5.043A2.528 2.528 0 0 1 11.344.036v5.043a2.528 2.528 0 0 1-2.522 2.52H6.303V10.12zm12.655 5.043a2.528 2.528 0 0 1 2.522-2.52 2.528 2.528 0 0 1 2.52 2.52 2.528 2.528 0 0 1-2.52 2.52h-2.522v-2.52zm-1.261 0a2.528 2.528 0 0 1-2.52 2.52h-5.043a2.528 2.528 0 0 1-2.522-2.52v-5.043a2.528 2.528 0 0 1 2.522-2.52h5.043a2.528 2.528 0 0 1 2.52 2.52v5.043zm0 3.783a2.528 2.528 0 0 1-2.52 2.522 2.528 2.528 0 0 1-2.522-2.522v-2.52h2.522c1.393 0 2.52 1.128 2.52 2.52zM17.697 5.078a2.528 2.528 0 0 1-2.52 2.522H12.65V5.078a2.528 2.528 0 0 1 2.52-2.52 2.528 2.528 0 0 1 2.52 2.52v2.522z"/>
    </svg>
  );
}

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";

// ─── Mock API Token Data ────────────────────────────────────────────────────
interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  created: string;
  lastUsed: string | null;
  scopes: string[];
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = React.useState("api-tokens");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const handleHashChange = () => {
        const hash = window.location.hash.replace("#", "");
        if (["api-tokens", "org-info", "notifications", "jira", "slack", "github", "assets", "security-billing"].includes(hash)) {
          setActiveTab(hash);
        }
      };

      // Set initial hash
      handleHashChange();

      window.addEventListener("hashchange", handleHashChange);
      return () => window.removeEventListener("hashchange", handleHashChange);
    }
  }, []);

  // ─── Security Compliance & Billing State ────────────────────────────────
  const [dpdpCompliance, setDpdpCompliance] = React.useState(true);
  const [soc2Logging, setSoc2Logging] = React.useState(true);
  const [subscriptionTier, setSubscriptionTier] = React.useState<"free" | "starter" | "pro" | "enterprise">("free");
  const [isSavingCompliance, setIsSavingCompliance] = React.useState(false);

  const handleSaveComplianceBilling = async () => {
    setIsSavingCompliance(true);
    toast.success("Security Compliance & Billing Configurations Saved!", {
      description: `Active Tier: ${subscriptionTier.toUpperCase()} | DPDP 2023: ${dpdpCompliance ? "Enforced" : "Disabled"} | SOC2: ${soc2Logging ? "Enabled" : "Disabled"}`
    });
    setIsSavingCompliance(false);
  };

  // ─── Assets Bulk Upload State ─────────────────────────────────────────────
  const [parsedRows, setParsedRows] = React.useState<Array<{ id: string; target: string; owner_email: string }>>([]);
  const [csvUploadErrors, setCsvUploadErrors] = React.useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = React.useState(false);

  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        const errorsList: string[] = [];
        const parsed: Array<{ id: string; target: string; owner_email: string }> = [];

        data.forEach((row, index) => {
          const idVal = row.id || row.asset_id || row.assetId || row['asset id'] || row['Asset ID'] || '';
          const targetVal = row.target || row.Target || row.asset || row.Asset || '';
          const emailVal = row.owner_email || row.email || row.owner || row['owner email'] || row['Owner Email'] || row['Owner'] || '';

          if (!idVal && !targetVal) {
            errorsList.push(`Row ${index + 1}: Missing both ID and Target`);
          } else {
            parsed.push({
              id: String(idVal).trim(),
              target: String(targetVal).trim(),
              owner_email: String(emailVal).trim(),
            });
          }
        });

        setParsedRows(parsed);
        setCsvUploadErrors(errorsList);
        if (parsed.length > 0) {
          toast.success(`Successfully parsed ${parsed.length} rows from CSV`);
        } else {
          toast.error("No valid rows found in CSV");
        }
      },
      error: (error) => {
        toast.error(`CSV Parsing error: ${error.message}`);
      }
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: false
  });

  const handleConfirmBulkUpdate = async () => {
    if (parsedRows.length === 0 || !token) {
      toast.error("No rows to update or not authenticated.");
      return;
    }
    setIsBulkUpdating(true);
    const toastId = toast.loading("Bulk updating assets...");
    try {
      const res = await fetch("/api/backend/assets/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(parsedRows)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to bulk update assets");
      
      const successCount = data.updated_count;
      const backendErrors = data.errors || [];
      
      if (backendErrors.length > 0) {
        setCsvUploadErrors(backendErrors);
        toast.success(`Updated ${successCount} assets. Some rows failed (check warnings).`, { id: toastId });
      } else {
        setCsvUploadErrors([]);
        setParsedRows([]);
        toast.success(`Successfully updated ${successCount} assets!`, { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to bulk update assets", { id: toastId });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // ─── API Token State ──────────────────────────────────────────────────────
  const [tokens, setTokens] = React.useState<ApiToken[]>([
    {
      id: "tok_1",
      name: "CI/CD Pipeline",
      prefix: "csk_live_8f2a",
      created: "2026-06-15",
      lastUsed: "2026-07-08",
      scopes: ["scans:write", "findings:read"],
    },
    {
      id: "tok_2",
      name: "Monitoring Dashboard",
      prefix: "csk_live_c91b",
      created: "2026-07-01",
      lastUsed: null,
      scopes: ["findings:read", "assets:read"],
    },
  ]);
  const [newTokenName, setNewTokenName] = React.useState("");
  const [showTokenSecret, setShowTokenSecret] = React.useState<string | null>(null);
  const [generatedSecret, setGeneratedSecret] = React.useState<string | null>(null);

  // ─── Notification State ───────────────────────────────────────────────────
  const [notifyOnScan, setNotifyOnScan] = React.useState(true);
  const [notifyOnCritical, setNotifyOnCritical] = React.useState(true);
  const [weeklySummary, setWeeklySummary] = React.useState(false);

  // ─── Integration State (zod + react-hook-form) ────────────────────────────
  const jiraSchema = z.object({
    base_url: z.string().url("Must be a valid URL (e.g. https://company.atlassian.net)"),
    project_key: z.string().min(2, "Project key must be at least 2 characters"),
    email: z.string().email("Must be a valid email address"),
    api_token: z.string().min(4, "API token/Password must be provided"),
  });

  const slackSchema = z.object({
    webhook_url: z.string().url("Must be a valid URL (e.g. https://hooks.slack.com/services/...)"),
    channel: z.string().min(1, "Slack channel is required"),
    critical_only: z.boolean(),
  });

  const githubSchema = z.object({
    installation_id: z.string().optional(),
    access_token: z.string().min(4, "GitHub Access Token must be provided"),
  });

  const formJira = useForm<z.infer<typeof jiraSchema>>({
    resolver: zodResolver(jiraSchema),
    defaultValues: {
      base_url: "",
      project_key: "",
      email: "",
      api_token: "",
    },
  });

  const {
    register: registerJira,
    handleSubmit: handleSubmitJira,
    setValue: setValueJira,
    getValues: getValuesJira,
    formState: { errors: errorsJira, isDirty: isDirtyJira },
  } = formJira;

  const formSlack = useForm<z.infer<typeof slackSchema>>({
    resolver: zodResolver(slackSchema),
    defaultValues: {
      webhook_url: "",
      channel: "",
      critical_only: true,
    },
  });

  const {
    register: registerSlack,
    handleSubmit: handleSubmitSlack,
    setValue: setValueSlack,
    getValues: getValuesSlack,
    formState: { errors: errorsSlack, isDirty: isDirtySlack },
  } = formSlack;

  const formGithub = useForm<z.infer<typeof githubSchema>>({
    resolver: zodResolver(githubSchema),
    defaultValues: {
      installation_id: "",
      access_token: "",
    },
  });

  const {
    register: registerGithub,
    handleSubmit: handleSubmitGithub,
    setValue: setValueGithub,
    getValues: getValuesGithub,
    formState: { errors: errorsGithub, isDirty: isDirtyGithub },
  } = formGithub;

  // Unsaved changes guard
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isDirty = isDirtyJira || isDirtySlack || isDirtyGithub;
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirtyJira, isDirtySlack, isDirtyGithub]);

  const [isTestingJira, setIsTestingJira] = React.useState(false);
  const [isSavingJira, setIsSavingJira] = React.useState(false);
  const [isSavingSlack, setIsSavingSlack] = React.useState(false);
  const [isTestingSlack, setIsTestingSlack] = React.useState(false);
  const [isSavingGithub, setIsSavingGithub] = React.useState(false);
  const [isTestingGithub, setIsTestingGithub] = React.useState(false);

  // GitHub OAuth States
  const [githubOauthUrl, setGithubOauthUrl] = React.useState("");
  const [isOauthSimulated, setIsOauthSimulated] = React.useState(false);

  // Slack status badge states
  const [lastSlackSent, setLastSlackSent] = React.useState<string | null>(null);

  // Notification preferences user profile state (digest placeholder UI)
  const [notificationDelivery, setNotificationDelivery] = React.useState("both");

  // Load configuration on mount
  React.useEffect(() => {
    if (!token) return;
    
    fetch("/api/backend/admin/settings/jira", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.base_url) setValueJira("base_url", data.base_url);
        if (data.project_key) setValueJira("project_key", data.project_key);
        if (data.email) setValueJira("email", data.email);
        if (data.api_token) setValueJira("api_token", data.api_token);
      })
      .catch((err) => console.error("Failed to load Jira settings", err));

    fetch("/api/backend/admin/settings/slack", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.webhook_url) setValueSlack("webhook_url", data.webhook_url);
        if (data.channel) setValueSlack("channel", data.channel);
        setValueSlack("critical_only", data.critical_only ?? true);
        if (data.last_sent) setLastSlackSent(data.last_sent);
      })
      .catch((err) => console.error("Failed to load Slack settings", err));

    fetch("/api/backend/admin/settings/github", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.installation_id) setValueGithub("installation_id", data.installation_id);
        if (data.access_token) setValueGithub("access_token", data.access_token);
      })
      .catch((err) => console.error("Failed to load GitHub settings", err));

    fetch("/api/backend/admin/github/oauth-url", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data && data.url) {
          setGithubOauthUrl(data.url);
          setIsOauthSimulated(data.simulated);
        }
      })
      .catch((err) => console.error("Failed to load GitHub OAuth URL", err));
  }, [setValueJira, setValueSlack, setValueGithub, token]);

  const onSaveJira = async (values: z.infer<typeof jiraSchema>) => {
    setIsSavingJira(true);
    try {
      const res = await fetch("/api/backend/admin/settings/jira", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save settings");
      toast.success("Jira settings saved successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setIsSavingJira(false);
    }
  };

  const onSaveSlack = async (values: z.infer<typeof slackSchema>) => {
    setIsSavingSlack(true);
    try {
      const res = await fetch("/api/backend/admin/settings/slack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save settings");
      toast.success("Slack settings saved successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setIsSavingSlack(false);
    }
  };

  const onSaveGithub = async (values: z.infer<typeof githubSchema>) => {
    setIsSavingGithub(true);
    try {
      const res = await fetch("/api/backend/admin/settings/github", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save settings");
      toast.success("GitHub settings saved successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setIsSavingGithub(false);
    }
  };

  const handleTestGithubConnection = async () => {
    const values = getValuesGithub();
    if (!values.access_token) {
      toast.error("Please enter a GitHub Access Token first.");
      return;
    }
    setIsTestingGithub(true);
    try {
      const res = await fetch("/api/backend/admin/github/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Connection failed");
      toast.success(data.message || "GitHub connection successful!");
    } catch (err: any) {
      toast.error(err.message || "GitHub connection failed");
    } finally {
      setIsTestingGithub(false);
    }
  };

  const handleTestJiraConnection = async () => {
    const values = getValuesJira();
    if (!values.base_url || !values.project_key || !values.email || !values.api_token) {
      toast.error("Please fill in all JIRA fields before testing connection.");
      return;
    }
    
    setIsTestingJira(true);
    try {
      const res = await fetch("/api/backend/admin/jira/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Connection failed");
      toast.success(data.message || "Jira connection successful!");
    } catch (err: any) {
      toast.error(err.message || "Jira connection failed");
    } finally {
      setIsTestingJira(false);
    }
  };

  const handleTestSlackConnection = async () => {
    const values = getValuesSlack();
    if (!values.webhook_url || !values.channel) {
      toast.error("Please fill in Webhook URL and Channel name before testing connection.");
      return;
    }
    
    setIsTestingSlack(true);
    try {
      const res = await fetch("/api/backend/admin/slack/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Slack connection failed");
      toast.success(data.message || "Slack test notification sent successfully!");
      setLastSlackSent(new Date().toISOString());
    } catch (err: any) {
      toast.error(err.message || "Slack connection failed");
    } finally {
      setIsTestingSlack(false);
    }
  };

  const getRelativeTime = (isoString: string | null) => {
    if (!isoString) return "Never";
    try {
      const sentTime = new Date(isoString).getTime();
      const now = new Date().getTime();
      const diffMs = now - sentTime;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return "Just now";
      if (diffMins === 1) return "1 min ago";
      if (diffMins < 60) return `${diffMins} min ago`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours === 1) return "1 hour ago";
      if (diffHours < 24) return `${diffHours} hours ago`;
      
      return new Date(isoString).toLocaleDateString();
    } catch {
      return "Never";
    }
  };

  const handleCreateToken = () => {
    if (!newTokenName.trim()) {
      toast.error("Enter a token name");
      return;
    }
    const fakeSecret = `csk_live_${Math.random().toString(36).slice(2, 10)}_${Math.random().toString(36).slice(2, 18)}`;
    const newToken: ApiToken = {
      id: `tok_${Date.now()}`,
      name: newTokenName.trim(),
      prefix: fakeSecret.slice(0, 13),
      created: new Date().toISOString().split("T")[0],
      lastUsed: null,
      scopes: ["scans:write", "findings:read"],
    };
    setTokens((prev) => [...prev, newToken]);
    setGeneratedSecret(fakeSecret);
    setNewTokenName("");
    toast.success("API Token Created", {
      description: "Copy the secret now — it won't be shown again.",
    });
  };

  const handleDeleteToken = (id: string) => {
    setTokens((prev) => prev.filter((t) => t.id !== id));
    toast.success("Token Revoked");
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleSaveNotifications = () => {
    toast.success("Notification Preferences Saved", {
      description: "Your alert configuration has been updated.",
    });
  };

  // ─── Role helpers ─────────────────────────────────────────────────────────
  const userRole = session?.user?.role || "analyst";
  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
      case "analyst":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20";
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return "Full administrative access: launch security scans, manage API tokens, add team members, configure integrations, and view audit logs.";
      case "analyst":
        return "Standard analyst access: trigger scans, query findings, export reports, manage tags, and create Jira tickets from findings.";
      default:
        return "Read-only viewer: browse completed scans, review findings details, and download reports.";
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage API tokens, organization info, notification preferences, and third-party integrations.
        </p>
      </div>

      {/* shadcn Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val);
          if (typeof window !== "undefined") {
            window.history.pushState(null, "", `#${val}`);
          }
        }}
        className="space-y-6"
      >
        <TabsList className="flex flex-wrap h-auto w-full bg-muted/50 border border-border/60 p-1 gap-1">
          <TabsTrigger value="api-tokens" className="flex-1 sm:flex-initial gap-1.5 text-xs font-semibold data-[state=active]:shadow-sm py-1.5 h-8">
            <Key className="h-3.5 w-3.5" />
            API Tokens
          </TabsTrigger>
          <TabsTrigger value="org-info" className="flex-1 sm:flex-initial gap-1.5 text-xs font-semibold data-[state=active]:shadow-sm py-1.5 h-8">
            <Building2 className="h-3.5 w-3.5" />
            Org Info
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex-1 sm:flex-initial gap-1.5 text-xs font-semibold data-[state=active]:shadow-sm py-1.5 h-8">
            <Bell className="h-3.5 w-3.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="jira" className="flex-1 sm:flex-initial gap-1.5 text-xs font-semibold data-[state=active]:shadow-sm py-1.5 h-8">
            <Building2 className="h-3.5 w-3.5" />
            Jira
          </TabsTrigger>
          <TabsTrigger value="slack" className="flex-1 sm:flex-initial gap-1.5 text-xs font-semibold data-[state=active]:shadow-sm py-1.5 h-8">
            <Plug className="h-3.5 w-3.5" />
            Slack
          </TabsTrigger>
          <TabsTrigger value="github" className="flex-1 sm:flex-initial gap-1.5 text-xs font-semibold data-[state=active]:shadow-sm py-1.5 h-8">
            <GitBranch className="h-3.5 w-3.5" />
            GitHub
          </TabsTrigger>
          <TabsTrigger value="assets" className="flex-1 sm:flex-initial gap-1.5 text-xs font-semibold data-[state=active]:shadow-sm py-1.5 h-8">
            <Database className="h-3.5 w-3.5" />
            Assets
          </TabsTrigger>
          <TabsTrigger value="security-billing" className="flex-1 sm:flex-initial gap-1.5 text-xs font-semibold data-[state=active]:shadow-sm py-1.5 h-8">
            <Shield className="h-3.5 w-3.5 text-amber-500" />
            Security &amp; Billing Tiers
          </TabsTrigger>
        </TabsList>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* TAB: API Tokens                                                    */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <TabsContent value="api-tokens" className="space-y-6">
          {/* Create Token */}
          <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Create New API Token
              </CardTitle>
              <CardDescription className="text-xs">
                Generate a token to authenticate CI/CD pipelines, CLI tools, or external dashboards.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex gap-3">
                <Input
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  placeholder="Token name (e.g. GitHub Actions)"
                  className="bg-background/50 border-border/80 text-xs h-9 flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateToken()}
                />
                <Button size="sm" onClick={handleCreateToken} className="font-semibold text-xs h-9 px-4">
                  Generate Token
                </Button>
              </div>

              {/* Show generated secret */}
              {generatedSecret && (
                <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4 space-y-2">
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Token Created — Copy Your Secret Now
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-background/80 rounded px-3 py-2 text-xs font-mono text-foreground border border-border/60 truncate">
                      {generatedSecret}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(generatedSecret)}
                      className="h-8 px-3 text-xs font-semibold hover:bg-accent"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    This secret will not be shown again. Store it securely.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Tokens List */}
          <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base font-bold">Active API Tokens</CardTitle>
              <CardDescription className="text-xs">
                {tokens.length} token{tokens.length !== 1 ? "s" : ""} registered for this organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {tokens.length === 0 ? (
                <div className="py-12 text-center">
                  <Key className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">No API tokens generated yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {tokens.map((token) => (
                    <div
                      key={token.id}
                      className="flex items-center justify-between px-6 py-4 hover:bg-accent/30 transition-colors group"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{token.name}</span>
                          <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {token.prefix}••••
                          </code>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span>Created {token.created}</span>
                          <span>•</span>
                          <span>{token.lastUsed ? `Last used ${token.lastUsed}` : "Never used"}</span>
                          <span>•</span>
                          <div className="flex gap-1">
                            {token.scopes.map((scope) => (
                              <Badge key={scope} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                                {scope}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteToken(token.id)}
                        className="h-7 px-2 text-destructive/70 hover:text-destructive hover:bg-destructive/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        <span className="text-[10px] font-semibold">Revoke</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* TAB: Org Info (read-only)                                          */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <TabsContent value="org-info" className="space-y-6">
          {/* User Identity Card */}
          <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base font-bold">Personal Profile</CardTitle>
              <CardDescription className="text-xs">Your platform account details (read-only).</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div className="flex flex-col sm:flex-row items-center gap-4 pb-4 border-b border-border/45">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-violet-600 text-primary-foreground font-black text-xl shadow-lg shrink-0">
                  {session?.user?.name
                    ? session.user.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
                    : "U"}
                </div>
                <div className="text-center sm:text-left space-y-0.5">
                  <h3 className="text-base font-bold text-foreground">{session?.user?.name || "User"}</h3>
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 opacity-70" />
                    {session?.user?.email || "user@platform.local"}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-primary/70" />
                    Organization
                  </span>
                  <p className="text-sm font-semibold text-foreground">{session?.user?.org_name || "SigmaSec"}</p>
                  <p className="text-[10px] font-mono text-muted-foreground/60 break-all">{session?.user?.org_id || "N/A"}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 text-primary/70" />
                    Access Role
                  </span>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${getRoleBadgeColor(userRole)}`}>
                      {userRole}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Delivery Preferences Card */}
          <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm text-left">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Bell className="h-4 w-4 text-indigo-500" />
                Profile Notifications
              </CardTitle>
              <CardDescription className="text-xs">Choose how you want to receive scan summaries and critical alerts.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-foreground/80">Default Delivery Channel</Label>
                <select
                  value={notificationDelivery}
                  onChange={(e) => {
                    setNotificationDelivery(e.target.value);
                    toast.success("Notification preferences updated (local placeholder state)");
                  }}
                  className="w-full bg-background/50 border border-border/80 text-xs h-9 px-3 rounded-md outline-none focus:border-primary transition-all text-foreground cursor-pointer"
                >
                  <option value="digest">Email Digest Only (Weekly)</option>
                  <option value="in_app">In-App Alerts Only</option>
                  <option value="both">Both (Email & In-App Alerts)</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Privileges Card */}
          <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                Access Privileges
              </CardTitle>
              <CardDescription className="text-xs">Security clearances assigned to your role.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="rounded-lg bg-muted/30 border border-border/60 p-4 space-y-2">
                <span className="text-xs font-bold text-foreground">Clearance Details:</span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {getRoleDescription(userRole)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Theme selector (quick access from org info) */}
          <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base font-bold">Appearance</CardTitle>
              <CardDescription className="text-xs">Customize the interface theme.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "light", icon: Sun, label: "Light" },
                  { value: "dark", icon: Moon, label: "Dark" },
                  { value: "system", icon: Monitor, label: "System" },
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      "p-3.5 rounded-lg border text-left flex flex-col justify-between h-20 transition-all cursor-pointer",
                      theme === value
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-border/80 bg-muted/10 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* TAB: Notifications                                                 */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Notification Preferences
              </CardTitle>
              <CardDescription className="text-xs">Configure email alerts and security threshold triggers.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-4">
                {/* Trigger 1 */}
                <div className="flex items-start justify-between gap-4 hover:bg-accent/20 rounded-lg p-3 -mx-3 transition-colors">
                  <div className="space-y-0.5">
                    <Label htmlFor="pref-scan" className="text-xs font-bold text-foreground cursor-pointer">
                      Scan Completion Reports
                    </Label>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Email alerts with critical/high findings summary when scans complete.
                    </p>
                  </div>
                  <input
                    id="pref-scan"
                    type="checkbox"
                    checked={notifyOnScan}
                    onChange={() => setNotifyOnScan(!notifyOnScan)}
                    className="h-4 w-4 cursor-pointer rounded border-border/80 text-primary accent-primary mt-0.5"
                  />
                </div>

                {/* Trigger 2 */}
                <div className="flex items-start justify-between gap-4 hover:bg-accent/20 rounded-lg p-3 -mx-3 transition-colors border-t border-border/30 pt-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="pref-critical" className="text-xs font-bold text-foreground cursor-pointer">
                      Critical CVE Alerts
                    </Label>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Immediate notification when critical vulnerabilities are identified.
                    </p>
                  </div>
                  <input
                    id="pref-critical"
                    type="checkbox"
                    checked={notifyOnCritical}
                    onChange={() => setNotifyOnCritical(!notifyOnCritical)}
                    className="h-4 w-4 cursor-pointer rounded border-border/80 text-primary accent-primary mt-0.5"
                  />
                </div>

                {/* Trigger 3 */}
                <div className="flex items-start justify-between gap-4 hover:bg-accent/20 rounded-lg p-3 -mx-3 transition-colors border-t border-border/30 pt-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="pref-weekly" className="text-xs font-bold text-foreground cursor-pointer">
                      Weekly Posture Summary
                    </Label>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Weekly digest of vulnerability trends, scan results, and remediation progress.
                    </p>
                  </div>
                  <input
                    id="pref-weekly"
                    type="checkbox"
                    checked={weeklySummary}
                    onChange={() => setWeeklySummary(!weeklySummary)}
                    className="h-4 w-4 cursor-pointer rounded border-border/80 text-primary accent-primary mt-0.5"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border/35 flex justify-end">
                <Button size="sm" onClick={handleSaveNotifications} className="font-semibold text-xs h-8">
                  Save Notification Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* TAB: Jira                                                         */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <TabsContent value="jira" className="space-y-6">
          <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                Jira Integration
              </CardTitle>
              <CardDescription className="text-xs">Configure your Atlassian Jira Cloud workspace connection.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...formJira}>
                <form onSubmit={handleSubmitJira(onSaveJira)} className="space-y-4">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <FormField
                      control={formJira.control}
                      name="base_url"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5 text-left">
                          <FormLabel className="text-[10px] uppercase font-bold text-foreground/80">Jira Cloud URL</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="https://myorg.atlassian.net"
                              className="bg-background/50 border-border/80 text-xs h-9"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-[10px] text-muted-foreground/80">
                            The full URL of your Atlassian Jira workspace (e.g. https://company.atlassian.net).
                          </FormDescription>
                          <FormMessage className="text-[10px] text-destructive font-semibold" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={formJira.control}
                      name="project_key"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5 text-left">
                          <FormLabel className="text-[10px] uppercase font-bold text-foreground/80">Project Key</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="SEC"
                              className="bg-background/50 border-border/80 text-xs h-9"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-[10px] text-muted-foreground/80">
                            The short prefix key of your target Jira project (e.g. SEC, VULN).
                          </FormDescription>
                          <FormMessage className="text-[10px] text-destructive font-semibold" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={formJira.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5 text-left">
                          <FormLabel className="text-[10px] uppercase font-bold text-foreground/80">User Email Address</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="user@myorg.com"
                              className="bg-background/50 border-border/80 text-xs h-9"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-[10px] text-muted-foreground/80">
                            The email address associated with your Atlassian Jira administrator user.
                          </FormDescription>
                          <FormMessage className="text-[10px] text-destructive font-semibold" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={formJira.control}
                      name="api_token"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5 text-left">
                          <FormLabel className="text-[10px] uppercase font-bold text-foreground/80">API Token</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="********"
                              className="bg-background/50 border-border/80 text-xs h-9"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-[10px] text-muted-foreground/80">
                            Your Jira API token, generated in your Atlassian Account Security settings.
                          </FormDescription>
                          <FormMessage className="text-[10px] text-destructive font-semibold" />
                        </FormItem>
                      )}
                    />
                  </div>

                <div className="pt-4 border-t border-border/35 flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleTestJiraConnection}
                    disabled={isTestingJira || isSavingJira}
                    className="font-semibold text-xs h-8 cursor-pointer"
                  >
                    {isTestingJira && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Test Connection
                  </Button>
                  
                  <Button 
                    type="submit" 
                    size="sm" 
                    disabled={isSavingJira || isTestingJira}
                    className="font-semibold text-xs h-8 cursor-pointer"
                  >
                    {isSavingJira && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Save Jira Settings
                  </Button>
                </div>
              </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* TAB: Slack                                                        */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <TabsContent value="slack" className="space-y-6">
          <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
            <CardHeader className="border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-left">
                    <Slack className="h-4 w-4 text-amber-500" />
                    Slack Integration
                  </CardTitle>
                  <CardDescription className="text-xs text-left">Post real-time scan summaries to your Slack channels.</CardDescription>
                </div>
                {lastSlackSent && (
                  <div className="w-fit">
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-500 border border-amber-500/20">
                      Last Slack alert sent: {getRelativeTime(lastSlackSent)}
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...formSlack}>
                <form onSubmit={handleSubmitSlack(onSaveSlack)} className="space-y-4">
                  <div className="space-y-3.5">
                    <FormField
                      control={formSlack.control}
                      name="webhook_url"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5 text-left">
                          <FormLabel className="text-[10px] uppercase font-bold text-foreground/80">Webhook URL</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="https://hooks.slack.com/services/..."
                              className="bg-background/50 border-border/80 text-xs h-9"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-[10px] text-muted-foreground/80">
                            The Slack Incoming Webhook URL configured for your channel.
                          </FormDescription>
                          <FormMessage className="text-[10px] text-destructive font-semibold" />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-3.5 sm:grid-cols-2">
                      <FormField
                        control={formSlack.control}
                        name="channel"
                        render={({ field }) => (
                          <FormItem className="space-y-1.5 text-left">
                            <FormLabel className="text-[10px] uppercase font-bold text-foreground/80">Channel Name</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                placeholder="security-alerts"
                                className="bg-background/50 border-border/80 text-xs h-9"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription className="text-[10px] text-muted-foreground/80">
                              The target channel to receive scanner message cards (e.g. #security-alerts).
                            </FormDescription>
                            <FormMessage className="text-[10px] text-destructive font-semibold" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={formSlack.control}
                        name="critical_only"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20 text-left space-y-0">
                            <div className="space-y-0.5">
                              <FormLabel className="text-xs font-bold text-foreground">Critical Findings Only</FormLabel>
                              <FormDescription className="text-[10px] text-muted-foreground/80 leading-normal">
                                Only send notifications if critical or KEV vulnerabilities are found.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 cursor-pointer rounded border-border/80 text-primary accent-primary"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                <div className="pt-4 border-t border-border/35 flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleTestSlackConnection}
                    disabled={isTestingSlack || isSavingSlack}
                    className="font-semibold text-xs h-8 cursor-pointer"
                  >
                    {isTestingSlack && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Send Test Message
                  </Button>
                  
                  <Button 
                    type="submit" 
                    size="sm" 
                    disabled={isSavingSlack || isTestingSlack}
                    className="font-semibold text-xs h-8 cursor-pointer"
                  >
                    {isSavingSlack && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Save Slack Settings
                  </Button>
                </div>
              </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* TAB: GitHub                                                       */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <TabsContent value="github" className="space-y-6">
          {/* Card 1: GitHub App Connection (OAuth / Integration installation) */}
          <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm text-left">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <GitPullRequest className="h-4 w-4 text-primary" />
                GitHub App Authorization
              </CardTitle>
              <CardDescription className="text-xs">
                Authorize the SigmaSec integration app on your target organization to automatically submit vulnerability fix pull requests.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="rounded-lg bg-muted/20 border border-border/60 p-4 text-xs text-muted-foreground leading-relaxed">
                <span className="font-bold text-foreground block mb-1">What permissions are granted?</span>
                SigmaSec requests minimal permissions to write contents, create code branches (`fix/*`), commit patches, and open pull requests on repositories enabled in your installation.
              </div>

              <div className="flex items-center gap-3">
                {githubOauthUrl ? (
                  <Button asChild className="h-9 font-semibold text-xs cursor-pointer shadow-sm">
                    <a href={githubOauthUrl}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      {isOauthSimulated ? "Connect Developer Sandbox (OAuth Mock)" : "Install GitHub App / OAuth"}
                    </a>
                  </Button>
                ) : (
                  <Button disabled className="h-9 font-semibold text-xs">
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Fetching OAuth parameters...
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Manual Credentials config */}
          <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm text-left">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base font-bold">GitHub App / Credentials Configuration</CardTitle>
              <CardDescription className="text-xs">
                Manually configure custom Personal Access Tokens or GitHub App credentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...formGithub}>
                <form onSubmit={handleSubmitGithub(onSaveGithub)} className="space-y-4">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <FormField
                      control={formGithub.control}
                      name="installation_id"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5 text-left">
                          <FormLabel className="text-[10px] uppercase font-bold text-foreground/80">Installation ID (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="e.g. 123456"
                              className="bg-background/50 border-border/80 text-xs h-9"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-[10px] text-muted-foreground/80">
                            Your GitHub App Installation ID if configured for organization-level sync.
                          </FormDescription>
                          <FormMessage className="text-[10px] text-destructive font-semibold" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={formGithub.control}
                      name="access_token"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5 text-left">
                          <FormLabel className="text-[10px] uppercase font-bold text-foreground/80">Access Token / Personal Token</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="ghp_************************"
                              className="bg-background/50 border-border/80 text-xs h-9"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-[10px] text-muted-foreground/80">
                            Personal Access Token with `repo` scopes to create pull requests.
                          </FormDescription>
                          <FormMessage className="text-[10px] text-destructive font-semibold" />
                        </FormItem>
                      )}
                    />
                  </div>

                <div className="pt-4 border-t border-border/35 flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleTestGithubConnection}
                    disabled={isTestingGithub || isSavingGithub}
                    className="font-semibold text-xs h-8 cursor-pointer"
                  >
                    {isTestingGithub && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Test Connection
                  </Button>
                  
                  <Button 
                    type="submit" 
                    size="sm" 
                    disabled={isSavingGithub || isTestingGithub}
                    className="font-semibold text-xs h-8 cursor-pointer"
                  >
                    {isSavingGithub && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Save GitHub Settings
                  </Button>
                </div>
              </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* TAB: Assets Bulk Upload                                           */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <TabsContent value="assets" className="space-y-6">
          <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm text-left">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Database className="h-4 w-4 text-primary animate-pulse" />
                Bulk Assign Asset Owners
              </CardTitle>
              <CardDescription className="text-xs">
                Upload a CSV file to bulk-assign `owner_email` to assets in your organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* CSV Upload Dropzone Area */}
              <div 
                {...getRootProps()} 
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3.5 cursor-pointer transition-all duration-300",
                  isDragActive 
                    ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(var(--primary),0.1)] scale-[0.99]" 
                    : "border-border/80 bg-muted/10 hover:border-primary/50 hover:bg-muted/20"
                )}
              >
                <input {...getInputProps()} />
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-xs font-semibold text-foreground">
                    {isDragActive ? "Drop the CSV file here" : "Drag & drop CSV file here, or click to browse"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Accepted format: .csv files up to 5MB.
                  </p>
                </div>
              </div>

              {/* Instructions Callout */}
              <div className="rounded-lg bg-muted/30 border border-border/50 p-4 space-y-2 text-[11px] leading-relaxed">
                <span className="font-bold text-foreground block">Expected CSV Format:</span>
                <p className="text-muted-foreground">
                  The CSV must contain headers. We match rows to assets case-insensitively.
                </p>
                <div className="grid grid-cols-2 gap-4 mt-2 max-w-md bg-background/50 border rounded-lg p-2.5 font-mono text-[10px]">
                  <div>
                    <span className="font-bold text-foreground block mb-0.5">Required ID or Target:</span>
                    <span className="text-muted-foreground">`id` (UUID) or `target` (URL, git_repo, image)</span>
                  </div>
                  <div>
                    <span className="font-bold text-foreground block mb-0.5">Owner Email:</span>
                    <span className="text-muted-foreground">`owner_email` (or `email`, `owner`)</span>
                  </div>
                </div>
              </div>

              {/* Error messages if any */}
              {csvUploadErrors.length > 0 && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 space-y-2">
                  <span className="text-xs font-bold text-destructive flex items-center gap-1.5">
                    Warnings / Errors found in processing CSV:
                  </span>
                  <ul className="list-disc list-inside text-[10px] font-mono text-destructive/90 space-y-1 max-h-40 overflow-y-auto">
                    {csvUploadErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              {parsedRows.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground">
                      Parsed CSV Preview ({parsedRows.length} rows)
                    </h3>
                    <Button 
                      variant="ghost" 
                      size="xs" 
                      onClick={() => {
                        setParsedRows([]);
                        setCsvUploadErrors([]);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground h-7"
                    >
                      Clear Data
                    </Button>
                  </div>

                  <div className="rounded-lg border border-border/80 bg-background/45 overflow-hidden">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead className="bg-muted/40 font-bold border-b border-border/40 sticky top-0 backdrop-blur-sm z-10">
                          <tr>
                            <th className="p-2.5">Asset ID</th>
                            <th className="p-2.5">Target</th>
                            <th className="p-2.5">Owner Email</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {parsedRows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-muted/10">
                              <td className="p-2.5 font-mono text-[10px] text-muted-foreground truncate max-w-[120px]" title={row.id}>
                                {row.id || <span className="italic opacity-50">Not provided</span>}
                              </td>
                              <td className="p-2.5 font-mono text-[10px] text-foreground truncate max-w-[180px]" title={row.target}>
                                {row.target || <span className="italic opacity-50">Not provided</span>}
                              </td>
                              <td className="p-2.5 text-foreground font-semibold truncate max-w-[150px]" title={row.owner_email}>
                                {row.owner_email || <span className="text-muted-foreground/60 italic">Unassign email</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Upload Confirm Row */}
                  <div className="flex justify-end gap-3 pt-3 border-t border-border/35 flex-col sm:flex-row items-stretch sm:items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setParsedRows([]);
                        setCsvUploadErrors([]);
                      }}
                      disabled={isBulkUpdating}
                      className="h-9 font-semibold text-xs cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleConfirmBulkUpdate}
                      disabled={isBulkUpdating}
                      className="h-9 font-semibold text-xs cursor-pointer gap-1.5"
                    >
                      {isBulkUpdating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Confirm & Bulk Update
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* TAB: Security & Billing Tiers                                     */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <TabsContent value="security-billing" className="space-y-6">
          <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <Shield className="h-4 w-4 text-orange-500" />
                Security Compliance &amp; Billing
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* DPDP Act 2023 Compliance Mode */}
              <div className="bg-muted/40 p-4 rounded-xl border border-border/50 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-bold text-sm text-foreground">
                    DPDP Act 2023 Compliance Mode
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Enforce strict local user data residency limits, require dynamic cookie consent on sign-in, and auto-delete inactive grading logs after 90 days.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={dpdpCompliance}
                  onClick={() => setDpdpCompliance(!dpdpCompliance)}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    dpdpCompliance ? "bg-emerald-500" : "bg-muted-foreground/30"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                      dpdpCompliance ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              {/* SOC 2 Audit Trail Logging */}
              <div className="bg-muted/40 p-4 rounded-xl border border-border/50 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-bold text-sm text-foreground">
                    SOC 2 Audit Trail Logging
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Maintain cryptographic event logs for all administrative operations, team additions, role changes, and API overrides.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={soc2Logging}
                  onClick={() => setSoc2Logging(!soc2Logging)}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    soc2Logging ? "bg-emerald-500" : "bg-muted-foreground/30"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                      soc2Logging ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              {/* Active Subscription Tier Section */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  Active Subscription Tier <span className="font-mono text-[10px] text-muted-foreground/70">(FR-BIL-01)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Free Tier */}
                  <div
                    onClick={() => setSubscriptionTier("free")}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3.5 select-none",
                      subscriptionTier === "free"
                        ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500"
                        : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
                      <Gift className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">Free Tier</p>
                      <p className="text-[11px] text-muted-foreground font-medium">10 scans/mo limit</p>
                    </div>
                  </div>

                  {/* Starter Tier */}
                  <div
                    onClick={() => setSubscriptionTier("starter")}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3.5 select-none",
                      subscriptionTier === "starter"
                        ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500"
                        : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">Starter ($29/mo)</p>
                      <p className="text-[11px] text-muted-foreground font-medium">100 scans/mo limit</p>
                    </div>
                  </div>

                  {/* Pro Tier */}
                  <div
                    onClick={() => setSubscriptionTier("pro")}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3.5 select-none",
                      subscriptionTier === "pro"
                        ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500"
                        : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 shrink-0">
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">Pro ($199/mo)</p>
                      <p className="text-[11px] text-muted-foreground font-medium">1000 scans/mo limit</p>
                    </div>
                  </div>

                  {/* Enterprise Tier */}
                  <div
                    onClick={() => setSubscriptionTier("enterprise")}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3.5 select-none",
                      subscriptionTier === "enterprise"
                        ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500"
                        : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">Enterprise</p>
                      <p className="text-[11px] text-muted-foreground font-medium">Unlimited scans &amp; SLA</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Configurations Footer */}
              <div className="flex justify-end pt-4 border-t border-border/40">
                <Button
                  size="sm"
                  onClick={handleSaveComplianceBilling}
                  disabled={isSavingCompliance}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-10 px-5 text-xs shadow-md rounded-lg flex items-center gap-2 cursor-pointer"
                >
                  {isSavingCompliance && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Configurations
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
