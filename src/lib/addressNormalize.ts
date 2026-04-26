/**
 * Parser polskich adresów z bazy Excela / CSV.
 *
 * Realne wyzwania polskich adresów które tu obsługujemy:
 *  - prefiksy "ul.", "Ul.", "Al.", "Aleja", "pl.", "os.", "Osiedle" — usuwamy
 *  - kod pocztowy zlepiony z miastem: "33-383 Tylicz" lub czasem
 *    "33383 Tylicz" (bez myślnika)
 *  - numer mieszkania: "12/I/4", "12/4", "12 m.4", "12 m 4" — Nominatim
 *    nie ogarnia — bierzemy tylko numer domu
 *  - brak miasta (tylko kod pocztowy) — dopuszczalne, structured query
 *    Nominatim radzi sobie z samym kodem
 *  - numer domu z literą: "10a", "12B" — zostawiamy
 *
 * Output służy do dwóch celów:
 *  - structured query do Nominatim (lepszy hit-rate)
 *  - free-form fallback (gdy structured zawiedzie)
 *
 * Dla zagranicznych adresów używamy `parseAddress` które najpierw wykrywa
 * kraj a potem stosuje albo PL-specific parser, albo generyczny.
 */

import { COUNTRIES, detectCountry } from "./countries";

export interface ParsedAddress {
  /** Surowe wejście (do wyświetlenia w UI). */
  raw: string;
  /** Wykryty kraj (lowercase ISO 3166-1 alpha-2) lub undefined. */
  country?: string;
  /** Sama nazwa ulicy bez prefiksu i bez numeru. */
  streetName: string;
  /** Numer domu, ewentualnie z literą. Bez numeru mieszkania. */
  houseNumber: string;
  /** Pełna ulica do query Nominatim: "Słoneczna 10a". */
  street: string;
  /** Kod pocztowy w oryginalnym formacie kraju lub undefined. */
  postalCode?: string;
  /** Miasto/wieś. Może być undefined gdy adres miał tylko kod. */
  city?: string;
  /** Wyczyszczony adres do wyświetlenia / free-form fallback. */
  cleaned: string;
}

const STREET_PREFIXES = [
  // kolejność ma znaczenie — dłuższe pierwsze, żeby "Aleja" nie zjadło "Al."
  /^aleja\s+/i,
  /^osiedle\s+/i,
  /^ulica\s+/i,
  /^plac\s+/i,
  /^al\.\s*/i,
  /^ul\.\s*/i,
  /^pl\.\s*/i,
  /^os\.\s*/i,
];

/** Regex kodu pocztowego z myślnikiem albo bez (przerobimy na z myślnikiem). */
const POSTAL_CODE_RE = /\b(\d{2})-?(\d{3})\b/;

/**
 * Regex numeru domu na końcu fragmentu ulicy.
 * Może być: "10", "10a", "10A", "10/2", "12/I/4", "12 m.4", "12 m 4".
 * Łapiemy całe od pierwszego ciągu cyfr do końca i potem ucinamy mieszkanie.
 */
const HOUSE_NUMBER_TAIL = /\s+(\d+[A-Za-z]?(?:\s*[/\\]\s*[\dIVXivx]+)*(?:\s*m\.?\s*\d+)?)\s*$/;

/** Usuwa prefiks ulicy ("ul.", "Aleja", itd.). */
export function stripStreetPrefix(s: string): string {
  let out = s;
  for (const re of STREET_PREFIXES) {
    out = out.replace(re, "");
  }
  return out.trim();
}

/** Wyciąga numer domu (sam, bez mieszkania). "12/I/4" → "12". */
export function simplifyHouseNumber(raw: string): string {
  // Rzeczy w stylu "12/I/4" — bierzemy pierwszy człon przed pierwszym /.
  // Rzecz w stylu "12 m.4" lub "12 m 4" — bierzemy "12".
  // Rzecz w stylu "10a" — zostawiamy.
  // Rzecz w stylu "12/4" — to jest typowy zapis "dom 12 / mieszkanie 4",
  // ale czasem to też "blok 12 / klatka 4". Zostawiamy "12" — bezpieczniej.
  const m = raw.match(/^(\d+[A-Za-z]?)/);
  return m ? m[1] : raw.trim();
}

