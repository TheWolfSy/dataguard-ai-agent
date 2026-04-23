import { runEncryptionTool } from './encryption';
import { defaultToolPolicyAdapter, type ToolPolicyAdapter } from './toolPolicyAdapter.ts';
import { runInsertDataLogTool } from './sqlService';
import { runSecurityScanTool } from './securityScanner';
import type { ToolExecutionContext, ToolMetadata, ToolResult } from './toolContract';

export type ToolName = 'security.scanData' | 'encryption.encryptData' | 'sql.insertDataLog';

type ToolHandler<TInput = unknown, TOutput = unknown> =
  | ((input: TInput) => ToolResult<TOutput>)
  | ((input: TInput) => Promise<ToolResult<TOutput>>);

interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: ToolName;
  description: string;
  metadata: ToolMetadata;
  run: ToolHandler<TInput, TOutput>;
}

export class ToolRegistry {
  constructor(
    private readonly executionContext?: ToolExecutionContext,
    private readonly policyAdapter: ToolPolicyAdapter = defaultToolPolicyAdapter
  ) {}

  private readonly tools = new Map<ToolName, ToolDefinition<any, any>>();

  registerTool<TInput, TOutput>(
    name: ToolName,
    description: string,
    run: ToolHandler<TInput, TOutput>,
    metadata: ToolMetadata = {}
  ): void {
    this.tools.set(name, { name, description, run, metadata });
  }

  getTool(name: ToolName): ToolDefinition<any, any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not registered: ${name}`);
    }
    return tool;
  }

  async executeToolRaw<TInput, TOutput>(name: ToolName, input: TInput): Promise<ToolResult<TOutput>> {
    const tool = this.getTool(name);
    await this.policyAdapter.enforce({
      toolName: name,
      input,
      metadata: tool.metadata,
      context: this.executionContext,
    });
    const result = await tool.run(input);
    return result as ToolResult<TOutput>;
  }

  async executeTool<TInput, TOutput>(name: ToolName, input: TInput): Promise<ToolResult<TOutput>> {
    const result = await this.executeToolRaw<TInput, TOutput>(name, input);
    return {
      ...result,
      output: this.policyAdapter.sanitize(result.output),
      error: result.error ? this.policyAdapter.sanitize(result.error) : result.error,
    };
  }

  listTools(): Array<{ name: ToolName; description: string }> {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }
}

export function createDefaultToolRegistry(
  executionContext?: ToolExecutionContext,
  policyAdapter: ToolPolicyAdapter = defaultToolPolicyAdapter
): ToolRegistry {
  const registry = new ToolRegistry(executionContext, policyAdapter);

  registry.registerTool('security.scanData', 'Classify content and detect PII risks.', ({ content }: { content: string }) =>
    runSecurityScanTool(content),
    { mutatesState: false }
  );

  registry.registerTool('encryption.encryptData', 'Encrypt raw content with AES-256 before persistence.', ({ text }: { text: string }) =>
    runEncryptionTool(text),
    { mutatesState: false }
  );

  registry.registerTool('sql.insertDataLog', 'Persist encrypted data log into SQL store.', ({
    log,
  }: {
    log: Parameters<typeof runInsertDataLogTool>[0];
  }) => runInsertDataLogTool(log), { mutatesState: true });

  return registry;
}
