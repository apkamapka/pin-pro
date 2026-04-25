import { useState, useEffect, useRef } from "react";
import {
  AlertCircle,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Globe,
  Loader2,
  MapPin,
  Phone,
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
import { useT } from "@/lib/i18n";
import { useCustomers } from "@/store/customers";
import type { Customer } from "@/types/customer";
import { isValidIconKey, type PinIconKey, ICON_PALETTE } from "@/lib/iconPalette";
import { geocodeAddress, reverseGeocode } from "@/lib/geocode";
import { collectAllTags } from "@/lib/searchCustomers";
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

export function CustomerForm({ initial, editingId, onClose }: Props) {
  const t = useT();
  const addCustomer = useCustomers((s) => s.addCustomer);
  const updateCustomer = useCustomers((s) => s.updateCustomer);
  const deleteCustomer = useCustomers((s) => s.deleteCustomer);
  const categories = useCustomers((s) => s.categories);
  const allCustomers = useCustomers((s) => s.customers);
  const tagSuggestions = collectAllTags(allCustomers);

  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [profession, setProfession] = useState(initial?.profession ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [lat, setLat] = useState<number | undefined>(initial?.lat);
  const [lng, setLng] = useState<number | undefined>(initial?.lng);
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [phone2, setPhone2] = useState(initial?.phone2 ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
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
  // "Więcej pól" rozwijalne: w edycji otwórz od razu jeśli któreś wypełnione
  const [moreOpen, setMoreOpen] = useState(
    Boolean(
      initial?.company ||
        initial?.profession ||
        initial?.phone2 ||
        initial?.website,
    ),
  );

  useEffect(() => {
    setName(initial?.name ?? "");
    setCompany(initial?.company ?? "");
    setProfession(initial?.profession ?? "");
    setAddress(initial?.address ?? "");
    setLat(initial?.lat);
    setLng(initial?.lng);
    setPhone(initial?.phone ?? "");
    setPhone2(initial?.phone2 ?? "");
    setEmail(initial?.email ?? "");
    setWebsite(initial?.website ?? "");
    setCategoryId(initial?.categoryId ?? NO_CATEGORY);
    setIcon(
      isValidIconKey(initial?.icon) ? (initial!.icon as PinIconKey) : "auto",
    );
    setNextAppt(toLocalInput(initial?.nextAppointment));
    setNotes(initial?.notes ?? "");
    setTags(initial?.tags ?? []);
    setFormError(null);
    setMoreOpen(
      Boolean(
        initial?.company ||
          initial?.profession ||
          initial?.phone2 ||
          initial?.website,
      ),
    );
  }, [initial, editingId]);

  /**
   * Quick-add z GPS: jeśli formularz dostał lat/lng (z mapy lub GPS),
   * a adres jest pusty, w tle pobierz adres przez reverse geocode.
   * Robione raz, po pierwszym mount/update z tymi danymi.
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
        // Cisza – user może uzupełnić ręcznie. Toast byłby tu nachalny.
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

  // Auto-focus pola nazwy w trybie "quick-add" (mamy współrzędne, brak nazwy).
  // Bez tego serwisant w aucie musiałby kliknąć w input zanim zacznie pisać.
  useEffect(() => {
    if (!editingId && initial?.lat != null && initial?.lng != null && !initial?.name) {
      // krótki delay – Sheet ma transition, fokus przed nim się gubi
      const id = window.setTimeout(() => nameRef.current?.focus(), 250);
      return () => window.clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

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
      setFormError(`${t.name}: ${t.requiredField}`);
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
      company: company.trim() || undefined,
      profession: profession.trim() || undefined,
      address: address.trim() || `${coordsLat!.toFixed(5)}, ${coordsLng!.toFixed(5)}`,
      lat: coordsLat!,
      lng: coordsLng!,
      phone: phone.trim() || undefined,
      phone2: phone2.trim() || undefined,
      email: email.trim() || undefined,
      website: website.trim() || undefined,
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
          <Label>{t.category}</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder={t.selectCategory} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>
                <span className="text-muted-foreground">
                  {t.categoryNone}
                </span>
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
        <Label>{t.icon}</Label>
        <IconPicker value={icon} onChange={setIcon} />
      </div>

      <div className="rounded-lg border">
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/60"
          aria-expanded={moreOpen}
        >
          <span>{moreOpen ? t.hideFields : t.moreFields}</span>
          {moreOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {moreOpen && (
          <div className="space-y-4 border-t p-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cf-company" className="flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                  {t.company}
                </Label>
                <Input
                  id="cf-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  autoComplete="organization"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cf-profession">{t.clientProfession}</Label>
                <Input
                  id="cf-profession"
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  placeholder={t.clientProfessionPlaceholder}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cf-phone2" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {t.phone2}
                </Label>
                <Input
                  id="cf-phone2"
                  type="tel"
                  value={phone2}
                  onChange={(e) => setPhone2(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cf-website" className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  {t.website}
                </Label>
                <Input
                  id="cf-website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                />
              </div>
            </div>
          </div>
        )}
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
        <TagsInput
          id="cf-tags"
          value={tags}
          onChange={setTags}
          suggestions={tagSuggestions}
          placeholder={t.tagsPlaceholder}
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
