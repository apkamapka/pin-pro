import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Lang = "pl" | "en";

const dict = {
  pl: {
    appName: "SerwisMap",
    map: "Mapa",
    customers: "Klienci",
    today: "Dziś",
    settings: "Ustawienia",
    addCustomer: "Dodaj klienta",
    editCustomer: "Edytuj klienta",
    save: "Zapisz",
    cancel: "Anuluj",
    delete: "Usuń",
    edit: "Edytuj",
    markDone: "Oznacz jako zakończone",
    markActive: "Oznacz jako aktywne",

    // Pole główne klienta — neutralne, bez "Imię i nazwisko"
    name: "Nazwa",
    namePlaceholder: "Imię, nazwa firmy, miejsca…",

    address: "Adres",
    geocode: "Geokoduj",
    phone: "Telefon",
    phone2: "Telefon dodatkowy",
    email: "E-mail",
    website: "Strona WWW",
    company: "Firma",
    clientProfession: "Zawód / branża klienta",
    clientProfessionPlaceholder: "np. Nauczyciel, Lekarz, Kierowca",
    icon: "Ikona",
    iconAuto: "Auto (z kategorii)",
    iconNames: {
      auto: "Auto",
      wrench: "Klucz",
      flame: "Ogień",
      droplet: "Woda",
      zap: "Prąd",
      home: "Dom",
      building: "Firma",
      briefcase: "Biznes",
      heart: "Serce",
      star: "Gwiazda",
      shield: "Tarcza",
      alert: "Uwaga",
      stethoscope: "Medycyna",
      package: "Paczka",
      check: "Zakończone",
    },
    moreFields: "Więcej pól",
    hideFields: "Zwiń",

    // Termin
    nextAppointment: "Następny kontakt",
    lastVisit: "Ostatni kontakt",
    notes: "Notatki",
    tags: "Tagi",
    tagsPlaceholder: "Wpisz i naciśnij Enter…",
    clearFilter: "Wyczyść filtr",
    quickAddHere: "Tu jestem (dodaj klienta z GPS)",
    gpsNotSupported: "Twoja przeglądarka nie obsługuje lokalizacji.",
    gpsDenied:
      "Brak zgody na lokalizację. Włącz dostęp w ustawieniach przeglądarki.",
    gpsTimeout: "Nie udało się ustalić lokalizacji (timeout). Spróbuj ponownie.",
    gpsFailed: "Nie udało się pobrać lokalizacji.",

    // Filtry na mapie / stany
    all: "Wszystkie",
    active: "Aktywne",
    stateDone: "Zakończone",
    stateActive: "Aktywne",
    showDone: "Pokaż zakończone",
    hideDone: "Ukryj zakończone",

    // Kategorie
    categories: "Kategorie",
    category: "Kategoria",
    categoryNone: "Bez kategorii",
    selectCategory: "Wybierz kategorię",
    categoryName: "Nazwa kategorii",
    categoryNamePlaceholder: "np. Awaria, Pacjent VIP, Rodzina",
    categoryColor: "Kolor",
    categoryIcon: "Ikona",
    categoryAdd: "Dodaj kategorię",
    categoryAdded: "Dodano kategorię",
    categoryRemoved: "Usunięto kategorię",
    categoryUpdated: "Zapisano kategorię",
    categoryRemoveConfirm:
      "Usunąć tę kategorię? Klienci którzy ją mieli, stracą przypisanie (sami klienci zostaną).",
    categoriesEmpty:
      "Nie masz jeszcze żadnych kategorii. Dodaj swoją pierwszą — np. „Awaria”, „Pacjenci stali”, „Rodzina”.",
    categoriesHint:
      "Twoje kategorie zastępują sztywne statusy. Każda ma swoją nazwę, ikonę i kolor — a Ty przypisujesz je do klientów.",

    overdue: "Przeterminowane",
    todayGroup: "Dziś",
    thisWeek: "W tym tygodniu",
    noAppointment: "Brak zaplanowanego kontaktu",
    daysUntil: (n: number) =>
      n === 0
        ? "Dziś"
        : n === 1
          ? "Jutro"
          : n > 0
            ? `Za ${n} dni`
            : `${Math.abs(n)} dni temu`,
    search: "Szukaj klientów…",
    sortBy: "Sortuj",
    sortName: "Po nazwie",
    sortAppt: "Po terminie",
    sortLast: "Po ostatnim kontakcie",
    emptyTitle: "Brak klientów",
    emptyHint: "Dodaj swojego pierwszego klienta, aby rozpocząć.",
    emptyTodayTitle: "Brak kontaktów na ten tydzień",
    emptyTodayHint: "Wszystko pod kontrolą. Dobra robota!",
    navigate: "Nawiguj",
    callPhone: "Zadzwoń",
    sendEmail: "Napisz e-mail",
    openInMaps: "Otwórz w Mapach Google",
    legend: "Legenda",
    legendOverdue: "Przeterminowane",
    legendSoon: "0–7 dni",
    legendUpcoming: "8–14 dni",
    legendLater: "15–30 dni",
    legendFuture: "30+ dni",
    legendNoDate: "Brak terminu",
    legendDone: "Zakończone",
    /** Dynamiczne etykiety dla aktualnych progów (suwaki w Ustawieniach). */
    dayRange: (from: number, to: number) => `${from}–${to} dni`,
    dayPlus: (from: number) => `${from}+ dni`,
    /** Nazwy kolorów do podpisania suwaków. */
    toneSoonName: "Pomarańczowy",
    toneUpcomingName: "Żółty",
    toneLaterName: "Zielony",
    toneFutureName: "Niebieski",
    exportData: "Eksportuj dane",
    importData: "Importuj dane",
    clearAll: "Wyczyść wszystkie dane",
    clearAllConfirm:
      "Na pewno chcesz usunąć wszystkich klientów? Tej operacji nie można cofnąć.",
    confirm: "Potwierdź",
    deleteConfirm: "Na pewno usunąć tego klienta?",
    thresholds: "Progi kolorów (dni)",
    profession: "Profesja",
    professionPlaceholder: "Wpisz swoją profesję, np. Hydraulik",
    professionAdd: "Dodaj",
    yourProfessions: "Twoje profesje",
    professionsEmpty: "Tu zapiszą się Twoje profesje",
    professionActive: "Aktywna",
    professionRemove: "Usuń",
    professionRemoved: "Usunięto profesję",
    professionAdded: "Dodano profesję",
    professionExists: "Ta profesja już istnieje",
    language: "Język",
    polish: "Polski",
    english: "English",
    about: "O aplikacji",
    version: "Wersja",
    aboutText:
      "Uniwersalna mapa klientów dla mobilnych specjalistów. Dane przechowywane lokalnie w przeglądarce.",
    geocoding: "Wyszukiwanie adresu…",
    geocodeFail: "Nie znaleziono adresu. Spróbuj inaczej.",
    saved: "Zapisano",
    deleted: "Usunięto",
    imported: "Zaimportowano",
    exported: "Wyeksportowano",
    cleared: "Wyczyszczono",
    longPressHint:
      "Wskazówka: dotknij i przytrzymaj mapę, aby dodać klienta w danym miejscu.",
    history: "Historia",
    created: "Utworzono",
    requiredField: "Pole wymagane",
    importMode: "Tryb importu",
    importMerge: "Scal",
    importReplace: "Zastąp",

    // --- Import z Excela / CSV (Pakiet B+) ---
    importJson: "Importuj z JSON",
    importSpreadsheet: "Importuj z Excela / CSV",
    importDropTitle: "Przeciągnij plik tutaj",
    importDropHint: "Excel (.xlsx, .xls) lub CSV — także polskie z średnikiem i Windows-1250",
    importChooseFile: "Wybierz plik",
    importFileTooLarge: "Plik jest za duży (limit 10 MB)",
    importFileEmpty: "Plik jest pusty albo nie ma żadnych wierszy z danymi",
    importFileFormat: "Nieobsługiwany format pliku. Wspieramy .xlsx, .xls, .csv",
    importFileFailed: "Nie udało się odczytać pliku",
    importStepFile: "Plik",
    importStepMapping: "Mapowanie",
    importStepGeocode: "Adresy",
    importStepReview: "Podsumowanie",
    importPreviewTitle: "Podgląd",
    importPreviewRows: (n: number) =>
      n === 1 ? "1 wiersz" : n < 5 ? `${n} wiersze` : `${n} wierszy`,
    importMappingTitle: "Mapowanie kolumn",
    importMappingHint:
      "Apka próbowała sama dopasować kolumny z pliku do pól klienta. Sprawdź i popraw jeśli trzeba.",
    importMappingFile: "Kolumna z pliku",
    importMappingField: "Pole klienta",
    importMappingNone: "— pomiń —",
    importMappingFieldNames: {
      name: "Nazwa / Imię i nazwisko",
      firstName: "Imię",
      lastName: "Nazwisko",
      company: "Firma",
      address: "Adres (pełny)",
      street: "Ulica",
      city: "Miasto",
      postalCode: "Kod pocztowy",
      phone: "Telefon",
      phone2: "Telefon dodatkowy",
      email: "E-mail",
      website: "Strona WWW",
      notes: "Notatki",
      tags: "Tagi (oddzielone , ; |)",
      lastVisit: "Ostatni kontakt",
      nextAppointment: "Następny kontakt",
    },
    importMappingProblems: "Brakuje wymaganych pól:",
    importMappingNoName:
      "Nazwa (przypisz jedno z: Nazwa / Imię i nazwisko / Firma)",
    importMappingNoAddress:
      "Adres (przypisz pełny adres albo ulica + miasto + kod)",
    importUnmappedHint: (n: number) =>
      n === 0
        ? "Wszystkie kolumny są zmapowane."
        : n === 1
          ? "1 niezmapowana kolumna trafi do notatek klienta."
          : `${n} niezmapowanych kolumn trafi do notatek klienta.`,
    importGeocodeTitle: "Wyszukuję adresy na mapie",
    importGeocodeHint:
      "Korzystamy z darmowego serwisu OpenStreetMap, który ma limit 1 zapytanie/sek. Cierpliwie — nie dotykaj nic.",
    importGeocodeProgress: (done: number, total: number) =>
      `${done} z ${total}`,
    importGeocodeFound: (n: number) =>
      n === 1 ? "1 znaleziony" : `${n} znalezionych`,
    importGeocodeMissing: (n: number) =>
      n === 1 ? "1 nieznaleziony" : `${n} nieznalezionych`,
    importGeocodePause: "Przerwij",
    importGeocodeStart: "Rozpocznij wyszukiwanie",
    importReviewTitle: "Podsumowanie importu",
    importReviewReady: (n: number) =>
      n === 1 ? "1 klient gotowy do dodania" : `${n} klientów gotowych do dodania`,
    importReviewSkipped: (n: number) =>
      n === 1
        ? "1 wiersz pominięty (brak nazwy lub adresu / nieznaleziony adres)"
        : `${n} wierszy pominiętych (brak nazwy lub adresu / nieznaleziony adres)`,
    importReviewProblems: "Wiersze z problemami",
    importReviewNoProblems: "Wszystkie wiersze poprawne ✓",
    importDoImport: "Dodaj klientów",
    importImporting: "Dodawanie…",
    importDone: (n: number) =>
      n === 1 ? "Zaimportowano 1 klienta" : `Zaimportowano ${n} klientów`,
    importNothingToImport: "Nie ma żadnych poprawnych wierszy do zaimportowania",
    importBack: "Wstecz",
    importNext: "Dalej",
    importClose: "Zamknij",
    importStartOver: "Zacznij od nowa",
    importErrorRowName: "Brak nazwy",
    importErrorRowAddress: "Brak adresu",
    importErrorRowGeocode: "Nie znaleziono adresu na mapie",

    reverseGeocode: "Pobierz adres z mapy",
    darkMode: "Tryb ciemny",
    light: "Jasny",
    dark: "Ciemny",
    system: "Systemowy",

    // --- Pakiet A: Zdjęcia ---
    photos: "Zdjęcia",
    photosEmpty: "Brak zdjęć. Dodaj pierwsze z aparatu albo z galerii.",
    photoAdd: "Dodaj zdjęcie",
    photoTake: "Zrób zdjęcie",
    photoChoose: "Wybierz z galerii",
    photoProcessing: "Przetwarzam zdjęcie…",
    photoRemoved: "Usunięto zdjęcie",
    photoRemoveConfirm:
      "Usunąć to zdjęcie? Zniknie też z wszystkich wpisów na osi czasu.",
    photoFailed: "Nie udało się dodać zdjęcia.",
    photoFullscreenClose: "Zamknij",
    photoPickExisting: "Z galerii klienta",
    photoPickExistingTitle: "Wybierz zdjęcia z galerii klienta",
    photoPickExistingEmpty:
      "Ten klient nie ma jeszcze żadnych zdjęć w galerii.",
    photoPickConfirm: "Dołącz wybrane",
    photoAttachedCount: (n: number) =>
      n === 1 ? "1 zdjęcie przypięte" : `${n} zdjęć przypiętych`,
    photoSetThumbnail: "Ustaw jako miniaturkę pinu",
    photoUnsetThumbnail: "Zdejmij z miniaturki",
    photoIsThumbnail: "Miniaturka",
    photoThumbnailSet: "Ustawiono miniaturkę pinu",
    photoThumbnailCleared: "Zdjęto miniaturkę pinu",

    // --- Pakiet A: Notatki głosowe ---
    voiceNotes: "Notatki głosowe",
    voiceNotesEmpty: "Brak nagrań. Kliknij „Nagraj”, aby dodać pierwsze.",
    voiceRecord: "Nagraj",
    voiceStop: "Zatrzymaj",
    voiceRecording: "Nagrywam…",
    voiceRemoved: "Usunięto nagranie",
    voiceRemoveConfirm: "Usunąć to nagranie?",
    voiceMicDenied:
      "Brak dostępu do mikrofonu. Sprawdź uprawnienia przeglądarki.",
    voiceNotSupported: "Ta przeglądarka nie obsługuje nagrywania dźwięku.",
    voiceMaxReached: "Maksymalna długość nagrania to 60 sekund.",
    voiceFailed: "Nie udało się zapisać nagrania.",

    // --- Pakiet A: Oś czasu ---
    timeline: "Oś czasu",
    timelineEmpty:
      "Brak wpisów. Dodaj pierwszy wpis – wizytę, telefon, problem lub naprawę.",
    timelineAdd: "Dodaj wpis",
    timelineDate: "Data",
    timelineKind: "Typ",
    timelineText: "Opis",
    timelineTextPlaceholder: "Co się wydarzyło?",
    timelineSave: "Dodaj",
    timelineRemoved: "Usunięto wpis",
    timelineRemoveConfirm: "Usunąć ten wpis?",
    timelineKinds: {
      visit: "Wizyta",
      note: "Notatka",
      call: "Telefon",
      issue: "Problem",
      fix: "Naprawa",
      other: "Inne",
    },

    // --- Wspólne dla Pakietu A ---
    storageFull:
      "Brak miejsca w pamięci przeglądarki. Usuń kilka zdjęć lub nagrań i spróbuj ponownie.",
    size: "Rozmiar",
  },
  en: {
    appName: "SerwisMap",
    map: "Map",
    customers: "Customers",
    today: "Today",
    settings: "Settings",
    addCustomer: "Add customer",
    editCustomer: "Edit customer",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    markDone: "Mark as done",
    markActive: "Mark as active",

    name: "Name",
    namePlaceholder: "Person, company, place…",

    address: "Address",
    geocode: "Geocode",
    phone: "Phone",
    phone2: "Additional phone",
    email: "Email",
    website: "Website",
    company: "Company",
    clientProfession: "Client profession / industry",
    clientProfessionPlaceholder: "e.g. Teacher, Doctor, Driver",
    icon: "Icon",
    iconAuto: "Auto (from category)",
    iconNames: {
      auto: "Auto",
      wrench: "Wrench",
      flame: "Flame",
      droplet: "Water",
      zap: "Electric",
      home: "Home",
      building: "Company",
      briefcase: "Business",
      heart: "Heart",
      star: "Star",
      shield: "Shield",
      alert: "Alert",
      stethoscope: "Medical",
      package: "Package",
      check: "Done",
    },
    moreFields: "More fields",
    hideFields: "Hide",

    nextAppointment: "Next contact",
    lastVisit: "Last contact",
    notes: "Notes",
    tags: "Tags",
    tagsPlaceholder: "Type and press Enter…",
    clearFilter: "Clear filter",
    quickAddHere: "Add customer at my GPS location",
    gpsNotSupported: "Your browser does not support geolocation.",
    gpsDenied: "Location access denied. Enable it in browser settings.",
    gpsTimeout: "Could not get your location (timeout). Try again.",
    gpsFailed: "Failed to get your location.",

    all: "All",
    active: "Active",
    stateDone: "Done",
    stateActive: "Active",
    showDone: "Show done",
    hideDone: "Hide done",

    categories: "Categories",
    category: "Category",
    categoryNone: "No category",
    selectCategory: "Select category",
    categoryName: "Category name",
    categoryNamePlaceholder: "e.g. Urgent, VIP, Family",
    categoryColor: "Color",
    categoryIcon: "Icon",
    categoryAdd: "Add category",
    categoryAdded: "Category added",
    categoryRemoved: "Category removed",
    categoryUpdated: "Category saved",
    categoryRemoveConfirm:
      "Remove this category? Clients assigned to it will lose the assignment (the clients themselves stay).",
    categoriesEmpty:
      "You don't have any categories yet. Add your first one — e.g. “Urgent”, “Regular patients”, “Family”.",
    categoriesHint:
      "Your categories replace rigid statuses. Each has a name, icon and color — and you assign them to clients.",

    overdue: "Overdue",
    todayGroup: "Today",
    thisWeek: "This week",
    noAppointment: "No contact scheduled",
    daysUntil: (n: number) =>
      n === 0
        ? "Today"
        : n === 1
          ? "Tomorrow"
          : n > 0
            ? `In ${n} days`
            : `${Math.abs(n)} days ago`,
    search: "Search customers…",
    sortBy: "Sort",
    sortName: "By name",
    sortAppt: "By due date",
    sortLast: "By last contact",
    emptyTitle: "No customers yet",
    emptyHint: "Add your first customer to get started.",
    emptyTodayTitle: "Nothing scheduled this week",
    emptyTodayHint: "All clear. Nice work!",
    navigate: "Navigate",
    callPhone: "Call",
    sendEmail: "Email",
    openInMaps: "Open in Google Maps",
    legend: "Legend",
    legendOverdue: "Overdue",
    legendSoon: "0–7 days",
    legendUpcoming: "8–14 days",
    legendLater: "15–30 days",
    legendFuture: "30+ days",
    legendNoDate: "No date",
    legendDone: "Done",
    dayRange: (from: number, to: number) => `${from}–${to} days`,
    dayPlus: (from: number) => `${from}+ days`,
    toneSoonName: "Orange",
    toneUpcomingName: "Yellow",
    toneLaterName: "Green",
    toneFutureName: "Blue",
    exportData: "Export data",
    importData: "Import data",
    clearAll: "Clear all data",
    clearAllConfirm: "Delete all customers? This cannot be undone.",
    confirm: "Confirm",
    deleteConfirm: "Delete this customer?",
    thresholds: "Color thresholds (days)",
    profession: "Profession",
    professionPlaceholder: "Type your profession, e.g. Plumber",
    professionAdd: "Add",
    yourProfessions: "Your professions",
    professionsEmpty: "Your professions will appear here",
    professionActive: "Active",
    professionRemove: "Remove",
    professionRemoved: "Profession removed",
    professionAdded: "Profession added",
    professionExists: "This profession already exists",
    language: "Language",
    polish: "Polski",
    english: "English",
    about: "About",
    version: "Version",
    aboutText:
      "Universal customer map for mobile professionals. Data stored locally in your browser.",
    geocoding: "Looking up address…",
    geocodeFail: "Address not found. Try a different format.",
    saved: "Saved",
    deleted: "Deleted",
    imported: "Imported",
    exported: "Exported",
    cleared: "Cleared",
    longPressHint:
      "Tip: long-press the map to add a customer at that spot.",
    history: "History",
    created: "Created",
    requiredField: "Required field",
    importMode: "Import mode",
    importMerge: "Merge",
    importReplace: "Replace",

    // --- Import from Excel / CSV (Package B+) ---
    importJson: "Import from JSON",
    importSpreadsheet: "Import from Excel / CSV",
    importDropTitle: "Drop file here",
    importDropHint: "Excel (.xlsx, .xls) or CSV — Polish semicolons & Windows-1250 supported",
    importChooseFile: "Choose file",
    importFileTooLarge: "File is too large (10 MB limit)",
    importFileEmpty: "File is empty or has no data rows",
    importFileFormat: "Unsupported file format. Supported: .xlsx, .xls, .csv",
    importFileFailed: "Failed to read file",
    importStepFile: "File",
    importStepMapping: "Mapping",
    importStepGeocode: "Addresses",
    importStepReview: "Review",
    importPreviewTitle: "Preview",
    importPreviewRows: (n: number) => (n === 1 ? "1 row" : `${n} rows`),
    importMappingTitle: "Column mapping",
    importMappingHint:
      "We tried to auto-match columns from your file to customer fields. Check and adjust if needed.",
    importMappingFile: "File column",
    importMappingField: "Customer field",
    importMappingNone: "— skip —",
    importMappingFieldNames: {
      name: "Name / Full name",
      firstName: "First name",
      lastName: "Last name",
      company: "Company",
      address: "Address (full)",
      street: "Street",
      city: "City",
      postalCode: "Postal code",
      phone: "Phone",
      phone2: "Alternate phone",
      email: "E-mail",
      website: "Website",
      notes: "Notes",
      tags: "Tags (split by , ; |)",
      lastVisit: "Last contact",
      nextAppointment: "Next contact",
    },
    importMappingProblems: "Missing required fields:",
    importMappingNoName:
      "Name (assign one of: Name / Full name / Company)",
    importMappingNoAddress:
      "Address (assign full address or street + city + postcode)",
    importUnmappedHint: (n: number) =>
      n === 0
        ? "All columns are mapped."
        : n === 1
          ? "1 unmapped column will be appended to customer notes."
          : `${n} unmapped columns will be appended to customer notes.`,
    importGeocodeTitle: "Looking up addresses on the map",
    importGeocodeHint:
      "We use the free OpenStreetMap service which is limited to 1 request per second. Hang tight — don't touch anything.",
    importGeocodeProgress: (done: number, total: number) =>
      `${done} of ${total}`,
    importGeocodeFound: (n: number) => (n === 1 ? "1 found" : `${n} found`),
    importGeocodeMissing: (n: number) =>
      n === 1 ? "1 not found" : `${n} not found`,
    importGeocodePause: "Stop",
    importGeocodeStart: "Start lookup",
    importReviewTitle: "Import summary",
    importReviewReady: (n: number) =>
      n === 1 ? "1 customer ready to add" : `${n} customers ready to add`,
    importReviewSkipped: (n: number) =>
      n === 1
        ? "1 row skipped (missing name or address / address not found)"
        : `${n} rows skipped (missing name or address / address not found)`,
    importReviewProblems: "Rows with problems",
    importReviewNoProblems: "All rows OK ✓",
    importDoImport: "Add customers",
    importImporting: "Adding…",
    importDone: (n: number) =>
      n === 1 ? "Imported 1 customer" : `Imported ${n} customers`,
    importNothingToImport: "There are no valid rows to import",
    importBack: "Back",
    importNext: "Next",
    importClose: "Close",
    importStartOver: "Start over",
    importErrorRowName: "Missing name",
    importErrorRowAddress: "Missing address",
    importErrorRowGeocode: "Address not found on map",

    reverseGeocode: "Get address from map",
    darkMode: "Dark mode",
    light: "Light",
    dark: "Dark",
    system: "System",

    // --- Package A: Photos ---
    photos: "Photos",
    photosEmpty: "No photos yet. Add your first from camera or gallery.",
    photoAdd: "Add photo",
    photoTake: "Take photo",
    photoChoose: "From gallery",
    photoProcessing: "Processing photo…",
    photoRemoved: "Photo removed",
    photoRemoveConfirm:
      "Remove this photo? It will also disappear from any timeline entries.",
    photoFailed: "Failed to add photo.",
    photoFullscreenClose: "Close",
    photoPickExisting: "From customer gallery",
    photoPickExistingTitle: "Pick photos from customer gallery",
    photoPickExistingEmpty: "This customer has no photos in the gallery yet.",
    photoPickConfirm: "Attach selected",
    photoAttachedCount: (n: number) =>
      n === 1 ? "1 photo attached" : `${n} photos attached`,
    photoSetThumbnail: "Set as map thumbnail",
    photoUnsetThumbnail: "Unset thumbnail",
    photoIsThumbnail: "Thumbnail",
    photoThumbnailSet: "Map thumbnail set",
    photoThumbnailCleared: "Map thumbnail cleared",

    // --- Package A: Voice notes ---
    voiceNotes: "Voice notes",
    voiceNotesEmpty: "No recordings yet. Tap “Record” to add your first.",
    voiceRecord: "Record",
    voiceStop: "Stop",
    voiceRecording: "Recording…",
    voiceRemoved: "Recording removed",
    voiceRemoveConfirm: "Remove this recording?",
    voiceMicDenied: "Microphone access denied. Check browser permissions.",
    voiceNotSupported: "This browser doesn't support audio recording.",
    voiceMaxReached: "Maximum recording length is 60 seconds.",
    voiceFailed: "Failed to save recording.",

    // --- Package A: Timeline ---
    timeline: "Timeline",
    timelineEmpty:
      "No entries yet. Add your first — visit, call, issue or fix.",
    timelineAdd: "Add entry",
    timelineDate: "Date",
    timelineKind: "Type",
    timelineText: "Description",
    timelineTextPlaceholder: "What happened?",
    timelineSave: "Add",
    timelineRemoved: "Entry removed",
    timelineRemoveConfirm: "Remove this entry?",
    timelineKinds: {
      visit: "Visit",
      note: "Note",
      call: "Call",
      issue: "Issue",
      fix: "Fix",
      other: "Other",
    },

    // --- Shared for Package A ---
    storageFull:
      "Browser storage is full. Remove some photos or recordings and try again.",
    size: "Size",
  },
} as const;

type Dict = typeof dict.pl;

interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const useI18n = create<I18nState>()(
  persist(
    (set) => ({
      lang: "pl",
      setLang: (lang) => set({ lang }),
    }),
    { name: "serwismap-lang" },
  ),
);

export function useT(): Dict {
  const lang = useI18n((s) => s.lang);
  return dict[lang] as Dict;
}
