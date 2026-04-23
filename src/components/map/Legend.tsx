import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { TONE_HEX } from "@/components/map/pinIcon";
import type { PinTone } from "@/lib/pinColor";

const ROWS: Array<{ tone: PinTone; key: keyof ReturnType<typeof useT> }> = [
  { tone: "overdue", key: "legendOverdue" },
  { tone: "soon", key: "legendSoon" },
  { tone: "upcoming", key: "legendUpcoming" },
  { tone: "later", key: "legendLater" },
  { tone: "future", key: "legendFuture" },
  { tone: "issue", key: "legendIssue" },
  { tone: "warranty", key: "legendWarranty" },
  { tone: "done", key: "legendDone" },
];

export function Legend({ onClose }: { onClose: () => void }) {
  const t = useT();
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
        {ROWS.map((r) => (
          <li key={r.tone} className="flex items-center gap-2 text-xs">
            <span
              className="h-3.5 w-3.5 rounded-full border-2 border-white shadow-pin"
              style={{ background: TONE_HEX[r.tone] }}
            />
            <span>{t[r.key] as string}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
