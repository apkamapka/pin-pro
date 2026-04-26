/**
 * Batch geokoder dla importu.
 *
 * Nominatim (darmowy OSM) ma sztywny rate limit 1 req/sec — przekraczanie
 * tego skutkuje zbanowaniem IP.  Robimy więc sequential with delay.
 *
 * Wspiera:
 *  - progres (ile zrobione / ile do zrobienia)
 *  - anulowanie (AbortSignal-style, ale prościej – flaga `cancelled`)
 *  - obsługę błędów per-wiersz (jeden geokod nie wywala całego importu)
 *  - "okruszki" wstrzymywania, żeby UI był responsive
 */

import { geocodeAddress } from "./geocode";
import type { ImportCandidate } from "./importCompose";

/** Minimalny odstęp między requestami do Nominatim w ms. */
const NOMINATIM_DELAY_MS = 1100;

export interface GeocodeProgress {
  /** Ile wierszy zostało już sprawdzone (success + fail). */
  done: number;
  /** Łączna liczba wierszy do zgeokodowania. */
  total: number;
  /** Ile się powiodło. */
  success: number;
  /** Ile padło. */
  failed: number;
  /** Aktualny przetwarzany kandydat (do podpowiedzi w UI). */
  current?: ImportCandidate;
}

export interface BatchGeocodeOptions {
  /** Wywoływane po każdym geokodzie — synchronicznie, dla aktualizacji UI. */
  onProgress?: (progress: GeocodeProgress) => void;
  /** Sygnał anulowania – jeśli zwróci `true`, batch przestaje przetwarzać. */
  shouldCancel?: () => boolean;
  /** Override delay (do testów). */
  delayMs?: number;
  /** Override geokodera (do testów). */
  geocode?: (q: string) => Promise<{
    lat: number;
    lng: number;
    display_name: string;
  } | null>;
}

export interface BatchGeocodeResult {
  /** Kandydaci po zaktualizowaniu polami lat/lng/geocodeError. Mutowane in-place. */
  candidates: ImportCandidate[];
  /** Czy batch został przerwany (anulowanie). */
  cancelled: boolean;
}

/** Pomocnicza paueza która respektuje cancellation. */
function sleep(ms: number, shouldCancel?: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0 || shouldCancel?.()) {
      resolve();
      return;
    }
    const start = Date.now();
    const tick = () => {
      if (shouldCancel?.()) {
        resolve();
        return;
      }
      const elapsed = Date.now() - start;
      if (elapsed >= ms) {
        resolve();
        return;
      }
      setTimeout(tick, Math.min(100, ms - elapsed));
    };
    tick();
  });
}

/**
 * Geokoduj listę kandydatów po kolei. Mutuje pola `lat`, `lng`,
 * `geocodeError`, `geocodeDisplay` w przekazanych obiektach.
 */
export async function batchGeocode(
  candidates: ImportCandidate[],
  options: BatchGeocodeOptions = {},
): Promise<BatchGeocodeResult> {
  const {
    onProgress,
    shouldCancel,
    delayMs = NOMINATIM_DELAY_MS,
    geocode = geocodeAddress,
  } = options;

  // Zliczamy tylko tych, którzy są valid i nie mają jeszcze koordynatów —
  // resztę pomijamy w batchu.
  const queue = candidates.filter(
    (c) => c.valid && c.lat === undefined && c.lng === undefined,
  );
  const total = queue.length;
  let done = 0;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < queue.length; i++) {
    if (shouldCancel?.()) {
      return { candidates, cancelled: true };
    }

    const c = queue[i];
    onProgress?.({ done, total, success, failed, current: c });

    try {
      const result = await geocode(c.address);
      if (result) {
        c.lat = result.lat;
        c.lng = result.lng;
        c.geocodeDisplay = result.display_name;
        success++;
      } else {
        c.geocodeError = "not_found";
        failed++;
      }
    } catch (err) {
      c.geocodeError = (err as Error).message || "error";
      failed++;
    }

    done++;
    onProgress?.({ done, total, success, failed, current: c });

    // Pauza przed kolejnym (oprócz ostatniego)
    if (i < queue.length - 1) {
      await sleep(delayMs, shouldCancel);
    }
  }

  return { candidates, cancelled: false };
}
