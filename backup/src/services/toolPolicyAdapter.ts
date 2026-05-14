import {
  enforceToolPolicy,
  sanitizeForResponse,
  buildDynamicRules,
  type DynamicPolicyRule,
} from './policyEngine';
import { getActivePolicyRules } from './sqlService';
import type { ToolExecutionContext, ToolMetadata } from './toolContract';

export interface ToolPolicyAdapter {
  enforce(args: {
    toolName: string;
    input: unknown;
    metadata?: ToolMetadata;
    context?: ToolExecutionContext;
  }): Promise<void>;
  sanitize<T>(value: T): T;
}

/** Module-level cache of dynamic rules for the active user session. */
let _activeDynamicRules: DynamicPolicyRule[] = [];

/** Called by the orchestrator after login to pre-load active CVE/policy rules. */
export function setActiveDynamicRules(rules: DynamicPolicyRule[]): void {
  _activeDynamicRules = rules;
}

export function getActiveDynamicRules(): DynamicPolicyRule[] {
  return _activeDynamicRules;
}

/**
 * Refreshes the dynamic rules from the DB for the given user.
 * Should be called on login and after policy sync.
 */
export async function refreshDynamicRules(uid: string): Promise<void> {
  try {
    const policyRecords = await getActivePolicyRules(uid);
    _activeDynamicRules = buildDynamicRules(policyRecords);
  } catch (err) {
    console.error('[PolicyAdapter] Failed to refresh dynamic rules:', err);
  }
}

export const defaultToolPolicyAdapter: ToolPolicyAdapter = {
  async enforce(args) {
    await enforceToolPolicy({ ...args, dynamicRules: _activeDynamicRules });
  },
  sanitize<T>(value: T): T {
    return sanitizeForResponse(value);
  },
};
