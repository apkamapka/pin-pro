import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { getActiveStorageKey } from "@/store/profiles";
import type {
  Category,
  ColorThresholds,
  Customer,
  LegacyCustomerStatus,
  MediaAttachment,
  TimelineEntry,
  TimelineKind,
} from "@/types/customer";
import { DEFAULT_THRESHOLDS } from "@/types/customer";
import { legacyToCustomFields } from "@/lib/customFields";

export type Theme = "light" | "dark" | "system";

interface CustomersState {
  customers: Customer[];
  categories: Category[];
  thresholds: ColorThresholds;
  theme: Theme;
  /** Domyślny kraj geokodowania (ISO 3166-1 alpha-2 lowercase, np. "pl", "de", "auto"). */
  defaultCountry: string;
  /** Promień szukania "W okolicy" w km (slider 1–50, default 5). */
  nearbyRadiusKm: number;
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

  // --- Pakiet A ---
  // Photos
  addPhoto: (
    customerId: string,
    data: Omit<MediaAttachment, "id" | "createdAt">,
  ) => MediaAttachment | null;
  removePhoto: (customerId: string, photoId: string) => void;
  setThumbnail: (customerId: string, photoId: string | undefined) => void;
  // Voice notes
  addVoiceNote: (
    customerId: string,
    data: Omit<MediaAttachment, "id" | "createdAt">,
  ) => MediaAttachment | null;
  removeVoiceNote: (customerId: string, voiceId: string) => void;
  // Timeline
  addTimelineEntry: (
    customerId: string,
    data: Omit<TimelineEntry, "id" | "createdAt">,
  ) => TimelineEntry | null;
  updateTimelineEntry: (
    customerId: string,
    entryId: string,
    patch: Partial<Pick<TimelineEntry, "date" | "kind" | "text">>,
  ) => void;
  removeTimelineEntry: (customerId: string, entryId: string) => void;

  // Other settings
  setThresholds: (t: ColorThresholds) => void;
  setTheme: (t: Theme) => void;
  setDefaultCountry: (c: string) => void;
  setNearbyRadiusKm: (km: number) => void;
}

