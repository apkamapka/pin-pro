import { describe, it, expect } from "vitest";
import { addDays } from "date-fns";
import { getPinTone, getPinAppearance, getToneRange } from "@/lib/pinColor";
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

describe("getToneRange", () => {
  const thresholds = { soon: 3, upcoming: 10, later: 19 };

  it("soon starts at 0 and ends at threshold.soon", () => {
    expect(getToneRange("soon", thresholds)).toEqual({ from: 0, to: 3 });
  });

  it("upcoming starts at soon+1 and ends at upcoming", () => {
    expect(getToneRange("upcoming", thresholds)).toEqual({ from: 4, to: 10 });
  });

  it("later starts at upcoming+1 and ends at later", () => {
    expect(getToneRange("later", thresholds)).toEqual({ from: 11, to: 19 });
  });

  it("future is open-ended past later", () => {
    expect(getToneRange("future", thresholds)).toEqual({
      from: 20,
      to: null,
    });
  });

  it("returns undefined for non-range tones", () => {
    expect(getToneRange("done", thresholds)).toBeUndefined();
    expect(getToneRange("overdue", thresholds)).toBeUndefined();
    expect(getToneRange("noDate", thresholds)).toBeUndefined();
  });

  it("works with default thresholds 7/14/30", () => {
    const t = { soon: 7, upcoming: 14, later: 30 };
    expect(getToneRange("soon", t)).toEqual({ from: 0, to: 7 });
    expect(getToneRange("upcoming", t)).toEqual({ from: 8, to: 14 });
    expect(getToneRange("later", t)).toEqual({ from: 15, to: 30 });
    expect(getToneRange("future", t)).toEqual({ from: 31, to: null });
  });
});
