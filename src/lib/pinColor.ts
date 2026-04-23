import { differenceInCalendarDays } from "date-fns";
import type { ColorThresholds, Customer } from "@/types/customer";
import { DEFAULT_THRESHOLDS } from "@/types/customer";

export type PinTone =
  | "done"
  | "issue"
  | "overdue"
  | "soon"
  | "upcoming"
  | "later"
  | "future"
  | "new"
  | "progress"
  | "warranty";

export interface PinAppearance {
  tone: PinTone;
  color: string; // hex used by leaflet divIcon
  pulse: boolean;
}

const HEX: Record<PinTone, string> = {
  done: "#6b7280",
  issue: "#dc2626",
  overdue: "#dc2626",
  soon: "#ea580c",
  upcoming: "#eab308",
  later: "#16a34a",
  future: "#2563eb",
  new: "#2563eb",
  progress: "#ea580c",
  warranty: "#9333ea",
};

export function getPinTone(
  customer: Customer,
  today: Date = new Date(),
  thresholds: ColorThresholds = DEFAULT_THRESHOLDS,
): PinTone {
  if (customer.status === "done") return "done";
  if (customer.status === "issue") return "issue";

  if (customer.nextAppointment) {
    const days = differenceInCalendarDays(
      new Date(customer.nextAppointment),
      today,
    );
    if (days < 0) return "overdue";
    if (days <= thresholds.soon) return "soon";
    if (days <= thresholds.upcoming) return "upcoming";
    if (days <= thresholds.later) return "later";
    return "future";
  }

  if (customer.status === "new") return "new";
  if (customer.status === "in_progress") return "progress";
  if (customer.status === "warranty") return "warranty";
  return "new";
}

export function getPinAppearance(
  customer: Customer,
  today: Date = new Date(),
  thresholds: ColorThresholds = DEFAULT_THRESHOLDS,
): PinAppearance {
  const tone = getPinTone(customer, today, thresholds);
  return {
    tone,
    color: HEX[tone],
    pulse: tone === "issue",
  };
}

export function getPinColor(
  customer: Customer,
  today: Date = new Date(),
  thresholds: ColorThresholds = DEFAULT_THRESHOLDS,
): string {
  return HEX[getPinTone(customer, today, thresholds)];
}
