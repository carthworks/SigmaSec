export interface SlaResult {
  dueDate: Date;
  status: "breached" | "warning" | "on_track";
  label: string;
  badgeClass: string;
  daysRemaining: number;
}

const SLA_DAYS: Record<string, number> = {
  critical: 7,
  high: 15,
  medium: 30,
  low: 60,
};

export function calculateSla(
  createdAt?: string | null,
  severity?: string | null
): SlaResult {
  const sev = (severity || "medium").toLowerCase();
  const allowedDays = SLA_DAYS[sev] ?? 30;
  const created = createdAt ? new Date(createdAt) : new Date();
  const validCreated = isNaN(created.getTime()) ? new Date() : created;

  const dueDate = new Date(validCreated.getTime() + allowedDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    const breachedDays = Math.max(1, Math.abs(diffDays));
    return {
      dueDate,
      status: "breached",
      label: `Breached by ${breachedDays}d`,
      badgeClass: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 font-semibold",
      daysRemaining: diffDays,
    };
  }

  if (diffHours < 24) {
    return {
      dueDate,
      status: "warning",
      label: `SLA: ${Math.max(1, diffHours)}h left`,
      badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold animate-pulse",
      daysRemaining: 0,
    };
  }

  if (diffDays <= 3) {
    return {
      dueDate,
      status: "warning",
      label: `SLA: ${diffDays}d left`,
      badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      daysRemaining: diffDays,
    };
  }

  return {
    dueDate,
    status: "on_track",
    label: `SLA: ${diffDays}d left`,
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    daysRemaining: diffDays,
  };
}
