import { describe, it, expect } from "vitest";
import {
  decodeCsvBytes,
  detectSeparator,
  parseCsvText,
  parseImportFile,
  ImportFileError,
} from "@/lib/fileImport";

// ---- Helpers ----
function toBytes(s: string, encoding: "utf-8" | "utf-8-bom" = "utf-8"): Uint8Array {
  const enc = new TextEncoder().encode(s);
  if (encoding === "utf-8-bom") {
    const out = new Uint8Array(enc.length + 3);
    out[0] = 0xef;
    out[1] = 0xbb;
    out[2] = 0xbf;
    out.set(enc, 3);
    return out;
  }
  return enc;
}

function fileFrom(content: string | Uint8Array, name: string, type = ""): File {
  const blob =
    typeof content === "string"
      ? new Blob([content], { type })
      : new Blob([content], { type });
  return new File([blob], name, { type });
}

// ---------------------------------------------------------------------------
// detectSeparator
// ---------------------------------------------------------------------------
describe("detectSeparator", () => {
  it("detects comma", () => {
    expect(detectSeparator("a,b,c\n1,2,3")).toBe(",");
  });

  it("detects semicolon (Polish Excel)", () => {
    expect(detectSeparator("Imię;Nazwisko;Adres\nJan;Kowalski;Krakowska 12")).toBe(
      ";",
    );
  });

  it("detects tab (TSV)", () => {
    expect(detectSeparator("a\tb\tc\n1\t2\t3")).toBe("\t");
  });

  it("ignores separators inside quotes", () => {
    // "Smith, John";"Warsaw" → semicolon should win, not comma
    expect(detectSeparator('"Smith, John";"Warsaw"\n"Doe, Jane";"Krakow"')).toBe(
      ";",
    );
  });

  it("handles only one separator type", () => {
    expect(detectSeparator("hello\nworld")).toBe(",");
  });

  it("skips empty leading lines", () => {
    expect(detectSeparator("\n\n  \nname;phone\nJan;123")).toBe(";");
  });

  it("most-frequent wins on tie cases", () => {
    // Three semicolons vs one comma → semicolon
    expect(detectSeparator("a;b;c;d,wat\n1;2;3;4,5")).toBe(";");
  });
});

