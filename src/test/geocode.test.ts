import { describe, it, expect, vi } from "vitest";
import { geocodeAddress } from "@/lib/geocode";

/** Helper: tworzy fake fetch który zwraca dane sukcesu albo pustą tablicę. */
function makeFetchMock(
  responder: (url: string) => unknown[] | "error",
): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const result = responder(url);
    if (result === "error") {
      return new Response("error", { status: 500 }) as Response;
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }) as Response;
  }) as unknown as typeof fetch;
}

const HIT = [
  {
    lat: "49.42",
    lon: "20.97",
    display_name: "Słoneczna 10a, 33-383 Tylicz, Polska",
  },
];

describe("geocodeAddress - country filter", () => {
  it("always sends countrycodes=pl on first try", async () => {
    let capturedUrl = "";
    const fetchMock = makeFetchMock((url) => {
      capturedUrl = url;
      return HIT;
    });

    const result = await geocodeAddress("ul. Słoneczna 10a 33-383 Tylicz", {
      fetchImpl: fetchMock,
      retryDelayMs: 0,
    });

    expect(result).not.toBeNull();
    expect(capturedUrl).toContain("countrycodes=pl");
  });

  it("sends accept-language=pl", async () => {
    let capturedUrl = "";
    const fetchMock = makeFetchMock((url) => {
      capturedUrl = url;
      return HIT;
    });

    await geocodeAddress("ul. Słoneczna 10", {
      fetchImpl: fetchMock,
      retryDelayMs: 0,
    });

    expect(capturedUrl).toContain("accept-language=pl");
  });
});

describe("geocodeAddress - structured first try", () => {
  it("uses structured query when address has street + postal + city", async () => {
    const calls: string[] = [];
    const fetchMock = makeFetchMock((url) => {
      calls.push(url);
      return HIT;
    });

    const result = await geocodeAddress("ul. Słoneczna 10a 33-383 Tylicz", {
      fetchImpl: fetchMock,
      retryDelayMs: 0,
    });

    expect(result).not.toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("street=");
    expect(calls[0]).toContain("postalcode=33-383");
    expect(calls[0]).toContain("city=Tylicz");
    // URLSearchParams uses '+' for spaces; normalize before checking
    const decoded = decodeURIComponent(calls[0]).replace(/\+/g, " ");
    expect(decoded).toContain("Słoneczna");
  });

  it("simplifies apartment number 12/I/4 → 12 in structured query", async () => {
    let capturedUrl = "";
    const fetchMock = makeFetchMock((url) => {
      capturedUrl = url;
      return HIT;
    });

    await geocodeAddress("ul. mikulczycka 12/I/4 42-675", {
      fetchImpl: fetchMock,
      retryDelayMs: 0,
    });

    // URLSearchParams uses '+' for spaces, decodeURIComponent doesn't convert them
    const decoded = decodeURIComponent(capturedUrl).replace(/\+/g, " ");
    expect(decoded).toContain("Mikulczycka 12");
    expect(decoded).not.toContain("12/I/4");
    expect(capturedUrl).toContain("postalcode=42-675");
  });
});

