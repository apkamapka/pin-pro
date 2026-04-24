/**
 * Model uniwersalny: bez sztywnych statusów.
 *
 * - `isDone` – binarny stan sprawy (aktywna vs zakończona). Domyślnie false.
 * - `categoryId` – id kategorii user-defined (opcjonalne). Kategorie użytkownik
 *   definiuje sobie sam w Ustawieniach: nazwa + ikona + kolor. Dla jednych to
 *   będzie "Awaria/Gwarancja", dla innych "Pacjenci VIP/Nowi", a dla jeszcze
 *   innych "Rodzina/Znajomi".
 * - `icon` – ręczny override ikony (paleta 15 lucide), nadpisuje ikonę
 *   z kategorii. Kolor pinu nadal wynika z terminu (killer feature).
 */

export type LegacyCustomerStatus =
  | "new"
  | "in_progress"
  | "done"
  | "warranty"
  | "issue";

/** Kategoria user-defined – zastępuje sztywne statusy. */
export interface Category {
  id: string;
  name: string;
  /** klucz z PinIconKey (patrz lib/iconPalette.ts) */
  icon: string;
  /** kolor w formacie hex (#rrggbb) */
  color: string;
}

export interface Customer {
  id: string;
  name: string;
  company?: string;
  profession?: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  phone2?: string;
  email?: string;
  website?: string;
  notes?: string;

  /** Kategoria user-defined (opcjonalna). */
  categoryId?: string;
  /** Czy sprawa zamknięta. */
  isDone: boolean;
  /** Override ikony pinu (paleta lucide). Jeśli brak – bierz z kategorii. */
  icon?: string;

  nextAppointment?: string;
  lastVisit?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ColorThresholds {
  soon: number;
  upcoming: number;
  later: number;
}

export const DEFAULT_THRESHOLDS: ColorThresholds = {
  soon: 7,
  upcoming: 14,
  later: 30,
};

/** Predefiniowana paleta kolorów dla kategorii (tailwind-friendly hex). */
export const CATEGORY_COLOR_PALETTE: string[] = [
  "#2563eb", // niebieski
  "#16a34a", // zielony
  "#ea580c", // pomarańczowy
  "#dc2626", // czerwony
  "#9333ea", // fioletowy
  "#eab308", // żółty
  "#0891b2", // cyan
  "#db2777", // różowy
  "#6b7280", // szary
];
