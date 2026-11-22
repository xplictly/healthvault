import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { Health } from '@capgo/capacitor-health';

const STORAGE_API_KEY = 'healthvault-custom-api-url';

export function getCustomApiBase(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_API_KEY);
}

export function setCustomApiBase(url: string): void {
  if (typeof window === 'undefined') return;
  const cleaned = url.trim().replace(/\/$/, '');
  if (cleaned) {
    localStorage.setItem(STORAGE_API_KEY, cleaned);
  } else {
    localStorage.removeItem(STORAGE_API_KEY);
  }
}

export function resolveApiBase(): string {
  // 1. Explicit user-configured custom endpoint (critical for physical mobile testing)
  const userConfigured = getCustomApiBase();
  if (userConfigured) return userConfigured;

  // 2. Build-time environment variable
  const envConfigured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envConfigured) return envConfigured.replace(/\/$/, '');

  // 3. Web browser on desktop/mobile
  if (!Capacitor.isNativePlatform()) return 'http://localhost:5001/api/vault';

  // 4. Android Emulator loopback
  if (Capacitor.getPlatform() === 'android') return 'http://10.0.2.2:5001/api/vault';

  // 5. iOS Simulator loopback
  return 'http://127.0.0.1:5001/api/vault';
}

export const secureVaultStorage = {
  async set(key: string, value: string) {
    if (!Capacitor.isNativePlatform()) {
      sessionStorage.setItem(key, value);
      return { value: true };
    }
    return SecureStoragePlugin.set({ key, value });
  },
  async get(key: string) {
    if (!Capacitor.isNativePlatform()) {
      return sessionStorage.getItem(key);
    }
    try {
      return (await SecureStoragePlugin.get({ key })).value;
    } catch {
      return null;
    }
  },
  async remove(key: string) {
    if (!Capacitor.isNativePlatform()) {
      sessionStorage.removeItem(key);
      return { value: true };
    }
    return SecureStoragePlugin.remove({ key });
  },
  async keys() {
    if (!Capacitor.isNativePlatform()) {
      return Object.keys(sessionStorage);
    }
    return (await SecureStoragePlugin.keys()).value;
  },
};

export async function initializeBleAdapter() {
  await BleClient.initialize({ androidNeverForLocation: true });
  return {
    enabled: await BleClient.isEnabled(),
    platform: Capacitor.getPlatform(),
  };
}

export async function requestHealthAuthorization() {
  if (!Capacitor.isNativePlatform()) {
    return Health.isAvailable().catch(() => ({ available: false, platform: 'web', reason: 'Native health stores are unavailable on web.' }));
  }
  const availability = await Health.isAvailable();
  if (!availability.available) return availability;
  const status = await Health.requestAuthorization({
    read: ['bloodPressure', 'bloodGlucose', 'oxygenSaturation', 'heartRate', 'steps', 'sleep'],
    write: [],
    requestHistoryAccess: true,
  });
  return { availability, status };
}

export async function readNativeHealthSamples(startDate = new Date(Date.now() - 30 * 86400000).toISOString()) {
  const availability = await Health.isAvailable();
  if (!availability.available) return { available: false, samples: [] as any[] };
  const types = ['bloodPressure', 'bloodGlucose', 'oxygenSaturation', 'heartRate'] as const;
  const results = await Promise.all(types.map(async (dataType) => {
    try {
      const result = await Health.readSamples({ dataType, startDate, limit: 500, ascending: false });
      return result.samples;
    } catch {
      return [];
    }
  }));
  return { available: true, samples: results.flat() };
}

/**
 * Native Android Back Button Listener:
 * Intercepts back gestures / button taps and invokes the app's top-layer dismissal handler.
 * If no layers are active, it can exit the app.
 */
export function setupNativeBackButton(handler: () => boolean) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return () => {};
  }

  const listenerPromise = App.addListener('backButton', ({ canGoBack }) => {
    const handled = handler();
    if (!handled) {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    }
  });

  return () => {
    listenerPromise.then((handle) => handle.remove());
  };
}
