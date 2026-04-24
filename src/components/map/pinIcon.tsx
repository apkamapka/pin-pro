import L from "leaflet";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Customer } from "@/types/customer";
import {
  getPinAppearance,
  type PinTone,
} from "@/lib/pinColor";
import type { ColorThresholds } from "@/types/customer";
import { getIconByKey } from "@/lib/iconPalette";

const STATUS_ICONS: Record<Customer["status"], JSX.Element> = {
  new: <Sparkles size={16} strokeWidth={2.5} />,
  in_progress: <Wrench size={16} strokeWidth={2.5} />,
  done: <CheckCircle2 size={16} strokeWidth={2.5} />,
  warranty: <ShieldCheck size={16} strokeWidth={2.5} />,
  issue: <AlertTriangle size={16} strokeWidth={2.5} />,
};

export function buildDivIcon(
  customer: Customer,
  today: Date,
  thresholds: ColorThresholds,
): L.DivIcon {
  const { color, pulse } = getPinAppearance(customer, today, thresholds);

  // Priorytet: ręczny wybór ikony > ikona ze statusu > zegarek jako fallback.
  const CustomIcon = getIconByKey(customer.icon);
  const iconElement = CustomIcon ? (
    <CustomIcon size={16} strokeWidth={2.5} />
  ) : (
    STATUS_ICONS[customer.status] ?? <Clock size={16} strokeWidth={2.5} />
  );
  const iconHtml = renderToStaticMarkup(iconElement);
  const html = `<div class="serwis-pin${pulse ? " pulse" : ""}" style="background:${color}">${iconHtml}</div>`;
  return L.divIcon({
    html,
    className: "serwis-pin-wrapper",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

export const TONE_HEX: Record<PinTone, string> = {
  done: "#6b7280",
  issue: "#dc2626",
  overdue: "#dc2626",
  soon: "#ea580c",
  upcoming: "#eab308",
  later: "#16a34a",
  future: "#2563eb",
  new: "#2563eb",
  progress: "#ea580c",
  warranty: "#9333ea",
};
