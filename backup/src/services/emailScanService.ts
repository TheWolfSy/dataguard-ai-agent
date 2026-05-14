/**
 * Email Security Scan Service
 * Scans email content (text or HTML) for malicious/phishing links
 * using heuristic analysis. Fully local — no external API calls.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UrlScanResult {
  url: string;
  displayText?: string;
  riskLevel: 'safe' | 'suspicious' | 'dangerous';
  reasons: string[];
}

export interface EmailScanResult {
  id: string;
  scannedAt: Date;
  emailSnippet: string;
  totalLinksFound: number;
  safeLinks: number;
  suspiciousLinks: number;
  dangerousLinks: number;
  urlResults: UrlScanResult[];
  overallRisk: 'safe' | 'suspicious' | 'dangerous';
  summary: string;
}

// ─── Configuration ────────────────────────────────────────────────────────────

const EMAIL_SCAN_SETTING_KEY = 'dataguard_email_scan_enabled';

/** URL shorteners that hide real destinations */
const URL_SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'buff.ly',
  'short.link', 'is.gd', 'rebrand.ly', 'tiny.cc', 'lnkd.in',
  'fb.me', 'wp.me', 'dlvr.it', 'soo.gd', 'su.pr', 'twurl.nl',
  'shorturl.at', 'cutt.ly', 'rb.gy', 'snip.ly', 'bl.ink',
]);

/** High-risk TLDs commonly used in phishing */
const SUSPICIOUS_TLDS = new Set([
  '.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.click',
  '.download', '.review', '.country', '.kim', '.science', '.work',
  '.party', '.bid', '.loan', '.racing', '.win', '.diet',
  '.accountant', '.cricket', '.faith', '.stream', '.trade',
]);

/** Trusted brand names often impersonated in phishing */
const SPOOFED_BRANDS = [
  'paypal', 'microsoft', 'apple', 'google', 'amazon', 'facebook',
  'instagram', 'twitter', 'x', 'netflix', 'spotify', 'linkedin',
  'dropbox', 'chase', 'wellsfargo', 'bankofamerica', 'citibank',
  'hsbc', 'steam', 'coinbase', 'binance', 'blockchain', 'ebay',
  'yahoo', 'outlook', 'gmail', 'icloud', 'docusign', 'fedex', 'ups',
  'dhl', 'irs', 'bank', 'gov',
];

/** Path keywords typical in credential-harvesting pages */
const SUSPICIOUS_PATH_KEYWORDS = [
  'login', 'signin', 'sign-in', 'log-in', 'account', 'verify',
  'secure', 'update', 'billing', 'payment', 'confirm', 'auth',
  'password', 'reset', 'recover', 'suspension', 'unlock',
  'validate', 'verification', 'credential', 'token', 'access',
];

// ─── Settings helpers ─────────────────────────────────────────────────────────

export function isEmailScanEnabled(): boolean {
  return localStorage.getItem(EMAIL_SCAN_SETTING_KEY) === 'true';
}

export function setEmailScanEnabled(enabled: boolean): void {
  localStorage.setItem(EMAIL_SCAN_SETTING_KEY, enabled ? 'true' : 'false');
}

// ─── URL extraction ───────────────────────────────────────────────────────────

/** Extract all URLs from email text or HTML content. */
function extractUrls(text: string): Array<{ url: string; displayText?: string }> {
  const results: Array<{ url: string; displayText?: string }> = [];
  const seen = new Set<string>();

  // Match <a href="...">display text</a> (HTML emails)
  const hrefRegex = /href=["']([^"']+)["'][^>]*>([^<]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(text)) !== null) {
    const url = match[1].trim();
    const displayText = match[2].trim();
    if (!seen.has(url) && /^https?:\/\//i.test(url)) {
      seen.add(url);
      results.push({ url, displayText: displayText || undefined });
    }
  }

  // Match bare URLs in plain text (strip trailing punctuation)
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0].replace(/[.,;!?:]+$/, '');
    if (!seen.has(url)) {
      seen.add(url);
      results.push({ url });
    }
  }

  return results;
}

// ─── URL risk analyser ────────────────────────────────────────────────────────

