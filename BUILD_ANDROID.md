# Mapelo — budowanie APK na Android

## Wymagania

1. **Android Studio** — pobierz z https://developer.android.com/studio
2. **Node.js 18+** — do budowania weba
3. **Konto Google Play Developer** — jednorazowe 25 USD (https://play.google.com/console)

## Szybki start

### 1. Zainstaluj zależności
```bash
npm install
```

### 2. Otwórz projekt w Android Studio
```bash
npm run cap:sync    # buduje web + kopiuje do android/
npm run cap:open    # otwiera Android Studio
```

### 3. Uruchom na telefonie (debug)
- Podłącz telefon USB, włącz "Opcje programisty" → "Debugowanie USB"
- W Android Studio kliknij ▶ Run
- Albo z terminala: `npm run cap:debug`

### 4. Zbuduj release APK
```bash
npm run cap:build
```
APK pojawi się w: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

## Podpisanie APK (wymagane do Google Play)

### Generowanie klucza (jednorazowo)
```bash
keytool -genkey -v -keystore mapelo-release.keystore \
  -alias mapelo -keyalg RSA -keysize 2048 -validity 10000
```
**⚠️ Zachowaj ten plik i hasło — bez niego nie wydasz aktualizacji!**

### Podpisanie
```bash
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore mapelo-release.keystore \
  android/app/build/outputs/apk/release/app-release-unsigned.apk mapelo

zipalign -v 4 \
  android/app/build/outputs/apk/release/app-release-unsigned.apk \
  mapelo-release.apk
```

Albo prostszy sposób — użyj **Google Play App Signing** (rekomendowane):
- W Google Play Console włącz "App Signing by Google Play"
- Wrzucasz AAB zamiast APK (Android Studio → Build → Generate Signed Bundle)

## Ikona aplikacji

Podmień pliki w `android/app/src/main/res/mipmap-*/`:
- `ic_launcher.png` — ikona zwykła
- `ic_launcher_round.png` — ikona okrągła
- `ic_launcher_foreground.png` — warstwa przednia (adaptive icon)

Najprościej: Android Studio → Image Asset Studio (PPM na `res` → New → Image Asset)

## Codzienna praca

Po zmianach w kodzie webowym:
```bash
npm run cap:sync    # przebudowuje web i kopiuje do android/
```

Potem w Android Studio: ▶ Run

## Struktura

```
pin-pro/
├── src/                    ← kod React (bez zmian)
├── android/                ← natywny projekt Android (Capacitor)
│   └── app/src/main/
│       ├── AndroidManifest.xml   ← uprawnienia (GPS, kamera)
│       └── assets/public/        ← zbudowany web (auto-generowane)
├── capacitor.config.ts     ← konfiguracja Capacitor
└── package.json            ← skrypty cap:*
```

## FAQ

**Czy dane są bezpieczne?**
Tak. W natywnej apce (Capacitor) localStorage jest traktowany jako dane aplikacji, nie cache przeglądarki. Android nie czyści go automatycznie.

**Czy apka działa offline?**
Tak. Dane lokalne + service worker cache'uje kafelki mapy.

**Czy mogę wrócić do wersji webowej?**
Tak. `npm run dev` nadal uruchamia wersję przeglądarkową. Capacitor nic nie zmienia w web buildzie.
