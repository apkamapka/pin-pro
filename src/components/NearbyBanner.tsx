import { useEffect, useMemo, useState } from "react";
import { Bell, X } from "lucide-react";
import { useCustomers } from "@/store/customers";
import { useI18n, useT } from "@/lib/i18n";
import { useGeolocation } from "@/hooks/useGeolocation";
import { findNearby, formatDistance } from "@/lib/distance";

interface Props {
  /** Wywoływane gdy user kliknie belkę żeby przejść do zakładki "Okolica". */
  onOpen: () => void;
}

/**
 * Belka informacyjna pokazywana nad mapą, gdy w okolicy użytkownika znajduje
 * się przeterminowany klient. Logika świadomie cicha:
 *
 * 1. NIE pyta o GPS proaktywnie. Sprawdza tylko jeśli browser już ma zgodę
 *    (Permissions API) — żeby na pierwszym uruchomieniu nie pokazywać natywnego
 *    promptu zaraz po starcie. To by było agresywne i większość ludzi by odmówiła.
 * 2. Banner uznajemy za "schowany" do końca sesji po jednym kliknięciu X.
 *    To jest in-memory — odśwież stronę i banner wraca jeśli sytuacja jest aktualna.
 *    Świadomie nie persystujemy bo "przeterminowane" zmienia się dynamicznie i
 *    user powinien dostać update jak otworzy apkę następnego dnia.
 * 3. Pokazujemy tylko najpilniejszy przypadek — najbliższego przeterminowanego klienta.
 *    Listę widzi w zakładce "Okolica" po kliknięciu.
 */
export function NearbyBanner({ onOpen }: Props) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const customers = useCustomers((s) => s.customers);
  const radiusKm = useCustomers((s) => s.nearbyRadiusKm);
  const { coords, request } = useGeolocation({
    // Dla bannera nie potrzebujemy precyzji metra — tylko "tak/nie w 5 km".
    enableHighAccuracy: false,
    timeout: 8_000,
    // Akceptujemy 5-minutowy cache — banner ma być cichy, nie ścigamy się z czasem.
    maximumAge: 5 * 60 * 1000,
  });

  const [dismissed, setDismissed] = useState(false);
  const [permGranted, setPermGranted] = useState<boolean | null>(null);

  // Sprawdź zgodę na geolokalizację bez wywoływania promptu.
  // Permissions API nie jest wszędzie (Safari iOS dawno temu nie miał),
  // wtedy permGranted zostanie null i nic się nie odpala — to OK.
  useEffect(() => {
    let cancelled = false;
    if (typeof navigator === "undefined" || !navigator.permissions) {
      setPermGranted(false);
      return;
    }
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (cancelled) return;
        setPermGranted(status.state === "granted");
        // Jeśli zgoda zmieni się w trakcie życia komponentu (rzadkie),
        // też zaktualizuj.
        const handler = () =>
          setPermGranted(status.state === "granted");
        status.addEventListener("change", handler);
        // brak cleanupu — komponent długo żyje w drzewie i tak
      })
      .catch(() => {
        if (!cancelled) setPermGranted(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Tylko gdy zgoda już była — wywołaj GPS (browser zwróci natychmiast z cache
  // jeśli pasuje maximumAge).
  useEffect(() => {
    if (permGranted) {
      request().catch(() => {
        // Cicho. Banner po prostu się nie pokaże.
      });
    }
  }, [permGranted, request]);

  const candidate = useMemo(() => {
    if (!coords) return null;
    const list = findNearby(customers, coords.lat, coords.lng, radiusKm);
    if (list.length === 0) return null;
    // Tylko klienci przeterminowani — banner ma trigger powodujący akcję,
    // nie informację "Hej masz 4 osoby w okolicy". To by szumiało.
    const now = Date.now();
    const overdue = list.filter(
      ({ customer }) =>
        !customer.isDone &&
        customer.nextAppointment &&
        new Date(customer.nextAppointment).getTime() < now,
    );
    if (overdue.length === 0) return null;
    return { item: overdue[0], total: overdue.length };
  }, [customers, coords, radiusKm]);

  if (dismissed) return null;
  if (!candidate) return null;

  const { item, total } = candidate;
  const distance = formatDistance(item.distanceKm, lang);
  const more = total > 1 ? ` · ${t.nearbyAndMore(total - 1)}` : "";

  return (
    <div
      className="absolute inset-x-2 top-2 z-[450] rounded-xl border border-status-issue/40 bg-status-issue/10 p-3 shadow-floating backdrop-blur-md sm:inset-x-auto sm:right-2 sm:max-w-md"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-status-issue" />
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 text-left"
        >
          <div className="text-sm font-medium leading-snug">
            {t.nearbyBannerTitle(distance)}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {item.customer.name}
            {more}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t.cancel}
          className="-mr-1 -mt-1 grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-background/50 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
