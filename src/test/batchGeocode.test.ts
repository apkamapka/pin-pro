import { describe, it, expect, vi } from "vitest";
import { batchGeocode } from "@/lib/batchGeocode";
import type { ImportCandidate } from "@/lib/importCompose";

function mkCandidate(over: Partial<ImportCandidate> = {}): ImportCandidate {
  return {
    rowId: 0,
    valid: true,
    missing: [],
    name: "Jan",
    address: "Krakowska 1",
    ...over,
  };
}

describe("batchGeocode", () => {
  it("geocodes valid candidates and assigns lat/lng", async () => {
    const candidates = [
      mkCandidate({ rowId: 0, address: "Warszawa" }),
      mkCandidate({ rowId: 1, address: "Kraków" }),
    ];

    const fakeGeocode = vi.fn().mockImplementation(async (q: string) => ({
      lat: 52.0,
      lng: 21.0,
      display_name: q,
    }));

    const result = await batchGeocode(candidates, {
      delayMs: 0,
      geocode: fakeGeocode,
    });

    expect(result.cancelled).toBe(false);
    expect(candidates[0].lat).toBe(52);
    expect(candidates[0].lng).toBe(21);
    expect(candidates[1].lat).toBe(52);
    expect(fakeGeocode).toHaveBeenCalledTimes(2);
  });

  it("skips invalid candidates", async () => {
    const candidates = [
      mkCandidate({ rowId: 0, valid: false, address: "" }),
      mkCandidate({ rowId: 1, address: "Warszawa" }),
    ];

    const fakeGeocode = vi.fn().mockResolvedValue({
      lat: 1,
      lng: 2,
      display_name: "x",
    });

    await batchGeocode(candidates, { delayMs: 0, geocode: fakeGeocode });
    expect(fakeGeocode).toHaveBeenCalledTimes(1); // only the valid one
    expect(candidates[1].lat).toBe(1);
    expect(candidates[0].lat).toBeUndefined();
  });

  it("marks not-found with geocodeError", async () => {
    const candidates = [mkCandidate({ address: "nonexistent place 12345xyz" })];
    const fakeGeocode = vi.fn().mockResolvedValue(null);

    await batchGeocode(candidates, { delayMs: 0, geocode: fakeGeocode });
    expect(candidates[0].lat).toBeUndefined();
    expect(candidates[0].geocodeError).toBe("not_found");
  });

  it("recovers from one failed geocode and continues", async () => {
    const candidates = [
      mkCandidate({ rowId: 0, address: "a" }),
      mkCandidate({ rowId: 1, address: "b" }),
      mkCandidate({ rowId: 2, address: "c" }),
    ];

    const fakeGeocode = vi
      .fn()
      .mockResolvedValueOnce({ lat: 1, lng: 1, display_name: "a" })
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ lat: 3, lng: 3, display_name: "c" });

    const result = await batchGeocode(candidates, {
      delayMs: 0,
      geocode: fakeGeocode,
    });
    expect(result.cancelled).toBe(false);
    expect(candidates[0].lat).toBe(1);
    expect(candidates[1].lat).toBeUndefined();
    expect(candidates[1].geocodeError).toBe("boom");
    expect(candidates[2].lat).toBe(3);
  });

  it("respects shouldCancel and bails out", async () => {
    const candidates = [
      mkCandidate({ rowId: 0, address: "a" }),
      mkCandidate({ rowId: 1, address: "b" }),
      mkCandidate({ rowId: 2, address: "c" }),
    ];

    let processedCount = 0;
    const fakeGeocode = vi.fn().mockImplementation(async () => {
      processedCount++;
      return { lat: 1, lng: 1, display_name: "x" };
    });

    const result = await batchGeocode(candidates, {
      delayMs: 0,
      geocode: fakeGeocode,
      shouldCancel: () => processedCount >= 1,
    });

    expect(result.cancelled).toBe(true);
    expect(candidates[0].lat).toBe(1);
    // The remaining candidates should NOT have been processed
    expect(candidates[2].lat).toBeUndefined();
  });

  it("calls onProgress callback for each step", async () => {
    const candidates = [
      mkCandidate({ rowId: 0, address: "a" }),
      mkCandidate({ rowId: 1, address: "b" }),
    ];

    const onProgress = vi.fn();
    const fakeGeocode = vi.fn().mockResolvedValue({
      lat: 1,
      lng: 1,
      display_name: "x",
    });

    await batchGeocode(candidates, {
      delayMs: 0,
      geocode: fakeGeocode,
      onProgress,
    });

    expect(onProgress).toHaveBeenCalled();
    // Last call should show done = total = 2
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
    expect(lastCall.done).toBe(2);
    expect(lastCall.total).toBe(2);
    expect(lastCall.success).toBe(2);
  });

  it("handles empty queue gracefully", async () => {
    const result = await batchGeocode([], { delayMs: 0 });
    expect(result.cancelled).toBe(false);
  });

  it("does not re-geocode candidates that already have lat/lng", async () => {
    const candidates = [mkCandidate({ lat: 50, lng: 20 })];
    const fakeGeocode = vi.fn();
    await batchGeocode(candidates, { delayMs: 0, geocode: fakeGeocode });
    expect(fakeGeocode).not.toHaveBeenCalled();
  });
});
