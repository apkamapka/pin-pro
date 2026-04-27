/**
 * Geo-distance helpers dla feature "W okolicy".
 *
 * Pure functions: trzymamy tu tylko rachunki na liczbach + formatery,
 * bez React-a, bez dostępu do GPS, bez nawiasów do store'a.
 * Wszystkie zależności od UI siedzą w komponencie / hooku.
 */
import type { Customer } from "@/types/customer";

/** Promień Ziemi w kilometrach (uśredniony, IUGG mean). */
const EARTH_RADIUS_KM = 6371.0088;

/**
 * Odległość po wielkim okręgu (Haversine) między dwoma punktami GPS.
 *
 * Wzór jest dokładny do ~0.5% dla Ziemi (która lekko spłaszczona jest
 * elipsoidą, ale dla typowych odległości terenowych <200 km błąd < 100 m).
 * Dla naszych potrzeb — szukania klientów w promieniu 1–50 km — to zdecydowanie
 * wystarcza, a wzór jest stabilny numerycznie dla małych odległości
 * (w przeciwieństwie do prostszego "law of cosines").
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** Klient + odległość w km od punktu obserwatora. */
export interface CustomerWithDistance {
  customer: Customer;
  distanceKm: number;
}

/**
 * Filtruje klientów do tych w promieniu `radiusKm` od punktu (originLat, originLng)
 * i sortuje rosnąco po odległości.
 *
 * Klienci bez prawidłowych współrzędnych (NaN, undefined) są pomijani.
 * Klienci dokładnie w punkcie obserwatora są też włączeni (distance 0).
 */
export function findNearby(
  customers: Customer[],
  originLat: number,
  originLng: number,
  radiusKm: number,
): CustomerWithDistance[] {
  if (
    !Number.isFinite(originLat) ||
    !Number.isFinite(originLng) ||
    !Number.isFinite(radiusKm) ||
    radiusKm <= 0
  ) {
    return [];
  }

  const result: CustomerWithDistance[] = [];
  for (const c of customers) {
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
    const distanceKm = haversineKm(originLat, originLng, c.lat, c.lng);
    if (distanceKm <= radiusKm) {
      result.push({ customer: c, distanceKm });
    }
  }
  result.sort((a, b) => a.distanceKm - b.distanceKm);
  return result;
}

/**
 * Formatuje odległość do krótkiej, ludzkiej formy.
 *
 * Reguła: poniżej 1 km — w metrach (zaokrąglone do 10 m, bo GPS i tak
 * tyle nie trafi); od 1 km — w km z 1 miejscem po przecinku do 9.9 km,
 * od 10 km — w pełnych km. To jest ten sam pattern co Google Maps i
 * większość map mobilnych — ludzie czytają to "od ręki".
 */
export function formatDistance(km: number, lang: "pl" | "en"): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 1) {
    const meters = Math.round(km * 1000 / 10) * 10;
    return lang === "pl" ? `${meters} m` : `${meters} m`;
  }
  if (km < 10) {
    // 1.0–9.9 km
    return lang === "pl"
      ? `${km.toFixed(1).replace(".", ",")} km`
      : `${km.toFixed(1)} km`;
  }
  return `${Math.round(km)} km`;
}

/**
 * Liczy ilu z klientów w okolicy ma przeterminowany termin.
 * Pomocniczy helper dla bannera "w pobliżu masz X przeterminowanych".
 *
 * "Przeterminowany" znaczy: ma `nextAppointment` w przeszłości i nie jest `isDone`.
 * Spójne z TodayView i pinColor (tone "overdue").
 */
export function countOverdueNearby(
  nearby: CustomerWithDistance[],
  now: Date = new Date(),
): number {
  const nowMs = now.getTime();
  let n = 0;
  for (const { customer } of nearby) {
    if (customer.isDone) continue;
    if (!customer.nextAppointment) continue;
    if (new Date(customer.nextAppointment).getTime() < nowMs) n++;
  }
  return n;
}
