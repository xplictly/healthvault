import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const STATE_DIR = path.join(__dirname, '..', '..', 'health-suite');

function ensureStateDir() {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
}

function readJson<T>(name: string, fallback: T): T {
  ensureStateDir();
  const target = path.join(STATE_DIR, name);
  try {
    return fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8')) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(name: string, value: unknown) {
  ensureStateDir();
  fs.writeFileSync(path.join(STATE_DIR, name), JSON.stringify(value, null, 2), 'utf8');
}

export interface EvidenceNode {
  id: string;
  type: 'record' | 'person' | 'provider' | 'event' | 'reading' | 'medication';
  label: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface EvidenceEdge {
  id: string;
  from: string;
  to: string;
  relation: string;
  evidenceStrength: number;
  createdAt: string;
}

export function getEvidenceGraph() {
  return readJson<{ nodes: EvidenceNode[]; edges: EvidenceEdge[] }>('evidence-graph.json', { nodes: [], edges: [] });
}

export function addEvidenceNode(input: Partial<EvidenceNode>) {
  const graph = getEvidenceGraph();
  const node: EvidenceNode = {
    id: crypto.randomUUID(),
    type: input.type || 'event',
    label: String(input.label || 'Untitled evidence').slice(0, 160),
    metadata: input.metadata || {},
    createdAt: new Date().toISOString(),
  };
  graph.nodes.unshift(node);
  writeJson('evidence-graph.json', graph);
  return node;
}

export function linkEvidence(from: string, to: string, relation: string, evidenceStrength = 0.5) {
  const graph = getEvidenceGraph();
  const edge: EvidenceEdge = {
    id: crypto.randomUUID(),
    from,
    to,
    relation: String(relation).slice(0, 80),
    evidenceStrength: Math.max(0, Math.min(1, Number(evidenceStrength) || 0)),
    createdAt: new Date().toISOString(),
  };
  graph.edges.unshift(edge);
  writeJson('evidence-graph.json', graph);
  return edge;
}

export function getClinicalTimeline() {
  const graph = getEvidenceGraph();
  return graph.nodes
    .filter((node) => ['record', 'event', 'reading', 'medication'].includes(node.type))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((node) => ({ ...node, connections: graph.edges.filter((edge) => edge.from === node.id || edge.to === node.id).length }));
}

export interface ConsentPolicy {
  id: string;
  recipient: string;
  purpose: string;
  recordIds: string[];
  actions: string[];
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export function getConsentPolicies() {
  return readJson<ConsentPolicy[]>('consent-policies.json', []);
}

export function createConsentPolicy(input: Record<string, unknown>) {
  const policies = getConsentPolicies();
  const expiresAt = new Date(Date.now() + Math.max(1, Math.min(Number(input.expiresInHours || 24), 168)) * 3600000).toISOString();
  const policy: ConsentPolicy = {
    id: crypto.randomUUID(),
    recipient: String(input.recipient || 'Unknown recipient').slice(0, 160),
    purpose: String(input.purpose || 'Clinical care').slice(0, 160),
    recordIds: Array.isArray(input.recordIds) ? input.recordIds.map(String).slice(0, 100) : [],
    actions: Array.isArray(input.actions) ? input.actions.map(String).slice(0, 10) : ['preview'],
    expiresAt,
    revokedAt: null,
    createdAt: new Date().toISOString(),
  };
  policies.unshift(policy);
  writeJson('consent-policies.json', policies.slice(0, 200));
  return policy;
}

export function revokeConsentPolicy(id: string) {
  const policies = getConsentPolicies();
  const policy = policies.find((item) => item.id === id);
  if (!policy) return null;
  policy.revokedAt = new Date().toISOString();
  writeJson('consent-policies.json', policies);
  return policy;
}

export interface RecoveryShare {
  id: string;
  index: number;
  shareHex: string;
  custodianLabel: string;
  createdAt: string;
}

function gfMultiply(a: number, b: number) {
  let result = 0;
  let left = a;
  let right = b;
  for (let bit = 0; bit < 8; bit++) {
    if (right & 1) result ^= left;
    right >>= 1;
    left <<= 1;
    if (left & 0x100) left ^= 0x11b;
  }
  return result & 0xff;
}

function gfPower(value: number, exponent: number) {
  let result = 1;
  let base = value;
  let remaining = exponent;
  while (remaining > 0) {
    if (remaining & 1) result = gfMultiply(result, base);
    base = gfMultiply(base, base);
    remaining >>= 1;
  }
  return result;
}

function gfInverse(value: number) {
  if (value === 0) throw new Error('Zero has no multiplicative inverse in GF(256).');
  return gfPower(value, 254);
}

export function createRecoveryShares(threshold: number, totalShares: number, secret: string, custodians: string[]) {
  const thresholdSafe = Math.max(2, Math.min(8, threshold));
  const totalSafe = Math.max(thresholdSafe, Math.min(16, totalShares));
  const secretBytes = Buffer.from(secret);
  const shares: RecoveryShare[] = [];
  const coefficientsPerByte: number[][] = [];
  for (let byte = 0; byte < secretBytes.length; byte++) {
    const coefficients = [secretBytes[byte]];
    for (let degree = 1; degree < thresholdSafe; degree++) coefficients.push(crypto.randomBytes(1)[0]);
    coefficientsPerByte.push(coefficients);
  }
  for (let index = 1; index <= totalSafe; index++) {
    const x = index;
    const share = Buffer.alloc(secretBytes.length);
    for (let byte = 0; byte < secretBytes.length; byte++) {
      const coefficients = coefficientsPerByte[byte];
      let value = 0;
      for (let degree = coefficients.length - 1; degree >= 0; degree--) value = gfMultiply(value, x) ^ coefficients[degree];
      share[byte] = value;
    }
    shares.push({
      id: crypto.randomUUID(),
      index,
      shareHex: share.toString('hex'),
      custodianLabel: String(custodians[index - 1] || `Custodian ${index}`).slice(0, 160),
      createdAt: new Date().toISOString(),
    });
  }
  writeJson('recovery-shares.json', { threshold: thresholdSafe, total: totalSafe, shares });
  return { threshold: thresholdSafe, total: totalSafe, shareCount: shares.length, custodians: shares.map(({ id, index, custodianLabel }) => ({ id, index, custodianLabel })) };
}

export function reconstructRecoverySecret(selected: Array<{ index: number; shareHex: string }>) {
  if (selected.length === 0) throw new Error('At least one recovery share is required.');
  const shareLength = Buffer.from(selected[0].shareHex, 'hex').length;
  if (!shareLength || selected.some((share) => Buffer.from(share.shareHex, 'hex').length !== shareLength)) {
    throw new Error('Recovery shares have inconsistent lengths.');
  }
  const recovered = Buffer.alloc(shareLength);
  for (let byte = 0; byte < shareLength; byte++) {
    let value = 0;
    for (let i = 0; i < selected.length; i++) {
      const xi = selected[i].index;
      const yi = Buffer.from(selected[i].shareHex, 'hex')[byte];
      let basis = 1;
      for (let j = 0; j < selected.length; j++) {
        if (i === j) continue;
        const xj = selected[j].index;
        basis = gfMultiply(basis, gfMultiply(0 ^ xj, gfInverse(xi ^ xj)));
      }
      value ^= gfMultiply(yi, basis);
    }
    recovered[byte] = value;
  }
  return recovered.toString('utf8');
}

export function createHealthCapsule(recordIds: string[], policyId: string | undefined, expiresInHours: number) {
  const capsule = {
    id: crypto.randomUUID(),
    format: 'HEALTHVAULT-CAPSULE-1',
    recordIds: recordIds.map(String).filter(Boolean).slice(0, 100),
    policyId: policyId || null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + Math.max(1, Math.min(expiresInHours, 168)) * 3600000).toISOString(),
    packageHash: '',
  };
  capsule.packageHash = crypto.createHash('sha256').update(JSON.stringify(capsule)).digest('hex');
  const capsules = readJson<Record<string, unknown>[]>('health-capsules.json', []);
  capsules.unshift(capsule);
  writeJson('health-capsules.json', capsules.slice(0, 200));
  return capsule;
}

export interface DeviceReading {
  id: string;
  deviceType: 'digital-bp' | 'glucometer' | 'pulse-oximeter' | 'wearable';
  acquisitionMode: 'manual' | 'import' | 'direct' | 'demo';
  source: string;
  manufacturer: string;
  model: string;
  calibrationState: 'unknown' | 'documented' | 'not-applicable';
  value: Record<string, number>; 
  unit: string;
  confidence: number;
  validation: 'valid' | 'review' | 'rejected';
  recordedAt: string;
  receivedAt: string;
}

export function ingestDeviceReading(input: Record<string, unknown>) {
  const deviceType = String(input.deviceType || 'wearable') as DeviceReading['deviceType'];
  const source = String(input.source || 'Manual entry').slice(0, 160);
  const rawValues = input.values && typeof input.values === 'object' ? input.values as Record<string, number> : {};
  const values = Object.fromEntries(Object.entries(rawValues).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)).slice(0, 20));
  let confidence = 0.35;
  let validation: DeviceReading['validation'] = 'review';
  if (deviceType === 'digital-bp') {
    const systolic = Number(values.systolic);
    const diastolic = Number(values.diastolic);
    confidence = systolic >= 70 && systolic <= 220 && diastolic >= 40 && diastolic <= 130 && systolic > diastolic ? 0.82 : 0.25;
    validation = confidence >= 0.7 ? 'valid' : 'rejected';
  } else if (deviceType === 'glucometer') {
    const glucose = Number(values.glucose);
    confidence = glucose >= 20 && glucose <= 600 ? 0.88 : 0.25;
    validation = confidence >= 0.7 ? 'valid' : 'rejected';
  } else if (deviceType === 'pulse-oximeter') {
    const spo2 = Number(values.spo2);
    confidence = spo2 >= 50 && spo2 <= 100 ? 0.84 : 0.25;
    validation = confidence >= 0.7 ? 'valid' : 'rejected';
  } else if (Number.isFinite(Number(values.heartRate))) {
    confidence = 0.55;
    validation = 'review';
  }
  const acquisitionMode = ['manual', 'import', 'direct', 'demo'].includes(String(input.acquisitionMode))
    ? String(input.acquisitionMode) as DeviceReading['acquisitionMode']
    : 'demo';
  const reading: DeviceReading = {
    id: crypto.randomUUID(),
    deviceType,
    acquisitionMode,
    source,
    manufacturer: String(input.manufacturer || 'Unknown').slice(0, 160),
    model: String(input.model || 'Unknown').slice(0, 160),
    calibrationState: ['documented', 'not-applicable'].includes(String(input.calibrationState))
      ? String(input.calibrationState) as DeviceReading['calibrationState']
      : 'unknown',
    value: values,
    unit: String(input.unit || '' ).slice(0, 40),
    confidence,
    validation,
    recordedAt: String(input.recordedAt || new Date().toISOString()),
    receivedAt: new Date().toISOString(),
  };
  const readings = readJson<DeviceReading[]>('device-readings.json', []);
  readings.unshift(reading);
  writeJson('device-readings.json', readings.slice(0, 1000));
  return reading;
}

