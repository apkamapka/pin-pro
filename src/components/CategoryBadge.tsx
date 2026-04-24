import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useCustomers } from "@/store/customers";
import { getIconByKey } from "@/lib/iconPalette";

/**
 * Badge kategorii (kolor + nazwa + opcjonalna ikona). Pokazuje się tylko
 * jeśli klient ma przypisaną kategorię. Jeśli nie – komponent zwraca null,
 * a wywołujący może pokazać fallback (np. "Bez kategorii").
 */
export function CategoryBadge({
  categoryId,
  className,
  showIcon = true,
}: {
  categoryId?: string | null;
  className?: string;
  showIcon?: boolean;
}) {
  const categories = useCustomers((s) => s.categories);
  if (!categoryId) return null;
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return null;
  const Icon = getIconByKey(cat.icon);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white",
        className,
      )}
      style={{ backgroundColor: cat.color }}
    >
      {showIcon && Icon && <Icon className="h-3 w-3" />}
      <span className="truncate max-w-[10rem]">{cat.name}</span>
    </span>
  );
}

/** Mała kolorowa kropka – zastępuje StatusDot w listach. */
export function CategoryDot({
  categoryId,
  isDone,
  className,
}: {
  categoryId?: string | null;
  isDone?: boolean;
  className?: string;
}) {
  const categories = useCustomers((s) => s.categories);
  let color = "hsl(var(--muted-foreground))";
  if (isDone) {
    color = "#6b7280"; // szary dla zakończonych
  } else if (categoryId) {
    const cat = categories.find((c) => c.id === categoryId);
    if (cat) color = cat.color;
  }
  return (
    <span
      className={cn("inline-block h-2.5 w-2.5 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}

/** Mały badge "Zakończone" – pokazujemy gdy klient `isDone`. */
export function DoneBadge({ className }: { className?: string }) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {t.stateDone}
    </span>
  );
}
