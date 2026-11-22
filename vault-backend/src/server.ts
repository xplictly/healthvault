import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createHash, randomUUID } from 'crypto';
import { encryptFile, decryptFile } from './services/crypto.service';
import { analyzeMedicalRecord } from './services/record-intelligence.service';
import {
  addAudit,
  getAudit,
  getEmergencyProfile,
  saveEmergencyProfile,
  addIotReading,
  getIotReadings,
  createShare,
  resolveShare,
  getAnomalyReport,
  extractRecordText,
  extractLabValues,
} from './services/health-suite.service';
import { readCollection, writeCollection, addItem, getProductSuite, setupTwoFactor, verifyTwoFactor } from './services/product-suite.service';
import {
  getEvidenceGraph, addEvidenceNode, linkEvidence, getClinicalTimeline,
  getConsentPolicies, createConsentPolicy, revokeConsentPolicy,
  createRecoveryShares, reconstructRecoverySecret, createHealthCapsule,
  ingestDeviceReading, getDeviceReadings, createMerkleCheckpoint, getMerkleCheckpoints,
  createEmergencyPassport, runAdversarySimulation, getDeviceConnectorCapabilities, importMeasurementsCSV,
} from './services/advanced-vault.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS with exposed download headers and JSON parsing
app.use(cors({
  origin: '*',
  exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length', 'X-Vault-Decrypted']
}));
app.use(express.json());

// Directories and file paths
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'encrypted');
const METADATA_FILE = path.join(__dirname, '..', 'metadata.json');

// Ensure encrypted uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Ensure metadata.json exists
if (!fs.existsSync(METADATA_FILE)) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify([], null, 2), 'utf-8');
}

export interface FileMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  encryptedSize: number;
  encFileName: string;
  uploadDate: string;
}

// Helpers for reading and writing metadata securely
function readMetadata(): FileMetadata[] {
  try {
    const raw = fs.readFileSync(METADATA_FILE, 'utf-8');
    if (!raw || !raw.trim()) return [];
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error reading metadata.json:', error);
    return [];
  }
}

function writeMetadata(data: FileMetadata[]): void {
  fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Multer in-memory storage (raw unencrypted files NEVER touch disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  }
});

// Health check endpoints (supports root, /api/health, and /api/vault/health for mobile ping)
const sendHealthCheck = (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'HealthVault Cryptographic Service',
    algorithm: 'AES-256-GCM with PBKDF2-SHA256 (100k rounds); CBC compatibility enabled',
    timestamp: new Date().toISOString()
  });
};

app.get('/health', sendHealthCheck);
app.get('/api/health', sendHealthCheck);
app.get('/api/vault/health', sendHealthCheck);

/**
 * POST /api/vault/upload
 * Handles in-memory encrypted upload of medical records.
 */
app.post('/api/vault/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const passphrase = req.body?.passphrase;

    // Validation: Missing file or passphrase
    if (!file) {
      res.status(400).json({ error: 'Missing file: A valid file payload is required.' });
      return;
    }

    if (!passphrase || typeof passphrase !== 'string' || passphrase.trim().length === 0) {
      res.status(400).json({ error: 'Missing passphrase: A strong encryption passphrase is required.' });
      return;
    }

    // 1. Generate unique file ID and filename
    const fileId = randomUUID();
    const encFileName = `${fileId}.enc`;
    const encFilePath = path.join(UPLOADS_DIR, encFileName);

    // 2. Encrypt the file buffer in memory
    const encryptedBuffer = encryptFile(file.buffer, passphrase);

    // 3. Write ONLY the encrypted buffer to disk
    await fs.promises.writeFile(encFilePath, encryptedBuffer);

    // 4. Record sanitized metadata (no passwords, keys, or salts stored here)
    const newRecord: FileMetadata = {
      id: fileId,
      originalName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
      encryptedSize: encryptedBuffer.length,
      encFileName,
      uploadDate: new Date().toISOString()
    };

    const currentRecords = readMetadata();
    currentRecords.unshift(newRecord);
    writeMetadata(currentRecords);
    addAudit('Record encrypted and deposited', 'success', `${newRecord.originalName} was encrypted with AES-256.`);

    res.status(201).json({
      message: 'Medical record encrypted with AES-256-GCM and securely stored.',
      metadata: newRecord
    });
  } catch (error) {
    console.error('Upload encryption error:', error);
    res.status(500).json({ error: 'Encryption failed while processing upload.' });
  }
});

