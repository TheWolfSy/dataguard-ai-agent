import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap,
  CheckCircle,
  XCircle,
  ExternalLink,
  Eye,
  EyeOff,
  AlertTriangle,
  Info,
  RefreshCw,
  Trash2,
  Settings, // For Local Rule-Based
  Sparkles, // For Google Gemini
  Bot, // For OpenAI
  Square, // For Blackbox AI
  Diamond, // For Anthropic Claude
  Fish, // For DeepSeek
  Star, // For Alibaba Qwen
  ChevronRight,
} from 'lucide-react';
import {
  saveProviderApiKey,
  removeProviderApiKey,
  hasProviderApiKey,
  type LlmProviderId,
} from '../../services/llmClient';
import { cn } from '../../lib/utils';

// ---- Types ----

interface AiProvider {
  id: LlmProviderId;
  name: string;
  icon: React.ElementType; // Changed from 'logo: string' to 'icon: React.ElementType'
  accentColor: string;
  borderColor: string;
  description: string;
  authPagePath: string | null; // null = no auth page (e.g., local)
  docsUrl: string | null;
  keyPrefix: string; // how a valid key starts
  requiresKey: boolean;
  available: boolean; // false = coming soon
}

const AI_PROVIDERS: AiProvider[] = [
  {
    id: 'rule-based-local',
    name: 'Local Rule-Based', // Changed from 'logo: string' to 'icon: React.ElementType'
    icon: Settings,
    accentColor: '#64748b',
    borderColor: '#475569',
    description: 'محرك قواعد محلي حتمي — لا يتطلب API key ولا اتصال بالإنترنت.',
    authPagePath: null,
    docsUrl: null,
    keyPrefix: '',
    requiresKey: false,
    available: true,
  },
  {
    id: 'google-genai',
    name: 'Google Gemini', // Changed from 'logo: string' to 'icon: React.ElementType'
    icon: Sparkles,
    accentColor: '#4285f4',
    borderColor: '#3070e8',
    description: 'نموذج Gemini 2.0 Flash من Google — أقوى أداء للتحليل الأمني.',
    authPagePath: '/auth/gemini.html',
    docsUrl: 'https://aistudio.google.com/apikey',
    keyPrefix: 'AIza',
    requiresKey: true,
    available: true,
  },
  {
    id: 'openai',
    name: 'OpenAI GPT-4o', // Changed from 'logo: string' to 'icon: React.ElementType'
    icon: Bot,
    accentColor: '#10a37f',
    borderColor: '#0e8a6b',
    description: 'نموذج GPT-4o من OpenAI — تحليل أمني متقدم ودقة عالية.',
    authPagePath: '/auth/openai.html',
    docsUrl: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-',
    requiresKey: true,
    available: true,
  },
  {
    id: 'blackbox',
    name: 'Blackbox AI', // Changed from 'logo: string' to 'icon: React.ElementType'
    icon: Square,
    accentColor: '#6366f1',
    borderColor: '#4f46e5',
    description: 'نموذج Blackbox AI — تحليل أمني سريع وواعٍ بالكود.',
    authPagePath: '/auth/blackbox.html',
    docsUrl: 'https://www.blackbox.ai',
    keyPrefix: '',
    requiresKey: true,
    available: true,
  },
  {
    id: 'claude',
    name: 'Anthropic Claude', // Changed from 'logo: string' to 'icon: React.ElementType'
    icon: Diamond,
    accentColor: '#d97706',
    borderColor: '#b45309',
    description: 'Claude 3.5 Sonnet من Anthropic — استدلال متقدم وجودة عالية.',
    authPagePath: '/auth/claude.html',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    keyPrefix: 'sk-ant-',
    requiresKey: true,
    available: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek', // Changed from 'logo: string' to 'icon: React.ElementType'
    icon: Fish,
    accentColor: '#06b6d4',
    borderColor: '#0891b2',
    description: 'DeepSeek Chat — نموذج مفتوح المصدر قوي للتحليل الأمني.',
    authPagePath: '/auth/deepseek.html',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    keyPrefix: 'sk-',
    requiresKey: true,
    available: true,
  },
  {
    id: 'qwen',
    name: 'Alibaba Qwen', // Changed from 'logo: string' to 'icon: React.ElementType'
    icon: Star,
    accentColor: '#f59e0b',
    borderColor: '#d97706',
    description: 'Qwen-Max من Alibaba Cloud — تحليل أمني متعدد اللغات.',
    authPagePath: '/auth/qwen.html',
    docsUrl: 'https://dashscope.console.aliyun.com/apiKey',
    keyPrefix: 'sk-',
    requiresKey: true,
    available: true,
  },
];

// ---- Component ----

interface AIProvidersPageProps {
  t: (key: string) => string;
  dir: string;
  agentLlmProvider: LlmProviderId;
  handleAgentProviderChange: (providerId: LlmProviderId) => void;
  agentLlmProviderNotice: string;
}

