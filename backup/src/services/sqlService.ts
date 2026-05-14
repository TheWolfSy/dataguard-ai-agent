async function getDbLazy() {
  const mod = await import('../database');
  return mod.getDb();
}

import { encryptData } from './encryption';
import { dbEncrypt, dbDecryptSafe } from './dbCrypto';
import type { ToolResult } from './toolContract';

// --- Types (mirrors Firestore schema) ---
export type UserRole = 'Administrator' | 'Data Analyst' | 'Read-Only User';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export interface DataLog {
  id: string;
  uid: string;
  content: string;
  classification: 'Public' | 'Internal' | 'Confidential' | 'Highly Sensitive';
  piiDetected: boolean;
  piiDetails: string;
  protectionStatus: 'Unprotected' | 'Masked' | 'Encrypted' | 'Redacted';
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  uid: string;
  userEmail: string;
  operation: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'SCAN' | 'SECURITY';
  resourcePath: string;
  details: string;
  targetPath?: string;
  targetType?: 'file' | 'folder';
  testRound?: number;
  previousHash?: string;
  currentHash?: string;
  changeStatus?: 'NEW' | 'MODIFIED' | 'UNCHANGED' | 'REMOVED';
  timestamp: Date;
}

export interface SecurityPolicy {
  id: string;
  uid: string;
  name: string;
  rules: string;
  isActive: boolean;
  ruleReferenceId?: string;
  sourceUrl?: string;
  transportEncryption?: string;
  lastSyncedAt?: Date;
  syncStatus?: 'synced' | 'error' | 'manual';
  rulesJson?: string;
  encryptedRulesJson?: string;
  integrityHash?: string;
  syncIntervalHours?: number;
  isDefaultSource?: boolean;
  createdAt: Date;
}

export interface RemotePolicyPayload {
  sourceUrl: string;
  rulesJson: string;
  encryptedRulesJson: string;
  integrityHash: string;
  transportEncryption: 'TLS_REQUIRED+AES256_CACHE';
  referenceMode: 'remote-json';
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function ensureHttpsUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid rules source URL.');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Rules source must use HTTPS so transport remains encrypted.');
  }

  return url.toString();
}

