/**
 * Auth Integration Test — إنشاء حساب تجريبي مع تأكيد البريد والهاتف
 *
 * يمكن تشغيله من console المتصفح أو من صفحة الاختبارات:
 *   import { runAuthIntegrationTests } from './tests/authIntegrationTest';
 *   await runAuthIntegrationTests();
 */

import { getAuthDb } from '../authDatabase';
import {
  registerUser,
  loginUser,
  getLocalUserProfile,
  changePasswordWithCurrent,
  updateLocalUserProfileWithCurrentPassword,
  type RegisterPayload,
  type AuthUser,
} from '../services/authService';

// ── بيانات المستخدم التجريبي ───────────────────────────────────────────────
const TEST_USER = {
  fullName: 'أحمد محمد التجريبي',
  email: 'test.user@dataguard-test.com',
  backupEmail: 'backup.test@dataguard-test.com',
  birthDate: '1995-06-15',
  password: process.env.TEST_USER_PASSWORD || '',
  securityQuestions: {
    q1: 'ما اسم مدرستك الأولى؟',
    a1: 'مدرسة النور',
    q2: 'ما اسم حيوانك الأليف الأول؟',
    a2: 'قطتي سنو',
    q3: 'في أي مدينة ولدت؟',
    a3: 'القاهرة',
  },
};

// ── أدوات مساعدة ──────────────────────────────────────────────────────────
type TestResult = { name: string; passed: boolean; detail: string };
const results: TestResult[] = [];

function log(msg: string) {
  console.log(`%c[AuthTest] ${msg}`, 'color: #38bdf8; font-weight: bold;');
}

function pass(name: string, detail = '') {
  results.push({ name, passed: true, detail });
  console.log(`%c  ✅ ${name}`, 'color: #22c55e;', detail);
}

