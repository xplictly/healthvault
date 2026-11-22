import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

export interface AuditEvent {
  id: string;
  action: string;
  status: 'success' | 'warning' | 'blocked';
  detail: string;
  timestamp: string;
}

export interface IotReading {
  id: string;
  source: string;
  heartRate?: number;
  systolic?: number;
  diastolic?: number;
  oxygen?: number;
  sleepHours?: number;
  steps?: number;
  temperature?: number;
  timestamp: string;
}

const STATE_DIR = path.join(__dirname, '..', '..', 'health-suite');

function statePath(name: string) {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  return path.join(STATE_DIR, name);
}

function readJson<T>(name: string, fallback: T): T {
  try {
    const target = statePath(name);
    return fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8')) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(name: string, value: unknown) {
  fs.writeFileSync(statePath(name), JSON.stringify(value, null, 2), 'utf8');
}

export function addAudit(action: string, status: AuditEvent['status'], detail: string) {
  const events = readJson<AuditEvent[]>('audit.json', []);
  events.unshift({
    id: crypto.randomUUID(),
    action,
    status,
    detail,
    timestamp: new Date().toISOString(),
  });
  writeJson('audit.json', events.slice(0, 500));
  return events[0];
}

export function getAudit() {
  return readJson<AuditEvent[]>('audit.json', []);
}

export function getEmergencyProfile() {
  return readJson('emergency-profile.json', {
    bloodType: 'Unknown',
    allergies: [] as string[],
    medications: [] as string[],
    emergencyContact: '',
    updatedAt: null as string | null,
  });
}

export function saveEmergencyProfile(profile: Record<string, unknown>) {
  const sanitized = {
    bloodType: String(profile.bloodType || 'Unknown').slice(0, 12),
    allergies: Array.isArray(profile.allergies) ? profile.allergies.slice(0, 20).map(String) : [],
    medications: Array.isArray(profile.medications) ? profile.medications.slice(0, 20).map(String) : [],
    emergencyContact: String(profile.emergencyContact || '').slice(0, 160),
    updatedAt: new Date().toISOString(),
  };
  writeJson('emergency-profile.json', sanitized);
  addAudit('Emergency profile updated', 'success', 'Encrypted vault emergency data was updated.');
  return sanitized;
}

export function addIotReading(reading: Record<string, unknown>) {
  const readings = readJson<IotReading[]>('iot-readings.json', []);
  const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  const item: IotReading = {
    id: crypto.randomUUID(),
    source: String(reading.source || 'Demo wearable').slice(0, 80),
    heartRate: numeric(reading.heartRate),
    systolic: numeric(reading.systolic),
    diastolic: numeric(reading.diastolic),
    oxygen: numeric(reading.oxygen),
    sleepHours: numeric(reading.sleepHours),
    steps: numeric(reading.steps),
    temperature: numeric(reading.temperature),
    timestamp: new Date().toISOString(),
  };
  readings.unshift(item);
  writeJson('iot-readings.json', readings.slice(0, 500));
  addAudit('IoT reading ingested', 'success', `${item.source} synced a wearable reading.`);
  return item;
}

export function getIotReadings() {
  return readJson<IotReading[]>('iot-readings.json', []);
}

export function createShare(fileId: string, expiresInHours: number, label: string) {
  const shares = readJson<Record<string, unknown>[]>('shares.json', []);
  const token = crypto.randomBytes(24).toString('base64url');
  const share = {
    id: crypto.randomUUID(),
    token,
    fileId,
    label: label.slice(0, 80),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + Math.max(1, Math.min(expiresInHours, 168)) * 3600000).toISOString(),
  };
  shares.unshift(share);
  writeJson('shares.json', shares.slice(0, 100));
  addAudit('Secure share created', 'success', `Time-limited share created for record ${fileId}.`);
  return share;
}

export function resolveShare(token: string) {
  const shares = readJson<any[]>('shares.json', []);
  const share = shares.find((item) => item.token === token);
  if (!share) return null;
  if (new Date(share.expiresAt).getTime() < Date.now()) return { expired: true };
  return share;
}

export function getAnomalyReport() {
  const audit = getAudit();
  const blocked = audit.filter((event) => event.status === 'blocked').length;
  const warnings = audit.filter((event) => event.status === 'warning').length;
  const recentFailures = audit
    .filter((event) => event.status === 'blocked')
    .slice(0, 10)
    .map((event) => ({ timestamp: event.timestamp, detail: event.detail }));
  const score = Math.min(100, blocked * 12 + warnings * 4);
  return {
    score,
    level: score >= 40 ? 'Elevated' : score >= 15 ? 'Watch' : 'Low',
    blockedAttempts: blocked,
    warnings,
    recentFailures,
  };
}

export async function extractRecordText(buffer: Buffer, mimeType: string) {
  if (mimeType === 'application/pdf') {
    const parsed = await pdfParse(buffer);
    return parsed.text || '';
  }
  if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    return buffer.toString('utf8');
  }
  if (mimeType.startsWith('image/')) {
    const { recognize } = await import('tesseract.js');
    const result = await recognize(buffer, 'eng');
    return result.data.text || '';
  }
  return '';
}

export function extractLabValues(text: string) {
  const values: Array<{ name: string; value: number; unit: string }> = [];
  const patterns: Array<[string, RegExp]> = [
    ['Glucose', /(?:glucose)[^\d]{0,20}(\d+(?:\.\d+)?)\s*(mg\/dl|mmol\/l)/gi],
    ['Hemoglobin', /(?:hemoglobin|hgb)[^\d]{0,20}(\d+(?:\.\d+)?)\s*(g\/dl)/gi],
    ['Cholesterol', /(?:cholesterol)[^\d]{0,20}(\d+(?:\.\d+)?)\s*(mg\/dl)/gi],
    ['Heart Rate', /(?:heart rate|pulse)[^\d]{0,20}(\d+(?:\.\d+)?)\s*(bpm)/gi],
  ];
  for (const [name, pattern] of patterns) {
    for (const match of text.matchAll(pattern)) {
      values.push({ name, value: Number(match[1]), unit: match[2] });
    }
  }
  return values;
}
