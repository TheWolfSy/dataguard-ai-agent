import { PGlite } from '@electric-sql/pglite';

let _authDb: PGlite | null = null;

export async function getAuthDb(): Promise<PGlite> {
  if (_authDb) return _authDb;

  // Dedicated local auth database per installed device.
  _authDb = new PGlite('idb://dataguard-auth-db');

  await _authDb.exec(`
    CREATE TABLE IF NOT EXISTS auth_master_accounts (
      id                       TEXT PRIMARY KEY,
      username_hash            TEXT NOT NULL UNIQUE,
      password_hash            TEXT NOT NULL,
      security_answer_hash     TEXT NOT NULL,
      enabled                  BOOLEAN NOT NULL DEFAULT TRUE,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS auth_users (
      id                       TEXT PRIMARY KEY,
      full_name                TEXT NOT NULL,
      email                    TEXT NOT NULL UNIQUE,
      backup_email             TEXT NOT NULL,
      -- تمت إزالة phone_number حفاظاً على الخصوصية
      birth_date               DATE NOT NULL,
      avatar_data_url          TEXT,
      password_hash            TEXT NOT NULL,
      password_salt            TEXT NOT NULL,
      email_verified           BOOLEAN NOT NULL DEFAULT FALSE,
      -- تمت إزالة phone_verified حفاظاً على الخصوصية
      q1                       TEXT NOT NULL,
      q1_answer_hash           TEXT NOT NULL,
      q2                       TEXT NOT NULL,
      q2_answer_hash           TEXT NOT NULL,
      q3                       TEXT NOT NULL,
      q3_answer_hash           TEXT NOT NULL,
      last_activity_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      inactivity_deleted_at    TIMESTAMPTZ,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS auth_verifications (
      id                       TEXT PRIMARY KEY,
      email                    TEXT NOT NULL,
      -- تمت إزالة phone_number حفاظاً على الخصوصية
      purpose                  TEXT NOT NULL,
      email_code_hash          TEXT,
      -- تمت إزالة phone_otp_hash حفاظاً على الخصوصية
      expires_at               TIMESTAMPTZ NOT NULL,
      consumed                 BOOLEAN NOT NULL DEFAULT FALSE,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS auth_login_attempts (
      id                       TEXT PRIMARY KEY,
      email                    TEXT NOT NULL,
      ip                       TEXT,
      success                  BOOLEAN NOT NULL,
      reason                   TEXT,
      attempted_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
    CREATE INDEX IF NOT EXISTS idx_auth_verifications_email ON auth_verifications(email);
    CREATE INDEX IF NOT EXISTS idx_auth_verifications_purpose ON auth_verifications(purpose);

    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS avatar_data_url TEXT;
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS inactivity_deleted_at TIMESTAMPTZ;

    ALTER TABLE auth_master_accounts ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
  `);

  await migrateRemovePhoneColumns(_authDb);
  await migrateLoginAttempts(_authDb);

  return _authDb;
}

async function migrateLoginAttempts(db: PGlite) {
  try {
    await db.query(`ALTER TABLE auth_login_attempts ADD COLUMN IF NOT EXISTS ip TEXT`);
    console.log('[AuthDB] Migration: added ip column to auth_login_attempts');
  } catch (e) {
    console.log('[AuthDB] Migration: ip column already exists or table error');
  }
}

async function migrateRemovePhoneColumns(db: PGlite) {
  try {
    await db.query(`ALTER TABLE auth_users DROP COLUMN IF EXISTS phone_number`);
    await db.query(`ALTER TABLE auth_users DROP COLUMN IF EXISTS phone_verified`);
    await db.query(`ALTER TABLE auth_verifications DROP COLUMN IF EXISTS phone_number`);
    await db.query(`ALTER TABLE auth_verifications DROP COLUMN IF EXISTS phone_otp_hash`);
    console.log('[AuthDB] Migration: removed phone columns');
  } catch (e) {
    console.log('[AuthDB] Migration: phone columns already removed or not exist');
  }
}
