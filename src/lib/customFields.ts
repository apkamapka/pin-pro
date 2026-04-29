/**
 * Helpery do pracy z `Customer.customFields`.
 *
 * Centralne miejsce na:
 *  - migrację legacy pól (phone/email/website/phone2/company/profession) → customFields
 *  - wyciąganie konkretnego pola po typie (np. "pierwszy telefon do dzwonienia")
 *  - generowanie nowego pola (chip „+ Telefon" w formularzu)
 *  - default-labels dla typów (i18n po stronie woła `useT()` i podaje tutaj)
 */

import { v4 as uuidv4 } from "uuid";
import type {
  Customer,
  CustomField,
  CustomFieldType,
} from "@/types/customer";

/** Typy „chipów" które user widzi w formularzu jako szybkie skróty. */
export const CHIP_TYPES: CustomFieldType[] = ["phone", "email", "url", "tax_id"];

/** Tworzy nowe pole z domyślnym labelem. Caller podaje label już z i18n. */
export function makeCustomField(
  type: CustomFieldType,
  label: string,
  value = "",
): CustomField {
  return {
    id: uuidv4(),
    label,
    value,
    type,
  };
}

/** Zwraca pierwsze pole danego typu z niepustą wartością.
 *  Używane w MapView popup (tap-to-call) i innych miejscach gdzie chcemy
 *  „dowolny telefon" / „dowolny email" bez UI wyboru. */
export function getFirstFieldByType(
  customer: Pick<Customer, "customFields" | "phone" | "phone2" | "email" | "website">,
  type: CustomFieldType,
): CustomField | undefined {
  // 1) NOWE źródło prawdy – customFields
  const fromCustom = (customer.customFields ?? []).find(
    (f) => f.type === type && f.value.trim() !== "",
  );
  if (fromCustom) return fromCustom;

  // 2) FALLBACK – legacy pola (na wypadek gdyby migracja nie zadziałała,
  //    np. przy imporcie ze starego JSON-a). Zwracamy syntetyczne pole.
  if (type === "phone") {
    if (customer.phone?.trim()) {
      return { id: "legacy-phone", label: "Telefon", value: customer.phone, type };
    }
    if (customer.phone2?.trim()) {
      return { id: "legacy-phone2", label: "Telefon", value: customer.phone2, type };
    }
  }
  if (type === "email" && customer.email?.trim()) {
    return { id: "legacy-email", label: "E-mail", value: customer.email, type };
  }
  if (type === "url" && customer.website?.trim()) {
    return { id: "legacy-website", label: "Strona WWW", value: customer.website, type };
  }
  return undefined;
}

/** Zwraca wszystkie pola ze wszystkich źródeł (custom + legacy z fallbackami).
 *  Używane w CustomerDetail żeby wyświetlić wszystko po kolei.
 *
 *  Kluczowe: jeśli klient ma już customFields, NIE dorzucamy legacy żeby nie
 *  duplikować — chodzi o klientów z migracji v5→v6 którzy mają oba.
 *  Logika: jeśli `customFields` jest niepuste → używamy go.
 *          Jeśli puste lub brak → patrzymy na legacy.
 */
export function getAllCustomFields(
  customer: Pick<Customer, "customFields" | "phone" | "phone2" | "email" | "website" | "company" | "profession">,
): CustomField[] {
  const custom = customer.customFields ?? [];
  if (custom.length > 0) return custom;

  // Brak customFields → buduj z legacy (zwykle stary import JSON sprzed v6)
  return legacyToCustomFields(customer);
}

/** Konwersja legacy pól → tablica customFields. Używana przez:
 *  - migrację store v5→v6
 *  - getAllCustomFields() jako fallback dla bardzo starych klientów
 *  - import JSON-a z dawnej wersji aplikacji
 *
 *  Etykiety są tu „twardo" po polsku — bo migracja chodzi raz, w tle, bez
 *  kontekstu i18n. Przy okazji: user może zmienić każdą etykietę klikając ją
 *  w formularzu, więc to tylko punkt startowy. */
export function legacyToCustomFields(legacy: {
  company?: string;
  profession?: string;
  phone?: string;
  phone2?: string;
  email?: string;
  website?: string;
}): CustomField[] {
  const out: CustomField[] = [];
  const add = (type: CustomFieldType, label: string, value?: string) => {
    if (!value || !value.trim()) return;
    out.push({ id: uuidv4(), label, value: value.trim(), type });
  };
  add("phone", "Telefon", legacy.phone);
  add("phone", "Telefon", legacy.phone2);
  add("email", "E-mail", legacy.email);
  add("url", "Strona WWW", legacy.website);
  add("text", "Firma", legacy.company);
  add("text", "Profesja", legacy.profession);
  return out;
}

/** Walidacja przy zapisie: usuwamy puste pola (label i value oba puste).
 *  Pole z labelem ale bez wartości → zostaje (user mógł dodać chip i nie
 *  zdążyć wpisać wartości — przy następnej edycji niech zobaczy chip). */
export function pruneEmptyFields(fields: CustomField[]): CustomField[] {
  return fields.filter((f) => f.label.trim() !== "" || f.value.trim() !== "");
}
