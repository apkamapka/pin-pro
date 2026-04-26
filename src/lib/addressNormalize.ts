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
 */

export interface ParsedAddress {
  /** Surowe wejście (do wyświetlenia w UI). */
  raw: string;
  /** Sama nazwa ulicy bez prefiksu i bez numeru. */
  streetName: string;
  /** Numer domu, ewentualnie z literą. Bez numeru mieszkania. */
  houseNumber: string;
  /** Pełna ulica do query Nominatim: "Słoneczna 10a". */
  street: string;
  /** Kod pocztowy w formacie XX-XXX (zawsze z myślnikiem) lub undefined. */
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
    streetName,
    houseNumber,
    street: street.trim(),
    postalCode,
    city,
    cleaned: buildCleaned({ street, postalCode, city }),
  };
}
