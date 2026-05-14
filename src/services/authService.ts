
import { getAuthDb } from '../authDatabase';
import { sendVerificationEmail, type EmailPurpose } from './emailSenderService';
import { getDevBypassPassword, isDevBypassEmail } from './devBypass';

// دوال تنظيف وتحقق عامة
function sanitizeInput(str: string, maxLen = 128): string {
  if (typeof str !== 'string') throw new Error('قيمة غير صالحة.');
  const cleaned = str.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (cleaned.length === 0 || cleaned.length > maxLen) throw new Error('مدخل غير صالح أو كبير الحجم.');
  return cleaned;
}

export function sanitizeEmailInput(str: string): string {
  const cleaned = sanitizeInput(str, 128).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleaned)) throw new Error('البريد الإلكتروني غير صالح.');
  return cleaned;
}

export function sanitizePhoneInput(str: string): string {
  // تمت إزالة التحقق عبر الهاتف حفاظاً على الخصوصية.
  // نُبقي الدالة كي لا ينكسر الاستيراد في الأماكن القديمة.
  return sanitizeInput(str, 32);
}

function sanitizePasswordInput(str: string): string {
  return sanitizeInput(str, 64);
}

function sanitizeSecurityAnswer(str: string): string {
  return sanitizeInput(str, 64);
}

/**
 * يتحقق من عدد المحاولات الفاشلة خلال آخر windowMinutes دقيقة لبريد وIP معينين.
 * يعيد true إذا تجاوز الحد.
 */
export async function isRateLimited(email: string, ip: string, windowMinutes = 15, maxAttempts = 5): Promise<boolean> {
  const db = await getAuthDb();
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const res = await db.query<any>(
    `SELECT COUNT(*) AS cnt FROM auth_login_attempts WHERE email = $1 AND ip = $2 AND success = FALSE AND attempted_at >= $3`,
    [normalizeEmail(email), ip ?? '', since]
  );
  return Number(res.rows[0]?.cnt ?? 0) >= maxAttempts;
}

export type SecurityQuestions = {
  q1: string;
  a1: string;
  q2: string;
  a2: string;
  q3: string;
  a3: string;
};

export type RegisterPayload = {
  fullName: string;
  email: string;
  backupEmail: string;
  // تمت إزالة phoneNumber حفاظاً على الخصوصية
  birthDate: string;
  password: string;
  securityQuestions: SecurityQuestions;
};

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  backupEmail: string;
  birthDate: string;
  avatarDataUrl?: string;
  emailVerified: boolean;
  createdAt?: string;
};

const EMAIL_VERIFICATION_PURPOSE = 'REGISTER_EMAIL_PHONE';
const EMAIL_RECOVERY_PURPOSE = 'RECOVERY_EMAIL';
const RECOVERY_GRANTED_PURPOSE = 'RECOVERY_GRANTED';
const PROFILE_EMAIL_VERIFY_PURPOSE = 'PROFILE_EMAIL_VERIFY';
const INACTIVITY_DAYS = 90;

export type ProfileUpdatePayload = {
  email: string;
  currentPassword: string;
  fullName: string;
  backupEmail: string;
  birthDate: string;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase();
}