/** Najprostszy capitalize - pierwsza wielka, reszta jak była (zachowuje "BAJLANDO"). */
function smartCapitalize(s: string): string {
  if (!s) return s;
  // jeśli wszystko małymi literami → kapitalizuj każde słowo
  if (s === s.toLocaleLowerCase("pl-PL")) {
    return s
      .split(/\s+/)
      .map((w) => (w.length > 0 ? w[0].toLocaleUpperCase("pl-PL") + w.slice(1) : w))
      .join(" ");
  }
  return s;
}

/** Sklejamy adres z powrotem do pojedynczego stringa "Ulica 10, KOD Miasto". */
function buildCleaned(parts: {
  street: string;
  postalCode?: string;
  city?: string;
}): string {
  const segs: string[] = [];
  if (parts.street) segs.push(parts.street);
  const tail = [parts.postalCode, parts.city].filter(Boolean).join(" ").trim();
  if (tail) segs.push(tail);
  return segs.join(", ");
}

export function parsePolishAddress(raw: string): ParsedAddress {
  const original = raw;
  let working = raw.replace(/\s+/g, " ").trim();

  // 1. Wyciągnij kod pocztowy (z myślnikiem albo bez)
  let postalCode: string | undefined;
  const pcMatch = working.match(POSTAL_CODE_RE);
  if (pcMatch) {
    postalCode = `${pcMatch[1]}-${pcMatch[2]}`;
    // Wytnij kod z working stringa
    working = working.replace(pcMatch[0], " ").replace(/\s+/g, " ").trim();
  }

  // 2. Po kodzie pocztowym: cokolwiek zostało po prawej w oryginale to miasto
  //    Łatwiej: re-split oryginał względem kodu pocztowego.
  let city: string | undefined;
  let beforePostal = working;
  if (pcMatch) {
    const idx = original.indexOf(pcMatch[0]);
    const afterRaw = original.slice(idx + pcMatch[0].length).trim();
    if (afterRaw) {
      // Czasem po kodzie jest przecinek albo dwukropek — pomijamy
      city = afterRaw.replace(/^[,;:\s-]+/, "").trim() || undefined;
    }
    beforePostal = original
      .slice(0, idx)
      .replace(/[,;]\s*$/, "")
      .trim();
  } else {
    // Brak kodu — spróbuj rozdzielić po przecinku: "ul. X 10, Warszawa"
    const lastComma = working.lastIndexOf(",");
    if (lastComma > 0) {
      city = working.slice(lastComma + 1).trim() || undefined;
      beforePostal = working.slice(0, lastComma).trim();
    } else {
      beforePostal = working;
    }
  }

  // 3. Usuń prefix "ul. " / "al. " / itd. z beforePostal
  let streetWithNumber = stripStreetPrefix(beforePostal);

  // 4. Wyciągnij numer domu z końca
  let streetName = streetWithNumber;
  let houseNumber = "";
  const numMatch = streetWithNumber.match(HOUSE_NUMBER_TAIL);
  if (numMatch) {
    houseNumber = simplifyHouseNumber(numMatch[1]);
    streetName = streetWithNumber.slice(0, numMatch.index!).trim();
  } else {
    // Może numer jest na samym początku (rzadkie, ale): "10 Słoneczna"
    const leadMatch = streetWithNumber.match(/^(\d+[A-Za-z]?)\s+(.+)$/);
    if (leadMatch) {
      houseNumber = simplifyHouseNumber(leadMatch[1]);
      streetName = leadMatch[2].trim();
    }
  }

  // 5. Capitalize jeśli wszystko małymi
  streetName = smartCapitalize(streetName);
  if (city) city = smartCapitalize(city);

  const street = houseNumber ? `${streetName} ${houseNumber}` : streetName;

  return {
    raw: original,
    country: "pl",
    streetName,
    houseNumber,
    street: street.trim(),
    postalCode,
    city,
    cleaned: buildCleaned({ street, postalCode, city }),
  };
}

