import { describe, it, expect } from "vitest";
import {
  composeCandidates,
  looksLikePhone,
  parseImportDate,
  parseTags,
} from "@/lib/importCompose";

// ---------------------------------------------------------------------------
// parseImportDate
// ---------------------------------------------------------------------------
describe("parseImportDate", () => {
  it("parses ISO date", () => {
    const r = parseImportDate("2025-04-15");
    expect(r).toBeDefined();
    expect(new Date(r!).getFullYear()).toBe(2025);
  });

  it("parses Polish dd.MM.yyyy", () => {
    const r = parseImportDate("15.04.2025");
    expect(r).toBeDefined();
    const d = new Date(r!);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(3); // April (0-indexed)
    expect(d.getDate()).toBe(15);
  });

  it("parses dd/MM/yyyy", () => {
    const r = parseImportDate("15/04/2025");
    expect(r).toBeDefined();
  });

  it("parses dd-MM-yyyy", () => {
    const r = parseImportDate("15-04-2025");
    expect(r).toBeDefined();
  });

  it("expands 2-digit years (00-49 → 2000s, 50-99 → 1900s)", () => {
    const r1 = parseImportDate("01.01.25");
    const r2 = parseImportDate("01.01.99");
    expect(new Date(r1!).getFullYear()).toBe(2025);
    expect(new Date(r2!).getFullYear()).toBe(1999);
  });

  it("returns undefined for empty/garbage", () => {
    expect(parseImportDate("")).toBeUndefined();
    expect(parseImportDate("  ")).toBeUndefined();
    expect(parseImportDate("nonsense")).toBeUndefined();
  });

  it("returns undefined for unreasonable years", () => {
    // Native Date might parse "0001-01-01" or "9999" — we filter those out
    expect(parseImportDate("01.01.1500")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseTags
// ---------------------------------------------------------------------------
describe("parseTags", () => {
  it("splits by comma", () => {
    expect(parseTags("VIP, urgent, customer")).toEqual([
      "VIP",
      "urgent",
      "customer",
    ]);
  });

  it("splits by semicolon", () => {
    expect(parseTags("VIP;urgent;klient")).toEqual([
      "VIP",
      "urgent",
      "klient",
    ]);
  });

  it("splits by pipe and slash", () => {
    expect(parseTags("a|b/c")).toEqual(["a", "b", "c"]);
  });

  it("trims whitespace and skips empty parts", () => {
    expect(parseTags(" foo ,  , bar ,, baz ")).toEqual(["foo", "bar", "baz"]);
  });

  it("returns empty array for empty input", () => {
    expect(parseTags("")).toEqual([]);
    expect(parseTags("   ")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// looksLikePhone
// ---------------------------------------------------------------------------
describe("looksLikePhone", () => {
  it("accepts valid phones", () => {
    expect(looksLikePhone("601-234-567")).toBe(true);
    expect(looksLikePhone("+48 601 234 567")).toBe(true);
    expect(looksLikePhone("(22) 123-45-67")).toBe(true);
  });

  it("rejects too short", () => {
    expect(looksLikePhone("123")).toBe(false);
  });

  it("rejects strings with letters", () => {
    expect(looksLikePhone("call me 601234")).toBe(false);
  });

  it("rejects empty", () => {
    expect(looksLikePhone("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// composeCandidates
// ---------------------------------------------------------------------------
describe("composeCandidates", () => {
  it("composes a basic candidate from full address", () => {
    const rows = [
      {
        "Imię i nazwisko": "Jan Kowalski",
        Adres: "Marszałkowska 1, Warszawa",
        Telefon: "601-234-567",
      },
    ];
    const mapping = {
      name: "Imię i nazwisko",
      address: "Adres",
      phone: "Telefon",
    };
    const result = composeCandidates(rows, mapping, { unmappedHeaders: [] });
    expect(result).toHaveLength(1);
    expect(result[0].valid).toBe(true);
    expect(result[0].name).toBe("Jan Kowalski");
    expect(result[0].address).toBe("Marszałkowska 1, Warszawa");
    // Telefon trafia do customFields jako pole typu "phone" — od v6
    // wszystkie pola kontaktowe są user-defined.
    const phoneField = result[0].customFields?.find((f) => f.type === "phone");
    expect(phoneField?.value).toBe("601-234-567");
    expect(result[0].rowId).toBe(0);
  });

  it("joins firstName + lastName when name is absent", () => {
    const rows = [
      { Imię: "Jan", Nazwisko: "Kowalski", Adres: "Krakowska 1" },
    ];
    const mapping = {
      firstName: "Imię",
      lastName: "Nazwisko",
      address: "Adres",
    };
    const result = composeCandidates(rows, mapping, { unmappedHeaders: [] });
    expect(result[0].name).toBe("Jan Kowalski");
  });

  it("joins street + postalCode + city when full address is absent", () => {
    const rows = [
      {
        Imię: "Jan",
        Ulica: "Marszałkowska 1",
        "Kod pocztowy": "00-100",
        Miasto: "Warszawa",
      },
    ];
    const mapping = {
      firstName: "Imię",
      street: "Ulica",
      postalCode: "Kod pocztowy",
      city: "Miasto",
    };
    const result = composeCandidates(rows, mapping, { unmappedHeaders: [] });
    expect(result[0].address).toBe("Marszałkowska 1, 00-100 Warszawa");
  });

  it("falls back to company as name when no other name source", () => {
    const rows = [{ Firma: "Nowak Sp. z o.o.", Adres: "Krakowska 1" }];
    const mapping = { company: "Firma", address: "Adres" };
    const result = composeCandidates(rows, mapping, { unmappedHeaders: [] });
    expect(result[0].name).toBe("Nowak Sp. z o.o.");
    // company użyte jako name → nie powinno być duplikowane w customFields
    const companyField = result[0].customFields?.find(
      (f) => f.label === "Firma",
    );
    expect(companyField).toBeUndefined();
  });

  it("keeps company field separately when name is different", () => {
    const rows = [
      { Imię: "Jan", Nazwisko: "Kowalski", Firma: "ACME", Adres: "x" },
    ];
    const mapping = {
      firstName: "Imię",
      lastName: "Nazwisko",
      company: "Firma",
      address: "Adres",
    };
    const result = composeCandidates(rows, mapping, { unmappedHeaders: [] });
    expect(result[0].name).toBe("Jan Kowalski");
    // Firma trafia do customFields jako pole text z labelem „Firma"
    const companyField = result[0].customFields?.find(
      (f) => f.label === "Firma",
    );
    expect(companyField?.value).toBe("ACME");
  });

  it("flags rows with missing name", () => {
    const rows = [{ Adres: "Krakowska 1" }];
    const mapping = { address: "Adres" };
    const result = composeCandidates(rows, mapping, { unmappedHeaders: [] });
    expect(result[0].valid).toBe(false);
    expect(result[0].missing).toContain("name");
  });

  it("flags rows with missing address", () => {
    const rows = [{ Imię: "Jan" }];
    const mapping = { firstName: "Imię" };
    const result = composeCandidates(rows, mapping, { unmappedHeaders: [] });
    expect(result[0].valid).toBe(false);
    expect(result[0].missing).toContain("address");
  });

  it("appends unmapped columns to notes", () => {
    const rows = [
      {
        Imię: "Jan",
        Adres: "Krakowska 1",
        PESEL: "12345678901",
        "Numer umowy": "UM-2024-001",
      },
    ];
    const mapping = { firstName: "Imię", address: "Adres" };
    const result = composeCandidates(rows, mapping, {
      unmappedHeaders: ["PESEL", "Numer umowy"],
    });
    expect(result[0].notes).toContain("PESEL: 12345678901");
    expect(result[0].notes).toContain("Numer umowy: UM-2024-001");
  });

  it("merges existing notes with unmapped extras", () => {
    const rows = [
      {
        Imię: "Jan",
        Adres: "Krakowska 1",
        Uwagi: "Klient stały",
        "Numer umowy": "UM-001",
      },
    ];
    const mapping = {
      firstName: "Imię",
      address: "Adres",
      notes: "Uwagi",
    };
    const result = composeCandidates(rows, mapping, {
      unmappedHeaders: ["Numer umowy"],
    });
    expect(result[0].notes).toContain("Klient stały");
    expect(result[0].notes).toContain("Numer umowy: UM-001");
  });

  it("parses tags correctly", () => {
    const rows = [{ Imię: "Jan", Adres: "x", Tagi: "VIP, pilne" }];
    const mapping = { firstName: "Imię", address: "Adres", tags: "Tagi" };
    const result = composeCandidates(rows, mapping, { unmappedHeaders: [] });
    expect(result[0].tags).toEqual(["VIP", "pilne"]);
  });

  it("preserves rowId across multiple rows", () => {
    const rows = [
      { Imię: "Jan", Adres: "x" },
      { Imię: "Anna", Adres: "y" },
      { Imię: "Bob", Adres: "z" },
    ];
    const mapping = { firstName: "Imię", address: "Adres" };
    const result = composeCandidates(rows, mapping, { unmappedHeaders: [] });
    expect(result.map((c) => c.rowId)).toEqual([0, 1, 2]);
  });

  it("does not crash on empty cells / missing columns", () => {
    const rows = [{ Imię: "", Adres: "" }];
    const mapping = { firstName: "Imię", address: "Adres" };
    const result = composeCandidates(rows, mapping, { unmappedHeaders: [] });
    expect(result[0].valid).toBe(false);
    expect(result[0].missing).toEqual(["name", "address"]);
  });

  it("parses dates from lastVisit / nextAppointment", () => {
    const rows = [
      {
        Imię: "Jan",
        Adres: "x",
        "Ostatnia wizyta": "15.04.2025",
        Termin: "30.04.2026",
      },
    ];
    const mapping = {
      firstName: "Imię",
      address: "Adres",
      lastVisit: "Ostatnia wizyta",
      nextAppointment: "Termin",
    };
    const result = composeCandidates(rows, mapping, { unmappedHeaders: [] });
    expect(result[0].lastVisit).toBeDefined();
    expect(result[0].nextAppointment).toBeDefined();
    expect(new Date(result[0].lastVisit!).getFullYear()).toBe(2025);
  });
});
