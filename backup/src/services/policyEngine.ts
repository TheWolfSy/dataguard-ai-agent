import { insertSecurityEvent } from './sqlService';
import type { ActivePolicyRule } from './sqlService';
import type { ToolExecutionContext, ToolMetadata } from './toolContract';

const DANGEROUS_COMMAND_PATTERNS = [
  /(^|\s)(rm\s+-rf|del\s+\/f|format\s+[a-z]:|shutdown\s+\/s|reboot|mkfs|diskpart|drop\s+table|truncate\s+table)(\s|$)/i,
  /(^|\s)(curl|wget).*(\||>|>>)/i,
  /powershell.*(invoke-expression|iex)/i,
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(the\s+)?system\s+prompt/i,
  /reveal\s+(your\s+)?(system|developer)\s+prompt/i,
  /bypass\s+(your\s+)?safety/i,
  /act\s+as\s+(an\s+)?unrestricted/i,
  /tool\s*:\s*/i,
  /function\s*call/i,
];

const SECRET_PATTERNS = [
  /(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi,
  /bearer\s+[a-z0-9\-._~+/]+=*/gi,
  /sk-[a-z0-9]{16,}/gi,
  /AIza[0-9A-Za-z\-_]{20,}/g,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+/g,
];

const REDACTED_SECRET = '[REDACTED_SECRET]';

export class PolicyViolationError extends Error {
  readonly code: 'dangerous_command' | 'prompt_injection';

  constructor(code: 'dangerous_command' | 'prompt_injection', message: string) {
    super(message);
    this.name = 'PolicyViolationError';
    this.code = code;
  }
}

export class ToolConfirmationRequiredError extends Error {
  readonly toolName: string;

  constructor(toolName: string, message: string) {
    super(message);
    this.name = 'ToolConfirmationRequiredError';
    this.toolName = toolName;
  }
}

function getActor(context?: ToolExecutionContext): { uid?: string; userEmail?: string } {
  return {
    uid: context?.actor?.uid,
    userEmail: context?.actor?.userEmail,
  };
}

function collectStrings(value: unknown, target: string[]): void {
  if (typeof value === 'string') {
    target.push(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, target));
    return;
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, target));
  }
}

function trimForAudit(value: string): string {
  const flattened = value.replace(/\s+/g, ' ').trim();
  return flattened.length > 180 ? `${flattened.slice(0, 177)}...` : flattened;
}

async function recordSecurityEvent(
  context: ToolExecutionContext | undefined,
  resourcePath: string,
  details: string,
  targetPath?: string
): Promise<void> {
  const actor = getActor(context);
  await insertSecurityEvent({
    uid: actor.uid,
    userEmail: actor.userEmail,
    resourcePath,
    details,
    targetPath,
  });
}

// ── CVE / Dynamic Policy Rule extraction ────────────────────────────────────

export interface DynamicPolicyRule {
  pattern: RegExp | string;
  message: string;
  source: string;
}

/**
 * Parses the cached rulesJson of a policy into enforceable block-rules.
 * Supports two JSON shapes:
 *  1. Structured: { rules: [{ type: 'block_pattern'|'keyword', pattern, message }] }
 *  2. Flat keyword list: { keywords: string[] }
 * Pending-sync CVE placeholders are skipped (no rules yet).
 */
export function extractPolicyRules(policy: ActivePolicyRule): DynamicPolicyRule[] {
  const { rulesJson, name } = policy;
  if (!rulesJson) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(rulesJson);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== 'object') return [];
  const obj = parsed as Record<string, unknown>;

  // Skip pending-sync placeholders (CVE source not fetched yet)
  if (obj['status'] === 'pending-sync') return [];

  const result: DynamicPolicyRule[] = [];

  // Shape 1: structured rules array
  if (Array.isArray(obj['rules'])) {
    for (const rule of obj['rules'] as Array<Record<string, unknown>>) {
      if (
        (rule['type'] === 'block_pattern' || rule['type'] === 'keyword') &&
        typeof rule['pattern'] === 'string'
      ) {
        const msgRaw = typeof rule['message'] === 'string' ? rule['message'] : undefined;
        const msg = msgRaw ?? `Blocked by policy "${name}": matched rule "${rule['pattern']}"`;
        try {
          result.push({ pattern: new RegExp(rule['pattern'] as string, 'i'), message: msg, source: name });
        } catch {
          result.push({ pattern: (rule['pattern'] as string).toLowerCase(), message: msg, source: name });
        }
      }
    }
  }

  // Shape 2: flat keyword list
  if (Array.isArray(obj['keywords'])) {
    for (const kw of obj['keywords'] as unknown[]) {
      if (typeof kw === 'string' && kw.trim()) {
        result.push({
          pattern: kw.trim().toLowerCase(),
          message: `Blocked by policy "${name}": keyword "${kw.trim()}"`,
          source: name,
        });
      }
    }
  }

  // Shape 3: blocked CVE IDs list  { blocked_cves: ["CVE-2024-1234"] }
  if (Array.isArray(obj['blocked_cves'])) {
    for (const cveId of obj['blocked_cves'] as unknown[]) {
      if (typeof cveId === 'string') {
        result.push({
          pattern: new RegExp(cveId.replace('-', '[\\-\\s]?'), 'i'),
          message: `Blocked by CVE policy: reference to blocked vulnerability ${cveId}`,
          source: name,
        });
      }
    }
  }

  return result;
}

