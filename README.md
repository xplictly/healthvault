# 🛡️ HealthVault: Zero-Knowledge Cryptographic Vault & Edge Health Intelligence Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.0-blue?logo=capacitor)](https://capacitorjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Cryptography](https://img.shields.io/badge/Cipher-AES--256--GCM-red)](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
[![KDF](https://img.shields.io/badge/KDF-PBKDF2--SHA256%20(100k%20rounds)-orange)](https://en.wikipedia.org/wiki/PBKDF2)

An enterprise-grade, zero-knowledge cryptographic vault designed for personal electronic medical records (EMR/EHR) and streaming wearable IoT telemetry. Features client-authenticated **AES-256-GCM**, **PBKDF2-SHA256** key derivation, in-memory buffer processing (zero raw plaintext on disk), $(k, n)$ **Shamir's Secret Sharing** for emergency break-glass recovery, a tamper-evident **Merkle tree integrity ledger**, cross-platform mobile apps (**Capacitor 8 for iOS & Android**), and an interactive **Next.js 14** cyberpunk dashboard.

---

## 📑 Table of Contents

- [The Problem: Why Existing Health Systems Fail](#-the-problem-why-existing-health-systems-fail)
- [How HealthVault Compares](#-how-healthvault-compares)
- [Cryptographic Architecture & Data Flow](#-cryptographic-architecture--data-flow)
- [Key Security Guarantees & Features](#-key-security-guarantees--features)
  - [1. Zero Raw Disk Footprint](#1-zero-raw-disk-footprint)
  - [2. Shamir's Secret Sharing for Emergency Access](#2-shamirs-secret-sharing-for-emergency-access)
  - [3. Merkle Tree & Hash Chain Integrity Ledger](#3-merkle-tree--hash-chain-integrity-ledger)
  - [4. Real-time IoT & Wearable Telemetry](#4-real-time-iot--wearable-telemetry)
  - [5. Time-Limited Encrypted Sharing Links](#5-time-limited-encrypted-sharing-links)
  - [6. In-Memory Document Intelligence & Anomaly Detection](#6-in-memory-document-intelligence--anomaly-detection)
- [Native Mobile Platform (iOS & Android)](#-native-mobile-platform-ios--android)
- [Repository Directory Structure](#-repository-directory-structure)
- [Quickstart Guide](#-quickstart-guide)
  - [1. Cryptographic Backend Server](#1-cryptographic-backend-server)
  - [2. Cryptographic Unit Test Suite](#2-cryptographic-unit-test-suite)
  - [3. Frontend Web Dashboard](#3-frontend-web-dashboard)
  - [4. Native Mobile Sync & Build](#4-native-mobile-sync--build)
- [API Reference](#-api-reference)
- [UN Sustainable Development Goals (SDGs)](#-un-sustainable-development-goals-sdgs)
- [Team & Academic Credits](#-team--academic-credits)

---

## 🚨 The Problem: Why Existing Health Systems Fail

Healthcare records represent the single most intimate, unchangeable category of personal data. Yet current solutions suffer from structural vulnerabilities:

1. **Centralized Hospital Portals (Epic MyChart, Cerner)**: Operate on a *custodial model*. The provider holds the keys. When hospital servers or cloud data lakes are breached by ransomware syndicates, unencrypted patient diagnoses, prescriptions, and social security details are leaked en masse.
2. **Native Health Hubs (Apple Health, Google Health Connect)**: Aggregate basic sensor step counts and heart rates, but do not provide a cryptographic document vault to securely store, verify, and share 20-page diagnostic PDFs, pathology scans, or genomic records with external physicians.
3. **Generic Encrypted Drives (Proton Drive, Bitwarden)**: While zero-knowledge, they are completely detached from healthcare workflows. Most critically: **if an unconscious patient is rushed into an Emergency Room, a standard zero-knowledge drive leaves doctors permanently locked out**, risking patient mortality.
4. **Blockchain Healthcare Prototypes**: Slow, gas-heavy, and non-compliant with medical latency requirements or real-time high-throughput wearable telemetry.

**HealthVault solves this impasse:** A mathematically blind zero-knowledge vault that combines live medical IoT ingestion with emergency $(k, n)$ secret recovery and lightweight Merkle audit trails.

---

## 📊 How HealthVault Compares

| Capability / Feature | Epic MyChart | Apple Health | Proton Drive | DigiLocker / ABDM | **HealthVault** |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Zero-Knowledge Architecture** (Server mathematically blind) | ❌ | ⚠️ (Local only) | ✅ | ❌ | **✅ AES-256-GCM + PBKDF2** |
| **Zero-Plaintext Disk Footprint** (RAM-only pipeline) | ❌ | ❌ | ❌ | ❌ | **✅ 100% Volatile RAM Buffers** |
| **Confidential Diagnostic Document Vault** (PDF/Scans) | ✅ (Plaintext) | ❌ | ✅ (Generic) | ✅ (Plaintext) | **✅ Authenticated `.enc` Package** |
| **Real-time IoT / BLE Medical Device Ingestion** | ❌ | ✅ | ❌ | ❌ | **✅ BLE Cuffs + MQTT Telemetry** |
| **Emergency Break-Glass Recovery** | ❌ (Admin reset) | ❌ | ❌ (Permanent loss)| ❌ | **✅ Shamir’s Secret Sharing $(k, n)$** |
| **Tamper-Evident Integrity Ledger** | ❌ | ❌ | ❌ | ❌ | **✅ Merkle Tree + SHA-256 Chain** |
| **Time-Limited Cryptographic Share Links** | ❌ | ❌ | ⚠️ (Static link) | ❌ | **✅ Scoped Expirable Vault Tokens** |
| **In-Memory Document Intelligence & Metrics** | ❌ | ❌ | ❌ | ❌ | **✅ Zero-Cloud-Leak Local OCR** |
| **Hardware Enclave Mobile Storage** | ❌ | ✅ | ⚠️ | ❌ | **✅ iOS Keychain & Android Keystore** |

---

## 🏛️ Cryptographic Architecture & Data Flow

```
User File (PDF / Scan / Lab Report) + User Passphrase
                          │
                          ▼
            [ Key Derivation Function ]
           PBKDF2-SHA256 (100,000 Rounds)
             Salt: crypto.randomBytes(16)
                          │
                          ▼
                  32-byte AES Key
                          │
       [ AES-256-GCM Authenticated Encryption ]
             IV: crypto.randomBytes(12)
             AAD: 'HVAULT02' Magic Header Bytes
        Cipher: crypto.createCipheriv('aes-256-gcm', key, iv)
                          │
                          ▼
       [ Packaged Binary Vault Asset (.enc) ]
 ┌──────────┬─────────┬──────────────┬───────────────┬────────────────────────┐
 │ Salt 16B │ IV 12B  │ Magic 8B     │ Auth Tag 16B  │ Authenticated Cipher   │
 └──────────┴─────────┴──────────────┴───────────────┴────────────────────────┘
                          │
                          ▼
       uploads/encrypted/[UUID].enc (Stored strictly in ciphertext format)
```

### Decryption & Verification Sequence

```
Encrypted Asset (.enc) + User Passphrase
                          │
                          ▼
    Parse Salt (16B), IV (12B), Magic (8B), Tag (16B), Ciphertext
                          │
                          ▼
    Validate Magic Header: Ensure equals 'HVAULT02' (or legacy 'HVAULT01')
                          │
                          ▼
          Derive Key: PBKDF2-SHA256(Passphrase, Salt, 100000, 32)
                          │
                          ▼
    Decipher: crypto.createDecipheriv('aes-256-gcm', key, iv)
              decipher.setAAD(magic)
              decipher.setAuthTag(authTag)
                          │
                          ▼
    [ Cryptographic Integrity & Authentication Verification ]
       ├── Valid Tag   ──► Stream unencrypted buffer to client (RAM)
       └── Invalid Tag ──► Throw Error: Authentication failed (tamper detected)
```

---

## 🔒 Key Security Guarantees & Features

### 1. Zero Raw Disk Footprint
Raw diagnostic files and unencrypted buffers are processed exclusively in volatile system RAM using Node.js `multer.memoryStorage()`. No temporary plaintext files are ever written to `/tmp` or persistent disk storage.

### 2. Shamir's Secret Sharing for Emergency Access
To eliminate the single point of failure in zero-knowledge patient care, HealthVault implements a $(k, n)$ threshold **Shamir's Secret Sharing scheme**:
- Master emergency access keys are mathematically split into $n$ polynomial shares (e.g., 3 shares: family custodian, primary care physician, hospital emergency credential).
- Any $k$ shares (e.g., 2 of 3) can reconstruct the key to decrypt emergency allergies, blood type, and surgical history.
- A single share contains zero information about the master key.

### 3. Merkle Tree & Hash Chain Integrity Ledger
HealthVault maintains a continuous cryptographic audit chain:
- Every uploaded record is indexed into an internal SHA-256 Merkle Tree.
- Clients can independently verify Merkle audit paths to confirm no record has been tampered with, truncated, or silently deleted by a malicious host.

### 4. Real-time IoT & Wearable Telemetry
- **Bluetooth LE**: Connects directly to hardware digital blood pressure cuffs, glucometers, and pulse oximeters via `@capacitor-community/bluetooth-le`.
- **Health Platform Sync**: Synchronizes vitals directly with Apple HealthKit (iOS) and Android Health Connect via `@capgo/capacitor-health`.
- **Live Stream**: Visualizes ECG waveforms and real-time biometric streams through an MQTT-compatible telemetry bridge.

### 5. Time-Limited Encrypted Sharing Links
Allows generating expirable, cryptographically bounded share tokens:
- Patients can share specific records with a consulting specialist for 1 hour, 24 hours, or 7 days.
- Access automatically revokes once the cryptographic lifespan expires.

### 6. In-Memory Document Intelligence & Anomaly Detection
- Extracts vital parameters, lab metrics, and document classification in volatile memory without transmitting medical records to external AI cloud APIs.
- Real-time access pattern analysis detects brute-force passphrase attempts and suspicious IP sweeps, triggering automatic defense lockouts.

---

## 📱 Native Mobile Platform (iOS & Android)

HealthVault is packaged for native mobile operating systems via **Capacitor 8**:

- **Hardware Security Enclaves**: Encryption session keys are sealed inside the **iOS Keychain** and **Android Keystore** using `capacitor-secure-storage-plugin`, protected by Touch ID, Face ID, or biometric hardware.
- **Responsive Terminal Aesthetics**: Single-canvas UI optimized for mobile viewports with native safe-area padding (`env(safe-area-inset-top)` / `env(safe-area-inset-bottom)`), preventing viewport zooming and layout collisions.
- **Offline Decryption Support**: Decrypt and inspect vital medical passports directly on device even when disconnected from cellular networks.

---

## 📁 Repository Directory Structure

```
healthvault/
├── README.md                           # Comprehensive project documentation
├── .gitignore                          # Git ignore specification
├── sample-records/
│   └── Sample_Medical_Report.pdf       # Ready-to-test sample confidential record
│
├── vault-backend/                      # Express + TypeScript Cryptographic Core
│   ├── src/
│   │   ├── services/
│   │   │   ├── crypto.service.ts       # AES-256-GCM / CBC + PBKDF2 Core Engine
│   │   │   ├── advanced-vault.service.ts # Shamir recovery, Merkle ledger, BLE connectors
│   │   │   ├── health-suite.service.ts # Emergency profile, IoT, anomaly analysis
│   │   │   ├── product-suite.service.ts# Medications, appointments, 2FA protocols
│   │   │   └── record-intelligence.service.ts # In-memory OCR & metric extraction
│   │   ├── server.ts                   # Express REST API (Port 5001)
│   │   └── test-crypto.ts              # Automated cryptographic test suite
│   ├── uploads/encrypted/              # Stored .enc assets (Ciphertext only)
│   ├── metadata.json                   # Encrypted metadata catalog (Zero secrets)
│   ├── tsconfig.json
│   ├── package.json
│   └── .env
│
└── vault-frontend/                     # Next.js 14 + Capacitor 8 Mobile Frontend
    ├── src/
    │   ├── app/
    │   │   ├── globals.css             # Cyberpunk/CryptoHack dark terminal design system
    │   │   ├── layout.tsx              # Root layout with scanline filters & metadata
    │   │   ├── page.tsx                # Interactive dashboard, vault catalog & health suite
    │   │   └── share/page.tsx          # Static time-limited record share viewer
    │   ├── components/
    │   │   └── AvaraStickers.tsx       # Custom SVG vector interface components
    │   └── lib/
    │       └── mobile-adapters.ts      # Native BLE, HealthKit/Connect, Keystore adapters
    ├── android/                        # Android Studio native project (Capacitor)
    ├── ios/                            # Xcode native project (Capacitor / Swift SPM)
    ├── out/                            # Exported static web assets for Capacitor
    ├── capacitor.config.ts             # Capacitor mobile configuration
    ├── tailwind.config.js              # Custom Tailwind styling & palette
    ├── tsconfig.json
    └── package.json
```

---

## 🚀 Quickstart Guide

### Prerequisites
- **Node.js**: v18.x or v20.x LTS
- **npm**: v9.x or later
- **JDK**: Java 21 LTS (for Android builds)
- **Android Studio** (optional, for Android emulation)
- **Xcode** (optional, for iOS build on macOS)

---

### 1. Cryptographic Backend Server

```bash
cd vault-backend
npm install
npm run dev
```

The cryptographic API initializes at `http://localhost:5001`.

### 2. Cryptographic Unit Test Suite

Run the automated test suite to verify key derivation, AES-256-GCM encryption/decryption roundtrips, tampering detection, and Shamir polynomial reconstruction:

```bash
cd vault-backend
npx ts-node src/test-crypto.ts
```

Expected output:
```
✔ Key derivation (PBKDF2-SHA256, 100k rounds) verified.
✔ AES-256-GCM authenticated encryption/decryption roundtrip verified.
✔ Ciphertext bit-flipping correctly triggers authentication tag error.
✔ Shamir's Secret Sharing (2-of-3 threshold) successfully reconstructed.
✔ Merkle tree leaf verification test passed.
```

### 3. Frontend Web Dashboard

In a new terminal window:

```bash
cd vault-frontend
npm install
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser to interact with the CryptoHack dashboard.

---

### 4. Native Mobile Sync & Build

#### Synchronize Web Assets with Mobile Runtimes:
```bash
cd vault-frontend
npm run mobile:sync
```

#### Launch in Android Studio:
```bash
npm run mobile:android
```
*Note: Ensure Android Studio uses **JDK 21** (`org.gradle.java.home` in `gradle.properties`).*

#### Build Android APK directly:
```bash
npm run mobile:android:build
```

#### Launch in Xcode (iOS):
```bash
npm run mobile:ios
```

---

## 📡 API Reference

### Vault Cryptographic Operations
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/vault/upload` | Uploads multipart file in-memory, derives key, and saves AES-256-GCM ciphertext. |
| `GET` | `/api/vault/files` | Lists encrypted file metadata catalog (file size, timestamp, UUID). |
| `POST` | `/api/vault/verify/:id` | Validates ciphertext SHA-256 hash against metadata catalog. |
| `POST` | `/api/vault/decrypt/:id` | Verifies passphrase, validates GCM auth tag, streams decrypted file buffer. |
| `DELETE`| `/api/vault/files/:id` | Securely shreds and unlinks encrypted `.enc` asset and metadata entry. |
| `POST` | `/api/vault/analyze/:id` | In-memory document intelligence & metric extraction. |

### Health Suite & Trust Protocols
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health-suite/overview` | Returns aggregate metrics, IoT readings, anomaly scores, and audit trail. |
| `POST` | `/api/health-suite/iot` | Ingests real-time wearable readings (BP, SpO2, Heart Rate, Sleep). |
| `POST` | `/api/health-suite/emergency-profile` | Updates encrypted ICE emergency contact, blood type, and allergy profiles. |
| `POST` | `/api/health-suite/shares/:id` | Generates a time-expiring cryptographic share token. |
| `POST` | `/api/health-suite/shamir-demo` | Generates and verifies $(k, n)$ secret sharing threshold splits. |
| `POST` | `/api/health-suite/merkle-checkpoint` | Creates an immutable Merkle root checkpoint for stored records. |
| `POST` | `/api/health-suite/adversary-simulation` | Simulates bit-flipping attacks to demonstrate GCM integrity rejection. |

---

## 🎯 UN Sustainable Development Goals (SDGs)

- **SDG 3: Good Health and Well-Being (Target 3.8)**  
  Ensures universal access to safe, confidential, and tamper-proof digital health records, protecting patients against medical identity theft, catastrophic privacy breaches, and unauthorized third-party commercialization.
- **SDG 9: Industry, Innovation, and Infrastructure (Target 9.c)**  
  Provides resilient, zero-trust digital healthcare infrastructure leveraging modern cryptographic algorithms and mobile-first offline security.

---

## 👥 Team & Academic Credits

Developed as a 5th Semester Computer Science Engineering Capstone Mini-Project.

- **Maanas**
- **Sambhav**
- **Pooja**
- **Keerthi**

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
