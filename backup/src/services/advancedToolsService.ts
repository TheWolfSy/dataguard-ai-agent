import { dbEncrypt, dbDecryptSafe } from './dbCrypto';
import { createDefaultLlmClient, type LlmClient } from './llmClient';
import { getSecurityPolicies } from './sqlService';

export type AdvancedToolId = 'siem' | 'edr' | 'xdr' | 'soar' | 'ndr' | 'cve-scanner';

export interface AdvancedToolConfig {
  enabled: boolean;
  configJson?: string;
}

export interface AdvancedTool {
  tool_id: AdvancedToolId;
  is_enabled: boolean;
  config_json: string;
  created_at: string;
  updated_at: string;
}

export interface ToolActivationResult {
  success: boolean;
  source: 'ai' | 'local-rules' | 'fallback';
  message: string;
  rulesApplied?: string[];
  aiAnalysis?: string;
}

export const ALL_TOOL_IDS: AdvancedToolId[] = ['siem', 'edr', 'xdr', 'soar', 'ndr', 'cve-scanner'];

const TOOL_DESCRIPTIONS: Record<AdvancedToolId, { name: string; description: string; risk: string }> = {
  siem: { name: 'SIEM', description: 'Security Information & Event Management', risk: 'medium' },
  edr: { name: 'EDR', description: 'Endpoint Detection & Response', risk: 'high' },
  xdr: { name: 'XDR', description: 'Extended Detection & Response', risk: 'high' },
  soar: { name: 'SOAR', description: 'Security Orchestration & Automation', risk: 'medium' },
  ndr: { name: 'NDR', description: 'Network Detection & Response', risk: 'medium' },
  'cve-scanner': { name: 'CVE Scanner', description: 'Code vulnerability scanner against CVE database', risk: 'high' },
};

async function getDbLazy() {
  const mod = await import('../database');
  return mod.getDb();
}

async function getActiveLlmClient(): Promise<LlmClient | null> {
  try {
    const mod = await import('./aiProviderService');
    if (typeof mod.getActiveProviderConfig === 'function') {
      const config = await mod.getActiveProviderConfig();
      if (config?.providerId && config?.apiKey) {
        const { createLlmClient } = await import('./llmClient');
        return (await createLlmClient(config.providerId as any)).client;
      }
    }
    return createDefaultLlmClient();
  } catch {
    return createDefaultLlmClient();
  }
}

async function analyzeWithAI(toolId: AdvancedToolId, enabled: boolean): Promise<string | null> {
  try {
    const llmClient = await getActiveLlmClient();
    if (!llmClient || llmClient.providerId === 'rule-based-local') {
      return null;
    }

    const tool = TOOL_DESCRIPTIONS[toolId];
    const action = enabled ? 'enable' : 'disable';
    const userMessage = `${action} ${tool.name} - ${tool.description}. Risk level: ${tool.risk}. Provide analysis and recommendations.`;

    const response = await llmClient.complete({
      messages: [
        { role: 'system', content: 'You are a security analyst. Analyze tool activations and provide recommendations.' },
        { role: 'user', content: userMessage },
      ],
      profileLabel: 'Security Analyst',
      conservatism: 'medium',
    });

    return response.text;
  } catch (err) {
    console.warn('[AdvancedTools] AI analysis failed:', err);
    return null;
  }
}

async function getLocalRules(toolId: AdvancedToolId, uid: string = ''): Promise<string[]> {
  try {
    const policies = await getSecurityPolicies(uid);
    if (!policies || policies.length === 0) {
      return [];
    }

    const toolRules: string[] = [];
    for (const policy of policies) {
      try {
        const rules = JSON.parse(policy.rules);
        for (const rule of rules) {
          if (rule.toolId === toolId || rule.tools?.includes(toolId)) {
            toolRules.push(rule.name || rule.id);
          }
        }
      } catch {
        // skip invalid JSON
      }
    }
    return toolRules;
  } catch {
    return [];
  }
}

async function notifyActivation(toolId: AdvancedToolId, enabled: boolean, source: 'ai' | 'local-rules' | 'fallback'): Promise<void> {
  try {
    const mod = await import('./notificationCenter');
    const notifyFn = mod.notifyToolActivation;
    if (typeof notifyFn === 'function') {
      await notifyFn(toolId, enabled, source);
    }
  } catch {
    console.log(`[AdvancedTools] Tool ${toolId} ${enabled ? 'enabled' : 'disabled'} via ${source}`);
  }
}

