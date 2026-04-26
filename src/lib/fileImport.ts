/**
 * Parser pliku CSV / Excel dla importu klientów.
 *
 * Realne pułapki polskich Excelów które tu obsługujemy:
 *  - polski Excel domyślnie używa średnika `;` jako separatora CSV
 *    (bo przecinek jest separatorem dziesiętnym), więc autodetekcja
 *    musi sprawdzać oba (plus tab dla TSV)
 *  - polski Excel zapisuje CSV w Windows-1250 chyba że user świadomie
 *    wybierze "CSV UTF-8". Jeśli dekodowanie UTF-8 produkuje znaki
 *    zastępcze (U+FFFD) – fallbackujemy na windows-1250.
 *  - xlsx parsujemy przez SheetJS (lazy-loaded, żeby nie wozić ~600 KB
 *    w głównym bundle).
 */

export interface ParsedFile {
  /** Nagłówki w kolejności występowania w pliku. */
  headers: string[];
  /** Wiersze jako mapa { nagłówek -> wartość }. Wartości są zawsze stringami. */
  rows: Record<string, string>[];
  /** Format który udało się rozpoznać. */
  format: "csv" | "xlsx";
}

export class ImportFileError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | "empty"
      | "no_headers"
      | "no_rows"
      | "unsupported_format"
      | "parse_failed",
  ) {
    super(message);
    this.name = "ImportFileError";
  }
}

/** Maksymalny rozmiar pliku - 10 MB. Powyżej i tak localStorage by puknął. */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

const CSV_EXTENSIONS = ["csv", "tsv", "txt"];
const XLSX_EXTENSIONS = ["xlsx", "xls", "xlsm"];

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "";
  return name.slice(dot + 1).toLowerCase();
}

/** Główny entry-point: rozpoznaje format po rozszerzeniu i parsuje. */
export async function parseImportFile(file: File): Promise<ParsedFile> {
  if (file.size === 0) {
    throw new ImportFileError("Plik jest pusty", "empty");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new ImportFileError(
      `Plik większy niż ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB`,
      "parse_failed",
    );
  }

  const ext = getExtension(file.name);

  if (XLSX_EXTENSIONS.includes(ext)) {
    return parseXlsxFile(file);
  }
  if (CSV_EXTENSIONS.includes(ext)) {
    return parseCsvFile(file);
  }

  // Fallback – spróbuj wykryć po MIME type albo zawartości.
  if (
    file.type.includes("spreadsheetml") ||
    file.type === "application/vnd.ms-excel"
  ) {
    return parseXlsxFile(file);
  }
  if (file.type === "text/csv" || file.type.startsWith("text/")) {
    return parseCsvFile(file);
  }

  throw new ImportFileError(
    `Nieobsługiwany format pliku: .${ext || "?"}`,
    "unsupported_format",
  );
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Wykryj kodowanie i zdekoduj bajty. Eksportowane do testów. */
export function decodeCsvBytes(bytes: Uint8Array): string {
  // BOM UTF-8: EF BB BF
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }

  // Spróbuj UTF-8 z fatal: jeśli się wywali na nieprawidłowych bajtach,
  // fallback na windows-1250 (typowy polski Excel CSV).
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder("windows-1250").decode(bytes);
    } catch {
      // Niektóre środowiska testowe (jsdom < 25?) nie znają windows-1250.
      // Wtedy dekodujemy UTF-8 nie-fatalnie (z �) – nie idealne, ale lepsze
      // niż wywalenie się.
      return new TextDecoder("utf-8").decode(bytes);
    }
  }
}

/** Wykryj separator CSV w pierwszej (nie-pustej) linii. */
export function detectSeparator(text: string): "," | ";" | "\t" {
  // Bierzemy pierwszą "rozsądną" linię — ignorujemy puste i komentarze,
  // i nie liczymy separatorów które są wewnątrz cudzysłowów.
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";

  const counts = countOutsideQuotes(firstLine);

  // Najczęstszy wygrywa. Remis → priorytet ; (polski Excel) > , > tab.
  const ranked: Array<["," | ";" | "\t", number]> = [
    [";", counts.semi],
    [",", counts.comma],
    ["\t", counts.tab],
  ];
  ranked.sort((a, b) => b[1] - a[1]);
  return ranked[0][1] > 0 ? ranked[0][0] : ",";
}

function countOutsideQuotes(line: string): {
  comma: number;
  semi: number;
  tab: number;
} {
  let comma = 0;
  let semi = 0;
  let tab = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Podwojony "" = escaped, nie zmienia stanu
      if (inQuotes && line[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === ",") comma++;
    else if (ch === ";") semi++;
    else if (ch === "\t") tab++;
  }
  return { comma, semi, tab };
}

