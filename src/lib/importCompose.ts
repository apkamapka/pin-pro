/**
 * Buduje "kandydatów importu" z parsowanych wierszy i mapowania kolumn.
 *
 * Kandydat = wiersz po normalizacji, ale jeszcze BEZ koordynatów (geokoder
 * dorzuci je później). Przechowuje też metadata o nagłówkach niezmapowanych,
 * które trafią do `notes`.
 */

import type { ColumnMapping, SchemaField } from "./columnMapping";

export interface ImportCandidate {
  /** Stabilny identyfikator wiersza w obrębie sesji importu (do progress / retry). */
  rowId: number;
  /** Czy wiersz nadaje się do utworzenia klienta (ma nazwę i adres po composingu). */
  valid: boolean;
  /** Brakujące pola (gdy invalid). */
  missing: Array<"name" | "address">;

  // Pola gotowe pod model Customer:
  name: string;
  company?: string;
  address: string;
  phone?: string;
  phone2?: string;
  email?: string;
  website?: string;
  notes?: string;
  tags?: string[];
  lastVisit?: string;
  nextAppointment?: string;

  // Po geokodowaniu uzupełniane:
  lat?: number;
  lng?: number;
  geocodeError?: string;
  /** Adres jaki zwrócił geokoder (display_name) – pomocne przy weryfikacji. */
  geocodeDisplay?: string;
}

const PHONE_CHARS = /[\d+\s\-()./]/;

/** Wyciąga wartość z wiersza dla danego pola schematu (z zachowaniem mapowania). */
function pick(
  row: Record<string, string>,
  mapping: ColumnMapping,
  field: SchemaField,
): string {
  const header = mapping[field];
  if (!header) return "";
  return (row[header] ?? "").trim();
}

/** Skleja imię i nazwisko z myślnikiem-spacją. */
function joinName(first: string, last: string): string {
  if (first && last) return `${first} ${last}`;
  return first || last;
}

/** Składa pełny adres z części (ulica / kod / miasto). */
function joinAddress(
  street: string,
  postalCode: string,
  city: string,
): string {
  // Format: "ulica, kod miasto"
  const parts: string[] = [];
  if (street) parts.push(street);

  const tail = [postalCode, city].filter(Boolean).join(" ").trim();
  if (tail) parts.push(tail);

  return parts.join(", ");
}

/** Parsuje datę w typowych formatach polskich/iso. Zwraca ISO string albo undefined. */
export function parseImportDate(raw: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  // Excel mógł zwrócić Date object z `cellDates: true` — wtedy String(d) =
  // "Mon Apr 25 2026 00:00:00 GMT...". Spróbujmy najpierw natywnego Date.
  const native = new Date(trimmed);
  if (!isNaN(native.getTime()) && trimmed.length >= 6) {
    // Sanity check: rok między 1900 a 2100
    const y = native.getFullYear();
    if (y >= 1900 && y <= 2100) {
      return native.toISOString();
    }
  }

  // Spróbuj polskich formatów: dd.MM.yyyy, dd/MM/yyyy, dd-MM-yyyy
  const m = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const [, dd, mm, rawYear] = m;
    let yyyy = rawYear;
    if (yyyy.length === 2) {
      // 25 → 2025; 99 → 1999. Cutoff przy 50.
      const yi = parseInt(yyyy, 10);
      yyyy = String(yi >= 50 ? 1900 + yi : 2000 + yi);
    }
    const yearNum = parseInt(yyyy, 10);
    if (yearNum < 1900 || yearNum > 2100) return undefined;
    const d = new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  return undefined;
}

/** Parsuje tagi z jednej komórki: dzieli po `,` `;` `|` `/` i trimuje. */
export function parseTags(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;|/]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Wykrywa czy pole wygląda na sensowny telefon (głównie do sanity-check). */
export function looksLikePhone(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  // Min 5 cyfr, większość znaków powinna być telefoniczna
  let digitCount = 0;
  let allowedCount = 0;
  for (const ch of trimmed) {
    if (PHONE_CHARS.test(ch)) allowedCount++;
    if (ch >= "0" && ch <= "9") digitCount++;
  }
  return digitCount >= 5 && allowedCount === trimmed.length;
}

export interface ComposeOptions {
  /** Niezmapowane nagłówki — wartości z tych kolumn lecą do `notes`. */
  unmappedHeaders: string[];
}

/**
 * Główna funkcja: bierze parsowane wiersze + mapping i zwraca kandydatów.
 * Zachowuje kolejność wierszy. Każdy wiersz dostaje rowId = jego index.
 */
export function composeCandidates(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  options: ComposeOptions,
): ImportCandidate[] {
  const out: ImportCandidate[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Nazwa: name -> firstName+lastName -> company
    const fullName = pick(row, mapping, "name");
    const first = pick(row, mapping, "firstName");
    const last = pick(row, mapping, "lastName");
    const company = pick(row, mapping, "company");

    let name = fullName;
    if (!name) name = joinName(first, last);
    if (!name) name = company; // jeśli mamy tylko firmę – używamy jej jako nazwy
    name = name.trim();

    // Adres: address -> street + postalCode + city
    let address = pick(row, mapping, "address");
    if (!address) {
      address = joinAddress(
        pick(row, mapping, "street"),
        pick(row, mapping, "postalCode"),
        pick(row, mapping, "city"),
      );
    }
    address = address.trim();

    const phone = pick(row, mapping, "phone");
    const phone2 = pick(row, mapping, "phone2");
    const email = pick(row, mapping, "email");
    const website = pick(row, mapping, "website");
    const tagsRaw = pick(row, mapping, "tags");
    const lastVisitRaw = pick(row, mapping, "lastVisit");
    const nextAppointmentRaw = pick(row, mapping, "nextAppointment");

    const baseNotes = pick(row, mapping, "notes");

    // Niezmapowane nagłówki -> append do notes z prefiksem.
    const extras: string[] = [];
    for (const header of options.unmappedHeaders) {
      const v = (row[header] ?? "").trim();
      if (v) extras.push(`${header}: ${v}`);
    }
    // Jeśli mamy company a nie jest tożsamy z name, warto go też zachować
    // w notes (bo company nie ma osobnego pola w UI obecnie poza zaawansowanymi).
    // Customer ma `company` – zachowujemy je jako pole, NIE w notes.

    const notesParts: string[] = [];
    if (baseNotes) notesParts.push(baseNotes);
    if (extras.length) notesParts.push(extras.join("\n"));
    const notes = notesParts.join("\n\n").trim() || undefined;

    const tags = parseTags(tagsRaw);
    const lastVisit = parseImportDate(lastVisitRaw);
    const nextAppointment = parseImportDate(nextAppointmentRaw);

    const missing: Array<"name" | "address"> = [];
    if (!name) missing.push("name");
    if (!address) missing.push("address");

    out.push({
      rowId: i,
      valid: missing.length === 0,
      missing,
      name,
      company:
        company && company !== name && company !== fullName
          ? company
          : undefined,
      address,
      phone: phone || undefined,
      phone2: phone2 || undefined,
      email: email || undefined,
      website: website || undefined,
      notes,
      tags: tags.length ? tags : undefined,
      lastVisit,
      nextAppointment,
    });
  }

  return out;
}
