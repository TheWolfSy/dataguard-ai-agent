/**
 * dbCrypto — AES-256-GCM authenticated encryption for PGlite database fields.
 *
 * Security design:
 * - A 256-bit AES-GCM key is generated on first boot using Web Crypto's
 *   cryptographically-secure PRNG and persisted in localStorage as raw bytes
 *   (base64-encoded). This gives device-scoped encryption — data in IndexedDB is
 *   unreadable without the matching key in localStorage.
 * - Every plaintext gets a unique 96-bit IV (GCM nonce) via getRandomValues().
 * - AES-GCM provides authenticated encryption (AEAD): any tampering of stored
 *   ciphertext causes decryption to throw, caught by dbDecryptSafe().
 * - Ciphertext format in the DB: base64( IV[12 bytes] ‖ CT[n bytes] )
 *
 * Encrypted fields:
 *   ai_provider_configs.api_key_enc   — API keys
 *   data_logs.content                 — user-submitted sensitive data
 *   audit_logs.details                — audit event details
 */

const KEY_STORE_KEY = 'dataguard.db.aesKey.v1';
const KEY_META_STORE_KEY = 'dataguard.db.aesKey.v1.meta';
const IV_BYTES = 12; // 96-bit nonce (recommended for GCM)
const ALG = { name: 'AES-GCM', length: 256 } as const;

let _cachedKey: CryptoKey | null = null;

/**
 * Returns the master AES-256-GCM CryptoKey, generating and persisting it on
 * first call (key never leaves this device).
 */
async function getMasterKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey;

  const stored = localStorage.getItem(KEY_STORE_KEY);
  if (stored) {
    const raw = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    _cachedKey = await crypto.subtle.importKey('raw', raw, ALG, false, [
      'encrypt',
      'decrypt',
    ]);
    return _cachedKey;
  }

  // First run: generate a fresh AES-256 key and persist it
  _cachedKey = await crypto.subtle.generateKey(ALG, true, ['encrypt', 'decrypt']);
  const exported = await crypto.subtle.exportKey('raw', _cachedKey);
  localStorage.setItem(
    KEY_STORE_KEY,
    btoa(String.fromCharCode(...new Uint8Array(exported))),
  );
  localStorage.setItem(KEY_META_STORE_KEY, JSON.stringify({ createdAt: new Date().toISOString() }));
  return _cachedKey;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a base64-encoded string containing the IV followed by the ciphertext.
 */
export async function dbEncrypt(plaintext: string): Promise<string> {
  if (!plaintext || plaintext.trim().length === 0) return plaintext;
  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  // Pack: IV (12 bytes) ‖ ciphertext
  const combined = new Uint8Array(IV_BYTES + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), IV_BYTES);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a base64-encoded IV‖ciphertext string produced by dbEncrypt().
 * Throws if the ciphertext is invalid or has been tampered with (GCM auth tag).
 */
export async function dbDecrypt(ciphertext: string): Promise<string> {
  const key = await getMasterKey();
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, IV_BYTES);
  const data = combined.slice(IV_BYTES);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(plainBuf);
}

/**
 * Tries to decrypt a value; returns the original string unchanged if
 * decryption fails. This allows transparent migration from legacy plaintext
 * data already in the database — old rows are readable without re-migration.
 */
export async function dbDecryptSafe(value: string): Promise<string> {
  if (!value || value.trim().length === 0) return value;
  try {
    return await dbDecrypt(value);
  } catch {
    return value; // legacy plaintext — return as-is
  }
}

/** Returns the algorithm description string for display in the UI. */
export const DB_ENCRYPTION_ALGO = 'AES-256-GCM' as const;

/** Returns display metadata about the current master key (reads from localStorage synchronously). */
export function getKeyInfo(): { algorithm: string; createdAt: Date | null } {
  const meta = localStorage.getItem(KEY_META_STORE_KEY);
  let createdAt: Date | null = null;
  if (meta) {
    try {
      const parsed = JSON.parse(meta) as { createdAt?: string };
      if (parsed.createdAt) createdAt = new Date(parsed.createdAt);
    } catch { /* ignore */ }
  }
  return { algorithm: DB_ENCRYPTION_ALGO, createdAt };
}

/**
 * Returns the raw base64-encoded master key for backup purposes.
 * Returns null if no key has been generated on this device yet.
 */
export function exportDbKeyBase64(): string | null {
  return localStorage.getItem(KEY_STORE_KEY);
}

/**
 * Replaces the current master key with the provided base64-encoded 32-byte raw key.
 * Validates key length before persisting. Clears the in-memory cache so the next
 * crypto operation automatically reloads the new key from localStorage.
 * Throws if the key data is not a valid 32-byte (256-bit) AES key.
 */
export async function importDbKeyBase64(base64Key: string): Promise<void> {
  const raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  if (raw.byteLength !== 32) {
    throw new Error(`Invalid key length: expected 32 bytes, got ${raw.byteLength}`);
  }
  // Verify importability before persisting
  await crypto.subtle.importKey('raw', raw, ALG, false, ['encrypt', 'decrypt']);
  localStorage.setItem(KEY_STORE_KEY, base64Key);
  localStorage.setItem(KEY_META_STORE_KEY, JSON.stringify({ createdAt: new Date().toISOString() }));
  _cachedKey = null; // force cache reload on next use
}
