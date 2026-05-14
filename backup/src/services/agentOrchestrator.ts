import {
  type AgentCoreDependencies,
  runSecurityBrainLoopCore,
  type AgentContext,
  type AgentDecision,
  type AgentOutcome,
  type AgentPhase,
  type AgentPlanStep,
  type AgentProfileId,
} from './agentCore';
import {
  LLM_PROVIDER_OPTIONS,
  createLlmClient,
  type LlmProviderId,
} from './llmClient';
import { createInMemoryStore } from './memoryStore';
import { defaultToolPolicyAdapter, refreshDynamicRules, getActiveDynamicRules } from './toolPolicyAdapter';
import { createDefaultToolRegistry } from './toolRegistry';
import {
  initAgentCache,
  getCachedResponse,
  setCachedResponse,
} from './agentCacheService';
import { getActivePolicyRules, searchLocalPolicyData } from './sqlService';
import { buildDynamicRules, buildPolicySystemContext } from './policyEngine';

export type {
  AgentContext,
  AgentDecision,
  AgentOutcome,
  AgentPhase,
  AgentPlanStep,
  AgentProfileId,
};

export type AgentLlmProviderId = LlmProviderId;
export const AGENT_LLM_PROVIDERS = LLM_PROVIDER_OPTIONS;

const sharedMemoryStore = createInMemoryStore();

// Boot the local Redis-style cache (creates table if not yet present)
initAgentCache().catch(console.error);

let activeProviderId: AgentLlmProviderId = 'rule-based-local';
let providerWarning: string | null = null;

function buildDependencies(providerId: AgentLlmProviderId): AgentCoreDependencies {
  const { client, warning } = createLlmClient(providerId);
  activeProviderId = client.providerId;
  providerWarning = warning ?? null;

  return {
    llmClient: client,
    memoryStore: sharedMemoryStore,
    createToolRegistry: (executionContext) =>
      createDefaultToolRegistry(executionContext, defaultToolPolicyAdapter),
  };
}

let runtimeDependencies: AgentCoreDependencies = buildDependencies(activeProviderId);

export function setAgentLlmProvider(providerId: AgentLlmProviderId): {
  activeProviderId: AgentLlmProviderId;
  warning?: string;
} {
  runtimeDependencies = buildDependencies(providerId);
  return {
    activeProviderId,
    warning: providerWarning ?? undefined,
  };
}

export function getAgentLlmProvider(): AgentLlmProviderId {
  return activeProviderId;
}

/** Tracks the active user's UID so policy rules can be loaded per-user. */
let _activeUserUid: string | null = null;

/**
 * Called on login / user switch to pre-load CVE/remote policy rules for the session.
 * All subsequent tool executions and chatbot responses will be governed by these rules.
 */
export async function setActiveUser(uid: string): Promise<void> {
  _activeUserUid = uid;
  await refreshDynamicRules(uid);
}

export function clearActiveUser(): void {
  _activeUserUid = null;
}

export function getAgentLlmProviderWarning(): string | null {
  return providerWarning;
}

function mapProfileContext(profileId: AgentProfileId): {
  label: string;
  conservatism: 'low' | 'medium' | 'high';
} {
  if (profileId === 'sql-assistant') {
    return { label: 'SQL Assistant', conservatism: 'medium' };
  }
  if (profileId === 'compliance-advisor') {
    return { label: 'Compliance Advisor', conservatism: 'high' };
  }
  return { label: 'Security Auditor', conservatism: 'high' };
}

export async function generateLiveAgentChatReply(args: {
  message: string;
  profileId: AgentProfileId;
  responseLanguage?: 'ar' | 'en';
}): Promise<{ text: string; providerId: AgentLlmProviderId; warning?: string; fromCache?: boolean; policyBlocked?: boolean }> {
  const lang: 'ar' | 'en' = args.responseLanguage ?? 'en';
  const cacheKey = `${lang}::${args.message}`;

  // ── 0. CVE / Policy enforcement on user message ───────────────────────
  // Load fresh policy rules for the active user (uses module-level cache)
  const dynamicRules = getActiveDynamicRules();

  if (dynamicRules.length > 0) {
    const msgLower = args.message.toLowerCase();
    for (const rule of dynamicRules) {
      const matched =
        typeof rule.pattern === 'string'
          ? msgLower.includes(rule.pattern)
          : rule.pattern.test(args.message);
      if (matched) {
        return {
          text: lang === 'ar'
            ? `⚠️ **تم الحظر بواسطة السياسة**: ${rule.message}`
            : `⚠️ **Policy Blocked**: ${rule.message}`,
          providerId: activeProviderId,
          policyBlocked: true,
        };
      }
    }
  }

  // ── 1. Cache lookup (Redis GET) ───────────────────────────────────────
  const cached = await getCachedResponse(cacheKey).catch(() => null);
  if (cached) {
    return {
      text: cached.answer,
      providerId: cached.providerId as AgentLlmProviderId,
      fromCache: true,
    };
  }

  // ── 2. Local CVE / Policy DB search ──────────────────────────────────
  let localContext = '';
  if (_activeUserUid) {
    try {
      const localMatches = await searchLocalPolicyData(_activeUserUid, args.message);
      if (localMatches.length > 0) {
        const excerpts = localMatches
          .map((m) => `[${m.policyName}${m.isDefaultSource ? ' • CVE Database' : ''}]\n${m.excerpt}`)
          .join('\n\n---\n\n');
        localContext = `The following relevant data was found in the local security policy database:\n\n${excerpts}\n\nUse this data to answer the question. If it is insufficient, supplement with your own knowledge.`;
      }
    } catch { /* non-critical — proceed without local context */ }
  }

  // ── 3. Build LLM prompt (with local data if available) ───────────────
  const profile = mapProfileContext(args.profileId);

  // Build policy-aware system prompt
  let policyContext = '';
  if (_activeUserUid) {
    try {
      const policyRecords = await getActivePolicyRules(_activeUserUid);
      policyContext = buildPolicySystemContext(policyRecords);
    } catch { /* non-critical — proceed without policy context */ }
  }

  const baseSystemPrompt =
    'You are DataGuard live assistant. Provide concise, practical security guidance and avoid unsafe instructions.';
  const languagePrompt =
    lang === 'ar'
      ? 'IMPORTANT: Reply in Arabic only. Use clear Modern Standard Arabic. Do not mix languages unless the user explicitly uses both.'
      : 'IMPORTANT: Reply in English only. Do not switch languages unless the user explicitly uses both.';

  const systemPrompt = [baseSystemPrompt, languagePrompt, policyContext, localContext]
    .filter(Boolean)
    .join('\n\n');

  const completion = await runtimeDependencies.llmClient.complete({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: args.message },
    ],
    profileLabel: profile.label,
    conservatism: profile.conservatism,
  });

  // ── 4. Store result in cache (Redis SET — deletes stale duplicate first) ──
  setCachedResponse(cacheKey, completion.text, activeProviderId).catch(console.error);

  return {
    text: completion.text,
    providerId: activeProviderId,
    warning: providerWarning ?? undefined,
    fromCache: false,
  };
}

export async function runSecurityBrainLoop(context: AgentContext): Promise<AgentOutcome> {
  return runSecurityBrainLoopCore(context, runtimeDependencies);
}
