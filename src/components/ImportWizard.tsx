import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useT } from "@/lib/i18n";
import { useCustomers } from "@/store/customers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import {
  parseImportFile,
  ImportFileError,
  type ParsedFile,
  MAX_FILE_SIZE,
} from "@/lib/fileImport";
import {
  autoMapColumns,
  validateMapping,
  SCHEMA_FIELDS,
  type ColumnMapping,
  type SchemaField,
} from "@/lib/columnMapping";
import {
  composeCandidates,
  type ImportCandidate,
} from "@/lib/importCompose";
import { batchGeocode, type GeocodeProgress } from "@/lib/batchGeocode";

type Step = "file" | "mapping" | "geocode" | "review";
type Validation = ReturnType<typeof validateMapping>;

const NONE_VALUE = "__none__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportWizard({ open, onOpenChange }: Props) {
  const t = useT();
  const addCustomer = useCustomers((s) => s.addCustomer);

  // Multi-step state
  const [step, setStep] = useState<Step>("file");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [progress, setProgress] = useState<GeocodeProgress>({
    done: 0,
    total: 0,
    success: 0,
    failed: 0,
  });
  const [geocoding, setGeocoding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const cancelRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset wszystko gdy zamykamy dialog
  useEffect(() => {
    if (!open) {
      // Cooldown na cancel, w razie gdyby coś leciało
      cancelRef.current = true;
      const timer = setTimeout(() => {
        setStep("file");
        setParsed(null);
        setMapping({});
        setCandidates([]);
        setProgress({ done: 0, total: 0, success: 0, failed: 0 });
        setGeocoding(false);
        setImporting(false);
        setFileError(null);
        setDragOver(false);
        cancelRef.current = false;
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // ---- KROK 1: PLIK ----

  const handleFile = async (file: File) => {
    setFileError(null);
    if (file.size > MAX_FILE_SIZE) {
      setFileError(t.importFileTooLarge);
      return;
    }
    try {
      const result = await parseImportFile(file);
      setParsed(result);
      const { mapping: auto } = autoMapColumns(result.headers);
      setMapping(auto);
      setStep("mapping");
    } catch (err) {
      if (err instanceof ImportFileError) {
        if (err.kind === "empty" || err.kind === "no_headers" || err.kind === "no_rows") {
          setFileError(t.importFileEmpty);
        } else if (err.kind === "unsupported_format") {
          setFileError(t.importFileFormat);
        } else {
          setFileError(`${t.importFileFailed}: ${err.message}`);
        }
      } else {
        setFileError(`${t.importFileFailed}: ${(err as Error).message}`);
      }
    }
  };

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFile(file);
  };

  // ---- KROK 2: MAPPING ----

  const unmappedHeaders = useMemo(() => {
    if (!parsed) return [];
    const usedHeaders = new Set(Object.values(mapping));
    return parsed.headers.filter((h) => !usedHeaders.has(h));
  }, [parsed, mapping]);

  const validation = useMemo(() => validateMapping(mapping), [mapping]);

  const setMappingField = (field: SchemaField, header: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (header === NONE_VALUE) {
        delete next[field];
      } else {
        // Jeśli ten sam header był używany przez inne pole — odpinamy
        for (const f of SCHEMA_FIELDS) {
          if (next[f] === header && f !== field) delete next[f];
        }
        next[field] = header;
      }
      return next;
    });
  };

  const goToGeocode = () => {
    if (!parsed) return;
    if (!validation.ok) return;
    const cs = composeCandidates(parsed.rows, mapping, {
      unmappedHeaders,
    });
    setCandidates(cs);
    setProgress({
      done: 0,
      total: cs.filter((c) => c.valid).length,
      success: 0,
      failed: 0,
    });
    setStep("geocode");
  };

  // ---- KROK 3: GEOCODE ----

  const startGeocoding = async () => {
    setGeocoding(true);
    cancelRef.current = false;
    // Klonujemy żeby setState wywoływał re-render, ale batchGeocode mutuje in-place
    const working = candidates.map((c) => ({ ...c }));
    await batchGeocode(working, {
      shouldCancel: () => cancelRef.current,
      onProgress: (p) => {
        setProgress(p);
      },
    });
    setCandidates(working);
    setGeocoding(false);
    if (!cancelRef.current) {
      setStep("review");
    }
  };

  const cancelGeocoding = () => {
    cancelRef.current = true;
  };

  // ---- KROK 4: REVIEW + IMPORT ----

  const importable = candidates.filter(
    (c) => c.valid && c.lat !== undefined && c.lng !== undefined,
  );
  const skipped = candidates.length - importable.length;

  const problemRows = candidates.filter(
    (c) => !c.valid || c.lat === undefined || c.lng === undefined,
  );

  const doImport = async () => {
    if (importable.length === 0) {
      toast.error(t.importNothingToImport);
      return;
    }
    setImporting(true);
    try {
      // Dodaj sequentially – zustand jest sync, więc to praktycznie zero-koszt
      for (const c of importable) {
        addCustomer({
          name: c.name,
          company: c.company,
          address: c.address,
          lat: c.lat!,
          lng: c.lng!,
          phone: c.phone,
          phone2: c.phone2,
          email: c.email,
          website: c.website,
          notes: c.notes,
          tags: c.tags,
          lastVisit: c.lastVisit,
          nextAppointment: c.nextAppointment,
          isDone: false,
        });
      }
      toast.success(t.importDone(importable.length));
      onOpenChange(false);
    } finally {
      setImporting(false);
    }
  };

  // ---- RENDER ----

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {t.importSpreadsheet}
          </DialogTitle>
          <DialogDescription>
            {t.importDropHint}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <StepIndicator step={step} t={t} />

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {step === "file" && (
            <FileStep
              t={t}
              dragOver={dragOver}
              setDragOver={setDragOver}
              fileError={fileError}
              onDrop={handleDrop}
              onChooseFile={() => fileInputRef.current?.click()}
              fileInputRef={fileInputRef}
              onFileInputChange={handleFileInputChange}
            />
          )}

          {step === "mapping" && parsed && (
            <MappingStep
              t={t}
              parsed={parsed}
              mapping={mapping}
              unmappedHeaders={unmappedHeaders}
              validation={validation}
              setMappingField={setMappingField}
            />
          )}

          {step === "geocode" && (
            <GeocodeStep
              t={t}
              candidates={candidates}
              geocoding={geocoding}
              progress={progress}
              onStart={startGeocoding}
              onCancel={cancelGeocoding}
            />
          )}

          {step === "review" && (
            <ReviewStep
              t={t}
              importable={importable}
              skipped={skipped}
              problemRows={problemRows}
            />
          )}
        </div>

        <Footer
          t={t}
          step={step}
          parsed={parsed}
          validation={validation}
          geocoding={geocoding}
          importing={importing}
          importableCount={importable.length}
          onBack={() => {
            if (step === "mapping") setStep("file");
            else if (step === "geocode") setStep("mapping");
            else if (step === "review") setStep("mapping");
          }}
          onNext={() => {
            if (step === "mapping") goToGeocode();
          }}
          onImport={doImport}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({ step, t }: { step: Step; t: ReturnType<typeof useT> }) {
  const steps: Array<{ id: Step; label: string }> = [
    { id: "file", label: t.importStepFile },
    { id: "mapping", label: t.importStepMapping },
    { id: "geocode", label: t.importStepGeocode },
    { id: "review", label: t.importStepReview },
  ];
  const currentIdx = steps.findIndex((s) => s.id === step);

  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const active = s.id === step;
        const done = i < currentIdx;
        return (
          <div key={s.id} className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                active &&
                  "border-primary bg-primary text-primary-foreground",
                done &&
                  "border-primary/60 bg-primary/20 text-primary",
                !active &&
                  !done &&
                  "border-border bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span
              className={cn(
                "truncate",
                active ? "font-semibold" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="hidden sm:block flex-1 h-px bg-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FileStep({
  t,
  dragOver,
  setDragOver,
  fileError,
  onDrop,
  onChooseFile,
  fileInputRef,
  onFileInputChange,
}: {
  t: ReturnType<typeof useT>;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  fileError: string | null;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onChooseFile: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-4 py-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/30",
        )}
      >
        <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-semibold">{t.importDropTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t.importDropHint}</p>
        <Button
          type="button"
          onClick={onChooseFile}
          className="mt-4"
          variant="outline"
        >
          {t.importChooseFile}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={onFileInputChange}
        />
      </div>

      {fileError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {fileError}
        </div>
      )}
    </div>
  );
}

function MappingStep({
  t,
  parsed,
  mapping,
  unmappedHeaders,
  validation,
  setMappingField,
}: {
  t: ReturnType<typeof useT>;
  parsed: ParsedFile;
  mapping: ColumnMapping;
  unmappedHeaders: string[];
  validation: Validation;
  setMappingField: (field: SchemaField, header: string) => void;
}) {
  const previewRows = parsed.rows.slice(0, 3);

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t.importMappingTitle}</h3>
        <span className="text-xs text-muted-foreground">
          {t.importPreviewRows(parsed.rows.length)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t.importMappingHint}</p>

      {/* Preview pierwszych 3 wierszy */}
      <div className="overflow-x-auto rounded-lg border bg-muted/20">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              {parsed.headers.map((h) => (
                <th
                  key={h}
                  className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                {parsed.headers.map((h) => (
                  <td
                    key={h}
                    className="px-2 py-1.5 max-w-[160px] truncate"
                    title={row[h]}
                  >
                    {row[h] || (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mapping table */}
      <div className="space-y-2">
        {SCHEMA_FIELDS.map((field) => (
          <div
            key={field}
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3"
          >
            <Label className="text-sm">
              {t.importMappingFieldNames[field]}
            </Label>
            <span className="text-muted-foreground text-xs">←</span>
            <Select
              value={mapping[field] ?? NONE_VALUE}
              onValueChange={(v) => setMappingField(field, v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>
                  <span className="text-muted-foreground">
                    {t.importMappingNone}
                  </span>
                </SelectItem>
                {parsed.headers.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {/* Walidacja */}
      {!validation.ok && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <div className="font-semibold text-destructive">
            {t.importMappingProblems}
          </div>
          <ul className="mt-1 list-disc pl-5 text-xs text-destructive/80">
            {validation.problems.map((p) => (
              <li key={p}>
                {p === "no_name"
                  ? t.importMappingNoName
                  : t.importMappingNoAddress}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Niezmapowane */}
      <div className="rounded-lg border bg-muted/30 p-3 text-xs">
        <div className="font-medium">{t.importUnmappedHint(unmappedHeaders.length)}</div>
        {unmappedHeaders.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {unmappedHeaders.map((h) => (
              <span
                key={h}
                className="rounded bg-background border px-1.5 py-0.5 text-muted-foreground"
              >
                {h}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GeocodeStep({
  t,
  candidates,
  geocoding,
  progress,
  onStart,
  onCancel,
}: {
  t: ReturnType<typeof useT>;
  candidates: ImportCandidate[];
  geocoding: boolean;
  progress: GeocodeProgress;
  onStart: () => void;
  onCancel: () => void;
}) {
  const validCount = candidates.filter((c) => c.valid).length;
  const pct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  // Estymacja czasu: ~1.1s na kandydata
  const remaining = progress.total - progress.done;
  const etaSec = Math.max(0, Math.round((remaining * 1.1) / 1));
  const etaMin = Math.floor(etaSec / 60);
  const etaText =
    etaSec === 0 ? "" : etaMin > 0 ? `~${etaMin}m ${etaSec % 60}s` : `~${etaSec}s`;

  return (
    <div className="space-y-4 py-4">
      <div>
        <h3 className="text-sm font-semibold">{t.importGeocodeTitle}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t.importGeocodeHint}
        </p>
      </div>

      {!geocoding && progress.done === 0 && (
        <div className="rounded-lg border bg-muted/30 p-4 text-center">
          <p className="text-sm">
            {t.importPreviewRows(validCount)} → {t.importGeocodeStart.toLowerCase()}
          </p>
          <Button onClick={onStart} className="mt-3">
            {t.importGeocodeStart}
          </Button>
        </div>
      )}

      {(geocoding || progress.done > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {t.importGeocodeProgress(progress.done, progress.total)}
            </span>
            {etaText && (
              <span className="text-xs text-muted-foreground">{etaText}</span>
            )}
          </div>
          <Progress value={pct} className="h-2" />
          <div className="flex items-center justify-between text-xs">
            <div className="flex gap-3">
              <span className="text-emerald-600 dark:text-emerald-500">
                ✓ {t.importGeocodeFound(progress.success)}
              </span>
              {progress.failed > 0 && (
                <span className="text-amber-600 dark:text-amber-500">
                  ✗ {t.importGeocodeMissing(progress.failed)}
                </span>
              )}
            </div>
            {geocoding && (
              <Button
                size="sm"
                variant="outline"
                onClick={onCancel}
                className="h-7"
              >
                <X className="mr-1 h-3 w-3" />
                {t.importGeocodePause}
              </Button>
            )}
          </div>

          {progress.current && geocoding && (
            <div className="rounded border bg-muted/30 px-2 py-1.5 text-xs flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
              <span className="truncate text-muted-foreground">
                {progress.current.name} — {progress.current.address}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewStep({
  t,
  importable,
  skipped,
  problemRows,
}: {
  t: ReturnType<typeof useT>;
  importable: ImportCandidate[];
  skipped: number;
  problemRows: ImportCandidate[];
}) {
  return (
    <div className="space-y-4 py-4">
      <h3 className="text-sm font-semibold">{t.importReviewTitle}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">
            {importable.length}
          </div>
          <div className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
            {t.importReviewReady(importable.length)}
          </div>
        </div>

        {skipped > 0 ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-500">
              {skipped}
            </div>
            <div className="text-xs text-amber-700/80 dark:text-amber-400/80">
              {t.importReviewSkipped(skipped)}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
            <div className="text-xs">{t.importReviewNoProblems}</div>
          </div>
        )}
      </div>

      {problemRows.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t.importReviewProblems}
          </div>
          <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
            {problemRows.slice(0, 30).map((c) => (
              <div
                key={c.rowId}
                className="flex items-start gap-2 px-3 py-2 text-xs"
              >
                <X className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {c.name || `(wiersz ${c.rowId + 1})`}
                  </div>
                  <div className="text-muted-foreground truncate">
                    {c.missing.includes("name") && t.importErrorRowName + ". "}
                    {c.missing.includes("address") &&
                      t.importErrorRowAddress + ". "}
                    {c.valid &&
                      c.lat === undefined &&
                      `${t.importErrorRowGeocode} (${c.address})`}
                  </div>
                </div>
              </div>
            ))}
            {problemRows.length > 30 && (
              <div className="px-3 py-2 text-xs text-muted-foreground italic text-center">
                +{problemRows.length - 30}…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Footer({
  t,
  step,
  parsed,
  validation,
  geocoding,
  importing,
  importableCount,
  onBack,
  onNext,
  onImport,
  onClose,
}: {
  t: ReturnType<typeof useT>;
  step: Step;
  parsed: ParsedFile | null;
  validation: Validation;
  geocoding: boolean;
  importing: boolean;
  importableCount: number;
  onBack: () => void;
  onNext: () => void;
  onImport: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t pt-3">
      <div>
        {step !== "file" && !geocoding && !importing && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t.importBack}
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        {step === "file" && (
          <Button variant="outline" onClick={onClose}>
            {t.importClose}
          </Button>
        )}
        {step === "mapping" && parsed && (
          <Button onClick={onNext} disabled={!validation.ok}>
            {t.importNext}
          </Button>
        )}
        {step === "review" && (
          <Button
            onClick={onImport}
            disabled={importing || importableCount === 0}
          >
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {importing ? t.importImporting : t.importDoImport}
          </Button>
        )}
      </div>
    </div>
  );
}