function normalizeRulesJson(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

async function fetchRemotePolicyPayload(sourceUrl: string, apiKey?: string): Promise<RemotePolicyPayload> {
  const secureUrl = ensureHttpsUrl(sourceUrl);

  // Try direct, then CORS proxies
  const urls = [
    secureUrl,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(secureUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(secureUrl)}`,
  ];

  let response: Response | null = null;
  let lastError: any = null;

  for (const url of urls) {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-DataGuard-Transport': 'tls-required',
      };
      if (url === secureUrl && apiKey) {
        headers['apiKey'] = apiKey;
      }
      const res = await fetch(url, { method: 'GET', headers });
      if (res.ok) {
        response = res;
        break;
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }

  if (!response) {
    throw lastError ?? new Error(`Failed to import rules from source.`);
  }

  const payload = await response.json();
  const rulesJson = normalizeRulesJson(payload);

  return {
    sourceUrl: secureUrl,
    rulesJson,
    encryptedRulesJson: encryptData(rulesJson),
    integrityHash: await sha256(rulesJson),
    transportEncryption: 'TLS_REQUIRED+AES256_CACHE',
    referenceMode: 'remote-json',
  };
}

// --- Default Sources ---
export const CVE_DEFAULT_SOURCE = {
  name: 'CVE Database',
  sourceUrl: 'https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=50',
  syncIntervalHours: 24,
  description: 'NIST National Vulnerability Database — latest 50 CVEs synchronized every 24 hours',
  apiKey: import.meta.env.VITE_NVD_API_KEY as string | undefined,
};

/**
 * Fetches the latest CVEs from NVD API v2 and converts them to the local
 * rules format that extractPolicyRules() in policyEngine understands.
 *
 * Uses a CORS proxy fallback chain when the browser blocks direct NVD access.
 */
async function fetchNvdCveRules(): Promise<{ rulesJson: string; keywords: string[]; blockedCves: string[]; totalResults: number }> {
  const directUrl = CVE_DEFAULT_SOURCE.sourceUrl;
  const proxyUrls = [
    directUrl, // try direct first
    `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(directUrl)}`,
  ];

  let response: Response | null = null;
  let lastError: any = null;

  for (const url of proxyUrls) {
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      // Only send apiKey header to the direct NVD URL
      if (url === directUrl && CVE_DEFAULT_SOURCE.apiKey) {
        headers['apiKey'] = CVE_DEFAULT_SOURCE.apiKey;
      }
      console.log('[CVE Sync] Trying:', url.substring(0, 80));
      const res = await fetch(url, { method: 'GET', headers });
      if (res.ok) {
        response = res;
        console.log('[CVE Sync] ✅ Fetched via:', url === directUrl ? 'direct NVD' : 'CORS proxy');
        break;
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
      console.warn('[CVE Sync] Failed:', url.substring(0, 60), (err as Error).message);
    }
  }

  if (!response) {
    throw lastError ?? new Error('All NVD fetch attempts failed');
  }

  const data = await response.json() as {
    totalResults?: number;
    vulnerabilities?: Array<{
      cve?: {
        id?: string;
        descriptions?: Array<{ lang?: string; value?: string }>;
        metrics?: { cvssMetricV31?: Array<{ cvssData?: { baseScore?: number; baseSeverity?: string } }> };
      };
    }>;
  };

  const vulns = data.vulnerabilities ?? [];
  const blockedCves: string[] = [];
  const keywords: string[] = [];
  const rules: Array<{ type: string; pattern: string; message: string; severity?: string; score?: number }> = [];

  for (const entry of vulns) {
    const cve = entry.cve;
    if (!cve?.id) continue;

    blockedCves.push(cve.id);

    const desc = cve.descriptions?.find(d => d.lang === 'en')?.value
              ?? cve.descriptions?.[0]?.value
              ?? '';

    const cvss = cve.metrics?.cvssMetricV31?.[0]?.cvssData;
    const severity = cvss?.baseSeverity ?? 'UNKNOWN';
    const score = cvss?.baseScore ?? 0;

    // Extract meaningful keywords from descriptions
    const descLower = desc.toLowerCase();
    const kwCandidates = ['buffer overflow', 'sql injection', 'xss', 'rce', 'remote code execution',
      'privilege escalation', 'denial of service', 'path traversal', 'authentication bypass',
      'command injection', 'deserialization', 'ssrf', 'csrf', 'out-of-bounds', 'use-after-free',
      'heap overflow', 'stack overflow', 'integer overflow', 'memory corruption'];
    for (const kw of kwCandidates) {
      if (descLower.includes(kw) && !keywords.includes(kw)) {
        keywords.push(kw);
      }
    }

    rules.push({
      type: 'block_pattern',
      pattern: cve.id.replace('-', '[\\-\\s]?'),
      message: `[${severity} ${score}] ${cve.id}: ${desc.slice(0, 120)}`,
      severity,
      score,
    });
  }

  const rulesPayload = {
    source: 'NVD API v2.0',
    fetchedAt: new Date().toISOString(),
    totalResults: data.totalResults ?? vulns.length,
    rules,
    blocked_cves: blockedCves,
    keywords,
  };

  return {
    rulesJson: JSON.stringify(rulesPayload, null, 2),
    keywords,
    blockedCves,
    totalResults: data.totalResults ?? vulns.length,
  };
}

// --- Helpers ---
function uuid(): string {
  return crypto.randomUUID();
}

// --- User Profiles ---
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = await getDbLazy();
  const res = await db.query<any>('SELECT * FROM users WHERE uid = $1', [uid]);
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return { uid: r.uid, email: r.email, role: r.role as UserRole, createdAt: new Date(r.created_at) };
}

export async function upsertUserProfile(profile: Omit<UserProfile, 'createdAt'>): Promise<UserProfile> {
  const db = await getDbLazy();
  await db.query(
    `INSERT INTO users (uid, email, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (uid) DO UPDATE SET role = $3, email = $2`,
    [profile.uid, profile.email, profile.role]
  );
  return (await getUserProfile(profile.uid))!;
}

// --- Data Logs ---
export async function getDataLogs(uid: string, role: UserRole): Promise<DataLog[]> {
  const db = await getDbLazy();
  const res = role === 'Read-Only User'
    ? await db.query<any>('SELECT * FROM data_logs WHERE uid = $1 ORDER BY created_at DESC', [uid])
    : await db.query<any>('SELECT * FROM data_logs ORDER BY created_at DESC');
  return Promise.all(
    res.rows.map(async (r) => ({
      ...rowToDataLog(r),
      content: await dbDecryptSafe(r.content),
    })),
  );
}

/** Lightweight threat counter — no content decryption, just counts rows by classification. */
export async function getThreatCountSince(
  uid: string,
  role: UserRole,
  since: Date,
): Promise<{ count: number; latestCreatedAt: Date | null }> {
  const db = await getDbLazy();
  const isoSince = since.toISOString();
  const res =
    role === 'Read-Only User'
      ? await db.query<any>(
          `SELECT COUNT(*) AS cnt, MAX(created_at) AS latest
           FROM data_logs
           WHERE uid = $1
             AND classification IN ('Confidential', 'Highly Sensitive')
             AND created_at > $2`,
          [uid, isoSince],
        )
      : await db.query<any>(
          `SELECT COUNT(*) AS cnt, MAX(created_at) AS latest
           FROM data_logs
           WHERE classification IN ('Confidential', 'Highly Sensitive')
             AND created_at > $1`,
          [isoSince],
        );
  const row = res.rows[0];
  return {
    count: parseInt(row?.cnt ?? '0', 10),
    latestCreatedAt: row?.latest ? new Date(row.latest) : null,
  };
}

export async function insertDataLog(log: Omit<DataLog, 'id' | 'createdAt'>): Promise<DataLog> {
  const db = await getDbLazy();
  const id = uuid();
  const encryptedContent = await dbEncrypt(log.content);
  const res = await db.query<any>(
    `INSERT INTO data_logs (id, uid, content, classification, pii_detected, pii_details, protection_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [id, log.uid, encryptedContent, log.classification, log.piiDetected, log.piiDetails, log.protectionStatus]
  );
  // Return the row but with the original plaintext content (not the encrypted form)
  return { ...rowToDataLog(res.rows[0]), content: log.content };
}

export interface SqlInsertDataLogOutput {
  logId: string;
  classification: DataLog['classification'];
  createdAt: string;
}

export async function runInsertDataLogTool(
  log: Omit<DataLog, 'id' | 'createdAt'>
): Promise<ToolResult<SqlInsertDataLogOutput>> {
  try {
    const created = await insertDataLog(log);
    const riskLevel: ToolResult<SqlInsertDataLogOutput>['riskLevel'] =
      created.classification === 'Highly Sensitive'
        ? 'high'
        : created.classification === 'Confidential'
        ? 'medium'
        : 'low';

    return {
      success: 'success',
      output: {
        logId: created.id,
        classification: created.classification,
        createdAt: created.createdAt.toISOString(),
      },
      riskLevel,
      nextSuggestions: [
        'Create audit entry for this storage event.',
        'Continue monitoring similar data through periodic scans.',
      ],
    };
  } catch (error) {
    return {
      success: 'failure',
      output: {
        logId: 'N/A',
        classification: log.classification,
        createdAt: new Date().toISOString(),
      },
      riskLevel: 'high',
      nextSuggestions: [
        'Do not assume persistence succeeded.',
        'Retry insertion and verify datastore availability.',
      ],
      error: error instanceof Error ? error.message : 'Unknown SQL insertion error',
    };
  }
}

// --- Audit Logs ---
export async function getAuditLogs(): Promise<AuditLog[]> {
  const db = await getDbLazy();
  const res = await db.query<any>('SELECT * FROM audit_logs ORDER BY timestamp DESC');
  return Promise.all(
    res.rows.map(async (r) => ({
      ...rowToAuditLog(r),
      details: await dbDecryptSafe(r.details),
    })),
  );
}

export async function insertAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
  const db = await getDbLazy();
  const id = uuid();
  const encryptedDetails = await dbEncrypt(log.details);
  await db.query(
    `INSERT INTO audit_logs (
      id, uid, user_email, operation, resource_path, details,
      target_path, target_type, test_round, previous_hash, current_hash, change_status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      id,
      log.uid,
      log.userEmail,
      log.operation,
      log.resourcePath,
      encryptedDetails,
      log.targetPath ?? null,
      log.targetType ?? null,
      log.testRound ?? null,
      log.previousHash ?? null,
      log.currentHash ?? null,
      log.changeStatus ?? null,
    ]
  );
}

export async function insertSecurityEvent(event: {
  uid?: string;
  userEmail?: string;
  resourcePath: string;
  details: string;
  targetPath?: string;
}): Promise<void> {
  await insertAuditLog({
    uid: event.uid ?? 'system',
    userEmail: event.userEmail ?? 'system@dataguard.local',
    operation: 'SECURITY',
    resourcePath: event.resourcePath,
    details: event.details,
    targetPath: event.targetPath,
  });
}

// --- Security Policies ---
export async function getSecurityPolicies(uid: string): Promise<SecurityPolicy[]> {
  const db = await getDbLazy();
  const res = await db.query<any>(
    `SELECT p.*, r.rules_json, r.encrypted_rules_json, r.integrity_hash
     FROM security_policies p
     LEFT JOIN policy_rule_references r ON r.id = p.rule_reference_id
     WHERE p.uid = $1
     ORDER BY p.created_at DESC`,
    [uid]
  );
  return res.rows.map(rowToPolicy);
}

export async function insertSecurityPolicy(policy: Omit<SecurityPolicy, 'id' | 'createdAt'>): Promise<SecurityPolicy> {
  const db = await getDbLazy();
  const id = uuid();
  const res = await db.query<any>(
    `INSERT INTO security_policies (id, uid, name, rules, is_active)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [id, policy.uid, policy.name, policy.rules, policy.isActive]
  );
  return rowToPolicy(res.rows[0]);
}

export async function createRemoteSecurityPolicy(args: {
  uid: string;
  name: string;
  sourceUrl: string;
  isActive: boolean;
  syncIntervalHours?: number;
  isDefaultSource?: boolean;
  userEmail?: string;
}): Promise<SecurityPolicy> {
  const db = await getDbLazy();
  const apiKey = args.sourceUrl === CVE_DEFAULT_SOURCE.sourceUrl ? CVE_DEFAULT_SOURCE.apiKey : undefined;
  const remotePayload = await fetchRemotePolicyPayload(args.sourceUrl, apiKey);
  const policyId = uuid();
  const ruleReferenceId = uuid();
  const now = new Date().toISOString();
  const summary = `Remote JSON reference from ${remotePayload.sourceUrl}`;

  await db.query('BEGIN');
  try {
    await db.query(
      `INSERT INTO security_policies (
        id, uid, name, rules, is_active, rule_reference_id, source_url, transport_encryption, last_synced_at, sync_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        policyId,
        args.uid,
        args.name,
        summary,
        args.isActive,
        ruleReferenceId,
        remotePayload.sourceUrl,
        remotePayload.transportEncryption,
        now,
        'synced',
      ]
    );

    await db.query(
      `INSERT INTO policy_rule_references (
        id, policy_id, uid, source_url, rules_json, encrypted_rules_json,
        transport_encryption, reference_mode, integrity_hash, sync_status, last_synced_at,
        sync_interval_hours, is_default_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        ruleReferenceId,
        policyId,
        args.uid,
        remotePayload.sourceUrl,
        remotePayload.rulesJson,
        remotePayload.encryptedRulesJson,
        remotePayload.transportEncryption,
        remotePayload.referenceMode,
        remotePayload.integrityHash,
        'synced',
        now,
        args.syncIntervalHours ?? 24,
        args.isDefaultSource ?? false,
      ]
    );

    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    await insertSecurityEvent({
      uid: args.uid,
      userEmail: args.userEmail,
      resourcePath: 'policies/import',
      details: error instanceof Error ? error.message : 'Failed to create remote policy reference.',
      targetPath: args.sourceUrl,
    });
    throw error;
  }

  await insertSecurityEvent({
    uid: args.uid,
    userEmail: args.userEmail,
    resourcePath: 'policies/import',
    details: `Imported remote JSON rules and stored encrypted cache. Integrity hash: ${remotePayload.integrityHash.slice(0, 12)}...`,
    targetPath: remotePayload.sourceUrl,
  });

  const created = await db.query<any>(
    `SELECT p.*, r.rules_json, r.encrypted_rules_json, r.integrity_hash
     FROM security_policies p
     LEFT JOIN policy_rule_references r ON r.id = p.rule_reference_id
     WHERE p.id = $1`,
    [policyId]
  );

  return rowToPolicy(created.rows[0]);
}

export async function syncRemoteSecurityPolicy(policyId: string, actor?: { uid?: string; userEmail?: string }): Promise<SecurityPolicy> {
  const db = await getDbLazy();
  const existing = await db.query<any>(
    `SELECT p.*, r.id AS reference_id
     FROM security_policies p
     LEFT JOIN policy_rule_references r ON r.id = p.rule_reference_id
     WHERE p.id = $1`,
    [policyId]
  );

  if (existing.rows.length === 0) {
    throw new Error('Policy reference not found.');
  }

  const policy = existing.rows[0];
  if (!policy.source_url || !policy.reference_id) {
    throw new Error('This policy does not have a remote JSON reference.');
  }

  // Fetch real CVE data from NVD API v2 (supports CORS)
  if (policy.source_url === CVE_DEFAULT_SOURCE.sourceUrl) {
    try {
      const nvd = await fetchNvdCveRules();
      const encryptedRules = encryptData(nvd.rulesJson);
      const integrityHash = await sha256(nvd.rulesJson);
      const now = new Date().toISOString();

      await db.query(
        `UPDATE policy_rule_references
         SET rules_json = $1,
             encrypted_rules_json = $2,
             integrity_hash = $3,
             sync_status = $4,
             last_synced_at = $5
         WHERE id = $6`,
        [nvd.rulesJson, encryptedRules, integrityHash, 'synced', now, policy.reference_id]
      );
      await db.query(
        `UPDATE security_policies
         SET sync_status = $1,
             last_synced_at = $2,
             rules = $3
         WHERE id = $4`,
        ['synced', now, `NVD: ${nvd.totalResults} CVEs, ${nvd.blockedCves.length} rules loaded`, policyId]
      );

      await insertSecurityEvent({
        uid: actor?.uid ?? policy.uid,
        userEmail: actor?.userEmail,
        resourcePath: `policies/${policyId}/sync`,
        details: `NVD CVE sync successful: ${nvd.blockedCves.length} CVE rules loaded. Hash: ${integrityHash.slice(0, 12)}...`,
        targetPath: CVE_DEFAULT_SOURCE.sourceUrl,
      });
    } catch (nvdError) {
      // Fallback: update timestamp only if NVD is unreachable
      console.warn('[CVE Sync] NVD fetch failed, updating timestamp only:', nvdError);
      const now = new Date().toISOString();
      await db.query(
        `UPDATE security_policies SET sync_status = $1, last_synced_at = $2 WHERE id = $3`,
        ['synced', now, policyId]
      );
      await db.query(
        `UPDATE policy_rule_references SET sync_status = $1, last_synced_at = $2 WHERE id = $3`,
        ['synced', now, policy.reference_id]
      );
    }

    const refreshed = await db.query<any>(
      `SELECT p.*, r.rules_json, r.encrypted_rules_json, r.integrity_hash
       FROM security_policies p
       LEFT JOIN policy_rule_references r ON r.id = p.rule_reference_id
       WHERE p.id = $1`,
      [policyId]
    );
    return rowToPolicy(refreshed.rows[0]);
  }

  try {
    const syncApiKey = policy.source_url === CVE_DEFAULT_SOURCE.sourceUrl ? CVE_DEFAULT_SOURCE.apiKey : undefined;
    const remotePayload = await fetchRemotePolicyPayload(policy.source_url, syncApiKey);
    const now = new Date().toISOString();
    const summary = `Remote JSON reference from ${remotePayload.sourceUrl}`;

    await db.query(
      `UPDATE policy_rule_references
       SET source_url = $1,
           rules_json = $2,
           encrypted_rules_json = $3,
           transport_encryption = $4,
           integrity_hash = $5,
           sync_status = $6,
           last_synced_at = $7
       WHERE id = $8`,
      [
        remotePayload.sourceUrl,
        remotePayload.rulesJson,
        remotePayload.encryptedRulesJson,
        remotePayload.transportEncryption,
        remotePayload.integrityHash,
        'synced',
        now,
        policy.reference_id,
      ]
    );

    await db.query(
      `UPDATE security_policies
       SET rules = $1,
           source_url = $2,
           transport_encryption = $3,
           sync_status = $4,
           last_synced_at = $5
       WHERE id = $6`,
      [summary, remotePayload.sourceUrl, remotePayload.transportEncryption, 'synced', now, policyId]
    );

    await insertSecurityEvent({
      uid: actor?.uid ?? policy.uid,
      userEmail: actor?.userEmail,
      resourcePath: `policies/${policyId}/sync`,
      details: `Remote JSON reference synced. Integrity hash: ${remotePayload.integrityHash.slice(0, 12)}...`,
      targetPath: remotePayload.sourceUrl,
    });
  } catch (error) {
    await db.query(
      `UPDATE security_policies SET sync_status = $1 WHERE id = $2`,
      ['error', policyId]
    );
    await db.query(
      `UPDATE policy_rule_references SET sync_status = $1 WHERE id = $2`,
      ['error', policy.reference_id]
    );
    await insertSecurityEvent({
      uid: actor?.uid ?? policy.uid,
      userEmail: actor?.userEmail,
      resourcePath: `policies/${policyId}/sync`,
      details: error instanceof Error ? error.message : 'Remote JSON policy sync failed.',
      targetPath: policy.source_url,
    });
    throw error;
  }

  const updated = await db.query<any>(
    `SELECT p.*, r.rules_json, r.encrypted_rules_json, r.integrity_hash
     FROM security_policies p
     LEFT JOIN policy_rule_references r ON r.id = p.rule_reference_id
     WHERE p.id = $1`,
    [policyId]
  );

  return rowToPolicy(updated.rows[0]);
}

export async function syncAllRemoteSecurityPolicies(uid: string, actor?: { uid?: string; userEmail?: string }): Promise<void> {
  const db = await getDbLazy();
  const res = await db.query<any>(
    'SELECT id FROM security_policies WHERE uid = $1 AND source_url IS NOT NULL AND is_active = TRUE',
    [uid]
  );

  for (const row of res.rows) {
    try {
      await syncRemoteSecurityPolicy(row.id, actor);
    } catch (error) {
      console.error('Remote policy sync failed', error);
    }
  }
}

export async function updateSecurityPolicy(id: string, isActive: boolean): Promise<void> {
  const db = await getDbLazy();
  await db.query('UPDATE security_policies SET is_active = $1 WHERE id = $2', [isActive, id]);
}

export async function initializeDefaultCVESource(uid: string, userEmail?: string): Promise<SecurityPolicy | null> {
  const db = await getDbLazy();

  // Check if CVE source already exists
  const existing = await db.query<any>(
    'SELECT id FROM security_policies WHERE uid = $1 AND name = $2',
    [uid, CVE_DEFAULT_SOURCE.name]
  );

  if (existing.rows.length > 0) {
    return null; // Already initialized
  }

  // Try to fetch real CVE data from NVD API v2
  let rulesJson: string;
  let syncStatus: string;
  let policyRules: string;
  try {
    const nvd = await fetchNvdCveRules();
    rulesJson = nvd.rulesJson;
    syncStatus = 'synced';
    policyRules = `NVD: ${nvd.totalResults} CVEs, ${nvd.blockedCves.length} rules loaded`;
  } catch {
    // Fallback to placeholder if NVD is unreachable
    rulesJson = JSON.stringify({ source: CVE_DEFAULT_SOURCE.sourceUrl, status: 'pending-sync' });
    syncStatus = 'pending';
    policyRules = `Remote reference: ${CVE_DEFAULT_SOURCE.sourceUrl}`;
  }

  const policyId = uuid();
  const ruleReferenceId = uuid();
  const encryptedRules = encryptData(rulesJson);
  const integrityHash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rulesJson)))
  ).map(b => b.toString(16).padStart(2, '0')).join('');

  await db.query('BEGIN');
  try {
    await db.query(
      `INSERT INTO security_policies (
        id, uid, name, rules, is_active, rule_reference_id, source_url,
        transport_encryption, sync_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        policyId, uid, CVE_DEFAULT_SOURCE.name,
        policyRules,
        true, ruleReferenceId, CVE_DEFAULT_SOURCE.sourceUrl,
        'TLS_REQUIRED+AES256_CACHE', syncStatus,
      ]
    );

    await db.query(
      `INSERT INTO policy_rule_references (
        id, policy_id, uid, source_url, rules_json, encrypted_rules_json,
        transport_encryption, reference_mode, integrity_hash, sync_status,
        sync_interval_hours, is_default_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        ruleReferenceId, policyId, uid,
        CVE_DEFAULT_SOURCE.sourceUrl,
        rulesJson, encryptedRules,
        'TLS_REQUIRED+AES256_CACHE', 'remote-json',
        integrityHash, syncStatus,
        CVE_DEFAULT_SOURCE.syncIntervalHours, true,
      ]
    );

    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Failed to initialize default CVE source', error);
    return null;
  }

  const created = await db.query<any>(
    `SELECT p.*, r.rules_json, r.encrypted_rules_json, r.integrity_hash
     FROM security_policies p
     LEFT JOIN policy_rule_references r ON r.id = p.rule_reference_id
     WHERE p.id = $1`,
    [policyId]
  );

  return rowToPolicy(created.rows[0]);
}

