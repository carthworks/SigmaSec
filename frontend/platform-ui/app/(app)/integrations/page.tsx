export default function IntegrationsPage() {
  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect Jira, Slack, GitHub Apps, and other third-party security platforms.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-6 mt-6 shadow-sm">
        <p className="text-sm text-muted-foreground text-center py-8">
          Integration hooks and settings modules will appear here.
        </p>
      </div>
    </div>
  );
}
