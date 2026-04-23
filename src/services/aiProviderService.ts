/**
 * aiProviderService — dedicated service that manages AI provider configurations
 * (API keys + active provider selection) in the PGlite `ai_provider_configs` table.
 *
 * Architecture:
 *  - DB is the source of truth (persisted in IndexedDB via PGlite).
 *  - An in-memory cache is populated at boot via `initProviderCache()`.
 *  - Synchronous getters (getCachedApiKey / getCachedActiveProvider) read
 *    from the cache so that LLM client factories stay synchronous.
 *  - All write operations update both the DB and the cache atomically.
 */

import type { LlmProviderId } from './llmClient';
import { dbEncrypt, dbDecryptSafe } from './dbCrypto';

async function getDbLazy() {
  const mod = await import('../database');
  return mod.getDb();
}

// ---------- All known provider IDs ----------
const ALL_PROVIDER_IDS: LlmProviderId[] = [
  'rule-based-local',
  'google-genai',
  'openai',
  'blackbox',
  'claude',
  'deepseek',
  'qwen',
  'ollama-local',
];

// ---------- In-memory cache ----------
const _keyCache = new Map<LlmProviderId, string>();
let _activeProvider: LlmProviderId = 'rule-based-local';
let _initialized = false;

// ---------- Boot: load all configs from DB into cache ----------

/**
 * Must be called once at app startup (before any synchronous key reads).
 * Reads all rows from `ai_provider_configs`, populates the in-memory cache,
 * and migrates any legacy keys found in localStorage into the DB.
 */
export async function initProviderCache(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  try {
    const db = await getDbLazy();

    // Ensure rows exist for every known provider (upsert defaults)
    for (const id of ALL_PROVIDER_IDS) {
      await db.query(
        `INSERT INTO ai_provider_configs (provider_id, api_key_enc, is_active, updated_at)
         VALUES ($1, '', FALSE, NOW())
         ON CONFLICT (provider_id) DO NOTHING`,
        [id],
      );
    }

    // Migrate legacy localStorage keys (one-time migration)
    const LEGACY_PREFIX = 'dataguard.ai.apiKey.';
    const LEGACY_ACTIVE_KEY = 'dataguard.agent.llmProvider';
    let migratedCount = 0;

    for (const id of ALL_PROVIDER_IDS) {
      const legacyKey = localStorage.getItem(LEGACY_PREFIX + id);
      if (legacyKey && legacyKey.trim().length > 0) {
        const encrypted = await dbEncrypt(legacyKey.trim());
        await db.query(
          `UPDATE ai_provider_configs
           SET api_key_enc = $1, updated_at = NOW()
           WHERE provider_id = $2`,
          [encrypted, id],
        );
        localStorage.removeItem(LEGACY_PREFIX + id);
        migratedCount++;
      }
    }

    // Migrate legacy active-provider selection
    const legacyActive = localStorage.getItem(LEGACY_ACTIVE_KEY) as LlmProviderId | null;
    if (legacyActive && ALL_PROVIDER_IDS.includes(legacyActive)) {
      await db.query(
        `UPDATE ai_provider_configs SET is_active = FALSE, updated_at = NOW()`,
      );
      await db.query(
        `UPDATE ai_provider_configs SET is_active = TRUE, updated_at = NOW()
         WHERE provider_id = $1`,
        [legacyActive],
      );
      localStorage.removeItem(LEGACY_ACTIVE_KEY);
      migratedCount++;
    }

    if (migratedCount > 0) {
      console.info(`[aiProviderService] Migrated ${migratedCount} legacy localStorage entries to DB.`);
    }

    // Load all rows into cache
    const result = await db.query<{
      provider_id: string;
      api_key_enc: string;
      is_active: boolean;
    }>(`SELECT provider_id, api_key_enc, is_active FROM ai_provider_configs`);

    _keyCache.clear();
    let foundActive: LlmProviderId | null = null;

    for (const row of result.rows) {
      const id = row.provider_id as LlmProviderId;
      if (row.api_key_enc && row.api_key_enc.trim().length > 0) {
        // Decrypt the stored key (falls back to plaintext for legacy unencrypted rows)
        const plainKey = await dbDecryptSafe(row.api_key_enc.trim());
        _keyCache.set(id, plainKey);
      }
      if (row.is_active) {
        foundActive = id;
      }
    }

    if (foundActive) {
      _activeProvider = foundActive;
    }
  } catch (err) {
    console.error('[aiProviderService] initProviderCache failed:', err);
    // Graceful degradation: cache stays empty, default provider used
  }
}

