import { useState } from "react";
import { format } from "date-fns";
import { Plus, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfiles } from "@/store/profiles";
import type { Profile } from "@/store/profiles";
import { useT } from "@/lib/i18n";

export function ProfileSelect() {
  const t = useT();
  const profiles = useProfiles((s) => s.profiles);
  const addProfile = useProfiles((s) => s.addProfile);
  const removeProfile = useProfiles((s) => s.removeProfile);
  const setActiveProfile = useProfiles((s) => s.setActiveProfile);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const handleSelect = (profile: Profile) => {
    setActiveProfile(profile.id);
    // Reload so the customers store picks up the new storage key
    window.location.reload();
  };

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const profile = addProfile(trimmed);
    setNewName("");
    setAdding(false);
    // Auto-select the new profile
    setActiveProfile(profile.id);
    window.location.reload();
  };

  const handleRemove = (e: React.MouseEvent, profile: Profile) => {
    e.stopPropagation();
    if (!window.confirm(`${t.profileDeleteConfirm} "${profile.name}"?`)) return;
    removeProfile(profile.id);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center bg-gradient-to-b from-blue-50 to-white px-4 pt-12 pb-8 dark:from-slate-900 dark:to-slate-950">
      {/* Logo */}
      <div className="mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-lg">
        <span className="text-3xl font-bold text-primary-foreground">M</span>
      </div>
      <h1 className="mb-1 text-xl font-bold text-foreground">
        <span>Map</span>
        <span className="text-green-500">elo</span>
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">{t.profileChoose}</p>

      {/* Profile list */}
      <div className="w-full max-w-sm space-y-3">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            onClick={() => handleSelect(profile)}
            className="flex w-full items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent"
          >
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-sm"
              style={{ backgroundColor: profile.color }}
            >
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate font-semibold text-card-foreground">
                {profile.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(profile.createdAt), "dd.MM.yyyy")}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => handleRemove(e, profile)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title={t.profileDelete}
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>
        ))}

        {/* Add profile form */}
        {adding ? (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={t.profileNamePlaceholder}
              className="mb-3 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              maxLength={30}
            />
            <div className="flex gap-2">
              <Button onClick={handleAdd} className="flex-1" disabled={!newName.trim()}>
                {t.profileCreate}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setAdding(false); setNewName(""); }}
              >
                {t.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => setAdding(true)}
            className="w-full bg-green-500 hover:bg-green-600 text-white"
            size="lg"
          >
            <Plus className="mr-2 h-5 w-5" />
            {t.profileAdd}
          </Button>
        )}
      </div>
    </div>
  );
}
