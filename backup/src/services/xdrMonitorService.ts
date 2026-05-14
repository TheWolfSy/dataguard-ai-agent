import { getToolState, type AdvancedToolId } from './advancedToolsService';

export interface XdrEvent {
  id: string;
  timestamp: string;
  eventType: 'login_failure' | 'file_integrity' | 'rate_limit' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  details: string;
  rawData?: Record<string, unknown>;
}

export interface FileIntegrityRecord {
  path: string;
  hash: string;
  lastModified: string;
  size: number;
}

export interface LoginAttemptRecord {
  email: string;
  ip: string;
  success: boolean;
  timestamp: string;
  reason?: string;
}

const XDR_EVENTS_KEY = 'dataguard_xdr_events';
const FILE_INTEGRITY_KEY = 'dataguard_file_integrity';
const MAX_EVENTS = 500;

async function getDbLazy() {
  const mod = await import('../database');
  return mod.getDb();
}

export async function checkXdrEnabled(): Promise<boolean> {
  try {
    return await getToolState('xdr');
  } catch {
    return false;
  }
}

function generateEventId(): string {
  return crypto.randomUUID();
}

function saveEvents(events: XdrEvent[]): void {
  try {
    localStorage.setItem(XDR_EVENTS_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // Ignore storage errors
  }
}

function loadEvents(): XdrEvent[] {
  try {
    const raw = localStorage.getItem(XDR_EVENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function logLoginAttempt(record: LoginAttemptRecord): Promise<void> {
  if (!await checkXdrEnabled()) return;

  if (!record.success) {
    const event: XdrEvent = {
      id: generateEventId(),
      timestamp: record.timestamp,
      eventType: 'login_failure',
      severity: record.reason?.includes('rate') ? 'medium' : 'high',
      source: record.ip || 'unknown',
      details: `فشل-login لـ ${record.email}: ${record.reason || 'غير معروف'}`,
      rawData: { email: record.email, ip: record.ip, reason: record.reason },
    };
    const events = loadEvents();
    events.push(event);
    saveEvents(events);
    console.log('[XDR] تسجيل فشل login:', event);
  } else {
    const event: XdrEvent = {
      id: generateEventId(),
      timestamp: record.timestamp,
      eventType: 'login_failure',
      severity: 'low',
      source: record.ip || 'unknown',
      details: `نجاح login لـ ${record.email}`,
      rawData: { email: record.email, ip: record.ip },
    };
    const events = loadEvents();
    events.push(event);
    saveEvents(events);
  }
}

export async function logRateLimit(email: string, ip: string): Promise<void> {
  if (!await checkXdrEnabled()) return;

  const event: XdrEvent = {
    id: generateEventId(),
    timestamp: new Date().toISOString(),
    eventType: 'rate_limit',
    severity: 'medium',
    source: ip || 'unknown',
    details: `معدل المحاولات exceeded لـ ${email}`,
    rawData: { email, ip },
  };
  const events = loadEvents();
  events.push(event);
  saveEvents(events);
  console.log('[XDR] Rate limit:', event);
}

export async function logSuspiciousActivity(source: string, details: string, severity: XdrEvent['severity'] = 'medium'): Promise<void> {
  if (!await checkXdrEnabled()) return;

  const event: XdrEvent = {
    id: generateEventId(),
    timestamp: new Date().toISOString(),
    eventType: 'suspicious_activity',
    severity,
    source,
    details,
  };
  const events = loadEvents();
  events.push(event);
  saveEvents(events);
  console.log('[XDR] نشاط مشبوه:', event);
}

export async function recordFileIntegrity(records: FileIntegrityRecord[]): Promise<void> {
  if (!await checkXdrEnabled()) return;

  try {
    const existing = loadFileIntegrity();
    const pathMap = new Map(existing.map(r => [r.path, r]));

    for (const record of records) {
      pathMap.set(record.path, record);
    }

    localStorage.setItem(FILE_INTEGRITY_KEY, JSON.stringify(Array.from(pathMap.values())));
  } catch {
    // Ignore
  }
}

function loadFileIntegrity(): FileIntegrityRecord[] {
  try {
    const raw = localStorage.getItem(FILE_INTEGRITY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function checkFileIntegrity(path: string, currentHash: string): Promise<{ breached: boolean; record?: FileIntegrityRecord }> {
  if (!await checkXdrEnabled()) return { breached: false };

  const existing = loadFileIntegrity();
  const record = existing.find(r => r.path === path);

  if (!record) {
    return { breached: false };
  }

  if (record.hash !== currentHash) {
    const event: XdrEvent = {
      id: generateEventId(),
      timestamp: new Date().toISOString(),
      eventType: 'file_integrity',
      severity: 'critical',
      source: path,
      details: `تغيير في سلامة الملف: ${path}`,
      rawData: { oldHash: record.hash, newHash: currentHash },
    };
    const events = loadEvents();
    events.push(event);
    saveEvents(events);
    return { breached: true, record };
  }

  return { breached: false };
}

export async function getXdrEvents(limit = 50): Promise<XdrEvent[]> {
  const events = loadEvents();
  return events.slice(-limit).reverse();
}

export async function getXdrStats(): Promise<{
  totalEvents: number;
  loginFailures: number;
  fileIntegrity: number;
  rateLimits: number;
  suspicious: number;
}> {
  const events = loadEvents();
  return {
    totalEvents: events.length,
    loginFailures: events.filter(e => e.eventType === 'login_failure').length,
    fileIntegrity: events.filter(e => e.eventType === 'file_integrity').length,
    rateLimits: events.filter(e => e.eventType === 'rate_limit').length,
    suspicious: events.filter(e => e.eventType === 'suspicious_activity').length,
  };
}

export async function clearXdrEvents(): Promise<void> {
  saveEvents([]);
}