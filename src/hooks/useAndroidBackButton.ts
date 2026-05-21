import { useEffect, useRef } from "react";
import { isNative } from "@/lib/capacitor";

interface BackButtonOptions {
  /** Czy jakiś Sheet/dialog jest otwarty. */
  sheetOpen: boolean;
  /** Zamknij otwarty Sheet/dialog. */
  closeSheet: () => void;
  /** Czy jesteśmy na zakładce „Mapa” (ekran startowy). */
  onMap: boolean;
  /** Przełącz na zakładkę „Mapa”. */
  goToMap: () => void;
  /** Komunikat „Naciśnij ponownie, aby wyjść”. */
  exitMessage: string;
  /** Funkcja pokazująca toast. */
  notify: (msg: string) => void;
}

/**
 * Obsługa sprzętowego przycisku „wstecz” na Androidzie.
 *
 * Priorytety przy cofnięciu:
 *   1. Otwarty Sheet/dialog  → zamknij go.
 *   2. Inna zakładka niż Mapa → wróć na Mapę.
 *   3. Mapa, nic otwartego    → pierwszy raz: toast „Naciśnij ponownie…”,
 *      drugi raz w ciągu 2 s: wyjście z apki. Inaczej cofnięcie nie wyrzuca
 *      już użytkownika z apki przez przypadek.
 *
 * Listener rejestrujemy raz; aktualny stan UI czytamy przez refy, żeby nie
 * przepisywać listenera przy każdej zmianie zakładki.
 */
export function useAndroidBackButton(opts: BackButtonOptions): void {
  const ref = useRef(opts);
  ref.current = opts;

  // licznik „uzbrojonego” wyjścia + timer do rozbrojenia
  const exitArmed = useRef(false);
  const armTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!isNative) return;

    let remove: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("backButton", () => {
          const o = ref.current;

          if (o.sheetOpen) {
            o.closeSheet();
            return;
          }
          if (!o.onMap) {
            o.goToMap();
            return;
          }

          // Na mapie: podwójne cofnięcie, aby wyjść.
          if (exitArmed.current) {
            if (armTimer.current) window.clearTimeout(armTimer.current);
            App.exitApp();
            return;
          }
          exitArmed.current = true;
          o.notify(o.exitMessage);
          if (armTimer.current) window.clearTimeout(armTimer.current);
          armTimer.current = window.setTimeout(() => {
            exitArmed.current = false;
            armTimer.current = null;
          }, 2000);
        });
        if (cancelled) {
          handle.remove();
        } else {
          remove = () => handle.remove();
        }
      } catch {
        /* web / brak pluginu – ignoruj */
      }
    })();

    return () => {
      cancelled = true;
      if (armTimer.current) window.clearTimeout(armTimer.current);
      remove?.();
    };
  }, []);
}
