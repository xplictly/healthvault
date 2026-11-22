import crypto from 'crypto';

const LEGACY_ALGORITHM = 'aes-256-cbc';
const CURRENT_ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;
const LEGACY_IV_LENGTH = 16;
const CURRENT_IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;
const DIGEST = 'sha256';
const LEGACY_FORMAT_MAGIC = Buffer.from('HVAULT01', 'ascii');
const CURRENT_FORMAT_MAGIC = Buffer.from('HVAULT02', 'ascii');
const LEGACY_HMAC_LENGTH = 32;

/**
 * Custom Key Derivation Function (KDF) using PBKDF2.
 * Derives a 32-byte cryptographic key from a passphrase and salt.
 *
 * @param passphrase - The user-supplied secret passphrase.
 * @param salt - Cryptographic random 16-byte salt buffer.
 * @returns 32-byte derived key Buffer.
 * 
 */
export function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_LENGTH, DIGEST);
}

/**
 * Encrypts a file using AES-256-GCM and a passphrase-derived key.
 * Envelope: [16-byte Salt] + [12-byte IV] + [8-byte Magic] + [16-byte Auth Tag] + Ciphertext
 */
export function encryptFile(fileBuffer: Buffer, passphrase: string): Buffer {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(passphrase, salt);
  const iv = crypto.randomBytes(CURRENT_IV_LENGTH);
  const cipher = crypto.createCipheriv(CURRENT_ALGORITHM, key, iv);
  cipher.setAAD(CURRENT_FORMAT_MAGIC);

  const ciphertext = Buffer.concat([
    cipher.update(fileBuffer),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, CURRENT_FORMAT_MAGIC, authTag, ciphertext]);
}

/**
 * Decrypts an encrypted file buffer packaged as [16-byte Salt] + [16-byte IV] + [Ciphertext].
 *
 * @param encryptedBuffer - The buffer containing Salt + IV + Ciphertext.
 * @param passphrase - Passphrase used to derive the key.
 * @returns Decrypted raw file buffer.
 * @throws Error if buffer is truncated or decryption fails due to invalid passphrase or corrupted data.
 */
export function decryptFile(encryptedBuffer: Buffer, passphrase: string): Buffer {
  if (encryptedBuffer.length < SALT_LENGTH + LEGACY_IV_LENGTH) {
    throw new Error('Encrypted payload is corrupted or too short to contain Salt and IV headers.');
  }

  const salt = encryptedBuffer.subarray(0, SALT_LENGTH);
  const key = deriveKey(passphrase, salt);
  const currentHeaderStart = SALT_LENGTH + CURRENT_IV_LENGTH;
  const currentMagic = encryptedBuffer.subarray(currentHeaderStart, currentHeaderStart + CURRENT_FORMAT_MAGIC.length);

  if (currentMagic.equals(CURRENT_FORMAT_MAGIC)) {
    const currentEnvelopeLength = SALT_LENGTH + CURRENT_IV_LENGTH + CURRENT_FORMAT_MAGIC.length + AUTH_TAG_LENGTH;
    if (encryptedBuffer.length < currentEnvelopeLength) {
      throw new Error('Encrypted payload is missing its GCM authentication tag.');
    }
    const iv = encryptedBuffer.subarray(SALT_LENGTH, currentHeaderStart);
    const authTagStart = currentHeaderStart + CURRENT_FORMAT_MAGIC.length;
    const authTag = encryptedBuffer.subarray(authTagStart, authTagStart + AUTH_TAG_LENGTH);
    const ciphertext = encryptedBuffer.subarray(authTagStart + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(CURRENT_ALGORITHM, key, iv);
    decipher.setAAD(CURRENT_FORMAT_MAGIC);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  const legacyHeaderStart = SALT_LENGTH + LEGACY_IV_LENGTH;
  const iv = encryptedBuffer.subarray(SALT_LENGTH, legacyHeaderStart);
  const legacyMagic = encryptedBuffer.subarray(legacyHeaderStart, legacyHeaderStart + LEGACY_FORMAT_MAGIC.length);
  let ciphertext: Buffer;

  if (legacyMagic.equals(LEGACY_FORMAT_MAGIC)) {
    if (encryptedBuffer.length < legacyHeaderStart + LEGACY_FORMAT_MAGIC.length + LEGACY_HMAC_LENGTH) {
      throw new Error('Encrypted payload is corrupted or missing its authentication tag.');
    }
    const hmacStart = legacyHeaderStart + LEGACY_FORMAT_MAGIC.length;
    const storedHmac = encryptedBuffer.subarray(hmacStart, hmacStart + LEGACY_HMAC_LENGTH);
    ciphertext = encryptedBuffer.subarray(hmacStart + LEGACY_HMAC_LENGTH);
    const expectedHmac = crypto.createHmac(DIGEST, key).update(iv).update(ciphertext).digest();
    if (!crypto.timingSafeEqual(storedHmac, expectedHmac)) {
      throw new Error('Invalid passphrase or unauthenticated encrypted payload.');
    }
  } else {
    ciphertext = encryptedBuffer.subarray(legacyHeaderStart);
  }

  const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
