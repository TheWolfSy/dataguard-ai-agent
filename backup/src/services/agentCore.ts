import { runSecurityScanTool, type ScanResult } from './securityScanner';
import { createDefaultLlmClient, type LlmClient } from './llmClient';
import { createInMemoryStore, type MemoryStore } from './memoryStore';
import { defaultToolPolicyAdapter } from './toolPolicyAdapter.ts';
import {
  createDefaultToolRegistry,
  type ToolName,
  type ToolRegistry,
} from './toolRegistry';
import type { RiskLevel, ToolExecutionContext } from './toolContract';

export type AgentPhase = 'goal' | 'plan' | 'act' | 'observe' | 'reflect';
export type AgentProfileId = 'security-auditor' | 'sql-assistant' | 'compliance-advisor';

type AgentConservatism = 'low' | 'medium' | 'high';

interface AgentProfileConfig {
  id: AgentProfileId;
  label: 'Security Auditor' | 'SQL Assistant' | 'Compliance Advisor';
  systemPrompt: string;
  allowedTools: ToolName[];
  responseStyle: string;
  conservatism: AgentConservatism;
}

const AGENT_PROFILES: Record<AgentProfileId, AgentProfileConfig> = {
  'security-auditor': {
    id: 'security-auditor',
    label: 'Security Auditor',
    systemPrompt:
      'You are a Security Auditor. Prioritize threat detection, strict policy adherence, and least-privilege execution.',
    allowedTools: ['security.scanData', 'encryption.encryptData'],
    responseStyle: 'Strict, risk-first, evidence-oriented.',
    conservatism: 'high',
  },
  'sql-assistant': {
    id: 'sql-assistant',
    label: 'SQL Assistant',
    systemPrompt:
      'You are an SQL Assistant. Optimize secure data handling and persistence workflows while maintaining validation controls.',
    allowedTools: ['security.scanData', 'encryption.encryptData', 'sql.insertDataLog'],
    responseStyle: 'Technical, concise, implementation-focused.',
    conservatism: 'medium',
  },
  'compliance-advisor': {
    id: 'compliance-advisor',
    label: 'Compliance Advisor',
    systemPrompt:
      'You are a Compliance Advisor. Emphasize policy compliance, auditability, and non-destructive recommendations.',
    allowedTools: ['security.scanData'],
    responseStyle: 'Policy-centric, cautious, recommendation-only.',
    conservatism: 'high',
  },
};

export interface AgentDecision {
  phase: AgentPhase;
  decision: string;
  reason: string;
  tool?: ToolName;
  riskLevel?: RiskLevel;
  timestamp: string;
  outputSummary?: string;
}

export interface AgentPlanStep {
  id: string;
  description: string;
  tool?: ToolName;
}

export interface AgentContext {
  uid: string;
  userEmail?: string;
  content: string;
  confirmedTools?: ToolName[];
  profileId?: AgentProfileId;
}

export interface AgentOutcome {
  scanResult: ScanResult;
  logId: string;
  encryptedContent: string;
  intention: 'scan_and_store' | 'scan_only';
  summary: string;
  nextStep: string;
  plan: AgentPlanStep[];
  decisions: AgentDecision[];
  availableTools: Array<{ name: ToolName; description: string }>;
  profile: {
    id: AgentProfileId;
    label: string;
    responseStyle: string;
    conservatism: AgentConservatism;
    systemPrompt: string;
  };
  llmProvider: string;
}

export interface AgentCoreDependencies {
  llmClient: LlmClient;
  memoryStore: MemoryStore;
  createToolRegistry: (executionContext?: ToolExecutionContext) => ToolRegistry;
}

function nowIso(): string {
  return new Date().toISOString();
}

function pushDecision(
  decisions: AgentDecision[],
  phase: AgentPhase,
  decision: string,
  reason: string,
  tool?: AgentDecision['tool'],
  outputSummary?: string,
  riskLevel?: RiskLevel
): void {
  decisions.push({
    phase,
    decision,
    reason,
    tool,
    riskLevel,
    outputSummary,
    timestamp: nowIso(),
  });
}

function detectIntent(content: string): AgentOutcome['intention'] {
  const normalized = content.toLowerCase();
  if (normalized.includes('scan only') || normalized.includes('analysis only')) {
    return 'scan_only';
  }
  return 'scan_and_store';
}

function formatProfileSummary(profile: AgentProfileConfig, summary: string): string {
  if (profile.id === 'security-auditor') {
    return `[Security Auditor] ${summary} Prioritize containment and verification before further action.`;
  }
  if (profile.id === 'sql-assistant') {
    return `[SQL Assistant] ${summary}`;
  }
  return `[Compliance Advisor] ${summary} Keep actions aligned with policy and audit requirements.`;
}

function formatProfileNextStep(profile: AgentProfileConfig, nextStep: string): string {
  if (profile.conservatism === 'high') {
    return `${nextStep} Do not execute state-changing operations without explicit confirmation.`;
  }
  return nextStep;
}

