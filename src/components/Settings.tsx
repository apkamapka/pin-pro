import { useRef, useState, type KeyboardEvent } from "react";
import { Check, Download, Moon, Sun, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { CategoryManager } from "@/components/CategoryManager";
import { useCustomers } from "@/store/customers";
import { useT, useI18n } from "@/lib/i18n";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types/customer";
import type { Theme } from "@/store/customers";

const APP_VERSION = "1.0.0";

export function Settings() {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);
  const customers = useCustomers((s) => s.customers);
  const exportCustomers = useCustomers((s) => s.exportCustomers);
  const importCustomers = useCustomers((s) => s.importCustomers);
  const clearAll = useCustomers((s) => s.clearAll);
  const thresholds = useCustomers((s) => s.thresholds);
  const setThresholds = useCustomers((s) => s.setThresholds);
  const profession = useCustomers((s) => s.activeProfession);
  const professions = useCustomers((s) => s.professions);
  const addProfession = useCustomers((s) => s.addProfession);
  const removeProfession = useCustomers((s) => s.removeProfession);
  const setActiveProfession = useCustomers((s) => s.setActiveProfession);
  const theme = useCustomers((s) => s.theme);
  const setTheme = useCustomers((s) => s.setTheme);
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");

  const handleExport = () => {
    const data = exportCustomers();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `serwismap-backup-${format(new Date(), "yyyy-MM-dd")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(t.exported);
  };

  const handleImportClick = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Customer[];
      if (!Array.isArray(parsed)) throw new Error("invalid");
      const mode = window.confirm(`${t.importMerge}? (cancel = ${t.importReplace})`)
        ? "merge"
        : "replace";
      const n = importCustomers(parsed, mode);
      toast.success(`${t.imported}: ${n}`);
    } catch {
      toast.error("Invalid JSON");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleClear = () => {
    if (!window.confirm(t.clearAllConfirm)) return;
    clearAll();
    toast.success(t.cleared);
  };

  const handleAddProfession = () => {
    const p = draft.trim();
    if (!p) return;
    const res = addProfession(p);
    if (res === "added") {
      toast.success(t.professionAdded);
      setDraft("");
    } else if (res === "exists") {
      toast.info(t.professionExists);
      setDraft("");
    }
  };

  const handleProfessionKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddProfession();
    }
  };

  const handleRemoveProfession = (p: string) => {
    removeProfession(p);
    toast.success(t.professionRemoved);
  };

  return (
    <div className="space-y-6 p-4 max-w-2xl mx-auto">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t.exportData} / {t.importData}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            {t.exportData}
          </Button>
          <Button variant="outline" onClick={handleImportClick}>
            <Upload className="mr-2 h-4 w-4" />
            {t.importData}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleFile}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {customers.length} {t.customers.toLowerCase()}
        </p>
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t.thresholds}
        </h2>
        <ThresholdSlider
          label={`${t.legendSoon}`}
          value={thresholds.soon}
          min={1}
          max={14}
          onChange={(v) => setThresholds({ ...thresholds, soon: v })}
        />
        <ThresholdSlider
          label={`${t.legendUpcoming}`}
          value={thresholds.upcoming}
          min={thresholds.soon + 1}
          max={28}
          onChange={(v) => setThresholds({ ...thresholds, upcoming: v })}
        />
        <ThresholdSlider
          label={`${t.legendLater}`}
          value={thresholds.later}
          min={thresholds.upcoming + 1}
          max={90}
          onChange={(v) => setThresholds({ ...thresholds, later: v })}
        />
      </section>

      <section className="space-y-3">
        <CategoryManager />
      </section>

      <section className="space-y-3">
        <Label>{t.profession}</Label>
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleProfessionKey}
            placeholder={t.professionPlaceholder}
            maxLength={60}
          />
          <Button
            type="button"
            onClick={handleAddProfession}
            disabled={!draft.trim()}
            variant="outline"
          >
            {t.professionAdd}
          </Button>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">
            {t.yourProfessions}
          </div>
          {professions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              {t.professionsEmpty}
            </p>
          ) : (
            <ul className="space-y-1">
              {professions.map((p) => {
                const isActive = p === profession;
                return (
                  <li
                    key={p}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
                      isActive
                        ? "border-primary/50 bg-accent text-accent-foreground"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveProfession(p)}
                      className="flex flex-1 items-center gap-2 text-left text-sm"
                      aria-pressed={isActive}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{p}</span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveProfession(p)}
                      aria-label={`${t.professionRemove}: ${p}`}
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <Label>{t.darkMode}</Label>
        <div className="grid grid-cols-3 gap-2">
          {(["light", "dark", "system"] as Theme[]).map((m) => (
            <Button
              key={m}
              variant={theme === m ? "default" : "outline"}
              onClick={() => setTheme(m)}
              size="sm"
            >
              {m === "light" && <Sun className="mr-1.5 h-4 w-4" />}
              {m === "dark" && <Moon className="mr-1.5 h-4 w-4" />}
              {t[m as "light" | "dark" | "system"]}
            </Button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <Label>{t.language}</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={lang === "pl" ? "default" : "outline"}
            onClick={() => setLang("pl")}
          >
            {t.polish}
          </Button>
          <Button
            variant={lang === "en" ? "default" : "outline"}
            onClick={() => setLang("en")}
          >
            {t.english}
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <Button variant="destructive" onClick={handleClear} className="w-full">
          <Trash2 className="mr-2 h-4 w-4" />
          {t.clearAll}
        </Button>
      </section>

      <section className="space-y-1 border-t pt-4 text-center text-xs text-muted-foreground">
        <div className="font-semibold text-foreground">SerwisMap</div>
        <div>{t.aboutText}</div>
        <div>
          {t.version} {APP_VERSION}
        </div>
      </section>
    </div>
  );
}

function ThresholdSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums font-medium">{value}d</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}
