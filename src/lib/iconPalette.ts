import {
  AlertTriangle,
  Briefcase,
  Building2,
  CheckCircle2,
  Droplet,
  Flame,
  Heart,
  Home,
  Package,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type PinIconKey =
  | "auto"
  | "wrench"
  | "flame"
  | "droplet"
  | "zap"
  | "home"
  | "building"
  | "briefcase"
  | "heart"
  | "star"
  | "shield"
  | "alert"
  | "stethoscope"
  | "package"
  | "check";

interface IconDef {
  key: PinIconKey;
  Icon: LucideIcon;
  /** i18n key fragment — `icon.${labelKey}` */
  labelKey: string;
}

/**
 * Uniwersalna paleta ikon. `auto` = użyj ikony wynikającej ze statusu
 * (domyślne zachowanie sprzed dodania pickera). Reszta nadpisuje.
 */
export const ICON_PALETTE: IconDef[] = [
  { key: "auto", Icon: Sparkles, labelKey: "auto" },
  { key: "wrench", Icon: Wrench, labelKey: "wrench" },
  { key: "flame", Icon: Flame, labelKey: "flame" },
  { key: "droplet", Icon: Droplet, labelKey: "droplet" },
  { key: "zap", Icon: Zap, labelKey: "zap" },
  { key: "home", Icon: Home, labelKey: "home" },
  { key: "building", Icon: Building2, labelKey: "building" },
  { key: "briefcase", Icon: Briefcase, labelKey: "briefcase" },
  { key: "heart", Icon: Heart, labelKey: "heart" },
  { key: "star", Icon: Star, labelKey: "star" },
  { key: "shield", Icon: ShieldCheck, labelKey: "shield" },
  { key: "alert", Icon: AlertTriangle, labelKey: "alert" },
  { key: "stethoscope", Icon: Stethoscope, labelKey: "stethoscope" },
  { key: "package", Icon: Package, labelKey: "package" },
  { key: "check", Icon: CheckCircle2, labelKey: "check" },
];

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICON_PALETTE.map((d) => [d.key, d.Icon]),
);

export function getIconByKey(key: string | undefined): LucideIcon | null {
  if (!key || key === "auto") return null;
  return ICON_MAP[key] ?? null;
}

export function isValidIconKey(key: string | undefined): key is PinIconKey {
  if (!key) return false;
  return key in ICON_MAP;
}
