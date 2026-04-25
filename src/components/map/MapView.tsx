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

interface MapViewProps {
  onSelectCustomer: (c: Customer) => void;
  onAddAt: (lat: number, lng: number) => void;
  onAddNew: () => void;
  selectedId?: string | null;
}

/**
 * Filtr: "all" (wszystkie) | "none" (bez kategorii) | id kategorii.
 * Plus osobny toggle `showDone`.
 */
type Filter = "all" | "none" | string;

function MapEvents({
  onLongPress,
}: {
  onLongPress: (lat: number, lng: number) => void;
}) {
  const timer = useRef<number | null>(null);

  useMapEvents({
    mousedown(e) {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        onLongPress(e.latlng.lat, e.latlng.lng);
      }, 600);
    },
    mouseup() {
      if (timer.current) window.clearTimeout(timer.current);
    },
    mousemove() {
      if (timer.current) window.clearTimeout(timer.current);
    },
    contextmenu(e) {
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
  const [filter, setFilter] = useState<Filter>("all");
  const [showDone, setShowDone] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const isMobile = useIsMobile();

  const today = useMemo(() => new Date(), []);

  // Map id -> Category (callback stabilny przez kategorie)
  const categoryById = useCallback(
    (id: string): Category | undefined => categories.find((c) => c.id === id),
    [categories],
  );

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (!showDone && c.isDone) return false;
      if (filter === "all") return true;
      if (filter === "none") return !c.categoryId;
      return c.categoryId === filter;
    });
  }, [customers, filter, showDone]);

  const defaultCenter: [number, number] = useMemo(() => {
    if (customers.length === 0) return [52.0, 19.0];
    const avgLat = customers.reduce((s, c) => s + c.lat, 0) / customers.length;
    const avgLng = customers.reduce((s, c) => s + c.lng, 0) / customers.length;
    return [avgLat, avgLng];
  }, [customers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const defaultZoom = customers.length === 0 ? 3 : 6;
  const selected = customers.find((c) => c.id === selectedId);

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

                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {c.phone}
                    </a>
                  )}

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

      {/* Filter chips – user-defined kategorie */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[400] flex justify-center px-3 pt-3">
        <div
          className="chip-row pointer-events-auto flex max-w-full gap-2 overflow-x-auto rounded-full bg-background/95 p-1.5 shadow-floating backdrop-blur"
          role="tablist"
        >
          {/* "Wszystkie" */}
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              filter === "all"
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-accent",
            )}
          >
            {t.all}
          </button>

          {/* Dynamiczne kategorie */}
          {categories.map((cat) => {
            const Icon = ICON_PALETTE.find((p) => p.key === cat.icon)?.Icon;
            const active = filter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  active ? "text-white" : "text-foreground hover:bg-accent",
                )}
                style={active ? { backgroundColor: cat.color } : undefined}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span>{cat.name}</span>
              </button>
            );
          })}

          {/* "Bez kategorii" – pokazujemy tylko jeśli są jakiekolwiek kategorie */}
          {categories.length > 0 && (
            <button
              onClick={() => setFilter("none")}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                filter === "none"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {t.categoryNone}
            </button>
          )}
        </div>
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

      {/* FAB */}
      <Button
        onClick={onAddNew}
        className="absolute bottom-24 right-4 z-[400] h-14 w-14 rounded-full shadow-floating sm:bottom-6"
        size="icon"
        aria-label={t.addCustomer}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}
