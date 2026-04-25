import { useRef, useState } from "react";
import {
  Camera,
  Image as ImageIcon,
  Loader2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { useCustomers } from "@/store/customers";
import {
  compressImage,
  formatApproxSize,
  isStorageQuotaError,
} from "@/lib/mediaUtils";
import type { MediaAttachment } from "@/types/customer";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  customerId: string;
  photos: MediaAttachment[];
  thumbnailPhotoId: string | undefined;
}

export function PhotosSection({ customerId, photos, thumbnailPhotoId }: Props) {
  const t = useT();
  const addPhoto = useCustomers((s) => s.addPhoto);
  const removePhoto = useCustomers((s) => s.removePhoto);
  const setThumbnail = useCustomers((s) => s.setThumbnail);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [viewing, setViewing] = useState<MediaAttachment | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setProcessing(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const compressed = await compressImage(file, {
          maxDim: 1600,
          quality: 0.8,
        });
        try {
          addPhoto(customerId, {
            dataUrl: compressed.dataUrl,
            mimeType: compressed.mimeType,
            approxBytes: compressed.approxBytes,
          });
        } catch (err) {
          if (isStorageQuotaError(err)) {
            toast.error(t.storageFull);
            break;
          }
          throw err;
        }
      }
    } catch {
      toast.error(t.photoFailed);
    } finally {
      setProcessing(false);
    }
  };

  const handleRemove = (id: string) => {
    if (!window.confirm(t.photoRemoveConfirm)) return;
    removePhoto(customerId, id);
    toast.success(t.photoRemoved);
    if (viewing?.id === id) setViewing(null);
  };

  const handleToggleThumbnail = (id: string) => {
    if (thumbnailPhotoId === id) {
      setThumbnail(customerId, undefined);
      toast.success(t.photoThumbnailCleared);
    } else {
      setThumbnail(customerId, id);
      toast.success(t.photoThumbnailSet);
    }
  };

  const currentThumbnailId = thumbnailPhotoId;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t.photos}
          {photos.length > 0 && (
            <span className="ml-2 text-xs font-normal normal-case tracking-normal">
              ({photos.length})
            </span>
          )}
        </h3>
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.photosEmpty}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => {
            const isThumb = currentThumbnailId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setViewing(p)}
                className="group relative aspect-square overflow-hidden rounded-lg border bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={format(new Date(p.createdAt), "dd.MM.yyyy HH:mm")}
              >
                <img
                  src={p.dataUrl}
                  alt=""
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                {isThumb && (
                  <div
                    className="absolute left-1.5 top-1.5 rounded-full bg-primary/90 p-1 text-primary-foreground shadow-sm"
                    aria-label={t.photoIsThumbnail}
                  >
                    <Star className="h-3 w-3 fill-current" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={processing}
          onClick={() => cameraRef.current?.click()}
        >
          {processing ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Camera className="mr-1.5 h-4 w-4" />
          )}
          {t.photoTake}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={processing}
          onClick={() => galleryRef.current?.click()}
        >
          {processing ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="mr-1.5 h-4 w-4" />
          )}
          {t.photoChoose}
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

      <Dialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
      >
        <DialogContent
          className={cn(
            "max-w-3xl border-0 bg-background/95 p-0 sm:rounded-lg",
            "[&>button]:hidden", // hide default close; we draw our own
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
              <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3">
                <div className="text-xs text-muted-foreground">
                  {format(new Date(viewing.createdAt), "dd.MM.yyyy HH:mm")}
                  {viewing.approxBytes != null && (
                    <> · {formatApproxSize(viewing.approxBytes)}</>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={
                      currentThumbnailId === viewing.id ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => handleToggleThumbnail(viewing.id)}
                  >
                    <Star
                      className={cn(
                        "mr-1.5 h-4 w-4",
                        currentThumbnailId === viewing.id && "fill-current",
                      )}
                    />
                    {currentThumbnailId === viewing.id
                      ? t.photoUnsetThumbnail
                      : t.photoSetThumbnail}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemove(viewing.id)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    {t.delete}
                  </Button>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
