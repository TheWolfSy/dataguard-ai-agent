import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { OllamaLlmClient } from './ollamaClient';

export type LlmMessageRole = 'system' | 'user' | 'assistant';
export type LlmProviderId =
  | 'rule-based-local'
  | 'google-genai'
  | 'openai'
  | 'blackbox'
  | 'claude'
  | 'deepseek'
  | 'qwen'
  | 'ollama-local';

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
}

export interface LlmCompletionRequest {
  messages: LlmMessage[];
  profileLabel: string;
  conservatism: 'low' | 'medium' | 'high';
}

export interface LlmCompletionResponse {
  text: string;
}

export interface LlmClient {
  providerId: LlmProviderId;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
}

export interface LlmProviderOption {
  id: LlmProviderId;
  label: string;
  description: string;
}

export const LLM_PROVIDER_OPTIONS: LlmProviderOption[] = [
  {
    id: 'rule-based-local',
    label: 'Local Rule-Based',
    description: 'Deterministic local fallback with no external API calls.',
  },
  {
    id: 'google-genai',
    label: 'Google GenAI (Gemini)',
    description: 'Cloud LLM provider for richer reasoning and language quality.',
  },
  {
    id: 'openai',
    label: 'OpenAI (GPT-4o)',
    description: 'OpenAI cloud LLM — GPT-4o for advanced security analysis.',
  },
  {
    id: 'blackbox',
    label: 'Blackbox AI',
    description: 'Blackbox AI cloud LLM — fast code-aware security analysis.',
  },
  {
    id: 'claude',
    label: 'Anthropic Claude',
    description: 'Claude 3.5 Sonnet from Anthropic — high-quality reasoning.',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    description: 'DeepSeek Chat — powerful open-source LLM for analysis.',
  },
  {
    id: 'qwen',
    label: 'Alibaba Qwen',
    description: 'Qwen-Max from Alibaba Cloud — multilingual security analysis.',
  },
];

export interface LlmClientFactoryResult {
  client: LlmClient;
  warning?: string;
}

class RuleBasedLlmClient implements LlmClient {
  providerId: LlmProviderId = 'rule-based-local';

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const userMessage = request.messages
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .join(' ')
      .trim();

    const isArabic = /[\u0600-\u06FF]/.test(userMessage);

    const cautionNote = isArabic
      ? (
        request.conservatism === 'high'
          ? 'استخدم إجراءات محافظة واطلب تأكيداً صريحاً قبل أي تغييرات مدمّرة.'
          : request.conservatism === 'medium'
            ? 'وازن بين السرعة وفحوصات الأمان.'
            : 'فضّل التنفيذ السريع مع الحفاظ على فحوصات أمان أساسية.'
      )
      : (
        request.conservatism === 'high'
          ? 'Use conservative actions and require explicit confirmation before destructive changes.'
          : request.conservatism === 'medium'
            ? 'Balance speed with safety checks.'
            : 'Favor fast execution while keeping basic safety checks.'
      );

    return {
      text: isArabic
        ? `[${request.profileLabel}] ${cautionNote} السياق: ${userMessage}`
        : `[${request.profileLabel}] ${cautionNote} Context: ${userMessage}`,
    };
  }
}

class GoogleGenAiLlmClient implements LlmClient {
  providerId: LlmProviderId = 'google-genai';

