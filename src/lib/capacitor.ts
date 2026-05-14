/**
 * Capacitor native platform helpers.
 *
 * All imports are lazy so the web build doesn't pull in native code.
 * On a regular browser these functions are safe no-ops.
 */

import { Capacitor } from '@capacitor/core';

/** true when running inside a Capacitor native shell (Android/iOS) */
export const isNative = Capacitor.isNativePlatform();

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

  try {
    // Handle Android back button
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  } catch {
    /* web fallback */
  }
}
