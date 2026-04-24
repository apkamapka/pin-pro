import { describe, it, expect } from "vitest";
import { addDays } from "date-fns";
import { getPinTone, getPinAppearance } from "@/lib/pinColor";
import type { Category, Customer } from "@/types/customer";

const today = new Date("2025-01-15T12:00:00Z");

const base: Customer = {
  id: "x",
  name: "x",
  address: "x",
  lat: 0,
  lng: 0,
  isDone: false,
  createdAt: today.toISOString(),
  updatedAt: today.toISOString(),
};

describe("getPinTone", () => {
  it("done overrides everything", () => {
    expect(
      getPinTone(
        {
          ...base,
          isDone: true,
          nextAppointment: addDays(today, -5).toISOString(),
        },
        today,
      ),
    ).toBe("done");
  });

  it("overdue when past appointment", () => {
    expect(
      getPinTone(
        { ...base, nextAppointment: addDays(today, -1).toISOString() },
        today,
      ),
    ).toBe("overdue");
  });

  it("soon for 0-7 days", () => {
    expect(
      getPinTone(
        { ...base, nextAppointment: addDays(today, 3).toISOString() },
        today,
      ),
    ).toBe("soon");
  });

  it("upcoming for 8-14 days", () => {
    expect(
      getPinTone(
        { ...base, nextAppointment: addDays(today, 10).toISOString() },
        today,
      ),
    ).toBe("upcoming");
  });

  it("later for 15-30 days", () => {
    expect(
      getPinTone(
        { ...base, nextAppointment: addDays(today, 25).toISOString() },
        today,
      ),
    ).toBe("later");
  });

  it("future for 30+ days", () => {
    expect(
      getPinTone(
        { ...base, nextAppointment: addDays(today, 60).toISOString() },
        today,
      ),
    ).toBe("future");
  });

  it("noDate when no appointment", () => {
    expect(getPinTone(base, today)).toBe("noDate");
  });
});

describe("getPinAppearance with categories", () => {
  const urgentCat: Category = {
    id: "cat-urgent",
    name: "Urgent",
    icon: "alert",
    color: "#ff00ff", // magenta do łatwej weryfikacji
  };

  const categoryById = (id: string): Category | undefined =>
    id === "cat-urgent" ? urgentCat : undefined;

  it("noDate + category falls back to category color", () => {
    const app = getPinAppearance(
      { ...base, categoryId: "cat-urgent" },
      today,
      undefined,
      categoryById,
    );
    expect(app.tone).toBe("noDate");
    expect(app.color).toBe("#ff00ff");
  });

  it("overdue wins over category color", () => {
    const app = getPinAppearance(
      {
        ...base,
        categoryId: "cat-urgent",
        nextAppointment: addDays(today, -3).toISOString(),
      },
      today,
      undefined,
      categoryById,
    );
    expect(app.tone).toBe("overdue");
    expect(app.color).not.toBe("#ff00ff");
  });

  it("done wins even over category", () => {
    const app = getPinAppearance(
      { ...base, isDone: true, categoryId: "cat-urgent" },
      today,
      undefined,
      categoryById,
    );
    expect(app.tone).toBe("done");
  });

  it("overdue pulses", () => {
    const app = getPinAppearance(
      { ...base, nextAppointment: addDays(today, -1).toISOString() },
      today,
    );
    expect(app.pulse).toBe(true);
  });
});