/**
 * GET /api/vault/files
 * Returns metadata listing for all encrypted files in the vault.
 */
app.get('/api/vault/files', (_req: Request, res: Response): void => {
  try {
    const records = readMetadata();
    res.json({ files: records });
  } catch (error) {
    console.error('Fetch files error:', error);
    res.status(500).json({ error: 'Failed to retrieve vault files metadata.' });
  }
});

/**
 * POST /api/vault/decrypt/:id
 * Decrypts an encrypted file and streams/returns the raw buffer if passphrase is valid.
 */
app.post('/api/vault/decrypt/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const passphrase = req.body?.passphrase;

    if (!passphrase || typeof passphrase !== 'string') {
      res.status(400).json({ error: 'Passphrase is required to unlock this file.' });
      return;
    }

    const records = readMetadata();
    const target = records.find((item) => item.id === id);

    if (!target) {
      res.status(404).json({ error: 'File record not found in vault metadata.' });
      return;
    }

    const encFilePath = path.join(UPLOADS_DIR, target.encFileName);
    if (!fs.existsSync(encFilePath)) {
      res.status(404).json({ error: 'Encrypted storage asset not found on server.' });
      return;
    }

    // Read the encrypted file
    const encryptedBuffer = await fs.promises.readFile(encFilePath);

    // Attempt decryption
    let decryptedBuffer: Buffer;
    try {
      decryptedBuffer = decryptFile(encryptedBuffer, passphrase);
    } catch (cryptoErr) {
      // Bad passphrase or corrupted ciphertext
      addAudit('Decryption attempt blocked', 'blocked', `Invalid passphrase for record ${target.originalName}.`);
      res.status(401).json({ error: 'Invalid Passphrase / Decryption Failed.' });
      return;
    }

    // Determine inline vs attachment view based on query parameter
    const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
    const sanitizedFilename = target.originalName.replace(/["\r\n\\]/g, '_');

    // Stream raw file buffer with appropriate headers
    res.setHeader('Content-Type', target.mimeType);
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${sanitizedFilename}"; filename*=UTF-8''${encodeURIComponent(target.originalName)}`
    );
    res.setHeader('Content-Length', decryptedBuffer.length);
    res.setHeader('X-Vault-Decrypted', 'true');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    res.status(200).send(decryptedBuffer);
  } catch (error) {
    console.error('Decryption handler error:', error);
    res.status(500).json({ error: 'Internal server error during decryption.' });
  }
});

/**
 * POST /api/vault/analyze/:id
 * Decrypts a record only in memory, then performs local text classification and extraction.
 */
app.post('/api/vault/analyze/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const passphrase = req.body?.passphrase;

    if (!passphrase || typeof passphrase !== 'string') {
      res.status(400).json({ error: 'Passphrase is required to analyze this record.' });
      return;
    }

    const records = readMetadata();
    const target = records.find((item) => item.id === id);
    if (!target) {
      res.status(404).json({ error: 'File record not found in vault metadata.' });
      return;
    }

    const encFilePath = path.join(UPLOADS_DIR, target.encFileName);
    if (!fs.existsSync(encFilePath)) {
      res.status(404).json({ error: 'Encrypted storage asset not found on server.' });
      return;
    }

    const encryptedBuffer = await fs.promises.readFile(encFilePath);
    let decryptedBuffer: Buffer;
    try {
      decryptedBuffer = decryptFile(encryptedBuffer, passphrase);
    } catch {
      addAudit('AI analysis blocked', 'blocked', `Invalid passphrase for record ${target.originalName}.`);
      res.status(401).json({ error: 'Invalid Passphrase / Analysis Rejected.' });
      return;
    }

    const insights = await analyzeMedicalRecord(decryptedBuffer, target.mimeType, target.originalName);
    res.setHeader('Cache-Control', 'no-store, private');
    res.status(200).json({ insights });
  } catch (error) {
    console.error('Medical record analysis error:', error);
    res.status(500).json({ error: 'Local analysis failed while processing the record.' });
  }
});