function getRandomCode(length = 6): string {
  // توليد رمز تحقق آمن كريبتوغرافيًا
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  const range = max - min + 1;
  const array = new Uint32Array(1);
  (typeof window !== 'undefined' && window.crypto ? window.crypto : globalThis.crypto).getRandomValues(array);
  return String((array[0] % range) + min);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function isAdult(birthDate: string): boolean {
  const now = new Date();
  const birth = new Date(birthDate);
  const eighteen = new Date(birth);
  eighteen.setFullYear(eighteen.getFullYear() + 18);
  return now >= eighteen;
}

async function hashPassword(password: string, salt: string): Promise<string> {
  return sha256(`${salt}:${password}`);
}

/**
 * Master-only: resets a user's password by user id.
 * This bypasses current-password verification and should only be callable from the Master Panel.
 */
export async function resetUserPasswordByMaster(userIdRaw: string, newPasswordRaw: string): Promise<void> {
  const userId = sanitizeInput(userIdRaw, 128);
  const newPassword = sanitizePasswordInput(newPasswordRaw);

  const db = await getAuthDb();
  const res = await db.query<any>(`SELECT id FROM auth_users WHERE id = $1 LIMIT 1`, [userId]);
  if (!res.rows[0]) throw new Error('المستخدم غير موجود.');

  const newSalt = crypto.randomUUID();
  const newHash = await hashPassword(newPassword, newSalt);

  await db.query(
    `UPDATE auth_users
     SET password_hash = $1,
         password_salt = $2,
         updated_at = NOW(),
         last_activity_at = NOW()
     WHERE id = $3`,
    [newHash, newSalt, userId]
  );
}

async function provisionDevBypassUser(email: string): Promise<void> {
  const db = await getAuthDb();
  const userId = crypto.randomUUID();
  const salt = crypto.randomUUID();
  const devPassword = getDevBypassPassword();
  const passwordSource = devPassword || crypto.randomUUID();
  const passwordHash = await hashPassword(passwordSource, salt);
  const a = await sha256(normalizeAnswer('dev'));

  await db.query(
    `INSERT INTO auth_users (
      id, full_name, email, backup_email, birth_date,
      password_hash, password_salt, email_verified,
      q1, q1_answer_hash, q2, q2_answer_hash, q3, q3_answer_hash, last_activity_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, TRUE,
      $8, $9, $10, $11, $12, $13, NOW()
    )`,
    [
      userId,
      'Dev User',
      email,
      email,
      '1990-01-01',
      passwordHash,
      salt,
      'DEV_Q1',
      a,
      'DEV_Q2',
      a,
      'DEV_Q3',
      a,
    ]
  );
}

function isInactiveBeyondLimit(lastActivityAt: string | Date): boolean {
  const last = new Date(lastActivityAt);
  const diffMs = Date.now() - last.getTime();
  return diffMs > INACTIVITY_DAYS * 24 * 60 * 60 * 1000;
}

async function saveVerificationCodes(params: {
  email: string;
  purpose: string;
  emailCode?: string;
  ttlMinutes?: number;
}): Promise<void> {
  const db = await getAuthDb();
  const id = crypto.randomUUID();
  const ttl = params.ttlMinutes ?? 10;
  const expires = new Date(Date.now() + ttl * 60_000).toISOString();

  await db.query(
    `INSERT INTO auth_verifications (
      id, email, purpose, email_code_hash, expires_at, consumed
    ) VALUES ($1, $2, $3, $4, $5, FALSE)`,
    [
      id,
      normalizeEmail(params.email),
      params.purpose,
      params.emailCode ? await sha256(params.emailCode) : null,
      expires,
    ]
  );
}

async function readLatestVerification(email: string, purpose: string) {
  const db = await getAuthDb();
  const res = await db.query<any>(
    `SELECT * FROM auth_verifications
     WHERE email = $1 AND purpose = $2 AND consumed = FALSE
     ORDER BY created_at DESC
     LIMIT 1`,
    [normalizeEmail(email), purpose]
  );
  return res.rows[0] ?? null;
}

async function consumeVerification(id: string): Promise<void> {
  const db = await getAuthDb();
  await db.query(`UPDATE auth_verifications SET consumed = TRUE WHERE id = $1`, [id]);
}

// Sends an email via EmailJS. Requires VITE_EMAILJS_* env vars to be configured.
async function sendEmailCodeSecure(
  email: string,
  code: string,
  purpose: EmailPurpose = 'registration'
): Promise<void> {
  await sendVerificationEmail(email, code, purpose);
}

export async function startRegistrationVerification(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  if (isDevBypassEmail(normalizedEmail)) return;
  const emailCode = getRandomCode(6);

  console.log('[Auth] Saving verification codes for:', normalizedEmail);
  await saveVerificationCodes({
    email: normalizedEmail,
    purpose: EMAIL_VERIFICATION_PURPOSE,
    emailCode,
    ttlMinutes: 10,
  });
  console.log('[Auth] Verification codes saved. Sending email...');

  await sendEmailCodeSecure(normalizedEmail, emailCode, 'registration');
  console.log('[Auth] Email sent successfully.');
}

export async function registerUser(payload: RegisterPayload & { emailCode: string }): Promise<{ userId: string }> {
  // تنظيف جميع المدخلات والتحقق من الحجم والشكل
  const fullName = sanitizeInput(payload.fullName, 128);
  const email = sanitizeEmailInput(payload.email);
  const backupEmail = sanitizeEmailInput(payload.backupEmail);
  const birthDate = sanitizeInput(payload.birthDate, 16);
  const password = sanitizePasswordInput(payload.password);
  const shouldBypass = isDevBypassEmail(email);
  const emailCode = shouldBypass ? String(payload.emailCode ?? '').trim() : sanitizeInput(payload.emailCode, 16);
  const q1 = sanitizeInput(payload.securityQuestions.q1, 64);
  const a1 = sanitizeSecurityAnswer(payload.securityQuestions.a1);
  const q2 = sanitizeInput(payload.securityQuestions.q2, 64);
  const a2 = sanitizeSecurityAnswer(payload.securityQuestions.a2);
  const q3 = sanitizeInput(payload.securityQuestions.q3, 64);
  const a3 = sanitizeSecurityAnswer(payload.securityQuestions.a3);

  if (!isAdult(birthDate)) {
    throw new Error('يجب أن يكون عمر المستخدم 18 سنة على الأقل.');
  }

  const db = await getAuthDb();
  const existing = await db.query<any>(`SELECT id FROM auth_users WHERE email = $1 LIMIT 1`, [email]);
  if (existing.rows.length > 0) {
    throw new Error('هذا البريد مسجل بالفعل.');
  }

  const verification = shouldBypass ? null : await readLatestVerification(email, EMAIL_VERIFICATION_PURPOSE);
  if (!shouldBypass) {
    if (!verification) {
      throw new Error('لم يتم العثور على رمز تحقق صالح.');
    }
    if (new Date(verification.expires_at).getTime() < Date.now()) {
      throw new Error('انتهت صلاحية رمز التحقق. أعد الإرسال.');
    }
    const emailCodeHash = await sha256(emailCode);
    if (verification.email_code_hash !== emailCodeHash) {
      throw new Error('رمز التحقق للبريد الإلكتروني غير صحيح.');
    }
  }

  const salt = crypto.randomUUID();
  const passwordHash = await hashPassword(password, salt);
  const userId = crypto.randomUUID();


  await db.query(
    `INSERT INTO auth_users (
      id, full_name, email, backup_email, birth_date,
      password_hash, password_salt, email_verified,
      q1, q1_answer_hash, q2, q2_answer_hash, q3, q3_answer_hash, last_activity_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, TRUE,
      $8, $9, $10, $11, $12, $13, NOW()
    )`,
    [
      userId,
      fullName,
      email,
      backupEmail,
      birthDate,
      passwordHash,
      salt,
      q1,
      await sha256(a1),
      q2,
      await sha256(a2),
      q3,
      await sha256(a3),
    ]
  );

  // تخزين محلي (بدلاً من ملف users_id.json غير المتاح في المتصفح)
  try {
    const key = 'dataguard_users_id_json';
    const raw = localStorage.getItem(key);
    const usersJson = raw ? JSON.parse(raw) : { users: [] as any[] };
    usersJson.users = Array.isArray(usersJson.users) ? usersJson.users : [];
    usersJson.users.push({
      id: userId,
      email,
      fullName,
      birthDate,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem(key, JSON.stringify(usersJson));
  } catch (err) {
    console.error('فشل تحديث التخزين المحلي للمستخدمين:', err);
  }

  if (!shouldBypass && verification) {
    await consumeVerification(verification.id);
  }

  return { userId };
}

export async function loginUser(emailRaw: string, password: string, ip?: string): Promise<AuthUser> {
  // تنظيف المدخلات
  const email = sanitizeEmailInput(emailRaw);
  const shouldBypass = isDevBypassEmail(email);
  const cleanPassword = shouldBypass ? '' : sanitizePasswordInput(password);
  const db = await getAuthDb();
  const loginTimestamp = new Date().toISOString();

  // تحقق من عدد المحاولات الفاشلة خلال آخر 15 دقيقة لهذا البريد وIP
  if (!shouldBypass) {
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const attemptsRes = await db.query<any>(
      `SELECT COUNT(*) AS cnt FROM auth_login_attempts WHERE email = $1 AND ip = $2 AND success = FALSE AND attempted_at >= $3`,
      [email, ip ?? '', since]
    );
    const failedAttempts = Number(attemptsRes.rows[0]?.cnt ?? 0);
    if (failedAttempts >= 5) {
      const { logRateLimit } = await import('./xdrMonitorService');
      await logRateLimit(email, ip ?? '');
      throw new Error('تم تجاوز الحد الأقصى لمحاولات الدخول. الرجاء المحاولة بعد 15 دقيقة.');
    }
  }

  const res = await db.query<any>(`SELECT * FROM auth_users WHERE email = $1 LIMIT 1`, [email]);
  let row = res.rows[0];
  let loginSuccess = false;

  if (!row) {
    if (shouldBypass) {
      await provisionDevBypassUser(email);
      const res2 = await db.query<any>(`SELECT * FROM auth_users WHERE email = $1 LIMIT 1`, [email]);
      row = res2.rows[0];
    } else {
      await db.query(
        `INSERT INTO auth_login_attempts (id, email, ip, success, reason) VALUES ($1, $2, $3, FALSE, $4)`,
        [crypto.randomUUID(), email, ip ?? '', 'USER_NOT_FOUND']
      );
      const { logLoginAttempt } = await import('./xdrMonitorService');
      await logLoginAttempt({ email, ip: ip ?? '', success: false, timestamp: loginTimestamp, reason: 'USER_NOT_FOUND' });
      throw new Error('بيانات الدخول غير صحيحة.');
    }
  }

  if (isInactiveBeyondLimit(row.last_activity_at ?? row.updated_at ?? row.created_at)) {
    throw new Error('ACCOUNT_INACTIVE_90_DAYS');
  }

  if (!shouldBypass) {
    const candidateHash = await hashPassword(cleanPassword, row.password_salt);
    if (candidateHash !== row.password_hash) {
      await db.query(
        `INSERT INTO auth_login_attempts (id, email, ip, success, reason) VALUES ($1, $2, $3, FALSE, $4)`,
        [crypto.randomUUID(), email, ip ?? '', 'PASSWORD_MISMATCH']
      );
      const { logLoginAttempt } = await import('./xdrMonitorService');
      await logLoginAttempt({ email, ip: ip ?? '', success: false, timestamp: loginTimestamp, reason: 'PASSWORD_MISMATCH' });
      throw new Error('بيانات الدخول غير صحيحة.');
    }
  }

  loginSuccess = true;
  await db.query(
    `INSERT INTO auth_login_attempts (id, email, ip, success, reason) VALUES ($1, $2, $3, TRUE, $4)`,
    [crypto.randomUUID(), email, ip ?? '', shouldBypass ? 'DEV_BYPASS' : 'LOGIN_OK']
  );

  const { logLoginAttempt } = await import('./xdrMonitorService');
  await logLoginAttempt({ email, ip: ip ?? '', success: true, timestamp: loginTimestamp });

  await touchUserActivity(email);

  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    backupEmail: row.backup_email,
    birthDate: row.birth_date,
    avatarDataUrl: row.avatar_data_url ?? undefined,
    emailVerified: row.email_verified,
    createdAt: row.created_at,
  };
}

export async function touchUserActivity(emailRaw: string): Promise<void> {
  const db = await getAuthDb();
  const email = normalizeEmail(emailRaw);
  await db.query(
    `UPDATE auth_users SET last_activity_at = NOW(), updated_at = NOW() WHERE email = $1`,
    [email]
  );
}

export async function purgeInactiveAuthUserIfNeeded(emailRaw: string): Promise<{ purged: boolean }> {
  const db = await getAuthDb();
  const email = normalizeEmail(emailRaw);
  const res = await db.query<any>(`SELECT * FROM auth_users WHERE email = $1 LIMIT 1`, [email]);
  const row = res.rows[0];
  if (!row) {
    return { purged: false };
  }

  if (!isInactiveBeyondLimit(row.last_activity_at ?? row.updated_at ?? row.created_at)) {
    return { purged: false };
  }

  await db.query('BEGIN');
  try {
    await db.query(
      `UPDATE auth_users SET inactivity_deleted_at = NOW() WHERE email = $1`,
      [email]
    );
    await db.query(`DELETE FROM auth_verifications WHERE email = $1`, [email]);
    await db.query(`DELETE FROM auth_login_attempts WHERE email = $1`, [email]);
    await db.query(`DELETE FROM auth_users WHERE email = $1`, [email]);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }

  return { purged: true };
}

export async function purgeAllInactiveAuthUsers(): Promise<{ purgedEmails: string[] }> {
  const db = await getAuthDb();
  const res = await db.query<any>(`SELECT email FROM auth_users`);
  const purgedEmails: string[] = [];

  for (const row of res.rows) {
    const email = normalizeEmail(row.email);
    const result = await purgeInactiveAuthUserIfNeeded(email);
    if (result.purged) {
      purgedEmails.push(email);
    }
  }

  return { purgedEmails };
}

export async function getLocalUserProfile(emailRaw: string): Promise<AuthUser> {
  const db = await getAuthDb();
  const email = normalizeEmail(emailRaw);
  const res = await db.query<any>(`SELECT * FROM auth_users WHERE email = $1 LIMIT 1`, [email]);
  const row = res.rows[0];
  if (!row) {
    throw new Error('المستخدم غير موجود في قاعدة بيانات المصادقة المحلية.');
  }

  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    backupEmail: row.backup_email,
    birthDate: row.birth_date,
    avatarDataUrl: row.avatar_data_url ?? undefined,
    emailVerified: row.email_verified,
    createdAt: row.created_at,
  };
}

export async function updateLocalUserAvatar(emailRaw: string, avatarDataUrl: string): Promise<void> {
  const db = await getAuthDb();
  const email = normalizeEmail(emailRaw);
  await db.query(
    `UPDATE auth_users SET avatar_data_url = $1, updated_at = NOW(), last_activity_at = NOW() WHERE email = $2`,
    [avatarDataUrl, email]
  );
}

export async function clearLocalUserAvatar(emailRaw: string): Promise<void> {
  const db = await getAuthDb();
  const email = normalizeEmail(emailRaw);
  await db.query(
    `UPDATE auth_users SET avatar_data_url = NULL, updated_at = NOW(), last_activity_at = NOW() WHERE email = $1`,
    [email]
  );
}

export async function updateLocalUserProfileWithCurrentPassword(payload: ProfileUpdatePayload): Promise<void> {
  const db = await getAuthDb();
  const email = normalizeEmail(payload.email);
  const res = await db.query<any>(`SELECT id, password_hash, password_salt FROM auth_users WHERE email = $1 LIMIT 1`, [email]);
  const row = res.rows[0];
  if (!row) {
    throw new Error('المستخدم غير موجود.');
  }

  const currentHash = await hashPassword(payload.currentPassword, row.password_salt);
  if (currentHash !== row.password_hash) {
    throw new Error('كلمة المرور الحالية غير صحيحة.');
  }

  if (payload.birthDate && !isAdult(payload.birthDate)) {
    throw new Error('يجب أن يكون العمر 18 سنة على الأقل.');
  }

  const birthDateValue = payload.birthDate || null;

  await db.query(
    `UPDATE auth_users
     SET full_name = $1,
         backup_email = $2,
         birth_date = COALESCE($3::date, birth_date),
         updated_at = NOW(),
         last_activity_at = NOW()
     WHERE email = $4`,
    [
      payload.fullName.trim(),
      normalizeEmail(payload.backupEmail),
      birthDateValue,
      email,
    ]
  );
}

export async function changePasswordWithCurrent(
  emailRaw: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const db = await getAuthDb();
  const email = normalizeEmail(emailRaw);
  const res = await db.query<any>(`SELECT id, password_hash, password_salt FROM auth_users WHERE email = $1 LIMIT 1`, [email]);
  const row = res.rows[0];
  if (!row) {
    throw new Error('المستخدم غير موجود.');
  }

  const currentHash = await hashPassword(currentPassword, row.password_salt);
  if (currentHash !== row.password_hash) {
    throw new Error('كلمة المرور الحالية غير صحيحة.');
  }

  const newSalt = crypto.randomUUID();
  const newHash = await hashPassword(newPassword, newSalt);

  await db.query(
    `UPDATE auth_users SET password_hash = $1, password_salt = $2, updated_at = NOW(), last_activity_at = NOW() WHERE id = $3`,
    [newHash, newSalt, row.id]
  );
}

// ── Step 1: Send email recovery code ──────────────────────────────────────
export async function sendEmailRecoveryCode(emailRaw: string): Promise<void> {
  const db = await getAuthDb();
  const email = normalizeEmail(emailRaw);
  const res = await db.query<any>(`SELECT id FROM auth_users WHERE email = $1 LIMIT 1`, [email]);
  if (!res.rows[0]) throw new Error('البريد الإلكتروني غير مسجل.');

  const code = getRandomCode(6);
  await saveVerificationCodes({ email, purpose: EMAIL_RECOVERY_PURPOSE, emailCode: code, ttlMinutes: 10 });
  await sendEmailCodeSecure(email, code, 'email_recovery');
}

// ── Step 1 verify: Check email code → grant recovery token ────────────────
export async function verifyEmailRecoveryCode(emailRaw: string, code: string): Promise<void> {
  const email = normalizeEmail(emailRaw);
  const verification = await readLatestVerification(email, EMAIL_RECOVERY_PURPOSE);
  if (!verification) throw new Error('لا يوجد رمز تحقق صالح. أرسل الرمز أولاً.');
  if (new Date(verification.expires_at).getTime() < Date.now()) throw new Error('انتهت صلاحية رمز التحقق.');

  const hash = await sha256(code.trim());
  if (verification.email_code_hash !== hash) throw new Error('رمز التحقق غير صحيح.');

  await consumeVerification(verification.id);
  await saveVerificationCodes({ email, purpose: RECOVERY_GRANTED_PURPOSE, ttlMinutes: 15 });
}

// ── Step 2: Get security questions ───────────────────────────────────────
export async function getRecoveryQuestions(emailRaw: string): Promise<{ q1: string; q2: string; q3: string }> {
  const db = await getAuthDb();
  const email = normalizeEmail(emailRaw);
  const res = await db.query<any>(`SELECT q1, q2, q3 FROM auth_users WHERE email = $1 LIMIT 1`, [email]);
  const row = res.rows[0];
  if (!row) throw new Error('المستخدم غير موجود.');
  return { q1: row.q1 ?? '', q2: row.q2 ?? '', q3: row.q3 ?? '' };
}

// ── Step 3 verify: Check security answers → grant recovery token ─────────
export async function verifySecurityAnswersForRecovery(
  emailRaw: string,
  a1: string,
  a2: string,
  a3: string
): Promise<void> {
  const db = await getAuthDb();
  const email = normalizeEmail(emailRaw);
  const res = await db.query<any>(
    `SELECT q1_answer_hash, q2_answer_hash, q3_answer_hash FROM auth_users WHERE email = $1 LIMIT 1`,
    [email]
  );
  const row = res.rows[0];
  if (!row) throw new Error('المستخدم غير موجود.');

  const h1 = await sha256(normalizeAnswer(a1));
  const h2 = await sha256(normalizeAnswer(a2));
  const h3 = await sha256(normalizeAnswer(a3));

  if (h1 !== row.q1_answer_hash || h2 !== row.q2_answer_hash || h3 !== row.q3_answer_hash) {
    throw new Error('إجابات أسئلة الأمان غير صحيحة.');
  }

  await saveVerificationCodes({ email, purpose: RECOVERY_GRANTED_PURPOSE, ttlMinutes: 15 });
}

// ── Final step: Reset password after any method is verified ──────────────
export async function resetPasswordAfterVerification(emailRaw: string, newPassword: string): Promise<void> {
  const db = await getAuthDb();
  const email = normalizeEmail(emailRaw);

  const grant = await readLatestVerification(email, RECOVERY_GRANTED_PURPOSE);
  if (!grant) throw new Error('لم يتم التحقق من هويتك. يرجى إكمال إحدى خطوات التحقق أولاً.');
  if (new Date(grant.expires_at).getTime() < Date.now()) {
    throw new Error('انتهت صلاحية جلسة التحقق. يرجى البدء من جديد.');
  }

  const res = await db.query<any>(`SELECT id FROM auth_users WHERE email = $1 LIMIT 1`, [email]);
  if (!res.rows[0]) throw new Error('المستخدم غير موجود.');

  const newSalt = crypto.randomUUID();
  const newHash = await hashPassword(newPassword, newSalt);

  await db.query(
    `UPDATE auth_users SET password_hash = $1, password_salt = $2, updated_at = NOW(), last_activity_at = NOW() WHERE id = $3`,
    [newHash, newSalt, res.rows[0].id]
  );

  await consumeVerification(grant.id);
}

// ── Profile: Send email verification code ────────────────────────────────
export async function sendEmailVerificationCode(emailRaw: string): Promise<void> {
  const db = await getAuthDb();
  const email = normalizeEmail(emailRaw);
  const res = await db.query<any>(
    `SELECT id, email_verified FROM auth_users WHERE email = $1 LIMIT 1`,
    [email]
  );
  const row = res.rows[0];
  if (!row) throw new Error('المستخدم غير موجود.');
  if (row.email_verified) throw new Error('البريد الإلكتروني موثق بالفعل.');

  const code = getRandomCode(6);
  await saveVerificationCodes({ email, purpose: PROFILE_EMAIL_VERIFY_PURPOSE, emailCode: code, ttlMinutes: 10 });
  await sendEmailCodeSecure(email, code, 'profile_verify');
}

// ── Profile: Confirm email verification code ──────────────────────────────
export async function confirmEmailVerification(emailRaw: string, code: string): Promise<void> {
  const db = await getAuthDb();
  const email = normalizeEmail(emailRaw);

  const verification = await readLatestVerification(email, PROFILE_EMAIL_VERIFY_PURPOSE);
  if (!verification) throw new Error('لا يوجد رمز تحقق صالح. أرسل الرمز أولاً.');
  if (new Date(verification.expires_at).getTime() < Date.now()) {
    throw new Error('انتهت صلاحية رمز التحقق. أعد الإرسال.');
  }

  const hash = await sha256(code.trim());
  if (verification.email_code_hash !== hash) throw new Error('رمز التحقق غير صحيح.');

  await db.query(
    `UPDATE auth_users SET email_verified = TRUE, updated_at = NOW(), last_activity_at = NOW() WHERE email = $1`,
    [email]
  );
  await consumeVerification(verification.id);
}

// ── Phone verification removed ─────────────────────────────────────────────
export async function sendPhoneVerificationCode(): Promise<void> {
  throw new Error('تم إلغاء ميزة التحقق عبر الهاتف في هذا النظام.');
}

export async function confirmPhoneVerification(): Promise<void> {
  throw new Error('تم إلغاء ميزة التحقق عبر الهاتف في هذا النظام.');
}