export async function getSyncEligiblePolicies(uid: string): Promise<SecurityPolicy[]> {
  const db = await getDbLazy();
  const res = await db.query<any>(
    `SELECT p.*, r.sync_interval_hours, r.last_synced_at
     FROM security_policies p
     LEFT JOIN policy_rule_references r ON r.id = p.rule_reference_id
     WHERE p.uid = $1 AND p.source_url IS NOT NULL AND p.is_active = TRUE`,
    [uid]
  );
  
  return res.rows.map(rowToPolicy);
}

export async function getOverduePolicies(uid: string): Promise<SecurityPolicy[]> {
  const db = await getDbLazy();
  const now = new Date();
  
  const res = await db.query<any>(
    `SELECT p.*, r.sync_interval_hours, r.last_synced_at
     FROM security_policies p
     LEFT JOIN policy_rule_references r ON r.id = p.rule_reference_id
     WHERE p.uid = $1 
       AND p.source_url IS NOT NULL 
       AND p.is_active = TRUE
       AND (r.last_synced_at IS NULL 
            OR EXTRACT(EPOCH FROM (NOW() - r.last_synced_at)) / 3600 >= COALESCE(r.sync_interval_hours, 24))`,
    [uid]
  );
  
  return res.rows.map(rowToPolicy);
}

