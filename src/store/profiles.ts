import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";

export interface Profile {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  /** Base64 data-url for custom avatar/logo (optional). */
  logo?: string;
}

const AVATAR_COLORS = [
  "#8B5CF6", // purple
  "#3B82F6", // blue
  "#22C55E", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
];

function pickColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

interface ProfilesState {
  profiles: Profile[];
  activeProfileId: string | null;

  addProfile: (name: string) => Profile;
  updateProfile: (id: string, patch: Partial<Pick<Profile, "name" | "logo">>) => void;
  removeProfile: (id: string) => void;
  setActiveProfile: (id: string | null) => void;
}

export const useProfiles = create<ProfilesState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,

      addProfile: (name: string) => {
        const profile: Profile = {
          id: uuidv4(),
          name,
          color: pickColor(get().profiles.length),
          createdAt: new Date().toISOString(),
        };
        set({ profiles: [...get().profiles, profile] });
        return profile;
      },

      updateProfile: (id: string, patch: Partial<Pick<Profile, "name" | "logo">>) => {
        set({
          profiles: get().profiles.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        });
      },

      removeProfile: (id: string) => {
        // Clean up profile's customer data from localStorage
        try {
          localStorage.removeItem(`serwismap-data-${id}`);
        } catch {
          /* ignore */
        }
        const { profiles, activeProfileId } = get();
        set({
          profiles: profiles.filter((p) => p.id !== id),
          activeProfileId: activeProfileId === id ? null : activeProfileId,
        });
      },

      setActiveProfile: (id: string | null) => {
        set({ activeProfileId: id });
      },
    }),
    {
      name: "mapelo-profiles",
      version: 1,
    },
  ),
);

/**
 * Returns the localStorage key for the customers store
 * of the currently active profile.
 * Falls back to "serwismap-data" for backward compatibility
 * (data created before profiles existed).
 */
export function getActiveStorageKey(): string {
  try {
    const raw = localStorage.getItem("mapelo-profiles");
    if (raw) {
      const parsed = JSON.parse(raw);
      const id = parsed?.state?.activeProfileId;
      if (typeof id === "string" && id.length > 0) {
        return `serwismap-data-${id}`;
      }
    }
  } catch {
    /* ignore */
  }
  return "serwismap-data";
}
