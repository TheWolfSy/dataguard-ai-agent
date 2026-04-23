/**
 * Gmail Email Monitor Service
 *
 * Real-time Gmail inbox monitoring using OAuth 2.0 PKCE.
 * Applies CASH (Cache of Adaptive Security Heuristics) rules for threat detection.
 * Incoming messages are scanned automatically; alerts are raised for threats.
 *
 * Setup: User provides a Google Cloud OAuth 2.0 Client ID (Web Application type).
 * Redirect URI to register: <origin>/auth/gmail.html
 */

import { scanEmailContent } from './emailScanService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GmailConnection {
  email: string;
  accessToken: string;
  refreshToken: string | null;
  /** Unix timestamp (ms) when the access token expires */
  tokenExpiresAt: number;
  clientId: string;
  connectedAt: string; // ISO date
}

export type CashRuleType = 'keyword' | 'sender_domain' | 'subject_pattern';
export type MonitorRiskLevel = 'suspicious' | 'dangerous';

export interface CashRule {
  id: string;
  type: CashRuleType;
  pattern: string;
  riskLevel: MonitorRiskLevel;
  enabled: boolean;
  description: string;
  isDefault: boolean;
  createdAt: string; // ISO date
}

export interface MonitorAlert {
  id: string;
  messageId: string;
  subject: string;
  from: string;
  date: string; // ISO date
  snippet: string;
  riskLevel: MonitorRiskLevel;
  matchedRules: Array<{ ruleId: string; description: string; riskLevel: MonitorRiskLevel }>;
  dismissed: boolean;
  detectedAt: string; // ISO date
}

