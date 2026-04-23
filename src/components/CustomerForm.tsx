import { useState, useEffect } from "react";
import { Loader2, MapPin, Search, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n";
import { useCustomers } from "@/store/customers";
import type { Customer, CustomerStatus } from "@/types/customer";
import { geocodeAddress, reverseGeocode } from "@/lib/geocode";
import { toast } from "sonner";

interface Props {
  initial?: Partial<Customer> | null;
  editingId?: string | null;
  onClose: () => void;
}

const STATUSES: CustomerStatus[] = [
  "new",
  "in_progress",
  "done",
  "warranty",
  "issue",
];

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CustomerForm({ initial, editingId, onClose }: Props) {
  const t = useT();
  const addCustomer = useCustomers((s) => s.addCustomer);
  const updateCustomer = useCustomers((s) => s.updateCustomer);
  const deleteCustomer = useCustomers((s) => s.deleteCustomer);

  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [lat, setLat] = useState<number | undefined>(initial?.lat);
  const [lng, setLng] = useState<number | undefined>(initial?.lng);
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [status, setStatus] = useState<CustomerStatus>(
    (initial?.status as CustomerStatus) ?? "new",
  );
  const [nextAppt, setNextAppt] = useState(
    toLocalInput(initial?.nextAppointment),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [geocoding, setGeocoding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setName(initial?.name ?? "");
    setAddress(initial?.address ?? "");
    setLat(initial?.lat);
    setLng(initial?.lng);
    setPhone(initial?.phone ?? "");
    setEmail(initial?.email ?? "");
    setStatus((initial?.status as CustomerStatus) ?? "new");
    setNextAppt(toLocalInput(initial?.nextAppointment));
    setNotes(initial?.notes ?? "");
    setTags((initial?.tags ?? []).join(", "));
    setFormError(null);
  }, [initial, editingId]);

  const hasCoords = lat != null && lng != null;

  const handleGeocode = async () => {
    if (!address.trim()) {
      setFormError("Wpisz adres, zanim klikniesz „Znajdź”.");
      return;
    }
    setGeocoding(true);
    setFormError(null);
    try {
      const r = await geocodeAddress(address);
      if (!r) {
        setFormError(
          "Nie znaleziono tego adresu. Spróbuj wpisać go dokładniej (ulica, numer, miasto) lub zaznacz miejsce długim naciśnięciem na mapie.",
        );
      } else {
        setLat(r.lat);
        setLng(r.lng);
        toast.success("Adres znaleziony");
      }
    } catch (err) {
      setFormError(
        "Nie udało się połączyć z serwisem geokodowania. Sprawdź internet lub zaznacz miejsce na mapie.",
      );
    } finally {
      setGeocoding(false);
    }
  };

  const handleReverse = async () => {
    if (lat == null || lng == null) return;
    setGeocoding(true);
    setFormError(null);
    try {
      const r = await reverseGeocode(lat, lng);
      if (r) setAddress(r);
    } catch {
      setFormError("Nie udało się pobrać adresu z punktu na mapie.");
    } finally {
      setGeocoding(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Imię i nazwisko jest wymagane.");
      return;
    }
    if (!address.trim() && !hasCoords) {
      setFormError(
        "Podaj adres albo zaznacz miejsce na mapie (długie naciśnięcie).",
      );
      return;
    }

    let coordsLat = lat;
    let coordsLng = lng;

    // Try auto-geocode only if user didn't already set coords
    if (coordsLat == null || coordsLng == null) {
      setSubmitting(true);
      try {
        const r = await geocodeAddress(address);
        if (r) {
          coordsLat = r.lat;
          coordsLng = r.lng;
          setLat(r.lat);
          setLng(r.lng);
        } else {
          setFormError(
            "Nie znaleziono adresu. Kliknij „Znajdź” obok adresu albo długo naciśnij miejsce na mapie, a potem zapisz.",
          );
          setSubmitting(false);
          return;
        }
      } catch {
        setFormError(
          "Problem z geokodowaniem. Długo naciśnij miejsce na mapie, aby zaznaczyć lokalizację ręcznie.",
        );
        setSubmitting(false);
        return;
      } finally {
        setSubmitting(false);
      }
    }

    const data = {
      name: name.trim(),
      address: address.trim() || `${coordsLat!.toFixed(5)}, ${coordsLng!.toFixed(5)}`,
      lat: coordsLat!,
      lng: coordsLng!,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      status,
      nextAppointment: nextAppt
        ? new Date(nextAppt).toISOString()
        : undefined,
      notes: notes.trim() || undefined,
      tags: tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    if (editingId) {
      updateCustomer(editingId, data);
    } else {
      addCustomer(data);
    }
    toast.success(t.saved);
    onClose();
  };

  const handleDelete = () => {
    if (!editingId) return;
    if (!window.confirm(t.deleteConfirm)) return;
    deleteCustomer(editingId);
    toast.success(t.deleted);
    onClose();
  };

  const busy = geocoding || submitting;

  return (
    <form onSubmit={submit} className="space-y-4 px-1 pb-6">
      {formError && (
        <div
          role="alert"
          className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="leading-snug">{formError}</div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="cf-name">{t.name} *</Label>
        <Input
          id="cf-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="off"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cf-address">{t.address} *</Label>
        <div className="flex gap-2">
          <Input
            id="cf-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="np. Marszałkowska 10, Warszawa"
            autoComplete="off"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleGeocode}
            disabled={busy || !address.trim()}
            className="shrink-0"
          >
            {geocoding ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-1.5 h-4 w-4" />
            )}
            Znajdź
          </Button>
        </div>
        {hasCoords && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 text-primary" />
            <span>
              {lat!.toFixed(5)}, {lng!.toFixed(5)}
            </span>
            {!address && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto px-1"
                onClick={handleReverse}
              >
                {t.reverseGeocode}
              </Button>
            )}
          </div>
        )}
        {!hasCoords && (
          <p className="text-xs text-muted-foreground">
            Wpisz adres i kliknij „Znajdź”, albo długo naciśnij miejsce na mapie.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cf-phone">{t.phone}</Label>
          <Input
            id="cf-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-email">{t.email}</Label>
          <Input
            id="cf-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t.status} *</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as CustomerStatus)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t.selectStatus} />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t.statuses[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-appt">{t.nextAppointment}</Label>
          <Input
            id="cf-appt"
            type="datetime-local"
            value={nextAppt}
            onChange={(e) => setNextAppt(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cf-notes">{t.notes}</Label>
        <Textarea
          id="cf-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cf-tags">{t.tags}</Label>
        <Input
          id="cf-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="np. piec, gaz"
        />
      </div>

      <div className="sticky bottom-0 -mx-1 flex flex-col gap-2 border-t bg-background/95 px-1 pt-3 pb-1 backdrop-blur sm:flex-row sm:justify-end">
        {editingId && (
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            className="sm:mr-auto"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t.delete}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t.save}
        </Button>
      </div>
    </form>
  );
}