/**
 * Parser CSV: obsługuje cudzysłowy, escaped "", \r\n / \n, custom separator.
 * Eksportowany do testów.
 */
export function parseCsvText(
  text: string,
  separator: "," | ";" | "\t",
): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  // Ucinamy ewentualny BOM jeśli przeszedł
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      // Cudzysłów otwierający — tylko jeśli pole jest puste, w przeciwnym
      // razie traktujemy jak zwykły znak (defensive: niektóre Excele lubią
      // wstawiać " w środku tekstu).
      if (field.length === 0) {
        inQuotes = true;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === separator) {
      row.push(field);
      field = "";
      i++;
      continue;
    }

    if (ch === "\r") {
      // Pomijamy — \r\n potraktujemy przy \n
      i++;
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      field = "";
      // Pomiń puste linie
      if (row.length > 1 || (row.length === 1 && row[0].length > 0)) {
        rows.push(row);
      }
      row = [];
      i++;
      continue;
    }

    field += ch;
    i++;
  }

  // Ostatnie pole / wiersz (gdy plik nie kończy się \n)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.length > 1 || (row.length === 1 && row[0].length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

async function parseCsvFile(file: File): Promise<ParsedFile> {
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (err) {
    throw new ImportFileError(
      `Nie udało się odczytać pliku: ${(err as Error).message}`,
      "parse_failed",
    );
  }
  const bytes = new Uint8Array(buffer);
  const text = decodeCsvBytes(bytes);

  const separator = detectSeparator(text);
  const rows2d = parseCsvText(text, separator);

  return finalize(rows2d, "csv");
}

// ---------------------------------------------------------------------------
// XLSX (lazy)
// ---------------------------------------------------------------------------

async function parseXlsxFile(file: File): Promise<ParsedFile> {
  let xlsx: typeof import("xlsx");
  try {
    xlsx = await import("xlsx");
  } catch (err) {
    throw new ImportFileError(
      `Nie udało się załadować parsera Excela: ${(err as Error).message}`,
      "parse_failed",
    );
  }

  let workbook: import("xlsx").WorkBook;
  try {
    const buffer = await file.arrayBuffer();
    workbook = xlsx.read(buffer, { type: "array", cellDates: true });
  } catch (err) {
    throw new ImportFileError(
      `Nie udało się odczytać Excela: ${(err as Error).message}`,
      "parse_failed",
    );
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new ImportFileError("Plik Excela nie zawiera arkuszy", "empty");
  }
  const sheet = workbook.Sheets[firstSheetName];

  // Bierzemy 2D macierz, defval: '' żeby puste komórki były zachowane
  const rows2d = xlsx.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false, // żeby daty były sformatowane jako stringi
    blankrows: false,
  });

  // Normalizuj — wszystko na string, trimuj
  const normalized = rows2d.map((r) =>
    Array.isArray(r) ? r.map((cell) => String(cell ?? "").trim()) : [],
  );

  return finalize(normalized, "xlsx");
}

// ---------------------------------------------------------------------------
// Wspólne
// ---------------------------------------------------------------------------

function finalize(
  rows2d: string[][],
  format: "csv" | "xlsx",
): ParsedFile {
  // Pomiń wiodące puste linie
  while (rows2d.length > 0 && rows2d[0].every((c) => !c.trim())) {
    rows2d.shift();
  }

  if (rows2d.length === 0) {
    throw new ImportFileError("Plik jest pusty", "empty");
  }

  const headerRow = rows2d[0].map((h) => h.trim());

  // Nagłówki nie mogą być wszystkie puste
  if (headerRow.every((h) => !h)) {
    throw new ImportFileError("Brak nagłówków w pierwszym wierszu", "no_headers");
  }

  // Uzupełnij/deduplicate puste i powtarzające się nagłówki, żeby map klucz->wartość
  // nie nadpisywała się
  const seen = new Map<string, number>();
  const headers: string[] = headerRow.map((raw, idx) => {
    const base = raw || `Kolumna ${idx + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });

  const rows: Record<string, string>[] = [];
  for (let r = 1; r < rows2d.length; r++) {
    const cells = rows2d[r];
    if (!cells || cells.every((c) => !c.trim())) continue; // pomiń puste wiersze
    const obj: Record<string, string> = {};
    let hasAnyValue = false;
    for (let c = 0; c < headers.length; c++) {
      const value = (cells[c] ?? "").trim();
      obj[headers[c]] = value;
      if (value) hasAnyValue = true;
    }
    if (hasAnyValue) rows.push(obj);
  }

  if (rows.length === 0) {
    throw new ImportFileError(
      "Plik nie zawiera żadnych wierszy z danymi",
      "no_rows",
    );
  }

  return { headers, rows, format };
}
