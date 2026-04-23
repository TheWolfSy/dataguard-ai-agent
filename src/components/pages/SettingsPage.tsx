import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Moon, Sun } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';
import type { Theme } from '../../hooks/useTheme';
import {
  AGENT_LLM_PROVIDERS,
  type AgentLlmProviderId,
} from '../../services/agentOrchestrator';

type TFunc = (key: string) => string;

interface SettingsPageProps {
  t: TFunc;
  dir: string;
  theme: Theme;
  toggleTheme: () => void;
  agentLlmProvider: AgentLlmProviderId;
  agentLlmProviderNotice: string;
  handleAgentProviderChange: (id: AgentLlmProviderId) => void;
  autoRedactionEnabled?: boolean;
  toggleAutoRedaction?: () => void;
}

export function SettingsPage({
  t,
  theme, toggleTheme,
  agentLlmProvider, agentLlmProviderNotice, handleAgentProviderChange,
  autoRedactionEnabled = false,
  toggleAutoRedaction,
}: SettingsPageProps) {
  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="max-w-2xl space-y-8"
    >
      <div>
        <h2 className="text-xl font-bold tracking-tight">{t('settings.title')}</h2>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('settings.subtitle')}</p>
      </div>

      <Card className="divide-y" style={{ '--tw-divide-color': 'rgba(96,165,250,0.1)' } as React.CSSProperties}>
        <div className="p-6 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold uppercase tracking-tight">{t('settings.autoRedaction')}</h4>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('settings.autoRedactionDesc')}</p>
          </div>
          <button
            onClick={() => toggleAutoRedaction?.()}
            className="w-10 h-5 rounded-full relative cursor-pointer transition-all"
            style={{
              background: autoRedactionEnabled
                ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                : 'rgba(30,50,80,0.8)',
              border: `1px solid ${autoRedactionEnabled ? 'rgba(34,197,94,0.5)' : 'rgba(96,165,250,0.25)'}`,
              boxShadow: autoRedactionEnabled ? '0 0 10px rgba(34,197,94,0.3)' : 'inset 0 1px 4px rgba(0,0,0,0.3)'
            }}
          >
            <div
              className="absolute top-1 w-3 h-3 bg-white rounded-full transition-all"
              style={{ left: autoRedactionEnabled ? '1.25rem' : '0.25rem' }}
            />
          </button>
        </div>
        <div className="p-6 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold uppercase tracking-tight">{t('settings.securityAlerts')}</h4>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('settings.securityAlertsDesc')}</p>
          </div>
          <div className="w-10 h-5 rounded-full relative cursor-pointer" style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', boxShadow: '0 0 10px rgba(249,115,22,0.3)' }}>
            <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full transition-all" />
          </div>
        </div>
        <div className="p-6 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold uppercase tracking-tight">{t('settings.database')}</h4>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('settings.databaseDesc')}</p>
          </div>
          <Badge variant="success">{t('settings.connected')}</Badge>
        </div>
        <div className="p-6 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold uppercase tracking-tight">{t('settings.themeMode')}</h4>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('settings.themeModeDesc')}</p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(6,13,31,0.7)', border: '1px solid rgba(96,165,250,0.2)' }}>
            <button
              onClick={() => theme !== 'dark' && toggleTheme()}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all',
                theme === 'dark'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200'
              )}
              style={theme === 'dark' ? { background: 'linear-gradient(135deg,rgba(15,30,70,0.9),rgba(25,50,100,0.9))', border: '1px solid rgba(96,165,250,0.3)', boxShadow: '0 2px 8px rgba(96,165,250,0.15)' } : undefined}
            >
              <Moon className="w-3.5 h-3.5" />
              {t('settings.themeDark')}
            </button>
            <button
              onClick={() => theme !== 'light' && toggleTheme()}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all',
                theme === 'light'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200'
              )}
              style={theme === 'light' ? { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' } : undefined}
            >
              <Sun className="w-3.5 h-3.5" />
              {t('settings.themeLight')}
            </button>
          </div>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <h4 className="text-sm font-bold uppercase tracking-tight">{t('settings.llmProvider')}</h4>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('settings.llmProviderDesc')}</p>
          </div>
          <select
            value={agentLlmProvider}
            onChange={(e) => handleAgentProviderChange(e.target.value as AgentLlmProviderId)}
            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 text-slate-200"
            style={{ background: 'rgba(6,13,31,0.7)', border: '1px solid rgba(96,165,250,0.25)' }}
          >
            {AGENT_LLM_PROVIDERS.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {AGENT_LLM_PROVIDERS.find((p) => p.id === agentLlmProvider)?.description}
          </p>
          {agentLlmProviderNotice && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700 rounded px-2 py-1">
              {t('settings.llmProviderFallback')}: {agentLlmProviderNotice}
            </p>
          )}
        </div>
      </Card>

        <div className="p-4 rounded-lg flex gap-3" style={{ background: 'rgba(120,60,0,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-amber-400 uppercase">{t('settings.advancedWarning')}</h4>
          <p className="text-[10px] text-amber-300/80 leading-relaxed">{t('settings.warningText')}</p>
        </div>
      </div>
    </motion.div>
  );
}
