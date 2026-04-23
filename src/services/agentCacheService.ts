/**
 * agentCacheService.ts
 * -----------------------------------------------------------------
 * Redis-style local KV cache for agent/chat responses.
 * Backed by PGlite (IndexedDB) so data persists across page reloads.
 *
 * Cache flow:
 *   1. normalise question  →  SHA-like key (trim + lowercase + collapse spaces)
 *   2. SELECT from agent_response_cache WHERE question_key = ?
 *      - HIT  → return cached answer, increment hit_count
 *      - MISS → call API, DELETE any stale entry, INSERT new entry, return answer
 * -----------------------------------------------------------------
 */

async function getDbLazy() {
  const mod = await import('../database');
  return mod.getDb();
}

// ------------------------------------------------------------------ types
export interface CacheEntry {
  questionKey: string;
  questionRaw: string;
  answer: string;
  providerId: string;
  createdAt: Date;
  hitCount: number;
}

// ------------------------------------------------------------------ helpers
function normalizeKey(question: string): string {
  return question.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ------------------------------------------------------------------ init
/**
 * Called once at app startup — ensures the cache table exists.
 * Safe to call multiple times (uses CREATE TABLE IF NOT EXISTS).
 */
export async function initAgentCache(): Promise<void> {
  const db = await getDbLazy();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS agent_response_cache (
      question_key  TEXT PRIMARY KEY,
      question_raw  TEXT NOT NULL,
      answer        TEXT NOT NULL,
      provider_id   TEXT NOT NULL DEFAULT 'unknown',
      hit_count     INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

// ------------------------------------------------------------------ read
/**
 * Look up a cached answer.
 * Returns the entry and increments hit_count, or null on miss.
 */
export async function getCachedResponse(question: string): Promise<{
  answer: string;
  providerId: string;
  fromCache: true;
} | null> {
  const db = await getDbLazy();
  const key = normalizeKey(question);

  const result = await db.query<{
    answer: string;
    provider_id: string;
  }>(
    `SELECT answer, provider_id FROM agent_response_cache WHERE question_key = $1 LIMIT 1`,
    [key]
  );

  if (result.rows.length === 0) return null;

  // Increment hit counter (fire-and-forget, no await needed for UX)
  db.query(
    `UPDATE agent_response_cache SET hit_count = hit_count + 1 WHERE question_key = $1`,
    [key]
  ).catch(() => {/* ignore */});

  return {
    answer: result.rows[0].answer,
    providerId: result.rows[0].provider_id,
    fromCache: true,
  };
}

// ------------------------------------------------------------------ write
/**
 * Store a new answer.
 * Deletes any existing entry with the same normalised key first,
 * guaranteeing exactly one copy per unique question.
 */
export async function setCachedResponse(
  question: string,
  answer: string,
  providerId: string
): Promise<void> {
  const db = await getDbLazy();
  const key = normalizeKey(question);

  // Remove stale duplicate (Redis SET semantics)
  await db.query(
    `DELETE FROM agent_response_cache WHERE question_key = $1`,
    [key]
  );

  await db.query(
    `INSERT INTO agent_response_cache
       (question_key, question_raw, answer, provider_id)
     VALUES ($1, $2, $3, $4)`,
    [key, question.trim(), answer, providerId]
  );
}

// ------------------------------------------------------------------ list (optional – for admin/debug)
export async function getAllCacheEntries(): Promise<CacheEntry[]> {
  const db = await getDbLazy();
  const result = await db.query<{
    question_key: string;
    question_raw: string;
    answer: string;
    provider_id: string;
    created_at: string;
    hit_count: number;
  }>(
    `SELECT question_key, question_raw, answer, provider_id, created_at, hit_count
       FROM agent_response_cache
      ORDER BY hit_count DESC, created_at DESC`
  );

  return result.rows.map((r) => ({
    questionKey: r.question_key,
    questionRaw: r.question_raw,
    answer: r.answer,
    providerId: r.provider_id,
    createdAt: new Date(r.created_at),
    hitCount: r.hit_count,
  }));
}

// ------------------------------------------------------------------ evict
export async function deleteCacheEntry(question: string): Promise<void> {
  const db = await getDbLazy();
  await db.query(
    `DELETE FROM agent_response_cache WHERE question_key = $1`,
    [normalizeKey(question)]
  );
}

export async function clearAllCache(): Promise<void> {
  const db = await getDbLazy();
  await db.query(`DELETE FROM agent_response_cache`);
}