export const useCustomers = create<CustomersState>()(
  persist(
    (set, get) => ({
      customers: [],
      categories: [],
      thresholds: DEFAULT_THRESHOLDS,
      theme: "system",
      defaultCountry: "pl",
      nearbyRadiusKm: 5,
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

      // --- Pakiet A: photos ---
      addPhoto: (customerId, data) => {
        const customer = get().customers.find((c) => c.id === customerId);
        if (!customer) return null;
        const now = new Date().toISOString();
        const photo: MediaAttachment = {
          ...data,
          id: uuidv4(),
          createdAt: now,
        };
        set({
          customers: get().customers.map((c) =>
            c.id === customerId
              ? {
                  ...c,
                  photos: [...(c.photos ?? []), photo],
                  updatedAt: now,
                }
              : c,
          ),
        });
        return photo;
      },

      removePhoto: (customerId, photoId) => {
        const now = new Date().toISOString();
        set({
          customers: get().customers.map((c) =>
            c.id === customerId
              ? {
                  ...c,
                  photos: (c.photos ?? []).filter((p) => p.id !== photoId),
                  // Odpnij z każdego wpisu osi czasu, w którym był
                  timeline: (c.timeline ?? []).map((e) =>
                    e.photoIds && e.photoIds.includes(photoId)
                      ? {
                          ...e,
                          photoIds: e.photoIds.filter((id) => id !== photoId),
                        }
                      : e,
                  ),
                  // Jeśli to była miniaturka – wyczyść
                  thumbnailPhotoId:
                    c.thumbnailPhotoId === photoId
                      ? undefined
                      : c.thumbnailPhotoId,
                  updatedAt: now,
                }
              : c,
          ),
        });
      },

      setThumbnail: (customerId, photoId) => {
        const now = new Date().toISOString();
        set({
          customers: get().customers.map((c) =>
            c.id === customerId
              ? { ...c, thumbnailPhotoId: photoId, updatedAt: now }
              : c,
          ),
        });
      },

      // --- Pakiet A: voice notes ---
      addVoiceNote: (customerId, data) => {
        const customer = get().customers.find((c) => c.id === customerId);
        if (!customer) return null;
        const now = new Date().toISOString();
        const voice: MediaAttachment = {
          ...data,
          id: uuidv4(),
          createdAt: now,
        };
        set({
          customers: get().customers.map((c) =>
            c.id === customerId
              ? {
                  ...c,
                  voiceNotes: [...(c.voiceNotes ?? []), voice],
                  updatedAt: now,
                }
              : c,
          ),
        });
        return voice;
      },

      removeVoiceNote: (customerId, voiceId) => {
        const now = new Date().toISOString();
        set({
          customers: get().customers.map((c) =>
            c.id === customerId
              ? {
                  ...c,
                  voiceNotes: (c.voiceNotes ?? []).filter(
                    (v) => v.id !== voiceId,
                  ),
                  updatedAt: now,
                }
              : c,
          ),
        });
      },

      // --- Pakiet A: timeline ---
      addTimelineEntry: (customerId, data) => {
        const customer = get().customers.find((c) => c.id === customerId);
        if (!customer) return null;
        const now = new Date().toISOString();
        const entry: TimelineEntry = {
          ...data,
          id: uuidv4(),
          createdAt: now,
        };
        set({
          customers: get().customers.map((c) =>
            c.id === customerId
              ? {
                  ...c,
                  timeline: [...(c.timeline ?? []), entry],
                  updatedAt: now,
                  // Jeśli dodajemy wpis typu "visit", zaktualizuj lastVisit
                  // gdy jest świeższy niż obecny.
                  lastVisit: mergeLastVisit(c.lastVisit, entry),
                }
              : c,
          ),
        });
        return entry;
      },

      updateTimelineEntry: (customerId, entryId, patch) => {
        const now = new Date().toISOString();
        set({
          customers: get().customers.map((c) =>
            c.id === customerId
              ? {
                  ...c,
                  timeline: (c.timeline ?? []).map((e) =>
                    e.id === entryId ? { ...e, ...patch } : e,
                  ),
                  updatedAt: now,
                }
              : c,
          ),
        });
      },

      removeTimelineEntry: (customerId, entryId) => {
        const now = new Date().toISOString();
        set({
          customers: get().customers.map((c) =>
            c.id === customerId
              ? {
                  ...c,
                  timeline: (c.timeline ?? []).filter((e) => e.id !== entryId),
                  updatedAt: now,
                }
              : c,
          ),
        });
      },

      setThresholds: (thresholds) => set({ thresholds }),

      setTheme: (theme) => set({ theme }),

      setDefaultCountry: (defaultCountry) => set({ defaultCountry }),

      setNearbyRadiusKm: (km) => {
        // Clamp do zakresu suwaka — żeby nikt nie zepsuł stanu z poziomu konsoli
        // ani migracja ze starszej wersji nie wstrzyknęła np. 0 albo NaN-a.
        const safe = Number.isFinite(km)
          ? Math.max(1, Math.min(50, Math.round(km)))
          : 5;
        set({ nearbyRadiusKm: safe });
      },
    }),
    {
      name: getActiveStorageKey(),
      version: 6,
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

        // --- v3 -> v4: pakiet A (photos / voiceNotes / timeline) ---
        // Pola są opcjonalne, więc migracja jest "no-op" – wystarczy,
        // że bumpujemy wersję. Przy okazji normalizujemy shape, żeby
        // nigdy nie czytać niczego dziwnego ze starszych wersji.
        if (fromVersion < 4) {
          const arr = Array.isArray(state.customers)
            ? (state.customers as Array<Record<string, unknown>>)
            : [];
          state.customers = arr.map((c) => ({
            ...c,
            photos: Array.isArray(c.photos) ? c.photos : undefined,
            voiceNotes: Array.isArray(c.voiceNotes) ? c.voiceNotes : undefined,
            timeline: Array.isArray(c.timeline) ? c.timeline : undefined,
          }));
        }

        // --- v4 -> v5: dodajemy nearbyRadiusKm (default 5 km). ---
        if (fromVersion < 5) {
          if (
            typeof state.nearbyRadiusKm !== "number" ||
            !Number.isFinite(state.nearbyRadiusKm)
          ) {
            state.nearbyRadiusKm = 5;
          }
        }

        // --- v5 -> v6: legacy pola → customFields, wywalamy professions ze stanu ---
        // Wszystkie pola kontaktowe (phone, phone2, email, website, company,
        // profession) to teraz user-defined. Zachowujemy je jednak w obiekcie
        // klienta (typ ma je jako @deprecated optional) — żeby:
        //   1) eksport JSON był wstecznie kompatybilny z czytnikiem v5
        //   2) gdyby coś poszło nie tak z migracją, dane nie są stracone
        // CustomerForm i pozostałe UI czytają tylko `customFields` od teraz.
        if (fromVersion < 6) {
          const arr = Array.isArray(state.customers)
            ? (state.customers as Array<Record<string, unknown>>)
            : [];
          state.customers = arr.map((c) => {
            // Jeśli ktoś ręcznie eksperymentował i ma już customFields – zostaw
            const existing = Array.isArray(c.customFields)
              ? (c.customFields as Customer["customFields"])
              : undefined;
            const fromLegacy = legacyToCustomFields({
              company: typeof c.company === "string" ? c.company : undefined,
              profession:
                typeof c.profession === "string" ? c.profession : undefined,
              phone: typeof c.phone === "string" ? c.phone : undefined,
              phone2: typeof c.phone2 === "string" ? c.phone2 : undefined,
              email: typeof c.email === "string" ? c.email : undefined,
              website: typeof c.website === "string" ? c.website : undefined,
            });
            return {
              ...c,
              customFields:
                existing && existing.length > 0 ? existing : fromLegacy,
            };
          });
          // Sprzątanie: globalne settings profesji nie są już używane
          delete state.professions;
          delete state.activeProfession;
        }

        return state as CustomersState;
      },
    },
  ),
);

function mergeLastVisit(
  current: string | undefined,
  entry: TimelineEntry,
): string | undefined {
  if (entry.kind !== "visit") return current;
  if (!current) return entry.date;
  return new Date(entry.date) > new Date(current) ? entry.date : current;
}

// re-eksport dla wygody importów w innych plikach (jeżeli potrzebne)
export type { TimelineKind };
