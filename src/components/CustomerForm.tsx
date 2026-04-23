import { useState, useEffect } from "react";
import { Loader2, MapPin, Trash2 } from "lucide-react";
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
  }, [initial, editingId]);

  const handleGeocode = async () => {
    if (!address.trim()) return;
    setGeocoding(true);
    try {
      const r = await geocodeAddress(address);
      if (!r) {
        toast.error(t.geocodeFail);
      } else {
        setLat(r.lat);
        setLng(r.lng);
        toast.success("OK");
      }
    } finally {
      setGeocoding(false);
    }
  };

  const handleReverse = async () => {
    if (lat == null || lng == null) return;
    setGeocoding(true);
    try {
      const r = await reverseGeocode(lat, lng);
      if (r) setAddress(r);
    } finally {
      setGeocoding(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      toast.error(t.requiredField);
      return;
    }
    let coordsLat = lat;
    let coordsLng = lng;
    if (coordsLat == null || coordsLng == null) {
      setGeocoding(true);
      try {
        const r = await geocodeAddress(address);
        if (r) {
          coordsLat = r.lat;
          coordsLng = r.lng;
        } else {
          toast.error(t.geocodeFail);
          setGeocoding(false);
          return;
        }
      } finally {
        setGeocoding(false);
      }
    }

    const data = {
      name: name.trim(),
      address: address.trim(),
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

  return (
    <form onSubmit={submit} className="space-y-4 px-1 pb-6">
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
            required
            autoComplete="off"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleGeocode}
            disabled={geocoding || !address.trim()}
            className="shrink-0"
          >
            {geocoding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
          </Button>
        </div>
        {lat != null && lng != null && (
          <p className="text-xs text-muted-foreground">
            {lat.toFixed(5)}, {lng.toFixed(5)}
            {!address && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="px-1 h-auto"
                onClick={handleReverse}
              >
                {t.reverseGeocode}
              </Button>
            )}
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
        <Button type="submit" disabled={geocoding}>
          {geocoding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t.save}
        </Button>
      </div>
    </form>
  );
}