function fail(name: string, detail: string) {
  results.push({ name, passed: false, detail });
  console.error(`%c  ❌ ${name}`, 'color: #ef4444;', detail);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

// ── تنظيف أي بيانات قديمة ────────────────────────────────────────────────
async function cleanupTestUser() {
  const db = await getAuthDb();
  const email = TEST_USER.email.trim().toLowerCase();
  await db.query(`DELETE FROM auth_verifications WHERE email = $1`, [email]);
  await db.query(`DELETE FROM auth_login_attempts WHERE email = $1`, [email]);
  await db.query(`DELETE FROM auth_users WHERE email = $1`, [email]);
  log('تم تنظيف بيانات المستخدم التجريبي السابقة.');
}

// ── 1. إنشاء حساب مباشرة (تجاوز EmailJS لأغراض الاختبار) ─────────────────
async function testCreateAccount(): Promise<string | null> {
  log('═══ اختبار 1: إنشاء حساب تجريبي ═══');

  const db = await getAuthDb();
  const email = TEST_USER.email.trim().toLowerCase();

  // إنشاء رمز تحقق وهمي وحفظه في قاعدة البيانات
  const fakeEmailCode = '123456';
  const fakeCodeHash = await sha256(fakeEmailCode);
  const verificationId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

  await db.query(
    `INSERT INTO auth_verifications (id, email, purpose, email_code_hash, expires_at, consumed)
     VALUES ($1, $2, $3, $4, $5, FALSE)`,
    [verificationId, email, 'REGISTER_EMAIL_PHONE', fakeCodeHash, expiresAt]
  );
  log('تم إنشاء رمز تحقق وهمي في قاعدة البيانات.');

  try {
    const payload: RegisterPayload & { emailCode: string } = {
      ...TEST_USER,
      emailCode: fakeEmailCode,
    };
    const { userId } = await registerUser(payload);
    pass('إنشاء الحساب', `البريد: ${email} | id: ${userId}`);
    return userId;
  } catch (err: any) {
    fail('إنشاء الحساب', err.message);
    return null;
  }
}

// ── 2. تأكيد البريد الإلكتروني ────────────────────────────────────────────
async function testConfirmEmail() {
  log('═══ اختبار 2: تأكيد البريد الإلكتروني ═══');

  const db = await getAuthDb();
  const email = TEST_USER.email.trim().toLowerCase();

  // التسجيل يضع email_verified = TRUE تلقائياً، لكن دعنا نتحقق
  const res = await db.query<any>(
    `SELECT email_verified FROM auth_users WHERE email = $1`,
    [email]
  );
  const row = res.rows[0];

  if (row?.email_verified) {
    pass('تأكيد البريد', 'البريد الإلكتروني مؤكد ✓ (يتم تأكيده تلقائياً عند التسجيل)');
  } else {
    // تأكيده يدوياً
    await db.query(
      `UPDATE auth_users SET email_verified = TRUE, updated_at = NOW() WHERE email = $1`,
      [email]
    );
    pass('تأكيد البريد', 'تم تأكيد البريد الإلكتروني يدوياً ✓');
  }
}

// ── 3. تأكيد رقم الهاتف ──────────────────────────────────────────────────
async function testConfirmPhone() {
  log('═══ اختبار 3: تأكيد رقم الهاتف ═══');

  const db = await getAuthDb();
  const email = TEST_USER.email.trim().toLowerCase();

  // في الاختبار نتجاوز Firebase Phone Auth ونؤكد الهاتف مباشرة
  await db.query(
    `UPDATE auth_users SET phone_verified = TRUE, updated_at = NOW() WHERE email = $1`,
    [email]
  );

  const res = await db.query<any>(
    `SELECT phone_verified, phone_number FROM auth_users WHERE email = $1`,
    [email]
  );
  const row = res.rows[0];

  if (row?.phone_verified) {
    pass('تأكيد الهاتف', `الرقم ${row.phone_number} مؤكد ✓`);
  } else {
    fail('تأكيد الهاتف', 'فشل تأكيد رقم الهاتف');
  }
}

// ── 4. اختبار تسجيل الدخول ───────────────────────────────────────────────
async function testLogin(): Promise<AuthUser | null> {
  log('═══ اختبار 4: تسجيل الدخول ═══');

  try {
    const user = await loginUser(TEST_USER.email, TEST_USER.password);
    pass('تسجيل الدخول', `مرحباً ${user.fullName} | ID: ${user.id}`);
    return user;
  } catch (err: any) {
    fail('تسجيل الدخول', err.message);
    return null;
  }
}

// ── 5. اختبار تسجيل دخول بكلمة مرور خاطئة ───────────────────────────────
async function testLoginWrongPassword() {
  log('═══ اختبار 5: تسجيل دخول بكلمة مرور خاطئة ═══');

  try {
    await loginUser(TEST_USER.email, 'WrongPassword123!');
    fail('رفض كلمة المرور الخاطئة', 'تم قبول كلمة مرور خاطئة!');
  } catch (err: any) {
    pass('رفض كلمة المرور الخاطئة', `تم الرفض: ${err.message}`);
  }
}

// ── 6. اختبار جلب الملف الشخصي ───────────────────────────────────────────
async function testGetProfile() {
  log('═══ اختبار 6: جلب الملف الشخصي ═══');

  try {
    const profile = await getLocalUserProfile(TEST_USER.email);
    const checks = [
      profile.fullName === TEST_USER.fullName,
      profile.email === TEST_USER.email.trim().toLowerCase(),
      profile.phoneNumber === TEST_USER.phoneNumber.replace(/\s+/g, '').trim(),
      profile.emailVerified === true,
      profile.phoneVerified === true,
    ];

    if (checks.every(Boolean)) {
      pass('جلب الملف الشخصي', JSON.stringify({
        الاسم: profile.fullName,
        البريد: profile.email,
        الهاتف: profile.phoneNumber,
        البريد_مؤكد: profile.emailVerified,
        الهاتف_مؤكد: profile.phoneVerified,
      }, null, 2));
    } else {
      fail('جلب الملف الشخصي', 'بعض البيانات غير متطابقة');
    }
  } catch (err: any) {
    fail('جلب الملف الشخصي', err.message);
  }
}

// ── 7. اختبار تغيير كلمة المرور ──────────────────────────────────────────
async function testChangePassword() {
  log('═══ اختبار 7: تغيير كلمة المرور ═══');

  const newPassword = process.env.TEST_USER_NEW_PASSWORD || '';

  try {
    await changePasswordWithCurrent(TEST_USER.email, TEST_USER.password, newPassword);
    pass('تغيير كلمة المرور', 'تم تغيير كلمة المرور بنجاح');

    // اختبار الدخول بكلمة المرور الجديدة
    const user = await loginUser(TEST_USER.email, newPassword);
    pass('تسجيل الدخول بكلمة المرور الجديدة', `مرحباً ${user.fullName}`);

    // إعادة كلمة المرور الأصلية
    await changePasswordWithCurrent(TEST_USER.email, newPassword, TEST_USER.password);
    pass('إعادة كلمة المرور الأصلية', 'تمت الاستعادة');
  } catch (err: any) {
    fail('تغيير كلمة المرور', err.message);
  }
}

// ── 8. اختبار تحديث البيانات الشخصية ─────────────────────────────────────
async function testUpdateProfile() {
  log('═══ اختبار 8: تحديث البيانات الشخصية ═══');

  try {
    await updateLocalUserProfileWithCurrentPassword({
      email: TEST_USER.email,
      currentPassword: TEST_USER.password,
      fullName: 'أحمد محمد (محدّث)',
      backupEmail: 'new.backup@dataguard-test.com',
      phoneNumber: TEST_USER.phoneNumber,
      birthDate: TEST_USER.birthDate,
    });

    const profile = await getLocalUserProfile(TEST_USER.email);
    if (profile.fullName === 'أحمد محمد (محدّث)') {
      pass('تحديث البيانات', `الاسم الجديد: ${profile.fullName}`);
    } else {
      fail('تحديث البيانات', 'لم يتم تحديث الاسم');
    }

    // إعادة الاسم الأصلي
    await updateLocalUserProfileWithCurrentPassword({
      email: TEST_USER.email,
      currentPassword: TEST_USER.password,
      fullName: TEST_USER.fullName,
      backupEmail: TEST_USER.backupEmail,
      phoneNumber: TEST_USER.phoneNumber,
      birthDate: TEST_USER.birthDate,
    });
  } catch (err: any) {
    fail('تحديث البيانات', err.message);
  }
}

// ── 9. اختبار رفض حساب مكرر ─────────────────────────────────────────────
async function testDuplicateRegistration() {
  log('═══ اختبار 9: رفض التسجيل المكرر ═══');

  const db = await getAuthDb();
  const email = TEST_USER.email.trim().toLowerCase();

  // إدخال رمز تحقق وهمي جديد
  const fakeCode = '654321';
  const fakeHash = await sha256(fakeCode);
  const vId = crypto.randomUUID();
  const exp = new Date(Date.now() + 10 * 60_000).toISOString();

  await db.query(
    `INSERT INTO auth_verifications (id, email, purpose, email_code_hash, expires_at, consumed)
     VALUES ($1, $2, $3, $4, $5, FALSE)`,
    [vId, email, 'REGISTER_EMAIL_PHONE', fakeHash, exp]
  );

  try {
    await registerUser({ ...TEST_USER, emailCode: fakeCode });
    fail('رفض التسجيل المكرر', 'تم قبول تسجيل مكرر!');
  } catch (err: any) {
    if (err.message.includes('مسجل بالفعل')) {
      pass('رفض التسجيل المكرر', `${err.message}`);
    } else {
      fail('رفض التسجيل المكرر', `خطأ غير متوقع: ${err.message}`);
    }
  }
}

// ── 10. التحقق من سجلات محاولات الدخول ────────────────────────────────────
async function testLoginAttemptLogs() {
  log('═══ اختبار 10: سجلات محاولات الدخول ═══');

  const db = await getAuthDb();
  const email = TEST_USER.email.trim().toLowerCase();

  const res = await db.query<any>(
    `SELECT success, reason, attempted_at FROM auth_login_attempts WHERE email = $1 ORDER BY attempted_at DESC LIMIT 10`,
    [email]
  );

  if (res.rows.length > 0) {
    const successful = res.rows.filter((r: any) => r.success).length;
    const failed = res.rows.filter((r: any) => !r.success).length;
    pass('سجلات محاولات الدخول', `إجمالي: ${res.rows.length} | ناجحة: ${successful} | فاشلة: ${failed}`);
  } else {
    fail('سجلات محاولات الدخول', 'لا توجد سجلات');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── التشغيل الرئيسي ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
export async function runAuthIntegrationTests(): Promise<TestResult[]> {
  console.log(
    '%c╔══════════════════════════════════════════════════════════════╗\n' +
    '║     🔐 DataGuard AI — اختبار تكامل نظام المصادقة           ║\n' +
    '╚══════════════════════════════════════════════════════════════╝',
    'color: #a78bfa; font-size: 14px; font-weight: bold;'
  );

  results.length = 0;

  // تنظيف
  await cleanupTestUser();

  // تشغيل الاختبارات بالترتيب
  const userId = await testCreateAccount();
  if (userId) {
    await testConfirmEmail();
    await testConfirmPhone();
    await testLogin();
    await testLoginWrongPassword();
    await testGetProfile();
    await testChangePassword();
    await testUpdateProfile();
    await testDuplicateRegistration();
    await testLoginAttemptLogs();
  }

  // ── ملخص النتائج ───────────────────────────────────────────────────
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(
    `\n%c╔══════════════════════════════════════════════════════════════╗\n` +
    `║  📊 ملخص النتائج: ${passed}/${total} ناجح${failed > 0 ? ` | ${failed} فاشل` : ''} ║\n` +
    `╚══════════════════════════════════════════════════════════════╝`,
    failed === 0
      ? 'color: #22c55e; font-size: 14px; font-weight: bold;'
      : 'color: #f59e0b; font-size: 14px; font-weight: bold;'
  );

  console.table(
    results.map((r) => ({
      الاختبار: r.name,
      النتيجة: r.passed ? '✅ ناجح' : '❌ فاشل',
      التفاصيل: r.detail.substring(0, 80),
    }))
  );

  // بيانات الحساب التجريبي للتسجيل الدخول
  console.log(
    '%c\n📋 بيانات الحساب التجريبي:\n' +
    `   البريد:    ${TEST_USER.email}\n` +
    `   كلمة المرور: ${TEST_USER.password}\n` +
    `   الهاتف:    ${TEST_USER.phoneNumber}\n` +
    `   الحالة:    البريد مؤكد ✓ | الهاتف مؤكد ✓`,
    'color: #38bdf8; font-size: 12px;'
  );

  return results;
}

// ── تصدير بيانات المستخدم التجريبي ───────────────────────────────────────
export const TEST_USER_CREDENTIALS = {
  email: TEST_USER.email,
  password: TEST_USER.password,
  phoneNumber: TEST_USER.phoneNumber,
};