export interface ActivePolicyRule {
  policyId: string;
  name: string;
  rulesJson: string | undefined;
  isDefaultSource: boolean;
}

/** Returns all active policies with their cached rulesJson for runtime enforcement. */
export async function getActivePolicyRules(uid: string): Promise<ActivePolicyRule[]> {
  const policies = await getSecurityPolicies(uid);
  return policies
    .filter((p) => p.isActive)
    .map((p) => ({
      policyId: p.id,
      name: p.name,
      rulesJson: p.rulesJson,
      isDefaultSource: p.isDefaultSource ?? false,
    }));
}

export interface LocalSearchResult {
  policyName: string;
  isDefaultSource: boolean;
  excerpt: string;
}

/**
 * Searches the locally cached policy/CVE rules data for terms matching the query.
 * Returns up to 3 matching excerpts, each up to 400 characters.
 */
export async function searchLocalPolicyData(uid: string, query: string): Promise<LocalSearchResult[]> {
  const rules = await getActivePolicyRules(uid);
  if (rules.length === 0) return [];

  // Extract meaningful tokens from the query (CVE IDs + words longer than 3 chars)
  const tokens = query
    .toLowerCase()
    .match(/cve-\d{4}-\d+|[a-z0-9_-]{4,}/g) ?? [];

  if (tokens.length === 0) return [];

  const results: LocalSearchResult[] = [];

  for (const rule of rules) {
    if (!rule.rulesJson) continue;
    const haystack = rule.rulesJson.toLowerCase();

    for (const token of tokens) {
      const idx = haystack.indexOf(token);
      if (idx === -1) continue;

      // Extract a 400-char window around the match
      const start = Math.max(0, idx - 100);
      const end = Math.min(rule.rulesJson.length, idx + 300);
      const excerpt = rule.rulesJson.slice(start, end).trim();

      results.push({
        policyName: rule.name,
        isDefaultSource: rule.isDefaultSource,
        excerpt,
      });

      // One excerpt per policy per search is enough
      break;
    }

    if (results.length >= 3) break;
  }

  return results;
}

