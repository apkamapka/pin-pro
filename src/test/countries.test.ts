import { describe, it, expect } from "vitest";
import { detectCountry, getCountry } from "@/lib/countries";

// ---------------------------------------------------------------------------
// detectCountry — by name in address text
// ---------------------------------------------------------------------------
describe("detectCountry - by country name in text", () => {
  it("detects Poland from 'Polska'", () => {
    const r = detectCountry("ul. Słoneczna 10, 33-383 Tylicz, Polska");
    expect(r.code).toBe("pl");
    expect(r.confidence).toBe("high");
    // Może być wykryty po nazwie ALBO po wzorcu kodu PL — oba "high"
    expect(["name", "postal"]).toContain(r.reason);
  });

  it("detects Germany from 'Germany'", () => {
    const r = detectCountry("Berliner Str. 5, 10115 Berlin, Germany");
    expect(r.code).toBe("de");
    expect(r.reason).toBe("name");
  });

  it("detects Germany from 'Deutschland'", () => {
    const r = detectCountry("Berliner Str. 5, 10115 Berlin, Deutschland");
    expect(r.code).toBe("de");
  });

  it("detects UK from 'United Kingdom'", () => {
    const r = detectCountry("221B Baker Street, London, United Kingdom");
    expect(r.code).toBe("gb");
  });

  it("detects UK from 'UK'", () => {
    const r = detectCountry("221B Baker Street, London UK");
    expect(r.code).toBe("gb");
  });

  it("detects France", () => {
    const r = detectCountry("10 Rue de la Paix, 75002 Paris, France");
    expect(r.code).toBe("fr");
    expect(r.reason).toBe("name");
  });

  it("detects Italy from 'Italia'", () => {
    const r = detectCountry("Via Roma 1, 00100 Roma, Italia");
    expect(r.code).toBe("it");
  });

  it("detects Czech Republic from 'Česko'", () => {
    const r = detectCountry("Václavské nám. 1, 110 00 Praha, Česko");
    expect(r.code).toBe("cz");
  });

  it("detects USA", () => {
    const r = detectCountry("1600 Pennsylvania Ave, Washington DC, USA");
    expect(r.code).toBe("us");
  });

  it("does not match country name as substring (no false positive)", () => {
    // "post" should NOT match "PL" or anything; "Polish post office" should still match Poland (PL)
    // ale "Krapostowice" nie powinno matchować "post"
    const r = detectCountry("Krapostowice 1");
    expect(r.code).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// detectCountry — by postal code pattern
// ---------------------------------------------------------------------------
describe("detectCountry - by postal pattern (no country name)", () => {
  it("detects Poland from XX-XXX postal code", () => {
    const r = detectCountry("Słoneczna 10, 33-383 Tylicz");
    expect(r.code).toBe("pl");
    expect(r.reason).toBe("postal");
  });

  it("detects UK from postcode SW1A 1AA", () => {
    const r = detectCountry("10 Downing Street, London SW1A 1AA");
    expect(r.code).toBe("gb");
    expect(r.reason).toBe("postal");
  });

  it("detects Netherlands from 1011 AB pattern", () => {
    const r = detectCountry("Damrak 1, 1011 AB Amsterdam");
    expect(r.code).toBe("nl");
    expect(r.reason).toBe("postal");
  });

  it("detects Canada from M5V 3A8 pattern", () => {
    const r = detectCountry("301 Front St W, Toronto, ON M5V 3A8");
    expect(r.code).toBe("ca");
    expect(r.reason).toBe("postal");
  });

  it("detects Japan from 100-0001 pattern", () => {
    const r = detectCountry("Chiyoda 1-1-1, 100-0001 Tokyo");
    expect(r.code).toBe("jp");
    expect(r.reason).toBe("postal");
  });

  it("detects Brazil from XXXXX-XXX (5-3 digits)", () => {
    const r = detectCountry("Av. Paulista 1000, 01310-100 São Paulo");
    expect(r.code).toBe("br");
  });

  it("detects Portugal from XXXX-XXX (4-3 digits)", () => {
    const r = detectCountry("Rua Augusta 1, 1100-053 Lisboa");
    expect(r.code).toBe("pt");
  });

  it("returns null for ambiguous 5-digit postcode (no country name)", () => {
    // "10115 Berlin" has no country name; 10115 fits DE/FR/IT/ES/US.
    // Without a name, we can't tell — should return null and let
    // defaultCountry kick in.
    const r = detectCountry("Some Street 5, 10115 Berlin");
    expect(r.code).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// detectCountry — edge cases
// ---------------------------------------------------------------------------
describe("detectCountry - edge cases", () => {
  it("returns null for empty input", () => {
    const r = detectCountry("");
    expect(r.code).toBeNull();
    expect(r.confidence).toBe("none");
  });

  it("returns null for nothing recognizable", () => {
    const r = detectCountry("xyz qwerty 12345abc");
    expect(r.code).toBeNull();
  });

  it("prioritizes country name over postal pattern when both present", () => {
    // PL postal "33-383" + "Germany" name → name wins (because we check name first)
    // i.e. user explicitly said Germany even though there's a PL-looking code.
    // (rare/wrong case, but tests our deterministic behavior)
    const r = detectCountry("Some Street 1, 33-383 Test, Germany");
    expect(r.code).toBe("de");
    expect(r.reason).toBe("name");
  });

  it("handles Polish diacritics in country names (Słowacja, Niemcy)", () => {
    expect(detectCountry("Bratislavská 1, Słowacja").code).toBe("sk");
    expect(detectCountry("Berliner 5, Niemcy").code).toBe("de");
  });
});

// ---------------------------------------------------------------------------
// getCountry helper
// ---------------------------------------------------------------------------
describe("getCountry", () => {
  it("finds country by lowercase code", () => {
    const c = getCountry("pl");
    expect(c?.code).toBe("pl");
    expect(c?.namePl).toBe("Polska");
    expect(c?.nameEn).toBe("Poland");
  });

  it("finds country by uppercase code (case insensitive)", () => {
    expect(getCountry("PL")?.code).toBe("pl");
  });

  it("returns undefined for unknown code", () => {
    expect(getCountry("xyz")).toBeUndefined();
  });
});