app.get('/api/vault/health-suite/overview', (_req: Request, res: Response) => {
  const iot = getIotReadings();
  const anomaly = getAnomalyReport();
  res.json({
    emergencyProfile: getEmergencyProfile(),
    iotReadings: iot,
    audit: getAudit().slice(0, 25),
    anomaly,
    capabilities: {
      ocr: 'PDF, text, and local Tesseract image OCR are available.',
      timeline: 'Record metadata timeline available from encrypted vault catalog.',
      labTrends: 'Lab measurement extraction available after passphrase-gated decryption.',
      comparison: 'Two-record difference extraction available.',
      cloud: process.env.CLOUD_STORAGE_PROVIDER || 'Local encrypted storage (cloud adapter ready)',
      sharing: 'Time-limited metadata-sharing tokens are enabled.',
    },
  });
});

app.put('/api/vault/health-suite/emergency-profile', (req: Request, res: Response) => {
  res.json({ profile: saveEmergencyProfile(req.body || {}) });
});

app.post('/api/vault/health-suite/iot', (req: Request, res: Response) => {
  const reading = addIotReading(req.body || {});
  res.status(201).json({ reading });
});

app.post('/api/vault/health-suite/shares/:id', (req: Request, res: Response) => {
  const target = readMetadata().find((item) => item.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'File record not found.' });
    return;
  }
  const share = createShare(target.id, Number(req.body?.expiresInHours || 24), String(req.body?.label || target.originalName));
  res.status(201).json({ share });
});

app.get('/api/vault/health-suite/shares/:token', (req: Request, res: Response) => {
  const share = resolveShare(req.params.token);
  if (!share) {
    res.status(404).json({ error: 'Share not found.' });
    return;
  }
  if ('expired' in share) {
    res.status(410).json({ error: 'Share has expired.' });
    return;
  }
  const target = readMetadata().find((item) => item.id === share.fileId);
  res.json({ share, record: target ? { id: target.id, originalName: target.originalName, mimeType: target.mimeType, uploadDate: target.uploadDate } : null });
});

app.post('/api/vault/health-suite/compare/:first/:second', async (req: Request, res: Response): Promise<void> => {
  const passphrase = req.body?.passphrase;
  if (!passphrase || typeof passphrase !== 'string') {
    res.status(400).json({ error: 'Passphrase is required to compare records.' });
    return;
  }
  const records = readMetadata();
  const first = records.find((item) => item.id === req.params.first);
  const second = records.find((item) => item.id === req.params.second);
  if (!first || !second) {
    res.status(404).json({ error: 'One or both record IDs were not found.' });
    return;
  }
  try {
    const [firstBuffer, secondBuffer] = await Promise.all([
      fs.promises.readFile(path.join(UPLOADS_DIR, first.encFileName)),
      fs.promises.readFile(path.join(UPLOADS_DIR, second.encFileName)),
    ]);
    const [firstPlaintext, secondPlaintext] = [
      decryptFile(firstBuffer, passphrase),
      decryptFile(secondBuffer, passphrase),
    ];
    const firstText = await extractRecordText(firstPlaintext, first.mimeType);
    const secondText = await extractRecordText(secondPlaintext, second.mimeType);
    const firstValues = extractLabValues(firstText);
    const secondValues = extractLabValues(secondText);
    addAudit('Record comparison completed', 'success', `${first.originalName} was compared with ${second.originalName}.`);
    res.json({
      first: { fileName: first.originalName, values: firstValues, words: firstText.trim().split(/\s+/).length },
      second: { fileName: second.originalName, values: secondValues, words: secondText.trim().split(/\s+/).length },
    });




  } catch {
    addAudit('Record comparison blocked', 'blocked', 'Passphrase or record data rejected during comparison.');
    res.status(401).json({ error: 'Invalid Passphrase / Comparison Rejected.' });
  }
});

app.get('/api/vault/product-suite', (_req: Request, res: Response) => {
  res.json({ ...getProductSuite(), records: readMetadata().map(({ id, originalName, mimeType, uploadDate }) => ({ id, originalName, mimeType, uploadDate })) });
});

app.post('/api/vault/product-suite/:collection', (req: Request, res: Response) => {
  const allowed = ['medications', 'appointments', 'vaccinations', 'doctors', 'insurance', 'family-profiles'] as const;
  const collection = req.params.collection;
  if (!allowed.includes(collection as typeof allowed[number])) {
    res.status(400).json({ error: 'Unknown product-suite collection.' });
    return;
  }
  const record = addItem(`${collection}.json` as any, req.body || {});
  addAudit(`${collection} entry created`, 'success', `A local ${collection} entry was created.`);
  res.status(201).json({ item: record });
});

