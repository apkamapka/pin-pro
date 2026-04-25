/**
 * Pomocniki dla zdjęć i nagrań głosowych w pakiecie A.
 *
 * - `compressImage`   – przeskalowanie + JPEG; używamy bo surowy JPEG z telefonu
 *   to 3–5 MB, a localStorage ma ~5–10 MB na cały origin.
 * - `blobToBase64`    – uniwersalny reader dla Blob → data URL (audio).
 * - `getSupportedAudioMimeType` – pierwszy typ obsługiwany przez MediaRecorder
 *   w danej przeglądarce (webm/opus na Chrome/Firefox, mp4/aac na Safari).
 * - `formatDuration`  – "0:05", "1:23" – do wyświetlania długości audio.
 * - `formatApproxSize`– "~120 KB" do pokazania użytkownikowi rozmiaru plików.
 * - `estimateDataUrlBytes` – zgrubny rozmiar base64 payloadu.
 * - `isStorageQuotaError` – wykrywa przepełniony localStorage (różne przeglądarki,
 *   różne błędy, wszystkie obsłużone tutaj).
 */

export interface CompressedImage {
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  approxBytes: number;
}

export interface CompressImageOptions {
  /** Maksymalny wymiar (dłuższy bok) w pikselach. Domyślnie 1600. */
  maxDim?: number;
  /** Jakość JPEG 0..1. Domyślnie 0.8 – rozsądny kompromis. */
  quality?: number;
  /** Docelowy mimeType. Domyślnie 'image/jpeg'. */
  mimeType?: "image/jpeg" | "image/webp";
}

export async function compressImage(
  file: File | Blob,
  opts: CompressImageOptions = {},
): Promise<CompressedImage> {
  const maxDim = opts.maxDim ?? 1600;
  const quality = opts.quality ?? 0.8;
  const mimeType = opts.mimeType ?? "image/jpeg";

  const fileDataUrl = await blobToBase64(file);

  const img = await loadImage(fileDataUrl);
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable");
  }
  ctx.drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL(mimeType, quality);

  return {
    dataUrl,
    mimeType,
    width,
    height,
    approxBytes: estimateDataUrlBytes(dataUrl),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("FileReader did not return string"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}

/** Zwraca pierwszy obsługiwany audio mimeType, albo null jeśli żaden nie działa. */
export function getSupportedAudioMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/mpeg",
  ];
  for (const type of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch {
      // ignore – niektóre Safari rzucają wyjątek
    }
  }
  return null;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function formatApproxSize(bytes: number | undefined): string {
  if (bytes == null || !isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `~${Math.round(bytes / 1024)} KB`;
  return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Szacuje rozmiar payloadu base64 data URL (w bajtach). Szybki trick:
 * base64 dodaje ok. 33% do rzeczywistych bajtów, a padding "=" dodaje
 * parę bajtów więcej; liczymy długość payloadu po przecinku.
 */
export function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) return dataUrl.length;
  const payload = dataUrl.length - commaIdx - 1;
  const padding = dataUrl.endsWith("==") ? 2 : dataUrl.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload * 3) / 4) - padding);
}

/**
 * localStorage rzuca różne błędy w różnych przeglądarkach kiedy jest pełny.
 * Łapiemy je wszystkie.
 */
export function isStorageQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = error.name;
  const message = error.message || "";
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    // niektóre Safari
    (name === "DOMException" && /quota/i.test(message)) ||
    /quota/i.test(message)
  );
}

/**
 * Zwraca zdjęcie do wyświetlenia jako miniaturka na mapie.
 * Priorytet: ręcznie ustawione `thumbnailPhotoId` → najnowsze zdjęcie → brak.
 *
 * Logika jest w jednym miejscu (tutaj), żeby popup na mapie, karta klienta
 * i przyszłe miejsca (np. lista) pokazywały to samo.
 */
export function getThumbnailPhoto(
  photos: { id: string; dataUrl: string; createdAt: string }[] | undefined,
  thumbnailPhotoId: string | undefined,
): { id: string; dataUrl: string; createdAt: string } | undefined {
  if (!photos || photos.length === 0) return undefined;
  if (thumbnailPhotoId) {
    const explicit = photos.find((p) => p.id === thumbnailPhotoId);
    if (explicit) return explicit;
  }
  // Default: najnowsze (ostatnio dodane). `photos` rośnie chronologicznie,
  // więc po prostu ostatni element.
  return photos[photos.length - 1];
}
