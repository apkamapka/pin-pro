import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { Plus, Info, CalendarClock, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomers } from "@/store/customers";
import { useT } from "@/lib/i18n";
import type { Customer, CustomerStatus } from "@/types/customer";
import { buildDivIcon } from "@/components/map/pinIcon";
import { cn } from "@/lib/utils";
import { Legend } from "@/components/map/Legend";
import { useIsMobile } from "@/hooks/use-mobile";
import { StatusBadge } from "@/components/StatusBadge";
import { differenceInCalendarDays, format } from "date-fns";

interface MapViewProps {
  onSelectCustomer: (c: Customer) => void;
  onAddAt: (lat: number, lng: number) => void;
  onAddNew: () => void;
  selectedId?: string | null;
}

const STATUS_FILTERS: Array<{ key: "all" | CustomerStatus; labelKey: string }> = [
  { key: "all", labelKey: "all" },
  { key: "new", labelKey: "new" },
  { key: "in_progress", labelKey: "in_progress" },
  { key: "done", labelKey: "done" },
  { key: "warranty", labelKey: "warranty" },
  { key: "issue", labelKey: "issue" },
];

function MapEvents({
  onLongPress,
}: {
  onLongPress: (lat: number, lng: number) => void;
}) {
  const timer = useRef<number | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  useMapEvents({
    mousedown(e) {
      startPos.current = { x: e.originalEvent.clientX, y: e.originalEvent.clientY };
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
  const thresholds = useCustomers((s) => s.thresholds);
  const [filter, setFilter] = useState<"all" | CustomerStatus>("all");
  const [legendOpen, setLegendOpen] = useState(false);
  const isMobile = useIsMobile();

  const today = useMemo(() => new Date(), []);

  const filtered = useMemo(
    () => (filter === "all" ? customers : customers.filter((c) => c.status === filter)),
    [customers, filter],
  );

  const selected = customers.find((c) => c.id === selectedId);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[52.0, 19.0]}
        zoom={6}
        className="h-full w-full"
        zoomControl={!isMobile}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
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
              icon={buildDivIcon(c, today, thresholds) as L.DivIcon}
            >
              <Popup
                closeButton={false}
                offset={[0, -8]}
                className="serwis-popup"
              >
                <div className="min-w-[220px] space-y-2 p-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold leading-tight text-foreground">
                      {c.name}
                    </div>
                    <StatusBadge status={c.status} />
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
                      type="button"
                      className="h-8 flex-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCustomer(c);
                      }}
                    >
                      {t.details}
                    </Button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Filter chips */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[400] flex justify-center px-3 pt-3">
        <div
          className="chip-row pointer-events-auto flex max-w-full gap-2 overflow-x-auto rounded-full bg-background/95 p-1.5 shadow-floating backdrop-blur"
          role="tablist"
        >
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent",
              )}
            >
              {f.key === "all" ? t.all : t.statuses[f.key]}
            </button>
          ))}
        </div>
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