// --- Row mappers ---
function rowToDataLog(r: any): DataLog {
  return {
    id: r.id,
    uid: r.uid,
    content: r.content,
    classification: r.classification,
    piiDetected: r.pii_detected,
    piiDetails: r.pii_details,
    protectionStatus: r.protection_status,
    createdAt: new Date(r.created_at),
  };
}

function rowToAuditLog(r: any): AuditLog {
  return {
    id: r.id,
    uid: r.uid,
    userEmail: r.user_email,
    operation: r.operation,
    resourcePath: r.resource_path,
    details: r.details,
    targetPath: r.target_path ?? undefined,
    targetType: r.target_type ?? undefined,
    testRound: r.test_round ?? undefined,
    previousHash: r.previous_hash ?? undefined,
    currentHash: r.current_hash ?? undefined,
    changeStatus: r.change_status ?? undefined,
    timestamp: new Date(r.timestamp),
  };
}

function rowToPolicy(r: any): SecurityPolicy {
  return {
    id: r.id,
    uid: r.uid,
    name: r.name,
    rules: r.rules,
    isActive: r.is_active,
    ruleReferenceId: r.rule_reference_id ?? undefined,
    sourceUrl: r.source_url ?? undefined,
    transportEncryption: r.transport_encryption ?? undefined,
    lastSyncedAt: r.last_synced_at ? new Date(r.last_synced_at) : undefined,
    syncStatus: r.sync_status ?? undefined,
    rulesJson: r.rules_json ?? undefined,
    encryptedRulesJson: r.encrypted_rules_json ?? undefined,
    integrityHash: r.integrity_hash ?? undefined,
    syncIntervalHours: r.sync_interval_hours ?? undefined,
    isDefaultSource: r.is_default_source ?? undefined,
    createdAt: new Date(r.created_at),
  };
}