function buildExecutionPlan(intention: AgentOutcome['intention']): AgentPlanStep[] {
  if (intention === 'scan_only') {
    return [
      { id: 'p1', description: 'Run content security scan', tool: 'security.scanData' },
      { id: 'p2', description: 'Observe risk level and produce recommendation' },
      { id: 'p3', description: 'Reflect with clear next action' },
    ];
  }

  return [
    { id: 'p1', description: 'Run content security scan', tool: 'security.scanData' },
    { id: 'p2', description: 'Encrypt raw content before persistence', tool: 'encryption.encryptData' },
    { id: 'p3', description: 'Store secure log in SQL', tool: 'sql.insertDataLog' },
    { id: 'p4', description: 'Reflect with clear next action' },
  ];
}

export function createDefaultAgentCoreDependencies(): AgentCoreDependencies {
  return {
    llmClient: createDefaultLlmClient(),
    memoryStore: createInMemoryStore(),
    createToolRegistry: (executionContext) =>
      createDefaultToolRegistry(executionContext, defaultToolPolicyAdapter),
  };
}

export async function runSecurityBrainLoopCore(
  context: AgentContext,
  dependencies: AgentCoreDependencies
): Promise<AgentOutcome> {
  const profile = AGENT_PROFILES[context.profileId ?? 'security-auditor'];
  const registry = dependencies.createToolRegistry({
    actor: {
      uid: context.uid,
      userEmail: context.userEmail,
    },
    confirmedTools: context.confirmedTools,
    source: 'agent',
  });

  const availableTools = registry
    .listTools()
    .filter((tool) => profile.allowedTools.includes(tool.name));

  const decisions: AgentDecision[] = [];
  const requestedIntention = detectIntent(context.content);
  const canPersist =
    profile.allowedTools.includes('encryption.encryptData') &&
    profile.allowedTools.includes('sql.insertDataLog');
  const intention =
    requestedIntention === 'scan_and_store' && canPersist
      ? 'scan_and_store'
      : 'scan_only';

  const llmHint = await dependencies.llmClient.complete({
    messages: [
      { role: 'system', content: profile.systemPrompt },
      { role: 'user', content: context.content },
    ],
    profileLabel: profile.label,
    conservatism: profile.conservatism,
  });

  const goal =
    intention === 'scan_only'
      ? 'Analyze text for classification and PII without writing to the database.'
      : 'Analyze text for classification and PII, then protect and store it safely.';

  pushDecision(
    decisions,
    'goal',
    'Set agent goal based on user input intent.',
    `Profile: ${profile.label}. Prompt: ${profile.systemPrompt} Intent detected: ${requestedIntention}. Effective intent: ${intention}. Goal selected: ${goal}. LLM hint: ${llmHint.text}`
  );

  const plan = buildExecutionPlan(intention);
  pushDecision(
    decisions,
    'plan',
    'Built execution plan (Goal -> Plan -> Act -> Observe -> Reflect).',
    `Plan steps: ${plan.map((step) => step.id).join(', ')} | Response style: ${profile.responseStyle} | Conservatism: ${profile.conservatism}`
  );

  if (!profile.allowedTools.includes('security.scanData')) {
    throw new Error(`Profile ${profile.label} is not allowed to run security.scanData.`);
  }

  const scanToolResult = await registry.executeToolRaw<
    { content: string },
    Awaited<ReturnType<typeof runSecurityScanTool>>['output']
  >('security.scanData', { content: context.content });

  if (scanToolResult.success === 'failure') {
    throw new Error(scanToolResult.error ?? 'Security scan tool failed.');
  }

  const scanResult: ScanResult = scanToolResult.output;
  pushDecision(
    decisions,
    'act',
    'Executed security scanner tool.',
    'Scanning is required to classify data and detect PII before any storage action.',
    'security.scanData',
    `Classification: ${scanResult.classification}, PII: ${scanResult.piiDetected ? 'yes' : 'no'}, risk: ${scanToolResult.riskLevel}`,
    scanToolResult.riskLevel
  );

  if (intention === 'scan_only') {
    const summary = `Scan complete: ${scanResult.classification} data with ${
      scanResult.piiDetected ? 'PII detected' : 'no PII detected'
    }.`;

    const nextStep = scanResult.piiDetected
      ? `Apply ${scanResult.protectionStatus.toLowerCase()} before sharing this content.`
      : 'Content can be shared internally with normal controls.';

    pushDecision(
      decisions,
      'observe',
      'Observed scan output and estimated risk.',
      'Observation stage captures evidence for safe recommendation generation.',
      undefined,
      summary
    );

    pushDecision(
      decisions,
      'reflect',
      'Generated final recommendation without persistence.',
      'User requested analysis only; storing was intentionally skipped.',
      undefined,
      nextStep
    );

    const profileSummary = formatProfileSummary(profile, summary);
    const profileNextStep = formatProfileNextStep(profile, nextStep);

    await dependencies.memoryStore.saveRun({
      context: {
        uid: context.uid,
        profileId: profile.id,
        content: context.content,
      },
      plan,
      decisions,
      summary: profileSummary,
      createdAt: nowIso(),
    });

    return {
      scanResult: defaultToolPolicyAdapter.sanitize(scanResult),
      logId: 'N/A',
      encryptedContent: defaultToolPolicyAdapter.sanitize(context.content),
      intention,
      summary: defaultToolPolicyAdapter.sanitize(profileSummary),
      nextStep: defaultToolPolicyAdapter.sanitize(profileNextStep),
      plan,
      decisions: defaultToolPolicyAdapter.sanitize(decisions),
      availableTools,
      profile: {
        id: profile.id,
        label: profile.label,
        responseStyle: profile.responseStyle,
        conservatism: profile.conservatism,
        systemPrompt: profile.systemPrompt,
      },
      llmProvider: dependencies.llmClient.providerId,
    };
  }

  if (!profile.allowedTools.includes('encryption.encryptData')) {
    throw new Error(`Profile ${profile.label} is not allowed to run encryption.encryptData.`);
  }

  const encryptionToolResult = await registry.executeToolRaw<
    { text: string },
    { encryptedText: string; algorithm: 'AES-256'; ciphertextLength: number }
  >('encryption.encryptData', { text: context.content });

  if (encryptionToolResult.success === 'failure') {
    throw new Error(encryptionToolResult.error ?? 'Encryption tool failed.');
  }

  const encryptedContent = encryptionToolResult.output.encryptedText;
  pushDecision(
    decisions,
    'act',
    'Executed encryption tool before persistence.',
    'Raw content should not be stored in clear text for confidentiality.',
    'encryption.encryptData',
    `Encrypted payload length: ${encryptionToolResult.output.ciphertextLength}, risk: ${encryptionToolResult.riskLevel}`,
    encryptionToolResult.riskLevel
  );

  if (!profile.allowedTools.includes('sql.insertDataLog')) {
    throw new Error(`Profile ${profile.label} is not allowed to run sql.insertDataLog.`);
  }

  const sqlToolResult = await registry.executeToolRaw<
    {
      log: {
        uid: string;
        content: string;
        classification: ScanResult['classification'];
        piiDetected: boolean;
        piiDetails: string;
        protectionStatus: ScanResult['protectionStatus'];
      };
    },
    { logId: string; classification: ScanResult['classification']; createdAt: string }
  >('sql.insertDataLog', {
    log: {
      uid: context.uid,
      content: encryptedContent,
      classification: scanResult.classification,
      piiDetected: scanResult.piiDetected,
      piiDetails: scanResult.piiDetails,
      protectionStatus: scanResult.protectionStatus,
    },
  });

  if (sqlToolResult.success === 'failure') {
    throw new Error(sqlToolResult.error ?? 'SQL insertion tool failed.');
  }

  pushDecision(
    decisions,
    'act',
    'Stored secure log in SQL datastore.',
    'Persisting scan evidence supports traceability and future audits.',
    'sql.insertDataLog',
    `Created data log: ${sqlToolResult.output.logId}, risk: ${sqlToolResult.riskLevel}`,
    sqlToolResult.riskLevel
  );

  const summary = `Stored secure scan: ${scanResult.classification} data with ${
    scanResult.piiDetected ? 'PII detected' : 'no PII detected'
  }.`;

  const nextStep = scanResult.piiDetected
    ? `Review PII details and enforce ${scanResult.protectionStatus.toLowerCase()} workflow immediately.`
    : 'No immediate remediation required; continue monitoring with periodic scans.';

  pushDecision(
    decisions,
    'observe',
    'Observed tool outputs and security posture.',
    'Observation consolidates classification, PII flag, and persistence status.',
    undefined,
    summary
  );

  pushDecision(
    decisions,
    'reflect',
    'Provided actionable next step.',
    'Reflection turns observations into an operator-friendly recommendation.',
    undefined,
    nextStep
  );

  const profileSummary = formatProfileSummary(profile, summary);
  const profileNextStep = formatProfileNextStep(profile, nextStep);

  await dependencies.memoryStore.saveRun({
    context: {
      uid: context.uid,
      profileId: profile.id,
      content: context.content,
    },
    plan,
    decisions,
    summary: profileSummary,
    createdAt: nowIso(),
  });

  return {
    scanResult: defaultToolPolicyAdapter.sanitize(scanResult),
    logId: sqlToolResult.output.logId,
    encryptedContent: defaultToolPolicyAdapter.sanitize(encryptedContent),
    intention,
    summary: defaultToolPolicyAdapter.sanitize(profileSummary),
    nextStep: defaultToolPolicyAdapter.sanitize(profileNextStep),
    plan,
    decisions: defaultToolPolicyAdapter.sanitize(decisions),
    availableTools,
    profile: {
      id: profile.id,
      label: profile.label,
      responseStyle: profile.responseStyle,
      conservatism: profile.conservatism,
      systemPrompt: profile.systemPrompt,
    },
    llmProvider: dependencies.llmClient.providerId,
  };
}