// ---------------------------------------------------------------------------
// Generic foreign-address parser
// ---------------------------------------------------------------------------

/**
 * Wszystkie znane wzorce kodów pocztowych (bez ograniczenia do unikalnych).
 * Używamy do *wyciągnięcia* kodu z adresu – sam fakt match'u nie wskazuje
 * jednoznacznie kraju (5-cyfrowe kody używa wiele krajów).
 */
const ALL_POSTAL_PATTERNS: RegExp[] = [
  /\b\d{2}-\d{3}\b/, // PL: 33-383
  /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i, // GB: SW1A 1AA
  /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i, // CA: M5V 3A8
  /\b\d{3}-\d{4}\b/, // JP: 100-0001
  /\b\d{4}\s?[A-Z]{2}\b/, // NL: 1011 AB
  /\b[A-Z]{2}-\d{4,5}\b/i, // LV/LT
  /\b\d{5}-\d{3}\b/, // BR: 01310-100
  /\b\d{4}-\d{3}\b/, // PT: 1000-001
  /\b\d{6}\b/, // RU/CN/IN/UA: 6-digit
  /\b\d{5}\b/, // DE/FR/IT/ES/US/CZ-without-space (mniej preferowany)
  /\b\d{3}\s\d{2}\b/, // CZ/SK: 110 00
  /\b\d{4}\b/, // CH/AT/BE/etc — najszerszy
];

function extractPostalCode(raw: string): {
  postalCode: string | undefined;
  matchedString: string | undefined;
  beforePart: string;
  afterPart: string;
} {
  for (const re of ALL_POSTAL_PATTERNS) {
    const m = raw.match(re);
    if (m && m.index !== undefined) {
      return {
        postalCode: m[0].replace(/\s+/g, " ").trim(),
        matchedString: m[0],
        beforePart: raw.slice(0, m.index).trim(),
        afterPart: raw.slice(m.index + m[0].length).trim(),
      };
    }
  }
  return {
    postalCode: undefined,
    matchedString: undefined,
    beforePart: raw,
    afterPart: "",
  };
}

/**
 * Generyczny parser adresu zagranicznego.
 * Bez "ul." stripping (zostawiamy oryginał, Nominatim ogarnie),
 * bez polskiej kapitalizacji, bez polskich regex'ów postal.
 *
 * Strategia:
 *  1) Wytnij nazwę kraju jeśli widoczna na końcu (np. ", Germany")
 *  2) Wyciągnij kod pocztowy szerszym wzorcem
 *  3) Część przed kodem = ulica + numer; część po kodzie = miasto
 *     (lub: jeśli brak kodu, split po ostatnim przecinku)
 *  4) Wyciągnij numer domu z końca części-ulicowej
 */
