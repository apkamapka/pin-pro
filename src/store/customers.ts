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
  profession: string;
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
  setProfession: (p: string) => void;
  setTheme: (t: Theme) => void;
  seedIfEmpty: () => void;
}

export const useCustomers = create<CustomersState>()(
  persist(
    (set, get) => ({
      customers: [],
      thresholds: DEFAULT_THRESHOLDS,
      profession: "custom",
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
      setProfession: (profession) => set({ profession }),
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
      version: 1,
    },
  ),
);