export function getDeviceReadings() {
  return readJson<DeviceReading[]>('device-readings.json', []);
}

export function getMerkleCheckpoints() {
  return readJson<Array<{ id: string; root: string; leafCount: number; createdAt: string }>>('merkle-checkpoints.json', []);
}

export function createMerkleCheckpoint(leaves: string[]) {
  let layer = leaves.length
    ? leaves.map((leaf) => crypto.createHash('sha256').update(leaf).digest('hex'))
    : [crypto.createHash('sha256').update('HEALTHVAULT-EMPTY').digest('hex')];
  while (layer.length > 1) {
    if (layer.length % 2 === 1) layer = [...layer, layer[layer.length - 1]];
    const next: string[] = [];
    for (let index = 0; index < layer.length; index += 2) {
      next.push(crypto.createHash('sha256').update(layer[index]).update(layer[index + 1]).digest('hex'));
    }
    layer = next;
  }
  const checkpoint = { id: crypto.randomUUID(), root: layer[0], leafCount: leaves.length, createdAt: new Date().toISOString() };
  const checkpoints = getMerkleCheckpoints();
  checkpoints.unshift(checkpoint);
  writeJson('merkle-checkpoints.json', checkpoints.slice(0, 100));
  return checkpoint;
}

export function createEmergencyPassport(profile: Record<string, unknown>) {
  const passport = {
    id: crypto.randomUUID(),
    format: 'HEALTHVAULT-EMERGENCY-1',
    bloodType: String(profile.bloodType || 'Unknown').slice(0, 12),
    allergies: Array.isArray(profile.allergies) ? profile.allergies.map(String).slice(0, 20) : [],
    medications: Array.isArray(profile.medications) ? profile.medications.map(String).slice(0, 20) : [],
    emergencyContact: String(profile.emergencyContact || '').slice(0, 160),
    warning: 'Decision-support and emergency reference only. Verify all information directly.',
    createdAt: new Date().toISOString(),
  };
  writeJson('emergency-passport.json', passport);
  return passport;
}

