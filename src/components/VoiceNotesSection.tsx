import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useCustomers } from "@/store/customers";
import {
  blobToBase64,
  estimateDataUrlBytes,
  formatApproxSize,
  formatDuration,
  getSupportedAudioMimeType,
  isStorageQuotaError,
} from "@/lib/mediaUtils";
import type { MediaAttachment } from "@/types/customer";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  customerId: string;
  voiceNotes: MediaAttachment[];
}

const MAX_DURATION_SEC = 60;

export function VoiceNotesSection({ customerId, voiceNotes }: Props) {
  const t = useT();
  const addVoiceNote = useCustomers((s) => s.addVoiceNote);
  const removeVoiceNote = useCustomers((s) => s.removeVoiceNote);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const mimeRef = useRef<string>("");

  const supportedMime = getSupportedAudioMimeType();
  const hasMediaDevices =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function";
  const canRecord = hasMediaDevices && !!supportedMime;

  useEffect(() => {
    return () => {
      // cleanup on unmount: stop any active recording
      if (tickRef.current != null) window.clearInterval(tickRef.current);
      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) t.stop();
      }
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const stopTick = () => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    if (!canRecord) {
      toast.error(t.voiceNotSupported);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = supportedMime!;
      mimeRef.current = mime;
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000),
        );
        try {
          const dataUrl = await blobToBase64(blob);
          addVoiceNote(customerId, {
            dataUrl,
            mimeType: mime,
            durationSec,
            approxBytes: estimateDataUrlBytes(dataUrl),
          });
          toast.success(t.saved);
        } catch (err) {
          if (isStorageQuotaError(err)) {
            toast.error(t.storageFull);
          } else {
            toast.error(t.voiceFailed);
          }
        } finally {
          stopStream();
          setRecording(false);
          setElapsed(0);
          stopTick();
        }
      };

      startedAtRef.current = Date.now();
      rec.start();
      setRecording(true);
      setElapsed(0);

      tickRef.current = window.setInterval(() => {
        const e = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(e);
        if (e >= MAX_DURATION_SEC) {
          stopRecordingInternal("max");
        }
      }, 250);
    } catch (err) {
      stopStream();
      setRecording(false);
      stopTick();
      // getUserMedia throws NotAllowedError when user denies
      if (err instanceof Error && /not.?allowed|denied|permission/i.test(err.name + " " + err.message)) {
        toast.error(t.voiceMicDenied);
      } else {
        toast.error(t.voiceNotSupported);
      }
    }
  };

  const stopRecordingInternal = (reason: "user" | "max") => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    try {
      rec.stop();
    } catch {
      // ignore
    }
    if (reason === "max") {
      toast.info(t.voiceMaxReached);
    }
  };

  const stopRecording = () => stopRecordingInternal("user");

  const handleRemove = (id: string) => {
    if (!window.confirm(t.voiceRemoveConfirm)) return;
    removeVoiceNote(customerId, id);
    toast.success(t.voiceRemoved);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t.voiceNotes}
          {voiceNotes.length > 0 && (
            <span className="ml-2 text-xs font-normal normal-case tracking-normal">
              ({voiceNotes.length})
            </span>
          )}
        </h3>
      </div>

      {voiceNotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.voiceNotesEmpty}</p>
      ) : (
        <ul className="space-y-2">
          {voiceNotes.map((v) => (
            <li
              key={v.id}
              className="rounded-lg border p-2.5 space-y-2"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {format(new Date(v.createdAt), "dd.MM.yyyy HH:mm")}
                  {v.durationSec != null && (
                    <> · {formatDuration(v.durationSec)}</>
                  )}
                  {v.approxBytes != null && (
                    <> · {formatApproxSize(v.approxBytes)}</>
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(v.id)}
                  aria-label={t.delete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <audio
                src={v.dataUrl}
                controls
                preload="metadata"
                className="w-full"
              />
            </li>
          ))}
        </ul>
      )}

      {!canRecord ? (
        <p className="text-xs text-muted-foreground">{t.voiceNotSupported}</p>
      ) : recording ? (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <span
            className={cn(
              "inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-destructive",
              "animate-pulse",
            )}
            aria-hidden
          />
          <span className="flex-1 text-sm tabular-nums">
            {t.voiceRecording} {formatDuration(elapsed)} /{" "}
            {formatDuration(MAX_DURATION_SEC)}
          </span>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={stopRecording}
          >
            <Square className="mr-1.5 h-4 w-4" />
            {t.voiceStop}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={startRecording}
        >
          <Mic className="mr-1.5 h-4 w-4" />
          {t.voiceRecord}
        </Button>
      )}
    </section>
  );
}
