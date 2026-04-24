import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type { Customer, ColorThresholds, CustomerStatus } from "@/types/customer";
import { DEFAULT_THRESHOLDS } from "@/types/customer";
import { buildSampleCustomers } from "@/lib/sampleData";

export type Theme = "light" | "dark" | "system";

interface CustomersState {
  customers: Customer[];
  thresholds: ColorThresholds;
  professions: string[];
  activeProfession: string | null;
  theme: Theme;
  seeded: boolean;

  addCustomer: (
    data: Omit<Customer, "id" | "createdAt" | "updatedAt">,
  ) => Customer;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  setStatus: (id: string, status: CustomerStatus) => void;
  importCustomers: (incoming: Customer[], mode: "merge" | "replace") => number;
  exportCustomers: () => Customer[];
  clearAll: () => void;
  setThresholds: (t: ColorThresholds) => void;
  addProfession: (p: string) => "added" | "exists" | "invalid";
  removeProfession: (p: string) => void;
  setActiveProfession: (p: string | null) => void;
  setTheme: (t: Theme) => void;
  seedIfEmpty: () => void;
}

export const useCustomers = create<CustomersState>()(
  persist(
    (set, get) => ({
      customers: [],
      thresholds: DEFAULT_THRESHOLDS,
      professions: [],
      activeProfession: null,
      theme: "system",
      seeded: false,

      addCustomer: (data) => {
        const now = new Date().toISOString();
        const c: Customer = {
          ...data,
          id: uuidv4(),
          createdAt: now,
          updatedAt: now,
        };
        set({ customers: [c, ...get().customers] });
        return c;
      },

      updateCustomer: (id, patch) => {
        const now = new Date().toISOString();
        set({
          customers: get().customers.map((c) =>
            c.id === id ? { ...c, ...patch, updatedAt: now } : c,
          ),
        });
      },

      deleteCustomer: (id) =>
        set({ customers: get().customers.filter((c) => c.id !== id) }),

      setStatus: (id, status) => {
        const now = new Date().toISOString();
        set({
          customers: get().customers.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status,
                  lastVisit: status === "done" ? now : c.lastVisit,
                  updatedAt: now,
                }
              : c,
          ),
        });
      },

      importCustomers: (incoming, mode) => {
        if (mode === "replace") {
          set({ customers: incoming });
          return incoming.length;
        }
        const map = new Map(get().customers.map((c) => [c.id, c]));
        for (const c of incoming) map.set(c.id, c);
        set({ customers: Array.from(map.values()) });
        return incoming.length;
      },

      exportCustomers: () => get().customers,

      clearAll: () => set({ customers: [] }),

      setThresholds: (thresholds) => set({ thresholds }),

      addProfession: (raw) => {
        const p = raw.trim();
        if (!p) return "invalid";
        const list = get().professions;
        const exists = list.some(
          (x) => x.toLocaleLowerCase() === p.toLocaleLowerCase(),
        );
        if (exists) {
          // still mark as active
          const canonical = list.find(
            (x) => x.toLocaleLowerCase() === p.toLocaleLowerCase(),
          )!;
          set({ activeProfession: canonical });
          return "exists";
        }
        set({
          professions: [...list, p],
          activeProfession: p,
        });
        return "added";
      },

      removeProfession: (p) => {
        const list = get().professions.filter((x) => x !== p);
        const active = get().activeProfession;
        set({
          professions: list,
          activeProfession:
            active === p ? (list[0] ?? null) : active,
        });
      },

      setActiveProfession: (p) => set({ activeProfession: p }),

      setTheme: (theme) => set({ theme }),

      seedIfEmpty: () => {
        const { customers, seeded } = get();
        if (!seeded && customers.length === 0) {
          set({ customers: buildSampleCustomers(), seeded: true });
        } else if (!seeded) {
          set({ seeded: true });
        }
      },
    }),
    {
      name: "serwismap-data",
      version: 2,
      migrate: (persisted: unknown, fromVersion: number) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        if (fromVersion < 2) {
          // v1 miał { profession: string } z presetem ("custom"|"hvac"|...)
          // w v2 mamy { professions: string[], activeProfession: string | null }
          // Presety porzucamy — "custom" traktujemy jak pustą listę.
          // Jeśli ktoś wpisał coś własnego (nieobecne w presetach), zachowujemy.
          const PRESETS = new Set([
            "custom",
            "hvac",
            "sales",
            "medical",
            "realestate",
            "insurance",
          ]);
          const old = typeof state.profession === "string" ? state.profession : "";
          const keep = old && !PRESETS.has(old) ? [old] : [];
          delete state.profession;
          state.professions = keep;
          state.activeProfession = keep[0] ?? null;
        }
        return state as CustomersState;
      },
    },
  ),
);
