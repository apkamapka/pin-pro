import { useMemo, useState } from "react";
import { ChevronRight, Hash, Search, Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCustomers } from "@/store/customers";
import { useT } from "@/lib/i18n";
import { CategoryDot } from "@/components/CategoryBadge";
import { format, differenceInCalendarDays } from "date-fns";
import type { Customer } from "@/types/customer";
import { collectAllTags, searchCustomers } from "@/lib/searchCustomers";
import { cn } from "@/lib/utils";

interface Props {
  onSelectCustomer: (c: Customer) => void;
  onAddNew: () => void;
}

type Sort = "name" | "appt" | "last";

export function CustomersList({ onSelectCustomer, onAddNew }: Props) {
  const t = useT();
  const customers = useCustomers((s) => s.customers);
  const categories = useCustomers((s) => s.categories);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("appt");
  /** Aktywne filtry tagów – AND. Pusty zbiór = bez filtra. */
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const allTags = useMemo(() => collectAllTags(customers), [customers]);

  const items = useMemo(() => {
    // Najpierw search (szuka też w tagach), potem filtr aktywnych tagów (AND).
    let arr = searchCustomers(customers, q, { categories });

    if (activeTags.size > 0) {
      const requiredLower = new Set(
        Array.from(activeTags, (t) => t.toLocaleLowerCase()),
      );
      arr = arr.filter((c) => {
        const cTags = (c.tags ?? []).map((t) => t.toLocaleLowerCase());
        for (const required of requiredLower) {
          if (!cTags.includes(required)) return false;
        }
        return true;
      });
    }

    arr = [...arr].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "appt") {
        const ax = a.nextAppointment ? new Date(a.nextAppointment).getTime() : Infinity;
        const bx = b.nextAppointment ? new Date(b.nextAppointment).getTime() : Infinity;
        return ax - bx;
      }
      const ax = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
      const bx = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
      return bx - ax;
    });
    return arr;
  }, [customers, categories, q, sort, activeTags]);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const clearTags = () => setActiveTags(new Set());

  if (customers.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-accent">
          <Users className="h-10 w-10 text-accent-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{t.emptyTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.emptyHint}</p>
        </div>
        <Button onClick={onAddNew}>{t.addCustomer}</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 space-y-2 border-b bg-background/95 p-3 backdrop-blur">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.search}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">{t.sortName}</SelectItem>
              <SelectItem value="appt">{t.sortAppt}</SelectItem>
              <SelectItem value="last">{t.sortLast}</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">
            {items.length}
          </span>
        </div>

        {/* Tag chips – multi-select. Pokazujemy tylko jeśli są jakiekolwiek tagi. */}
        {allTags.length > 0 && (
          <div className="-mx-3 flex items-center gap-1.5 overflow-x-auto px-3 pb-1">
            {activeTags.size > 0 && (
              <button
                type="button"
                onClick={clearTags}
                className="shrink-0 rounded-full border border-dashed border-muted-foreground/40 px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
              >
                <X className="-ml-0.5 mr-0.5 inline h-3 w-3" />
                {t.clearFilter}
              </button>
            )}
            {allTags.map((tag) => {
              const active = activeTags.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-accent",
                  )}
                  aria-pressed={active}
                >
                  <Hash className="h-3 w-3 opacity-70" />
                  {tag}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ul className="flex-1 divide-y overflow-y-auto">
        {items.map((c) => {
          const days = c.nextAppointment
            ? differenceInCalendarDays(new Date(c.nextAppointment), new Date())
            : null;
          return (
            <li key={c.id}>
              <button
                onClick={() => onSelectCustomer(c)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40 min-h-[60px]"
              >
                <CategoryDot
                  categoryId={c.categoryId}
                  isDone={c.isDone}
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {c.address}
                  </div>
                  {c.tags && c.tags.length > 0 && (
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {c.tags.map((t) => `#${t}`).join(" ")}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  {c.nextAppointment && (
                    <>
                      <div className="text-xs font-medium">
                        {format(new Date(c.nextAppointment), "dd.MM")}
                      </div>
                      {days !== null && (
                        <div
                          className={`text-[11px] ${days < 0 ? "text-status-issue" : days <= 7 ? "text-status-progress" : "text-muted-foreground"}`}
                        >
                          {t.daysUntil(days)}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
