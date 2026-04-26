/**
 * Auto-mapping kolumn z importowanego pliku do pól modelu Customer.
 *
 * Heurystyka: normalizujemy każdy nagłówek (lowercase, bez diakrytyków,
 * bez znaków specjalnych) i sprawdzamy czy zawiera któryś z patternów PL/EN
 * dla danego pola. Pierwsze trafienie wygrywa (lecimy w kolejności
 * priorytetów — np. `address` przed `city`, żeby "Adres pocztowy" nie
 * trafił do `city`).
 *
 * Mapping jest niedoskonały — user zawsze widzi co apka dopasowała i może
 * to zmienić w wizardzie.
 */

/** Kanoniczne pola schematu które user może mapować. */
export type SchemaField =
  | "name"
  | "firstName"
  | "lastName"
  | "company"
  | "address"
  | "street"
  | "city"
  | "postalCode"
  | "phone"
  | "phone2"
  | "email"
  | "website"
  | "notes"
  | "tags"
  | "lastVisit"
  | "nextAppointment";

export const SCHEMA_FIELDS: SchemaField[] = [
  "name",
  "firstName",
  "lastName",
  "company",
  "address",
  "street",
  "city",
  "postalCode",
  "phone",
  "phone2",
  "email",
  "website",
  "notes",
  "tags",
  "lastVisit",
  "nextAppointment",
];

/** Mapping: SchemaField -> nazwa nagłówka w pliku. Nagłówki, które nie
 *  zostały zmapowane, trafią do pola `notes` z prefiksem nazwy nagłówka.  */
export type ColumnMapping = Partial<Record<SchemaField, string>>;

/**
 * Patterny (po normalizacji) dla każdego pola. Kolejność wewnątrz tablicy
 * nie ma znaczenia — testujemy wszystkie. Kolejność zewnętrzna (FIELD_ORDER)
 * decyduje o priorytecie gdy ten sam nagłówek mógłby pasować do dwóch pól.
 */
const PATTERNS: Record<SchemaField, string[]> = {
  // Nazwa pełna — łapie "imię i nazwisko" połączone, "klient", "nazwa", "kontakt"
  name: [
    "imienazwisko",
    "imieinazwisko",
    "nazwa",
    "nazwaklienta",
    "klient",
    "kontakt",
    "name",
    "fullname",
    "customername",
    "client",
    "contact",
  ],
  // Imię (gdy osobno od nazwiska)
  firstName: ["imie", "firstname", "givenname"],
  // Nazwisko (gdy osobno)
  lastName: ["nazwisko", "lastname", "surname", "familyname"],
  company: [
    "firma",
    "nazwafirmy",
    "company",
    "companyname",
    "organization",
    "nip",
  ],
  // Pełny adres jednym polem
  address: [
    "adres",
    "adresklienta",
    "adrespocztowy",
    "address",
    "addressline",
    "fulladdress",
    "lokalizacja",
    "location",
  ],
  street: ["ulica", "street", "streetaddress"],
  city: ["miasto", "miejscowosc", "city", "town"],
  postalCode: [
    "kodpocztowy",
    "kod",
    "kodpoczt",
    "zip",
    "zipcode",
    "postcode",
    "postalcode",
  ],
  phone: [
    "telefon",
    "tel",
    "telkomorkowy",
    "komorka",
    "telefonkomorkowy",
    "numertelefonu",
    "nrtelefonu",
    "phone",
    "phonenumber",
    "mobile",
    "mobilephone",
    "cell",
  ],
  phone2: [
    "telefon2",
    "tel2",
    "telefondodatkowy",
    "telefonstacjonarny",
    "phone2",
    "telephone2",
    "alternatephone",
  ],
  email: ["email", "mail", "adresemail", "epost", "emailaddress"],
  website: ["www", "strona", "stronawww", "website", "url", "site"],
  notes: [
    "uwagi",
    "notatki",
    "notatka",
    "komentarz",
    "opis",
    "notes",
    "note",
    "comment",
    "comments",
    "description",
    "remarks",
  ],
  tags: ["tag", "tagi", "etykieta", "etykiety", "labels", "tags"],
  lastVisit: [
    "ostatniawizyta",
    "datawizyty",
    "dataostatniejwizyty",
    "ostatnikontakt",
    "ostatniserwis",
    "datazakupu",
    "lastvisit",
    "lastcontact",
    "lastservice",
  ],
  nextAppointment: [
    "nastepnawizyta",
    "termin",
    "terminkolejnejwizyty",
    "kolejnawizyta",
    "datakolejnejwizyty",
    "datanastepnejwizyty",
    "przyszlawizyta",
    "nextvisit",
    "nextcontact",
    "nextappointment",
    "duedate",
    "appointment",
  ],
};

