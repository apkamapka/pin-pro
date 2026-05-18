import {
  CalendarClock,
  Compass,
  Map,
  Settings as SettingsIcon,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT, useI18n, type Lang } from "@/lib/i18n";

export type Tab = "map" | "customers" | "today" | "nearby" | "settings";

interface Props {
  active: Tab;
  onChange: (t: Tab) => void;
  variant: "bottom" | "top";
}

export function NavBar({ active, onChange, variant }: Props) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);

  const items: Array<{ key: Tab; label: string; icon: JSX.Element }> = [
    { key: "map", label: t.map, icon: <Map className="h-5 w-5" /> },
    { key: "customers", label: t.customers, icon: <Users className="h-5 w-5" /> },
    { key: "today", label: t.today, icon: <CalendarClock className="h-5 w-5" /> },
    { key: "nearby", label: t.nearby, icon: <Compass className="h-5 w-5" /> },
    { key: "settings", label: t.settings, icon: <SettingsIcon className="h-5 w-5" /> },
  ];

  const langOptions: Array<{ code: Lang; label: string }> = [
    { code: "en", label: "EN" },
    { code: "pl", label: "PL" },
  ];

  const langSwitcher = (
    <div
      className="flex items-center gap-0.5 rounded-lg border bg-background p-0.5"
      role="group"
      aria-label={t.language}
    >
      {langOptions.map((opt) => (
        <button
          key={opt.code}
          type="button"
          aria-pressed={lang === opt.code}
          onClick={() => setLang(opt.code)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
            lang === opt.code
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  if (variant === "bottom") {
    return (
      <>
        {/* Pływający przełącznik języka — tylko mobile, top-right nad mapą */}
        <div className="fixed right-3 z-[600] shadow-floating" style={{ top: "calc(env(safe-area-inset-top, 2rem) + 0.5rem)" }}>
          {langSwitcher}
        </div>
        <nav
          className="fixed inset-x-0 bottom-0 z-[500] grid grid-cols-5 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)] shadow-floating"
          role="tablist"
        >
          {items.map((it) => (
            <button
              key={it.key}
              role="tab"
              aria-selected={active === it.key}
              onClick={() => onChange(it.key)}
              className={cn(
                "flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors",
                active === it.key
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {it.icon}
              <span className="max-w-full truncate">{it.label}</span>
            </button>
          ))}
        </nav>
      </>
    );
  }

  return (
    <nav
      className="sticky top-0 z-[500] flex items-center gap-1 border-b bg-background/95 px-4 py-2 backdrop-blur"
      role="tablist"
    >
      <div className="mr-4 flex items-center gap-2 font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Map className="h-4 w-4" />
        </span>
        <span>
          <span className="text-foreground">Map</span>
          <span className="text-status-ok">elo</span>
        </span>
      </div>
      {items.map((it) => (
        <button
          key={it.key}
          role="tab"
          aria-selected={active === it.key}
          onClick={() => onChange(it.key)}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            active === it.key
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {it.icon}
          <span>{it.label}</span>
        </button>
      ))}
      <div className="ml-auto">{langSwitcher}</div>
    </nav>
  );
}