export function AIProvidersPage({
  t,
  dir,
  agentLlmProvider,
  handleAgentProviderChange,
  agentLlmProviderNotice,
}: AIProvidersPageProps) {
  const [apiKeyInputs, setApiKeyInputs] = useState<Partial<Record<LlmProviderId, string>>>({});
  const [showKey, setShowKey] = useState<Partial<Record<LlmProviderId, boolean>>>({});
  const [savedState, setSavedState] = useState<Partial<Record<LlmProviderId, boolean>>>({});
  const [feedbacks, setFeedbacks] = useState<Partial<Record<LlmProviderId, 'saved' | 'removed' | 'error'>>>({});

  // Initialise saved state from DB cache (populated synchronously after initProviderCache resolves)
  useEffect(() => {
    const state: Partial<Record<LlmProviderId, boolean>> = {};
    for (const p of AI_PROVIDERS) {
      if (p.requiresKey) state[p.id] = hasProviderApiKey(p.id);
    }
    setSavedState(state);
  }, []);

  const showFeedback = (id: LlmProviderId, type: 'saved' | 'removed' | 'error') => {
    setFeedbacks((prev) => ({ ...prev, [id]: type }));
    setTimeout(() => setFeedbacks((prev) => { const next = { ...prev }; delete next[id]; return next; }), 2500);
  };

  const handleSaveKey = useCallback(async (provider: AiProvider) => {
    const raw = (apiKeyInputs[provider.id] ?? '').trim();
    if (!raw) {
      showFeedback(provider.id, 'error');
      return;
    }
    try {
      await saveProviderApiKey(provider.id, raw);
      setSavedState((prev) => ({ ...prev, [provider.id]: true }));
      setApiKeyInputs((prev) => ({ ...prev, [provider.id]: '' }));
      showFeedback(provider.id, 'saved');
      // Re-initialise the agent with the new provider if it's already selected
      handleAgentProviderChange(provider.id);
    } catch {
      showFeedback(provider.id, 'error');
    }
  }, [apiKeyInputs, handleAgentProviderChange]);

  const handleRemoveKey = useCallback(async (provider: AiProvider) => {
    try {
      await removeProviderApiKey(provider.id);
    } catch {
      // key removal failed — still update UI
    }
    setSavedState((prev) => ({ ...prev, [provider.id]: false }));
    showFeedback(provider.id, 'removed');
    // Fall back to local provider if this was active
    if (agentLlmProvider === provider.id) {
      handleAgentProviderChange('rule-based-local');
    }
  }, [agentLlmProvider, handleAgentProviderChange]);

  const isActive = (id: LlmProviderId) => agentLlmProvider === id;
  const isConnected = (provider: AiProvider) =>
    !provider.requiresKey || (savedState[provider.id] ?? false);

  return (
    <motion.div
      key="ai-providers"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="max-w-3xl space-y-8"
      dir={dir}
    >
      {/* ---- Header ---- */}
      <div>
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          {t('aiProviders.title')}
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('aiProviders.subtitle')}</p>
      </div>

      {/* ---- Active Provider Notice ---- */}
      {agentLlmProviderNotice && (
        <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: 'rgba(120,60,0,0.18)', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 2px 12px rgba(120,60,0,0.1)' }}>
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-warning)' }}>{agentLlmProviderNotice}</p>
        </div>
      )}

      {/* ---- Info Banner ---- */}
      <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: 'rgba(14,30,68,0.7)', border: '1px solid rgba(96,165,250,0.25)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
        <Info className="w-4 h-4 text-sky-500 mt-0.5 shrink-0" />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-accent)' }}>{t('aiProviders.securityNote')}</p>
      </div>

      {/* ---- Provider Cards ---- */}
      <div className="space-y-5">
        {AI_PROVIDERS.map((provider) => {
          const connected = isConnected(provider);
          const active = isActive(provider.id);
          const feedback = feedbacks[provider.id];

          return (
            <motion.div
              key={provider.id}
              layout
              className={cn(
                'border-2 rounded-2xl overflow-hidden transition-colors duration-200',
                !provider.available && 'opacity-60'
              )}
              style={{
                background: 'rgba(6,13,31,0.8)',
                borderColor: active ? provider.accentColor : 'rgba(96,165,250,0.18)',
                boxShadow: active ? `0 4px 24px ${provider.accentColor}30, inset 0 1px 0 rgba(255,255,255,0.04)` : 'inset 0 1px 0 rgba(255,255,255,0.03)',
              }}
            >
              {/* Card Header */}
              <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div // Changed from 'logo: string' to 'icon: React.ElementType'
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: `${provider.accentColor}15`, border: `1px solid ${provider.accentColor}30` }}
                  >
                    <provider.icon className="w-6 h-6" style={{ color: provider.accentColor }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold">{provider.name}</h3>
                      {!provider.available && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase" style={{ background: 'rgba(120,60,0,0.3)', color: '#d97706', border: '1px solid rgba(217,119,6,0.4)' }}>
                          {t('aiProviders.comingSoon')}
                        </span>
                      )}
                      {active && (
                        <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full uppercase" style={{ background: `linear-gradient(135deg,${provider.accentColor},${provider.borderColor})` }}>
                          {t('aiProviders.active')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{provider.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Connection Status */}
                  {connected ? (
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase">{t('aiProviders.connected')}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                      <XCircle className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase">{t('aiProviders.notConnected')}</span>
                    </div>
                  )}

                  {/* Activate Button */}
                  {provider.available && !active && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleAgentProviderChange(provider.id)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg text-white hover:opacity-90 transition-colors flex items-center gap-1"
                      style={{ background: `linear-gradient(135deg,${provider.accentColor},${provider.borderColor})` }}
                    >
                      {t('aiProviders.activate')}
                      <ChevronRight className="w-3 h-3" />
                    </motion.button>
                  )}
                </div>
              </div>

              {/* API Key Section */}
              {provider.requiresKey && provider.available && (
                <div className="border-t p-5 space-y-4" style={{ borderColor: 'rgba(96,165,250,0.1)', background: 'rgba(6,13,31,0.6)' }}>

                  {/* Auth Page Link */}
                  {provider.authPagePath && (
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('aiProviders.getKeyPrompt')}</span>
                      <a
                        href={provider.authPagePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg hover:opacity-80 transition-colors text-blue-300"
                        style={{ background: 'rgba(10,20,45,0.8)', border: '1px solid rgba(96,165,250,0.2)' }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        {t('aiProviders.openAuthPage').replace('{name}', provider.name)}
                      </a>
                    </div>
                  )}

                  {/* Saved key indicator */}
                  {(savedState[provider.id] ?? false) && (
                      <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(5,46,22,0.3)', border: '1px solid rgba(52,211,153,0.25)' }}>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-xs font-medium" style={{ color: '#34d399' }}>{t('aiProviders.keyStored')}</span>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleRemoveKey(provider)}
                        className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-700 font-bold transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        {t('aiProviders.removeKey')}
                      </motion.button>
                    </div>
                  )}

                  {/* Key Input */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#4a6fa5' }}>
                      {t('aiProviders.apiKeyLabel').replace('{name}', provider.name)}
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showKey[provider.id] ? 'text' : 'password'}
                          value={apiKeyInputs[provider.id] ?? ''}
                          onChange={(e) => setApiKeyInputs((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                          placeholder={t('aiProviders.apiKeyPlaceholder').replace('{prefix}', provider.keyPrefix)}
                          className="w-full px-3 py-2.5 pr-10 rounded-lg text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          style={{ background: 'rgba(6,13,31,0.8)', border: '1px solid rgba(96,165,250,0.2)' }}
                          dir="ltr"
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors hover:text-white" style={{ color: 'var(--text-muted)' }}
                        >
                          {showKey[provider.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSaveKey(provider)}
                        disabled={!(apiKeyInputs[provider.id] ?? '').trim()}
                        className="px-4 py-2 text-white text-xs font-bold rounded-lg hover:opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                        style={{ background: `linear-gradient(135deg,${provider.accentColor},${provider.borderColor})` }}
                      >
                        <RefreshCw className="w-3 h-3" />
                        {t('aiProviders.saveKey')}
                      </motion.button>
                    </div>
                  </div>

                  {/* Feedback */}
                  <AnimatePresence>
                    {feedback && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={cn(
                          'flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg',
                          feedback === 'saved' && 'border'
                        )}
                        style={{ background: feedback === 'saved' ? 'rgba(5,46,22,0.4)' : feedback === 'removed' ? 'rgba(30,40,60,0.6)' : 'rgba(69,10,10,0.4)', borderColor: feedback === 'saved' ? 'rgba(52,211,153,0.3)' : feedback === 'removed' ? 'rgba(96,165,250,0.2)' : 'rgba(248,113,113,0.3)', color: feedback === 'saved' ? '#34d399' : feedback === 'removed' ? '#94a3b8' : '#f87171' }}
                      >
                        {feedback === 'saved' && <><CheckCircle className="w-3.5 h-3.5" />{t('aiProviders.keySaved')}</>}
                        {feedback === 'removed' && <><Trash2 className="w-3.5 h-3.5" />{t('aiProviders.keyRemoved')}</>}
                        {feedback === 'error' && <><AlertTriangle className="w-3.5 h-3.5" />{t('aiProviders.keyError')}</>}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ---- Security Notice ---- */}
      <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'rgba(10,20,45,0.6)', border: '1px solid rgba(96,165,250,0.12)' }}>
        <Info className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
        <div className="text-xs text-zinc-500 space-y-1">
          <p className="font-bold text-slate-300">{t('aiProviders.storageTitle')}</p>
          <p style={{ color: 'var(--text-muted)' }}>{t('aiProviders.storageDesc')}</p>
        </div>
      </div>
    </motion.div>
  );
}
