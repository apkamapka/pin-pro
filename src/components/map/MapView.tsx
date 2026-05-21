import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {
  Plus,
  Info,
  CalendarClock,
  MapPin,
  Phone,
  Eye,
  EyeOff,
  Hash,
  Crosshair,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomers } from "@/store/customers";
import { useT } from "@/lib/i18n";
import type { Category, Customer } from "@/types/customer";
import { buildDivIcon } from "@/components/map/pinIcon";
import { cn } from "@/lib/utils";
import { Legend } from "@/components/map/Legend";
import { useIsMobile } from "@/hooks/use-mobile";
import { CategoryBadge, DoneBadge } from "@/components/CategoryBadge";
import { differenceInCalendarDays, format } from "date-fns";
import { ICON_PALETTE } from "@/lib/iconPalette";
import { getThumbnailPhoto } from "@/lib/mediaUtils";
import { getFirstFieldByType } from "@/lib/customFields";
import { collectAllTags } from "@/lib/searchCustomers";
import { toast } from "sonner";

interface MapViewProps {
  onSelectCustomer: (c: Customer) => void;
  onAddAt: (lat: number, lng: number) => void;
  onAddNew: () => void;
  selectedId?: string | null;
}

/**
 * Filtr kategorii – multi-select przez `Set<id>`.
 * Specjalne wartości:
 *   - "__all"  → pokazuj wszystko (gdy `set` jest pusty, traktujemy jako "wszystko")
 *   - "__none" → klienci bez kategorii (toggle przez chip "Bez kategorii")
 * Tags: osobny `Set<tagName>`, AND.
 */
const NO_CATEGORY_KEY = "__none__";