// ---------- Synchronous cache readers (safe after initProviderCache resolves) ----------

/** Returns the stored API key for a provider, or null if not set. */
export function getCachedApiKey(providerId: string): string | null {
  const key = _keyCache.get(providerId as LlmProviderId);
  return key && key.trim().length > 0 ? key : null;
}

/** Returns the currently selected active LLM provider ID. */
export function getCachedActiveProvider(): LlmProviderId {
  return _activeProvider;
}

/** Returns true if an API key is cached for the provider. */
export function hasProviderKey(providerId: LlmProviderId): boolean {
  return (_keyCache.get(providerId) ?? '').trim().length > 0;
}

/** Returns a Record of providerId → isConnected (true if key is stored or no key required). */
export function getAllProviderConnectedStates(): Partial<Record<LlmProviderId, boolean>> {
  const result: Partial<Record<LlmProviderId, boolean>> = {};
  for (const id of ALL_PROVIDER_IDS) {
    result[id] = hasProviderKey(id);
  }
  // rule-based-local never requires a key
  result['rule-based-local'] = true;
  return result;
}

// ---------- Async writers (update DB + cache) ----------

/**
 * Saves an API key for a provider in the DB and updates the in-memory cache.
 * Passing an empty string removes the key.
 */
export async function saveProviderKey(
  providerId: LlmProviderId,
  apiKey: string,
): Promise<void> {
  const trimmed = apiKey.trim();
  try {
    const db = await getDbLazy();
    // Encrypt the key before persisting; cache stores plaintext for in-memory use
    const toStore = trimmed.length > 0 ? await dbEncrypt(trimmed) : '';
    await db.query(
      `INSERT INTO ai_provider_configs (provider_id, api_key_enc, is_active, updated_at)
       VALUES ($1, $2, FALSE, NOW())
       ON CONFLICT (provider_id) DO UPDATE
         SET api_key_enc = EXCLUDED.api_key_enc,
             updated_at  = NOW()`,
      [providerId, toStore],
    );
    if (trimmed.length > 0) {
      _keyCache.set(providerId, trimmed); // cache the plaintext key
    } else {
      _keyCache.delete(providerId);
    }
  } catch (err) {
    console.error('[aiProviderService] saveProviderKey failed:', err);
    throw err;
  }
}

/** Clears the stored API key for a provider. */
export async function removeProviderKey(providerId: LlmProviderId): Promise<void> {
  try {
    const db = await getDbLazy();
    await db.query(
      `UPDATE ai_provider_configs
       SET api_key_enc = '', updated_at = NOW()
       WHERE provider_id = $1`,
      [providerId],
    );
    _keyCache.delete(providerId);
  } catch (err) {
    console.error('[aiProviderService] removeProviderKey failed:', err);
    throw err;
  }
}

/**
 * Sets the active provider in the DB (sets all others to inactive)
 * and updates the in-memory cache.
 */
export async function setActiveProvider(providerId: LlmProviderId): Promise<void> {
  try {
    const db = await getDbLazy();
    // Clear all active flags then set the selected one
    await db.query(
      `UPDATE ai_provider_configs SET is_active = FALSE, updated_at = NOW()`,
    );
    await db.query(
      `INSERT INTO ai_provider_configs (provider_id, api_key_enc, is_active, updated_at)
       VALUES ($1, '', TRUE, NOW())
       ON CONFLICT (provider_id) DO UPDATE
         SET is_active  = TRUE,
             updated_at = NOW()`,
      [providerId],
    );
    _activeProvider = providerId;
  } catch (err) {
    console.error('[aiProviderService] setActiveProvider failed:', err);
    throw err;
  }
}

export async function getActiveProviderConfig(): Promise<{ providerId: LlmProviderId; apiKey: string | null } | null> {
  const providerId = getCachedActiveProvider();
  if (!providerId || providerId === 'rule-based-local') {
    return null;
  }
  const apiKey = getCachedApiKey(providerId);
  return { providerId, apiKey };
}