  private readonly ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const content = request.messages
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join('\n\n');

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are assisting DataGuard Agent planning. Keep output concise and actionable.\nProfile: ${request.profileLabel}\nConservatism: ${request.conservatism}\n\nConversation:\n${content}`,
            },
          ],
        },
      ],
    });

    return {
      text: response.text || `[${request.profileLabel}] No model text returned.`,
    };
  }
}

class OpenAiLlmClient implements LlmClient {
  providerId: LlmProviderId = 'openai';
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = request.messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    const systemInstruction = `You are assisting DataGuard Agent planning. Keep output concise and actionable.\nProfile: ${request.profileLabel}\nConservatism: ${request.conservatism}`;
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemInstruction },
        ...messages,
      ],
      max_tokens: 1024,
    });

    return {
      text: response.choices[0]?.message?.content ?? `[${request.profileLabel}] No model text returned.`,
    };
  }
}

// ---- Blackbox AI ----
class BlackboxLlmClient implements LlmClient {
  providerId: LlmProviderId = 'blackbox';
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const messages = request.messages.map((m) => ({ role: m.role, content: m.content }));
    const systemPrompt = `You are assisting DataGuard Agent planning. Keep output concise and actionable.\nProfile: ${request.profileLabel}\nConservatism: ${request.conservatism}`;

    const response = await fetch('https://api.blackbox.ai/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: 'blackboxai',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) throw new Error(`Blackbox API error: ${response.status}`);
    const data = await response.json();
    return {
      text: data?.choices?.[0]?.message?.content ?? `[${request.profileLabel}] No model text returned.`,
    };
  }
}

// ---- Claude (Anthropic) ----
class ClaudeLlmClient implements LlmClient {
  providerId: LlmProviderId = 'claude';
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const userMessages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const systemPrompt = `You are assisting DataGuard Agent planning. Keep output concise and actionable.\nProfile: ${request.profileLabel}\nConservatism: ${request.conservatism}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: userMessages,
      }),
    });

    if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
    const data = await response.json();
    return {
      text: data?.content?.[0]?.text ?? `[${request.profileLabel}] No model text returned.`,
    };
  }
}