describe("geocodeAddress - free-form fallback", () => {
  it("falls back to free-form q= when structured returns empty", async () => {
    const calls: string[] = [];
    const fetchMock = makeFetchMock((url) => {
      calls.push(url);
      // Pierwszy (structured) → empty
      // Drugi (free-form) → hit
      return calls.length === 1 ? [] : HIT;
    });

    const result = await geocodeAddress("ul. Słoneczna 10a 33-383 Tylicz", {
      fetchImpl: fetchMock,
      retryDelayMs: 0,
    });

    expect(result).not.toBeNull();
    expect(calls).toHaveLength(2);
    // Drugi call powinien być free-form (q=) zamiast structured
    expect(calls[1]).toContain("q=");
    expect(calls[1]).not.toMatch(/[?&]street=/);
  });

  it("returns first try if it succeeded (no fallback)", async () => {
    const fetchMock = makeFetchMock(() => HIT);
    const spy = vi.fn(fetchMock);

    await geocodeAddress("ul. Słoneczna 10, 33-383 Tylicz", {
      fetchImpl: spy as typeof fetch,
      retryDelayMs: 0,
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("geocodeAddress - postal code only fallback", () => {
  it("falls back to postal-code-only on third try", async () => {
    const calls: string[] = [];
    const fetchMock = makeFetchMock((url) => {
      calls.push(url);
      // 1st: structured → empty
      // 2nd: free-form → empty
      // 3rd: postal-only → hit
      return calls.length < 3 ? [] : HIT;
    });

    const result = await geocodeAddress("ul. Mikulczycka 12 42-675", {
      fetchImpl: fetchMock,
      retryDelayMs: 0,
    });

    expect(result).not.toBeNull();
    expect(calls).toHaveLength(3);
    // 3rd call is postal-code only (no street parameter)
    expect(calls[2]).toContain("postalcode=42-675");
    expect(calls[2]).not.toMatch(/[?&]street=/);
  });

  it("does not attempt 3rd try if no postal code", async () => {
    const calls: string[] = [];
    const fetchMock = makeFetchMock((url) => {
      calls.push(url);
      return [];
    });

    const result = await geocodeAddress("Marszałkowska 1, Warszawa", {
      fetchImpl: fetchMock,
      retryDelayMs: 0,
    });

    expect(result).toBeNull();
    // Próby:
    //   1) structured z PL filter
    //   2) free-form z PL filter
    //   (3 — pomijamy, brak postal code)
    //   4) structured worldwide (bez countrycodes)
    //   5) free-form worldwide
    // = 4 calls (bez 3rd, ale z worldwide fallbackami)
    expect(calls).toHaveLength(4);
    // Trzeci call (czyli czwarta próba ogółem — structured worldwide)
    // nie powinien mieć countrycodes
    expect(calls[2]).not.toContain("countrycodes");
  });
});

describe("geocodeAddress - edge cases", () => {
  it("returns null for empty input", async () => {
    const fetchMock = makeFetchMock(() => HIT);
    const r = await geocodeAddress("", { fetchImpl: fetchMock });
    expect(r).toBeNull();
  });

  it("returns null when all tries return empty", async () => {
    const fetchMock = makeFetchMock(() => []);
    const r = await geocodeAddress("ul. Nieistniejąca 99 99-999 Nibyland", {
      fetchImpl: fetchMock,
      retryDelayMs: 0,
    });
    expect(r).toBeNull();
  });

  it("survives fetch errors and tries fallback", async () => {
    const calls: string[] = [];
    const fetchMock = makeFetchMock((url) => {
      calls.push(url);
      // 1st: 500 error, 2nd: hit
      return calls.length === 1 ? "error" : HIT;
    });

    const r = await geocodeAddress("ul. Słoneczna 10, 33-383 Tylicz", {
      fetchImpl: fetchMock,
      retryDelayMs: 0,
    });
    expect(r).not.toBeNull();
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it("handles malformed JSON response gracefully", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response("not json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const r = await geocodeAddress("test", {
      fetchImpl: fetchMock,
      retryDelayMs: 0,
    });
    expect(r).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Multi-country support
// ---------------------------------------------------------------------------
describe("geocodeAddress - multi-country", () => {
  it("uses detected country (DE) when address contains 'Germany'", async () => {
    let capturedUrl = "";
    const fetchMock = makeFetchMock((url) => {
      capturedUrl = url;
      return HIT;
    });
    await geocodeAddress("Berliner Str. 5, 10115 Berlin, Germany", {
      fetchImpl: fetchMock,
      retryDelayMs: 0,
      defaultCountry: "pl", // user has PL as default but address says Germany
    });
    expect(capturedUrl).toContain("countrycodes=de");
  });

  it("uses defaultCountry when address has no country signal", async () => {
    let capturedUrl = "";
    const fetchMock = makeFetchMock((url) => {
      capturedUrl = url;
      return HIT;
    });
    await geocodeAddress("Some Street 5, Anytown", {
      fetchImpl: fetchMock,
      retryDelayMs: 0,
      defaultCountry: "fr",
    });
    expect(capturedUrl).toContain("countrycodes=fr");
  });

  it("falls back to worldwide search when filtered tries fail", async () => {
    const calls: string[] = [];
    const fetchMock = makeFetchMock((url) => {
      calls.push(url);
      // First 2 (with country filter) fail.
      // 3rd / 4th (worldwide) succeed.
      // Order: structured-PL, freeform-PL, structured-WW, freeform-WW
      return calls.length < 3 ? [] : HIT;
    });

    const result = await geocodeAddress("Marszałkowska 1, Warszawa", {
      fetchImpl: fetchMock,
      retryDelayMs: 0,
      defaultCountry: "pl",
    });

    expect(result).not.toBeNull();
    // 3rd call is structured worldwide
    expect(calls[2]).not.toContain("countrycodes");
  });

  it("'auto' defaultCountry → no countrycodes from start", async () => {
    let capturedUrl = "";
    const fetchMock = makeFetchMock((url) => {
      capturedUrl = url;
      return HIT;
    });
    await geocodeAddress("Some Street 5, Anytown", {
      fetchImpl: fetchMock,
      retryDelayMs: 0,
      defaultCountry: "auto",
    });
    expect(capturedUrl).not.toContain("countrycodes");
  });

  it("UK postcode triggers GB country filter automatically", async () => {
    let capturedUrl = "";
    const fetchMock = makeFetchMock((url) => {
      capturedUrl = url;
      return HIT;
    });
    await geocodeAddress("10 Downing Street, London SW1A 1AA", {
      fetchImpl: fetchMock,
      retryDelayMs: 0,
      defaultCountry: "pl", // user default is PL but UK postcode wins
    });
    expect(capturedUrl).toContain("countrycodes=gb");
  });

  it("Dutch postal pattern triggers NL filter", async () => {
    let capturedUrl = "";
    const fetchMock = makeFetchMock((url) => {
      capturedUrl = url;
      return HIT;
    });
    await geocodeAddress("Damrak 1, 1011 AB Amsterdam", {
      fetchImpl: fetchMock,
      retryDelayMs: 0,
      defaultCountry: "pl",
    });
    expect(capturedUrl).toContain("countrycodes=nl");
  });
});
