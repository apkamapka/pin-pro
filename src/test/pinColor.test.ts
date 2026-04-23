import { describe, it, expect } from "vitest";
import { addDays } from "date-fns";
import { getPinTone } from "@/lib/pinColor";
import type { Customer } from "@/types/customer";

const today = new Date("2025-01-15T12:00:00Z");

const base: Customer = {
  id: "x",
  name: "x",
  address: "x",
  lat: 0,
  lng: 0,
  status: "new",
  createdAt: today.toISOString(),
  updatedAt: today.toISOString(),
};

describe("getPinTone", () => {
  it("done overrides everything", () => {
    expect(
      getPinTone(
        { ...base, status: "done", nextAppointment: addDays(today, -5).toISOString() },
        today,
      ),
    ).toBe("done");
  });

  it("issue is always issue", () => {
    expect(getPinTone({ ...base, status: "issue" }, today)).toBe("issue");
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

  it("falls back to status when no appointment", () => {
    expect(getPinTone({ ...base, status: "warranty" }, today)).toBe("warranty");
    expect(getPinTone({ ...base, status: "in_progress" }, today)).toBe("progress");
  });
});