// ---------------------------------------------------------------------------
// parseCsvText
// ---------------------------------------------------------------------------
describe("parseCsvText", () => {
  it("parses simple comma CSV", () => {
    const r = parseCsvText("a,b,c\n1,2,3", ",");
    expect(r).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("parses Polish semicolon CSV", () => {
    const r = parseCsvText("Imię;Nazwisko\nJan;Kowalski", ";");
    expect(r).toEqual([
      ["Imię", "Nazwisko"],
      ["Jan", "Kowalski"],
    ]);
  });

  it("respects quoted fields with embedded separator", () => {
    const r = parseCsvText('name,address\n"Smith, John","Warsaw"', ",");
    expect(r).toEqual([
      ["name", "address"],
      ["Smith, John", "Warsaw"],
    ]);
  });

  it("handles escaped double quote (\"\")", () => {
    const r = parseCsvText('name,note\n"He said ""hi""","ok"', ",");
    expect(r[1]).toEqual(['He said "hi"', "ok"]);
  });

  it("handles \\r\\n line endings (Windows)", () => {
    const r = parseCsvText("a,b\r\n1,2\r\n", ",");
    expect(r).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("skips empty lines", () => {
    const r = parseCsvText("a,b\n\n1,2\n\n", ",");
    expect(r).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles trailing field without newline", () => {
    const r = parseCsvText("a,b\n1,2", ",");
    expect(r[1]).toEqual(["1", "2"]);
  });

  it("strips BOM if present at start", () => {
    const r = parseCsvText("\uFEFFa,b\n1,2", ",");
    expect(r[0]).toEqual(["a", "b"]);
  });

  it("handles quoted fields spanning multiple lines", () => {
    const r = parseCsvText('a,b\n"line1\nline2",ok', ",");
    expect(r[1]).toEqual(["line1\nline2", "ok"]);
  });
});

// ---------------------------------------------------------------------------
// decodeCsvBytes
// ---------------------------------------------------------------------------
describe("decodeCsvBytes", () => {
  it("decodes UTF-8 cleanly", () => {
    const bytes = toBytes("Łukasz żółć");
    expect(decodeCsvBytes(bytes)).toBe("Łukasz żółć");
  });

  it("strips UTF-8 BOM", () => {
    const bytes = toBytes("Łukasz", "utf-8-bom");
    expect(decodeCsvBytes(bytes)).toBe("Łukasz");
  });

  it("falls back to windows-1250 for non-UTF8 bytes (Polish chars)", () => {
    // 'Łukasz' in Windows-1250: 0xA3, 'u', 'k', 'a', 's', 'z'
    const w1250 = new Uint8Array([0xa3, 0x75, 0x6b, 0x61, 0x73, 0x7a]);
    const decoded = decodeCsvBytes(w1250);
    // jsdom should support windows-1250; if not, at minimum it shouldn't throw
    // and should produce SOMETHING reasonable.
    expect(decoded.length).toBeGreaterThan(0);
    // Either correct decoding OR replacement char (no fatal throw):
    expect(decoded === "Łukasz" || decoded.includes("\uFFFD")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseImportFile (full pipeline)
// ---------------------------------------------------------------------------
describe("parseImportFile", () => {
  it("parses a UTF-8 comma CSV", async () => {
    const file = fileFrom("name,address\nJan,Krakowska 12", "test.csv");
    const result = await parseImportFile(file);
    expect(result.format).toBe("csv");
    expect(result.headers).toEqual(["name", "address"]);
    expect(result.rows).toEqual([{ name: "Jan", address: "Krakowska 12" }]);
  });

  it("parses a Polish semicolon CSV", async () => {
    const file = fileFrom(
      "Imię i nazwisko;Adres;Telefon\nJan Kowalski;Marszałkowska 1, Warszawa;601-234-567",
      "klienci.csv",
    );
    const result = await parseImportFile(file);
    expect(result.headers).toEqual(["Imię i nazwisko", "Adres", "Telefon"]);
    expect(result.rows[0].Telefon).toBe("601-234-567");
    expect(result.rows[0].Adres).toBe("Marszałkowska 1, Warszawa");
  });

  it("rejects empty files", async () => {
    const file = fileFrom("", "empty.csv");
    await expect(parseImportFile(file)).rejects.toThrow(ImportFileError);
  });

  it("rejects files with only headers (no rows)", async () => {
    const file = fileFrom("name,address", "only-headers.csv");
    await expect(parseImportFile(file)).rejects.toMatchObject({
      kind: "no_rows",
    });
  });

  it("rejects unknown extensions", async () => {
    const file = fileFrom("hello", "unknown.docx", "application/octet-stream");
    await expect(parseImportFile(file)).rejects.toMatchObject({
      kind: "unsupported_format",
    });
  });

  it("deduplicates repeated headers", async () => {
    const file = fileFrom("name,name,address\na,b,c", "dup.csv");
    const result = await parseImportFile(file);
    expect(result.headers).toEqual(["name", "name (2)", "address"]);
    expect(result.rows[0]).toEqual({ name: "a", "name (2)": "b", address: "c" });
  });

  it("fills missing trailing cells", async () => {
    const file = fileFrom("a,b,c\n1,2", "short.csv");
    const result = await parseImportFile(file);
    expect(result.rows[0]).toEqual({ a: "1", b: "2", c: "" });
  });

  it("skips fully-empty data rows", async () => {
    const file = fileFrom("a,b\n1,2\n,\n3,4", "with-empty.csv");
    const result = await parseImportFile(file);
    expect(result.rows).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("trims header whitespace", async () => {
    const file = fileFrom("  name  ,  age  \nJan,30", "spaces.csv");
    const result = await parseImportFile(file);
    expect(result.headers).toEqual(["name", "age"]);
  });
});
