import { describe, it, expect } from "vitest";
import { addDays } from "date-fns";
import {
  countOverdueNearby,
  findNearby,
  formatDistance,
  haversineKm,
} from "@/lib/distance";
import type { Customer } from "@/types/customer";

const NOW = new Date("2025-06-15T12:00:00Z");

const baseCustomer = (overrides: Partial<Customer>): Customer => ({
  id: overrides.id ?? "c",
  name: overrides.name ?? "Customer",
  address: "addr",
  lat: 0,
  lng: 0,
  isDone: false,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  ...overrides,
});

describe("haversineKm", () => {
  it("returns 0 for the same point", () => {
    expect(haversineKm(50.0, 19.0, 50.0, 19.0)).toBeCloseTo(0, 5);
  });

  it("computes a known short distance correctly (Krakow Rynek to Wawel ~0.7 km)", () => {
    // Rynek Główny: 50.0617, 19.9373
    // Wawel:        50.0540, 19.9354
    const d = haversineKm(50.0617, 19.9373, 50.054, 19.9354);
    expect(d).toBeGreaterThan(0.6);
    expect(d).toBeLessThan(1.0);
  });

  it("computes a known long distance (Warsaw to Berlin ~520 km)", () => {
    // Warsaw:  52.2297, 21.0122
    // Berlin:  52.5200, 13.4050
    const d = haversineKm(52.2297, 21.0122, 52.52, 13.405);
    expect(d).toBeGreaterThan(515);
    expect(d).toBeLessThan(525);
  });

  it("is symmetric (haversine(A, B) === haversine(B, A))", () => {
    const d1 = haversineKm(50.06, 19.94, 52.23, 21.01);
    const d2 = haversineKm(52.23, 21.01, 50.06, 19.94);
    expect(d1).toBeCloseTo(d2, 6);
  });

  it("handles antipodal points without NaN (still finite)", () => {
    const d = haversineKm(0, 0, 0, 180);
    expect(Number.isFinite(d)).toBe(true);
    // ~半 obwód Ziemi (~20 015 km), z marginesem na elipsoidalność
    expect(d).toBeGreaterThan(19000);
    expect(d).toBeLessThan(21000);
  });
});

describe("findNearby", () => {
  // Punkt obserwacji: ~Rynek w Krakowie
  const ORIGIN_LAT = 50.0617;
  const ORIGIN_LNG = 19.9373;

  it("returns empty for empty input", () => {
    expect(findNearby([], ORIGIN_LAT, ORIGIN_LNG, 5)).toEqual([]);
  });

  it("filters out customers outside the radius", () => {
    const close = baseCustomer({ id: "close", lat: 50.0617, lng: 19.94 }); // ~0.2 km
    const far = baseCustomer({ id: "far", lat: 52.23, lng: 21.01 }); // ~250 km
    const result = findNearby([close, far], ORIGIN_LAT, ORIGIN_LNG, 5);
    expect(result.map((r) => r.customer.id)).toEqual(["close"]);
  });

  it("sorts by distance ascending", () => {
    const a = baseCustomer({ id: "a", lat: 50.07, lng: 19.94 }); // ~0.9 km
    const b = baseCustomer({ id: "b", lat: 50.062, lng: 19.94 }); // ~0.2 km
    const c = baseCustomer({ id: "c", lat: 50.08, lng: 19.95 }); // ~2 km
    const result = findNearby([a, b, c], ORIGIN_LAT, ORIGIN_LNG, 10);
    expect(result.map((r) => r.customer.id)).toEqual(["b", "a", "c"]);
  });

  it("includes customers exactly at the origin (distance 0)", () => {
    const here = baseCustomer({ id: "here", lat: ORIGIN_LAT, lng: ORIGIN_LNG });
    const result = findNearby([here], ORIGIN_LAT, ORIGIN_LNG, 1);
    expect(result).toHaveLength(1);
    expect(result[0].distanceKm).toBeCloseTo(0, 5);
  });

  it("skips customers with non-finite coords", () => {
    const valid = baseCustomer({ id: "v", lat: 50.0617, lng: 19.94 });
    const broken = baseCustomer({ id: "b", lat: NaN, lng: 19.9 });
    const broken2 = baseCustomer({
      id: "b2",
      lat: 50,
      lng: undefined as unknown as number,
    });
    const result = findNearby(
      [valid, broken, broken2],
      ORIGIN_LAT,
      ORIGIN_LNG,
      5,
    );
    expect(result.map((r) => r.customer.id)).toEqual(["v"]);
  });

  it("returns empty when origin coords are non-finite", () => {
    const c = baseCustomer({ id: "c", lat: 50, lng: 19.9 });
    expect(findNearby([c], NaN, 19.9, 5)).toEqual([]);
    expect(findNearby([c], 50, Infinity, 5)).toEqual([]);
  });

  it("returns empty when radius is zero or negative", () => {
    const c = baseCustomer({ id: "c", lat: 50.0617, lng: 19.94 });
    expect(findNearby([c], ORIGIN_LAT, ORIGIN_LNG, 0)).toEqual([]);
    expect(findNearby([c], ORIGIN_LAT, ORIGIN_LNG, -1)).toEqual([]);
  });

  it("includes a 'done' customer (filter is purely geographic)", () => {
    // findNearby świadomie nie filtruje po isDone — to robi UI, jeśli chce.
    const done = baseCustomer({
      id: "done",
      lat: 50.0617,
      lng: 19.94,
      isDone: true,
    });
    const result = findNearby([done], ORIGIN_LAT, ORIGIN_LNG, 5);
    expect(result.map((r) => r.customer.id)).toEqual(["done"]);
  });
});

