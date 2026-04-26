/**
 * Geokoder oparty o Nominatim (OpenStreetMap).
 *
 * Strategia trzech prób żeby maksymalizować hit-rate dla polskich adresów:
 *
 * Próba 1 — STRUCTURED QUERY:
 *   Parsujemy adres na (street, postalcode, city) i wysyłamy jako oddzielne
 *   parametry. Nominatim ma znacznie lepszy hit-rate na structured niż na
 *   free-form, zwłaszcza dla małych miejscowości i adresów typu
 *   "ul. Mikulczycka 12/I/4 42-675" (bez miasta — sam kod pocztowy
 *   wystarczy żeby Nominatim trafił w obszar).
 *
 * Próba 2 — FREE-FORM Z FILTREM PL:
 *   Jeśli structured nie znalazł, lecimy z całym adresem jako `q=...`
 *   ale z `countrycodes=pl`. To ratuje przypadki gdzie format adresu jest
 *   nietypowy ale całość-jako-string Nominatim poprawnie zinterpretuje.
 *
 * Próba 3 — TYLKO KOD POCZTOWY (+ miasto):
 *   Ostatnia deska ratunku. Pin trafi w środek danego kodu pocztowego.
 *   User może go potem przesunąć ręcznie na mapie.
 *
 * Wszystkie zapytania zawsze mają `countrycodes=pl` — to FUNDAMENTALNE.
 * Bez tego Nominatim szuka po świecie i może znaleźć "ul. Słoneczna" w
 * losowej miejscowości w Niemczech zamiast w Tyliczu.
 *
 * Rate limit Nominatim to 1 req/sec. Wewnętrzny retry wymaga delaya 1.1s
 * między próbami dla tego samego adresu.
 */

import { parsePolishAddress } from "./addressNormalize";

export interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
}

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
/** Pauza między próbami w obrębie tego samego adresu (rate limit Nominatim). */
const RETRY_DELAY_MS = 1100;

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
}

/** Parametry wspólne dla wszystkich requestów do Nominatim. */
function commonParams(): URLSearchParams {
  const p = new URLSearchParams();
  p.set("format", "json");
  p.set("limit", "1");
  p.set("countrycodes", "pl"); // ← KLUCZOWE: tylko Polska
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

/** Sleep. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface GeocodeOptions {
  /** Custom fetch (do testów). */
  fetchImpl?: typeof fetch;
  /** Custom delay (do testów; 0 wyłącza retry-pauzę). */
  retryDelayMs?: number;
}

/**
 * Geokoduj adres. Robi do 3 prób (structured → free-form → samo postalcode).
 * Zwraca null gdy nic nie znaleziono.
 */
export async function geocodeAddress(
  query: string,
  options: GeocodeOptions = {},
): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const fetchImpl = options.fetchImpl ?? fetch;
  const retryDelay = options.retryDelayMs ?? RETRY_DELAY_MS;

  const parsed = parsePolishAddress(trimmed);

  // Próba 1: structured query.
  // Jest sens tylko jeśli mamy minimum jeden konkretny atrybut.
  const hasStructuredSignal =
    (parsed.streetName && parsed.city) ||
    parsed.postalCode ||
    (parsed.streetName && parsed.postalCode);

  if (hasStructuredSignal) {
    const p = commonParams();
    if (parsed.street) p.set("street", parsed.street);
    if (parsed.city) p.set("city", parsed.city);
    if (parsed.postalCode) p.set("postalcode", parsed.postalCode);

    const r1 = await nominatimSearch(p, fetchImpl);
    if (r1) return r1;

    if (retryDelay > 0) await sleep(retryDelay);
  }

  // Próba 2: free-form z PL filter.
  // Wysyłamy *wyczyszczony* adres (bez "ul.", z normalnym kodem) — to
  // dla Nominatim jest łatwiejsze do sparsowania niż surowe wejście.
  const freeformQuery = parsed.cleaned || trimmed;
  const p2 = commonParams();
  p2.set("q", freeformQuery);
  const r2 = await nominatimSearch(p2, fetchImpl);
  if (r2) return r2;

  // Próba 3: jeśli mamy sam kod pocztowy (+ ewentualnie miasto), spróbujmy
  // wycelować w środek tego obszaru. Pin nie będzie idealny, ale klient
  // przynajmniej trafi we właściwą okolicę i można go przesunąć ręcznie.
  if (parsed.postalCode) {
    if (retryDelay > 0) await sleep(retryDelay);
    const p3 = commonParams();
    if (parsed.city) p3.set("city", parsed.city);
    p3.set("postalcode", parsed.postalCode);
    const r3 = await nominatimSearch(p3, fetchImpl);
    if (r3) return r3;
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