function parseGenericAddress(
  raw: string,
  detectedCountry: string | undefined,
): ParsedAddress {
  const original = raw;
  let working = raw.replace(/\s+/g, " ").trim();

  // 1) Usuń nazwę kraju z końca (jeśli się dopasowała w detekcji).
  //    Robimy to żeby nie wpadła do "city".
  if (detectedCountry) {
    const c = COUNTRIES.find((x) => x.code === detectedCountry);
    if (c) {
      const normalized = working.toLocaleLowerCase("pl-PL");
      for (const alias of c.aliases) {
        const re = new RegExp(`[,;]?\\s*${escapeRegex(alias)}\\s*$`, "i");
        if (re.test(normalized)) {
          working = working.replace(re, "").trim();
          // Czyść trailing przecinek
          working = working.replace(/[,;]\s*$/, "").trim();
          break;
        }
      }
    }
  }

  // 2) Wyciągnij postal code
  const { postalCode, beforePart, afterPart } = extractPostalCode(working);

  // 3) Ulica vs miasto
  let streetWithNumber = "";
  let city: string | undefined;

  if (postalCode) {
    streetWithNumber = beforePart.replace(/[,;]\s*$/, "").trim();
    city = afterPart ? afterPart.replace(/^[,;:\s-]+/, "").trim() : undefined;

    // Niektóre kraje (DE, FR) mają format "Postal City, Street" — rzadko, ale.
    // Standardowo zakładamy "Street, Postal City" lub "Street Postal City".
    // Jeśli "before" jest puste → adres miał format "10115 Berlin, Some Str."
    if (!streetWithNumber && city) {
      // Jest tylko city po kodzie. Sprawdźmy czy nie było ulicy w afterPart.
      // Konkretnie: split city po pierwszym przecinku.
      const split = city.split(",");
      if (split.length > 1) {
        city = split[0].trim();
        streetWithNumber = split.slice(1).join(",").trim();
      }
    }
  } else {
    // Brak kodu — podziel po ostatnim przecinku
    const lastComma = working.lastIndexOf(",");
    if (lastComma > 0) {
      city = working.slice(lastComma + 1).trim() || undefined;
      streetWithNumber = working.slice(0, lastComma).trim();
    } else {
      streetWithNumber = working;
    }
  }

  // 4) Wyciągnij numer domu z końca (zachowuje się tak samo dla wszystkich krajów)
  let streetName = streetWithNumber;
  let houseNumber = "";
  if (streetWithNumber) {
    const tailMatch = streetWithNumber.match(HOUSE_NUMBER_TAIL);
    if (tailMatch) {
      houseNumber = simplifyHouseNumber(tailMatch[1]);
      streetName = streetWithNumber.slice(0, tailMatch.index!).trim();
    } else {
      // Liczba na początku (US format: "221B Baker Street")
      const leadMatch = streetWithNumber.match(/^(\d+[A-Za-z]?)\s+(.+)$/);
      if (leadMatch) {
        houseNumber = simplifyHouseNumber(leadMatch[1]);
        streetName = leadMatch[2].trim();
      }
    }
  }

  const street = houseNumber ? `${streetName} ${houseNumber}` : streetName;

  return {
    raw: original,
    country: detectedCountry,
    streetName,
    houseNumber,
    street: street.trim(),
    postalCode,
    city,
    cleaned: buildCleaned({ street, postalCode, city }),
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Top-level dispatcher
// ---------------------------------------------------------------------------

/**
 * Główny entry point: wykrywa kraj i wybiera odpowiedni parser.
 * - PL → polski parser (z usuwaniem "ul." i kapitalizacją)
 * - reszta → generic parser
 *
 * Jeśli nic nie wykryto i podano `defaultCountry`, używa go jako podpowiedzi.
 * (Wpływa głównie na późniejszy geokoder — sam parsing adresu jest wtedy
 * zwykle generyczny.)
 */
export function parseAddress(
  raw: string,
  defaultCountry?: string,
): ParsedAddress {
  const detection = detectCountry(raw);
  // "auto" w defaultCountry oznacza "bez filtra" — nie traktujemy go jako kod
  // kraju w parserze.
  const fallback =
    defaultCountry && defaultCountry !== "auto" ? defaultCountry : undefined;
  let country = detection.code ?? fallback;

  // PL ma swój specyficzny parser (skrót "ul.", capitalize, etc.)
  if (country === "pl" || (!country && /\d{2}-\d{3}/.test(raw))) {
    const result = parsePolishAddress(raw);
    // Upewnij się że country jest ustawiony
    return { ...result, country: "pl" };
  }

  // Wszystko inne → generic
  return parseGenericAddress(raw, country);
}
