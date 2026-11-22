import { encryptFile, decryptFile } from './services/crypto.service';
import assert from 'assert';

console.log('🧪 Starting Cryptographic Service Verification Tests...\n');

const testPayload = Buffer.from('CONFIDENTIAL MEDICAL RECORD: Patient John Doe, BP 120/80, Diagnosis: Healthy');
const correctPassphrase = 'SuperSecretMedicalKey#2026';
const wrongPassphrase = 'WrongPassword123!';

// Test 1: Encryption output structure
const encrypted = encryptFile(testPayload, correctPassphrase);
console.log('✔ Test 1: Encryption Succeeded.');
console.log(`   Original Size: ${testPayload.length} bytes`);
console.log(`   Encrypted Size (Salt 16B + IV 16B + Ciphertext): ${encrypted.length} bytes`);

// Ensure header lengths
assert(encrypted.length >= 32 + 16, 'Encrypted buffer must contain 16B Salt + 16B IV + at least 1 block ciphertext');
const salt = encrypted.subarray(0, 16);
const iv = encrypted.subarray(16, 32);
console.log(`   Extracted Salt (hex): ${salt.toString('hex')}`);
console.log(`   Extracted IV (hex):   ${iv.toString('hex')}`);

// Test 2: Decryption with correct passphrase
const decrypted = decryptFile(encrypted, correctPassphrase);
assert.strictEqual(decrypted.toString('utf-8'), testPayload.toString('utf-8'), 'Decrypted text must match original');
console.log('✔ Test 2: Decryption with correct passphrase succeeded and matched original buffer.');

// Test 3: Decryption failure with wrong passphrase
let failedAsExpected = false;
try {
  decryptFile(encrypted, wrongPassphrase);
} catch (err: any) {
  failedAsExpected = true;
  console.log(`✔ Test 3: Decryption with wrong passphrase correctly rejected (caught: "${err.message}").`);
}
assert(failedAsExpected, 'Decryption with wrong passphrase MUST fail');

// Test 4: Corrupted payload detection
let corruptedFails = false;
try {
  const truncated = encrypted.subarray(0, 20); // less than salt + iv
  decryptFile(truncated, correctPassphrase);
} catch (err: any) {
  corruptedFails = true;
  console.log(`✔ Test 4: Truncated payload correctly rejected.`);
}
assert(corruptedFails, 'Truncated payload MUST fail');

console.log('\n✨ ALL CRYPTOGRAPHY VERIFICATION CHECKS PASSED SUCCESSFULLY!');

