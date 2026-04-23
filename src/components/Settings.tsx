import { useRef } from "react";
import { Download, Moon, Sun, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCustomers } from "@/store/customers";
import { useT, useI18n } from "@/lib/i18n";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Customer } from "@/types/customer";
import type { Theme } from "@/store/customers";

const PROFESSIONS = ["custom", "hvac", "sales", "medical", "realestate", "insurance"] as const;
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
  const profession = useCustomers((s) => s.profession);
  const setProfession = useCustomers((s) => s.setProfession);
  const theme = useCustomers((s) => s.theme);
  const setTheme = useCustomers((s) => s.setTheme);
  const fileRef = useRef<HTMLInputElement>(null);

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

      <section className="space-y-2">
        <Label>{t.profession}</Label>
        <Select value={profession} onValueChange={setProfession}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROFESSIONS.map((p) => (
              <SelectItem key={p} value={p}>
                {t.professions[p as keyof typeof t.professions]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
