/**
 * Master Auth Service — Root-level admin access for debugging and maintenance.
 * Credentials are stored as SHA-256 hashes for security.
 */

import { getAuthDb } from '../authDatabase';

// SHA-256 hashes of master credentials — يجب ضبطها في متغيرات البيئة فقط
const MASTER_USERNAME_HASH = import.meta.env.VITE_MASTER_USERNAME_HASH as string | undefined;
const MASTER_PASSWORD_HASH = import.meta.env.VITE_MASTER_PASSWORD_HASH as string | undefined;
const MASTER_SECURITY_ANSWER_HASH = import.meta.env.VITE_MASTER_SECURITY_ANSWER_HASH as string | undefined;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validates master credentials against stored hashes.
 * Supports:
 * - Root master (env hashes)
 * - Managed master accounts stored in local auth DB (auth_master_accounts)
 */
export type MasterAuthCandidate =
  | { kind: 'root' }
  | { kind: 'managed'; id: string };

export async function validateMasterLogin(username: string, password: string): Promise<MasterAuthCandidate | null> {
  const [uHash, pHash] = await Promise.all([sha256(username), sha256(password)]);

  // Root env-based master
  if (uHash === MASTER_USERNAME_HASH && pHash === MASTER_PASSWORD_HASH) {
    return { kind: 'root' };
  }

  // Managed master accounts
  try {
    const db = await getAuthDb();
    const res = await db.query<any>(
      `SELECT id FROM auth_master_accounts WHERE username_hash = $1 AND password_hash = $2 AND enabled = TRUE LIMIT 1`,
      [uHash, pHash]
    );
    const row = res.rows?.[0];
    if (row?.id) return { kind: 'managed', id: String(row.id) };
  } catch {
    // ignore: DB not available yet
  }
  return null;
}

/** Validates the master security answer (SHA-256 hash compare). */
export async function validateMasterSecurityAnswer(candidate: MasterAuthCandidate, answer: string): Promise<boolean> {
  const aHash = await sha256(answer);
  if (candidate.kind === 'root') {
    return aHash === MASTER_SECURITY_ANSWER_HASH;
  }
  const db = await getAuthDb();
  const res = await db.query<any>(
    `SELECT security_answer_hash FROM auth_master_accounts WHERE id = $1 AND enabled = TRUE LIMIT 1`,
    [candidate.id]
  );
  return (res.rows?.[0]?.security_answer_hash ?? '') === aHash;
}

export async function createManagedMasterAccount(params: {
  username: string;
  password: string;
  securityAnswer: string;
}): Promise<{ id: string }> {
  const username = params.username.trim();
  const password = params.password.trim();
  const securityAnswer = params.securityAnswer.trim();
  if (!username || !password || !securityAnswer) throw new Error('يرجى تعبئة جميع الحقول.');
  if (username.length > 128 || password.length > 128 || securityAnswer.length > 128) throw new Error('إحدى القيم طويلة جداً.');

  const [uHash, pHash, aHash] = await Promise.all([sha256(username), sha256(password), sha256(securityAnswer)]);
  const id = crypto.randomUUID();
  const db = await getAuthDb();
  await db.query(
    `INSERT INTO auth_master_accounts (id, username_hash, password_hash, security_answer_hash, enabled)
     VALUES ($1, $2, $3, $4, TRUE)`,
    [id, uHash, pHash, aHash]
  );
  return { id };
}

export async function listManagedMasterAccounts(): Promise<Array<{ id: string; enabled: boolean; createdAt: string }>> {
  const db = await getAuthDb();
  const res = await db.query<any>(
    `SELECT id, enabled, created_at FROM auth_master_accounts ORDER BY created_at DESC LIMIT 50`
  );
  return (res.rows ?? []).map((r: any) => ({
    id: String(r.id),
    enabled: Boolean(r.enabled),
    createdAt: String(r.created_at),
  }));
}

export async function setManagedMasterAccountEnabled(idRaw: string, enabled: boolean): Promise<void> {
  const id = String(idRaw ?? '').trim();
  if (!id) throw new Error('معرف غير صالح.');
  const db = await getAuthDb();
  await db.query(
    `UPDATE auth_master_accounts SET enabled = $1, updated_at = NOW() WHERE id = $2`,
    [enabled, id]
  );
}

/** Session key used to persist master login across page refreshes */
const MASTER_SESSION_KEY = 'dataguard_master_session';

export function isMasterSessionActive(): boolean {
  return sessionStorage.getItem(MASTER_SESSION_KEY) === 'active';
}

export function activateMasterSession(): void {
  sessionStorage.setItem(MASTER_SESSION_KEY, 'active');
}

export function clearMasterSession(): void {
  sessionStorage.removeItem(MASTER_SESSION_KEY);
}
