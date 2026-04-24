import { ICON_PALETTE, type PinIconKey } from "@/lib/iconPalette";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  value: string | undefined; // "auto" | PinIconKey | undefined
  onChange: (key: PinIconKey) => void;
}

/**
 * Grid palety ikon. Pierwszy slot to "Auto" (fallback na ikonę statusu).
 * Aktywna ikona jest podświetlona. Klik = zmiana.
 */
export function IconPicker({ value, onChange }: Props) {
  const t = useT();
  const current = (value ?? "auto") as PinIconKey;
  const names = t.iconNames;

  return (
    <div
      role="radiogroup"
      aria-label={t.icon}
      className="grid grid-cols-5 gap-1.5"
    >
      {ICON_PALETTE.map(({ key, Icon, labelKey }) => {
        const active = key === current;
        const label = names[labelKey as keyof typeof names] ?? key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => onChange(key)}
            className={cn(
              "flex aspect-square items-center justify-center rounded-lg border transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
    </div>
  );
}
