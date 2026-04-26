import { describe, it, expect } from "vitest";
import {
  parsePolishAddress,
  simplifyHouseNumber,
  stripStreetPrefix,
} from "@/lib/addressNormalize";

// ---------------------------------------------------------------------------
// stripStreetPrefix
// ---------------------------------------------------------------------------
describe("stripStreetPrefix", () => {
  it("strips 'ul.'", () => {
    expect(stripStreetPrefix("ul. Słoneczna 10")).toBe("Słoneczna 10");
  });

  it("strips 'Ul.' (capitalized)", () => {
    expect(stripStreetPrefix("Ul. Słoneczna 10")).toBe("Słoneczna 10");
  });

  it("strips 'al.'", () => {
    expect(stripStreetPrefix("al. Jana Pawła II 5")).toBe("Jana Pawła II 5");
  });

  it("strips 'Aleja'", () => {
    expect(stripStreetPrefix("Aleja Niepodległości 1")).toBe(
      "Niepodległości 1",
    );
  });

  it("strips 'pl.'", () => {
    expect(stripStreetPrefix("pl. Bankowy 2")).toBe("Bankowy 2");
  });

  it("strips 'os.'", () => {
    expect(stripStreetPrefix("os. Niepodległości 5")).toBe("Niepodległości 5");
  });

  it("returns input unchanged when no prefix", () => {
    expect(stripStreetPrefix("Słoneczna 10")).toBe("Słoneczna 10");
  });
});

// ---------------------------------------------------------------------------
// simplifyHouseNumber
// ---------------------------------------------------------------------------
describe("simplifyHouseNumber", () => {
  it("keeps simple number", () => {
    expect(simplifyHouseNumber("10")).toBe("10");
  });

  it("keeps number with letter", () => {
    expect(simplifyHouseNumber("10a")).toBe("10a");
    expect(simplifyHouseNumber("12B")).toBe("12B");
  });

  it("strips slash-separated apartment indicators", () => {
    expect(simplifyHouseNumber("12/I/4")).toBe("12");
    expect(simplifyHouseNumber("12/4")).toBe("12");
  });

  it("strips m./m apartment", () => {
    expect(simplifyHouseNumber("12 m.4")).toBe("12");
    expect(simplifyHouseNumber("12 m 4")).toBe("12");
  });

  it("preserves house letter when present with apartment", () => {
    expect(simplifyHouseNumber("10a/2")).toBe("10a");
  });
});

// ---------------------------------------------------------------------------
// parsePolishAddress — real cases from user data
// ---------------------------------------------------------------------------
describe("parsePolishAddress - real user cases", () => {
  it("parses 'ul. słoneczna 10a 33-383 Tylicz'", () => {
    const r = parsePolishAddress("ul. słoneczna 10a 33-383 Tylicz");
    expect(r.streetName).toBe("Słoneczna");
    expect(r.houseNumber).toBe("10a");
    expect(r.street).toBe("Słoneczna 10a");
    expect(r.postalCode).toBe("33-383");
    expect(r.city).toBe("Tylicz");
    expect(r.cleaned).toBe("Słoneczna 10a, 33-383 Tylicz");
  });

  it("parses 'ul. mikulczycka 12/I/4 42-675' (no city, slash apartment)", () => {
    const r = parsePolishAddress("ul. mikulczycka 12/I/4 42-675");
    expect(r.streetName).toBe("Mikulczycka");
    expect(r.houseNumber).toBe("12");
    expect(r.street).toBe("Mikulczycka 12");
    expect(r.postalCode).toBe("42-675");
    expect(r.city).toBeUndefined();
  });

  it("parses 'Marszałkowska 1, Warszawa' (comma separator, no postal)", () => {
    const r = parsePolishAddress("Marszałkowska 1, Warszawa");
    expect(r.streetName).toBe("Marszałkowska");
    expect(r.houseNumber).toBe("1");
    expect(r.city).toBe("Warszawa");
    expect(r.postalCode).toBeUndefined();
  });

  it("parses postal code without dash '00100 Warszawa'", () => {
    const r = parsePolishAddress("Marszałkowska 1 00100 Warszawa");
    expect(r.postalCode).toBe("00-100"); // normalized to dash form
    expect(r.city).toBe("Warszawa");
  });

  it("parses Aleja prefix", () => {
    const r = parsePolishAddress(
      "Aleja Jana Pawła II 5, 00-001 Warszawa",
    );
    expect(r.streetName).toBe("Jana Pawła II");
    expect(r.houseNumber).toBe("5");
    expect(r.city).toBe("Warszawa");
  });

  it("handles ALL CAPS input", () => {
    const r = parsePolishAddress("UL. SŁONECZNA 10, 00-001 WARSZAWA");
    // Powinien zachować case (smart capitalize tylko jak wszystko małe)
    expect(r.streetName).toBe("SŁONECZNA");
    expect(r.city).toBe("WARSZAWA");
  });

  it("capitalizes lowercase city", () => {
    const r = parsePolishAddress("ul. słoneczna 10, 00-001 warszawa");
    expect(r.city).toBe("Warszawa");
    expect(r.streetName).toBe("Słoneczna");
  });

  it("handles only city + postal (no street)", () => {
    const r = parsePolishAddress("33-383 Tylicz");
    expect(r.postalCode).toBe("33-383");
    expect(r.city).toBe("Tylicz");
    expect(r.streetName).toBe("");
  });

  it("handles extra whitespace", () => {
    const r = parsePolishAddress("  ul.   Słoneczna   10   ,   33-383   Tylicz  ");
    expect(r.streetName).toBe("Słoneczna");
    expect(r.houseNumber).toBe("10");
    expect(r.postalCode).toBe("33-383");
    expect(r.city).toBe("Tylicz");
  });

  it("preserves multi-word street names", () => {
    const r = parsePolishAddress("ul. Jana Pawła II 5, 00-001 Warszawa");
    expect(r.streetName).toBe("Jana Pawła II");
    expect(r.houseNumber).toBe("5");
  });
});

describe("parsePolishAddress - cleaned output for fallback query", () => {
  it("produces clean Nominatim-ready string", () => {
    const r = parsePolishAddress("ul. słoneczna 10a 33-383 Tylicz");
    expect(r.cleaned).toBe("Słoneczna 10a, 33-383 Tylicz");
  });

  it("produces clean output for missing city", () => {
    const r = parsePolishAddress("ul. mikulczycka 12/I/4 42-675");
    expect(r.cleaned).toBe("Mikulczycka 12, 42-675");
  });

  it("preserves raw input verbatim", () => {
    const raw = "  ul.  słoneczna 10a  33-383 Tylicz  ";
    const r = parsePolishAddress(raw);
    expect(r.raw).toBe(raw);
  });
});
