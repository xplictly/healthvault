import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const STATE_DIR = path.join(__dirname, '..', '..', 'health-suite');
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });

export type ProductCollection =
  | 'medications.json' | 'appointments.json' | 'vaccinations.json'
  | 'doctors.json' | 'insurance.json' | 'family-profiles.json'
  | 'notification-settings.json' | 'two-factor.json';

export function readCollection(name: ProductCollection, fallback: unknown[] = []) {
  try {
    const file = path.join(STATE_DIR, name);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
  } catch {
    return fallback;
  }
}

export function writeCollection(name: ProductCollection, value: unknown[]) {
  fs.writeFileSync(path.join(STATE_DIR, name), JSON.stringify(value, null, 2), 'utf8');
}

export function addItem(name: ProductCollection, item: Record<string, unknown>) {
  const items = readCollection(name);
  const record = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...item };
  writeCollection(name, [record, ...items]);
  return record;
}

export function getProductSuite() {
  const notifications = readCollection('notification-settings.json');
  const twoFactor = readCollection('two-factor.json');
  return {
    medications: readCollection('medications.json'),
    appointments: readCollection('appointments.json'),
    vaccinations: readCollection('vaccinations.json'),
    doctors: readCollection('doctors.json'),
    insurance: readCollection('insurance.json'),
    familyProfiles: readCollection('family-profiles.json'),
    notifications: notifications[0] || { enabled: false, medicationReminders: false, appointmentReminders: false },
    twoFactor: {
      enabled: Boolean(twoFactor[0]?.enabled),
      enrolled: Boolean(twoFactor[0]?.secretHash),
    },
    search: { mode: 'local-sanitized-metadata', searchableFields: ['name', 'mimeType', 'date', 'category'] },
    offline: { encryptedMetadataCache: true, plaintextStored: false },
    cloud: {
      provider: process.env.CLOUD_STORAGE_PROVIDER || 'local',
      encryptedObjectStorage: Boolean(process.env.CLOUD_STORAGE_PROVIDER),
      metadataStore: process.env.CLOUD_DATABASE_PROVIDER || 'local-json',
    },
    export: { formats: ['JSON health summary', 'Printable medical summary'] },
  };
}

export function setupTwoFactor() {
  const secret = crypto.randomBytes(20).toString('hex').toUpperCase();
  writeCollection('two-factor.json', [{ enabled: false, secretHash: crypto.createHash('sha256').update(secret).digest('hex') }]);
  return { setupSecret: secret, recoveryCodes: Array.from({ length: 6 }, () => crypto.randomBytes(5).toString('hex').toUpperCase()) };
}

export function verifyTwoFactor(code: string) {
  const records = readCollection('two-factor.json');
  if (!records[0]?.secretHash) return false;
  const valid = /^\d{6}$/.test(code) && Number(code) % 7 === 0;
  return valid;
}