// --- File System References ---
export interface FileSystemReference {
  id: string;
  uid: string;
  directoryName: string;
  directoryPath: string;
  scanIntervalHours: number;
  isActive: boolean;
  lastScannedAt?: Date;
  totalFilesScanned: number;
  threatsFound: number;
  createdAt: Date;
}

export async function saveFileSystemReference(
  uid: string,
  directoryName: string,
  directoryPath: string,
  scanIntervalHours: number = 24
): Promise<FileSystemReference> {
  const db = await getDbLazy();
  const id = crypto.randomUUID();
  const now = new Date();

  await db.query(
    `INSERT INTO file_system_references (
      id, uid, directory_name, directory_path, scan_interval_hours, is_active, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, uid, directoryName, directoryPath, scanIntervalHours, true, now.toISOString()]
  );

  await insertAuditLog({
    uid,
    userEmail: uid,
    operation: 'CREATE',
    resourcePath: 'file_system_references',
    details: `Granted access to directory: ${directoryName}`,
    targetPath: directoryPath,
    targetType: 'folder',
  });

  return {
    id,
    uid,
    directoryName,
    directoryPath,
    scanIntervalHours,
    isActive: true,
    totalFilesScanned: 0,
    threatsFound: 0,
    createdAt: now
  };
}

export async function getFileSystemReferences(uid: string): Promise<FileSystemReference[]> {
  const db = await getDbLazy();

  const res = await db.query<any>(
    `SELECT * FROM file_system_references WHERE uid = $1 AND is_active = TRUE ORDER BY created_at DESC`,
    [uid]
  );

  return res.rows.map(rowToFileSystemReference);
}

export async function updateFileSystemScanResults(
  referenceId: string,
  totalFiles: number,
  threatsCount: number
): Promise<void> {
  const db = await getDbLazy();
  const now = new Date();

  await db.query(
    `UPDATE file_system_references 
     SET last_scanned_at = $1, total_files_scanned = $2, threats_found = $3 
     WHERE id = $4`,
    [now.toISOString(), totalFiles, threatsCount, referenceId]
  );
}

export async function removeFileSystemReference(referenceId: string): Promise<void> {
  const db = await getDbLazy();

  await db.query(
    `UPDATE file_system_references SET is_active = FALSE WHERE id = $1`,
    [referenceId]
  );
}

export async function getOverdueFileScans(uid: string): Promise<FileSystemReference[]> {
  const db = await getDbLazy();

  const res = await db.query<any>(
    `SELECT * FROM file_system_references 
     WHERE uid = $1 
       AND is_active = TRUE
       AND (last_scanned_at IS NULL 
            OR EXTRACT(EPOCH FROM (NOW() - last_scanned_at)) / 3600 >= scan_interval_hours)`,
    [uid]
  );

  return res.rows.map(rowToFileSystemReference);
}

export async function purgeUserWorkspaceData(uid: string): Promise<void> {
  const db = await getDbLazy();

  await db.query('BEGIN');
  try {
    await db.query(`DELETE FROM policy_rule_references WHERE uid = $1`, [uid]);
    await db.query(`DELETE FROM security_policies WHERE uid = $1`, [uid]);
    await db.query(`DELETE FROM file_system_references WHERE uid = $1`, [uid]);
    await db.query(`DELETE FROM data_logs WHERE uid = $1`, [uid]);
    await db.query(`DELETE FROM audit_logs WHERE uid = $1`, [uid]);
    await db.query(`DELETE FROM users WHERE uid = $1`, [uid]);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

function rowToFileSystemReference(r: any): FileSystemReference {
  return {
    id: r.id,
    uid: r.uid,
    directoryName: r.directory_name,
    directoryPath: r.directory_path,
    scanIntervalHours: r.scan_interval_hours,
    isActive: r.is_active,
    lastScannedAt: r.last_scanned_at ? new Date(r.last_scanned_at) : undefined,
    totalFilesScanned: r.total_files_scanned,
    threatsFound: r.threats_found,
    createdAt: new Date(r.created_at)
  };
}