function MapEvents({
  onLongPress,
}: {
  onLongPress: (lat: number, lng: number) => void;
}) {
  const timer = useRef<number | null>(null);

  // Kasuje aktywny timer long-pressa.
  // Wywoływane przy każdym zdarzeniu które robi long-press niewykonalny:
  // - mouseup, mousemove (user puścił / przesunął palec normalnie)
  // - blur okna albo visibilitychange (apka straciła fokus, np. user
  //   przeszedł do Google Maps z poziomu nawigacji). Bez tego timer
  //   tykał dalej w tle i odpalał `onLongPress` po powrocie do apki,
  //   otwierając zombie-formularz "Dodaj pinezkę".
  const cancelTimer = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) cancelTimer();
    };
    window.addEventListener("blur", cancelTimer);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", cancelTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      cancelTimer();
    };
  }, [cancelTimer]);

  useMapEvents({
    mousedown(e) {
      cancelTimer();
      timer.current = window.setTimeout(() => {
        timer.current = null;
        onLongPress(e.latlng.lat, e.latlng.lng);
      }, 600);
    },
    mouseup() {
      cancelTimer();
    },
    mousemove() {
      cancelTimer();
    },
    contextmenu(e) {
      cancelTimer();
      e.originalEvent.preventDefault();
      onLongPress(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [lat, lng, map]);
  return null;
}

/**
 * Dopasowuje widok mapy do wszystkich pinezek przy (re)montażu.
 *
 * Po co: propsy `center`/`zoom` na <MapContainer> działają TYLKO przy
 * pierwszym renderze. Klienci wczytują się z localStorage chwilę po starcie,
 * a mapa już się utworzyła z domyślnym, światowym widokiem (środek oceanu).
 * Dodatkowo MapView remontuje się przy każdym powrocie na zakładkę „Mapa”,
 * więc bez tego widok zawsze wracał do oceanu. Tu czekamy aż pojawią się
 * współrzędne i jednorazowo dopasowujemy widok do pinezek.
 *
 * `enabled=false` gdy zaznaczony jest konkretny klient – wtedy widokiem
 * steruje <FlyTo>, więc się nie wtrącamy.
 */
function FitToCustomers({
  points,
  enabled,
}: {
  points: [number, number][];
  enabled: boolean;
}) {
  const map = useMap();
  const didFit = useRef(false);
  useEffect(() => {
    if (!enabled || didFit.current || points.length === 0) return;
    didFit.current = true;
    if (points.length === 1) {
      map.setView(points[0], 13, { animate: false });
    } else {
      map.fitBounds(L.latLngBounds(points), {
        padding: [56, 56],
        maxZoom: 15,
        animate: false,
      });
    }
  }, [points, enabled, map]);
  return null;
}

export function MapView({
  onSelectCustomer,
  onAddAt,
  onAddNew,
  selectedId,
}: MapViewProps) {
  const t = useT();
  const customers = useCustomers((s) => s.customers);
  const categories = useCustomers((s) => s.categories);
  const thresholds = useCustomers((s) => s.thresholds);
  /** Aktywne ID kategorii. Pusty zbiór = pokazuj wszystkie (brak filtra).
   *  Sentinel `NO_CATEGORY_KEY` reprezentuje "bez kategorii". */
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(),
  );
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [showDone, setShowDone] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const isMobile = useIsMobile();

  const today = useMemo(() => new Date(), []);

  // Map id -> Category (callback stabilny przez kategorie)
  const categoryById = useCallback(
    (id: string): Category | undefined => categories.find((c) => c.id === id),
    [categories],
  );

  const allTags = useMemo(() => collectAllTags(customers), [customers]);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (!showDone && c.isDone) return false;

      // Kategorie – jeśli jakieś wybrane, klient musi pasować do choć jednej.
      if (activeCategories.size > 0) {
        const matchesNone =
          activeCategories.has(NO_CATEGORY_KEY) && !c.categoryId;
        const matchesCat =
          !!c.categoryId && activeCategories.has(c.categoryId);
        if (!matchesNone && !matchesCat) return false;
      }

      // Tagi – AND (klient musi mieć wszystkie zaznaczone).
      if (activeTags.size > 0) {
        const cTags = new Set(
          (c.tags ?? []).map((t) => t.toLocaleLowerCase()),
        );
        for (const required of activeTags) {
          if (!cTags.has(required.toLocaleLowerCase())) return false;
        }
      }

      return true;
    });
  }, [customers, activeCategories, activeTags, showDone]);

  const toggleCategory = (id: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const clearAllFilters = () => {
    setActiveCategories(new Set());
    setActiveTags(new Set());
  };

  const hasAnyFilter = activeCategories.size > 0 || activeTags.size > 0;

  /**
   * Szybki dodawania klienta z GPS:
   * - bierzemy aktualną lokalizację (high accuracy, 10s timeout),
   * - delegujemy do `onAddAt(lat, lng)` – tam parent sprzęga to z formularzem
   *   i my dostajemy uzupełniony adres (reverse geocode robi formularz).
   *
   * Jeśli GPS odmawia / wygasa, pokazujemy toast i nie blokujemy UI.
   */
  const handleQuickAdd = () => {
    if (!("geolocation" in navigator)) {
      toast.error(t.gpsNotSupported);
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        onAddAt(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error(t.gpsDenied);
        } else if (err.code === err.TIMEOUT) {
          toast.error(t.gpsTimeout);
        } else {
          toast.error(t.gpsFailed);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      },
    );
  };

  const defaultCenter: [number, number] = useMemo(() => {
    if (customers.length === 0) return [52.0, 19.0];
    const avgLat = customers.reduce((s, c) => s + c.lat, 0) / customers.length;
    const avgLng = customers.reduce((s, c) => s + c.lng, 0) / customers.length;
    return [avgLat, avgLng];
  }, [customers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const defaultZoom = customers.length === 0 ? 5 : 6;
  const selected = customers.find((c) => c.id === selectedId);

  // Punkty do auto-dopasowania widoku (wszyscy aktualnie widoczni klienci
  // z poprawnymi współrzędnymi). Używane przez <FitToCustomers>.
  const fitPoints = useMemo<[number, number][]>(
    () =>
      filtered
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
        .map((c) => [c.lat, c.lng] as [number, number]),
    [filtered],
  );

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        minZoom={2}
        maxZoom={19}
        worldCopyJump={true}
        className="h-full w-full"
        zoomControl={!isMobile}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          noWrap={false}
        />
        <MapEvents onLongPress={onAddAt} />
        {selected && <FlyTo lat={selected.lat} lng={selected.lng} />}
        <FitToCustomers points={fitPoints} enabled={!selectedId} />

        {filtered.map((c) => {
          const days = c.nextAppointment
            ? differenceInCalendarDays(new Date(c.nextAppointment), new Date())
            : null;
          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
          return (
            <Marker
              key={c.id}
              position={[c.lat, c.lng]}
              icon={
                buildDivIcon(c, today, thresholds, categoryById) as L.DivIcon
              }
            >
              <Popup
                closeButton={false}
                offset={[0, -8]}
                className="serwis-popup"
              >
                <div className="min-w-[220px] space-y-2 p-1">
                  {(() => {
                    const thumb = getThumbnailPhoto(
                      c.photos,
                      c.thumbnailPhotoId,
                    );
                    return thumb ? (
                      <div className="-mx-1 -mt-1 mb-1 overflow-hidden rounded-md">
                        <img
                          src={thumb.dataUrl}
                          alt=""
                          className="h-28 w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : null;
                  })()}
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold leading-tight text-foreground">
                      {c.name}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <CategoryBadge categoryId={c.categoryId} />
                      {c.isDone && <DoneBadge />}
                    </div>
                  </div>

                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="leading-snug">{c.address}</span>
                  </div>

                  {c.nextAppointment && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <CalendarClock
                        className={`h-3.5 w-3.5 ${days != null && days < 0 ? "text-status-issue" : days != null && days <= 7 ? "text-status-progress" : "text-muted-foreground"}`}
                      />
                      <span className="text-foreground">
                        {format(new Date(c.nextAppointment), "dd.MM.yyyy HH:mm")}
                      </span>
                      {days != null && (
                        <span
                          className={`ml-auto font-medium ${days < 0 ? "text-status-issue" : days <= 7 ? "text-status-progress" : "text-muted-foreground"}`}
                        >
                          {t.daysUntil(days)}
                        </span>
                      )}
                    </div>
                  )}

                  {(() => {
                    const tel = getFirstFieldByType(c, "phone");
                    if (!tel) return null;
                    return (
                      <a
                        href={`tel:${tel.value}`}
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {tel.value}
                      </a>
                    );
                  })()}

                  {c.notes && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {c.notes}
                    </p>
                  )}

                  <div className="flex gap-1.5 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 flex-1 text-xs"
                      asChild
                    >
                      <a href={mapsUrl} target="_blank" rel="noreferrer">
                        {t.navigate}
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 flex-1 text-xs"
                      onClick={() => onSelectCustomer(c)}
                    >
                      {t.edit}
                    </Button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Filter chips – multi-select kategorie + tagi (drugi rząd). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[400] flex flex-col items-center gap-1.5 px-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 2rem) + 0.5rem)" }}>
        {/* Rząd 1: kategorie */}
        <div
          className="chip-row pointer-events-auto flex max-w-full gap-2 overflow-x-auto rounded-full bg-background/95 p-1.5 shadow-floating backdrop-blur"
          role="tablist"
        >
          {/* "Wszystkie" – wyczyść kategorie+tagi */}
          <button
            onClick={clearAllFilters}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              !hasAnyFilter
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-accent",
            )}
            aria-pressed={!hasAnyFilter}
          >
            {t.all}
          </button>

          {/* Dynamiczne kategorie – multi-select */}
          {categories.map((cat) => {
            const Icon = ICON_PALETTE.find((p) => p.key === cat.icon)?.Icon;
            const active = activeCategories.has(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => toggleCategory(cat.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  active ? "text-white" : "text-foreground hover:bg-accent",
                )}
                style={active ? { backgroundColor: cat.color } : undefined}
                aria-pressed={active}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span>{cat.name}</span>
              </button>
            );
          })}

          {/* "Bez kategorii" – pokazujemy tylko jeśli są jakiekolwiek kategorie */}
          {categories.length > 0 && (
            <button
              onClick={() => toggleCategory(NO_CATEGORY_KEY)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                activeCategories.has(NO_CATEGORY_KEY)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
              aria-pressed={activeCategories.has(NO_CATEGORY_KEY)}
            >
              {t.categoryNone}
            </button>
          )}
        </div>

        {/* Rząd 2: tagi (tylko jeśli są jakiekolwiek) */}
        {allTags.length > 0 && (
          <div
            className="chip-row pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full bg-background/90 p-1.5 shadow-floating backdrop-blur"
            role="tablist"
          >
            {activeTags.size > 0 && (
              <button
                type="button"
                onClick={() => setActiveTags(new Set())}
                className="shrink-0 rounded-full border border-dashed border-muted-foreground/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent"
                aria-label={t.clearFilter}
              >
                <X className="-ml-0.5 mr-0.5 inline h-3 w-3" />
                {t.clearFilter}
              </button>
            )}
            {allTags.map((tag) => {
              const active = activeTags.has(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-accent",
                  )}
                  aria-pressed={active}
                >
                  <Hash className="h-3 w-3 opacity-70" />
                  {tag}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Toggle Show/Hide Done */}
      <div className="absolute bottom-24 right-4 z-[400] sm:bottom-6">
        {/* Placeholder – prawy dolny róg zajmuje FAB; toggle Done w lewym */}
      </div>
      <div className="absolute bottom-40 left-3 z-[400] sm:bottom-20">
        <Button
          size="sm"
          variant="secondary"
          className="shadow-floating"
          onClick={() => setShowDone((v) => !v)}
          aria-pressed={showDone}
        >
          {showDone ? (
            <>
              <EyeOff className="mr-1.5 h-4 w-4" />
              {t.hideDone}
            </>
          ) : (
            <>
              <Eye className="mr-1.5 h-4 w-4" />
              {t.showDone}
            </>
          )}
        </Button>
      </div>

      {/* Legend toggle */}
      <div className="absolute bottom-24 left-3 z-[400] sm:bottom-4">
        <Button
          size="icon"
          variant="secondary"
          className="rounded-full shadow-floating h-11 w-11"
          onClick={() => setLegendOpen((v) => !v)}
          aria-label={t.legend}
        >
          <Info className="h-5 w-5" />
        </Button>
        {legendOpen && (
          <div className="absolute bottom-14 left-0 w-64">
            <Legend onClose={() => setLegendOpen(false)} />
          </div>
        )}
      </div>

      {/* FAB stack: główny "+" oraz "Tu jestem" (GPS quick-add). */}
      <div className="absolute bottom-24 right-4 z-[400] flex flex-col items-end gap-2 sm:bottom-6">
        <Button
          onClick={handleQuickAdd}
          variant="secondary"
          className="h-12 w-12 rounded-full shadow-floating"
          size="icon"
          aria-label={t.quickAddHere}
          title={t.quickAddHere}
          disabled={gpsLoading}
        >
          {gpsLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Crosshair className="h-5 w-5" />
          )}
        </Button>
        <Button
          onClick={onAddNew}
          className="h-14 w-14 rounded-full shadow-floating"
          size="icon"
          aria-label={t.addPin}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
