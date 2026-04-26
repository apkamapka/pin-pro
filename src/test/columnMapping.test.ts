import { describe, it, expect } from "vitest";
import {
  autoMapColumns,
  matchHeaderToField,
  normalizeHeader,
  validateMapping,
} from "@/lib/columnMapping";

// ---------------------------------------------------------------------------
// normalizeHeader
// ---------------------------------------------------------------------------
describe("normalizeHeader", () => {
  it("lowercases", () => {
    expect(normalizeHeader("ADRES")).toBe("adres");
  });

  it("strips diacritics (Polish)", () => {
    // ą → a, ć → c, ż → z, ó → o, ś → s
    expect(normalizeHeader("Imię")).toBe("imie");
    expect(normalizeHeader("Adres pocztowy")).toBe("adrespocztowy");
  });

  it("handles ł → l", () => {
    expect(normalizeHeader("Łódź")).toBe("lodz");
  });

  it("strips spaces, dots, dashes, slashes", () => {
    expect(normalizeHeader("Numer-telefonu")).toBe("numertelefonu");
    expect(normalizeHeader("E-mail")).toBe("email");
    expect(normalizeHeader("kod / pocztowy")).toBe("kodpocztowy");
  });

  it("preserves digits", () => {
    expect(normalizeHeader("telefon2")).toBe("telefon2");
  });

  it("returns empty string for empty/whitespace input", () => {
    expect(normalizeHeader("")).toBe("");
    expect(normalizeHeader("   ")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// matchHeaderToField - Polish patterns
// ---------------------------------------------------------------------------
describe("matchHeaderToField - Polish patterns", () => {
  it("matches 'Imię i nazwisko' → name", () => {
    expect(matchHeaderToField("Imię i nazwisko")).toBe("name");
  });

  it("matches 'Nazwa klienta' → name", () => {
    expect(matchHeaderToField("Nazwa klienta")).toBe("name");
  });

  it("matches 'Imię' alone → firstName", () => {
    expect(matchHeaderToField("Imię")).toBe("firstName");
  });

  it("matches 'Nazwisko' → lastName", () => {
    expect(matchHeaderToField("Nazwisko")).toBe("lastName");
  });

  it("matches 'Adres' → address", () => {
    expect(matchHeaderToField("Adres")).toBe("address");
  });

  it("matches 'Adres pocztowy' → address", () => {
    expect(matchHeaderToField("Adres pocztowy")).toBe("address");
  });

  it("matches 'Ulica' → street", () => {
    expect(matchHeaderToField("Ulica")).toBe("street");
  });

  it("matches 'Miasto' → city", () => {
    expect(matchHeaderToField("Miasto")).toBe("city");
  });

  it("matches 'Miejscowość' → city", () => {
    expect(matchHeaderToField("Miejscowość")).toBe("city");
  });

  it("matches 'Kod pocztowy' → postalCode", () => {
    expect(matchHeaderToField("Kod pocztowy")).toBe("postalCode");
  });

  it("matches 'Telefon' → phone", () => {
    expect(matchHeaderToField("Telefon")).toBe("phone");
  });

  it("matches 'Tel.' → phone", () => {
    expect(matchHeaderToField("Tel.")).toBe("phone");
  });

  it("matches 'Numer telefonu' → phone", () => {
    expect(matchHeaderToField("Numer telefonu")).toBe("phone");
  });

  it("matches 'Telefon dodatkowy' → phone2", () => {
    expect(matchHeaderToField("Telefon dodatkowy")).toBe("phone2");
  });

  it("matches 'E-mail' → email", () => {
    expect(matchHeaderToField("E-mail")).toBe("email");
  });

  it("matches 'Adres e-mail' → email (NOT address)", () => {
    expect(matchHeaderToField("Adres e-mail")).toBe("email");
  });

  it("matches 'Strona WWW' → website", () => {
    expect(matchHeaderToField("Strona WWW")).toBe("website");
  });

  it("matches 'Uwagi' → notes", () => {
    expect(matchHeaderToField("Uwagi")).toBe("notes");
  });

  it("matches 'Notatki' → notes", () => {
    expect(matchHeaderToField("Notatki")).toBe("notes");
  });

  it("matches 'Firma' → company", () => {
    expect(matchHeaderToField("Firma")).toBe("company");
  });

  it("matches 'NIP' → company", () => {
    // NIP is company-related, lumped into company group
    expect(matchHeaderToField("NIP")).toBe("company");
  });

  it("matches 'Data ostatniej wizyty' → lastVisit", () => {
    expect(matchHeaderToField("Data ostatniej wizyty")).toBe("lastVisit");
  });

  it("matches 'Termin' → nextAppointment", () => {
    expect(matchHeaderToField("Termin")).toBe("nextAppointment");
  });

  it("matches 'Następna wizyta' → nextAppointment", () => {
    expect(matchHeaderToField("Następna wizyta")).toBe("nextAppointment");
  });

  it("returns null for unrecognized headers", () => {
    expect(matchHeaderToField("Dziwna kolumna XYZ")).toBeNull();
    expect(matchHeaderToField("Coś czego nie znamy")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// matchHeaderToField - English patterns
// ---------------------------------------------------------------------------
describe("matchHeaderToField - English patterns", () => {
  it("matches 'Full Name' → name", () => {
    expect(matchHeaderToField("Full Name")).toBe("name");
  });

  it("matches 'Address' → address", () => {
    expect(matchHeaderToField("Address")).toBe("address");
  });

  it("matches 'Phone Number' → phone", () => {
    expect(matchHeaderToField("Phone Number")).toBe("phone");
  });

  it("matches 'Email' → email", () => {
    expect(matchHeaderToField("Email")).toBe("email");
  });

  it("matches 'ZIP' → postalCode", () => {
    expect(matchHeaderToField("ZIP")).toBe("postalCode");
  });
});

// ---------------------------------------------------------------------------
// autoMapColumns - integration
// ---------------------------------------------------------------------------
describe("autoMapColumns", () => {
  it("maps a typical Polish customer Excel", () => {
    const headers = [
      "Imię i nazwisko",
      "Adres",
      "Telefon",
      "E-mail",
      "Uwagi",
    ];
    const { mapping, unmapped } = autoMapColumns(headers);
    expect(mapping.name).toBe("Imię i nazwisko");
    expect(mapping.address).toBe("Adres");
    expect(mapping.phone).toBe("Telefon");
    expect(mapping.email).toBe("E-mail");
    expect(mapping.notes).toBe("Uwagi");
    expect(unmapped).toEqual([]);
  });

  it("collects unrecognized headers into unmapped[]", () => {
    const headers = ["Imię", "Adres", "Numer kontraktu", "PESEL"];
    const { mapping, unmapped } = autoMapColumns(headers);
    expect(mapping.firstName).toBe("Imię");
    expect(mapping.address).toBe("Adres");
    expect(unmapped).toEqual(["Numer kontraktu", "PESEL"]);
  });

  it("first match wins when multiple headers map to same field", () => {
    const headers = ["Telefon", "Tel"];
    const { mapping, unmapped } = autoMapColumns(headers);
    expect(mapping.phone).toBe("Telefon");
    expect(unmapped).toEqual(["Tel"]);
  });

  it("does NOT confuse 'Adres email' with address", () => {
    const headers = ["Adres", "Adres email"];
    const { mapping } = autoMapColumns(headers);
    expect(mapping.address).toBe("Adres");
    expect(mapping.email).toBe("Adres email");
  });

  it("handles empty array", () => {
    const { mapping, unmapped } = autoMapColumns([]);
    expect(mapping).toEqual({});
    expect(unmapped).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateMapping
// ---------------------------------------------------------------------------
describe("validateMapping", () => {
  it("requires name and address", () => {
    expect(validateMapping({}).ok).toBe(false);
    expect(validateMapping({}).problems).toEqual(["no_name", "no_address"]);
  });

  it("accepts name + address", () => {
    expect(
      validateMapping({ name: "Imię", address: "Adres" }).ok,
    ).toBe(true);
  });

  it("accepts firstName/lastName instead of name", () => {
    expect(
      validateMapping({
        firstName: "Imię",
        lastName: "Nazwisko",
        address: "Adres",
      }).ok,
    ).toBe(true);
  });

  it("accepts company as name proxy", () => {
    expect(
      validateMapping({ company: "Firma", address: "Adres" }).ok,
    ).toBe(true);
  });

  it("accepts city as address proxy", () => {
    expect(
      validateMapping({ name: "Imię", city: "Miasto" }).ok,
    ).toBe(true);
  });

  it("flags missing name only", () => {
    const r = validateMapping({ address: "Adres" });
    expect(r.problems).toEqual(["no_name"]);
  });

  it("flags missing address only", () => {
    const r = validateMapping({ name: "Imię" });
    expect(r.problems).toEqual(["no_address"]);
  });
});