describe("formatDistance", () => {
  it("formats sub-1km as meters rounded to 10 m (PL)", () => {
    expect(formatDistance(0.42, "pl")).toBe("420 m");
    expect(formatDistance(0.418, "pl")).toBe("420 m"); // 418 → 420
    expect(formatDistance(0.005, "pl")).toBe("10 m"); // 5 m → round(0.5)=1 → 10 m
    expect(formatDistance(0.001, "pl")).toBe("0 m"); // 1 m → round(0.1)=0 → 0 m
    expect(formatDistance(0.999, "pl")).toBe("1000 m");
  });

  it("formats sub-1km as meters rounded to 10 m (EN)", () => {
    expect(formatDistance(0.5, "en")).toBe("500 m");
  });

  it("formats 1–9.9 km with one decimal, comma in PL", () => {
    expect(formatDistance(1.0, "pl")).toBe("1,0 km");
    expect(formatDistance(2.456, "pl")).toBe("2,5 km");
    expect(formatDistance(9.9, "pl")).toBe("9,9 km");
  });

  it("formats 1–9.9 km with one decimal, dot in EN", () => {
    expect(formatDistance(1.0, "en")).toBe("1.0 km");
    expect(formatDistance(2.456, "en")).toBe("2.5 km");
  });

  it("formats 10+ km as integer km", () => {
    expect(formatDistance(10, "pl")).toBe("10 km");
    expect(formatDistance(15.7, "pl")).toBe("16 km");
    expect(formatDistance(123.4, "en")).toBe("123 km");
  });

  it("returns empty string for invalid input", () => {
    expect(formatDistance(NaN, "pl")).toBe("");
    expect(formatDistance(-5, "pl")).toBe("");
    expect(formatDistance(Infinity, "en")).toBe("");
  });
});

describe("countOverdueNearby", () => {
  const ORIGIN_LAT = 50.0617;
  const ORIGIN_LNG = 19.9373;

  it("counts overdue customers (past appointment, not done)", () => {
    const overdue = {
      customer: baseCustomer({
        id: "ov",
        lat: ORIGIN_LAT,
        lng: ORIGIN_LNG,
        nextAppointment: addDays(NOW, -3).toISOString(),
      }),
      distanceKm: 0.1,
    };
    const upcoming = {
      customer: baseCustomer({
        id: "up",
        lat: ORIGIN_LAT,
        lng: ORIGIN_LNG,
        nextAppointment: addDays(NOW, 5).toISOString(),
      }),
      distanceKm: 0.2,
    };
    expect(countOverdueNearby([overdue, upcoming], NOW)).toBe(1);
  });

  it("does not count done customers even if appointment is in the past", () => {
    const item = {
      customer: baseCustomer({
        id: "d",
        lat: ORIGIN_LAT,
        lng: ORIGIN_LNG,
        nextAppointment: addDays(NOW, -3).toISOString(),
        isDone: true,
      }),
      distanceKm: 0.1,
    };
    expect(countOverdueNearby([item], NOW)).toBe(0);
  });

  it("does not count customers without appointment", () => {
    const item = {
      customer: baseCustomer({ id: "n", lat: ORIGIN_LAT, lng: ORIGIN_LNG }),
      distanceKm: 0.1,
    };
    expect(countOverdueNearby([item], NOW)).toBe(0);
  });

  it("returns 0 for empty list", () => {
    expect(countOverdueNearby([], NOW)).toBe(0);
  });
});
