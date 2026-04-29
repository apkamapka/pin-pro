import { useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  Circle,
  FileText,
  Image as ImageIcon,
  Images,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Wrench,
  X,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { useCustomers } from "@/store/customers";
import type {
  MediaAttachment,
  TimelineEntry,
  TimelineKind,
} from "@/types/customer";
import { TIMELINE_KINDS } from "@/types/customer";
import {
  compressImage,
  formatApproxSize,
  isStorageQuotaError,
} from "@/lib/mediaUtils";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  customerId: string;
  timeline: TimelineEntry[];
  /** Galeria całego klienta – potrzebna do: a) pokazania miniatur we wpisach,
   *  b) wyboru z istniejących zdjęć przy dodawaniu wpisu. */
  photos: MediaAttachment[];
  /** createdAt klienta — pokazywane jako implicit "Utworzono" na samym dole */
  customerCreatedAt: string;
}

const ICONS: Record<TimelineKind, React.ComponentType<{ className?: string }>> = {
  visit: MapPin,
  note: FileText,
  call: Phone,
  issue: AlertTriangle,
  fix: Wrench,
  other: Circle,
};

// Semantyczne klasy Tailwind, działa w obu motywach.
const KIND_TONE: Record<TimelineKind, string> = {
  visit: "text-primary",
  note: "text-muted-foreground",
  call: "text-primary",
  issue: "text-destructive",
  fix: "text-status-progress",
  other: "text-muted-foreground",
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TimelineSection({
  customerId,
  timeline,
  photos,
  customerCreatedAt,
}: Props) {
  const t = useT();
  const addPhoto = useCustomers((s) => s.addPhoto);
  const addEntry = useCustomers((s) => s.addTimelineEntry);
  const updateEntry = useCustomers((s) => s.updateTimelineEntry);
  const removeEntry = useCustomers((s) => s.removeTimelineEntry);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState<TimelineKind>("visit");
  const [date, setDate] = useState(toLocalInput(new Date().toISOString()));
  const [text, setText] = useState("");
  /** IDs zdjęć, które zostały przypięte do *tego* budowanego wpisu.
   *  Wszystkie odnoszą się do już-istniejących wpisów w customer.photos[]. */
  const [attachedIds, setAttachedIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [viewing, setViewing] = useState<MediaAttachment | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const sorted = [...timeline].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const resetForm = () => {
    setKind("visit");
    setDate(toLocalInput(new Date().toISOString()));
    setText("");
    setAttachedIds([]);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (entry: TimelineEntry) => {
    setEditingId(entry.id);
    setKind(entry.kind);
    setDate(toLocalInput(entry.date));
    setText(entry.text ?? "");
    setAttachedIds(entry.photoIds ? [...entry.photoIds] : []);
    setShowForm(true);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setProcessing(true);
    try {
      const newIds: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const compressed = await compressImage(file, {
          maxDim: 1600,
          quality: 0.8,
        });
        try {
          const p = addPhoto(customerId, {
            dataUrl: compressed.dataUrl,
            mimeType: compressed.mimeType,
            approxBytes: compressed.approxBytes,
          });
          if (p) newIds.push(p.id);
        } catch (err) {
          if (isStorageQuotaError(err)) {
            toast.error(t.storageFull);
            break;
          }
          throw err;
        }
      }
      if (newIds.length > 0) {
        setAttachedIds((prev) => [...prev, ...newIds]);
      }
    } catch {
      toast.error(t.photoFailed);
    } finally {
      setProcessing(false);
    }
  };

  const handleDetachFromEntry = (photoId: string) => {
    setAttachedIds((prev) => prev.filter((id) => id !== photoId));
  };

  const handlePickerToggle = (photoId: string) => {
    setAttachedIds((prev) =>
      prev.includes(photoId)
        ? prev.filter((id) => id !== photoId)
        : [...prev, photoId],
    );
  };

  const handleSubmit = () => {
    if (!date) return;
    if (editingId) {
      updateEntry(customerId, editingId, {
        date: new Date(date).toISOString(),
        kind,
        text: text.trim() || undefined,
        photoIds: attachedIds.length > 0 ? [...attachedIds] : undefined,
      });
      toast.success(t.timelineUpdated);
    } else {
      addEntry(customerId, {
        date: new Date(date).toISOString(),
        kind,
        text: text.trim() || undefined,
        photoIds: attachedIds.length > 0 ? [...attachedIds] : undefined,
      });
      toast.success(t.saved);
    }
    resetForm();
  };

  const handleRemove = (id: string) => {
    if (!window.confirm(t.timelineRemoveConfirm)) return;
    removeEntry(customerId, id);
    toast.success(t.timelineRemoved);
  };

  const photosById = (id: string) => photos.find((p) => p.id === id);
  const attachedPhotos = attachedIds
    .map(photosById)
    .filter((p): p is MediaAttachment => !!p);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t.timeline}
          {sorted.length > 0 && (
            <span className="ml-2 text-xs font-normal normal-case tracking-normal">
              ({sorted.length})
            </span>
          )}
        </h3>
        {!showForm && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowForm(true)}
            className="h-8"
          >
            <Plus className="mr-1 h-4 w-4" />
            {t.timelineAdd}
          </Button>
        )}
      </div>

      {showForm && (
        <div className="space-y-3 rounded-lg border p-3">
          {editingId && (
            <div className="text-xs font-medium text-primary">
              {t.timelineEdit}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tl-kind">{t.timelineKind}</Label>
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as TimelineKind)}
              >
                <SelectTrigger id="tl-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMELINE_KINDS.map((k) => {
                    const Icon = ICONS[k];
                    return (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" />
                          {t.timelineKinds[k]}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tl-date">{t.timelineDate}</Label>
              <Input
                id="tl-date"
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tl-text">{t.timelineText}</Label>
            <Textarea
              id="tl-text"
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.timelineTextPlaceholder}
            />
          </div>

          {/* Przypięte zdjęcia + przyciski dodawania */}
          <div className="space-y-2">
            <Label>
              {t.photos}
              {attachedIds.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({t.photoAttachedCount(attachedIds.length)})
                </span>
              )}
            </Label>

            {attachedPhotos.length > 0 && (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {attachedPhotos.map((p) => (
                  <div
                    key={p.id}
                    className="group relative aspect-square overflow-hidden rounded-md border"
                  >
                    <img
                      src={p.dataUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <button
                      type="button"
                      onClick={() => handleDetachFromEntry(p.id)}
                      className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-background/90 text-foreground shadow-sm transition-opacity hover:bg-background"
                      aria-label={t.delete}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={processing}
                onClick={() => cameraRef.current?.click()}
              >
                {processing ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-1 h-4 w-4" />
                )}
                <span className="truncate">{t.photoTake}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={processing}
                onClick={() => galleryRef.current?.click()}
              >
                {processing ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="mr-1 h-4 w-4" />
                )}
                <span className="truncate">{t.photoChoose}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={processing}
                onClick={() => setPickerOpen(true)}
              >
                <Images className="mr-1 h-4 w-4" />
                <span className="truncate">{t.photoPickExisting}</span>
              </Button>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  if (cameraRef.current) cameraRef.current.value = "";
                }}
              />
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  if (galleryRef.current) galleryRef.current.value = "";
                }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetForm}
            >
              <X className="mr-1.5 h-4 w-4" />
              {t.cancel}
            </Button>
            <Button type="button" size="sm" onClick={handleSubmit}>
              {editingId ? t.timelineUpdate : t.timelineSave}
            </Button>
          </div>
        </div>
      )}

      {sorted.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground">{t.timelineEmpty}</p>
      ) : (
        <ol className="space-y-2">
          {sorted.map((e) => {
            const Icon = ICONS[e.kind];
            const entryPhotos = (e.photoIds ?? [])
              .map(photosById)
              .filter((p): p is MediaAttachment => !!p);
            return (
              <li
                key={e.id}
                className={cn(
                  "flex gap-3 rounded-lg border p-2.5",
                  editingId === e.id && "border-primary bg-primary/5",
                )}
              >
                <div
                  className={`mt-0.5 shrink-0 ${KIND_TONE[e.kind]}`}
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {t.timelineKinds[e.kind]}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {format(new Date(e.date), "dd.MM.yyyy HH:mm")}
                    </div>
                  </div>
                  {e.text && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                      {e.text}
                    </p>
                  )}
                  {entryPhotos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {entryPhotos.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setViewing(p)}
                          className="h-14 w-14 overflow-hidden rounded-md border focus:outline-none focus:ring-2 focus:ring-ring"
                          aria-label={format(
                            new Date(p.createdAt),
                            "dd.MM.yyyy HH:mm",
                          )}
                        >
                          <img
                            src={p.dataUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    onClick={() => handleEdit(e)}
                    aria-label={t.timelineEdit}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(e.id)}
                    aria-label={t.delete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
          {/* Implicit "created" entry at the end */}
          <li className="flex gap-3 px-2.5 text-xs text-muted-foreground">
            <Circle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span>
              {t.created}:{" "}
              {format(new Date(customerCreatedAt), "dd.MM.yyyy")}
            </span>
          </li>
        </ol>
      )}

      {/* Dialog: wybór zdjęć z istniejącej galerii klienta */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.photoPickExistingTitle}</DialogTitle>
            <DialogDescription className="sr-only">
              {t.photoPickExistingTitle}
            </DialogDescription>
          </DialogHeader>
          {photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t.photoPickExistingEmpty}
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => {
                  const selected = attachedIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePickerToggle(p.id)}
                      className={cn(
                        "group relative aspect-square overflow-hidden rounded-lg border-2 transition-colors",
                        selected
                          ? "border-primary"
                          : "border-transparent hover:border-muted-foreground/30",
                      )}
                      aria-pressed={selected}
                    >
                      <img
                        src={p.dataUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {selected && (
                        <div className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(false)}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setPickerOpen(false)}
              disabled={photos.length === 0}
            >
              {t.photoPickConfirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: podgląd pojedynczego zdjęcia (klik w miniaturkę wpisu) */}
      <Dialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
      >
        <DialogContent
          className={cn(
            "max-w-3xl border-0 bg-background/95 p-0 sm:rounded-lg",
            "[&>button]:hidden",
          )}
        >
          <DialogTitle className="sr-only">{t.photos}</DialogTitle>
          <DialogDescription className="sr-only">
            {viewing
              ? format(new Date(viewing.createdAt), "dd.MM.yyyy HH:mm")
              : ""}
          </DialogDescription>
          {viewing && (
            <div className="flex flex-col">
              <img
                src={viewing.dataUrl}
                alt=""
                className="max-h-[80dvh] w-full object-contain"
              />
              <div className="flex items-center justify-between gap-2 border-t p-3">
                <div className="text-xs text-muted-foreground">
                  {format(new Date(viewing.createdAt), "dd.MM.yyyy HH:mm")}
                  {viewing.approxBytes != null && (
                    <> · {formatApproxSize(viewing.approxBytes)}</>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setViewing(null)}
                >
                  <X className="mr-1.5 h-4 w-4" />
                  {t.photoFullscreenClose}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
