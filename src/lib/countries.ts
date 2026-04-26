/**
 * Baza krajów dla geokodowania.
 *
 * Zawiera dla każdego kraju:
 *  - kod ISO 3166-1 alpha-2 (lowercase, np. "pl") — używany przez Nominatim
 *  - emoji flagi do UI
 *  - nazwy PL/EN/native — do wyświetlenia w dropdown i do wykrywania
 *    kraju z tekstu adresu
 *  - aliasy do detekcji (lowercase, bez diakrytyków po normalizacji)
 *  - wzorzec kodu pocztowego (regex) — gdy unikalny dla kraju
 *
 * Detekcja kraju z adresu:
 *  1) Match nazwy/aliasu kraju w tekście — najmocniejszy sygnał.
 *  2) Match unikalnego wzorca kodu pocztowego (np. PL "33-383", NL
 *     "1011 AB", GB "SW1A 1AA"). Wspólne wzorce typu "5 cyfr" są
 *     niejednoznaczne (DE/FR/IT/ES/US wszystkie tego używają) i nie
 *     pozwalają na pewną detekcję.
 *  3) Fallback na default kraju z Settings.
 */

export interface CountryDef {
  /** Kod ISO 3166-1 alpha-2 lowercase (Nominatim format). */
  code: string;
  flag: string;
  namePl: string;
  nameEn: string;
  /** Aliasy do detekcji w tekście (już lowercase + zdejmiete diakrytyki). */
  aliases: string[];
  /** Unikalny wzorzec kodu pocztowego (gdy istnieje). Match na całym wzorcu. */
  postalRegex?: RegExp;
}

/**
 * Lista krajów. Kolejność wpływa tylko na dropdown w UI — alfabetycznie po
 * polskich nazwach z PL na początku.
 */