export async function initAdvancedTools(): Promise<void> {
  try {
    const db = await getDbLazy();
    for (const toolId of ALL_TOOL_IDS) {
      await db.query(
        `INSERT INTO advanced_tools (tool_id, is_enabled, config_json, created_at, updated_at)
         VALUES ($1, FALSE, '{}', NOW(), NOW())
         ON CONFLICT (tool_id) DO NOTHING`,
        [toolId],
      );
    }
  } catch (err) {
    console.error('[AdvancedTools] init failed:', err);
  }
}

export async function getToolState(toolId: AdvancedToolId): Promise<boolean> {
  try {
    const db = await getDbLazy();
    const result = await db.query<{ is_enabled: boolean }>(
      `SELECT is_enabled FROM advanced_tools WHERE tool_id = $1`,
      [toolId],
    );
    return result.rows[0]?.is_enabled ?? false;
  } catch {
    return false;
  }
}

export async function setToolState(toolId: AdvancedToolId, enabled: boolean): Promise<void> {
  try {
    const db = await getDbLazy();
    await db.query(
      `UPDATE advanced_tools SET is_enabled = $1, updated_at = NOW() WHERE tool_id = $2`,
      [enabled, toolId],
    );
  } catch (err) {
    console.error('[AdvancedTools] setToolState failed:', err);
    throw err;
  }
}

export async function activateTool(toolId: AdvancedToolId, enabled: boolean, uid: string = ''): Promise<ToolActivationResult> {
  const tool = TOOL_DESCRIPTIONS[toolId];
  let source: 'ai' | 'local-rules' | 'fallback' = 'fallback';
  let message = '';
  let rulesApplied: string[] = [];
  let aiAnalysis: string | undefined;

  const aiResult = await analyzeWithAI(toolId, enabled);
  if (aiResult) {
    source = 'ai';
    aiAnalysis = aiResult;
    message = `AI analysis completed for ${tool.name}`;
  }

  const localRules = await getLocalRules(toolId, uid);
  if (localRules.length > 0) {
    source = source === 'ai' ? 'ai' : 'local-rules';
    rulesApplied = localRules;
    message = message || `Applied ${localRules.length} local rule(s) for ${tool.name}`;
  }

  if (!aiResult && localRules.length === 0) {
    source = 'fallback';
    message = `${tool.name} ${enabled ? 'enabled' : 'disabled'} successfully`;
  }

  await setToolState(toolId, enabled);
  await notifyActivation(toolId, enabled, source);

  return {
    success: true,
    source,
    message,
    rulesApplied,
    aiAnalysis,
  };
}

export async function getToolConfig(toolId: AdvancedToolId): Promise<AdvancedToolConfig> {
  try {
    const db = await getDbLazy();
    const result = await db.query<{ is_enabled: boolean; config_json: string }>(
      `SELECT is_enabled, config_json FROM advanced_tools WHERE tool_id = $1`,
      [toolId],
    );
    const row = result.rows[0];
    if (!row) return { enabled: false };
    return {
      enabled: row.is_enabled,
      configJson: row.config_json,
    };
  } catch {
    return { enabled: false };
  }
}

export async function setToolConfig(toolId: AdvancedToolId, config: Record<string, unknown>): Promise<void> {
  try {
    const db = await getDbLazy();
    const configJson = JSON.stringify(config);
    const encrypted = await dbEncrypt(configJson);
    await db.query(
      `UPDATE advanced_tools SET config_json = $1, updated_at = NOW() WHERE tool_id = $2`,
      [encrypted, toolId],
    );
  } catch (err) {
    console.error('[AdvancedTools] setToolConfig failed:', err);
    throw err;
  }
}

export async function getAllToolsState(): Promise<Record<AdvancedToolId, boolean>> {
  const result: Record<AdvancedToolId, boolean> = {
    siem: false,
    edr: false,
    xdr: false,
    soar: false,
    ndr: false,
    'cve-scanner': false,
  };
  try {
    const db = await getDbLazy();
    const queryResult = await db.query<{ tool_id: AdvancedToolId; is_enabled: boolean }>(
      `SELECT tool_id, is_enabled FROM advanced_tools`,
    );
    const rows = queryResult.rows;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      result[row.tool_id] = row.is_enabled;
    }
  } catch {
    // return defaults
  }
  return result;
}