app.delete('/api/vault/product-suite/:collection/:id', (req: Request, res: Response) => {
  const map: Record<string, string> = {
    medications: 'medications.json', appointments: 'appointments.json', vaccinations: 'vaccinations.json',
    doctors: 'doctors.json', insurance: 'insurance.json', 'family-profiles': 'family-profiles.json',
  };
  const file = map[req.params.collection];
  if (!file) {
    res.status(400).json({ error: 'Unknown collection.' });
    return;
  }
  const collection = readCollection(file as any);
  writeCollection(file as any, collection.filter((item: any) => item.id !== req.params.id));
  res.json({ deleted: true, id: req.params.id });
});

app.put('/api/vault/product-suite/notifications', (req: Request, res: Response) => {
  writeCollection('notification-settings.json', [{ ...req.body, updatedAt: new Date().toISOString() }]);
  res.json({ settings: req.body });
});

app.post('/api/vault/product-suite/two-factor/setup', (_req: Request, res: Response) => {
  res.json(setupTwoFactor());
});

app.post('/api/vault/product-suite/two-factor/verify', (req: Request, res: Response) => {
  const valid = verifyTwoFactor(String(req.body?.code || ''));
  if (valid) {
    const records = readCollection('two-factor.json');
    writeCollection('two-factor.json', [{ ...records[0], enabled: true }]);
    addAudit('Two-factor verification enabled', 'success', 'Local demo verification was enabled.');
  }
  res.json({ valid });
});

app.get('/api/vault/product-suite/search', (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const files = readMetadata().filter((item) =>
    !q || item.originalName.toLowerCase().includes(q) || item.mimeType.toLowerCase().includes(q) ||
    item.uploadDate.toLowerCase().includes(q)
  );
  res.json({ query: q, files });
});

