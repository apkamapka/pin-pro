import { useCallback, useState } from "react";

/**
 * Hook do pobierania bieżącej lokalizacji GPS z obsługą błędów.
 *
 * Świadomie nie używa `watchPosition` — bateria i prywatność. Każde wywołanie
 * `request()` wywołuje jednorazowy `getCurrentPosition`. Browser sam pamięta
 * zgodę (raz przyznana = nie pyta ponownie), więc lazy-permission flow działa
 * w UX naturalnie: user klika "Pokaż w okolicy" → browser pyta raz → potem cisza.
 *
 * Stan jest persystowany w pamięci komponentu (nie w localStorage) — pozycja
 * GPS jest świeża tylko teraz, więc trzymanie jej między sesjami nie ma sensu.
 *
 * Współrzędne i błąd są jednoczesnymi state-ami: gdy przyjdzie nowy success,
 * czyścimy error; gdy przyjdzie nowy error, zachowujemy stary `coords` (user
 * mógł wcześniej raz dostać pozycję, więc nie tracimy jej tylko dlatego że
 * druga próba nie wyszła).
 */

export type GeoErrorCode =
  | "unsupported"
  | "denied"
  | "timeout"
  | "unavailable";

export interface GeoCoords {
  lat: number;
  lng: number;
  /** Dokładność w metrach (z `coords.accuracy`). */
  accuracy: number;
  /** Kiedy pomiar został wykonany (`position.timestamp`, ms). */
  timestamp: number;
}

export interface UseGeolocationResult {
  coords: GeoCoords | null;
  loading: boolean;
  error: GeoErrorCode | null;
  /** Wymuś nowe odczytanie pozycji. Resolves with coords lub rejects z GeoErrorCode. */
  request: () => Promise<GeoCoords>;
  /** Wyczyść pozycję i błąd (np. gdy user chce "wyloguj się z okolicy"). */
  reset: () => void;
}

interface Options {
  /**
   * Akceptowalna stareość pozycji w ms. Browser może oddać tańszy "fix"
   * z cache jeśli jest świeższy niż to. Domyślnie 30 s — kompromis
   * między dokładnością a szybkością odpowiedzi (ważne na mobile).
   */
  maximumAge?: number;
  /** Timeout odpowiedzi w ms. Domyślnie 10 s — wystarcza dla cold-start GPS. */
  timeout?: number;
  /** Czy żądać większej dokładności (kosztem baterii). Domyślnie `true`. */
  enableHighAccuracy?: boolean;
}

export function useGeolocation(opts: Options = {}): UseGeolocationResult {
  const {
    maximumAge = 30_000,
    timeout = 10_000,
    enableHighAccuracy = true,
  } = opts;

  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<GeoErrorCode | null>(null);

  const request = useCallback((): Promise<GeoCoords> => {
    return new Promise((resolve, reject) => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        setError("unsupported");
        reject("unsupported" as GeoErrorCode);
        return;
      }
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next: GeoCoords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          };
          setCoords(next);
          setError(null);
          setLoading(false);
          resolve(next);
        },
        (err) => {
          setLoading(false);
          let code: GeoErrorCode = "unavailable";
          if (err.code === err.PERMISSION_DENIED) code = "denied";
          else if (err.code === err.TIMEOUT) code = "timeout";
          setError(code);
          reject(code);
        },
        { enableHighAccuracy, timeout, maximumAge },
      );
    });
  }, [enableHighAccuracy, timeout, maximumAge]);

  const reset = useCallback(() => {
    setCoords(null);
    setError(null);
    setLoading(false);
  }, []);

  return { coords, loading, error, request, reset };
}