export interface EmailMonitorState {
  enabled: boolean;
  connection: GmailConnection | null;
  rules: CashRule[];
  alerts: MonitorAlert[];
  lastCheckedAt: string | null;
  totalScanned: number;
  isMonitoring: boolean;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const KEY_CONNECTION = 'dataguard_gmail_connection';
const KEY_CLIENT_SECRET = 'dataguard_gmail_cs';
const KEY_RULES = 'dataguard_email_cash_rules';
const KEY_ALERTS = 'dataguard_email_alerts';
const KEY_META = 'dataguard_email_monitor_meta';

const MAX_ALERTS = 50;
const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

// ─── Default CASH Rules ────────────────────────────────────────────────────────

const DEFAULT_RULES: CashRule[] = [
  { id: 'cash-001', type: 'keyword', pattern: 'verify your account', riskLevel: 'suspicious', enabled: true, description: 'Phishing: account verification phrase', isDefault: true, createdAt: new Date(0).toISOString() },
  { id: 'cash-002', type: 'keyword', pattern: 'your account has been suspended', riskLevel: 'dangerous', enabled: true, description: 'Phishing: account suspension threat', isDefault: true, createdAt: new Date(0).toISOString() },
  { id: 'cash-003', type: 'keyword', pattern: 'click here to confirm', riskLevel: 'suspicious', enabled: true, description: 'Social engineering phrase', isDefault: true, createdAt: new Date(0).toISOString() },
  { id: 'cash-004', type: 'keyword', pattern: 'you have won', riskLevel: 'suspicious', enabled: true, description: 'Lottery/prize scam trigger', isDefault: true, createdAt: new Date(0).toISOString() },
  { id: 'cash-005', type: 'keyword', pattern: 'urgent: your payment', riskLevel: 'dangerous', enabled: true, description: 'Urgency payment fraud phrase', isDefault: true, createdAt: new Date(0).toISOString() },
  { id: 'cash-006', type: 'keyword', pattern: 'enter your password', riskLevel: 'dangerous', enabled: true, description: 'Credential harvesting phrase', isDefault: true, createdAt: new Date(0).toISOString() },
  { id: 'cash-007', type: 'sender_domain', pattern: 'tempmail.com', riskLevel: 'suspicious', enabled: true, description: 'Temporary/disposable email service', isDefault: true, createdAt: new Date(0).toISOString() },
  { id: 'cash-008', type: 'sender_domain', pattern: 'guerrillamail.com', riskLevel: 'suspicious', enabled: true, description: 'Temporary/disposable email service', isDefault: true, createdAt: new Date(0).toISOString() },
  { id: 'cash-009', type: 'subject_pattern', pattern: 'free gift', riskLevel: 'suspicious', enabled: true, description: 'Common spam/scam subject', isDefault: true, createdAt: new Date(0).toISOString() },
  { id: 'cash-010', type: 'keyword', pattern: 'اضغط هنا لتأكيد', riskLevel: 'suspicious', enabled: true, description: 'Arabic phishing: click to confirm', isDefault: true, createdAt: new Date(0).toISOString() },
  { id: 'cash-011', type: 'keyword', pattern: 'تم تعليق حسابك', riskLevel: 'dangerous', enabled: true, description: 'Arabic phishing: account suspended', isDefault: true, createdAt: new Date(0).toISOString() },
  { id: 'cash-012', type: 'keyword', pattern: 'كلمة المرور الخاصة بك', riskLevel: 'dangerous', enabled: true, description: 'Arabic credential harvesting', isDefault: true, createdAt: new Date(0).toISOString() },
];

// ─── PKCE Helpers ─────────────────────────────────────────────────────────────

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateCodeVerifier(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf.buffer);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

// ─── State Helpers ─────────────────────────────────────────────────────────────

function loadConnection(): GmailConnection | null {
  try {
    const raw = localStorage.getItem(KEY_CONNECTION);
    return raw ? (JSON.parse(raw) as GmailConnection) : null;
  } catch {
    return null;
  }
}

function saveConnection(conn: GmailConnection): void {
  localStorage.setItem(KEY_CONNECTION, JSON.stringify(conn));
}

function loadRules(): CashRule[] {
  try {
    const raw = localStorage.getItem(KEY_RULES);
    if (!raw) return [...DEFAULT_RULES];
    const saved = JSON.parse(raw) as CashRule[];
    // Merge: add any new defaults not yet in saved list
    const savedIds = new Set(saved.map((r) => r.id));
    const newDefaults = DEFAULT_RULES.filter((r) => !savedIds.has(r.id));
    return [...newDefaults, ...saved];
  } catch {
    return [...DEFAULT_RULES];
  }
}

function saveRules(rules: CashRule[]): void {
  localStorage.setItem(KEY_RULES, JSON.stringify(rules));
}

function loadAlerts(): MonitorAlert[] {
  try {
    const raw = localStorage.getItem(KEY_ALERTS);
    return raw ? (JSON.parse(raw) as MonitorAlert[]) : [];
  } catch {
    return [];
  }
}

function saveAlerts(alerts: MonitorAlert[]): void {
  localStorage.setItem(KEY_ALERTS, JSON.stringify(alerts.slice(-MAX_ALERTS)));
}

interface MonitorMeta {
  enabled: boolean;
  lastCheckedAt: string | null;
  totalScanned: number;
  /** Timestamp (ms) of the most recently processed message — used as 'after' cursor */
  lastMessageMs: number;
}

function loadMeta(): MonitorMeta {
  try {
    const raw = localStorage.getItem(KEY_META);
    return raw
      ? (JSON.parse(raw) as MonitorMeta)
      : { enabled: false, lastCheckedAt: null, totalScanned: 0, lastMessageMs: Date.now() };
  } catch {
    return { enabled: false, lastCheckedAt: null, totalScanned: 0, lastMessageMs: Date.now() };
  }
}

function saveMeta(meta: MonitorMeta): void {
  localStorage.setItem(KEY_META, JSON.stringify(meta));
}

// ─── Gmail API Helpers ─────────────────────────────────────────────────────────

interface GmailMsgPart {
  mimeType: string;
  body: { data?: string; size: number };
  parts?: GmailMsgPart[];
  headers?: Array<{ name: string; value: string }>;
}

interface GmailApiMsg {
  id: string;
  snippet: string;
  internalDate: string; // unix ms as string
  payload: GmailMsgPart;
}

function base64UrlDecode(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
  } catch {
    return atob(b64);
  }
}

function extractBody(part: GmailMsgPart): string {
  if ((part.mimeType === 'text/html' || part.mimeType === 'text/plain') && part.body?.data) {
    return base64UrlDecode(part.body.data);
  }
  if (part.parts) {
    const htmlPart = part.parts.find((p) => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) return base64UrlDecode(htmlPart.body.data);
    const textPart = part.parts.find((p) => p.mimeType === 'text/plain');
    if (textPart?.body?.data) return base64UrlDecode(textPart.body.data);
    for (const p of part.parts) {
      const body = extractBody(p);
      if (body) return body;
    }
  }
  return '';
}