// ---- DeepSeek ----
class DeepSeekLlmClient implements LlmClient {
  providerId: LlmProviderId = 'deepseek';
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const messages = request.messages.map((m) => ({ role: m.role, content: m.content }));
    const systemPrompt = `You are assisting DataGuard Agent planning. Keep output concise and actionable.\nProfile: ${request.profileLabel}\nConservatism: ${request.conservatism}`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`);
    const data = await response.json();
    return {
      text: data?.choices?.[0]?.message?.content ?? `[${request.profileLabel}] No model text returned.`,
    };
  }
}

// ---- Qwen (Alibaba Cloud) ----
class QwenLlmClient implements LlmClient {
  providerId: LlmProviderId = 'qwen';
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const messages = request.messages.map((m) => ({ role: m.role, content: m.content }));
    const systemPrompt = `You are assisting DataGuard Agent planning. Keep output concise and actionable.\nProfile: ${request.profileLabel}\nConservatism: ${request.conservatism}`;

    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: 'qwen-max',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) throw new Error(`Qwen API error: ${response.status}`);
    const data = await response.json();
    return {
      text: data?.choices?.[0]?.message?.content ?? `[${request.profileLabel}] No model text returned.`,
    };
  }
}

// ---------- API Key Storage (DB-backed, with in-memory cache) ----------

import {
  getCachedApiKey,
  hasProviderKey,
  saveProviderKey,
  removeProviderKey,
} from './aiProviderService';

/**
 * Save an API key for a provider — persisted in the `ai_provider_configs` DB table.
 * Returns a Promise; await it to ensure persistence before navigating away.
 */
export async function saveProviderApiKey(
  providerId: LlmProviderId,
  apiKey: string,
): Promise<void> {
  return saveProviderKey(providerId, apiKey);
}

/** Remove a stored API key for a provider. */
export async function removeProviderApiKey(providerId: LlmProviderId): Promise<void> {
  return removeProviderKey(providerId);
}

/** Return true if an API key is cached for the given provider (sync, after cache init). */
export function hasProviderApiKey(providerId: LlmProviderId): boolean {
  return hasProviderKey(providerId);
}

// ---------- Internal key resolution (reads from in-memory cache — synchronous) ----------

function resolveKey(providerId: string): string | null {
  return getCachedApiKey(providerId);
}

function resolveOpenAiApiKey(): string | null {
  const fromCache = getCachedApiKey('openai') ?? '';
  const fromVite =
    typeof import.meta !== 'undefined'
      ? import.meta.env?.VITE_OPENAI_API_KEY
      : undefined;
  const fromProcess =
    typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : undefined;
  const key = (fromCache || fromVite || fromProcess || '').trim();
  return key.length > 0 ? key : null;
}

function resolveGeminiApiKey(): string | null {
  // Priority: DB cache (user-entered) → Vite env → Node env
  const fromCache = getCachedApiKey('google-genai') ?? '';
  const fromVite =
    typeof import.meta !== 'undefined'
      ? import.meta.env?.VITE_GEMINI_API_KEY
      : undefined;
  const fromProcess =
    typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined;
  const key = (fromCache || fromVite || fromProcess || '').trim();
  return key.length > 0 ? key : null;
}

export function createLlmClient(providerId: LlmProviderId): LlmClientFactoryResult {
  if (providerId === 'google-genai') {
    const apiKey = resolveGeminiApiKey();
    if (apiKey) {
      return { client: new GoogleGenAiLlmClient(apiKey) };
    }

    return {
      client: new RuleBasedLlmClient(),
      warning:
        'Google GenAI غير مُفعَّل. أدخل مفتاح API الخاص بك من قسم "مزودو الذكاء الاصطناعي". Using Local Rule-Based provider instead.',
    };
  }

  if (providerId === 'openai') {
    const apiKey = resolveOpenAiApiKey();
    if (apiKey) return { client: new OpenAiLlmClient(apiKey) };
    return { client: new RuleBasedLlmClient(), warning: 'OpenAI غير مُفعَّل. أدخل مفتاح API الخاص بك من قسم "مزودو الذكاء الاصطناعي".' };
  }

  if (providerId === 'blackbox') {
    const apiKey = resolveKey('blackbox');
    if (apiKey) return { client: new BlackboxLlmClient(apiKey) };
    return { client: new RuleBasedLlmClient(), warning: 'Blackbox AI غير مُفعَّل. أدخل مفتاح API الخاص بك من قسم "مزودو الذكاء الاصطناعي".' };
  }

  if (providerId === 'claude') {
    const apiKey = resolveKey('claude');
    if (apiKey) return { client: new ClaudeLlmClient(apiKey) };
    return { client: new RuleBasedLlmClient(), warning: 'Claude غير مُفعَّل. أدخل مفتاح API الخاص بك من قسم "مزودو الذكاء الاصطناعي".' };
  }

  if (providerId === 'deepseek') {
    const apiKey = resolveKey('deepseek');
    if (apiKey) return { client: new DeepSeekLlmClient(apiKey) };
    return { client: new RuleBasedLlmClient(), warning: 'DeepSeek غير مُفعَّل. أدخل مفتاح API الخاص بك من قسم "مزودو الذكاء الاصطناعي".' };
  }

  if (providerId === 'qwen') {
    const apiKey = resolveKey('qwen');
    if (apiKey) return { client: new QwenLlmClient(apiKey) };
    return { client: new RuleBasedLlmClient(), warning: 'Qwen غير مُفعَّل. أدخل مفتاح API الخاص بك من قسم "مزودو الذكاء الاصطناعي".' };
  }

  if (providerId === 'ollama-local') {
    const baseUrl = typeof import.meta !== 'undefined'
      ? import.meta.env?.VITE_OLLAMA_URL
      : process.env?.OLLAMA_URL;
    const model = typeof import.meta !== 'undefined'
      ? import.meta.env?.VITE_OLLAMA_MODEL
      : process.env?.OLLAMA_MODEL;
    return { client: new OllamaLlmClient(baseUrl, model) };
  }

  return { client: new RuleBasedLlmClient() };
}

export function createDefaultLlmClient(): LlmClient {
  return new RuleBasedLlmClient();
}
