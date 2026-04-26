/**
 * Geokoder oparty o Nominatim (OpenStreetMap) — wielokrajowy.
 *
 * Strategia:
 *
 *   parseAddress(query) → wykrywa kraj z adresu (po nazwie kraju w tekście
 *     i po unikalnym wzorcu kodu pocztowego, np. PL "33-383", GB "SW1A 1AA")
 *
 *   wybór efektywnego kraju (effective country):
 *     1) jeśli wykryto z adresu → użyj tego (high confidence)
 *     2) jeśli user ma defaultCountry w Settings → użyj go
 *     3) jeśli user wybrał "auto" w Settings → bez countrycodes (worldwide)
 *
 *   Próba 1 — STRUCTURED z effective country.
 *   Próba 2 — FREE-FORM z effective country.
 *   Próba 3 — TYLKO POSTAL CODE (gdy mamy kod) z effective country.
 *   Próba 4 — STRUCTURED bez countrycodes (worldwide). Ratunek dla
 *     adresów z wybrane kraj a Nominatim ma daną pozycję pod innym krajem.
 *   Próba 5 — FREE-FORM bez countrycodes (worldwide).
 *
 *   W praktyce większość adresów znajdzie się przy próbie 1.
 *
 * Rate limit Nominatim: 1 req/sec. Wewnętrzny retry wymaga delaya 1.1s
 * między próbami.
 */

import { parseAddress } from "./addressNormalize";
import { COUNTRY_AUTO } from "./countries";

export interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
}

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const RETRY_DELAY_MS = 1100;

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
}

function commonParams(countryCode?: string): URLSearchParams {
  const p = new URLSearchParams();
  p.set("format", "json");
  p.set("limit", "1");
  if (countryCode) {
    p.set("countrycodes", countryCode);
  }
  p.set("accept-language", "pl");
  return p;
}

async function nominatimSearch(
  params: URLSearchParams,
  fetchImpl: typeof fetch = fetch,
): Promise<GeocodeResult | null> {
  const url = `${NOMINATIM_BASE}/search?${params.toString()}`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      headers: { Accept: "application/json" },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let data: NominatimHit[];
  try {
    data = (await res.json()) as NominatimHit[];
  } catch {
    return null;
  }
  if (!Array.isArray(data) || data.length === 0) return null;
  const hit = data[0];
  const lat = parseFloat(hit.lat);
  const lng = parseFloat(hit.lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng, display_name: hit.display_name };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface GeocodeOptions {
  /** Custom fetch (do testów). */
  fetchImpl?: typeof fetch;
  /** Custom delay (do testów; 0 wyłącza retry-pauzę). */
  retryDelayMs?: number;
  /**
   * Domyślny kraj z Ustawień użytkownika (lowercase ISO code, np. "pl").
   * Specjalna wartość "auto" oznacza "bez filtra kraju".
   * Używany TYLKO gdy detekcja z adresu nie zadziała.
   */
  defaultCountry?: string;
}

/**
 * Geokoduj adres. Robi do 5 prób z eskalacją (najpierw structured z krajem,
 * potem fallbacki). Zwraca null gdy żadna nie znalazła.
 */
export async function geocodeAddress(
  query: string,
  options: GeocodeOptions = {},
): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const fetchImpl = options.fetchImpl ?? fetch;
  const retryDelay = options.retryDelayMs ?? RETRY_DELAY_MS;
  const defaultCountry = options.defaultCountry ?? "pl";

  const parsed = parseAddress(trimmed, defaultCountry);

  // Wybór kraju do filtra:
  //  - jeśli parser wykrył kraj (z nazwy lub unikalnego postal pattern) → użyj go
  //  - jeśli user wybrał "auto" → undefined (worldwide)
  //  - inaczej → defaultCountry
  let effectiveCountry: string | undefined;
  if (parsed.country) {
    effectiveCountry = parsed.country;
  } else if (defaultCountry === COUNTRY_AUTO) {
    effectiveCountry = undefined;
  } else {
    effectiveCountry = defaultCountry;
  }

  // Helper liczy ile razy strzeliliśmy do Nominatim — żeby spać tylko między
  // realnymi requestami (a nie przed pierwszym).
  let attemptCount = 0;
  const tryNominatim = async (
    params: URLSearchParams,
  ): Promise<GeocodeResult | null> => {
    if (attemptCount > 0 && retryDelay > 0) {
      await sleep(retryDelay);
    }
    attemptCount++;
    return nominatimSearch(params, fetchImpl);
  };

  const hasStructuredSignal =
    (parsed.streetName && parsed.city) ||
    parsed.postalCode ||
    (parsed.streetName && parsed.postalCode);

  // Próba 1: structured z effective country
  if (hasStructuredSignal) {
    const p = commonParams(effectiveCountry);
    if (parsed.street) p.set("street", parsed.street);
    if (parsed.city) p.set("city", parsed.city);
    if (parsed.postalCode) p.set("postalcode", parsed.postalCode);
    const r = await tryNominatim(p);
    if (r) return r;
  }

  // Próba 2: free-form z effective country
  const freeformQuery = parsed.cleaned || trimmed;
  {
    const p = commonParams(effectiveCountry);
    p.set("q", freeformQuery);
    const r = await tryNominatim(p);
    if (r) return r;
  }

  // Próba 3: postal code only (jeśli mamy kod)
  if (parsed.postalCode) {
    const p = commonParams(effectiveCountry);
    if (parsed.city) p.set("city", parsed.city);
    p.set("postalcode", parsed.postalCode);
    const r = await tryNominatim(p);
    if (r) return r;
  }

  // Próba 4-5: ostatnia deska ratunku — bez filtra kraju.
  // Tylko jeśli mieliśmy effectiveCountry (czyli filtrowaliśmy).
  // Bez sensu robić "tę samą próbę" jeśli już byliśmy bez filtra.
  if (effectiveCountry) {
    if (hasStructuredSignal) {
      const p = commonParams(undefined);
      if (parsed.street) p.set("street", parsed.street);
      if (parsed.city) p.set("city", parsed.city);
      if (parsed.postalCode) p.set("postalcode", parsed.postalCode);
      const r = await tryNominatim(p);
      if (r) return r;
    }

    {
      const p = commonParams(undefined);
      p.set("q", freeformQuery);
      const r = await tryNominatim(p);
      if (r) return r;
    }
  }

  return null;
}

/** Reverse geocoding (do "pobierz adres z mapy"). */
export async function reverseGeocode(
  lat: number,
  lng: number,
  options: GeocodeOptions = {},
): Promise<string | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=pl`;
  try {
    const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? null;
  } catch {
    return null;
  }
}
