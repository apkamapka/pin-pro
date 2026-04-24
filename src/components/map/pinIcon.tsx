import L from "leaflet";
import { MapPin } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Category, Customer } from "@/types/customer";
import { getPinAppearance } from "@/lib/pinColor";
import type { ColorThresholds } from "@/types/customer";
import { getIconByKey } from "@/lib/iconPalette";

export { TONE_HEX } from "@/lib/pinColor";

/**
 * Kolejność wyboru ikony:
 *   1. customer.icon – ręczny override z pickera,
 *   2. icon z przypisanej kategorii,
 *   3. fallback – MapPin (neutralna szpilka).
 */
export function buildDivIcon(
  customer: Customer,
  today: Date,
  thresholds: ColorThresholds,
  categoryById?: (id: string) => Category | undefined,
): L.DivIcon {
  const { color, pulse } = getPinAppearance(
    customer,
    today,
    thresholds,
    categoryById,
  );

  // Priorytet ikony
  const fromCustomer = getIconByKey(customer.icon);
  let Icon = fromCustomer;
  if (!Icon && customer.categoryId && categoryById) {
    const cat = categoryById(customer.categoryId);
    Icon = getIconByKey(cat?.icon);
  }

  const iconElement = Icon ? (
    <Icon size={16} strokeWidth={2.5} />
  ) : (
    <MapPin size={16} strokeWidth={2.5} />
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