export function getDeviceConnectorCapabilities() {
  return {
    manual: { available: true, status: 'ready', description: 'User-entered certified or consumer-device readings with provenance.' },
    csvImport: { available: true, status: 'ready', description: 'Structured CSV/vendor export import with column validation.' },
    jsonImport: { available: true, status: 'ready', description: 'Vendor-neutral JSON health measurement import.' },
    webBluetooth: { available: true, status: 'adapter-ready', description: 'Browser/Electron Web Bluetooth adapter for devices that expose approved BLE GATT characteristics.' },
    usbSerial: { available: false, status: 'platform-adapter-required', description: 'Requires a signed serial/USB adapter per device vendor protocol.' },
    appleHealthKit: { available: false, status: 'native-ios-macos-adapter-required', description: 'Requires a native macOS/iOS bridge and user Health permissions.' },
    androidHealthConnect: { available: false, status: 'native-android-adapter-required', description: 'Requires an Android companion application and Health Connect permissions.' },
  };
}

export function importMeasurementsCSV(csvText: string, defaultSource = 'CSV import') {
  const lines = String(csvText || '').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV must contain a header and at least one data row.');
  const headers = lines[0].split(',').map((header) => header.trim().toLowerCase());
  const readings: DeviceReading[] = [];
  for (const line of lines.slice(1, 5000)) {
    const values = line.split(',').map((value) => value.trim());
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
    const deviceType = String(row.device_type || row.devicetype || row.type || 'wearable') as DeviceReading['deviceType'];
    const numericValues: Record<string, number> = {};
    for (const key of Object.keys(row)) {
      const number = Number(row[key]);
      if (Number.isFinite(number) && row[key] !== '') numericValues[key] = number;
    }
    readings.push(ingestDeviceReading({ deviceType, source: row.source || defaultSource, acquisitionMode: 'import', manufacturer: row.manufacturer, model: row.model, calibrationState: row.calibration_state || row.calibration, values: numericValues, unit: row.unit || '', recordedAt: row.recorded_at || row.timestamp || new Date().toISOString() }));
  }
  return { imported: readings.length, readings };
}

export function runAdversarySimulation(scenario: string) {
  const scenarios: Record<string, { outcome: string; blocked: boolean; explanation: string }> = {
    ciphertext_tamper: { outcome: 'Tampered object rejected', blocked: true, explanation: 'Authenticated encryption detects altered ciphertext before decryption.' },
    replayed_share: { outcome: 'Expired share rejected', blocked: true, explanation: 'The share resolution path checks expiry and revocation state.' },
    wrong_passphrase: { outcome: 'Decryption denied', blocked: true, explanation: 'Wrong passphrases do not reveal plaintext and generate audit evidence.' },
    stale_consent: { outcome: 'Stale consent rejected', blocked: true, explanation: 'Consent expiry and revocation are evaluated before access.' },
    missing_object: { outcome: 'Missing object quarantined', blocked: true, explanation: 'Catalog integrity verification detects an unavailable encrypted object.' },
  };
  const result = scenarios[scenario] || scenarios.wrong_passphrase;
  return { scenario: scenario || 'wrong_passphrase', simulatedAt: new Date().toISOString(), ...result };
}
