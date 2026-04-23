import type { AgentContext, AgentDecision, AgentPlanStep } from './agentCore';

export interface AgentMemoryEntry {
  context: Pick<AgentContext, 'uid' | 'profileId' | 'content'>;
  plan: AgentPlanStep[];
  decisions: AgentDecision[];
  summary: string;
  createdAt: string;
}

export interface MemoryStore {
  saveRun(entry: AgentMemoryEntry): Promise<void>;
  getLastRun(uid: string): Promise<AgentMemoryEntry | null>;
}

class InMemoryStore implements MemoryStore {
  private readonly entries = new Map<string, AgentMemoryEntry>();

  async saveRun(entry: AgentMemoryEntry): Promise<void> {
    this.entries.set(entry.context.uid, entry);
  }

  async getLastRun(uid: string): Promise<AgentMemoryEntry | null> {
    return this.entries.get(uid) ?? null;
  }
}

export function createInMemoryStore(): MemoryStore {
  return new InMemoryStore();
}
