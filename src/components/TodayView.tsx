import { useMemo } from "react";
import {
  CheckCircle2,
  CalendarCheck,
  ExternalLink,
  Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomers } from "@/store/customers";
import { useT } from "@/lib/i18n";
import {
  differenceInCalendarDays,
  format,
  isToday,
  startOfToday,
} from "date-fns";
import type { Customer } from "@/types/customer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  onSelectCustomer: (c: Customer) => void;
}

interface Group {
  key: "overdue" | "today" | "week";
  label: string;
  tone: string;
  items: Customer[];
}

export function TodayView({ onSelectCustomer }: Props) {
  const t = useT();
  const customers = useCustomers((s) => s.customers);
  const setStatus = useCustomers((s) => s.setStatus);

  const groups = useMemo<Group[]>(() => {
    const today = startOfToday();
    const overdue: Customer[] = [];
    const todayItems: Customer[] = [];
    const week: Customer[] = [];

    for (const c of customers) {
      if (!c.nextAppointment || c.status === "done") continue;
      const apptDate = new Date(c.nextAppointment);
      const days = differenceInCalendarDays(apptDate, today);
      if (days < 0) overdue.push(c);
      else if (isToday(apptDate)) todayItems.push(c);
      else if (days <= 7) week.push(c);
    }

    const sortByAppt = (a: Customer, b: Customer) =>
      new Date(a.nextAppointment!).getTime() -
      new Date(b.nextAppointment!).getTime();

    overdue.sort(sortByAppt);
    todayItems.sort(sortByAppt);
    week.sort(sortByAppt);

    return [
      { key: "overdue", label: t.overdue, tone: "text-status-issue border-status-issue/30 bg-status-issue/5", items: overdue },
      { key: "today", label: t.todayGroup, tone: "text-status-progress border-status-progress/30 bg-status-progress/5", items: todayItems },
      { key: "week", label: t.thisWeek, tone: "text-foreground border-status-soon/40 bg-status-soon/5", items: week },
    ];
  }, [customers, t]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  if (total === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-status-ok/15">
          <CalendarCheck className="h-10 w-10 text-status-ok" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{t.emptyTodayTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.emptyTodayHint}
          </p>
        </div>
      </div>
    );
  }

  const handleDone = (id: string) => {
    setStatus(id, "done");
    toast.success(t.saved);
  };

  return (
    <div className="space-y-4 p-4">
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <section key={g.key} className="space-y-2">
              <div
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide",
                  g.tone,
                )}
              >
                {g.label} · {g.items.length}
              </div>
              <ul className="space-y-2">
                {g.items.map((c) => {
                  const days = differenceInCalendarDays(
                    new Date(c.nextAppointment!),
                    new Date(),
                  );
                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
                  return (
                    <li
                      key={c.id}
                      className="rounded-xl border bg-card p-3 shadow-card"
                    >
                      <button
                        onClick={() => onSelectCustomer(c)}
                        className="block w-full text-left"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {format(new Date(c.nextAppointment!), "HH:mm")}
                          </div>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {c.address}
                        </div>
                        <div
                          className={`mt-1 text-xs font-medium ${days < 0 ? "text-status-issue" : days === 0 ? "text-status-progress" : "text-muted-foreground"}`}
                        >
                          {t.daysUntil(days)}
                        </div>
                      </button>

                      <div className="mt-3 flex gap-2">
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="flex-1"
                        >
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Navigation className="mr-1.5 h-4 w-4" />
                            {t.navigate}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => handleDone(c.id)}
                        >
                          <CheckCircle2 className="mr-1.5 h-4 w-4" />
                          {t.markDone}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ),
      )}
    </div>
  );
}
