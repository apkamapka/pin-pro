import { describe, it, expect, beforeEach } from "vitest";
import { useCustomers } from "@/store/customers";
import type { Customer } from "@/types/customer";

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  const now = new Date().toISOString();
  return {
    id: "c1",
    name: "Test",
    address: "Addr",
    lat: 0,
    lng: 0,
    isDone: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("customers store: Pakiet A", () => {
  beforeEach(() => {
    // Reset store to a known clean state.
    useCustomers.setState({
      customers: [],
      categories: [],
      professions: [],
      activeProfession: null,
      seeded: true,
    });
  });

  describe("photos", () => {
    it("addPhoto appends to customer.photos", () => {
      const c = useCustomers.getState().addCustomer(makeCustomer());
      const p = useCustomers.getState().addPhoto(c.id, {
        dataUrl: "data:image/jpeg;base64,xxx",
        mimeType: "image/jpeg",
        approxBytes: 100,
      });
      expect(p).not.toBeNull();
      const fresh = useCustomers.getState().customers.find((x) => x.id === c.id)!;
      expect(fresh.photos).toHaveLength(1);
      expect(fresh.photos![0].id).toBe(p!.id);
      expect(fresh.photos![0].dataUrl).toBe("data:image/jpeg;base64,xxx");
    });

    it("addPhoto returns null for unknown customer", () => {
      const p = useCustomers.getState().addPhoto("nope", {
        dataUrl: "x",
        mimeType: "image/jpeg",
      });
      expect(p).toBeNull();
    });

    it("removePhoto removes the given photo", () => {
      const c = useCustomers.getState().addCustomer(makeCustomer());
      const p1 = useCustomers.getState().addPhoto(c.id, {
        dataUrl: "1",
        mimeType: "image/jpeg",
      })!;
      const p2 = useCustomers.getState().addPhoto(c.id, {
        dataUrl: "2",
        mimeType: "image/jpeg",
      })!;
      useCustomers.getState().removePhoto(c.id, p1.id);
      const fresh = useCustomers.getState().customers.find((x) => x.id === c.id)!;
      expect(fresh.photos).toHaveLength(1);
      expect(fresh.photos![0].id).toBe(p2.id);
    });
  });

  describe("voice notes", () => {
    it("addVoiceNote stores duration and size", () => {
      const c = useCustomers.getState().addCustomer(makeCustomer());
      const v = useCustomers.getState().addVoiceNote(c.id, {
        dataUrl: "data:audio/webm;base64,yyy",
        mimeType: "audio/webm",
        durationSec: 12,
        approxBytes: 240_000,
      })!;
      const fresh = useCustomers.getState().customers.find((x) => x.id === c.id)!;
      expect(fresh.voiceNotes).toHaveLength(1);
      expect(fresh.voiceNotes![0].id).toBe(v.id);
      expect(fresh.voiceNotes![0].durationSec).toBe(12);
    });

    it("removeVoiceNote works", () => {
      const c = useCustomers.getState().addCustomer(makeCustomer());
      const v = useCustomers.getState().addVoiceNote(c.id, {
        dataUrl: "a",
        mimeType: "audio/webm",
      })!;
      useCustomers.getState().removeVoiceNote(c.id, v.id);
      const fresh = useCustomers.getState().customers.find((x) => x.id === c.id)!;
      expect(fresh.voiceNotes).toHaveLength(0);
    });
  });

  describe("photo ↔ timeline integration", () => {
    it("removePhoto cascades and unpins photo from any timeline entries", () => {
      const c = useCustomers.getState().addCustomer(makeCustomer());
      const p1 = useCustomers.getState().addPhoto(c.id, {
        dataUrl: "1",
        mimeType: "image/jpeg",
      })!;
      const p2 = useCustomers.getState().addPhoto(c.id, {
        dataUrl: "2",
        mimeType: "image/jpeg",
      })!;
      useCustomers.getState().addTimelineEntry(c.id, {
        date: new Date().toISOString(),
        kind: "fix",
        photoIds: [p1.id, p2.id],
      });
      // act – usuwamy p1
      useCustomers.getState().removePhoto(c.id, p1.id);

      const fresh = useCustomers.getState().customers.find((x) => x.id === c.id)!;
      expect(fresh.photos).toHaveLength(1);
      expect(fresh.photos![0].id).toBe(p2.id);
      // wpis zachowany, ale tylko z p2:
      expect(fresh.timeline![0].photoIds).toEqual([p2.id]);
    });

    it("removePhoto clears thumbnailPhotoId when removing the thumbnail photo", () => {
      const c = useCustomers.getState().addCustomer(makeCustomer());
      const p = useCustomers.getState().addPhoto(c.id, {
        dataUrl: "1",
        mimeType: "image/jpeg",
      })!;
      useCustomers.getState().setThumbnail(c.id, p.id);
      const before = useCustomers.getState().customers.find((x) => x.id === c.id)!;
      expect(before.thumbnailPhotoId).toBe(p.id);

      useCustomers.getState().removePhoto(c.id, p.id);
      const after = useCustomers.getState().customers.find((x) => x.id === c.id)!;
      expect(after.thumbnailPhotoId).toBeUndefined();
    });

    it("removePhoto preserves thumbnailPhotoId when removing a different photo", () => {
      const c = useCustomers.getState().addCustomer(makeCustomer());
      const p1 = useCustomers.getState().addPhoto(c.id, {
        dataUrl: "1",
        mimeType: "image/jpeg",
      })!;
      const p2 = useCustomers.getState().addPhoto(c.id, {
        dataUrl: "2",
        mimeType: "image/jpeg",
      })!;
      useCustomers.getState().setThumbnail(c.id, p2.id);
      useCustomers.getState().removePhoto(c.id, p1.id);
      const fresh = useCustomers.getState().customers.find((x) => x.id === c.id)!;
      expect(fresh.thumbnailPhotoId).toBe(p2.id);
    });

    it("setThumbnail with undefined clears the thumbnail", () => {
      const c = useCustomers.getState().addCustomer(makeCustomer());
      const p = useCustomers.getState().addPhoto(c.id, {
        dataUrl: "1",
        mimeType: "image/jpeg",
      })!;
      useCustomers.getState().setThumbnail(c.id, p.id);
      useCustomers.getState().setThumbnail(c.id, undefined);
      const fresh = useCustomers.getState().customers.find((x) => x.id === c.id)!;
      expect(fresh.thumbnailPhotoId).toBeUndefined();
    });

    it("addTimelineEntry stores photoIds when provided", () => {
      const c = useCustomers.getState().addCustomer(makeCustomer());
      const p = useCustomers.getState().addPhoto(c.id, {
        dataUrl: "1",
        mimeType: "image/jpeg",
      })!;
      const e = useCustomers.getState().addTimelineEntry(c.id, {
        date: new Date().toISOString(),
        kind: "issue",
        text: "leak",
        photoIds: [p.id],
      })!;
      const fresh = useCustomers.getState().customers.find((x) => x.id === c.id)!;
      expect(fresh.timeline![0].id).toBe(e.id);
      expect(fresh.timeline![0].photoIds).toEqual([p.id]);
    });
  });

  describe("timeline", () => {
    it("addTimelineEntry appends entry", () => {
      const c = useCustomers.getState().addCustomer(makeCustomer());
      const e = useCustomers.getState().addTimelineEntry(c.id, {
        date: new Date("2025-06-01T12:00:00Z").toISOString(),
        kind: "note",
        text: "talked",
      })!;
      const fresh = useCustomers.getState().customers.find((x) => x.id === c.id)!;
      expect(fresh.timeline).toHaveLength(1);
      expect(fresh.timeline![0].id).toBe(e.id);
      expect(fresh.timeline![0].kind).toBe("note");
    });

    it("adding a visit entry updates lastVisit if newer", () => {
      const older = new Date("2025-01-01T10:00:00Z").toISOString();
      const newer = new Date("2025-06-10T10:00:00Z").toISOString();
      const c = useCustomers
        .getState()
        .addCustomer(makeCustomer({ lastVisit: older }));

      useCustomers.getState().addTimelineEntry(c.id, {
        date: newer,
        kind: "visit",
      });
      const fresh = useCustomers.getState().customers.find((x) => x.id === c.id)!;
      expect(fresh.lastVisit).toBe(newer);
    });

    it("adding a non-visit entry does not change lastVisit", () => {
      const existing = new Date("2025-06-10T10:00:00Z").toISOString();
      const c = useCustomers
        .getState()
        .addCustomer(makeCustomer({ lastVisit: existing }));
      useCustomers.getState().addTimelineEntry(c.id, {
        date: new Date("2025-07-01T10:00:00Z").toISOString(),
        kind: "call",
        text: "quick call",
      });
      const fresh = useCustomers.getState().customers.find((x) => x.id === c.id)!;
      expect(fresh.lastVisit).toBe(existing);
    });

    it("updateTimelineEntry patches given fields", () => {
      const c = useCustomers.getState().addCustomer(makeCustomer());
      const e = useCustomers.getState().addTimelineEntry(c.id, {
        date: new Date("2025-06-01T12:00:00Z").toISOString(),
        kind: "note",
        text: "v1",
      })!;
      useCustomers.getState().updateTimelineEntry(c.id, e.id, { text: "v2" });
      const fresh = useCustomers.getState().customers.find((x) => x.id === c.id)!;
      expect(fresh.timeline![0].text).toBe("v2");
      expect(fresh.timeline![0].kind).toBe("note"); // nie zmienione
    });

    it("removeTimelineEntry works", () => {
      const c = useCustomers.getState().addCustomer(makeCustomer());
      const e1 = useCustomers.getState().addTimelineEntry(c.id, {
        date: new Date().toISOString(),
        kind: "note",
      })!;
      const e2 = useCustomers.getState().addTimelineEntry(c.id, {
        date: new Date().toISOString(),
        kind: "call",
      })!;
      useCustomers.getState().removeTimelineEntry(c.id, e1.id);
      const fresh = useCustomers.getState().customers.find((x) => x.id === c.id)!;
      expect(fresh.timeline).toHaveLength(1);
      expect(fresh.timeline![0].id).toBe(e2.id);
    });
  });
});
