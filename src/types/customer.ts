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
 *
 * Pakiet A ("bogatsze piny"):
 * - `photos`       – zdjęcia przypięte do klienta (base64 dataUrl, skompresowane).
 * - `voiceNotes`   – notatki głosowe (base64 dataUrl, limit 60 s).
 * - `timeline`     – oś czasu wydarzeń (wizyta / notatka / telefon / problem / naprawa).
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

/** Załącznik w pamięci – używane zarówno dla zdjęć, jak i nagrań głosowych. */
export interface MediaAttachment {
  id: string;
  /** base64 data URL, np. `data:image/jpeg;base64,...` lub `data:audio/webm;base64,...` */
  dataUrl: string;
  /** `image/jpeg`, `image/png`, `audio/webm`, `audio/mp4` itd. */
  mimeType: string;
  /** kiedy dodano (ISO) */
  createdAt: string;
  /** opcjonalny podpis / nazwa */
  caption?: string;
  /** dla audio – długość w sekundach (zaokrąglona) */
  durationSec?: number;
  /** przybliżony rozmiar w bajtach (liczony raz, żeby nie mierzyć za każdym razem) */
  approxBytes?: number;
}

/** Typ wpisu na osi czasu. */
export type TimelineKind = "visit" | "note" | "call" | "issue" | "fix" | "other";

export const TIMELINE_KINDS: TimelineKind[] = [
  "visit",
  "note",
  "call",
  "issue",
  "fix",
  "other",
];

export interface TimelineEntry {
  id: string;
  /** Data zdarzenia (może być w przeszłości – np. spisujesz z głowy starą wizytę). */
  date: string;
  kind: TimelineKind;
  text?: string;
  /** IDs zdjęć z `customer.photos[]` przypiętych do tego wpisu. */
  photoIds?: string[];
  /** Kiedy wpis został dodany do systemu (ISO). */
  createdAt: string;
}

/**
 * Typ pola custom – determinuje ikonę, klikalność i input type.
 *
 * - `phone` → ikona telefonu, link `tel:`, input type=tel
 * - `email` → ikona koperty, link `mailto:`, input type=email
 * - `url`   → ikona globu, link `https://...`, input type=url
 * - `tax_id`→ ikona dokumentu (np. NIP, REGON, PESEL), bez linku
 * - `text`  → ogólne pole, bez ikony specjalnej, bez linku
 */
export type CustomFieldType = "text" | "phone" | "email" | "url" | "tax_id";

/** User-defined pole w karcie klienta (telefon, email, NIP, dowolne).
 *  Etykieta jest edytowalna – chipy dają tylko sensowny default. */
export interface CustomField {
  id: string;
  label: string;
  value: string;
  type: CustomFieldType;
}

export interface Customer {
  id: string;
  name: string;
  /** @deprecated zmigrowane do customFields w v6, zostaje dla starych eksportów */
  company?: string;
  /** @deprecated zmigrowane do customFields w v6, zostaje dla starych eksportów */
  profession?: string;
  address: string;
  lat: number;
  lng: number;
  /** @deprecated zmigrowane do customFields w v6, zostaje dla starych eksportów */
  phone?: string;
  /** @deprecated zmigrowane do customFields w v6, zostaje dla starych eksportów */
  phone2?: string;
  /** @deprecated zmigrowane do customFields w v6, zostaje dla starych eksportów */
  email?: string;
  /** @deprecated zmigrowane do customFields w v6, zostaje dla starych eksportów */
  website?: string;
  /** Dowolne user-defined pola. Tu trafiają telefony, e-maile, NIP-y etc. */
  customFields?: CustomField[];
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

  // Pakiet A
  photos?: MediaAttachment[];
  voiceNotes?: MediaAttachment[];
  timeline?: TimelineEntry[];
  /** ID zdjęcia z `photos[]` używanego jako miniaturka pinu na mapie.
   *  Gdy nie ustawione – używamy najnowszego zdjęcia (patrz getThumbnailPhoto). */
  thumbnailPhotoId?: string;

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