app.get('/api/vault/product-suite/export', (_req: Request, res: Response) => {
  const summary = {
    generatedAt: new Date().toISOString(),
    disclaimer: 'Local health-summary export. Not a diagnosis or official medical record.',
    records: readMetadata().map(({ originalName, mimeType, uploadDate }) => ({ originalName, mimeType, uploadDate })),
    ...getProductSuite(),
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="healthvault-summary.json"');
  res.json(summary);
});

app.get('/api/vault/advanced/evidence/graph', (_req: Request, res: Response) => {
  res.json(getEvidenceGraph());
});

app.post('/api/vault/advanced/evidence/nodes', (req: Request, res: Response) => {
  res.status(201).json({ node: addEvidenceNode(req.body || {}) });
});

app.post('/api/vault/advanced/evidence/links', (req: Request, res: Response) => {
  const edge = linkEvidence(String(req.body?.from || ''), String(req.body?.to || ''), String(req.body?.relation || 'related'), Number(req.body?.strength || 0.5));
  res.status(201).json({ edge });
});

app.get('/api/vault/advanced/timeline', (_req: Request, res: Response) => {
  res.json({ events: getClinicalTimeline() });
});

app.get('/api/vault/advanced/consent', (_req: Request, res: Response) => {
  res.json({ policies: getConsentPolicies() });
});

app.post('/api/vault/advanced/consent', (req: Request, res: Response) => {
  res.status(201).json({ policy: createConsentPolicy(req.body || {}) });
});

app.post('/api/vault/advanced/consent/:id/revoke', (req: Request, res: Response) => {
  const policy = revokeConsentPolicy(req.params.id);
  if (!policy) {
    res.status(404).json({ error: 'Consent policy not found.' });
    return;
  }
  res.json({ policy });
});

app.post('/api/vault/advanced/recovery/shares', (req: Request, res: Response) => {
  const result = createRecoveryShares(Number(req.body?.threshold || 3), Number(req.body?.total || 5), String(req.body?.secret || ''), Array.isArray(req.body?.custodians) ? req.body.custodians : []);
  res.status(201).json({ recovery: result });
});

app.post('/api/vault/advanced/recovery/reconstruct', (req: Request, res: Response) => {
  try {
    const secret = reconstructRecoverySecret(Array.isArray(req.body?.shares) ? req.body.shares : []);
    res.json({ recovered: true, secret });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Recovery reconstruction failed.' });
  }
});

app.post('/api/vault/advanced/capsules', (req: Request, res: Response) => {
  res.status(201).json({ capsule: createHealthCapsule(Array.isArray(req.body?.recordIds) ? req.body.recordIds : [], req.body?.policyId, Number(req.body?.expiresInHours || 24)) });
});

app.get('/api/vault/advanced/devices/connectors', (_req: Request, res: Response) => {
  res.json({ connectors: getDeviceConnectorCapabilities() });
});

app.get('/api/vault/advanced/devices/readings', (_req: Request, res: Response) => {
  res.json({ readings: getDeviceReadings() });
});

app.post('/api/vault/advanced/devices/readings', (req: Request, res: Response) => {
  res.status(201).json({ reading: ingestDeviceReading({ ...(req.body || {}), acquisitionMode: req.body?.acquisitionMode || 'manual' }) });
});

app.post('/api/vault/advanced/devices/import/csv', (req: Request, res: Response) => {
  try {
    const result = importMeasurementsCSV(String(req.body?.csv || ''), String(req.body?.source || 'CSV import'));
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Measurement import failed.' });
  }
});

app.get('/api/vault/advanced/merkle/checkpoints', (_req: Request, res: Response) => {
  res.json({ checkpoints: getMerkleCheckpoints() });
});

app.post('/api/vault/advanced/merkle/checkpoints', (req: Request, res: Response) => {
  res.status(201).json({ checkpoint: createMerkleCheckpoint(Array.isArray(req.body?.leaves) ? req.body.leaves : []) });
});

app.post('/api/vault/advanced/emergency-passport', (req: Request, res: Response) => {
  res.status(201).json({ passport: createEmergencyPassport(req.body || {}) });
});

app.post('/api/vault/advanced/adversary/simulate', (req: Request, res: Response) => {
  res.json({ simulation: true, result: runAdversarySimulation(String(req.body?.scenario || 'wrong_passphrase')) });
});

app.get('/api/vault/integrity/ledger', async (_req: Request, res: Response) => {
  const records = readMetadata();
  let previousHash = createHash('sha256').update('HEALTHVAULT-GENESIS').digest('hex');
  const entries = [];

  for (const record of [...records].reverse()) {
    const encryptedPath = path.join(UPLOADS_DIR, record.encFileName);
    let encryptedHash = createHash('sha256').update('missing').digest('hex');
    let present = false;
    if (fs.existsSync(encryptedPath)) {
      const encrypted = await fs.promises.readFile(encryptedPath);
      encryptedHash = createHash('sha256').update(encrypted).digest('hex');
      present = true;
    }
    const payload = JSON.stringify({
      id: record.id,
      name: record.originalName,
      uploadedAt: record.uploadDate,
      encryptedHash,
      previousHash,
    });
    const chainHash = createHash('sha256').update(payload).digest('hex');
    entries.push({
      sequence: entries.length + 1,
      recordId: record.id,
      name: record.originalName,
      encryptedHash,
      previousHash,
      chainHash,
      present,
      verifiedAt: new Date().toISOString(),
    });
    previousHash = chainHash;
  }

  res.json({
    algorithm: 'SHA-256 hash chain over encrypted objects',
    genesis: 'HEALTHVAULT-GENESIS',
    head: previousHash,
    recordCount: records.length,
    entries: entries.reverse(),
    verifiedAt: new Date().toISOString(),
  });
});

app.get('/api/vault/timeline', (_req: Request, res: Response) => {
  const records = readMetadata();
  const groups = new Map<string, typeof records>();
  for (const record of records) {
    const date = new Date(record.uploadDate);
    const key = Number.isNaN(date.getTime())
      ? 'Unknown date'
      : date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    groups.set(key, [...(groups.get(key) || []), record]);
  }
  res.json({
    groups: Array.from(groups.entries()).map(([period, items]) => ({ period, items })),
    totalBytes: records.reduce((sum, record) => sum + record.encryptedSize, 0),
  });
});

app.get('/api/vault/integrity/verify/:id', async (req: Request, res: Response): Promise<void> => {
  const target = readMetadata().find((record) => record.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'Record not found in vault metadata.' });
    return;
  }
  const encryptedPath = path.join(UPLOADS_DIR, target.encFileName);
  if (!fs.existsSync(encryptedPath)) {
    res.status(404).json({ present: false, verified: false, error: 'Encrypted object is missing.' });
    return;
  }
  const encrypted = await fs.promises.readFile(encryptedPath);
  const encryptedHash = createHash('sha256').update(encrypted).digest('hex');
  const records = readMetadata();
  const position = records.findIndex((record) => record.id === target.id);
  res.json({
    recordId: target.id,
    name: target.originalName,
    present: true,
    verified: encrypted.length === target.encryptedSize,
    encryptedBytes: encrypted.length,
    expectedBytes: target.encryptedSize,
    encryptedSha256: encryptedHash,
    catalogPosition: position + 1,
    catalogSize: records.length,
    verifiedAt: new Date().toISOString(),
  });
});