function getHeader(payload: GmailMsgPart, name: string): string {
  return payload.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

async function gmailGet(path: string, token: string): Promise<Response> {
  return fetch(`https://gmail.googleapis.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function getUserEmailFromApi(token: string): Promise<string> {
  const res = await gmailGet('/gmail/v1/users/me/profile', token);
  if (!res.ok) throw new Error(`Gmail profile error: ${res.status}`);
  const data = (await res.json()) as { emailAddress: string };
  return data.emailAddress;
}

async function listMessageIds(token: string, afterMs: number): Promise<string[]> {
  const afterSec = Math.floor(afterMs / 1000);
  const q = `after:${afterSec}`;
  const res = await gmailGet(
    `/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=20`,
    token,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { messages?: Array<{ id: string }> };
  return (data.messages ?? []).map((m) => m.id);
}

async function fetchMessage(token: string, msgId: string): Promise<GmailApiMsg> {
  const res = await gmailGet(`/gmail/v1/users/me/messages/${msgId}?format=full`, token);
  if (!res.ok) throw new Error(`Fetch message error: ${res.status}`);
  return (await res.json()) as GmailApiMsg;
}

async function refreshConnectionToken(conn: GmailConnection): Promise<GmailConnection> {
  if (!conn.refreshToken) throw new Error('No refresh token — user must re-authenticate');
  const cs = localStorage.getItem(KEY_CLIENT_SECRET) ?? '';
  const body = new URLSearchParams({
    refresh_token: conn.refreshToken,
    client_id: conn.clientId,
    grant_type: 'refresh_token',
  });
  if (cs) body.set('client_secret', cs);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? 'Token refresh failed');
  }
  const updated: GmailConnection = {
    ...conn,
    accessToken: data.access_token,
    tokenExpiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  saveConnection(updated);
  return updated;
}

async function getValidToken(): Promise<string | null> {
  let conn = loadConnection();
  if (!conn) return null;
  // Refresh if expiring in < 5 minutes
  if (Date.now() >= conn.tokenExpiresAt - 5 * 60 * 1000) {
    if (!conn.refreshToken) return null;
    try {
      conn = await refreshConnectionToken(conn);
    } catch {
      return null;
    }
  }
  return conn.accessToken;
}

// ─── CASH Analysis Engine ─────────────────────────────────────────────────────

function runCashAnalysis(
  subject: string,
  from: string,
  body: string,
  rules: CashRule[],
): { riskLevel: MonitorRiskLevel | null; matchedRules: MonitorAlert['matchedRules'] } {
  const matched: MonitorAlert['matchedRules'] = [];
  const lSubject = subject.toLowerCase();
  const lFrom = from.toLowerCase();
  const lBody = body.toLowerCase();

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const pat = rule.pattern.toLowerCase();
    let hit = false;
    switch (rule.type) {
      case 'keyword':
        hit = lSubject.includes(pat) || lBody.includes(pat);
        break;
      case 'sender_domain':
        hit = lFrom.includes('@' + pat) || lFrom.includes('.' + pat);
        break;
      case 'subject_pattern':
        hit = lSubject.includes(pat);
        break;
    }
    if (hit) {
      matched.push({ ruleId: rule.id, description: rule.description, riskLevel: rule.riskLevel });
    }
  }

  // Use the existing URL scanner on the email body
  const urlScan = scanEmailContent(body);
  if (urlScan.dangerousLinks > 0) {
    matched.push({ ruleId: 'builtin-url', description: `روابط خطيرة (${urlScan.dangerousLinks})`, riskLevel: 'dangerous' });
  } else if (urlScan.suspiciousLinks > 0) {
    matched.push({ ruleId: 'builtin-url', description: `روابط مشبوهة (${urlScan.suspiciousLinks})`, riskLevel: 'suspicious' });
  }

  if (matched.length === 0) return { riskLevel: null, matchedRules: [] };
  const worst: MonitorRiskLevel = matched.some((r) => r.riskLevel === 'dangerous') ? 'dangerous' : 'suspicious';
  return { riskLevel: worst, matchedRules: matched };
}

// ─── Monitor Loop ──────────────────────────────────────────────────────────────

let _monitorInterval: ReturnType<typeof setInterval> | null = null;
let _onAlertCallback: ((alert: MonitorAlert) => void) | null = null;

async function runMonitorCheck(): Promise<void> {
  const token = await getValidToken();
  if (!token) return;

  const meta = loadMeta();
  const rules = loadRules();
  const msgIds = await listMessageIds(token, meta.lastMessageMs);
  if (msgIds.length === 0) {
    meta.lastCheckedAt = new Date().toISOString();
    saveMeta(meta);
    return;
  }

  const alerts = loadAlerts();
  const seenIds = new Set(alerts.map((a) => a.messageId));
  let newLastMs = meta.lastMessageMs;
  let scanned = meta.totalScanned;

  for (const msgId of msgIds) {
    if (seenIds.has(msgId)) continue;
    try {
      const msg = await fetchMessage(token, msgId);
      const msgDate = parseInt(msg.internalDate, 10);
      if (msgDate > newLastMs) newLastMs = msgDate;

      const subject = getHeader(msg.payload, 'subject');
      const from = getHeader(msg.payload, 'from');
      const body = extractBody(msg.payload);
      scanned++;

      const { riskLevel, matchedRules } = runCashAnalysis(subject, from, body, rules);
      if (riskLevel) {
        const alert: MonitorAlert = {
          id: crypto.randomUUID(),
          messageId: msgId,
          subject: subject || '(no subject)',
          from: from || '(unknown)',
          date: new Date(msgDate).toISOString(),
          snippet: msg.snippet,
          riskLevel,
          matchedRules,
          dismissed: false,
          detectedAt: new Date().toISOString(),
        };
        alerts.push(alert);
        _onAlertCallback?.(alert);

        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(
            riskLevel === 'dangerous' ? '🚨 DataGuard: بريد خطير رُصد' : '⚠️ DataGuard: بريد مشبوه',
            { body: `من: ${from}\nالموضوع: ${subject || '(بلا موضوع)'}`, icon: '/logo.png' },
          );
        }
      }
    } catch {
      // Skip individual message errors silently
    }
  }

  meta.lastCheckedAt = new Date().toISOString();
  meta.lastMessageMs = newLastMs;
  meta.totalScanned = scanned;
  saveMeta(meta);
  saveAlerts(alerts);
}

// ─── Public API ────────────────────────────────────────────────────────────────

/** Returns a snapshot of the current monitor state. */
export function getEmailMonitorState(): EmailMonitorState {
  const meta = loadMeta();
  return {
    enabled: meta.enabled,
    connection: loadConnection(),
    rules: loadRules(),
    alerts: loadAlerts(),
    lastCheckedAt: meta.lastCheckedAt,
    totalScanned: meta.totalScanned,
    isMonitoring: _monitorInterval !== null,
  };
}

/**
 * Starts the Gmail OAuth PKCE flow via a popup window.
 * Returns a promise that resolves when the account is fully connected.
 *
 * The redirect URI must be registered in your Google Cloud Console:
 *   <window.location.origin>/auth/gmail.html
 */
export async function connectGmail(clientId: string, clientSecret?: string): Promise<void> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = crypto.randomUUID();

  sessionStorage.setItem('_dg_pkce_v', codeVerifier);
  sessionStorage.setItem('_dg_pkce_s', state);
  if (clientSecret) sessionStorage.setItem('_dg_pkce_cs', clientSecret);

  const redirectUri = `${window.location.origin}/auth/gmail.html`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly openid email',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  const popup = window.open(authUrl, 'gmail_oauth', 'width=560,height=680,left=200,top=80');
  if (!popup) throw new Error('النوافذ المنبثقة محظورة. يرجى السماح بها لهذا الموقع.');

  return new Promise<void>((resolve, reject) => {
    const handleMessage = async (
      event: MessageEvent<{ type?: string; code?: string; state?: string; error?: string }>,
    ) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'GMAIL_AUTH_CODE') return;

      window.removeEventListener('message', handleMessage);
      clearInterval(closedChecker);

      const { code, state: retState, error } = event.data;
      if (error || !code) {
        reject(new Error(error === 'access_denied' ? 'تم رفض الوصول من قِبل المستخدم' : (error ?? 'لم يتم استلام رمز التفويض')));
        return;
      }
      if (retState !== sessionStorage.getItem('_dg_pkce_s')) {
        reject(new Error('State mismatch — possible CSRF attack'));
        return;
      }

      const verifier = sessionStorage.getItem('_dg_pkce_v') ?? '';
      const cs = sessionStorage.getItem('_dg_pkce_cs') ?? '';
      sessionStorage.removeItem('_dg_pkce_v');
      sessionStorage.removeItem('_dg_pkce_s');
      sessionStorage.removeItem('_dg_pkce_cs');

      try {
        const body = new URLSearchParams({
          code,
          client_id: clientId,
          redirect_uri: redirectUri,
          code_verifier: verifier,
          grant_type: 'authorization_code',
        });
        if (cs) body.set('client_secret', cs);

        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        const tokenData = (await res.json()) as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
          error?: string;
          error_description?: string;
        };
        if (!res.ok || !tokenData.access_token) {
          throw new Error(tokenData.error_description ?? tokenData.error ?? 'فشل استبدال رمز التفويض');
        }

        const email = await getUserEmailFromApi(tokenData.access_token);
        const conn: GmailConnection = {
          email,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token ?? null,
          tokenExpiresAt: Date.now() + (tokenData.expires_in ?? 3600) * 1000,
          clientId,
          connectedAt: new Date().toISOString(),
        };
        saveConnection(conn);
        if (cs) localStorage.setItem(KEY_CLIENT_SECRET, cs);

        // Set cursor to now — don't scan historical emails
        const meta = loadMeta();
        meta.lastMessageMs = Date.now();
        meta.enabled = true;
        saveMeta(meta);

        // Request browser notification permission
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    window.addEventListener('message', handleMessage);
    const closedChecker = setInterval(() => {
      if (popup.closed) {
        clearInterval(closedChecker);
        window.removeEventListener('message', handleMessage);
        sessionStorage.removeItem('_dg_pkce_v');
        sessionStorage.removeItem('_dg_pkce_s');
        sessionStorage.removeItem('_dg_pkce_cs');
        reject(new Error('تم إغلاق نافذة التفويض قبل الإتمام'));
      }
    }, 500);
  });
}

/** Disconnects Gmail and stops monitoring. */
export function disconnectGmail(): void {
  localStorage.removeItem(KEY_CONNECTION);
  localStorage.removeItem(KEY_CLIENT_SECRET);
  const meta = loadMeta();
  meta.enabled = false;
  saveMeta(meta);
  stopMonitorLoop();
}

/** Enable or disable the monitor (persisted). */
export function setEmailMonitorEnabled(enabled: boolean): void {
  const meta = loadMeta();
  meta.enabled = enabled;
  saveMeta(meta);
}

/**
 * Starts the polling monitor loop.
 * @param onAlert  Callback fired whenever a new threat is detected.
 * @returns A cleanup function that stops the loop.
 */
export function startMonitorLoop(onAlert: (alert: MonitorAlert) => void): () => void {
  stopMonitorLoop();
  _onAlertCallback = onAlert;
  // Run first check immediately (fire-and-forget)
  void runMonitorCheck();
  _monitorInterval = setInterval(() => void runMonitorCheck(), POLL_INTERVAL_MS);
  return stopMonitorLoop;
}

/** Stops the polling monitor loop. */
export function stopMonitorLoop(): void {
  if (_monitorInterval !== null) {
    clearInterval(_monitorInterval);
    _monitorInterval = null;
  }
  _onAlertCallback = null;
}

// ─── CASH Rules CRUD ──────────────────────────────────────────────────────────

export function addCashRule(rule: Omit<CashRule, 'id' | 'createdAt' | 'isDefault'>): CashRule {
  const rules = loadRules();
  const newRule: CashRule = {
    ...rule,
    id: crypto.randomUUID(),
    isDefault: false,
    createdAt: new Date().toISOString(),
  };
  rules.push(newRule);
  saveRules(rules);
  return newRule;
}

export function removeCashRule(id: string): void {
  saveRules(loadRules().filter((r) => r.id !== id));
}

export function toggleCashRule(id: string, enabled: boolean): void {
  saveRules(loadRules().map((r) => (r.id === id ? { ...r, enabled } : r)));
}

// ─── Alerts CRUD ──────────────────────────────────────────────────────────────

export function dismissAlert(id: string): void {
  saveAlerts(loadAlerts().map((a) => (a.id === id ? { ...a, dismissed: true } : a)));
}

export function clearAllAlerts(): void {
  saveAlerts([]);
}
