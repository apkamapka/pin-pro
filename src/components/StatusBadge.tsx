import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { CustomerStatus } from "@/types/customer";

const COLOR_CLASS: Record<CustomerStatus, string> = {
  new: "bg-status-new text-status-new-foreground",
  in_progress: "bg-status-progress text-status-progress-foreground",
  done: "bg-status-done text-status-done-foreground",
  warranty: "bg-status-warranty text-status-warranty-foreground",
  issue: "bg-status-issue text-status-issue-foreground",
};

export function StatusBadge({
  status,
  className,
}: {
  status: CustomerStatus;
  className?: string;
}) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        COLOR_CLASS[status],
        className,
      )}
    >
      {t.statuses[status]}
    </span>
  );
}

const DOT_CLASS: Record<CustomerStatus, string> = {
  new: "bg-status-new",
  in_progress: "bg-status-progress",
  done: "bg-status-done",
  warranty: "bg-status-warranty",
  issue: "bg-status-issue",
};

export function StatusDot({
  status,
  className,
}: {
  status: CustomerStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full",
        DOT_CLASS[status],
        className,
      )}
    />
  );
}
