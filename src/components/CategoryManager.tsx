import { useState, type KeyboardEvent } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useCustomers } from "@/store/customers";
import { ICON_PALETTE, type PinIconKey } from "@/lib/iconPalette";
import { CATEGORY_COLOR_PALETTE, type Category } from "@/types/customer";
import { toast } from "sonner";

/**
 * Prosty CRUD kategorii. Każda kategoria: nazwa + ikona + kolor.
 * Dodawanie na górze, lista pod spodem, edycja inline.
 */
export function CategoryManager() {
  const t = useT();
  const categories = useCustomers((s) => s.categories);
  const addCategory = useCustomers((s) => s.addCategory);
  const updateCategory = useCustomers((s) => s.updateCategory);
  const removeCategory = useCustomers((s) => s.removeCategory);

  const [draftName, setDraftName] = useState("");
  const [draftIcon, setDraftIcon] = useState<PinIconKey>("wrench");
  const [draftColor, setDraftColor] = useState<string>(
    CATEGORY_COLOR_PALETTE[0],
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = () => {
    const name = draftName.trim();
    if (!name) return;
    addCategory({ name, icon: draftIcon, color: draftColor });
    toast.success(t.categoryAdded);
    setDraftName("");
    // Celowo nie resetuję koloru/ikony — user może chcieć dodać kilka z tej samej palety.
  };

  const handleAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (id: string) => {
    if (!window.confirm(t.categoryRemoveConfirm)) return;
    removeCategory(id);
    toast.success(t.categoryRemoved);
  };

  return (
    <div className="space-y-3">
      <Label>{t.categories}</Label>
      <p className="text-xs text-muted-foreground">{t.categoriesHint}</p>

      {/* Formularz dodawania */}
      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex gap-2">
          <Input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={handleAddKey}
            placeholder={t.categoryNamePlaceholder}
            maxLength={40}
          />
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!draftName.trim()}
            size="sm"
          >
            <Plus className="mr-1 h-4 w-4" />
            {t.categoryAdd}
          </Button>
        </div>

        <IconRow value={draftIcon} onChange={setDraftIcon} />
        <ColorRow value={draftColor} onChange={setDraftColor} />
      </div>

      {/* Lista */}
      {categories.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          {t.categoriesEmpty}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {categories.map((c) =>
            editingId === c.id ? (
              <CategoryRowEdit
                key={c.id}
                category={c}
                onSave={(patch) => {
                  updateCategory(c.id, patch);
                  toast.success(t.categoryUpdated);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <CategoryRowView
                key={c.id}
                category={c}
                onEdit={() => setEditingId(c.id)}
                onRemove={() => handleRemove(c.id)}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function CategoryRowView({
  category,
  onEdit,
  onRemove,
}: {
  category: Category;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  const Icon = ICON_PALETTE.find((p) => p.key === category.icon)?.Icon;
  return (
    <li className="flex items-center gap-2 rounded-lg border px-3 py-2">
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white"
        style={{ backgroundColor: category.color }}
        aria-hidden
      >
        {Icon && <Icon className="h-4 w-4" strokeWidth={2.5} />}
      </span>
      <span className="flex-1 truncate text-sm">{category.name}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onEdit}
        className="h-7 w-7 text-muted-foreground"
        aria-label={t.edit}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        aria-label={t.delete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}

function CategoryRowEdit({
  category,
  onSave,
  onCancel,
}: {
  category: Category;
  onSave: (patch: Partial<Omit<Category, "id">>) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(category.name);
  const [icon, setIcon] = useState<PinIconKey>(
    (category.icon as PinIconKey) ?? "wrench",
  );
  const [color, setColor] = useState(category.color);

  return (
    <li className="space-y-2 rounded-lg border p-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        autoFocus
      />
      <IconRow value={icon} onChange={setIcon} />
      <ColorRow value={color} onChange={setColor} />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
        >
          <X className="mr-1 h-4 w-4" />
          {t.cancel}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!name.trim()}
          onClick={() => onSave({ name: name.trim(), icon, color })}
        >
          <Check className="mr-1 h-4 w-4" />
          {t.save}
        </Button>
      </div>
    </li>
  );
}

function IconRow({
  value,
  onChange,
}: {
  value: PinIconKey;
  onChange: (k: PinIconKey) => void;
}) {
  // Z palety pomijamy "auto" – dla kategorii nie ma sensu (auto = z kategorii).
  const options = ICON_PALETTE.filter((p) => p.key !== "auto");
  return (
    <div className="grid grid-cols-7 gap-1" role="radiogroup">
      {options.map(({ key, Icon }) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(key)}
            className={cn(
              "flex aspect-square items-center justify-center rounded-md border transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

function ColorRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {CATEGORY_COLOR_PALETTE.map((hex) => {
        const active = hex === value;
        return (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(hex)}
            className={cn(
              "h-7 w-7 rounded-full border-2 transition-transform",
              active
                ? "border-foreground scale-110"
                : "border-transparent hover:scale-105",
            )}
            style={{ backgroundColor: hex }}
            aria-label={hex}
          />
        );
      })}
    </div>
  );
}
