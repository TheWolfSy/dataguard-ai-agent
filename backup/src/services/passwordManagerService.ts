/**
 * Password Manager Service
 *
 * Secure local password vault with AES-256-GCM encryption.
 * Features:
 *   1. Encrypted CRUD for password entries (uses same key as dbCrypto)
 *   2. Weak password detection with scoring and alerts
 *   3. Email sync — scans Gmail inbox for credential-related emails and suggests importing
 *   4. Periodic background scanning to detect newly-weak entries
 *
 * Database: JSON stored in localStorage under STORAGE_KEY.
 * All `passwordEnc` fields are AES-256-GCM ciphertext (base64 IV‖CT).
 *
 * Security model:
 *   - Plaintext passwords live in memory only; they are encrypted before any persistence.
 *   - Key is the shared DataGuard master AES key (dataguard.db.aesKey.v1).
 *   - Clearing localStorage without a key backup loses all vault data permanently.
 */

import { dbEncrypt, dbDecrypt, dbDecryptSafe } from './dbCrypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PasswordEntry {
  id: string;
  service: string;
  username: string;
  /** AES-256-GCM encrypted password (base64 IV ‖ CT) */
  passwordEnc: string;
  url: string;
  notes: string;
  source: 'manual' | 'email_sync';
  emailMessageId?: string;
  createdAt: string;   // ISO
  updatedAt: string;   // ISO
  strengthScore: number; // 0-100
  isWeak: boolean;
  weakReasons: string[];
}

export interface WeakPasswordAlert {
  id: string;
  entryId: string;
  service: string;
  username: string;
  reasons: string[];
  detectedAt: string; // ISO
  dismissed: boolean;
}

export interface PasswordManagerMeta {
  lastEmailSyncAt: string | null;
  lastWeakScanAt: string | null;
  totalEntries: number;
  weakCount: number;
}

export interface PasswordManagerState {
  entries: PasswordEntry[];
  weakAlerts: WeakPasswordAlert[];
  meta: PasswordManagerMeta;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'dataguard_password_manager_db';
const SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Common / weak passwords list (abbreviated — checked case-insensitively)
const COMMON_PASSWORDS = new Set([
  'password', 'password1', '123456', '12345678', '1234567890',
  'qwerty', 'abc123', 'letmein', 'welcome', 'admin',
  'iloveyou', '111111', 'sunshine', 'monkey', 'master',
  'dragon', 'shadow', 'superman', 'batman', '123456789',
  'pass', 'test', '1234', '12345', 'secret',
]);

interface PersistedDB {
  entries: PasswordEntry[];
  weakAlerts: WeakPasswordAlert[];
  meta: PasswordManagerMeta;
}

function loadDB(): PersistedDB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDB();
    return JSON.parse(raw) as PersistedDB;
  } catch {
    return emptyDB();
  }
}

function saveDB(db: PersistedDB): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function emptyDB(): PersistedDB {
  return {
    entries: [],
    weakAlerts: [],
    meta: {
      lastEmailSyncAt: null,
      lastWeakScanAt: null,
      totalEntries: 0,
      weakCount: 0,
    },
  };
}

function generateId(): string {
  return crypto.randomUUID();
}

// ─── Strength Analysis ────────────────────────────────────────────────────────

interface StrengthResult {
  score: number;       // 0-100
  isWeak: boolean;
  reasons: string[];
}

export function analyzePasswordStrength(password: string): StrengthResult {
  const reasons: string[] = [];
  let score = 0;

  if (!password) {
    return { score: 0, isWeak: true, reasons: ['كلمة المرور فارغة'] };
  }

  // Length scoring (max 30pts)
  if (password.length >= 16) score += 30;
  else if (password.length >= 12) score += 22;
  else if (password.length >= 8)  score += 14;
  else {
    score += 0;
    reasons.push(`قصيرة جداً (${password.length} أحرف، الحد الأدنى 8)`);
  }

  // Character diversity (max 40pts)
  const hasUpper   = /[A-Z]/.test(password);
  const hasLower   = /[a-z]/.test(password);
  const hasDigit   = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (hasUpper)   score += 10; else reasons.push('لا تحتوي على أحرف كبيرة (A-Z)');
  if (hasLower)   score += 10; else reasons.push('لا تحتوي على أحرف صغيرة (a-z)');
  if (hasDigit)   score += 10; else reasons.push('لا تحتوي على أرقام (0-9)');
  if (hasSpecial) score += 10; else reasons.push('لا تحتوي على رموز (!@#$%...)');

  // Entropy bonus (unique chars, max 30pts)
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= 12)     score += 30;
  else if (uniqueChars >= 8) score += 20;
  else if (uniqueChars >= 5) score += 10;
  else {
    score += 0;
    reasons.push('أحرف متكررة كثيراً');
  }

  // Common password penalty
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    score = Math.min(score, 10);
    reasons.push('كلمة مرور شائعة وسهلة التخمين');
  }

  score = Math.max(0, Math.min(100, score));
  const isWeak = score < 60 || reasons.length > 0;

  return { score, isWeak, reasons };
}

