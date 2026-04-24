import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type {
  Category,
  ColorThresholds,
  Customer,
  LegacyCustomerStatus,
} from "@/types/customer";
import { DEFAULT_THRESHOLDS } from "@/types/customer";
import { buildSampleCustomers } from "@/lib/sampleData";

export type Theme = "light" | "dark" | "system";

interface CustomersState {
  customers: Customer[];
  categories: Category[];
  thresholds: ColorThresholds;
  professions: string[];
  activeProfession: string | null;
  theme: Theme;
  seeded: boolean;

  // Customers
  addCustomer: (
    data: Omit<Customer, "id" | "createdAt" | "updatedAt">,
  ) => Customer;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  setDone: (id: string, done: boolean) => void;
  setCategory: (id: string, categoryId: string | undefined) => void;
  importCustomers: (incoming: Customer[], mode: "merge" | "replace") => number;
  exportCustomers: () => Customer[];
  clearAll: () => void;

  // Categories
  addCategory: (c: Omit<Category, "id">) => Category;
  updateCategory: (id: string, patch: Partial<Omit<Category, "id">>) => void;
  removeCategory: (id: string) => void;
  reorderCategories: (ids: string[]) => void;

  // Other settings
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
      categories: [],
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

      setDone: (id, done) => {
        const now = new Date().toISOString();
        set({
          customers: get().customers.map((c) =>
            c.id === id
              ? {
                  ...c,
                  isDone: done,
                  lastVisit: done ? now : c.lastVisit,
                  updatedAt: now,
                }
              : c,
          ),
        });
      },

      setCategory: (id, categoryId) => {
        const now = new Date().toISOString();
        set({
          customers: get().customers.map((c) =>
            c.id === id ? { ...c, categoryId, updatedAt: now } : c,
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

      addCategory: (data) => {
        const cat: Category = { ...data, id: uuidv4() };
        set({ categories: [...get().categories, cat] });
        return cat;
      },

      updateCategory: (id, patch) => {
        set({
          categories: get().categories.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        });
      },

      removeCategory: (id) => {
        // Usuń kategorię + odpnij od wszystkich klientów którzy ją mieli.
        set({
          categories: get().categories.filter((c) => c.id !== id),
          customers: get().customers.map((c) =>
            c.categoryId === id ? { ...c, categoryId: undefined } : c,
          ),
        });
      },

      reorderCategories: (ids) => {
        const byId = new Map(get().categories.map((c) => [c.id, c]));
        const ordered = ids
          .map((id) => byId.get(id))
          .filter((c): c is Category => !!c);
        // Dodaj ewentualne, których nie było w tablicy ids (na końcu).
        const seen = new Set(ids);
        for (const c of get().categories) {
          if (!seen.has(c.id)) ordered.push(c);
        }
        set({ categories: ordered });
      },

      setThresholds: (thresholds) => set({ thresholds }),

      addProfession: (raw) => {
        const p = raw.trim();
        if (!p) return "invalid";
        const list = get().professions;
        const exists = list.some(
          (x) => x.toLocaleLowerCase() === p.toLocaleLowerCase(),
        );
        if (exists) {
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
          activeProfession: active === p ? (list[0] ?? null) : active,
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
      version: 3,
      migrate: (persisted: unknown, fromVersion: number) => {
        const state = (persisted ?? {}) as Record<string, unknown>;

        // --- v1 -> v2: profesja jako lista historii (zrobione wcześniej) ---
        if (fromVersion < 2) {
          const PRESETS = new Set([
            "custom",
            "hvac",
            "sales",
            "medical",
            "realestate",
            "insurance",
          ]);
          const old =
            typeof state.profession === "string" ? state.profession : "";
          const keep = old && !PRESETS.has(old) ? [old] : [];
          delete state.profession;
          state.professions = keep;
          state.activeProfession = keep[0] ?? null;
        }

        // --- v2 -> v3: usuń sztywne statusy, wprowadź isDone + categoryId ---
        if (fromVersion < 3) {
          const oldCustomers = Array.isArray(state.customers)
            ? (state.customers as Array<Record<string, unknown>>)
            : [];

          state.customers = oldCustomers.map((c) => {
            const status = c.status as LegacyCustomerStatus | undefined;
            const tags = Array.isArray(c.tags) ? (c.tags as string[]) : [];
            const extraTags: string[] = [];
            // Zachowujemy info o "warranty"/"issue" jako tagi, żeby nic nie zgubić.
            if (status === "warranty" && !tags.includes("gwarancja")) {
              extraTags.push("gwarancja");
            }
            if (status === "issue" && !tags.includes("awaria")) {
              extraTags.push("awaria");
            }
            const migrated = {
              ...c,
              isDone: status === "done",
              categoryId: undefined,
              tags: extraTags.length ? [...tags, ...extraTags] : tags,
            };
            delete (migrated as Record<string, unknown>).status;
            return migrated;
          });
          // Nowe pole:
          if (!Array.isArray(state.categories)) state.categories = [];
        }

        return state as CustomersState;
      },
    },
  ),
);
