import { differenceInCalendarDays, format } from "date-fns";
import {
  Briefcase,
  CheckCircle2,
  Edit2,
  Globe,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useCustomers } from "@/store/customers";
import type { Customer } from "@/types/customer";
import { CategoryBadge, DoneBadge } from "@/components/CategoryBadge";
import { PhotosSection } from "@/components/PhotosSection";
import { VoiceNotesSection } from "@/components/VoiceNotesSection";
import { TimelineSection } from "@/components/TimelineSection";
import { toast } from "sonner";

interface Props {
  customer: Customer;
  onEdit: () => void;
  onClose: () => void;
}

export function CustomerDetail({ customer, onEdit, onClose }: Props) {
  const t = useT();
  const setDone = useCustomers((s) => s.setDone);
  const deleteCustomer = useCustomers((s) => s.deleteCustomer);

  const days = customer.nextAppointment
    ? differenceInCalendarDays(new Date(customer.nextAppointment), new Date())
    : null;

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${customer.lat},${customer.lng}`;

  const handleDone = () => {
    setDone(customer.id, true);
    toast.success(t.saved);
  };

  const handleReopen = () => {
    setDone(customer.id, false);
    toast.success(t.saved);
  };

  const handleDelete = () => {
    if (!window.confirm(t.deleteConfirm)) return;
    deleteCustomer(customer.id);
    toast.success(t.deleted);
    onClose();
  };

  return (
    <div className="space-y-5 px-1 pb-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold leading-tight">
          {customer.name}
        </h2>
        {(customer.company || customer.profession) && (
          <div className="text-sm text-muted-foreground">
            {customer.company && (
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" />
                {customer.company}
              </span>
            )}
            {customer.company && customer.profession && (
              <span className="mx-1.5">·</span>
            )}
            {customer.profession && <span>{customer.profession}</span>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryBadge categoryId={customer.categoryId} />
          {customer.isDone && <DoneBadge />}
        </div>
      </div>

      <div className="rounded-xl bg-accent/40 p-4 text-center">
        {days != null ? (
          <>
            <div
              className={`text-4xl font-bold tabular-nums ${days < 0 ? "text-status-issue" : days <= 7 ? "text-status-progress" : "text-foreground"}`}
            >
              {days >= 0 ? days : `−${Math.abs(days)}`}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {t.daysUntil(days)}
              {customer.nextAppointment && (
                <> · {format(new Date(customer.nextAppointment), "dd.MM.yyyy HH:mm")}</>
              )}
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            {t.noAppointment}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <MapPin className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm">{customer.address}</p>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline"
            >
              {t.openInMaps}
            </a>
          </div>
        </div>

        {customer.phone && (
          <a
            href={`tel:${customer.phone}`}
            className="flex items-center gap-3 rounded-lg p-2 -mx-2 hover:bg-accent/40 transition-colors"
          >
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{customer.phone}</span>
          </a>
        )}

        {customer.phone2 && (
          <a
            href={`tel:${customer.phone2}`}
            className="flex items-center gap-3 rounded-lg p-2 -mx-2 hover:bg-accent/40 transition-colors"
          >
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{customer.phone2}</span>
          </a>
        )}

        {customer.email && (
          <a
            href={`mailto:${customer.email}`}
            className="flex items-center gap-3 rounded-lg p-2 -mx-2 hover:bg-accent/40 transition-colors"
          >
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{customer.email}</span>
          </a>
        )}

        {customer.website && (
          <a
            href={customer.website}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-lg p-2 -mx-2 hover:bg-accent/40 transition-colors"
          >
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-primary break-all">
              {customer.website}
            </span>
          </a>
        )}
      </div>

      {customer.notes && (
        <div className="rounded-lg border p-3 text-sm whitespace-pre-wrap">
          {customer.notes}
        </div>
      )}

      {customer.tags && customer.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customer.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Pakiet A: Zdjęcia */}
      <PhotosSection
        customerId={customer.id}
        photos={customer.photos ?? []}
        thumbnailPhotoId={customer.thumbnailPhotoId}
      />

      {/* Pakiet A: Notatki głosowe */}
      <VoiceNotesSection
        customerId={customer.id}
        voiceNotes={customer.voiceNotes ?? []}
      />

      {/* Pakiet A: Oś czasu (zastępuje starą sekcję "Historia") */}
      <TimelineSection
        customerId={customer.id}
        timeline={customer.timeline ?? []}
        photos={customer.photos ?? []}
        customerCreatedAt={customer.createdAt}
      />

      {customer.lastVisit && (
        <div className="text-xs text-muted-foreground">
          {t.lastVisit}: {format(new Date(customer.lastVisit), "dd.MM.yyyy")}
        </div>
      )}

      <div className="sticky bottom-0 -mx-1 space-y-2 border-t bg-background/95 px-1 pt-3 pb-1 backdrop-blur">
        {!customer.isDone ? (
          <Button
            variant="default"
            onClick={handleDone}
            className="w-full"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {t.markDone}
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={handleReopen}
            className="w-full"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {t.markActive}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onEdit}>
            <Edit2 className="mr-1.5 h-4 w-4" />
            {t.edit}
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            {t.delete}
          </Button>
        </div>
      </div>
    </div>
  );
}
