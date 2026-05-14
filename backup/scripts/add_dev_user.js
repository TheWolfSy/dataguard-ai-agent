// سكريبت إضافة مستخدم تطويري مباشرة إلى قاعدة بيانات auth_users
// للاستخدام في بيئة التطوير فقط!
// يتطلب المتغيرات البيئية التالية:
//   VITE_DEV_BYPASS_EMAIL
//   VITE_DEV_BYPASS_PASSWORD
import { getAuthDb } from '../src/authDatabase';
import crypto from 'crypto';
import { sha256 } from '../src/services/authService';

async function addDevUser() {
  const email = import.meta.env.VITE_DEV_BYPASS_EMAIL;
  const password = import.meta.env.VITE_DEV_BYPASS_PASSWORD;

  if (!email || !password) {
    console.error('خطأ: يجب تعيين VITE_DEV_BYPASS_EMAIL و VITE_DEV_BYPASS_PASSWORD في ملف .env');
    console.error('مثال:');
    console.error('  VITE_DEV_BYPASS_EMAIL=dev@example.com');
    console.error('  VITE_DEV_BYPASS_PASSWORD=your_secure_password');
    process.exit(1);
  }

  const fullName = 'Dev User';
  const backupEmail = 'dev.backup@dataguard.local';
  const birthDate = '1990-01-01';
  const salt = crypto.randomUUID();
  const passwordHash = await sha256(`${salt}:${password}`);
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();

  const q1 = 'dev-q1';
  const a1 = 'dev-a1';
  const q2 = 'dev-q2';
  const a2 = 'dev-a2';
  const q3 = 'dev-q3';
  const a3 = 'dev-a3';

  const db = await getAuthDb();
  await db.query(
    `INSERT INTO auth_users (
      id, full_name, email, backup_email, birth_date,
      password_hash, password_salt, email_verified,
      q1, q1_answer_hash, q2, q2_answer_hash, q3, q3_answer_hash,
      last_activity_at, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, TRUE,
      $8, $9, $10, $11, $12, $13,
      $14, $14, $14
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
      now
    ]
  );
  console.log('تمت إ��افة المستخدم التطويري بنجاح!');
  console.log(`البريد: ${email}`);
}

addDevUser().catch(console.error);