// ─── CRUD API ─────────────────────────────────────────────────────────────────

/** Returns the full state (entries are loaded with encrypted passwords — use decryptEntry to read). */
export function getPasswordManagerState(): PasswordManagerState {
  const db = loadDB();
  return {
    entries: db.entries,
    weakAlerts: db.weakAlerts,
    meta: { ...db.meta, totalEntries: db.entries.length, weakCount: db.entries.filter((e) => e.isWeak).length },
  };
}

/** Adds a new password entry. The plaintext password is encrypted before storage. */
export async function addPasswordEntry(
  data: { service: string; username: string; password: string; url?: string; notes?: string; source?: 'manual' | 'email_sync'; emailMessageId?: string }
): Promise<PasswordEntry> {
  const db = loadDB();

  const strength = analyzePasswordStrength(data.password);
  const passwordEnc = await dbEncrypt(data.password);
  const now = new Date().toISOString();

  const entry: PasswordEntry = {
    id: generateId(),
    service: data.service.trim(),
    username: data.username.trim(),
    passwordEnc,
    url: data.url?.trim() ?? '',
    notes: data.notes?.trim() ?? '',
    source: data.source ?? 'manual',
    emailMessageId: data.emailMessageId,
    createdAt: now,
    updatedAt: now,
    strengthScore: strength.score,
    isWeak: strength.isWeak,
    weakReasons: strength.reasons,
  };

  db.entries.push(entry);
  db.meta.totalEntries = db.entries.length;
  db.meta.weakCount = db.entries.filter((e) => e.isWeak).length;

  // Raise a weak alert if needed
  if (strength.isWeak) {
    db.weakAlerts.push({
      id: generateId(),
      entryId: entry.id,
      service: entry.service,
      username: entry.username,
      reasons: strength.reasons,
      detectedAt: now,
      dismissed: false,
    });
  }

  saveDB(db);
  return entry;
}

/** Updates an existing entry. If a new plaintext password is provided it will be re-encrypted. */
export async function updatePasswordEntry(
  id: string,
  updates: Partial<{ service: string; username: string; password: string; url: string; notes: string }>
): Promise<PasswordEntry | null> {
  const db = loadDB();
  const idx = db.entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;

  const entry = { ...db.entries[idx] };
  if (updates.service)   entry.service   = updates.service.trim();
  if (updates.username)  entry.username  = updates.username.trim();
  if (updates.url)       entry.url       = updates.url.trim();
  if (updates.notes !== undefined) entry.notes = updates.notes.trim();

  if (updates.password) {
    const strength = analyzePasswordStrength(updates.password);
    entry.passwordEnc    = await dbEncrypt(updates.password);
    entry.strengthScore  = strength.score;
    entry.isWeak         = strength.isWeak;
    entry.weakReasons    = strength.reasons;

    // Remove previous weak alert for this entry if password changed
    db.weakAlerts = db.weakAlerts.filter((a) => a.entryId !== id);

    if (strength.isWeak) {
      db.weakAlerts.push({
        id: generateId(),
        entryId: id,
        service: entry.service,
        username: entry.username,
        reasons: strength.reasons,
        detectedAt: new Date().toISOString(),
        dismissed: false,
      });
    }
  }

  entry.updatedAt = new Date().toISOString();
  db.entries[idx] = entry;
  db.meta.weakCount = db.entries.filter((e) => e.isWeak).length;
  saveDB(db);
  return entry;
}

