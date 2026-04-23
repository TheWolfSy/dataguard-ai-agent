import type { LlmMessage, LlmCompletionRequest, LlmCompletionResponse, LlmClient, LlmProviderId, LlmProviderOption } from './llmClient';

export type { LlmProviderId };
export class OllamaLlmClient implements LlmClient {
  providerId: LlmProviderId = 'ollama-local';
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl ?? (import.meta.env?.VITE_OLLAMA_URL ?? 'http://localhost:11434');
    this.model = model ?? (import.meta.env?.VITE_OLLAMA_MODEL ?? 'deepseek-coder:1.3b');
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const messages = request.messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    const systemPrompt = `You are assisting DataGuard Agent planning. Keep output concise and actionable.\nProfile: ${request.profileLabel}\nConservatism: ${request.conservatism}`;

    const prompt = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ]
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.5,
          num_predict: 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      text: data.response ?? `[${request.profileLabel}] No model response returned.`,
    };
  }
}

export function createOllamaClient(baseUrl?: string, model?: string): LlmClient {
  return new OllamaLlmClient(baseUrl, model);
}

export function createOllamaLlmClientFactoryResult() {
  return {
    client: createOllamaClient(),
  };
}