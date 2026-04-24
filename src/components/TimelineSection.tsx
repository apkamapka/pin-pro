import { useState } from "react";
import {
  AlertTriangle,
  Circle,
  FileText,
  MapPin,
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
import { useT } from "@/lib/i18n";
import { useCustomers } from "@/store/customers";
import type { TimelineEntry, TimelineKind } from "@/types/customer";
import { TIMELINE_KINDS } from "@/types/customer";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  customerId: string;
  timeline: TimelineEntry[];
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

// Kolory dla typów wpisów — używamy semantycznych klas Tailwind, żeby działało
// w obu motywach (jasnym i ciemnym).
const KIND_TONE: Record<TimelineKind, string> = {
  visit: "text-primary",
  note: "text-muted-foreground",
  call: "text-primary",
  issue: "text-destructive",
  fix: "text-status-progress", // Używamy koloru z design systemu (soon)
  other: "text-muted-foreground",
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TimelineSection({ customerId, timeline, customerCreatedAt }: Props) {
  const t = useT();
  const addEntry = useCustomers((s) => s.addTimelineEntry);
  const removeEntry = useCustomers((s) => s.removeTimelineEntry);

  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<TimelineKind>("visit");
  const [date, setDate] = useState(toLocalInput(new Date().toISOString()));
  const [text, setText] = useState("");

  const sorted = [...timeline].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const resetForm = () => {
    setKind("visit");
    setDate(toLocalInput(new Date().toISOString()));
    setText("");
    setShowForm(false);
  };

  const handleSubmit = () => {
    if (!date) return;
    addEntry(customerId, {
      date: new Date(date).toISOString(),
      kind,
      text: text.trim() || undefined,
    });
    toast.success(t.saved);
    resetForm();
  };

  const handleRemove = (id: string) => {
    if (!window.confirm(t.timelineRemoveConfirm)) return;
    removeEntry(customerId, id);
    toast.success(t.timelineRemoved);
  };

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
              {t.timelineSave}
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
            return (
              <li
                key={e.id}
                className="flex gap-3 rounded-lg border p-2.5"
              >
                <div
                  className={`mt-0.5 shrink-0 ${KIND_TONE[e.kind]}`}
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {t.timelineKinds[e.kind]}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {format(new Date(e.date), "dd.MM.yyyy HH:mm")}
                    </div>
                  </div>
                  {e.text && (
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap break-words">
                      {e.text}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(e.id)}
                  aria-label={t.delete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
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
    </section>
  );
}
