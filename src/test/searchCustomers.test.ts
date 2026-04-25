import { describe, it, expect } from "vitest";
import {
  buildHaystack,
  collectAllTags,
  searchCustomers,
} from "@/lib/searchCustomers";
import type { Category, Customer } from "@/types/customer";

const now = new Date().toISOString();

function mk(overrides: Partial<Customer> = {}): Customer {
  return {
    id: Math.random().toString(36).slice(2),
    name: "X",
    address: "Y",
    lat: 0,
    lng: 0,
    isDone: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("searchCustomers", () => {
  const cat: Category = { id: "c1", name: "Awaria", icon: "wrench", color: "#000" };

  const customers: Customer[] = [
    mk({
      id: "a",
      name: "Jan Kowalski",
      address: "Krakowska 12, Warszawa",
      phone: "601-234-567",
      tags: ["VIP", "piec"],
      categoryId: "c1",
    }),
    mk({
      id: "b",
      name: "Anna Nowak",
      address: "Lipowa 3, Kraków",
      email: "anna@example.com",
      notes: "klient z piecem gazowym",
      tags: ["gaz"],
    }),
    mk({
      id: "c",
      name: "Firma XYZ",
      company: "XYZ Sp z o.o.",
      address: "Targowa 8, Łódź",
      timeline: [
        {
          id: "t1",
          date: now,
          kind: "fix",
          text: "wymiana zaworu termostatu",
          createdAt: now,
        },
      ],
    }),
  ];

  it("returns all customers for empty / whitespace query", () => {
    expect(searchCustomers(customers, "")).toHaveLength(3);
    expect(searchCustomers(customers, "   ")).toHaveLength(3);
  });

  it("matches by name (case-insensitive)", () => {
    const r = searchCustomers(customers, "kowalski");
    expect(r.map((c) => c.id)).toEqual(["a"]);
  });

  it("matches by address fragment", () => {
    // 'krakow' (bez polskiego ogonka 'ó') jest substringiem 'Krakowska' u Jana
    // i 'Kraków' u Anny – obaj match (accent-insensitive).
    const r = searchCustomers(customers, "krakow");
    expect(r.map((c) => c.id).sort()).toEqual(["a", "b"]);
  });

  it("is accent-insensitive (kraków/krakow oba znajdą 'Kraków')", () => {
    const r = searchCustomers(customers, "kraków");
    expect(r.map((c) => c.id).sort()).toEqual(["a", "b"]);
  });

  it("treats 'ł' as 'l' (lodz znajdzie 'Łódź')", () => {
    const r = searchCustomers(customers, "lodz");
    expect(r.map((c) => c.id)).toEqual(["c"]);
  });

  it("matches by phone", () => {
    const r = searchCustomers(customers, "234");
    expect(r.map((c) => c.id)).toEqual(["a"]);
  });

  it("matches by email", () => {
    const r = searchCustomers(customers, "example.com");
    expect(r.map((c) => c.id)).toEqual(["b"]);
  });

  it("matches by tag", () => {
    const r = searchCustomers(customers, "vip");
    expect(r.map((c) => c.id)).toEqual(["a"]);
  });

  it("matches by notes", () => {
    const r = searchCustomers(customers, "gazowym");
    expect(r.map((c) => c.id)).toEqual(["b"]);
  });

  it("matches by timeline entry text", () => {
    const r = searchCustomers(customers, "termostat");
    expect(r.map((c) => c.id)).toEqual(["c"]);
  });

  it("matches by category name (when categories passed)", () => {
    const r = searchCustomers(customers, "awaria", { categories: [cat] });
    expect(r.map((c) => c.id)).toEqual(["a"]);
  });

  it("does NOT match category name when categories not passed", () => {
    const r = searchCustomers(customers, "awaria");
    expect(r.length).toBe(0);
  });

  it("multi-word query is AND across fields", () => {
    // 'piec' jest w tagach Jana ALE nie ma 'gaz'.
    // 'piec gazowym' – Anna ma w notatkach 'piecem gazowym' → match.
    const r = searchCustomers(customers, "piec gaz");
    expect(r.map((c) => c.id).sort()).toEqual(["b"]);
  });

  it("returns empty when no matches", () => {
    expect(searchCustomers(customers, "xyzzy123")).toHaveLength(0);
  });

  it("buildHaystack joins all searchable fields", () => {
    const h = buildHaystack(customers[0], "Awaria");
    expect(h).toContain("jan kowalski");
    expect(h).toContain("krakowska");
    expect(h).toContain("vip");
    expect(h).toContain("piec");
    expect(h).toContain("awaria");
  });
});

describe("collectAllTags", () => {
  it("returns empty array when no tags exist", () => {
    expect(collectAllTags([mk(), mk()])).toEqual([]);
  });

  it("returns sorted unique tags", () => {
    const result = collectAllTags([
      mk({ tags: ["zima", "lato"] }),
      mk({ tags: ["jesien", "lato", "wiosna"] }),
    ]);
    expect(result).toEqual(["jesien", "lato", "wiosna", "zima"]);
  });

  it("deduplicates case-insensitively, keeping first casing seen", () => {
    const result = collectAllTags([
      mk({ tags: ["VIP"] }),
      mk({ tags: ["vip"] }),
      mk({ tags: ["Vip"] }),
    ]);
    expect(result).toEqual(["VIP"]);
  });

  it("trims whitespace and skips empty tags", () => {
    const result = collectAllTags([
      mk({ tags: ["  piec  ", "", "   "] }),
    ]);
    expect(result).toEqual(["piec"]);
  });

  it("handles undefined tags arrays", () => {
    expect(collectAllTags([mk({ tags: undefined })])).toEqual([]);
  });
});
