import { differenceInCalendarDays } from "date-fns";
import type { Category, ColorThresholds, Customer } from "@/types/customer";
import { DEFAULT_THRESHOLDS } from "@/types/customer";

/**
 * Paleta tonów po terminie – bez statusów.
 * "done" = sprawa zakończona (szary, zawsze wygrywa).
 * "overdue" = termin przegapiony (czerwony, pulsuje).
 * "soon/upcoming/later" = zbliżający się termin wg progów z ustawień.
 * "future" = daleko > 30 dni.
 * "noDate" = brak następnego kontaktu (neutral; ewentualnie kolor kategorii).
 */
export type PinTone =
  | "done"
  | "overdue"
  | "soon"
  | "upcoming"
  | "later"
  | "future"
  | "noDate";

export interface PinAppearance {
  tone: PinTone;
  color: string; // hex używany przez divIcon
  pulse: boolean;
}

/** Domyślne kolory dla tonów terminów. */
export const TONE_HEX: Record<PinTone, string> = {
  done: "#6b7280", // szary
  overdue: "#dc2626", // czerwony
  soon: "#ea580c", // pomarańczowy
  upcoming: "#eab308", // żółty
  later: "#16a34a", // zielony
  future: "#2563eb", // niebieski
  noDate: "#64748b", // slate – neutral gdy brak terminu
};

export function getPinTone(
  customer: Customer,
  today: Date = new Date(),
  thresholds: ColorThresholds = DEFAULT_THRESHOLDS,
): PinTone {
  if (customer.isDone) return "done";

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
  return "noDate";
}

/**
 * Kolor pinu z priorytetem:
 *   1. `done` → zawsze szary,
 *   2. jest termin → kolor z tonu (overdue/soon/upcoming/later/future),
 *   3. brak terminu + jest kategoria → kolor kategorii,
 *   4. fallback → noDate (slate).
 *
 * Dzięki temu kolor nadal niesie pilność (killer feature), a kategoria
 * ratuje kolorem piny które nie mają terminu (np. "Znajomi" niebiescy).
 */
export function getPinAppearance(
  customer: Customer,
  today: Date = new Date(),
  thresholds: ColorThresholds = DEFAULT_THRESHOLDS,
  categoryById?: (id: string) => Category | undefined,
): PinAppearance {
  const tone = getPinTone(customer, today, thresholds);

  let color = TONE_HEX[tone];
  if (tone === "noDate" && customer.categoryId && categoryById) {
    const cat = categoryById(customer.categoryId);
    if (cat?.color) color = cat.color;
  }

  return {
    tone,
    color,
    pulse: tone === "overdue",
  };
}

export function getPinColor(
  customer: Customer,
  today: Date = new Date(),
  thresholds: ColorThresholds = DEFAULT_THRESHOLDS,
): string {
  return TONE_HEX[getPinTone(customer, today, thresholds)];
}