export const COUNTRIES: CountryDef[] = [
  // Najczęściej używane na początku
  {
    code: "pl",
    flag: "🇵🇱",
    namePl: "Polska",
    nameEn: "Poland",
    aliases: ["polska", "poland", "polen", "pologne", "polonia"],
    postalRegex: /\b\d{2}-\d{3}\b/,
  },
  {
    code: "de",
    flag: "🇩🇪",
    namePl: "Niemcy",
    nameEn: "Germany",
    aliases: ["niemcy", "germany", "deutschland", "allemagne", "germania"],
    // 5-digit, ambiguous z FR/IT/ES — bez postalRegex, polegamy na nazwie
  },
  {
    code: "gb",
    flag: "🇬🇧",
    namePl: "Wielka Brytania",
    nameEn: "United Kingdom",
    aliases: [
      "wielka brytania",
      "uk",
      "united kingdom",
      "great britain",
      "england",
      "anglia",
      "scotland",
      "szkocja",
      "wales",
      "walia",
    ],
    // UK postcode: AA9A 9AA / A9A 9AA / A9 9AA / A99 9AA / AA9 9AA / AA99 9AA
    postalRegex: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i,
  },
  {
    code: "us",
    flag: "🇺🇸",
    namePl: "USA",
    nameEn: "United States",
    aliases: [
      "usa",
      "united states",
      "stany zjednoczone",
      "u.s.a.",
      "u.s.",
    ],
  },
  {
    code: "cz",
    flag: "🇨🇿",
    namePl: "Czechy",
    nameEn: "Czech Republic",
    aliases: ["czechy", "czech republic", "cesko", "tschechien", "czechia"],
    // 3+2: "110 00" — niestety SK ma identyczny format
  },
  {
    code: "sk",
    flag: "🇸🇰",
    namePl: "Słowacja",
    nameEn: "Slovakia",
    aliases: ["slowacja", "slovakia", "slovensko", "slowakei"],
  },
  {
    code: "ua",
    flag: "🇺🇦",
    namePl: "Ukraina",
    nameEn: "Ukraine",
    aliases: ["ukraina", "ukraine", "ukrayina"],
  },

  // Reszta po polsku alfabetycznie
  {
    code: "al",
    flag: "🇦🇱",
    namePl: "Albania",
    nameEn: "Albania",
    aliases: ["albania", "shqiperia"],
  },
  {
    code: "ad",
    flag: "🇦🇩",
    namePl: "Andora",
    nameEn: "Andorra",
    aliases: ["andora", "andorra"],
  },
  {
    code: "ar",
    flag: "🇦🇷",
    namePl: "Argentyna",
    nameEn: "Argentina",
    aliases: ["argentyna", "argentina"],
  },
  {
    code: "au",
    flag: "🇦🇺",
    namePl: "Australia",
    nameEn: "Australia",
    aliases: ["australia"],
  },
  {
    code: "at",
    flag: "🇦🇹",
    namePl: "Austria",
    nameEn: "Austria",
    aliases: ["austria", "osterreich"],
  },
  {
    code: "be",
    flag: "🇧🇪",
    namePl: "Belgia",
    nameEn: "Belgium",
    aliases: ["belgia", "belgium", "belgique", "belgie", "belgien"],
  },
  {
    code: "by",
    flag: "🇧🇾",
    namePl: "Białoruś",
    nameEn: "Belarus",
    aliases: ["bialorus", "belarus", "belorussia"],
  },
  {
    code: "ba",
    flag: "🇧🇦",
    namePl: "Bośnia i Hercegowina",
    nameEn: "Bosnia and Herzegovina",
    aliases: ["bosnia", "bosnia i hercegowina", "bosnia and herzegovina"],
  },
  {
    code: "br",
    flag: "🇧🇷",
    namePl: "Brazylia",
    nameEn: "Brazil",
    aliases: ["brazylia", "brazil", "brasil"],
    postalRegex: /\b\d{5}-\d{3}\b/, // 01310-100 — UWAGA: PT też ma 4-3 ale różny pattern
  },
  {
    code: "bg",
    flag: "🇧🇬",
    namePl: "Bułgaria",
    nameEn: "Bulgaria",
    aliases: ["bulgaria"],
  },
  {
    code: "hr",
    flag: "🇭🇷",
    namePl: "Chorwacja",
    nameEn: "Croatia",
    aliases: ["chorwacja", "croatia", "hrvatska"],
  },
  {
    code: "cy",
    flag: "🇨🇾",
    namePl: "Cypr",
    nameEn: "Cyprus",
    aliases: ["cypr", "cyprus"],
  },
  {
    code: "dk",
    flag: "🇩🇰",
    namePl: "Dania",
    nameEn: "Denmark",
    aliases: ["dania", "denmark", "danmark"],
  },
  {
    code: "ee",
    flag: "🇪🇪",
    namePl: "Estonia",
    nameEn: "Estonia",
    aliases: ["estonia", "eesti"],
  },
  {
    code: "fi",
    flag: "🇫🇮",
    namePl: "Finlandia",
    nameEn: "Finland",
    aliases: ["finlandia", "finland", "suomi"],
  },
  {
    code: "fr",
    flag: "🇫🇷",
    namePl: "Francja",
    nameEn: "France",
    aliases: ["francja", "france", "frankreich"],
  },
  {
    code: "gr",
    flag: "🇬🇷",
    namePl: "Grecja",
    nameEn: "Greece",
    aliases: ["grecja", "greece", "ellada", "hellas"],
  },
  {
    code: "ge",
    flag: "🇬🇪",
    namePl: "Gruzja",
    nameEn: "Georgia",
    aliases: ["gruzja", "georgia", "sakartvelo"],
  },
  {
    code: "es",
    flag: "🇪🇸",
    namePl: "Hiszpania",
    nameEn: "Spain",
    aliases: ["hiszpania", "spain", "espana", "espagne"],
  },
  {
    code: "nl",
    flag: "🇳🇱",
    namePl: "Holandia",
    nameEn: "Netherlands",
    aliases: [
      "holandia",
      "netherlands",
      "nederland",
      "pays-bas",
      "niederlande",
    ],
    postalRegex: /\b\d{4}\s?[A-Z]{2}\b/, // 1011 AB
  },
  {
    code: "ie",
    flag: "🇮🇪",
    namePl: "Irlandia",
    nameEn: "Ireland",
    aliases: ["irlandia", "ireland", "eire"],
  },
  {
    code: "is",
    flag: "🇮🇸",
    namePl: "Islandia",
    nameEn: "Iceland",
    aliases: ["islandia", "iceland", "island"],
  },
  {
    code: "il",
    flag: "🇮🇱",
    namePl: "Izrael",
    nameEn: "Israel",
    aliases: ["izrael", "israel"],
  },
  {
    code: "jp",
    flag: "🇯🇵",
    namePl: "Japonia",
    nameEn: "Japan",
    aliases: ["japonia", "japan", "nihon", "nippon"],
    postalRegex: /\b\d{3}-\d{4}\b/, // 100-0001
  },
  {
    code: "ca",
    flag: "🇨🇦",
    namePl: "Kanada",
    nameEn: "Canada",
    aliases: ["kanada", "canada"],
    postalRegex: /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i, // M5V 3A8
  },
  {
    code: "cn",
    flag: "🇨🇳",
    namePl: "Chiny",
    nameEn: "China",
    aliases: ["chiny", "china", "zhongguo"],
  },
  {
    code: "kr",
    flag: "🇰🇷",
    namePl: "Korea Południowa",
    nameEn: "South Korea",
    aliases: [
      "korea poludniowa",
      "south korea",
      "korea",
      "republika korei",
      "republic of korea",
    ],
  },
  {
    code: "li",
    flag: "🇱🇮",
    namePl: "Liechtenstein",
    nameEn: "Liechtenstein",
    aliases: ["liechtenstein"],
  },
  {
    code: "lt",
    flag: "🇱🇹",
    namePl: "Litwa",
    nameEn: "Lithuania",
    aliases: ["litwa", "lithuania", "lietuva"],
    postalRegex: /\bLT-\d{5}\b/i,
  },
  {
    code: "lu",
    flag: "🇱🇺",
    namePl: "Luksemburg",
    nameEn: "Luxembourg",
    aliases: ["luksemburg", "luxembourg", "luxemburg"],
  },
  {
    code: "lv",
    flag: "🇱🇻",
    namePl: "Łotwa",
    nameEn: "Latvia",
    aliases: ["lotwa", "latvia", "latvija"],
    postalRegex: /\bLV-\d{4}\b/i,
  },
  {
    code: "mk",
    flag: "🇲🇰",
    namePl: "Macedonia Północna",
    nameEn: "North Macedonia",
    aliases: ["macedonia", "north macedonia", "macedonia polnocna"],
  },
  {
    code: "mt",
    flag: "🇲🇹",
    namePl: "Malta",
    nameEn: "Malta",
    aliases: ["malta"],
  },
  {
    code: "mx",
    flag: "🇲🇽",
    namePl: "Meksyk",
    nameEn: "Mexico",
    aliases: ["meksyk", "mexico", "mejico"],
  },
  {
    code: "md",
    flag: "🇲🇩",
    namePl: "Mołdawia",
    nameEn: "Moldova",
    aliases: ["moldawia", "moldova"],
  },
  {
    code: "mc",
    flag: "🇲🇨",
    namePl: "Monako",
    nameEn: "Monaco",
    aliases: ["monako", "monaco"],
  },
  {
    code: "me",
    flag: "🇲🇪",
    namePl: "Czarnogóra",
    nameEn: "Montenegro",
    aliases: ["czarnogora", "montenegro", "crna gora"],
  },
  {
    code: "no",
    flag: "🇳🇴",
    namePl: "Norwegia",
    nameEn: "Norway",
    aliases: ["norwegia", "norway", "norge"],
  },
  {
    code: "nz",
    flag: "🇳🇿",
    namePl: "Nowa Zelandia",
    nameEn: "New Zealand",
    aliases: ["nowa zelandia", "new zealand", "aotearoa"],
  },
  {
    code: "pt",
    flag: "🇵🇹",
    namePl: "Portugalia",
    nameEn: "Portugal",
    aliases: ["portugalia", "portugal"],
    postalRegex: /\b\d{4}-\d{3}\b/, // 1000-001 — uwaga, BR też używa 5-3
  },
  {
    code: "ro",
    flag: "🇷🇴",
    namePl: "Rumunia",
    nameEn: "Romania",
    aliases: ["rumunia", "romania", "romana"],
  },
  {
    code: "ru",
    flag: "🇷🇺",
    namePl: "Rosja",
    nameEn: "Russia",
    aliases: ["rosja", "russia", "russland", "rossia", "rossija"],
  },
  {
    code: "rs",
    flag: "🇷🇸",
    namePl: "Serbia",
    nameEn: "Serbia",
    aliases: ["serbia", "srbija"],
  },
  {
    code: "sg",
    flag: "🇸🇬",
    namePl: "Singapur",
    nameEn: "Singapore",
    aliases: ["singapur", "singapore"],
  },
  {
    code: "si",
    flag: "🇸🇮",
    namePl: "Słowenia",
    nameEn: "Slovenia",
    aliases: ["slowenia", "slovenia", "slovenija"],
  },
  {
    code: "ch",
    flag: "🇨🇭",
    namePl: "Szwajcaria",
    nameEn: "Switzerland",
    aliases: [
      "szwajcaria",
      "switzerland",
      "schweiz",
      "suisse",
      "svizzera",
    ],
  },
  {
    code: "se",
    flag: "🇸🇪",
    namePl: "Szwecja",
    nameEn: "Sweden",
    aliases: ["szwecja", "sweden", "sverige"],
  },
  {
    code: "tr",
    flag: "🇹🇷",
    namePl: "Turcja",
    nameEn: "Turkey",
    aliases: ["turcja", "turkey", "turkiye"],
  },
  {
    code: "hu",
    flag: "🇭🇺",
    namePl: "Węgry",
    nameEn: "Hungary",
    aliases: ["wegry", "hungary", "magyarorszag", "ungarn"],
  },
  {
    code: "it",
    flag: "🇮🇹",
    namePl: "Włochy",
    nameEn: "Italy",
    aliases: ["wlochy", "italy", "italia", "italien"],
  },
];