/** Analyse a single URL for phishing / malware indicators. */
function analyzeUrl(url: string, displayText?: string): UrlScanResult {
  const reasons: string[] = [];
  let riskScore = 0;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      url,
      displayText,
      riskLevel: 'suspicious',
      reasons: ['رابط مشوّه أو غير صالح'],
    };
  }

  const host = parsed.hostname.toLowerCase();
  const fullPath = (parsed.pathname + parsed.search).toLowerCase();

  // 1. HTTP (unencrypted)
  if (parsed.protocol === 'http:') {
    riskScore += 2;
    reasons.push('HTTP غير مشفر');
  }

  // 2. Raw IP address instead of domain
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    riskScore += 5;
    reasons.push('رابط يستخدم عنوان IP مباشرة');
  }

  // 3. URL shortener
  if (URL_SHORTENERS.has(host)) {
    riskScore += 3;
    reasons.push('خدمة تقصير روابط — الوجهة الحقيقية مخفية');
  }

  // 4. Suspicious TLD
  const tld = `.${host.split('.').pop() ?? ''}`;
  if (SUSPICIOUS_TLDS.has(tld)) {
    riskScore += 3;
    reasons.push(`نطاق عالي الخطورة (${tld})`);
  }

  // 5. Brand impersonation — brand keyword in host but not as the official domain
  for (const brand of SPOOFED_BRANDS) {
    if (host.includes(brand)) {
      const domainParts = host.split('.');
      const mainDomain = domainParts.slice(-2).join('.');
      if (!mainDomain.startsWith(brand)) {
        riskScore += 5;
        reasons.push(`انتحال هوية "${brand}" — موقع مزيف محتمل`);
        break;
      }
    }
  }

  // 6. Suspicious path keywords
  for (const kw of SUSPICIOUS_PATH_KEYWORDS) {
    if (fullPath.includes(kw)) {
      riskScore += 1;
      reasons.push(`المسار يحتوي على كلمة مثيرة للشك: "${kw}"`);
      break;
    }
  }

  // 7. Excessively long URL (obfuscation attempt)
  if (url.length > 200) {
    riskScore += 2;
    reasons.push('رابط مطوّل جداً — قد يكون مضللاً');
  }

  // 8. "@" in URL path (tricks browsers into using different host)
  if (url.includes('@')) {
    riskScore += 5;
    reasons.push('رابط يحتوي على "@" — يخفي الوجهة الحقيقية');
  }

  // 9. Heavy percent-encoding (> 3 encoded sequences)
  if ((url.match(/%[0-9a-fA-F]{2}/g) ?? []).length > 3) {
    riskScore += 2;
    reasons.push('ترميز مفرط في الرابط — تشويش مقصود');
  }

  // 10. Display text vs actual URL mismatch
  if (displayText && /^https?:\/\//i.test(displayText)) {
    try {
      const displayParsed = new URL(displayText);
      if (displayParsed.hostname.toLowerCase() !== host) {
        riskScore += 6;
        reasons.push('نص الرابط المعروض يختلف عن وجهته الحقيقية');
      }
    } catch {
      // not a valid URL in display text — ignore
    }
  }

  // 11. Too many subdomain levels (e.g. paypal.com.attacker.xyz)
  if (host.split('.').length > 4) {
    riskScore += 2;
    reasons.push('عدد كبير من مستويات النطاق الفرعي');
  }

  // 12. Brand name joined with hyphen (paypal-secure.evil.net)
  const hostParts = host.split('-');
  for (const brand of SPOOFED_BRANDS) {
    if (hostParts.includes(brand)) {
      const mainDomain = host.split('.').slice(-2).join('.');
      if (!mainDomain.startsWith(brand)) {
        riskScore += 3;
        reasons.push(`نطاق يحاكي "${brand}" بشرطة`);
        break;
      }
    }
  }

  // Derive risk level from score
  const riskLevel: 'safe' | 'suspicious' | 'dangerous' =
    riskScore >= 5 ? 'dangerous' : riskScore >= 2 ? 'suspicious' : 'safe';

  if (reasons.length === 0) {
    reasons.push('لم تُكتشف مؤشرات تهديد');
  }

  return { url, displayText, riskLevel, reasons };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Scan the full content of an email (plain text or HTML) for malicious links.
 * Returns a detailed report of every URL found and the overall risk level.
 */
export function scanEmailContent(content: string): EmailScanResult {
  const rawUrls = extractUrls(content);
  const urlResults = rawUrls.map(({ url, displayText }) => analyzeUrl(url, displayText));

  const safeLinks = urlResults.filter((r) => r.riskLevel === 'safe').length;
  const suspiciousLinks = urlResults.filter((r) => r.riskLevel === 'suspicious').length;
  const dangerousLinks = urlResults.filter((r) => r.riskLevel === 'dangerous').length;

  const overallRisk: 'safe' | 'suspicious' | 'dangerous' =
    dangerousLinks > 0 ? 'dangerous' : suspiciousLinks > 0 ? 'suspicious' : 'safe';

  let summary: string;
  if (urlResults.length === 0) {
    summary = 'لم يتم العثور على روابط في هذا البريد الإلكتروني.';
  } else if (overallRisk === 'safe') {
    summary = `تم فحص ${urlResults.length} رابط — جميعها تبدو آمنة.`;
  } else if (overallRisk === 'suspicious') {
    summary = `تحذير: ${suspiciousLinks} رابط مريب من أصل ${urlResults.length} رابط.`;
  } else {
    summary = `خطر: تم اكتشاف ${dangerousLinks} رابط خطير — لا تضغط على أي رابط!`;
  }

  return {
    id: crypto.randomUUID(),
    scannedAt: new Date(),
    emailSnippet: content.slice(0, 200),
    totalLinksFound: urlResults.length,
    safeLinks,
    suspiciousLinks,
    dangerousLinks,
    urlResults,
    overallRisk,
    summary,
  };
}
