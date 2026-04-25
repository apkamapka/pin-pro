import type { Category, Customer } from "@/types/customer";

/**
 * Wyszukiwarka klientów. Czysta funkcja – łatwo testowalna,
 * bez zależności od reacta/store.
 *
 * Zasady:
 * - case-insensitive substring match,
 * - accent-insensitive: "krakow" znajdzie "Kraków", "lodz" znajdzie "Łódź".
 *   Robimy to przez NFD + strip diacritics. To ważne w PL gdzie ludzie
 *   często piszą bez ogonków (telefon, klawiatury angielskie),
 * - puste zapytanie zwraca wszystko,
 * - przeszukujemy szerokie pole: name, company, profession, address,
 *   phone(*), email, notes, tags, nazwa kategorii i teksty wpisów osi czasu.
 *   Zdjęcia/voice notes pomijamy – nie ma ich jak przeszukać tekstowo.
 */
export interface SearchableCustomer extends Customer {
  /** Pre-cached lowercase haystack – zalecane dla list >100 klientów,
   *  ale nie wymagane. Funkcja zbuduje haystack on-the-fly jeśli go nie ma. */
  __haystack?: string;
}

/** Normalizacja: lowercase + strip accents. Wyciągnięte żeby query i haystack
 *  używały dokładnie tej samej funkcji – inaczej dostalibyśmy false negatives. */
export function normalizeForSearch(s: string): string {
  // \p{Diacritic} pokrywa polskie ogonki + większość europejskich.
  // 'ł' nie jest jednak diacritic'iem – to oddzielna litera. Mapujemy ręcznie.
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .toLocaleLowerCase();
}

export function buildHaystack(
  c: Customer,
  categoryName: string | undefined,
): string {
  const parts: string[] = [
    c.name,
    c.company ?? "",
    c.profession ?? "",
    c.address,
    c.phone ?? "",
    c.phone2 ?? "",
    c.email ?? "",
    c.website ?? "",
    c.notes ?? "",
    categoryName ?? "",
    ...(c.tags ?? []),
    ...((c.timeline ?? []).map((e) => e.text ?? "")),
  ];
  return normalizeForSearch(parts.join(" \u0001 "));
}

export interface SearchOptions {
  categories?: Category[];
}

/**
 * Filtruje listę klientów po zapytaniu. Wielowyrazowe zapytania
 * traktujemy jako AND ("piec gaz" → musi pasować i "piec" i "gaz").
 */
export function searchCustomers(
  customers: Customer[],
  query: string,
  opts: SearchOptions = {},
): Customer[] {
  const trimmed = query.trim();
  if (!trimmed) return customers;

  // Mapa kategorii dla szybkiego dostępu.
  const catName = new Map<string, string>();
  for (const cat of opts.categories ?? []) catName.set(cat.id, cat.name);

  const tokens = normalizeForSearch(trimmed)
    .split(/\s+/)
    .filter(Boolean);

  return customers.filter((c) => {
    const haystack = buildHaystack(
      c,
      c.categoryId ? catName.get(c.categoryId) : undefined,
    );
    return tokens.every((token) => haystack.includes(token));
  });
}

/** Zbiera wszystkie tagi z całej listy klientów, posortowane,
 *  unique, case-preserved (pierwsza napotkana wersja wygrywa). */
export function collectAllTags(customers: Customer[]): string[] {
  const seen = new Map<string, string>(); // lowercase -> original casing
  for (const c of customers) {
    for (const tag of c.tags ?? []) {
      const trimmed = tag.trim();
      if (!trimmed) continue;
      const key = trimmed.toLocaleLowerCase();
      if (!seen.has(key)) seen.set(key, trimmed);
    }
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}
