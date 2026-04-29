import { useState, useEffect, useRef } from "react";
import {
  AlertCircle,
  Globe,
  Hash,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
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
import { IconPicker } from "@/components/IconPicker";
import { TagsInput } from "@/components/TagsInput";
import { CustomFieldRow } from "@/components/CustomFieldRow";
import { useT } from "@/lib/i18n";
import { useCustomers } from "@/store/customers";
import type { Customer, CustomField, CustomFieldType } from "@/types/customer";
import { isValidIconKey, type PinIconKey, ICON_PALETTE } from "@/lib/iconPalette";
import { geocodeAddress, reverseGeocode } from "@/lib/geocode";
import { collectAllTags } from "@/lib/searchCustomers";
import {
  getAllCustomFields,
  makeCustomField,
  pruneEmptyFields,
} from "@/lib/customFields";
import { toast } from "sonner";

interface Props {
  initial?: Partial<Customer> | null;
  editingId?: string | null;
  onClose: () => void;
}

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const NO_CATEGORY = "__none__"; // sentinel bo shadcn Select nie akceptuje pustych wartości

/** Definicja chipa „+ Telefon" / „+ NIP" / „+ Inne pole".
 *  Etykieta jest tłumaczona przez useT() w renderze, tutaj przechowujemy
 *  tylko klucz do zlokalizowanego stringa + ikonę + typ pola. */
type ChipDef = {
  type: CustomFieldType;
  /** Klucz w `t` używany jako default label nowego pola. */
  defaultLabelKey:
    | "fieldPhone"
    | "fieldEmail"
    | "fieldWebsite"
    | "fieldTaxId"
    | "fieldOther";
  Icon: typeof Phone;
};

const CHIPS: ChipDef[] = [
  { type: "phone", defaultLabelKey: "fieldPhone", Icon: Phone },
  { type: "email", defaultLabelKey: "fieldEmail", Icon: Mail },
  { type: "url", defaultLabelKey: "fieldWebsite", Icon: Globe },
  { type: "tax_id", defaultLabelKey: "fieldTaxId", Icon: Hash },
  { type: "text", defaultLabelKey: "fieldOther", Icon: Plus },
];

export function CustomerForm({ initial, editingId, onClose }: Props) {
  const t = useT();
  const addCustomer = useCustomers((s) => s.addCustomer);
  const updateCustomer = useCustomers((s) => s.updateCustomer);
  const deleteCustomer = useCustomers((s) => s.deleteCustomer);
  const categories = useCustomers((s) => s.categories);
  const allCustomers = useCustomers((s) => s.customers);
  const defaultCountry = useCustomers((s) => s.defaultCountry);
  const tagSuggestions = collectAllTags(allCustomers);

  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [lat, setLat] = useState<number | undefined>(initial?.lat);
  const [lng, setLng] = useState<number | undefined>(initial?.lng);
  const [customFields, setCustomFields] = useState<CustomField[]>(
    initial ? getAllCustomFields(initial as Customer) : [],
  );
  const [categoryId, setCategoryId] = useState<string>(
    initial?.categoryId ?? NO_CATEGORY,
  );
  const [icon, setIcon] = useState<PinIconKey>(
    isValidIconKey(initial?.icon) ? (initial!.icon as PinIconKey) : "auto",
  );
  const [nextAppt, setNextAppt] = useState(
    toLocalInput(initial?.nextAppointment),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [geocoding, setGeocoding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /** ID pola które właśnie zostało dodane chipem — żeby auto-focusować input. */
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  useEffect(() => {
    setName(initial?.name ?? "");
    setAddress(initial?.address ?? "");
    setLat(initial?.lat);
    setLng(initial?.lng);
    setCustomFields(initial ? getAllCustomFields(initial as Customer) : []);
    setCategoryId(initial?.categoryId ?? NO_CATEGORY);
    setIcon(
      isValidIconKey(initial?.icon) ? (initial!.icon as PinIconKey) : "auto",
    );
    setNextAppt(toLocalInput(initial?.nextAppointment));
    setNotes(initial?.notes ?? "");
    setTags(initial?.tags ?? []);
    setFormError(null);
    setJustAddedId(null);
  }, [initial, editingId]);

  /**
   * Quick-add z GPS: jeśli formularz dostał lat/lng (z mapy lub GPS),
   * a adres jest pusty, w tle pobierz adres przez reverse geocode.
   */
  useEffect(() => {
    let cancelled = false;
    const shouldAutoReverse =
      !editingId &&
      initial?.lat != null &&
      initial?.lng != null &&
      !initial?.address;
    if (!shouldAutoReverse) return;

    setGeocoding(true);
    reverseGeocode(initial.lat as number, initial.lng as number)
      .then((r) => {
        if (cancelled) return;
        if (r) setAddress(r);
      })
      .catch(() => {
        // Cisza – user może uzupełnić ręcznie.
      })
      .finally(() => {
        if (!cancelled) setGeocoding(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.lat, initial?.lng, editingId]);

  const hasCoords = lat != null && lng != null;

  // Auto-focus pola nazwy w trybie "quick-add"
  useEffect(() => {
    if (!editingId && initial?.lat != null && initial?.lng != null && !initial?.name) {
      const id = window.setTimeout(() => nameRef.current?.focus(), 250);
      return () => window.clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  /** Mapuje klucz chipa na zlokalizowany default label. */
  const chipLabel = (key: ChipDef["defaultLabelKey"]): string => {
    const dict: Record<ChipDef["defaultLabelKey"], string> = {
      fieldPhone: t.fieldPhone,
      fieldEmail: t.fieldEmail,
      fieldWebsite: t.fieldWebsite,
      fieldTaxId: t.fieldTaxId,
      fieldOther: "", // pole „Inne" – user wpisuje sam
    };
    return dict[key];
  };

  const addField = (chip: ChipDef) => {
    const f = makeCustomField(chip.type, chipLabel(chip.defaultLabelKey));
    setCustomFields((prev) => [...prev, f]);
    setJustAddedId(f.id);
  };

  const updateField = (
    id: string,
    patch: Partial<Pick<CustomField, "label" | "value">>,
  ) => {
    setCustomFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
  };

  const removeField = (id: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  };

  const handleGeocode = async () => {
    if (!address.trim()) {
      setFormError(t.errorEnterAddressBeforeFind);
      return;
    }
    setGeocoding(true);
    setFormError(null);
    try {
      const r = await geocodeAddress(address, { defaultCountry });
      if (!r) {
        setFormError(t.errorAddressNotFound);
      } else {
        setLat(r.lat);
        setLng(r.lng);
        toast.success(t.addressFound);
      }
    } catch (err) {
      setFormError(t.errorGeocodeOffline);
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
      setFormError(t.errorReverseGeocode);
    } finally {
      setGeocoding(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError(`${t.name}: ${t.requiredField}`);
      return;
    }
    if (!address.trim() && !hasCoords) {
      setFormError(t.errorAddressOrPin);
      return;
    }

    let coordsLat = lat;
    let coordsLng = lng;

    if (coordsLat == null || coordsLng == null) {
      setSubmitting(true);
      try {
        const r = await geocodeAddress(address, { defaultCountry });
        if (r) {
          coordsLat = r.lat;
          coordsLng = r.lng;
          setLat(r.lat);
          setLng(r.lng);
        } else {
          setFormError(t.errorAddressNotFoundOnSave);
          setSubmitting(false);
          return;
        }
      } catch {
        setFormError(t.errorGeocodeProblemOnSave);
        setSubmitting(false);
        return;
      } finally {
        setSubmitting(false);
      }
    }

    const cleanFields = pruneEmptyFields(customFields);

    const data = {
      name: name.trim(),
      // Legacy pola czyścimy świadomie — nowy formularz nie używa ich
      // przy zapisie. Migracja v6 już je przeniosła do customFields.
      // Przy edycji starego klienta: getAllCustomFields() zassało wartości,
      // więc po zapisie wszystko jest spójnie w customFields.
      company: undefined,
      profession: undefined,
      phone: undefined,
      phone2: undefined,
      email: undefined,
      website: undefined,
      address: address.trim() || `${coordsLat!.toFixed(5)}, ${coordsLng!.toFixed(5)}`,
      lat: coordsLat!,
      lng: coordsLng!,
      customFields: cleanFields.length > 0 ? cleanFields : undefined,
      categoryId: categoryId === NO_CATEGORY ? undefined : categoryId,
      isDone: initial?.isDone ?? false,
      icon: icon === "auto" ? undefined : icon,
      nextAppointment: nextAppt
        ? new Date(nextAppt).toISOString()
        : undefined,
      notes: notes.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
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

      {/* === SZTYWNE POLA === */}
      <div className="space-y-1.5">
        <Label htmlFor="cf-name">{t.name} *</Label>
        <Input
          id="cf-name"
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.namePlaceholder}
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
            placeholder={t.addressPlaceholder}
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
            {t.find}
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
            {t.addressHint}
          </p>
        )}
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

      {/* === POLA CUSTOM (telefon, email, NIP, ...) === */}
      {customFields.length > 0 && (
        <div className="space-y-2">
          {customFields.map((f) => (
            <CustomFieldRow
              key={f.id}
              field={f}
              autoFocus={f.id === justAddedId}
              onChange={(patch) => updateField(f.id, patch)}
              onRemove={() => removeField(f.id)}
            />
          ))}
        </div>
      )}

      {/* === CHIPY DODAWANIA === */}
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {t.addField}
        </Label>
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((chip) => {
            const I = chip.Icon;
            return (
              <Button
                key={chip.defaultLabelKey}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addField(chip)}
                className="h-8 rounded-full text-xs"
              >
                <I className="mr-1.5 h-3.5 w-3.5" />
                {chip.defaultLabelKey === "fieldOther"
                  ? t.fieldOther
                  : chipLabel(chip.defaultLabelKey)}
              </Button>
            );
          })}
        </div>
      </div>

      {/* === IKONA === */}
      <div className="space-y-1.5">
        <Label>{t.icon}</Label>
        <IconPicker value={icon} onChange={setIcon} />
      </div>

      {/* === NOTATKI === */}
      <div className="space-y-1.5">
        <Label htmlFor="cf-notes">{t.notes}</Label>
        <Textarea
          id="cf-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* === KATEGORIA === */}
      <div className="space-y-1.5">
        <Label>{t.category}</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder={t.selectCategory} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CATEGORY}>
              <span className="text-muted-foreground">{t.categoryNone}</span>
            </SelectItem>
            {categories.map((c) => {
              const Icon = ICON_PALETTE.find((p) => p.key === c.icon)?.Icon;
              return (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="grid h-4 w-4 place-items-center rounded-full text-white shrink-0"
                      style={{ backgroundColor: c.color }}
                      aria-hidden
                    >
                      {Icon && <Icon className="h-2.5 w-2.5" strokeWidth={3} />}
                    </span>
                    <span className="truncate">{c.name}</span>
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* === TAGI === */}
      <div className="space-y-1.5">
        <Label htmlFor="cf-tags">{t.tags}</Label>
        <TagsInput
          id="cf-tags"
          value={tags}
          onChange={setTags}
          suggestions={tagSuggestions}
          placeholder={t.tagsPlaceholder}
        />
      </div>

      {/* === STOPKA === */}
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
