import { PGlite } from '@electric-sql/pglite';

let _db: PGlite | null = null;
let _initPromise: Promise<PGlite> | null = null;

// Timeout wrapper — يمنع التعليق اللانهائي إذا فشل WASM في التحميل (مثل InfinityFree)
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export async function getDb(): Promise<PGlite> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
  // Persist database in IndexedDB so data survives page refreshes
  const db = new PGlite('idb://dataguard-db');
  await withTimeout(db.waitReady, 30_000, 'PGlite init');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      uid         TEXT PRIMARY KEY,
      email       TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'Read-Only User',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS data_logs (
      id                TEXT PRIMARY KEY,
      uid               TEXT NOT NULL,
      content           TEXT NOT NULL,
      classification    TEXT NOT NULL,
      pii_detected      BOOLEAN NOT NULL DEFAULT FALSE,
      pii_details       TEXT NOT NULL DEFAULT '',
      protection_status TEXT NOT NULL DEFAULT 'Unprotected',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id            TEXT PRIMARY KEY,
      uid           TEXT NOT NULL,
      user_email    TEXT NOT NULL,
      operation     TEXT NOT NULL,
      resource_path TEXT NOT NULL,
      details       TEXT NOT NULL DEFAULT '',
      target_path   TEXT,
      target_type   TEXT,
      test_round    INTEGER,
      previous_hash TEXT,
      current_hash  TEXT,
      change_status TEXT,
      timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS security_policies (
      id          TEXT PRIMARY KEY,
      uid         TEXT NOT NULL,
      name        TEXT NOT NULL,
      rules       TEXT NOT NULL,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS policy_rule_references (
      id                       TEXT PRIMARY KEY,
      policy_id                TEXT NOT NULL,
      uid                      TEXT NOT NULL,
      source_url               TEXT NOT NULL,
      rules_json               TEXT NOT NULL,
      encrypted_rules_json     TEXT NOT NULL,
      transport_encryption     TEXT NOT NULL DEFAULT 'TLS_REQUIRED+AES256_CACHE',
      reference_mode           TEXT NOT NULL DEFAULT 'remote-json',
      integrity_hash           TEXT NOT NULL,
      sync_status              TEXT NOT NULL DEFAULT 'synced',
      sync_interval_hours      INTEGER NOT NULL DEFAULT 24,
      is_default_source        BOOLEAN NOT NULL DEFAULT FALSE,
      last_synced_at           TIMESTAMPTZ,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS file_system_references (
      id                       TEXT PRIMARY KEY,
      uid                      TEXT NOT NULL,
      directory_name           TEXT NOT NULL,
      directory_path           TEXT NOT NULL,
      scan_interval_hours      INTEGER NOT NULL DEFAULT 24,
      is_active                BOOLEAN NOT NULL DEFAULT TRUE,
      last_scanned_at          TIMESTAMPTZ,
      total_files_scanned      INTEGER NOT NULL DEFAULT 0,
      threats_found            INTEGER NOT NULL DEFAULT 0,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_path TEXT;
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_type TEXT;
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS test_round INTEGER;
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS previous_hash TEXT;
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS current_hash TEXT;
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS change_status TEXT;
    ALTER TABLE security_policies ADD COLUMN IF NOT EXISTS rule_reference_id TEXT;
    ALTER TABLE security_policies ADD COLUMN IF NOT EXISTS source_url TEXT;
    ALTER TABLE security_policies ADD COLUMN IF NOT EXISTS transport_encryption TEXT NOT NULL DEFAULT 'TLS_REQUIRED+AES256_CACHE';
    ALTER TABLE security_policies ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
    ALTER TABLE security_policies ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'manual';
    ALTER TABLE policy_rule_references ADD COLUMN IF NOT EXISTS sync_interval_hours INTEGER NOT NULL DEFAULT 24;
    ALTER TABLE policy_rule_references ADD COLUMN IF NOT EXISTS is_default_source BOOLEAN NOT NULL DEFAULT FALSE;

    CREATE TABLE IF NOT EXISTS agent_response_cache (
      question_key  TEXT PRIMARY KEY,
      question_raw  TEXT NOT NULL,
      answer        TEXT NOT NULL,
      provider_id   TEXT NOT NULL DEFAULT 'unknown',
      hit_count     INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ai_provider_configs (
      provider_id   TEXT PRIMARY KEY,
      api_key_enc   TEXT NOT NULL DEFAULT '',
      is_active     BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS advanced_tools (
      tool_id          TEXT PRIMARY KEY,
      is_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
      config_json     TEXT NOT NULL DEFAULT '{}',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  _db = db;
  return _db;
  })();

  return _initPromise;
}
