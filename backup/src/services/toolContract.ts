export type ToolStatus = 'success' | 'failure';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ToolExecutionActor {
  uid: string;
  userEmail?: string;
}

export interface ToolExecutionContext {
  actor?: ToolExecutionActor;
  confirmedTools?: string[];
  source?: 'agent';
}

export interface ToolMetadata {
  destructive?: boolean;
  mutatesState?: boolean;
}

export interface ToolResult<TOutput> {
  success: ToolStatus;
  output: TOutput;
  riskLevel: RiskLevel;
  nextSuggestions: string[];
  error?: string;
}
