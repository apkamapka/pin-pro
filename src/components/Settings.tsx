import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Moon, Sun, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { CategoryManager } from "@/components/CategoryManager";
import { ImportWizard } from "@/components/ImportWizard";
import { useCustomers } from "@/store/customers";
import { COUNTRIES, COUNTRY_AUTO } from "@/lib/countries";
import { useT, useI18n } from "@/lib/i18n";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Customer } from "@/types/customer";
import type { Theme } from "@/store/customers";
import { TONE_HEX } from "@/lib/pinColor";
import type { PinTone } from "@/lib/pinColor";

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
  const theme = useCustomers((s) => s.theme);
  const setTheme = useCustomers((s) => s.setTheme);
  const defaultCountry = useCustomers((s) => s.defaultCountry);
  const setDefaultCountry = useCustomers((s) => s.setDefaultCountry);
  const nearbyRadiusKm = useCustomers((s) => s.nearbyRadiusKm);
  const setNearbyRadiusKm = useCustomers((s) => s.setNearbyRadiusKm);
  const fileRef = useRef<HTMLInputElement>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const handleExport = () => {
    const data = exportCustomers();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mapelo-backup-${format(new Date(), "yyyy-MM-dd")}.json`;
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            {t.exportData}
          </Button>
          <Button variant="outline" onClick={handleImportClick}>
            <Upload className="mr-2 h-4 w-4" />
            {t.importJson}
          </Button>
          <Button
            variant="outline"
            onClick={() => setWizardOpen(true)}
            className="sm:col-span-2"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {t.importSpreadsheet}
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

      <ImportWizard open={wizardOpen} onOpenChange={setWizardOpen} />

      <section className="space-y-4 rounded-xl border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t.thresholds}
        </h2>
        <ThresholdSlider
          tone="soon"
          colorName={t.toneSoonName}
          rangeLabel={t.dayRange(0, thresholds.soon)}
          value={thresholds.soon}
          min={1}
          max={14}
          onChange={(v) => setThresholds({ ...thresholds, soon: v })}
        />
        <ThresholdSlider
          tone="upcoming"
          colorName={t.toneUpcomingName}
          rangeLabel={t.dayRange(thresholds.soon + 1, thresholds.upcoming)}
          value={thresholds.upcoming}
          min={thresholds.soon + 1}
          max={28}
          onChange={(v) => setThresholds({ ...thresholds, upcoming: v })}
        />
        <ThresholdSlider
          tone="later"
          colorName={t.toneLaterName}
          rangeLabel={t.dayRange(thresholds.upcoming + 1, thresholds.later)}
          value={thresholds.later}
          min={thresholds.upcoming + 1}
          max={90}
          onChange={(v) => setThresholds({ ...thresholds, later: v })}
        />
        {/* "future" nie ma suwaka — to wszystko powyżej `later`, pokazujemy
            jako informację bez kontroli. */}
        <FutureRow
          colorName={t.toneFutureName}
          rangeLabel={t.dayPlus(thresholds.later + 1)}
        />
      </section>

      <section className="space-y-3">
        <CategoryManager />
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
            variant={lang === "en" ? "default" : "outline"}
            onClick={() => setLang("en")}
          >
            {t.english}
          </Button>
          <Button
            variant={lang === "pl" ? "default" : "outline"}
            onClick={() => setLang("pl")}
          >
            {t.polish}
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <Label htmlFor="default-country">{t.defaultCountry}</Label>
        <select
          id="default-country"
          value={defaultCountry}
          onChange={(e) => setDefaultCountry(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value={COUNTRY_AUTO}>{t.countryAuto}</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {lang === "pl" ? c.namePl : c.nameEn}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{t.defaultCountryHint}</p>
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <div className="flex items-baseline justify-between gap-3">
          <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t.nearbyRadius}
          </Label>
          <span className="tabular-nums text-sm font-medium">
            {nearbyRadiusKm} km
          </span>
        </div>
        <Slider
          value={[nearbyRadiusKm]}
          min={1}
          max={50}
          step={1}
          onValueChange={(v) => setNearbyRadiusKm(v[0])}
        />
        <p className="text-xs text-muted-foreground">{t.nearbyRadiusHint}</p>
      </section>

      <section className="space-y-2">
        <Button variant="destructive" onClick={handleClear} className="w-full">
          <Trash2 className="mr-2 h-4 w-4" />
          {t.clearAll}
        </Button>
      </section>

      <section className="space-y-1 border-t pt-4 text-center text-xs text-muted-foreground">
        <div className="font-semibold">
          <span className="text-foreground">Map</span>
          <span className="text-status-ok">elo</span>
        </div>
        <div>{t.aboutText}</div>
        <div>
          {t.version} {APP_VERSION}
        </div>
      </section>
    </div>
  );
}

function ThresholdSlider({
  tone,
  colorName,
  rangeLabel,
  value,
  min,
  max,
  onChange,
}: {
  tone: Extract<PinTone, "soon" | "upcoming" | "later">;
  colorName: string;
  /** Pre-formatted label like "0–3 dni" — przekazywane z parenta,
   *  żeby trzymać formatowanie w jednym miejscu (i18n) i nie duplikować. */
  rangeLabel: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 rounded-full border border-white/40 shadow-pin"
            style={{ background: TONE_HEX[tone] }}
          />
          <span className="truncate">
            <span className="font-medium">{colorName}</span>
            <span className="ml-1.5 text-muted-foreground">
              · {rangeLabel}
            </span>
          </span>
        </div>
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

/** Pomocniczy wiersz pokazujący ton "future" — bez suwaka, bo to
 *  domyślnie "wszystko powyżej later". Daje pełen obraz palety. */
function FutureRow({
  colorName,
  rangeLabel,
}: {
  colorName: string;
  rangeLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 border-t pt-3 text-sm text-muted-foreground">
      <span
        aria-hidden
        className="h-3 w-3 shrink-0 rounded-full border border-white/40 shadow-pin"
        style={{ background: TONE_HEX.future }}
      />
      <span>
        <span className="font-medium text-foreground">{colorName}</span>
        <span className="ml-1.5">· {rangeLabel}</span>
      </span>
    </div>
  );
}