/**
 * Kolejność testowania pól. Bardziej specyficzne idą najpierw, żeby
 * "Adres email" nie wpadł do `address`.
 */
const FIELD_ORDER: SchemaField[] = [
  "email",
  "website",
  "phone2",
  "phone",
  "postalCode",
  "city",
  "street",
  "address",
  "company",
  "firstName",
  "lastName",
  "name",
  "lastVisit",
  "nextAppointment",
  "notes",
  "tags",
];

/** Normalizuj nagłówek do "klucza porównania". Eksportowane do testów. */
export function normalizeHeader(raw: string): string {
  return raw
    .toLocaleLowerCase("pl-PL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // diakrytyki
    .replace(/ł/g, "l")
    .replace(/Ł/g, "l")
    .replace(/[^a-z0-9]/g, ""); // tylko litery + cyfry
}

/** Dopasuj jeden nagłówek do jednego z pól schematu (albo null).
 *
 *  Algorytm: najdłuższy pasujący pattern wygrywa. Dzięki temu
 *  "Imię i nazwisko" (norm: "imieinazwisko") matchuje patten `imieinazwisko`
 *  (12 znaków, name) zamiast `imie` (4 znaki, firstName), bez konieczności
 *  ręcznego ustawiania priorytetów. Przy remisie długości — kolejność
 *  z FIELD_ORDER decyduje.
 */
export function matchHeaderToField(header: string): SchemaField | null {
  const norm = normalizeHeader(header);
  if (!norm) return null;

  let bestField: SchemaField | null = null;
  let bestLen = 0;
  let bestRank = Infinity;

  for (let i = 0; i < FIELD_ORDER.length; i++) {
    const field = FIELD_ORDER[i];
    const patterns = PATTERNS[field];
    for (const pattern of patterns) {
      const matches = norm === pattern || norm.includes(pattern);
      if (!matches) continue;
      // Dłuższy pattern wygrywa. Przy równej długości — wcześniejszy w FIELD_ORDER.
      if (
        pattern.length > bestLen ||
        (pattern.length === bestLen && i < bestRank)
      ) {
        bestField = field;
        bestLen = pattern.length;
        bestRank = i;
      }
    }
  }
  return bestField;
}

/**
 * Auto-mapuj zestaw nagłówków. Jeśli ten sam SchemaField pasuje do dwóch
 * nagłówków – pierwszy wygrywa, drugi pozostaje niezmapowany (user może
 * to potem ręcznie zmienić w wizardzie).
 */
export function autoMapColumns(headers: string[]): {
  mapping: ColumnMapping;
  unmapped: string[];
} {
  const mapping: ColumnMapping = {};
  const unmapped: string[] = [];

  for (const header of headers) {
    const field = matchHeaderToField(header);
    if (field && !mapping[field]) {
      mapping[field] = header;
    } else {
      unmapped.push(header);
    }
  }

  return { mapping, unmapped };
}

/**
 * Sprawdzenie czy mapping wystarcza do utworzenia użytecznego klienta.
 * Wymagane minimum: jest jakaś nazwa (name LUB firstName/lastName LUB company)
 * oraz jest jakiś adres (address LUB street/city/postalCode).
 */
export function validateMapping(mapping: ColumnMapping): {
  ok: boolean;
  problems: Array<"no_name" | "no_address">;
} {
  const problems: Array<"no_name" | "no_address"> = [];

  const hasName =
    !!mapping.name ||
    !!mapping.firstName ||
    !!mapping.lastName ||
    !!mapping.company;
  if (!hasName) problems.push("no_name");

  const hasAddress =
    !!mapping.address ||
    !!mapping.street ||
    !!mapping.city ||
    !!mapping.postalCode;
  if (!hasAddress) problems.push("no_address");

  return { ok: problems.length === 0, problems };
}
