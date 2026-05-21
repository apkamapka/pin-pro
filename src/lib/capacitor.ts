/**
 * Capacitor native platform helpers.
 *
 * All imports are lazy so the web build doesn't pull in native code.
 * On a regular browser these functions are safe no-ops.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

/** Native plugin (Android): saves a file directly into the public Downloads folder. */
interface FileSaverPlugin {
  saveToDownloads(options: {
    name: string;
    data: string;
    mimeType?: string;
  }): Promise<{ uri: string }>;
}
const FileSaver = registerPlugin<FileSaverPlugin>('FileSaver');

/** true when running inside a Capacitor native shell (Android/iOS) */
export const isNative = Capacitor.isNativePlatform();

/**
 * Save a text file across platforms.
 *
 * - Web/browser: triggers a normal blob download via an <a> element.
 * - Native (Android): saves the file straight into the public Downloads
 *   folder via the FileSaver plugin (a blob `a.click()` does nothing in a
 *   WebView). The user finds it in Downloads and can share it from there.
 *
 * Returns the saved location, or throws on failure.
 */
export async function saveTextFile(
  filename: string,
  text: string,
  mimeType = 'application/json',
): Promise<{ uri: string | null }> {
  if (!isNative) {
    // Web path – original blob download.
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { uri: null };
  }

  // Native path – save directly to the Downloads folder.
  const { uri } = await FileSaver.saveToDownloads({
    name: filename,
    data: text,
    mimeType,
  });
  return { uri };
}

/** Initialise native plugins – call once at app startup. */
export async function initNativePlugins(): Promise<void> {
  if (!isNative) return;

  try {
    // Status bar
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#2563eb' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch {
    /* web fallback – ignore */
  }

  try {
    // Hide splash after app renders
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    /* web fallback */
  }

  // Uwaga: obsługa sprzętowego przycisku „wstecz” (Android) jest teraz
  // w hooku React `useAndroidBackButton`, bo musi znać stan UI
  // (otwarty Sheet / aktywna zakładka) i sterować nawigacją w apce.
}