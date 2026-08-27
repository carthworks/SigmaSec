import * as React from "react"
import { Badge } from "@/components/ui/badge"

export interface SeverityBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  severity: "critical" | "high" | "medium" | "low" | "info" | string;
}

export function SeverityBadge({ severity, className, ...props }: SeverityBadgeProps) {
  const cleanSeverity = severity?.toLowerCase() || "info";

  let variant: "critical" | "high" | "medium" | "low" | "info" = "info";
  if (cleanSeverity === "critical") variant = "critical";
  else if (cleanSeverity === "high") variant = "high";
  else if (cleanSeverity === "medium") variant = "medium";
  else if (cleanSeverity === "low") variant = "low";
  else if (cleanSeverity === "info") variant = "info";

  return (
    <Badge variant={variant} className={className} {...props}>
      {cleanSeverity}
    </Badge>
  );
}
