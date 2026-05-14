import { useRef, useState } from "react";
import { format } from "date-fns";
import { Plus, Trash2, ChevronRight, Pencil, Camera, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfiles } from "@/store/profiles";
import type { Profile } from "@/store/profiles";
import { useT } from "@/lib/i18n";
import { compressImage } from "@/lib/mediaUtils";

/** Mapelo logo from uploaded brand asset */
function MapeloLogo({ size = 100 }: { size?: number }) {
  return (
    <img
      src="/mapelo-logo.png"
      alt="Mapelo"
      width={size}
      height={size}
      className="drop-shadow-lg"
      style={{ objectFit: "contain" }}
    />
  );
}

function ProfileAvatar({
  profile,
  size = 48,
}: {
  profile: Profile;
  size?: number;
}) {
  if (profile.logo) {
    return (
      <img
        src={profile.logo}
        alt={profile.name}
        className="shrink-0 rounded-full object-cover shadow-sm"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-sm"
      style={{
        width: size,
        height: size,
        backgroundColor: profile.color,
        fontSize: size * 0.4,
      }}
    >
      {profile.name.charAt(0).toUpperCase()}
    </div>
  );
}

export function ProfileSelect() {
  const t = useT();
  const profiles = useProfiles((s) => s.profiles);
  const addProfile = useProfiles((s) => s.addProfile);
  const updateProfile = useProfiles((s) => s.updateProfile);
  const removeProfile = useProfiles((s) => s.removeProfile);
  const setActiveProfile = useProfiles((s) => s.setActiveProfile);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoTargetId, setLogoTargetId] = useState<string | null>(null);

  const handleSelect = (profile: Profile) => {
    if (editingId === profile.id) return;
    setActiveProfile(profile.id);
    window.location.reload();
  };

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const profile = addProfile(trimmed);
    setNewName("");
    setAdding(false);
    setActiveProfile(profile.id);
    window.location.reload();
  };

  const handleRemove = (e: React.MouseEvent, profile: Profile) => {
    e.stopPropagation();
    if (!window.confirm(`${t.profileDeleteConfirm} "${profile.name}"?`)) return;
    removeProfile(profile.id);
  };

  const startEdit = (e: React.MouseEvent, profile: Profile) => {
    e.stopPropagation();
    setEditingId(profile.id);
    setEditName(profile.name);
  };

  const saveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingId) return;
    const trimmed = editName.trim();
    if (trimmed) {
      updateProfile(editingId, { name: trimmed });
    }
    setEditingId(null);
    setEditName("");
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditName("");
  };

  const triggerLogoUpload = (e: React.MouseEvent, profileId: string) => {
    e.stopPropagation();
    setLogoTargetId(profileId);
    logoInputRef.current?.click();
  };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !logoTargetId) return;
    try {
      const compressed = await compressImage(file, {
        maxDim: 256,
        quality: 0.8,
      });
      updateProfile(logoTargetId, { logo: compressed.dataUrl });
    } catch {
      /* ignore */
    } finally {
      setLogoTargetId(null);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const removeLogo = (e: React.MouseEvent, profileId: string) => {
    e.stopPropagation();
    updateProfile(profileId, { logo: undefined });
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center bg-gradient-to-b from-blue-50 to-white px-4 pt-12 pb-8 dark:from-slate-900 dark:to-slate-950">
      {/* Hidden file input for logo uploads */}
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLogoFile}
      />

      {/* Mapelo Logo */}
      <MapeloLogo size={100} />
      <h1 className="mt-2 mb-1 text-xl font-bold text-foreground">
        <span>Map</span>
        <span className="text-green-500">elo</span>
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">{t.profileChoose}</p>

      {/* Profile list */}
      <div className="w-full max-w-sm space-y-3">
        {profiles.map((profile) => {
          const isEditing = editingId === profile.id;

          return (
            <button
              key={profile.id}
              onClick={() => handleSelect(profile)}
              className="flex w-full items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent"
            >
              {/* Avatar with camera overlay when editing */}
              <div className="relative">
                <ProfileAvatar profile={profile} size={48} />
                {isEditing && (
                  <button
                    onClick={(e) => triggerLogoUpload(e, profile.id)}
                    className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
                    title={t.profileChangeLogo}
                  >
                    <Camera className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="min-w-0 flex-1 text-left">
                {isEditing ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(e as unknown as React.MouseEvent);
                      if (e.key === "Escape") cancelEdit(e as unknown as React.MouseEvent);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary"
                    maxLength={30}
                  />
                ) : (
                  <div className="truncate font-semibold text-card-foreground">
                    {profile.name}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {format(new Date(profile.createdAt), "dd.MM.yyyy")}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {isEditing ? (
                  <>
                    {profile.logo && (
                      <button
                        onClick={(e) => removeLogo(e, profile.id)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title={t.profileRemoveLogo}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={saveEdit}
                      className="rounded-lg p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20"
                      title={t.profileSave}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={(e) => startEdit(e, profile)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title={t.profileEdit}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => handleRemove(e, profile)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title={t.profileDelete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </>
                )}
              </div>
            </button>
          );
        })}

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

      {/* Footer — "stworzone przez akApp" */}
      <div className="mt-auto pt-10 pb-6 flex flex-col items-center gap-3 text-xs text-muted-foreground">
        <span>{t.madeBy}</span>
        <a
          href="https://akappstudio.pl/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-foreground transition-opacity hover:opacity-80"
        >
          akApp
        </a>
      </div>
    </div>
  );
}
