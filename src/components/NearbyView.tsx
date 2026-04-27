import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Compass,
  ExternalLink,
  Loader2,
  MapPinOff,
  Navigation,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomers } from "@/store/customers";
import { useI18n, useT } from "@/lib/i18n";
import { useGeolocation, type GeoErrorCode } from "@/hooks/useGeolocation";
import {
  countOverdueNearby,
  findNearby,
  formatDistance,
} from "@/lib/distance";
import { differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types/customer";
import { CategoryBadge } from "@/components/CategoryBadge";

interface Props {
  onSelectCustomer: (c: Customer) => void;
}

export function NearbyView({ onSelectCustomer }: Props) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const customers = useCustomers((s) => s.customers);
  const radiusKm = useCustomers((s) => s.nearbyRadiusKm);
  const { coords, loading, error, request } = useGeolocation();

  // Domyślnie odpalamy GPS po wejściu w zakładkę. Browser pamięta zgodę,
  // więc dla użytkowników którzy już raz pozwolili — żadnego promptu.
  // Dla nowych użytkowników browser wyświetli swój natywny prompt.
  // Świadomie to nie blokuje renderu — komponent pokaże "loading" zamiast pustki.
  const [requested, setRequested] = useState(false);
  useEffect(() => {
    if (!requested) {
      setRequested(true);
      // Ignorujemy reject — error idzie do `error` state-u i tak.
      request().catch(() => {});
    }
  }, [requested, request]);

  const nearby = useMemo(() => {
    if (!coords) return [];
    return findNearby(customers, coords.lat, coords.lng, radiusKm);
  }, [customers, coords, radiusKm]);

  const overdueCount = useMemo(
    () => countOverdueNearby(nearby),
    [nearby],
  );

  // --- Stany pre-listy: brak coords → albo loading, albo error, albo prompt. ---
  if (!coords) {
    if (loading) {
      return (
        <CenteredState
          icon={<Loader2 className="h-10 w-10 animate-spin text-primary" />}
          title={t.nearbyLocating}
          hint={t.nearbyLocatingHint}
        />
      );
    }
    if (error) {
      return (
        <NearbyErrorState
          code={error}
          onRetry={() => {
            request().catch(() => {});
          }}
        />
      );
    }
    // Bardzo krótki przebłysk między mountem a useEffect — pokażmy spinner.
    return (
      <CenteredState
        icon={<Loader2 className="h-10 w-10 animate-spin text-primary" />}
        title={t.nearbyLocating}
        hint={t.nearbyLocatingHint}
      />
    );
  }

  // --- Mamy lokalizację. ---
  return (
    <div className="space-y-4 p-4">
      <header className="space-y-2 rounded-xl border bg-card p-3 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Compass className="h-4 w-4 text-primary" />
              {t.nearby}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t.nearbyHeader(radiusKm)}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              request().catch(() => {});
            }}
            disabled={loading}
            className="shrink-0"
            aria-label={t.nearbyRefresh}
          >
            <RefreshCw
              className={cn("h-4 w-4", loading && "animate-spin")}
            />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {t.nearbyFound(nearby.length)}
            {overdueCount > 0 && (
              <>
                {" · "}
                <span className="font-medium text-status-issue">
                  {t.nearbyOverdueCount(overdueCount)}
                </span>
              </>
            )}
          </span>
        </div>
      </header>

      {nearby.length === 0 ? (
        <CenteredState
          icon={<MapPinOff className="h-10 w-10 text-muted-foreground" />}
          title={t.nearbyEmptyTitle}
          hint={t.nearbyEmptyHint(radiusKm)}
        />
      ) : (
        <ul className="space-y-2">
          {nearby.map(({ customer, distanceKm }) => {
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${customer.lat},${customer.lng}`;
            const days = customer.nextAppointment
              ? differenceInCalendarDays(
                  new Date(customer.nextAppointment),
                  new Date(),
                )
              : null;
            const isOverdue =
              !customer.isDone && days !== null && days < 0;
            return (
              <li
                key={customer.id}
                className={cn(
                  "rounded-xl border bg-card p-3 shadow-card transition-colors",
                  isOverdue && "border-status-issue/40 bg-status-issue/5",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectCustomer(customer)}
                  className="block w-full text-left"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0 flex-1 truncate font-medium">
                      {customer.name}
                    </div>
                    <div className="shrink-0 text-xs font-medium tabular-nums text-primary">
                      {formatDistance(distanceKm, lang)}
                    </div>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    {customer.address}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <CategoryBadge categoryId={customer.categoryId} />
                    {isOverdue && days !== null && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-status-issue/30 bg-status-issue/10 px-1.5 py-0.5 text-[11px] font-medium text-status-issue">
                        <AlertTriangle className="h-3 w-3" />
                        {t.daysUntil(days)}
                      </span>
                    )}
                    {!isOverdue && days !== null && days >= 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        {t.daysUntil(days)}
                      </span>
                    )}
                  </div>
                </button>

                <div className="mt-3 flex gap-2">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="flex-1"
                  >
                    <a href={mapsUrl} target="_blank" rel="noreferrer">
                      <Navigation className="mr-1.5 h-4 w-4" />
                      {t.navigate}
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CenteredState({
  icon,
  title,
  hint,
}: {
  icon: JSX.Element;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-muted">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {hint && (
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        )}
      </div>
    </div>
  );
}

function NearbyErrorState({
  code,
  onRetry,
}: {
  code: GeoErrorCode;
  onRetry: () => void;
}) {
  const t = useT();
  const message =
    code === "denied"
      ? t.gpsDenied
      : code === "timeout"
        ? t.gpsTimeout
        : code === "unsupported"
          ? t.gpsNotSupported
          : t.gpsFailed;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-status-issue/15">
        <MapPinOff className="h-10 w-10 text-status-issue" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">{t.nearbyNoLocation}</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          {message}
        </p>
      </div>
      {code !== "denied" && code !== "unsupported" && (
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="mr-1.5 h-4 w-4" />
          {t.nearbyRetry}
        </Button>
      )}
    </div>
  );
}
