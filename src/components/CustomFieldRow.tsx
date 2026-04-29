import { useEffect, useRef, useState } from "react";
import {
  FileText,
  Globe,
  Hash,
  Mail,
  Phone,
  Pencil,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import type { CustomField, CustomFieldType } from "@/types/customer";
import { cn } from "@/lib/utils";

interface Props {
  field: CustomField;
  onChange: (patch: Partial<Pick<CustomField, "label" | "value">>) => void;
  onRemove: () => void;
  /** Czy auto-focus na value przy mount (gdy user właśnie kliknął chip „+ Telefon"). */
  autoFocus?: boolean;
}

/** Ikona dla typu pola — używana jako wizualna podpowiedź obok wartości. */
function iconForType(type: CustomFieldType) {
  switch (type) {
    case "phone":
      return Phone;
    case "email":
      return Mail;
    case "url":
      return Globe;
    case "tax_id":
      return Hash;
    case "text":
    default:
      return FileText;
  }
}

/** Mapuje typ pola na input type, żeby telefon wywołał na mobile keyboard z cyframi
 *  a email keyboard z `@`. */
/** Mapuje typ pola na input type, żeby telefon wywołał na mobile keyboard z cyframi
 *  a email keyboard z `@`.
 *
 *  UWAGA: dla URL świadomie używamy `text` zamiast `url`. HTML5 `type="url"`
 *  wymusza protokół (http:// / https://), co rozwala UX — user wpisuje
 *  „www.test.pl" i dostaje native validation error. CustomerDetail i tak
 *  dorzuca `https://` przy generowaniu klikalnego linka, więc protokół jest
 *  niepotrzebny w wartości. */
function inputTypeForType(type: CustomFieldType): string {
  if (type === "phone") return "tel";
  if (type === "email") return "email";
  return "text";
}

/** inputMode dla mobilnych klawiatur, gdy `type` nie wystarczy. */
function inputModeForType(type: CustomFieldType): string | undefined {
  if (type === "tax_id") return "numeric";
  // URL: mobile keyboard z `/`, `.`, `.com` ale BEZ native validation.
  if (type === "url") return "url";
  return undefined;
}

export function CustomFieldRow({
  field,
  onChange,
  onRemove,
  autoFocus = false,
}: Props) {
  const t = useT();
  const Icon = iconForType(field.type);

  const [editingLabel, setEditingLabel] = useState(field.label.trim() === "");
  const [labelDraft, setLabelDraft] = useState(field.label);
  const valueRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingLabel) {
      // krótkie opóźnienie, żeby focus nie zgubił się w tym samym ticku co render
      const id = window.setTimeout(() => labelRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [editingLabel]);

  useEffect(() => {
    if (autoFocus && !editingLabel) {
      const id = window.setTimeout(() => valueRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  const commitLabel = () => {
    const next = labelDraft.trim();
    if (next !== field.label) onChange({ label: next });
    setEditingLabel(false);
  };

  return (
    <div className="space-y-1.5 rounded-lg border bg-card/50 p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
        {editingLabel ? (
          <Input
            ref={labelRef}
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitLabel();
                // po Enter na etykiecie chcemy płynnie przejść do wartości
                window.setTimeout(() => valueRef.current?.focus(), 0);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setLabelDraft(field.label);
                setEditingLabel(false);
              }
            }}
            placeholder={t.customFieldLabelPlaceholder}
            className="h-7 flex-1 text-xs font-medium"
            aria-label={t.customFieldLabelAria}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setLabelDraft(field.label);
              setEditingLabel(true);
            }}
            className={cn(
              "group flex flex-1 items-center gap-1 text-left text-xs font-medium",
              field.label.trim() === ""
                ? "text-muted-foreground italic"
                : "text-foreground",
            )}
            aria-label={t.customFieldEditLabel}
          >
            <span className="truncate">
              {field.label.trim() || t.customFieldLabelPlaceholder}
            </span>
            <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50 shrink-0" />
          </button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={t.customFieldRemove}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Input
        ref={valueRef}
        type={inputTypeForType(field.type)}
        inputMode={inputModeForType(field.type) as never}
        value={field.value}
        onChange={(e) => onChange({ value: e.target.value })}
        placeholder={t.customFieldValuePlaceholder}
        autoComplete="off"
        // Dla URL/email/tax_id nie chcemy, żeby telefon kapitalizował
        // pierwszą literę („Www.test.pl") ani autokorektował literówek.
        autoCapitalize={field.type === "text" ? undefined : "none"}
        autoCorrect={field.type === "text" ? undefined : "off"}
        spellCheck={field.type === "text"}
        className="h-9"
      />
    </div>
  );
}
