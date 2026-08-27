"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, DollarSign, Cpu, ArrowUpRight, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";

interface MonthlySummary {
  org_id: string;
  org_name: string;
  year: number;
  month: number;
  call_type: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
  call_count: number;
}

interface DailyUsage {
  date: string;
  call_type: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
  call_count: number;
}

export default function AdminAiUsagePage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken;

  const [data, setData] = React.useState<{ monthly_summary: MonthlySummary[]; daily_usage: DailyUsage[] } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) return;

    fetch("/api/backend/admin/ai-usage", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch AI usage metrics (Status ${res.status})`);
        return res.json();
      })
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
        <span className="text-xs text-muted-foreground font-semibold">Loading AI usage metrics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-destructive/15 border border-destructive/20 text-destructive text-xs rounded-lg p-4 font-semibold">
          Error: {error || "Failed to load usage data"}
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalPromptTokens = data.monthly_summary.reduce((sum, item) => sum + item.prompt_tokens, 0);
  const totalCompletionTokens = data.monthly_summary.reduce((sum, item) => sum + item.completion_tokens, 0);
  const totalCost = data.monthly_summary.reduce((sum, item) => sum + item.cost, 0);
  const totalCalls = data.monthly_summary.reduce((sum, item) => sum + item.call_count, 0);

  // Format Daily Usage for stacked bar chart: input vs output tokens per day, grouped by call_type
  const dailyChartMap: { [date: string]: any } = {};
  data.daily_usage.forEach((item) => {
    if (!dailyChartMap[item.date]) {
      dailyChartMap[item.date] = {
        date: item.date,
        enrich_prompt: 0,
        enrich_completion: 0,
        agent_prompt: 0,
        agent_completion: 0,
        enrich_cost: 0,
        agent_cost: 0,
        total_cost: 0
      };
    }
    const prefix = item.call_type === "enrich" ? "enrich" : "agent";
    dailyChartMap[item.date][`${prefix}_prompt`] += item.prompt_tokens;
    dailyChartMap[item.date][`${prefix}_completion`] += item.completion_tokens;
    dailyChartMap[item.date][`${prefix}_cost`] += item.cost;
    dailyChartMap[item.date].total_cost += item.cost;
  });

  const dailyChartData = Object.values(dailyChartMap).sort((a, b) => a.date.localeCompare(b.date));

  // Compute cumulative cost for the line chart
  let cumulative = 0;
  const cumulativeChartData = dailyChartData.map((day: any) => {
    cumulative += day.total_cost;
    return {
      date: day.date,
      cost: day.total_cost,
      cumulativeCost: cumulative
    };
  });

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-500 animate-pulse" />
            AI Usage & Cost Admin Console
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor model invocation volumes, token counts, and operational costs segmented by feature.
          </p>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Spend */}
        <Card className="border border-border/80 bg-card shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Month Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">${totalCost.toFixed(4)}</div>
            <p className="text-[10.5px] text-muted-foreground mt-0.5">
              Accumulated model cost in USD
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total Call Counts */}
        <Card className="border border-border/80 bg-card shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total API Calls</CardTitle>
            <Cpu className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalCalls.toLocaleString()}</div>
            <p className="text-[10.5px] text-muted-foreground mt-0.5">
              Unique ReAct Agent & Enrichment invocations
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Prompt Tokens */}
        <Card className="border border-border/80 bg-card shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prompt (Input) Tokens</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalPromptTokens.toLocaleString()}</div>
            <p className="text-[10.5px] text-muted-foreground mt-0.5">
              Sent scan contextual context inputs
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Completion Tokens */}
        <Card className="border border-border/80 bg-card shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Completion (Output) Tokens</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalCompletionTokens.toLocaleString()}</div>
            <p className="text-[10.5px] text-muted-foreground mt-0.5">
              Generated plain English patch recommendations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recharts Graphical Plots */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Stacked Bar Chart: Token consumption */}
        <Card className="border border-border/80 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-foreground">Daily Token Ingestion Volumes</CardTitle>
            <CardDescription className="text-[10.5px] text-muted-foreground">
              Segmented daily prompt and completion tokens stacked by feature (Enrichment vs Copilot Agent).
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/30" />
                <XAxis dataKey="date" className="text-[10px] fill-muted-foreground" />
                <YAxis className="text-[10px] fill-muted-foreground" />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  labelStyle={{ fontSize: "10.5px", fontWeight: "bold", color: "hsl(var(--foreground))" }}
                  itemStyle={{ fontSize: "10.5px" }}
                />
                <Legend wrapperStyle={{ fontSize: "10px", marginTop: "10px" }} />
                <Bar dataKey="enrich_prompt" name="Enrich Input (Prompt)" stackId="a" fill="#6366f1" opacity={0.85} />
                <Bar dataKey="enrich_completion" name="Enrich Output (Completion)" stackId="a" fill="#818cf8" opacity={0.6} />
                <Bar dataKey="agent_prompt" name="Agent Input (Prompt)" stackId="a" fill="#a855f7" opacity={0.85} />
                <Bar dataKey="agent_completion" name="Agent Output (Completion)" stackId="a" fill="#c084fc" opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Line Chart: Cumulative Spend */}
        <Card className="border border-border/80 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-foreground">Cumulative Operational Spend</CardTitle>
            <CardDescription className="text-[10.5px] text-muted-foreground">
              Total cumulative token usage costs tracking aggregate platform spend over the monthly cycle.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulativeChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/30" />
                <XAxis dataKey="date" className="text-[10px] fill-muted-foreground" />
                <YAxis unit="$" className="text-[10px] fill-muted-foreground" />
                <Tooltip
                  formatter={(value: number) => [`$${value.toFixed(5)}`, "Spend"]}
                  contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  labelStyle={{ fontSize: "10.5px", fontWeight: "bold", color: "hsl(var(--foreground))" }}
                  itemStyle={{ fontSize: "10.5px" }}
                />
                <Legend wrapperStyle={{ fontSize: "10px", marginTop: "10px" }} />
                <Line
                  type="monotone"
                  dataKey="cumulativeCost"
                  name="Cumulative Cost (USD)"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 4, strokeWidth: 1.5, fill: "#fff" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly details Table */}
      <Card className="border border-border/80 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-foreground">Usage Summary by Organization</CardTitle>
          <CardDescription className="text-[10.5px] text-muted-foreground">
            Aggregate token usage, API invocation counts, and computed cost for each organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs leading-normal border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60 text-[10px] uppercase font-bold text-muted-foreground">
                  <th className="p-4 pl-6">Organization</th>
                  <th className="p-4">Feature Type</th>
                  <th className="p-4">API Calls</th>
                  <th className="p-4">Input Tokens</th>
                  <th className="p-4">Output Tokens</th>
                  <th className="p-4 pr-6 text-right">Computed Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {data.monthly_summary.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/15 transition-colors font-medium">
                    <td className="p-4 pl-6 font-bold text-foreground/90">{row.org_name}</td>
                    <td className="p-4">
                      <Badge variant="outline" className="capitalize text-[9.5px] bg-background border-border/80">
                        {row.call_type}
                      </Badge>
                    </td>
                    <td className="p-4 font-mono">{row.call_count}</td>
                    <td className="p-4 font-mono">{row.prompt_tokens.toLocaleString()}</td>
                    <td className="p-4 font-mono">{row.completion_tokens.toLocaleString()}</td>
                    <td className="p-4 pr-6 font-mono font-bold text-right text-indigo-600 dark:text-indigo-400">
                      ${row.cost.toFixed(5)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