app.get('/api/vault/operations/snapshot', (_req: Request, res: Response) => {
  const records = readMetadata();
  const audit = getAudit();
  const now = Date.now();
  const last30Days = records.filter((record) => now - new Date(record.uploadDate).getTime() <= 30 * 24 * 60 * 60 * 1000).length;
  const byType = records.reduce<Record<string, number>>((counts, record) => {
    const type = record.mimeType.split('/')[0] || 'other';
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {});
  const successEvents = audit.filter((event) => event.status === 'success').length;
  const blockedEvents = audit.filter((event) => event.status === 'blocked').length;
  res.json({
    generatedAt: new Date().toISOString(),
    recordCount: records.length,
    encryptedBytes: records.reduce((sum, record) => sum + record.encryptedSize, 0),
    plaintextCatalogBytes: records.reduce((sum, record) => sum + record.size, 0),
    uploadedLast30Days: last30Days,
    typeDistribution: Object.entries(byType).map(([type, count]) => ({ type, count })),
    audit: { totalEvents: audit.length, successEvents, blockedEvents },
    readiness: records.length === 0 ? 'NO_OBJECTS' : blockedEvents > successEvents ? 'REVIEW' : 'READY',
  });
});

app.post('/api/vault/files/batch-delete', async (req: Request, res: Response) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).filter(Boolean) : [];
  if (ids.length === 0) {
    res.status(400).json({ error: 'At least one record ID is required.' });
    return;
  }
  const records = readMetadata();
  const selected = new Set(ids);
  const removed: string[] = [];

  for (const record of records) {
    if (!selected.has(record.id)) continue;
    const encryptedPath = path.join(UPLOADS_DIR, record.encFileName);
    if (fs.existsSync(encryptedPath)) await fs.promises.unlink(encryptedPath);
    removed.push(record.id);
  }

  writeMetadata(records.filter((record) => !selected.has(record.id)));
  addAudit('Batch encrypted records erased', 'warning', `${removed.length} records were permanently shredded.`);
  res.json({ deleted: removed.length, ids: removed });
});

app.get('/api/vault/product-suite/print-summary', (_req: Request, res: Response) => {
  const suite = getProductSuite();
  const html = `<!doctype html><html><head><title>HealthVault Medical Summary</title><style>body{font-family:Arial;color:#17202a;padding:40px}h1{letter-spacing:.08em}.card{border:1px solid #ccd4dc;border-radius:8px;padding:16px;margin:12px 0}</style></head><body><h1>HEALTHVAULT</h1><p>Generated ${new Date().toLocaleString()}</p><div class="card"><h2>Profile</h2><pre>${JSON.stringify(suite, null, 2)}</pre></div><p>Decision-support information only. Not a diagnosis.</p></body></html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/**
 * DELETE /api/vault/files/:id (Bonus cleanup endpoint)
 */
app.delete('/api/vault/files/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const records = readMetadata();
    const targetIndex = records.findIndex((item) => item.id === id);

    if (targetIndex === -1) {
      res.status(404).json({ error: 'File record not found.' });
      return;
    }

    const target = records[targetIndex];
    const encFilePath = path.join(UPLOADS_DIR, target.encFileName);

    if (fs.existsSync(encFilePath)) {
      await fs.promises.unlink(encFilePath);
    }
    addAudit('Encrypted record erased', 'warning', `${target.originalName} was permanently deleted.`);

    records.splice(targetIndex, 1);
    writeMetadata(records);

    res.json({ message: 'Encrypted file permanently erased from vault.', id });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file.' });
  }
});

app.listen(PORT, () => {
  console.log(`🔒 HealthVault Cryptographic Backend operational on port ${PORT}`);
  console.log(`📁 Encrypted uploads storage path: ${UPLOADS_DIR}`);
  console.log(`📋 Metadata catalog path: ${METADATA_FILE}`);
});
