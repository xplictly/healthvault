'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  FileText,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  HardDrive,
  Cpu,
  Fingerprint,
  X,
  FileCheck,
  ShieldAlert,
  Clock,
  Database,
  Terminal,
  Hash,
  ChevronRight,
  Zap,
  Activity,
  Search,
  GitBranch,
  Layers,
  Trash2,
  Smartphone,
  Wifi,
  ChevronLeft
} from 'lucide-react';
import { GhostSticker, VaultSticker, CloudSticker, SmileySticker } from '../components/AvaraStickers';
import {
  initializeBleAdapter,
  readNativeHealthSamples,
  requestHealthAuthorization,
  resolveApiBase,
  setupNativeBackButton,
  getCustomApiBase,
  setCustomApiBase
} from '../lib/mobile-adapters';

interface VaultFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  encryptedSize: number;
  encFileName: string;
  uploadDate: string;
}

interface RecordInsight {
  category: string;
  confidence: number;
  summary: string;
  keywords: string[];
  extractedMetrics: string[];
  disclaimer: string;
  engine: string;
}

interface HealthSuiteData {
  emergencyProfile: {
    bloodType: string;
    allergies: string[];
    medications: string[];
    emergencyContact: string;
  };
  iotReadings: Array<Record<string, string | number>>;
  audit: Array<{ id: string; action: string; status: string; detail: string; timestamp: string }>;
  anomaly: { score: number; level: string; blockedAttempts: number; warnings: number };
  capabilities: Record<string, string>;
}

interface IntegrityLedger {
  algorithm: string;
  head: string;
  recordCount: number;
  entries: Array<{ recordId: string; name: string; chainHash: string; present: boolean }>;
  verifiedAt: string;
}

interface TimelineData {
  groups: Array<{ period: string; items: VaultFile[] }>;
  totalBytes: number;
}

interface OperationSnapshot {
  recordCount: number;
  encryptedBytes: number;
  plaintextCatalogBytes: number;
  uploadedLast30Days: number;
  readiness: string;
  audit: { totalEvents: number; successEvents: number; blockedEvents: number };
}

interface VerificationResult {
  verified: boolean;
  encryptedSha256: string;
  encryptedBytes: number;
  expectedBytes: number;
}

interface ProductSuiteData {
  medications: Array<Record<string, any>>;
  appointments: Array<Record<string, any>>;
  vaccinations: Array<Record<string, any>>;
  doctors: Array<Record<string, any>>;
  insurance: Array<Record<string, any>>;
  familyProfiles: Array<Record<string, any>>;
  notifications: Record<string, any>;
  twoFactor: { enabled: boolean; enrolled: boolean };
  offline: { encryptedMetadataCache: boolean; plaintextStored: boolean };
  cloud: { provider: string; encryptedObjectStorage: boolean; metadataStore: string };
  search: { searchableFields: string[] };
}

const API_BASE = resolveApiBase();