/** Removes an entry and its associated weak alerts. */
export function removePasswordEntry(id: string): void {
  const db = loadDB();
  db.entries    = db.entries.filter((e) => e.id !== id);
  db.weakAlerts = db.weakAlerts.filter((a) => a.entryId !== id);
  db.meta.totalEntries = db.entries.length;
  db.meta.weakCount    = db.entries.filter((e) => e.isWeak).length;
  saveDB(db);
}

/** Decrypts a single entry's password and returns it as plaintext. */
export async function decryptEntryPassword(entry: PasswordEntry): Promise<string> {
  return dbDecryptSafe(entry.passwordEnc);
}

// ─── Weak Password Scan ───────────────────────────────────────────────────────

/**
 * Re-analyses all stored entries for weak passwords.
 * This is a lighter scan — it only re-evaluates entries whose passwords we CAN re-check
 * by decrypting. New alerts are raised for any newly detected weak entries.
 * Returns the number of newly detected weak entries.
 */
export async function runWeakPasswordScan(): Promise<{ newWeakCount: number; totalWeak: number }> {
  const db = loadDB();
  let newWeakCount = 0;

  for (const entry of db.entries) {
    if (!entry.passwordEnc) continue;
    let plaintext: string;
    try {
      plaintext = await dbDecrypt(entry.passwordEnc);
    } catch {
      continue; // skip unreadable entries
    }

    const strength = analyzePasswordStrength(plaintext);
    const wasWeak = entry.isWeak;

    entry.strengthScore = strength.score;
    entry.isWeak        = strength.isWeak;
    entry.weakReasons   = strength.reasons;
    entry.updatedAt     = new Date().toISOString();

    const hasAlert = db.weakAlerts.some((a) => a.entryId === entry.id && !a.dismissed);

    if (strength.isWeak && !hasAlert) {
      db.weakAlerts.push({
        id: generateId(),
        entryId: entry.id,
        service: entry.service,
        username: entry.username,
        reasons: strength.reasons,
        detectedAt: new Date().toISOString(),
        dismissed: false,
      });
      if (!wasWeak) newWeakCount++;
    } else if (!strength.isWeak) {
      // Dismiss alerts if password is now strong
      db.weakAlerts = db.weakAlerts.map((a) =>
        a.entryId === entry.id ? { ...a, dismissed: true } : a
      );
    }
  }

  db.meta.lastWeakScanAt = new Date().toISOString();
  db.meta.weakCount      = db.entries.filter((e) => e.isWeak).length;
  saveDB(db);

  return { newWeakCount, totalWeak: db.meta.weakCount };
}

/** Dismisses a single weak password alert */
export function dismissWeakAlert(alertId: string): void {
  const db = loadDB();
  db.weakAlerts = db.weakAlerts.map((a) =>
    a.id === alertId ? { ...a, dismissed: true } : a
  );
  saveDB(db);
}

/** Clears all dismissed alerts */
export function clearDismissedAlerts(): void {
  const db = loadDB();
  db.weakAlerts = db.weakAlerts.filter((a) => !a.dismissed);
  saveDB(db);
}

// ─── Email Sync ───────────────────────────────────────────────────────────────

interface GmailConnection {
  accessToken: string;
  email: string;
}

interface EmailPasswordHint {
  messageId: string;
  subject: string;
  from: string;
  service: string;
  username: string;
  suggestedPassword: string;
  date: string;
}

/**
 * Scans recent Gmail messages for credential-related content (e.g. "Your password is:",
 * welcome emails with temporary passwords, or password reset emails with new credentials).
 *
 * Returns a list of hints — the caller decides whether to import them.
 * NOTE: This does NOT silently harvest credentials; it surfaces suggestions for the user to review.
 */