/** Wartość specjalna w UI dla "auto-detect / mieszane / bez filtra". */
export const COUNTRY_AUTO = "auto" as const;

/** Quick lookup po kodzie. */
const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function getCountry(code: string): CountryDef | undefined {
  return COUNTRY_BY_CODE.get(code.toLowerCase());
}

/** Normalizacja tekstu do porównania z aliasami (lowercase + bez diakrytyków). */
export function normalizeForCountryMatch(s: string): string {
  return s
    .toLocaleLowerCase("pl-PL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "l");
}

export interface CountryDetection {
  /** Kod kraju (lowercase) lub null gdy nic nie wykryto. */
  code: string | null;
  /** Pewność detekcji. */
  confidence: "high" | "medium" | "none";
  /** Co zadziałało: nazwa kraju w tekście, czy unikalny postal pattern. */
  reason: "name" | "postal" | null;
}

/**
 * Wykrywa kraj z adresu na podstawie:
 *  1) nazwy kraju w tekście (high confidence)
 *  2) unikalnego wzorca kodu pocztowego (high confidence — bo wzorce
 *     na liście są tylko jednoznaczne; ambiguous "5 cyfr" celowo pominęliśmy)
 */
export function detectCountry(address: string): CountryDetection {
  const normalized = normalizeForCountryMatch(address);

  // 1) Match nazwy kraju w tekście (na granicy słowa albo blisko niej).
  for (const c of COUNTRIES) {
    for (const alias of c.aliases) {
      // Match na granicy słowa żeby "po" nie zmatchowało Polski w "post"
      const re = new RegExp(`(^|\\W)${escapeRegex(alias)}(\\W|$)`, "i");
      if (re.test(normalized)) {
        return { code: c.code, confidence: "high", reason: "name" };
      }
    }
  }

  // 2) Match wzorca kodu pocztowego — tylko unikalne wzorce.
  // PL ma "33-383" (XX-XXX), GB ma "SW1A 1AA" itd. — wzorce nie kolidują.
  // Wyjątek: PT "1000-001" wygląda jak BR "01310-100" (oba 4-3 lub 5-3).
  // Dlatego BR ma /\d{5}-\d{3}/, PT ma /\d{4}-\d{3}/ — nie kolidują.
  for (const c of COUNTRIES) {
    if (c.postalRegex && c.postalRegex.test(address)) {
      return { code: c.code, confidence: "high", reason: "postal" };
    }
  }

  return { code: null, confidence: "none", reason: null };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