export default function VaultDashboard() {
  const [activePanel, setActivePanel] = useState<'upload' | 'vault' | null>(null);
  const [introVisible, setIntroVisible] = useState(true);
  const [introLeaving, setIntroLeaving] = useState(false);
  const [introProgress, setIntroProgress] = useState(0);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [files, setFiles] = useState<VaultFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [activeDecryptFile, setActiveDecryptFile] = useState<VaultFile | null>(null);
  const [decryptPassphrase, setDecryptPassphrase] = useState('');
  const [showDecryptPassphrase, setShowDecryptPassphrase] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [analysisFile, setAnalysisFile] = useState<VaultFile | null>(null);
  const [analysisPassphrase, setAnalysisPassphrase] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [recordInsight, setRecordInsight] = useState<RecordInsight | null>(null);
  const [healthSuiteOpen, setHealthSuiteOpen] = useState(false);
  const [healthSuite, setHealthSuite] = useState<HealthSuiteData | null>(null);
  const [healthSuiteLoading, setHealthSuiteLoading] = useState(false);
  const [productSuite, setProductSuite] = useState<ProductSuiteData | null>(null);
  const [recordSearch, setRecordSearch] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [integrityLedger, setIntegrityLedger] = useState<IntegrityLedger | null>(null);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [operationSnapshot, setOperationSnapshot] = useState<OperationSnapshot | null>(null);
  const [verificationResults, setVerificationResults] = useState<Record<string, VerificationResult>>({});
  const [verifyingRecordId, setVerifyingRecordId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [batchShredding, setBatchShredding] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [previewMime, setPreviewMime] = useState<string>('');
  const [islandCompact, setIslandCompact] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [encryptCelebration, setEncryptCelebration] = useState(false);
  const [serverSettingsOpen, setServerSettingsOpen] = useState(false);
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [apiPingStatus, setApiPingStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [apiPingMessage, setApiPingMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const seenIntro = sessionStorage.getItem('healthvault-intro-seen');
    if (seenIntro) {
      setIntroVisible(false);
      return;
    }

    const exitTimeout = window.setTimeout(() => {
      setIntroLeaving(true);
    }, 2000);

    const timeout = window.setTimeout(() => {
      sessionStorage.setItem('healthvault-intro-seen', 'true');
      setIntroVisible(false);
    }, 2500);

    return () => {
      window.clearTimeout(exitTimeout);
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCarouselIndex((current) => (current + 1) % 3);
    }, 6500);
    return () => window.clearInterval(interval);
  }, []);

  const loadFiles = async () => {
    setIsLoadingFiles(true);
    setFetchError(null);
    try {
      const res = await fetch(`${API_BASE}/files`);
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err: any) {
      setFetchError('Connection to vault backend failed. Ensure server is running.');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const loadAdvancedVaultState = async () => {
    try {
      const [ledgerRes, timelineRes, snapshotRes] = await Promise.all([
        fetch(`${API_BASE}/integrity/ledger`),
        fetch(`${API_BASE}/timeline`),
        fetch(`${API_BASE}/operations/snapshot`),
      ]);
      if (ledgerRes.ok) setIntegrityLedger(await ledgerRes.json());
      if (timelineRes.ok) setTimeline(await timelineRes.json());
      if (snapshotRes.ok) setOperationSnapshot(await snapshotRes.json());
    } catch {
      setIntegrityLedger(null);
      setTimeline(null);
    }
  };

  useEffect(() => {
    loadFiles();
    loadAdvancedVaultState();
    setCustomApiUrl(getCustomApiBase() || resolveApiBase());
  }, []);

  const dismissTopmostLayer = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewFileName('');
      setPreviewMime('');
      return true;
    }
    if (analysisFile) {
      setAnalysisFile(null);
      setAnalysisPassphrase('');
      setAnalysisError(null);
      setRecordInsight(null);
      return true;
    }
    if (activeDecryptFile) {
      setActiveDecryptFile(null);
      setDecryptPassphrase('');
      setDecryptError(null);
      return true;
    }
    if (serverSettingsOpen) {
      setServerSettingsOpen(false);
      return true;
    }
    if (commandOpen) {
      setCommandOpen(false);
      setCommandQuery('');
      return true;
    }
    if (healthSuiteOpen) {
      setHealthSuiteOpen(false);
      return true;
    }
    if (activePanel) {
      setActivePanel(null);
      return true;
    }
    return false;
  };

  useEffect(() => {
    const cleanup = setupNativeBackButton(dismissTopmostLayer);
    return cleanup;
  }, [previewUrl, analysisFile, activeDecryptFile, serverSettingsOpen, commandOpen, healthSuiteOpen, activePanel]);

  const testApiConnection = async (targetUrl?: string) => {
    const url = targetUrl || customApiUrl;
    setApiPingStatus('testing');
    setApiPingMessage('Pinging health endpoint...');
    try {
      const start = Date.now();
      const res = await fetch(`${url.replace(/\/$/, '')}/health`, { method: 'GET' });
      const elapsed = Date.now() - start;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApiPingStatus('success');
      setApiPingMessage(`Connected! (${elapsed}ms) - ${data.service || 'Operational'}`);
    } catch (err: any) {
      setApiPingStatus('error');
      setApiPingMessage(`Connection failed: ${err.message || 'Network error'}`);
    }
  };

  const saveApiUrl = () => {
    setCustomApiBase(customApiUrl);
    setServerSettingsOpen(false);
    window.location.reload();
  };

  const resetApiUrl = () => {
    setCustomApiBase('');
    const standard = resolveApiBase();
    setCustomApiUrl(standard);
    setApiPingStatus('idle');
    setApiPingMessage('Reset to platform default.');
  };

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => setIslandCompact(window.scrollY > 18);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissTopmostLayer();
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === '1') {
        event.preventDefault();
        setHealthSuiteOpen(false);
        setActivePanel('upload');
      }
      if (event.key === '2') {
        event.preventDefault();
        setHealthSuiteOpen(false);
        setActivePanel('vault');
      }
      if (event.key === '3') {
        event.preventDefault();
        setActivePanel(null);
        openHealthSuite();
      }
      if (event.key === 'k') {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [previewUrl, analysisFile, activeDecryptFile, commandOpen, healthSuiteOpen, activePanel]);

  const loadHealthSuite = async () => {
    setHealthSuiteLoading(true);
    try {
      const [res, productRes] = await Promise.all([
        fetch(`${API_BASE}/health-suite/overview`),
        fetch(`${API_BASE}/product-suite`),
      ]);
      if (!res.ok || !productRes.ok) throw new Error('Unable to load health suite');
      setHealthSuite(await res.json());
      setProductSuite(await productRes.json());
    } catch {
      setHealthSuite(null);
    } finally {
      setHealthSuiteLoading(false);
    }
  };

  const openHealthSuite = () => {
    setHealthSuiteOpen(true);
    loadHealthSuite();
  };

  const addDemoIotReading = async () => {
    await fetch(`${API_BASE}/health-suite/iot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'Demo wearable',
        heartRate: 68 + Math.floor(Math.random() * 18),
        systolic: 118 + Math.floor(Math.random() * 12),
        diastolic: 76 + Math.floor(Math.random() * 8),
        oxygen: 97 + Math.floor(Math.random() * 3),
        sleepHours: 7 + Number((Math.random() * 1.5).toFixed(1)),
        steps: 4200 + Math.floor(Math.random() * 5000),
      }),
    });
    loadHealthSuite();
  };

  const addProductItem = async (collection: string) => {
    const examples: Record<string, string> = {
      medications: 'Medication, dose, and schedule',
      appointments: 'Appointment and location',
      vaccinations: 'Vaccination name and date',
      doctors: 'Doctor name and specialty',
      insurance: 'Provider and policy ID',
      'family-profiles': 'Family member and relationship',
    };
    const title = window.prompt(`${examples[collection]} (title/name):`);
    if (!title) return;
    const detail = window.prompt('Details / notes:', '') || '';
    await fetch(`${API_BASE}/product-suite/${collection}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, detail }),
    });
    loadHealthSuite();
  };

  const enableDemoTwoFactor = async () => {
    const setup = await (await fetch(`${API_BASE}/product-suite/two-factor/setup`, { method: 'POST' })).json();
    const code = window.prompt(`Demo setup code generated: ${setup.setupSecret.slice(0, 6)}\nEnter any 6-digit code divisible by 7 to enable verification:`);
    if (!code) return;
    await fetch(`${API_BASE}/product-suite/two-factor/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    loadHealthSuite();
  };

  const toggleNotifications = async () => {
    if (typeof Notification === 'undefined') {
      window.alert('Browser notifications are not supported here.');
      return;
    }
    const permission = await Notification.requestPermission();
    await fetch(`${API_BASE}/product-suite/notifications`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: permission === 'granted', medicationReminders: permission === 'granted', appointmentReminders: permission === 'granted' }),
    });
    loadHealthSuite();
  };

  const ingestManualDevice = async (deviceType: 'digital-bp' | 'glucometer' | 'pulse-oximeter') => {
    const manufacturer = window.prompt('Device manufacturer:', '')?.trim();
    const model = window.prompt('Device model or identifier:', '')?.trim();
    let values: Record<string, number>;
    let unit: string;
    if (deviceType === 'digital-bp') {
      const systolic = Number(window.prompt('Systolic blood pressure (mmHg):', '120'));
      const diastolic = Number(window.prompt('Diastolic blood pressure (mmHg):', '80'));
      const pulse = Number(window.prompt('Pulse (bpm), if shown:', '72'));
      values = { systolic, diastolic, ...(Number.isFinite(pulse) && pulse > 0 ? { pulse } : {}) };
      unit = 'mmHg';
    } else if (deviceType === 'glucometer') {
      const glucose = Number(window.prompt('Glucose reading (mg/dL):', '100'));
      values = { glucose };
      unit = 'mg/dL';
    } else {
      const spo2 = Number(window.prompt('Pulse oximeter SpO2 (%):', '98'));
      const pulse = Number(window.prompt('Pulse (bpm), if shown:', '72'));
      values = { spo2, ...(Number.isFinite(pulse) && pulse > 0 ? { pulse } : {}) };
      unit = '%';
    }
    const calibration = window.confirm('Is this device calibrated/documented and used according to manufacturer instructions? Select Cancel if uncertain.') ? 'documented' : 'unknown';
    const res = await fetch(`${API_BASE}/advanced/devices/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceType, acquisitionMode: 'manual', source: 'Manual patient entry', manufacturer: manufacturer || 'Unknown', model: model || 'Unknown', calibrationState: calibration, values, unit, recordedAt: new Date().toISOString() }),
    });
    const data = await res.json();
    if (res.ok) window.alert(`Manual reading saved: ${data.reading.validation}\nConfidence: ${Math.round(data.reading.confidence * 100)}%\nSource: manual · Calibration: ${calibration}`);
    else window.alert(data.error || 'Manual reading could not be saved.');
  };

  const importDeviceCSV = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const csv = await file.text();
      const res = await fetch(`${API_BASE}/advanced/devices/import/csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, source: file.name }),
      });
      const data = await res.json();
      if (res.ok) window.alert(`${data.imported} measurements imported. Review calibration and source provenance before clinical use.`);
      else window.alert(data.error || 'CSV import failed.');
    };
    input.click();
  };

  const connectExistingDevice = async () => {
    const bluetooth = (navigator as any).bluetooth;
    if (!bluetooth) {
      window.alert('Web Bluetooth is unavailable in this window. Use CSV/JSON import or install the manufacturer adapter.');
      return;
    }
    try {
      const device = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['health_thermometer', 'blood_pressure', 'glucose', 'battery_service'],
      });
      const server = await device.gatt?.connect();
      if (!server) throw new Error('Device did not expose a GATT connection.');
      const services: string[] = [];
      for (const serviceName of ['health_thermometer', 'blood_pressure', 'glucose']) {
        try {
          await server.getPrimaryService(serviceName);
          services.push(serviceName);
        } catch {
          // The device is not advertising this standard service.
        }
      }
      window.alert(`CONNECTED: ${device.name || 'Unnamed device'}\nSupported services detected: ${services.join(', ') || 'none yet'}\nHealth data parsing will only run after the matching vendor characteristic parser is approved.`);
    } catch (error: any) {
      window.alert(error?.message || 'No device was selected or the connection was cancelled.');
    }
  };

  const connectNativeHealthStore = async () => {
    try {
      const result = await requestHealthAuthorization();
      if ('availability' in result && !result.availability.available) {
        window.alert(result.availability.reason || 'Health platform is unavailable on this device.');
        return;
      }
      const samples = await readNativeHealthSamples();
      window.alert(`Health platform authorized. ${samples.samples.length} medical-platform samples found in the last 30 days. Samples remain subject to native source provenance and user permissions.`);
    } catch (error: any) {
      window.alert(error?.message || 'Health platform authorization failed.');
    }
  };

  const connectNativeBle = async () => {
    try {
      const result = await initializeBleAdapter();
      window.alert(`BLE adapter initialized on ${result.platform}. Bluetooth enabled: ${result.enabled}. Select a vendor BLE service before importing measurements.`);
    } catch (error: any) {
      window.alert(error?.message || 'BLE adapter initialization failed.');
    }
  };

  const inspectDeviceConnectors = async () => {
    const res = await fetch(`${API_BASE}/advanced/devices/connectors`);
    const data = await res.json();
    if (!res.ok) return;
    const summary = Object.entries(data.connectors).map(([name, value]: [string, any]) => `${name}: ${value.status}`).join('\n');
    window.alert(`DEVICE CONNECTION STATUS\n\n${summary}`);
  };

  const ingestDemoDevice = async (deviceType: 'digital-bp' | 'glucometer' | 'pulse-oximeter') => {
    let values: Record<string, number>;
    let unit: string;
    if (deviceType === 'digital-bp') {
      values = { systolic: 118 + Math.floor(Math.random() * 16), diastolic: 76 + Math.floor(Math.random() * 10), pulse: 62 + Math.floor(Math.random() * 18) };
      unit = 'mmHg';
    } else if (deviceType === 'glucometer') {
      values = { glucose: 88 + Math.floor(Math.random() * 42) };
      unit = 'mg/dL';
    } else {
      values = { spo2: 96 + Math.floor(Math.random() * 3), pulse: 68 + Math.floor(Math.random() * 14) };
      unit = '%';
    }
    const res = await fetch(`${API_BASE}/advanced/devices/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceType, acquisitionMode: 'demo', source: 'Demonstration device payload', manufacturer: 'Demo', model: 'Trust Lab', calibrationState: 'not-applicable', values, unit, recordedAt: new Date().toISOString() }),
    });
    const data = await res.json();
    if (res.ok) window.alert(`${deviceType.toUpperCase()} reading: ${data.reading.validation}\nConfidence: ${Math.round(data.reading.confidence * 100)}%\nDemo data only; wearable and consumer readings require clinical verification.`);
  };

  const createDemoConsentAndCapsule = async () => {
    const recipient = window.prompt('Consent recipient (hospital, clinician, or caregiver):', 'Demo Clinic');
    if (!recipient) return;
    const consentRes = await fetch(`${API_BASE}/advanced/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, purpose: 'Demonstration clinical review', recordIds: files.map((file) => file.id), actions: ['preview', 'download'], expiresInHours: 24 }),
    });
    const consent = await consentRes.json();
    const capsuleRes = await fetch(`${API_BASE}/advanced/capsules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordIds: files.map((file) => file.id), policyId: consent.policy?.id, expiresInHours: 24 }),
    });
    const capsule = await capsuleRes.json();
    if (consentRes.ok && capsuleRes.ok) window.alert(`Consent created and 24-hour capsule issued:\n${capsule.capsule.packageHash.slice(0, 20)}...`);
  };

  const createRecoveryDemo = async () => {
    const secret = window.prompt('Recovery secret to protect (demo only):', 'HEALTHVAULT-DEMO-RECOVERY-KEY');
    if (!secret) return;
    const res = await fetch(`${API_BASE}/advanced/recovery/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threshold: 3, total: 5, secret, custodians: ['Emergency contact', 'Primary clinician', 'Family guardian', 'Device backup', 'Patient paper backup'] }),
    });
    if (res.ok) window.alert('3-of-5 GF(256) recovery shares generated. Real recovery must split an encrypted master key, never this plaintext demo secret.');
  };

  const createMerklCheckpoint = async () => {
    const res = await fetch(`${API_BASE}/advanced/merkle/checkpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leaves: files.map((file) => `${file.id}:${file.encryptedSize}:${file.uploadDate}`) }),
    });
    const data = await res.json();
    if (res.ok) window.alert(`Merkle checkpoint created:\n${data.checkpoint.root}`);
  };

  const createEmergencyPassportDemo = async () => {
    const res = await fetch(`${API_BASE}/advanced/emergency-passport`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bloodType: healthSuite?.emergencyProfile.bloodType || 'O+',
        allergies: healthSuite?.emergencyProfile.allergies || [],
        medications: healthSuite?.emergencyProfile.medications || [],
        emergencyContact: healthSuite?.emergencyProfile.emergencyContact || '',
      }),
    });
    const data = await res.json();
    if (res.ok) window.alert(`Emergency passport created:\n${data.passport.id}`);
  };

  const runDemoAdversary = async (scenario: string) => {
    const res = await fetch(`${API_BASE}/advanced/adversary/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
    });
    const data = await res.json();
    if (res.ok) window.alert(`${data.result.outcome}\n${data.result.explanation}`);
  };

  const exportHealthSummary = () => {
    window.open(`${API_BASE}/product-suite/export`, '_blank');
  };

  const printHealthSummary = () => {
    window.open(`${API_BASE}/product-suite/print-summary`, '_blank', 'noopener,noreferrer');
  };

  const saveEmergencyProfileFromPrompt = async () => {
    const bloodType = window.prompt('Blood type', healthSuite?.emergencyProfile.bloodType || 'Unknown');
    if (!bloodType) return;
    const allergies = window.prompt('Allergies (comma separated)', healthSuite?.emergencyProfile.allergies?.join(', ') || '');
    const medications = window.prompt('Medications (comma separated)', healthSuite?.emergencyProfile.medications?.join(', ') || '');
    const emergencyContact = window.prompt('Emergency contact', healthSuite?.emergencyProfile.emergencyContact || '');
    await fetch(`${API_BASE}/health-suite/emergency-profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bloodType,
        allergies: (allergies || '').split(',').map((value) => value.trim()).filter(Boolean),
        medications: (medications || '').split(',').map((value) => value.trim()).filter(Boolean),
        emergencyContact: emergencyContact || '',
      }),
    });
    loadHealthSuite();
  };

  const createTimeLimitedShare = async () => {
    if (files.length === 0) {
      window.alert('Deposit a record before creating a share.');
      return;
    }
    const target = window.prompt(`Record index to share (1-${files.length}):`, '1');
    const index = Number(target) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= files.length) return;
    const hours = Number(window.prompt('Share lifetime in hours (1-168):', '24')) || 24;
    const res = await fetch(`${API_BASE}/health-suite/shares/${files[index].id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresInHours: hours, label: files[index].originalName }),
    });
    const data = await res.json();
    if (res.ok) {
      const shareUrl = `${window.location.origin}/share/?token=${encodeURIComponent(data.share.token)}`;
      await navigator.clipboard?.writeText(shareUrl);
      window.alert(`Share created${navigator.clipboard ? ' and copied' : ''}.\n${shareUrl}`);
    }
  };

  const formatBytes = (bytes: number, decimals = 1) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  };

  const handleVaultSpotlight = (event: React.MouseEvent<HTMLDivElement>) => {
    const card = event.currentTarget;
    const bounds = card.getBoundingClientRect();
    card.style.setProperty('--spot-x', `${event.clientX - bounds.left}px`);
    card.style.setProperty('--spot-y', `${event.clientY - bounds.top}px`);
  };

  const verifyRecord = async (recordId: string) => {
    setVerifyingRecordId(recordId);
    try {
      const res = await fetch(`${API_BASE}/integrity/verify/${recordId}`);
      if (!res.ok) throw new Error('Verification failed.');
      const data = await res.json();
      setVerificationResults((current) => ({ ...current, [recordId]: data }));
    } finally {
      setVerifyingRecordId(null);
    }
  };

  const toggleRecordSelection = (recordId: string) => {
    setSelectedRecordIds((current) => current.includes(recordId)
      ? current.filter((id) => id !== recordId)
      : [...current, recordId]);
  };

  const batchShredSelected = async () => {
    if (selectedRecordIds.length === 0) return;
    if (!window.confirm(`Permanently shred ${selectedRecordIds.length} selected record(s)? This cannot be undone.`)) return;
    setBatchShredding(true);
    try {
      const res = await fetch(`${API_BASE}/files/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedRecordIds }),
      });
      if (!res.ok) throw new Error('Batch shredding failed.');
      setSelectedRecordIds([]);
      await Promise.all([loadFiles(), loadAdvancedVaultState()]);
    } finally {
      setBatchShredding(false);
    }
  };

  const handleDeleteRecord = async (file: VaultFile) => {
    if (!window.confirm(`Shred "${file.originalName}" from the vault? This cannot be undone.`)) return;
    setDeletingFileId(file.id);
    await new Promise((resolve) => window.setTimeout(resolve, 520));
    try {
      const res = await fetch(`${API_BASE}/files/${file.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete the record.');
      await Promise.all([loadFiles(), loadAdvancedVaultState()]);
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileSelection(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFileSelection(e.target.files[0]);
  };

  const handleFileSelection = (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);
    const supported = file.type === 'application/pdf' || file.type.startsWith('image/') || file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.pdf');
    if (!supported) {
      setUploadError('⚠ Unsupported format. Use PDF, image, or text medical records.');
    }
    setSelectedFile(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) { setUploadError('No file selected.'); return; }
    if (!passphrase || passphrase.trim().length < 6) {
      setUploadError('Passphrase must be ≥ 6 characters for AES-256 key derivation.');
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('passphrase', passphrase);
      const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Encryption failed.');
      setUploadSuccess(`✓ "${selectedFile.name}" encrypted and committed to vault`);
      setEncryptCelebration(true);
      window.setTimeout(() => setEncryptCelebration(false), 1800);
      setSelectedFile(null);
      setPassphrase('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await Promise.all([loadFiles(), loadAdvancedVaultState()]);
    } catch (err: any) {
      setUploadError(err.message || 'Network error.');
    } finally {
      setIsUploading(false);
    }
  };

  const openDecryptModal = (file: VaultFile) => {
    setActiveDecryptFile(file);
    setDecryptPassphrase('');
    setDecryptError(null);
  };

  const closeDecryptModal = () => {
    setActiveDecryptFile(null);
    setDecryptPassphrase('');
    setDecryptError(null);
  };

  const openAnalysisModal = (file: VaultFile) => {
    setAnalysisFile(file);
    setAnalysisPassphrase('');
    setAnalysisError(null);
    setRecordInsight(null);
  };

  const closeAnalysisModal = () => {
    setAnalysisFile(null);
    setAnalysisPassphrase('');
    setAnalysisError(null);
    setRecordInsight(null);
  };

  const handleAnalyze = async () => {
    if (!analysisFile) return;
    if (!analysisPassphrase) {
      setAnalysisError('Passphrase required.');
      return;
    }
    setIsAnalyzing(true);
    setAnalysisError(null);
    setRecordInsight(null);
    try {
      const res = await fetch(`${API_BASE}/analyze/${analysisFile.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase: analysisPassphrase }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) throw new Error('Invalid passphrase — analysis rejected');
      if (!res.ok) throw new Error(data?.error || `Analysis failed (HTTP ${res.status})`);
      setRecordInsight(data.insights);
    } catch (err: any) {
      setAnalysisError(err.message || 'Local analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDecrypt = async (asDownload: boolean = false) => {
    if (!activeDecryptFile) return;
    if (!decryptPassphrase) { setDecryptError('Passphrase required.'); return; }
    setIsDecrypting(true);
    setDecryptError(null);
    try {
      const endpoint = `${API_BASE}/decrypt/${activeDecryptFile.id}${asDownload ? '?download=true' : ''}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase: decryptPassphrase }),
      });
      if (res.status === 401) throw new Error('✗ Invalid passphrase — decryption rejected');
      if (!res.ok) {
        const errorJson = await res.json().catch(() => null);
        throw new Error(errorJson?.error || `Decryption failed (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      if (asDownload) {
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = activeDecryptFile.originalName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      } else {
        setPreviewUrl(objectUrl);
        setPreviewFileName(activeDecryptFile.originalName);
        setPreviewMime(activeDecryptFile.mimeType);
      }
      closeDecryptModal();
    } catch (err: any) {
      setDecryptError(err.message || 'Decryption failed.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewFileName('');
    setPreviewMime('');
  };

  return (
    <div className={`vault-shell portfolio-shell min-h-screen pb-12 ${activePanel ? 'portfolio-drawer-open' : ''} ${activePanel === 'upload' ? 'portfolio-upload-open' : ''} ${activePanel === 'vault' ? 'portfolio-vault-open' : ''}`}>
      {introVisible && (
        <div className={`vault-intro${introLeaving ? ' is-leaving' : ''}`} role="dialog" aria-label="Opening HealthVault">
          <div className="healthvault-intro">
            <h1>HealthVault</h1>
            <p>Your Private Health Space</p>
          </div>
        </div>
      )}

      <div className={`avara-home${activePanel || healthSuiteOpen ? ' panel-open' : ''}`}>
        {/* Top Header Bar for Mobile & Desktop */}
        <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4 sm:px-7 py-3 pt-[max(12px,env(safe-area-inset-top))] pointer-events-none">
          <button
            className="avara-brand pointer-events-auto"
            type="button"
            onClick={() => { setActivePanel(null); setHealthSuiteOpen(false); }}
            aria-label="HealthVault home"
          >
            HEALTHVAULT
          </button>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="p-2.5 rounded-full bg-ch-surface/80 border border-ch-border/80 text-ch-text-dim hover:text-ch-text-bright transition backdrop-blur-md"
              title="Search and commands (Ctrl+K)"
              aria-label="Search and commands"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setServerSettingsOpen(true)}
              className="p-2.5 rounded-full bg-ch-surface/80 border border-ch-border/80 text-ch-text-dim hover:text-ch-text-bright transition backdrop-blur-md"
              title="Server & Mobile Connection"
              aria-label="Server & Mobile Connection"
            >
              <Smartphone className="w-4 h-4 text-ch-green" />
            </button>
          </div>
        </header>

        <main className="sticker-stage" aria-label="Vault actions">
          <button type="button" className="sticker sticker-encrypt sticker-a" onClick={() => setActivePanel('upload')} aria-label="Encrypt a medical record">
            <GhostSticker />
            <span>Encrypt</span>
          </button>
          <button type="button" className="sticker sticker-decrypt sticker-b" onClick={() => setActivePanel('vault')} aria-label="Decrypt a medical record">
            <SmileySticker />
            <span>Decrypt</span>
          </button>
          <button type="button" className="sticker sticker-vault sticker-c" onClick={() => setActivePanel('vault')} aria-label="Open encrypted vault">
            <VaultSticker />
            <span>Vault</span>
          </button>
          <button type="button" className="sticker sticker-others sticker-d" onClick={openHealthSuite} aria-label="Open Health Suite">
            <CloudSticker />
            <span>Others</span>
          </button>
        </main>

        {/* Mobile Native Thumb Navigation (Bottom Bar) */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 sm:hidden bg-ch-surface/95 backdrop-blur-lg border-t border-ch-border/80 px-2 py-2 flex items-center justify-around mobile-safe-bottom" aria-label="Mobile navigation">
          <button
            type="button"
            onClick={() => { setActivePanel('upload'); setHealthSuiteOpen(false); }}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg text-[10px] font-mono transition-colors ${activePanel === 'upload' ? 'text-ch-green bg-ch-green/10' : 'text-ch-text-dim hover:text-ch-text-bright'}`}
          >
            <Upload className="w-5 h-5 mb-0.5" />
            <span>Encrypt</span>
          </button>

          <button
            type="button"
            onClick={() => { setActivePanel('vault'); setHealthSuiteOpen(false); }}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg text-[10px] font-mono transition-colors ${activePanel === 'vault' ? 'text-ch-green bg-ch-green/10' : 'text-ch-text-dim hover:text-ch-text-bright'}`}
          >
            <Database className="w-5 h-5 mb-0.5" />
            <span>Vault</span>
          </button>

          <button
            type="button"
            onClick={() => { setActivePanel(null); openHealthSuite(); }}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg text-[10px] font-mono transition-colors ${healthSuiteOpen ? 'text-ch-teal bg-ch-teal/10' : 'text-ch-text-dim hover:text-ch-text-bright'}`}
          >
            <Activity className="w-5 h-5 mb-0.5" />
            <span>Health</span>
          </button>

          <button
            type="button"
            onClick={() => setServerSettingsOpen(true)}
            className="flex flex-col items-center justify-center py-1.5 px-3 rounded-lg text-[10px] font-mono text-ch-text-dim hover:text-ch-text-bright transition-colors"
          >
            <Smartphone className="w-5 h-5 mb-0.5" />
            <span>Server</span>
          </button>
        </nav>

        <footer className="team-footer">
          <a href="https://www.instagram.com/maanasxd/" target="_blank" rel="noopener noreferrer">Maanas</a>
          <span className="team-separator">|</span>
          <a href="https://www.instagram.com/sambhav.singh_/" target="_blank" rel="noopener noreferrer">Sambhav</a>
          <span className="team-separator">|</span>
          <span>Pooja</span>
          <span className="team-separator">|</span>
          <a href="https://www.instagram.com/keerthiravikumar_/" target="_blank" rel="noopener noreferrer">Keerthi</a>
        </footer>
      </div>

      {/* ─── SERVER SETTINGS MODAL (Physical Devices & Emulators) ─── */}
      {serverSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-ch-surface border border-ch-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-3.5 bg-ch-bg border-b border-ch-border">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-ch-green" />
                <span className="text-xs font-mono font-bold text-ch-text-bright">MOBILE & BACKEND SETTINGS</span>
              </div>
              <button
                type="button"
                onClick={() => setServerSettingsOpen(false)}
                className="p-1 rounded text-ch-text-dim hover:text-ch-text-bright"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-mono text-ch-text-dim block mb-1">
                  BACKEND API URL:
                </label>
                <input
                  type="url"
                  value={customApiUrl}
                  onChange={(e) => setCustomApiUrl(e.target.value)}
                  placeholder="http://192.168.1.51:5001/api/vault"
                  className="w-full rounded-lg bg-ch-bg border border-ch-border px-3.5 py-2.5 text-xs font-mono text-ch-text-bright focus:outline-none focus:border-ch-green focus:ring-1 focus:ring-ch-green/30"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setCustomApiUrl('http://192.168.1.51:5001/api/vault')}
                    className="text-[10px] font-mono px-2 py-1 rounded bg-ch-green/10 text-ch-green border border-ch-green/30 hover:bg-ch-green/20 transition"
                  >
                    + Wi-Fi (192.168.1.51)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomApiUrl('http://10.0.2.2:5001/api/vault')}
                    className="text-[10px] font-mono px-2 py-1 rounded bg-ch-surface text-ch-teal border border-ch-border hover:border-ch-teal/50 transition"
                  >
                    + Android AVD (10.0.2.2)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomApiUrl('http://127.0.0.1:5001/api/vault')}
                    className="text-[10px] font-mono px-2 py-1 rounded bg-ch-surface text-ch-text-dim border border-ch-border hover:border-ch-text transition"
                  >
                    + Localhost (127.0.0.1)
                  </button>
                </div>
                <p className="text-[11px] font-mono text-ch-text-dim mt-2 leading-relaxed">
                  • <b>Android Emulator</b>: <code className="text-ch-green">http://10.0.2.2:5001/api/vault</code><br />
                  • <b>iOS Simulator</b>: <code className="text-ch-green">http://127.0.0.1:5001/api/vault</code><br />
                  • <b>Physical Mobile Device</b>: Use laptop Wi-Fi IP (e.g. <code className="text-ch-teal">http://192.168.1.51:5001/api/vault</code>)
                </p>
              </div>

              {apiPingStatus !== 'idle' && (
                <div className={`p-3 rounded-lg border text-xs font-mono flex items-start gap-2 ${
                  apiPingStatus === 'success'
                    ? 'bg-ch-green/10 border-ch-green/30 text-ch-green'
                    : apiPingStatus === 'error'
                    ? 'bg-ch-red/10 border-ch-red/30 text-ch-red'
                    : 'bg-ch-surface border-ch-border text-ch-text'
                }`}>
                  {apiPingStatus === 'testing' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mt-0.5" />
                  ) : apiPingStatus === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-ch-green" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-ch-red" />
                  )}
                  <span className="break-all">{apiPingMessage}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => testApiConnection()}
                  className="flex-1 py-2 px-3 rounded-lg bg-ch-bg hover:bg-ch-surface-hover text-ch-text border border-ch-border text-xs font-mono flex items-center justify-center gap-1.5 transition"
                >
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Test Ping</span>
                </button>
                <button
                  type="button"
                  onClick={resetApiUrl}
                  className="py-2 px-3 rounded-lg bg-ch-bg hover:bg-ch-surface-hover text-ch-text-dim hover:text-ch-text text-xs font-mono transition"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={saveApiUrl}
                  className="py-2 px-4 rounded-lg bg-ch-green/20 hover:bg-ch-green/30 text-ch-green border border-ch-green/30 text-xs font-mono font-bold transition"
                >
                  Save & Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {commandOpen && (
        <div className="vault-command-backdrop" role="dialog" aria-modal="true" aria-label="Vault command palette">
          <div className="vault-command-palette">
            <div className="vault-command-input">
              <Search />
              <input autoFocus value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Navigate vault operations..." />
              <kbd>ESC</kbd>
            </div>
            <div className="vault-command-results">
              {[
                { title: 'Encrypt and deposit a record', detail: 'Create a new encrypted object', icon: Upload, action: () => setActivePanel('upload') },
                { title: 'Browse encrypted vault', detail: `${files.length} records in catalog`, icon: Database, action: () => setActivePanel('vault') },
                { title: 'Open Health Intelligence', detail: 'Telemetry, profile, and audit intelligence', icon: Activity, action: openHealthSuite },
                { title: 'Verify integrity ledger', detail: integrityLedger?.head.slice(0, 18) || 'Compute encrypted object provenance', icon: GitBranch, action: loadAdvancedVaultState },
              ].filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(commandQuery.toLowerCase())).map((item) => (
                <button key={item.title} type="button" onClick={() => { setCommandOpen(false); item.action(); }}>
                  <span><item.icon /></span>
                  <div><strong>{item.title}</strong><small>{item.detail}</small></div>
                  <ChevronRight />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── NAVBAR ─── */}
      <nav className="vault-nav border-b backdrop-blur-xl sticky top-0 z-40">
        <div className="vault-nav-inner max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="vault-brand flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-ch-green/10 border border-ch-green/30 flex items-center justify-center glow-green">
                <ShieldCheck className="w-5 h-5 text-ch-green" />
              </div>
              <span className="text-lg font-bold text-ch-text-bright tracking-tight">
                Health<span className="text-ch-green">Vault</span>
              </span>
            </div>
            <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-ch-green/10 text-ch-green border border-ch-green/20">
              v2.0
            </span>
          </div>

          <div className="vault-status flex items-center gap-2 text-[11px] font-mono">
            <span className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-ch-surface border border-ch-border text-ch-teal">
              <Lock className="w-3 h-3" />
              AES-256-GCM
            </span>
            <span className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-ch-surface border border-ch-border text-ch-yellow">
              <Hash className="w-3 h-3" />
              PBKDF2-SHA256
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-ch-green/5 border border-ch-green/20 text-ch-green">
              <Activity className="w-3 h-3" />
              SECURE
            </span>
          </div>
        </div>
      </nav>

      {/* ─── HERO SECTION ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="vault-hero flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 px-6 py-7 sm:px-9">
          <div className="relative z-10 max-w-2xl">
            <div className="vault-kicker mb-4">private medical archive</div>
            <h1 className="vault-title text-3xl sm:text-4xl lg:text-[46px] font-extrabold text-ch-text-bright leading-[1.08]">
              Your health.<br />
              <span className="text-ch-green">Entirely yours.</span>
            </h1>
            <p className="mt-4 text-sm sm:text-[15px] text-ch-text-dim max-w-xl leading-relaxed">
              A zero-knowledge vault for personal medical records. Encrypt locally,
              store safely, and unlock only with your passphrase.
            </p>
          </div>
          <div className="relative z-10 grid grid-cols-2 sm:flex gap-2 text-[11px] flex-shrink-0">
            <div className="px-3 py-2 rounded-md bg-ch-teal/10 border border-ch-teal/25 text-ch-teal font-medium flex items-center gap-1.5">
              <HeartPulseIcon className="w-3.5 h-3.5" />
              SDG 3
            </div>
            <div className="px-3 py-2 rounded-md bg-ch-blue/10 border border-ch-blue/25 text-ch-blue font-medium flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              SDG 9
            </div>
          </div>
        </div>
      </section>

      {/* ─── PROTOCOL CARDS ─── */}
      <section className="vault-security-strip max-w-6xl mx-auto px-4 sm:px-6 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: HardDrive, label: 'Zero-Plaintext', desc: 'In-memory only. Never on disk.', color: 'text-ch-green', bg: 'bg-ch-green/5', border: 'border-ch-green/15' },
            { icon: KeyRound, label: 'PBKDF2 KDF', desc: '100K SHA-256 iterations', color: 'text-ch-yellow', bg: 'bg-ch-yellow/5', border: 'border-ch-yellow/15' },
            { icon: Lock, label: 'AES-256-GCM', desc: 'Authenticated encryption', color: 'text-ch-teal', bg: 'bg-ch-teal/5', border: 'border-ch-teal/15' },
            { icon: Fingerprint, label: 'Self-Contained', desc: 'Salt + IV + Ciphertext', color: 'text-ch-purple', bg: 'bg-ch-purple/5', border: 'border-ch-purple/15' },
          ].map((item, i) => (
            <div key={i} className={`group p-4 rounded-lg ${item.bg} border ${item.border} transition-all duration-300 hover:-translate-y-0.5 hover:border-opacity-60`}>
              <div className="flex items-center justify-between mb-3">
                <item.icon className={`w-4 h-4 ${item.color}`} />
                <span className="text-[9px] font-mono text-ch-text-dim/60">0{i + 1}</span>
              </div>
              <div className={`text-xs font-bold ${item.color}`}>{item.label}</div>
              <div className="text-[10px] text-ch-text-dim mt-1 font-mono leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── MAIN TWO COLUMN LAYOUT ─── */}
      <main className="portfolio-main max-w-6xl mx-auto px-4 sm:px-6">
        {/* Mobile Header for Drawer */}
        <div className="flex items-center justify-between pb-3 mb-4 sm:hidden border-b border-ch-border">
          <button
            type="button"
            onClick={() => setActivePanel(null)}
            className="flex items-center gap-1.5 text-xs font-mono text-ch-green font-bold px-3 py-1.5 rounded-full bg-ch-green/10 border border-ch-green/30"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <span className="text-xs font-mono font-bold text-ch-text-bright">
            {activePanel === 'upload' ? 'DEPOSIT RECORD' : 'ENCRYPTED VAULT'}
          </span>
          <button
            type="button"
            onClick={() => setActivePanel(null)}
            className="p-1.5 text-ch-text-dim hover:text-ch-text-bright"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <button className="portfolio-close" type="button" onClick={() => setActivePanel(null)}>
          CLOSE
        </button>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ─── LEFT: UPLOAD PANEL ─── */}
          <div className="portfolio-upload lg:col-span-5">
            <div className="vault-panel rounded-lg border overflow-hidden">
              {/* Panel header — terminal style */}
              <div className="vault-panel-header flex items-center justify-between px-4 py-2.5 border-b border-ch-border">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-ch-red/80"></div>
                    <div className="w-3 h-3 rounded-full bg-ch-yellow/80"></div>
                    <div className="w-3 h-3 rounded-full bg-ch-green/80"></div>
                  </div>
                  <span className="text-xs font-mono text-ch-text-dim ml-2">encrypt.session</span>
                </div>
                <Terminal className="w-3.5 h-3.5 text-ch-text-dim" />
              </div>

              <div className="p-5">
                <div className="cloud-sync-status">
                  <span className="cloud-sync-dot" />
                  <div>
                    <b>Zero-Knowledge Cloud Sync</b>
                    <small>S3 bucket: synced and encrypted</small>
                  </div>
                  <span className="cloud-sync-badge">E2E</span>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Upload className="w-4 h-4 text-ch-green" />
                  <h2 className="text-sm font-bold text-ch-text-bright">Deposit Medical Record</h2>
                  <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded bg-ch-bg text-ch-text-dim border border-ch-border">
                    AES-256
                  </span>
                </div>

                <form onSubmit={handleUpload} className="space-y-4">
                  {/* Dropzone */}
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`magnetic-dropzone border border-dashed rounded-lg p-5 text-center cursor-pointer transition-all ${
                      dragActive
                        ? 'border-ch-green bg-ch-green/5'
                        : selectedFile
                        ? 'border-ch-teal/50 bg-ch-teal/5'
                        : 'border-ch-border hover:border-ch-text-dim bg-ch-bg'
                    }`}
                  >
                    <input ref={fileInputRef} type="file" className="hidden"
                      accept=".pdf,application/pdf,image/*,application/json,text/plain"
                      onChange={handleFileChange}
                    />
                    {selectedFile ? (
                      <div className="space-y-2">
                        <FileCheck className="w-8 h-8 text-ch-teal mx-auto" />
                        <p className="text-xs font-mono text-ch-text-bright break-all">{selectedFile.name}</p>
                        <p className="text-[11px] font-mono text-ch-text-dim">
                          {formatBytes(selectedFile.size)} • {selectedFile.type || 'unknown'}
                        </p>
                        <button type="button" onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }} className="text-[11px] text-ch-red hover:underline font-mono">
                          [remove]
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <FileText className="w-7 h-7 text-ch-text-dim mx-auto" />
                        <p className="text-xs text-ch-text">
                          Drop file here or <span className="text-ch-green underline">browse</span>
                        </p>
                        <p className="text-[11px] font-mono text-ch-text-dim">
                          PDF, images, health records
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Passphrase input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-mono text-ch-text-dim uppercase tracking-wider flex items-center gap-1">
                        <ChevronRight className="w-3 h-3 text-ch-green" />
                        encryption_key
                      </label>
                      {passphrase.length > 0 && (
                        <span className={`passphrase-pill ${passphrase.length >= 8 ? 'strong' : passphrase.length >= 6 ? 'medium' : ''}`} aria-label="Passphrase strength">
                          <span />
                          {passphrase.length >= 8 ? 'strong' : passphrase.length >= 6 ? 'ready' : 'longer'}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showPassphrase ? 'text' : 'password'}
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        placeholder="enter passphrase..."
                        className="w-full rounded-md bg-ch-bg border border-ch-border px-3 py-2.5 text-sm font-mono text-ch-text-bright placeholder-ch-text-dim/50 focus:outline-none focus:border-ch-green/50 focus:ring-1 focus:ring-ch-green/20 transition pr-9"
                      />
                      <button type="button" onClick={() => setShowPassphrase(!showPassphrase)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ch-text-dim hover:text-ch-text transition">
                        {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] font-mono text-ch-text-dim mt-1.5 leading-relaxed">
                      Derives 256-bit key via PBKDF2. No backdoor — lose it and data is irrecoverable.
                    </p>
                  </div>

                  {/* Status messages */}
                  {uploadError && (
                    <div className="px-3 py-2 rounded-md bg-ch-red/10 border border-ch-red/30 text-ch-red text-[11px] font-mono flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{uploadError}</span>
                    </div>
                  )}
                  {uploadSuccess && (
                    <div className="px-3 py-2 rounded-md bg-ch-green/10 border border-ch-green/30 text-ch-green text-[11px] font-mono flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{uploadSuccess}</span>
                    </div>
                  )}
                  {encryptCelebration && (
                    <div className="encrypt-celebration" aria-hidden="true">
                      {Array.from({ length: 12 }).map((_, index) => <span key={index} />)}
                    </div>
                  )}

                  {/* Submit */}
                  <button type="submit" disabled={!selectedFile || !passphrase || isUploading}
                    className="w-full py-2.5 rounded-md font-mono text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-30 disabled:cursor-not-allowed bg-ch-green/15 hover:bg-ch-green/25 text-ch-green border border-ch-green/30 active:scale-[0.99]">
                    {isUploading ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /><span>encrypting...</span></>
                    ) : (
                      <><Lock className="w-4 h-4" /><span>Encrypt & Deposit</span></>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* ─── RIGHT: VAULT CATALOG ─── */}
          <div className="portfolio-vault lg:col-span-7">
            <div className="vault-panel rounded-lg border overflow-hidden">
              {/* Panel header */}
              <div className="vault-panel-header flex items-center justify-between px-4 py-2.5 border-b border-ch-border">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-ch-red/80"></div>
                    <div className="w-3 h-3 rounded-full bg-ch-yellow/80"></div>
                    <div className="w-3 h-3 rounded-full bg-ch-green/80"></div>
                  </div>
                  <span className="text-xs font-mono text-ch-text-dim ml-2">vault.catalog</span>
                </div>
                <button onClick={loadFiles} title="Refresh"
                  className="p-1 rounded text-ch-text-dim hover:text-ch-text-bright transition">
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="p-5">
                {selectedRecordIds.length > 0 && (
                  <div className="vault-batch-toolbar">
                    <span>{selectedRecordIds.length} selected</span>
                    <button type="button" onClick={() => setSelectedRecordIds([])}>Clear</button>
                    <button type="button" className="danger" disabled={batchShredding} onClick={batchShredSelected}>
                      <Trash2 /> {batchShredding ? 'Shredding...' : 'Shred selected'}
                    </button>
                  </div>
                )}
                <div className="cloud-sync-status">
                  <span className="cloud-sync-dot" />
                  <div>
                    <b>Encrypted Object Store</b>
                    <small>Cloud metadata synced</small>
                  </div>
                  <span className="cloud-sync-badge">S3</span>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Database className="w-4 h-4 text-ch-teal" />
                  <h2 className="text-sm font-bold text-ch-text-bright">Encrypted Records</h2>
                  <span className="ml-auto text-[10px] font-mono text-ch-text-dim">
                    {files.length} file{files.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {fetchError && (
                  <div className="px-3 py-2 rounded-md bg-ch-yellow/10 border border-ch-yellow/30 text-ch-yellow text-[11px] font-mono flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{fetchError}</span>
                  </div>
                )}

                {isLoadingFiles && files.length === 0 ? (
                  <div className="py-14 text-center space-y-3">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-ch-green" />
                    <p className="text-xs font-mono text-ch-text-dim">querying metadata...</p>
                  </div>
                ) : files.length === 0 ? (
                  <div className="py-14 text-center border border-dashed border-ch-border rounded-lg bg-ch-bg space-y-3">
                    <ShieldAlert className="w-8 h-8 mx-auto text-ch-text-dim/50" />
                    <p className="text-sm font-mono text-ch-text-dim">No records in vault</p>
                    <p className="text-[11px] font-mono text-ch-text-dim/60 max-w-xs mx-auto">
                      Encrypt your first medical document using the panel on the left.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                    {files.map((file) => (
                      <div key={file.id}
                        onMouseMove={handleVaultSpotlight}
                        className={`vault-record-card group p-3.5 rounded-xl bg-ch-bg border border-ch-border transition-all flex flex-col gap-2.5 ${deletingFileId === file.id ? 'is-shredding' : ''}`}>
                        <div className="flex items-start gap-3 min-w-0">
                          <button type="button" className={`vault-record-select${selectedRecordIds.includes(file.id) ? ' selected' : ''} mt-0.5 flex-shrink-0`} onClick={() => toggleRecordSelection(file.id)} aria-label={`Select ${file.originalName}`}>
                            {selectedRecordIds.includes(file.id) ? '✓' : ''}
                          </button>
                          <div className="w-8 h-8 rounded-lg bg-ch-green/10 border border-ch-green/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Lock className="w-4 h-4 text-ch-green" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xs font-bold text-ch-text-bright truncate group-hover:text-ch-green transition font-mono" title={file.originalName}>
                              {file.originalName}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-ch-text-dim flex-wrap">
                              <span className="text-ch-teal flex items-center gap-1 bg-ch-teal/10 px-1.5 py-0.5 rounded border border-ch-teal/20">
                                <ShieldCheck className="w-3 h-3" />
                                {formatBytes(file.encryptedSize)}
                              </span>
                              <span className="flex items-center gap-1 bg-ch-surface px-1.5 py-0.5 rounded border border-ch-border">
                                <Clock className="w-3 h-3" />
                                {new Date(file.uploadDate).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="mt-1 text-[9px] font-mono text-ch-text-dim/60 truncate" title={file.encFileName}>
                              {file.encFileName}
                            </div>
                            {verificationResults[file.id] && (
                              <div className={`vault-verification-line mt-1 text-[10px] font-mono font-bold ${verificationResults[file.id].verified ? 'text-ch-green' : 'text-ch-red'}`}>
                                {verificationResults[file.id].verified ? '✓ OBJECT VERIFIED' : '✗ INTEGRITY MISMATCH'} · {verificationResults[file.id].encryptedSha256.slice(0, 16)}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-2 border-t border-ch-border/50">
                          <button onClick={() => verifyRecord(file.id)} disabled={verifyingRecordId === file.id}
                            className="px-2 py-1.5 rounded-lg bg-ch-green/10 hover:bg-ch-green/20 text-ch-green border border-ch-green/25 text-[10px] font-mono font-semibold flex items-center justify-center gap-1 transition">
                            {verifyingRecordId === file.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                            <span>Verify</span>
                          </button>
                          <button onClick={() => openAnalysisModal(file)}
                            className="px-2 py-1.5 rounded-lg bg-ch-teal/10 hover:bg-ch-teal/20 text-ch-teal border border-ch-teal/25 text-[10px] font-mono font-semibold flex items-center justify-center gap-1 transition">
                            <Cpu className="w-3 h-3" />
                            <span>Intel</span>
                          </button>
                          <button onClick={() => openDecryptModal(file)}
                            className="px-2 py-1.5 rounded-lg bg-ch-green/20 hover:bg-ch-green/30 text-ch-green border border-ch-green/40 text-[10px] font-mono font-bold flex items-center justify-center gap-1 transition">
                            <Unlock className="w-3 h-3" />
                            <span>Decrypt</span>
                          </button>
                          <button onClick={() => handleDeleteRecord(file)}
                            className="vault-delete-button px-2 py-1.5 rounded-lg border text-[10px] font-mono font-semibold flex items-center justify-center gap-1 transition"
                            aria-label={`Delete ${file.originalName}`}>
                            <X className="w-3 h-3" />
                            <span>Shred</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* ─── DECRYPT MODAL ─── */}
      {activeDecryptFile && (
        <div className="vault-decrypt-modal fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg bg-ch-surface border border-ch-border shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-ch-bg border-b border-ch-border">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-ch-red/80"></div>
                  <div className="w-3 h-3 rounded-full bg-ch-yellow/80"></div>
                  <div className="w-3 h-3 rounded-full bg-ch-green/80"></div>
                </div>
                <span className="text-xs font-mono text-ch-text-dim ml-2">decrypt.auth</span>
              </div>
              <button onClick={closeDecryptModal} className="text-ch-text-dim hover:text-ch-text-bright p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-ch-yellow" />
                <h3 className="text-sm font-bold text-ch-text-bright">Unlock Record</h3>
              </div>

              <div className="p-3 rounded-md bg-ch-bg border border-ch-border font-mono text-[11px] space-y-1">
                <div className="text-ch-text-dim">target:</div>
                <div className="text-ch-green break-all">{activeDecryptFile.originalName}</div>
                <div className="text-ch-text-dim/60">{activeDecryptFile.encFileName}</div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-ch-text-dim uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-ch-yellow" />
                  passphrase
                </label>
                <div className="relative">
                  <input
                    type={showDecryptPassphrase ? 'text' : 'password'}
                    value={decryptPassphrase}
                    onChange={(e) => setDecryptPassphrase(e.target.value)}
                    placeholder="enter decryption key..."
                    className="w-full rounded-md bg-ch-bg border border-ch-border px-3 py-2.5 text-sm font-mono text-ch-text-bright placeholder-ch-text-dim/50 focus:outline-none focus:border-ch-yellow/50 focus:ring-1 focus:ring-ch-yellow/20 transition pr-9"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleDecrypt(false); }}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowDecryptPassphrase(!showDecryptPassphrase)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ch-text-dim hover:text-ch-text transition">
                    {showDecryptPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {decryptError && (
                <div className="px-3 py-2 rounded-md bg-ch-red/10 border border-ch-red/30 text-ch-red text-[11px] font-mono flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{decryptError}</span>
                </div>
              )}
              {isDecrypting && (
                <div className="warm-decrypt-skeleton" aria-label="Decrypting record">
                  <span /><span /><span />
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => handleDecrypt(false)}
                  disabled={isDecrypting || !decryptPassphrase}
                  className="flex-1 py-2 rounded-md bg-ch-green/15 hover:bg-ch-green/25 text-ch-green border border-ch-green/30 font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-30">
                  {isDecrypting ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>decrypting...</span></>
                  ) : (
                    <><Eye className="w-3.5 h-3.5" /><span>Preview</span></>
                  )}
                </button>
                <button type="button" onClick={() => handleDecrypt(true)}
                  disabled={isDecrypting || !decryptPassphrase}
                  className="py-2 px-4 rounded-md bg-ch-bg hover:bg-ch-surface-hover text-ch-text border border-ch-border font-mono text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-30">
                  <Download className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── HEALTH SUITE MODAL ─── */}
      {/* ─── HEALTH SUITE / OTHERS MODAL (Matches Portfolio & Catalog Aesthetic) ─── */}
      {healthSuiteOpen && (
        <div className="fixed inset-0 z-[52] bg-black/85 backdrop-blur-sm flex items-center justify-center p-0 sm:p-6">
          <div className="w-full max-w-6xl h-full sm:h-auto sm:max-h-[92vh] overflow-y-auto rounded-none sm:rounded-lg bg-ch-surface border-0 sm:border border-ch-border shadow-2xl">
            {/* Terminal Window Header */}
            <div className="vault-panel-header sticky top-0 z-10 flex items-center justify-between px-4 py-2.5 bg-ch-bg border-b border-ch-border">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-ch-red/80"></div>
                  <div className="w-3 h-3 rounded-full bg-ch-yellow/80"></div>
                  <div className="w-3 h-3 rounded-full bg-ch-green/80"></div>
                </div>
                <span className="text-xs font-mono text-ch-text-dim ml-2">others.intelligence</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button onClick={exportHealthSummary} className="px-2.5 py-1 rounded-md bg-ch-teal/10 hover:bg-ch-teal/20 border border-ch-teal/30 text-ch-teal text-[10px] font-mono font-semibold transition">
                  EXPORT
                </button>
                <button onClick={createTimeLimitedShare} className="px-2.5 py-1 rounded-md bg-ch-green/10 hover:bg-ch-green/20 text-ch-green border border-ch-green/30 text-[10px] font-mono font-semibold transition">
                  SHARE
                </button>
                <button onClick={() => setHealthSuiteOpen(false)} aria-label="Close Health Suite" className="p-1 rounded text-ch-text-dim hover:text-ch-text-bright transition ml-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {healthSuiteLoading || !healthSuite ? (
              <div className="py-20 text-center">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-ch-teal" />
                <p className="mt-3 text-xs font-mono text-ch-text-dim">assembling health context...</p>
              </div>
            ) : (
              <div className="health-bento p-5 space-y-4">
                {/* Cloud Sync Status Banner — Exact match with Catalog & Deposit panels */}
                <div className="cloud-sync-status">
                  <span className="cloud-sync-dot" />
                  <div>
                    <b>Edge Health Telemetry & Cryptographic Trust Mesh</b>
                    <small>Connected to Zero-Knowledge Mesh · Real-time Edge Ingestion</small>
                  </div>
                  <span className="cloud-sync-badge">IOT</span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-ch-teal" />
                  <h2 className="text-sm font-bold text-ch-text-bright font-mono">Others: Health Suite & Trust Protocols</h2>
                  <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded bg-ch-bg text-ch-teal border border-ch-border">
                    ONLINE
                  </span>
                </div>
                <div className="health-score-grid grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    ['MEDICAL RECORDS', files.length, 'text-ch-text-bright'],
                    ['IOT READINGS', healthSuite.iotReadings.length, 'text-ch-teal'],
                    ['ANOMALIES', healthSuite.anomaly.score, 'text-ch-green'],
                    ['BLOCKED ATTEMPTS', healthSuite.anomaly.blockedAttempts, 'text-ch-yellow'],
                  ].map(([label, value, color]) => (
                    <div key={String(label)} className={`health-stat-card p-4 rounded-xl bg-ch-bg border border-ch-border ${label === 'MEDICAL RECORDS' ? 'health-score-card' : ''}`}>
                      <div className="text-[10px] font-mono text-ch-text-dim font-bold tracking-wider">{label}</div>
                      <div className={`mt-2 text-2xl font-bold font-mono ${color}`}>{value}</div>
                      {label === 'MEDICAL RECORDS' && (
                        <div className="health-score-ring" style={{ '--score': `${Math.min(100, 72 + Number(value) * 4)}%` } as React.CSSProperties}>
                          <span className="text-white font-mono font-bold text-xl">{Math.min(100, 72 + Number(value) * 4)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="ml-anomaly-section">
                  <div className="ml-section-heading">
                    <div>
                      <span>PROACTIVE ML</span>
                      <h3>Anomaly Detection</h3>
                    </div>
                    <b className="live-badge">LIVE</b>
                  </div>
                  <div className="ml-analysis-grid">
                    <div>
                      <span>Live Access Pattern Analysis</span>
                      <strong>{healthSuite.anomaly.level || 'Normal'}</strong>
                    </div>
                    <div>
                      <span>Flagged IP Attempts</span>
                      <strong>{healthSuite.anomaly.blockedAttempts}</strong>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="iot-bento-card lg:col-span-5 p-4 rounded-lg bg-ch-bg border border-ch-border">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-xs font-bold text-ch-text-bright">Live Edge Telemetry</div>
                        <div className="text-[10px] font-mono text-ch-text-dim mt-1">MQTT HEALTH STREAM</div>
                      </div>
                      <button onClick={addDemoIotReading} className="px-2.5 py-1.5 rounded bg-ch-teal/10 border border-ch-teal/25 text-ch-teal text-[10px] font-mono">+ SIMULATE SYNC</button>
                    </div>
                    <svg className="iot-wave" viewBox="0 0 360 70" role="img" aria-label="Live heart rhythm">
                      <path d="M0 38 C30 38, 38 20, 62 38 S100 58, 124 38 S158 20, 182 38 S222 58, 246 38 S290 20, 316 38 S344 38, 360 38" />
                    </svg>
                    {healthSuite.iotReadings[0] ? (
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ['Heart rate', `${healthSuite.iotReadings[0].heartRate ?? '--'} bpm`],
                          ['Oxygen', `${healthSuite.iotReadings[0].oxygen ?? '--'}%`],
                          ['Blood pressure', `${healthSuite.iotReadings[0].systolic ?? '--'}/${healthSuite.iotReadings[0].diastolic ?? '--'}`],
                          ['Sleep', `${healthSuite.iotReadings[0].sleepHours ?? '--'} hrs`],
                        ].map(([label, value]) => (
                          <div key={label} className="p-3 rounded-md bg-ch-surface border border-ch-border">
                            <div className="text-[9px] font-mono text-ch-text-dim">{label}</div>
                            <div className="mt-1 text-sm font-bold text-ch-text-bright">{value}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-10 text-center border border-dashed border-ch-border rounded-md text-[11px] font-mono text-ch-text-dim">No wearable readings yet.</div>
                    )}
                  </div>

                  <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-ch-bg border border-ch-border">
                      <div className="text-xs font-bold text-ch-text-bright mb-3 font-mono tracking-wider">EMERGENCY PROFILE</div>
                      <div className="space-y-2.5 text-xs font-mono">
                        <div className="flex justify-between items-center pb-2 border-b border-ch-border/60">
                          <span className="text-ch-text-dim">Blood Type</span>
                          <span className="text-ch-teal font-bold px-2 py-0.5 rounded bg-ch-teal/15 border border-ch-teal/30">{healthSuite.emergencyProfile.bloodType || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-ch-border/60">
                          <span className="text-ch-text-dim">Allergies</span>
                          <span className="text-ch-yellow font-bold">{healthSuite.emergencyProfile.allergies.join(', ') || 'None recorded'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-ch-text-dim">Emergency ICE</span>
                          <span className="text-ch-text-bright font-medium">{healthSuite.emergencyProfile.emergencyContact || 'Not configured'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-ch-bg border border-ch-border">
                      <div className="text-xs font-bold text-ch-text-bright mb-3 font-mono tracking-wider">CARE & SECURITY</div>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => addProductItem('appointments')} className="px-3 py-2 rounded-lg bg-ch-blue/15 hover:bg-ch-blue/25 border border-ch-blue/35 text-ch-blue text-xs font-mono font-semibold transition text-left flex items-center justify-between">
                          <span>+ ADD APPOINTMENT</span>
                          <span className="text-[10px] opacity-75 font-normal">Schedule</span>
                        </button>
                        <button onClick={() => addProductItem('medications')} className="px-3 py-2 rounded-lg bg-ch-green/15 hover:bg-ch-green/25 border border-ch-green/35 text-ch-green text-xs font-mono font-semibold transition text-left flex items-center justify-between">
                          <span>+ ADD MEDICATION</span>
                          <span className="text-[10px] opacity-75 font-normal">Rx</span>
                        </button>
                        <button onClick={toggleNotifications} className="px-3 py-2 rounded-lg bg-ch-purple/15 hover:bg-ch-purple/25 border border-ch-purple/35 text-ch-purple text-xs font-mono font-semibold transition text-left flex items-center justify-between">
                          <span>NOTIFICATIONS</span>
                          <span className="text-[10px] opacity-75 font-normal">Alerts</span>
                        </button>
                        <button onClick={enableDemoTwoFactor} className="px-3 py-2 rounded-lg bg-ch-yellow/15 hover:bg-ch-yellow/25 border border-ch-yellow/35 text-ch-yellow text-xs font-mono font-semibold transition text-left flex items-center justify-between">
                          <span>2FA DEMO</span>
                          <span className="text-[10px] opacity-75 font-normal">MFA</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="advanced-trust-lab p-4 sm:p-5 rounded-xl bg-ch-bg border border-ch-border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-bold text-ch-text-bright font-mono tracking-wider">ADVANCED TRUST LAB</div>
                    <span className="text-[10px] font-mono text-ch-teal bg-ch-teal/15 px-2 py-0.5 rounded border border-ch-teal/30">DIAGNOSTIC PROTOCOLS</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    <button onClick={() => ingestManualDevice('digital-bp')} className="px-2.5 py-2 rounded-lg bg-ch-teal/15 hover:bg-ch-teal/25 border border-ch-teal/35 text-ch-teal text-[10px] font-mono font-semibold transition text-center">
                      MANUAL BP
                    </button>
                    <button onClick={() => ingestManualDevice('glucometer')} className="px-2.5 py-2 rounded-lg bg-ch-blue/15 hover:bg-ch-blue/25 border border-ch-blue/35 text-ch-blue text-[10px] font-mono font-semibold transition text-center">
                      MANUAL GLUCOSE
                    </button>
                    <button onClick={() => ingestManualDevice('pulse-oximeter')} className="px-2.5 py-2 rounded-lg bg-ch-purple/15 hover:bg-ch-purple/25 border border-ch-purple/35 text-ch-purple text-[10px] font-mono font-semibold transition text-center">
                      MANUAL PULSE OX
                    </button>
                    <button onClick={importDeviceCSV} className="px-2.5 py-2 rounded-lg bg-ch-green/15 hover:bg-ch-green/25 border border-ch-green/35 text-ch-green text-[10px] font-mono font-semibold transition text-center">
                      IMPORT CSV
                    </button>
                    <button onClick={connectExistingDevice} className="px-2.5 py-2 rounded-lg bg-ch-yellow/15 hover:bg-ch-yellow/25 border border-ch-yellow/35 text-ch-yellow text-[10px] font-mono font-semibold transition text-center">
                      CONNECT BLE
                    </button>
                    <button onClick={connectNativeBle} className="px-2.5 py-2 rounded-lg bg-ch-orange/15 hover:bg-ch-orange/25 border border-ch-orange/35 text-ch-orange text-[10px] font-mono font-semibold transition text-center">
                      NATIVE BLE
                    </button>
                    <button onClick={connectNativeHealthStore} className="px-2.5 py-2 rounded-lg bg-ch-teal/15 hover:bg-ch-teal/25 border border-ch-teal/35 text-ch-teal text-[10px] font-mono font-semibold transition text-center">
                      HEALTH CONNECT
                    </button>
                    <button onClick={inspectDeviceConnectors} className="px-2.5 py-2 rounded-lg bg-ch-orange/15 hover:bg-ch-orange/25 border border-ch-orange/35 text-ch-orange text-[10px] font-mono font-semibold transition text-center">
                      STATUS
                    </button>
                    <button onClick={() => ingestDemoDevice('digital-bp')} className="px-2.5 py-2 rounded-lg bg-ch-red/15 hover:bg-ch-red/25 border border-ch-red/35 text-ch-red text-[10px] font-mono font-semibold transition text-center">
                      DEMO BP
                    </button>
                    <button onClick={createDemoConsentAndCapsule} className="px-2.5 py-2 rounded-lg bg-ch-green/15 hover:bg-ch-green/25 border border-ch-green/35 text-ch-green text-[10px] font-mono font-semibold transition text-center">
                      CONSENT CAPSULE
                    </button>
                    <button onClick={createRecoveryDemo} className="px-2.5 py-2 rounded-lg bg-ch-yellow/15 hover:bg-ch-yellow/25 border border-ch-yellow/35 text-ch-yellow text-[10px] font-mono font-semibold transition text-center">
                      RECOVERY SHARES
                    </button>
                    <button onClick={createMerklCheckpoint} className="px-2.5 py-2 rounded-lg bg-ch-teal/15 hover:bg-ch-teal/25 border border-ch-teal/35 text-ch-teal text-[10px] font-mono font-semibold transition text-center">
                      MERKLE CHECKPOINT
                    </button>
                    <button onClick={createEmergencyPassportDemo} className="px-2.5 py-2 rounded-lg bg-ch-red/15 hover:bg-ch-red/25 border border-ch-red/35 text-ch-red text-[10px] font-mono font-semibold transition text-center">
                      EMERGENCY PASSPORT
                    </button>
                    <button onClick={() => runDemoAdversary('ciphertext_tamper')} className="px-2.5 py-2 rounded-lg bg-ch-yellow/15 hover:bg-ch-yellow/25 border border-ch-yellow/35 text-ch-yellow text-[10px] font-mono font-semibold transition text-center">
                      ATTACK LAB
                    </button>
                  </div>
                  <p className="mt-3 text-[10px] font-mono text-ch-text-dim leading-relaxed border-t border-ch-border/50 pt-2.5">
                    Demonstration telemetry is validated for range bounds only. In clinical environments, always confirm IoT readings against certified diagnostic equipment.
                  </p>
                </div>

                <div className="p-4 sm:p-5 rounded-xl bg-ch-bg border border-ch-border">
                  <div className="text-xs font-bold text-ch-text-bright mb-3 font-mono tracking-wider">RECENT AUDIT TRAIL</div>
                  {healthSuite.audit.length === 0 ? (
                    <div className="text-xs font-mono text-ch-text-dim">No audit activity recorded yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {healthSuite.audit.slice(0, 6).map((item) => (
                        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 p-2.5 rounded-lg bg-ch-surface/60 border border-ch-border/60 text-xs font-mono">
                          <span className="text-ch-text-bright font-medium">{item.action}</span>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${
                              item.status === 'blocked' ? 'bg-ch-red/15 text-ch-red border border-ch-red/30' :
                              item.status === 'warning' ? 'bg-ch-yellow/15 text-ch-yellow border border-ch-yellow/30' :
                              'bg-ch-green/15 text-ch-green border border-ch-green/30'
                            }`}>
                              {item.status}
                            </span>
                            <span className="text-ch-text-dim">{new Date(item.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── LOCAL INTELLIGENCE MODAL ─── */}
      {analysisFile && (
        <div className="fixed inset-0 z-[51] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-ch-surface border border-ch-border shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2.5 bg-ch-bg border-b border-ch-border">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-ch-teal" />
                <span className="text-xs font-mono text-ch-text-dim">local.record.intelligence</span>
              </div>
              <button onClick={closeAnalysisModal} className="text-ch-text-dim hover:text-ch-text-bright p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ch-text-bright">Analyze Medical Record</h3>
                <p className="mt-1 text-[11px] font-mono text-ch-text-dim break-all">{analysisFile.originalName}</p>
              </div>

              {!recordInsight && (
                <>
                  <div>
                    <label className="text-[11px] font-mono text-ch-text-dim uppercase tracking-wider mb-1.5 block">record passphrase</label>
                    <input
                      type="password"
                      value={analysisPassphrase}
                      onChange={(e) => setAnalysisPassphrase(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAnalyze(); }}
                      placeholder="enter decryption key..."
                      className="w-full rounded-md bg-ch-bg border border-ch-border px-3 py-2.5 text-sm font-mono text-ch-text-bright placeholder-ch-text-dim/50 focus:outline-none focus:border-ch-teal/50 transition"
                      autoFocus
                    />
                  </div>
                  {analysisError && (
                    <div className="px-3 py-2 rounded-md bg-ch-red/10 border border-ch-red/30 text-ch-red text-[11px] font-mono flex gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{analysisError}</span>
                    </div>
                  )}

                  <button onClick={handleAnalyze} disabled={isAnalyzing || !analysisPassphrase}
                    className="w-full py-2.5 rounded-md bg-ch-teal/15 hover:bg-ch-teal/25 text-ch-teal border border-ch-teal/30 font-mono text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-30">
                    {isAnalyzing ? <><RefreshCw className="w-4 h-4 animate-spin" /> analyzing decrypted memory...</> : <><Cpu className="w-4 h-4" /> Run Local Intelligence</>}
                  </button>
                </>
              )}

              {recordInsight && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-md bg-ch-bg border border-ch-border">
                      <div className="text-[10px] font-mono text-ch-text-dim">DOCUMENT CLASS</div>
                      <div className="mt-1 text-sm font-bold text-ch-teal">{recordInsight.category}</div>
                    </div>
                    <div className="p-3 rounded-md bg-ch-bg border border-ch-border">
                      <div className="text-[10px] font-mono text-ch-text-dim">CONFIDENCE</div>
                      <div className="mt-1 text-sm font-bold text-ch-green">{recordInsight.confidence}%</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-md bg-ch-bg border border-ch-border">
                    <div className="text-[10px] font-mono text-ch-text-dim mb-2">EXTRACT</div>
                    <p className="text-xs leading-relaxed text-ch-text">{recordInsight.summary}</p>
                  </div>
                  {recordInsight.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {recordInsight.keywords.map((keyword) => (
                        <span key={keyword} className="px-2 py-1 rounded bg-ch-teal/10 border border-ch-teal/20 text-[10px] font-mono text-ch-teal">{keyword}</span>
                      ))}
                    </div>
                  )}
                  {recordInsight.extractedMetrics.length > 0 && (
                    <div className="p-3 rounded-md bg-ch-bg border border-ch-border">
                      <div className="text-[10px] font-mono text-ch-text-dim mb-2">DETECTED METRIC CONTEXT</div>
                      <div className="space-y-1">
                        {recordInsight.extractedMetrics.map((metric) => (
                          <div key={metric} className="text-[11px] font-mono text-ch-text">{metric}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="px-3 py-2 rounded-md bg-ch-yellow/10 border border-ch-yellow/20 text-[10px] font-mono text-ch-yellow leading-relaxed">
                    {recordInsight.disclaimer}
                  </div>
                  <div className="text-[9px] font-mono text-ch-text-dim">{recordInsight.engine} · plaintext never persisted</div>
                  <button onClick={closeAnalysisModal} className="w-full py-2 rounded-md bg-ch-bg hover:bg-ch-surface-hover text-ch-text border border-ch-border font-mono text-xs font-semibold">
                    Close Analysis
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── PREVIEW MODAL ─── */}
      {previewUrl && (
        <div className="vault-preview-modal fixed inset-0 z-50 bg-black/95 backdrop-blur flex flex-col p-3 sm:p-6 pt-[max(14px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between pb-3 border-b border-ch-border max-w-6xl w-full mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-ch-green/10 border border-ch-green/30 flex items-center justify-center">
                <Unlock className="w-4 h-4 text-ch-green" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ch-text-bright font-mono flex items-center gap-2">
                  {previewFileName}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-ch-green/10 text-ch-green border border-ch-green/20">
                    decrypted
                  </span>
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href={previewUrl} download={previewFileName}
                className="px-3 py-1.5 rounded-md bg-ch-green/15 text-ch-green border border-ch-green/30 text-[11px] font-mono font-semibold flex items-center gap-1.5 transition hover:bg-ch-green/25">
                <Download className="w-3 h-3" />
                <span>Save</span>
              </a>
              <button onClick={closePreview}
                className="p-1.5 rounded-md bg-ch-surface hover:bg-ch-surface-hover text-ch-text-dim hover:text-ch-text-bright border border-ch-border transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="decrypted-preview flex-1 min-h-0 max-w-6xl w-full mx-auto mt-3 rounded-lg overflow-hidden border border-ch-border bg-ch-bg flex items-center justify-center">
            {previewMime === 'application/pdf' || previewFileName.toLowerCase().endsWith('.pdf') ? (
              <iframe src={previewUrl} title={previewFileName} className="w-full h-full border-none" />
            ) : previewMime.startsWith('image/') ? (
              <img src={previewUrl} alt={previewFileName} className="max-h-[85vh] max-w-full object-contain p-4" />
            ) : (
              <div className="text-center p-8 space-y-4">
                <FileText className="w-12 h-12 text-ch-green mx-auto" />
                <p className="text-sm font-mono text-ch-text">File decrypted successfully</p>
                <a href={previewUrl} download={previewFileName}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-ch-green/15 text-ch-green border border-ch-green/30 text-xs font-mono font-semibold hover:bg-ch-green/25 transition">
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── FOOTER ─── */}
      <footer className="mt-12 border-t border-ch-border max-w-6xl mx-auto px-4 sm:px-6 pt-6 text-center space-y-2">
        <p className="text-[11px] font-mono text-ch-text-dim">
          HealthVault — UN SDG 3 (Target 3.8) & SDG 9 — Secure Cryptographic Infrastructure
        </p>
        <p className="text-[10px] font-mono text-ch-text-dim/50">
          AES-256-GCM • PBKDF2-SHA256 • 100K rounds • Legacy CBC compatible • Zero plaintext on disk
        </p>
      </footer>
    </div>
  );
}

function HeartPulseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h4.27" />
    </svg>
  );
}
