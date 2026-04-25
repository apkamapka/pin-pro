import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Hash, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Pełna lista znanych tagów do autouzupełniania. */
  suggestions?: string[];
  placeholder?: string;
  id?: string;
}

/**
 * Pole wprowadzania tagów typu "chip":
 * - Enter, przecinek lub `Tab` zatwierdza nowy tag,
 * - Backspace przy pustym inpucie kasuje ostatni chip,
 * - klik X na chipie kasuje konkretnie ten tag,
 * - dropdown sugestii z istniejących tagów (po wpisaniu ≥1 znaku),
 * - duplikaty (case-insensitive) są ignorowane.
 *
 * Tagi przechowujemy w oryginalnej kapitalizacji (pierwsza forma wygrywa).
 */
export function TagsInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
  id,
}: Props) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset highlight gdy filtr się zmienia.
  useEffect(() => {
    setSuggestIndex(0);
  }, [draft]);

  const lowerCurrent = new Set(value.map((t) => t.toLocaleLowerCase()));
  const filteredSuggestions = draft.trim()
    ? suggestions
        .filter(
          (s) =>
            s.toLocaleLowerCase().includes(draft.toLocaleLowerCase()) &&
            !lowerCurrent.has(s.toLocaleLowerCase()),
        )
        .slice(0, 8)
    : [];

  const showDropdown = focused && filteredSuggestions.length > 0;

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/^#/, ""); // dopuszczamy "#vip" → "vip"
    if (!tag) return;
    if (lowerCurrent.has(tag.toLocaleLowerCase())) return;
    onChange([...value, tag]);
    setDraft("");
  };

  const removeTagAt = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Sugestie – nawigacja
    if (showDropdown && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setSuggestIndex((i) => {
        const len = filteredSuggestions.length;
        if (len === 0) return 0;
        if (e.key === "ArrowDown") return (i + 1) % len;
        return (i - 1 + len) % len;
      });
      return;
    }

    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      // Przy Tab pozwalamy domyślnemu zachowaniu jeśli draft jest pusty.
      if (e.key === "Tab" && !draft.trim()) return;
      e.preventDefault();
      if (showDropdown && filteredSuggestions[suggestIndex]) {
        addTag(filteredSuggestions[suggestIndex]);
      } else {
        addTag(draft);
      }
      return;
    }

    if (e.key === "Backspace" && !draft && value.length > 0) {
      // Kasujemy ostatni chip.
      removeTagAt(value.length - 1);
    }
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm transition-colors",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag, idx) => (
          <span
            key={`${tag}-${idx}`}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
          >
            <Hash className="h-3 w-3 opacity-60" />
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTagAt(idx);
              }}
              className="ml-0.5 grid h-4 w-4 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Małe opóźnienie żeby kliknięcie sugestii zdążyło zarejestrować się.
            setTimeout(() => setFocused(false), 120);
            // Auto-zatwierdź to co jest w drafcie.
            if (draft.trim()) addTag(draft);
          }}
          placeholder={value.length === 0 ? placeholder : undefined}
          className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {showDropdown && (
        <ul
          className="absolute left-0 right-0 top-full z-[1100] mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          role="listbox"
        >
          {filteredSuggestions.map((s, idx) => (
            <li
              key={s}
              role="option"
              aria-selected={idx === suggestIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(s);
              }}
              onMouseEnter={() => setSuggestIndex(idx)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                idx === suggestIndex && "bg-accent text-accent-foreground",
              )}
            >
              <Hash className="h-3 w-3 opacity-60" />
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
