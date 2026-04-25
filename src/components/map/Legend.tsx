import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { TONE_HEX, getToneRange } from "@/lib/pinColor";
import type { PinTone } from "@/lib/pinColor";
import { useCustomers } from "@/store/customers";

const ROWS: PinTone[] = [
  "overdue",
  "soon",
  "upcoming",
  "later",
  "future",
  "noDate",
  "done",
];

export function Legend({ onClose }: { onClose: () => void }) {
  const t = useT();
  const thresholds = useCustomers((s) => s.thresholds);

  /** Etykieta dla wiersza — wyliczana z aktualnych progów dla tonów
   *  zakresowych, statyczna z i18n dla overdue / noDate / done. */
  const labelFor = (tone: PinTone): string => {
    if (tone === "overdue") return t.legendOverdue;
    if (tone === "noDate") return t.legendNoDate;
    if (tone === "done") return t.legendDone;
    const range = getToneRange(tone, thresholds);
    if (!range) return "";
    return range.to === null
      ? t.dayPlus(range.from)
      : t.dayRange(range.from, range.to);
  };

  return (
    <div className="rounded-xl border bg-background/95 p-3 shadow-floating backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">{t.legend}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
          aria-label="close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ul className="space-y-1.5">
        {ROWS.map((tone) => (
          <li key={tone} className="flex items-center gap-2 text-xs">
            <span
              className="h-3.5 w-3.5 rounded-full border-2 border-white shadow-pin"
              style={{ background: TONE_HEX[tone] }}
            />
            <span>{labelFor(tone)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