/**
 * Converts a list of active policy records into a flat array of dynamic rules.
 */
export function buildDynamicRules(policies: ActivePolicyRule[]): DynamicPolicyRule[] {
  return policies.flatMap(extractPolicyRules);
}

/**
 * Builds a compact system-prompt injection describing enforced policies.
 * Used to inform the LLM chatbot about active CVE/security policy constraints.
 */
export function buildPolicySystemContext(policies: ActivePolicyRule[]): string {
  const active = policies.filter((p) => p.rulesJson);
  if (active.length === 0) return '';

  const lines: string[] = [
    'The following security policies are currently active and MUST be respected:',
  ];

  for (const p of active) {
    let rulesObj: Record<string, unknown> = {};
    try { rulesObj = JSON.parse(p.rulesJson!) as Record<string, unknown>; } catch { /* ignore */ }

    if (rulesObj['status'] === 'pending-sync') {
      lines.push(`- "${p.name}" [${p.isDefaultSource ? 'Default CVE Source' : 'Remote Policy'}]: Pending initial sync. Apply conservative CVE-aware restrictions.`);
    } else {
      const ruleCount =
        (Array.isArray(rulesObj['rules']) ? (rulesObj['rules'] as unknown[]).length : 0) +
        (Array.isArray(rulesObj['keywords']) ? (rulesObj['keywords'] as unknown[]).length : 0);
      lines.push(`- "${p.name}": ${ruleCount > 0 ? `${ruleCount} active rule(s)` : 'loaded'}. Do not assist with any request that violates this policy.`);
    }
  }

  lines.push(
    'Do not provide exploit code, bypass instructions, or guidance that violates these policies.',
    'If a user request risks violating a policy, decline and explain the policy constraint.',
  );

  return lines.join('\n');
}

export async function enforceToolPolicy(args: {
  toolName: string;
  input: unknown;
  metadata?: ToolMetadata;
  context?: ToolExecutionContext;
  /** Pre-extracted dynamic rules from active CVE/remote policies */
  dynamicRules?: DynamicPolicyRule[];
}): Promise<void> {
  const { toolName, input, metadata, context, dynamicRules } = args;
  const strings: string[] = [];
  collectStrings(input, strings);

  const dangerousMatch = strings.find((value) => DANGEROUS_COMMAND_PATTERNS.some((pattern) => pattern.test(value)));
  if (dangerousMatch) {
    await recordSecurityEvent(
      context,
      `policy/${toolName}`,
      `Blocked dangerous command pattern before tool execution. Sample: ${trimForAudit(redactSecrets(dangerousMatch))}`,
      toolName
    );
    throw new PolicyViolationError('dangerous_command', 'Blocked by policy: dangerous command pattern detected in tool input.');
  }

  const promptInjectionMatch = strings.find((value) => PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(value)));
  if (promptInjectionMatch) {
    await recordSecurityEvent(
      context,
      `policy/${toolName}`,
      `Blocked prompt injection attempt before tool execution. Sample: ${trimForAudit(redactSecrets(promptInjectionMatch))}`,
      toolName
    );
    throw new PolicyViolationError('prompt_injection', 'Blocked by policy: prompt injection indicators detected in tool input.');
  }

  if (metadata?.destructive && !context?.confirmedTools?.includes(toolName)) {
    await recordSecurityEvent(
      context,
      `policy/${toolName}`,
      'User confirmation required before destructive tool execution.',
      toolName
    );
    throw new ToolConfirmationRequiredError(toolName, `Confirmation required before running destructive tool ${toolName}.`);
  }

  // ── Dynamic CVE / remote policy rules enforcement ────────────────────────
  if (dynamicRules && dynamicRules.length > 0) {
    const inputStr = strings.join(' ');
    for (const rule of dynamicRules) {
      const matched =
        typeof rule.pattern === 'string'
          ? inputStr.toLowerCase().includes(rule.pattern)
          : rule.pattern.test(inputStr);
      if (matched) {
        await recordSecurityEvent(
          context,
          `policy/${toolName}`,
          `Blocked by CVE/remote policy rule (source: ${rule.source}): ${trimForAudit(rule.message)}`,
          toolName,
        );
        throw new PolicyViolationError('dangerous_command', rule.message);
      }
    }
  }
}

export function redactSecrets(value: string): string {
  return SECRET_PATTERNS.reduce((sanitized, pattern) => sanitized.replace(pattern, REDACTED_SECRET), value);
}

export function sanitizeForResponse<T>(value: T): T {
  if (typeof value === 'string') {
    return redactSecrets(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForResponse(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, sanitizeForResponse(entryValue)])
    ) as T;
  }

  return value;
}