export async function syncEmailPasswords(connection: GmailConnection): Promise<{
  imported: number;
  hints: EmailPasswordHint[];
}> {
  const { accessToken, email: connectedEmail } = connection;
  if (!accessToken) throw new Error('No Gmail access token available');

  const CREDENTIAL_PATTERNS = [
    /(?:your\s+(?:temporary\s+)?password\s+is[:\s]+)([^\s<"']{6,})/i,
    /(?:password[:\s]+)([A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"|,.<>?]{6,32})(?:\s|$)/,
    /(?:Your login credentials|Login details)[^]*?(?:Username|Email)[:\s]+([^\n]+)\n[^]*?Password[:\s]+([^\n<]{6,32})/i,
  ];

  // Fetch last 20 messages to search within
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=subject:(password OR credentials OR temporary+password OR welcome)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) throw new Error(`Gmail API error: ${listRes.status}`);
  const listData = await listRes.json() as { messages?: Array<{ id: string }> };
  if (!listData.messages?.length) {
    // Update last sync timestamp
    const db = loadDB();
    db.meta.lastEmailSyncAt = new Date().toISOString();
    saveDB(db);
    return { imported: 0, hints: [] };
  }

  const hints: EmailPasswordHint[] = [];

  for (const msg of listData.messages.slice(0, 20)) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!msgRes.ok) continue;
      const msgData = await msgRes.json() as {
        id: string;
        internalDate: string;
        payload: {
          headers: Array<{ name: string; value: string }>;
          parts?: Array<{ mimeType: string; body: { data?: string } }>;
          body?: { data?: string };
        };
      };

      const headers = msgData.payload?.headers ?? [];
      const subject = headers.find((h) => h.name === 'Subject')?.value ?? '';
      const from    = headers.find((h) => h.name === 'From')?.value ?? '';
      const date    = new Date(parseInt(msgData.internalDate)).toISOString();

      // Decode body
      let bodyText = '';
      const bodyData = msgData.payload?.body?.data;
      if (bodyData) {
        bodyText = decodeBase64Url(bodyData);
      } else if (msgData.payload?.parts) {
        for (const part of msgData.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            bodyText += decodeBase64Url(part.body.data);
          }
        }
      }

      const fullText = `Subject: ${subject}\n${bodyText}`;

      for (const pattern of CREDENTIAL_PATTERNS) {
        const match = pattern.exec(fullText);
        if (match) {
          // Derive service name from sender domain
          const domainMatch = from.match(/@([\w.-]+)/);
          const service = domainMatch
            ? domainMatch[1].replace(/\./g, ' ').split(' ')[0]
            : from.split('<')[0].trim() || 'Unknown';

          hints.push({
            messageId: msg.id,
            subject,
            from,
            service: capitalizeFirst(service),
            username: connectedEmail,
            suggestedPassword: match[2] ?? match[1],
            date,
          });
          break; // only one hint per message
        }
      }
    } catch {
      // skip individual message errors silently
    }
  }

  // Update last sync timestamp
  const db = loadDB();
  db.meta.lastEmailSyncAt = new Date().toISOString();
  saveDB(db);

  return { imported: 0, hints };
}

/**
 * Imports a batch of EmailPasswordHints as new vault entries.
 * Skips duplicates (same service + username + emailMessageId).
 */
export async function importEmailPasswordHints(hints: EmailPasswordHint[]): Promise<number> {
  const db = loadDB();
  let imported = 0;

  for (const hint of hints) {
    const isDuplicate = db.entries.some(
      (e) => e.emailMessageId === hint.messageId && e.service === hint.service
    );
    if (isDuplicate) continue;

    await addPasswordEntry({
      service: hint.service,
      username: hint.username,
      password: hint.suggestedPassword,
      source: 'email_sync',
      emailMessageId: hint.messageId,
    });
    imported++;
  }

  return imported;
}

// ─── Periodic Background Scan ─────────────────────────────────────────────────

let _scanTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Starts the periodic weak-password background scan.
 * Calls `onWeakDetected` whenever new weak passwords are found.
 * Returns a cleanup function.
 */
export function startWeakPasswordScanLoop(
  onWeakDetected: (count: number) => void
): () => void {
  const run = async () => {
    try {
      const { newWeakCount } = await runWeakPasswordScan();
      if (newWeakCount > 0) onWeakDetected(newWeakCount);
    } catch {
      // background task — never interrupt UX
    }
  };

  // Run once immediately if enough time has passed
  const db = loadDB();
  const lastScan = db.meta.lastWeakScanAt;
  const shouldRunNow = !lastScan || Date.now() - new Date(lastScan).getTime() > SCAN_INTERVAL_MS;
  if (shouldRunNow) void run();

  _scanTimer = setInterval(() => void run(), SCAN_INTERVAL_MS);

  return () => {
    if (_scanTimer) {
      clearInterval(_scanTimer);
      _scanTimer = null;
    }
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return decodeURIComponent(
      atob(b64).split('').map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    );
  } catch {
    return atob(b64);
  }
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
