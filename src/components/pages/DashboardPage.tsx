import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import {
  Activity, AlertTriangle, CheckCircle, ChevronRight, Database,
  Eye, EyeOff, Info, Lock, Plus, Search, ShieldCheck,
  Settings2, GripVertical, RotateCcw, Zap, BarChart3, Shield,
  X, Palette, Layout, Rows3, Star, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';
import type { DataLog, SecurityPolicy } from '../../services/sqlService';
import type { AgentOutcome } from '../../services/agentCore';
import type { RiskLevel } from '../../services/toolContract';
import { decryptData } from '../../services/encryption';
import {
  useDashboardConfig,
  type WidgetId,
  type AccentColor,
  type DashboardLayout,
} from '../../hooks/useDashboardConfig';

type TFunc = (key: string) => string;

/* ─── Accent colors ──────────────────────────────────────────────────── */
const ACCENT_COLORS: { color: AccentColor; label: string }[] = [
  { color: '#f97316', label: 'Orange' },
  { color: '#38bdf8', label: 'Sky' },
  { color: '#34d399', label: 'Emerald' },
  { color: '#a78bfa', label: 'Violet' },
  { color: '#f43f5e', label: 'Rose' },
  { color: '#facc15', label: 'Amber' },
];

/* ─── Widget metadata ─────────────────────────────────────────────────── */
const WIDGET_META: Record<WidgetId, { icon: React.ComponentType<any>; labelEn: string; labelAr: string; desc: string }> = {
  stats:            { icon: BarChart3,   labelEn: 'Statistics',       labelAr: 'الإحصائيات',          desc: '4 بطاقات المقاييس الرئيسية' },
  'recent-logs':    { icon: Database,    labelEn: 'Recent Logs',       labelAr: 'آخر السجلات',          desc: 'أحدث 5 سجلات فحص' },
  'quick-actions':  { icon: Zap,         labelEn: 'Quick Actions',     labelAr: 'إجراءات سريعة',        desc: 'اختصارات التنقل' },
  'policy-overview':{ icon: Shield,      labelEn: 'Policy Status',     labelAr: 'حالة السياسات',        desc: 'نظرة عامة على السياسات الأمنية' },
  'threat-breakdown':{ icon: AlertTriangle, labelEn: 'Threat Breakdown', labelAr: 'تحليل التهديدات',  desc: 'توزيع أنواع التهديدات' },
};

/* ─── Props ───────────────────────────────────────────────────────────── */
interface DashboardPageProps {
  t: TFunc;
  dir: string;
  language?: string;
  logs: DataLog[];
  policies: SecurityPolicy[];
  agentRun: AgentOutcome | null;
  setAgentRun: (v: AgentOutcome | null) => void;
  showAgentPanel: boolean;
  setShowAgentPanel: (v: boolean) => void;
  showDecrypted: Record<string, boolean>;
  toggleDecryption: (id: string) => void;
  setActiveTab: (tab: string) => void;
  userDisplayName?: string;
}

/* ─── Toggle switch ───────────────────────────────────────────────────── */
function ToggleSwitch({ enabled, onChange, accent }: { enabled: boolean; onChange: () => void; accent: string }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn('relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none shrink-0')}
      style={{ background: enabled ? accent : 'rgba(30,50,80,0.6)', border: '1px solid rgba(96,165,250,0.2)' }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
        style={{ left: enabled ? '50%' : '2px', transform: enabled ? 'translateX(-2px)' : 'none' }}
      />
    </button>
  );
}

/* ─── Collapsible section ─────────────────────────────────────────────── */
function CollapsibleSection({
  title,
  icon: Icon,
  isExpanded,
  onToggle,
  accent,
  children,
}: {
  title: string;
  icon: React.ComponentType<any>;
  isExpanded: boolean;
  onToggle: () => void;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(10,20,45,0.5)', border: '1px solid rgba(96,165,250,0.1)' }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
          <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{title}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        )}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Customization modal ─────────────────────────────────────────────── */
function CustomizeDrawer({
  config,
  onToggleWidget,
  onReorder,
  onUpdateConfig,
  onReset,
  language,
  accent,
}: {
  config: ReturnType<typeof useDashboardConfig>['config'];
  onToggleWidget: (id: WidgetId) => void;
  onReorder: (order: WidgetId[]) => void;
  onUpdateConfig: ReturnType<typeof useDashboardConfig>['updateConfig'];
  onReset: () => void;
  language?: string;
  accent: string;
}) {
  const isAr = language === 'ar';
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    layout: true,
    displayOptions: true,
    widgets: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => { setSaved(false); setExpanded(false); }, 900);
  };

  return (
    <motion.div
      layout
      className="rounded-xl overflow-hidden"
      style={{
        background: 'rgba(10,20,45,0.6)',
        border: `1px solid ${accent}20`,
      }}
    >
      {/* Header - Always visible */}
      <motion.button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ background: `linear-gradient(135deg,${accent}15,${accent}08)` }}
      >
        <div className="flex items-center gap-3">
          <Settings2 className="w-4 h-4" style={{ color: accent }} />
          <span className="text-xs font-bold tracking-wide text-white">{isAr ? 'تخصيص اللوحة' : 'Customize Panel'}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        )}
      </motion.button>

      {/* Collapsible content */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >

            <div className="p-5 space-y-7">

              {/* Accent color */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Palette className="w-3.5 h-3.5" style={{ color: accent }} />
                  <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{isAr ? 'لون التمييز' : 'Accent Color'}</span>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {ACCENT_COLORS.map(({ color, label }) => (
                    <motion.button
                      key={color}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onUpdateConfig('accentColor', color)}
                      title={label}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-all relative"
                      style={{ background: color, boxShadow: config.accentColor === color ? `0 0 0 3px ${color}50, 0 0 12px ${color}50` : 'none' }}
                    >
                      {config.accentColor === color && (
                        <CheckCircle className="w-4 h-4 text-white drop-shadow" />
                      )}
                    </motion.button>
                  ))}
                </div>
              </section>

              {/* Layout - Collapsible */}
              <CollapsibleSection
                title={isAr ? 'التخطيط' : 'Layout'}
                icon={Layout}
                isExpanded={expandedSections.layout}
                onToggle={() => toggleSection('layout')}
                accent={accent}
              >
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'comfortable', labelAr: 'مريح', labelEn: 'Comfortable' },
                    { id: 'compact',     labelAr: 'مضغوط', labelEn: 'Compact' },
                    { id: 'wide',        labelAr: 'واسع',  labelEn: 'Wide' },
                  ] as { id: DashboardLayout; labelAr: string; labelEn: string }[]).map((opt) => (
                    <motion.button
                      key={opt.id}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => onUpdateConfig('layout', opt.id)}
                      className="py-2 px-3 rounded-lg text-xs font-bold transition-all"
                      style={config.layout === opt.id
                        ? { background: `${accent}25`, border: `1px solid ${accent}60`, color: accent }
                        : { background: 'rgba(10,20,45,0.6)', border: '1px solid rgba(96,165,250,0.1)', color: '#64748b' }}
                    >
                      {isAr ? opt.labelAr : opt.labelEn}
                    </motion.button>
                  ))}
                </div>
              </CollapsibleSection>

{/* Options toggles - Collapsible */}
              <CollapsibleSection
                title={isAr ? 'خيارات العرض' : 'Display Options'}
                icon={Rows3}
                isExpanded={expandedSections.displayOptions}
                onToggle={() => toggleSection('displayOptions')}
                accent={accent}
              >
                <div className="space-y-3">
                  {[
                    { key: 'showGreeting' as const, labelAr: 'رسالة الترحيب', labelEn: 'Greeting Banner' },
                    { key: 'compactStats' as const, labelAr: 'إحصائيات مضغوط', labelEn: 'Compact Stats' },
                  ].map(({ key, labelAr, labelEn }) => (
                    <div key={key} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(10,20,45,0.5)', border: '1px solid rgba(96,165,250,0.08)' }}>
                      <span className="text-xs text-slate-300">{isAr ? labelAr : labelEn}</span>
                      <ToggleSwitch
                        enabled={config[key] as boolean}
                        onChange={() => onUpdateConfig(key, !config[key])}
                        accent={accent}
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(10,20,45,0.5)', border: '1px solid rgba(96,165,250,0.08)' }}>
                    <span className="text-xs text-slate-300">{isAr ? 'أعمدة الإحصائيات' : 'Stats Columns'}</span>
                    <div className="flex items-center gap-1 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(96,165,250,0.15)' }}>
                      {([2, 4] as const).map((n) => (
                        <button
                          key={n}
                          onClick={() => onUpdateConfig('statsColumns', n)}
                          className="px-3 py-1 text-xs font-bold transition-colors"
                          style={config.statsColumns === n
                            ? { background: accent, color: '#fff' }
                            : { background: 'rgba(10,20,45,0.8)', color: '#64748b' }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Widget order & visibility - Collapsible */}
              <CollapsibleSection
                title={isAr ? 'الويدجات (اسحب لإعادة الترتيب)' : 'Widgets (drag to reorder)'}
                icon={GripVertical}
                isExpanded={expandedSections.widgets}
                onToggle={() => toggleSection('widgets')}
                accent={accent}
              >
                <Reorder.Group
                  axis="y"
                  values={config.widgetOrder}
                  onReorder={(newOrder) => onReorder(newOrder as WidgetId[])}
                  className="space-y-2"
                >
                  {config.widgetOrder.map((id) => {
                    const meta = WIDGET_META[id];
                    const Icon = meta.icon;
                    const isHidden = config.hiddenWidgets.includes(id);
                    return (
                      <Reorder.Item key={id} value={id} className="cursor-grab active:cursor-grabbing">
                        <motion.div
                          layout
                          className="flex items-center gap-3 p-3 rounded-xl transition-all"
                          style={{
                            background: isHidden ? 'rgba(10,20,45,0.3)' : 'rgba(15,30,70,0.6)',
                            border: `1px solid ${isHidden ? 'rgba(96,165,250,0.05)' : accent + '25'}`,
                            opacity: isHidden ? 0.45 : 1,
                          }}
                          whileDrag={{ scale: 1.02, boxShadow: `0 8px 24px rgba(0,0,0,0.4)` }}
                        >
                          <GripVertical className="w-4 h-4 text-zinc-500 shrink-0" />
                          <div className="p-1.5 rounded-lg shrink-0" style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
                            <Icon className="w-3.5 h-3.5" style={{ color: isHidden ? '#64748b' : accent }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-200 truncate">{isAr ? meta.labelAr : meta.labelEn}</p>
                            <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{meta.desc}</p>
                          </div>
                          <ToggleSwitch enabled={!isHidden} onChange={() => onToggleWidget(id)} accent={accent} />
                        </motion.div>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              </CollapsibleSection>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 p-4 space-y-2" style={{ background: 'rgba(6,13,31,0.95)', borderTop: `1px solid ${accent}20`, backdropFilter: 'blur(12px)', borderRadius: '0 0 16px 16px' }}>
              <motion.button
                whileHover={{ y: -1, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-all"
                style={{ background: saved ? 'linear-gradient(135deg,#34d399,#059669)' : `linear-gradient(135deg,${accent},${accent}cc)`, boxShadow: `0 4px 16px ${accent}40` }}
              >
                {saved ? (
                  <><CheckCircle className="w-4 h-4" />{isAr ? 'تم الحفظ!' : 'Saved!'}</>
                ) : (
                  <><Star className="w-4 h-4" />{isAr ? 'حفظ وإغلاق' : 'Save & Close'}</>
                )}
              </motion.button>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={onReset}
                className="w-full py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-2 transition-all"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(96,165,250,0.1)' }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {isAr ? 'إعادة التعيين' : 'Reset to Default'}
              </motion.button>
            </div>
          </motion.div>
      )}
    </motion.div>
  );
}

/* ─── Widgets ────────────────────────────────────────────────────────── */

function StatsWidget({ t, logs, policies, compact, cols, accent }: {
  t: TFunc; logs: DataLog[]; policies: SecurityPolicy[];
  compact: boolean; cols: 2 | 4; accent: string;
}) {
  const cards = [
    { label: t('dashboard.totalScans'),    value: logs.length,                                           icon: Search,       accent: 'rgba(148,163,184,0.5)', bg: 'rgba(148,163,184,0.08)', iconColor: 'text-zinc-300' },
    { label: t('dashboard.piiDetected'),   value: logs.filter((l) => l.piiDetected).length,              icon: AlertTriangle, accent: '#f43f5e', bg: 'rgba(244,63,94,0.08)', iconColor: 'text-rose-300' },
    { label: t('dashboard.activePolicies'),value: policies.filter((p) => p.isActive).length,             icon: ShieldCheck,   accent: '#38bdf8', bg: 'rgba(56,189,248,0.08)', iconColor: 'text-sky-300' },
    { label: t('dashboard.protectedAssets'),value: logs.filter((l) => l.protectionStatus !== 'Unprotected').length, icon: Lock, accent: '#34d399', bg: 'rgba(52,211,153,0.08)', iconColor: 'text-emerald-300' },
  ];
  const gridCols = cols === 4
    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
    : 'grid-cols-1 sm:grid-cols-2';

  return (
    <div className={`grid ${gridCols} gap-4`}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <motion.div key={card.label} whileHover={{ y: -2, scale: 1.01 }} transition={{ duration: 0.15 }}>
            <Card className={cn('transition-all cursor-default', compact ? 'p-4' : 'p-6')}
              style={{ borderLeft: `4px solid ${card.accent}`, borderTop: `1px solid ${card.accent}25` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{card.label}</span>
                <div className="p-1.5 rounded-lg" style={{ background: card.bg }}>
                  <Icon className={cn('w-4 h-4', card.iconColor)} />
                </div>
              </div>
              <div className={cn('font-bold tracking-tighter', compact ? 'text-3xl' : 'text-4xl')}>
                {card.value}
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

function RecentLogsWidget({ t, logs, showDecrypted, toggleDecryption, setActiveTab }: {
  t: TFunc; logs: DataLog[]; showDecrypted: Record<string, boolean>;
  toggleDecryption: (id: string) => void; setActiveTab: (tab: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-tight">{t('dashboard.recentLogs')}</h2>
        <motion.button
          onClick={() => setActiveTab('logs')}
          whileHover={{ x: 3 }} whileTap={{ scale: 0.97 }}
          className="text-[10px] font-mono uppercase flex items-center gap-1 hover:text-orange-400 transition-colors"
          style={{ color: '#4a6fa5' }}
        >
          {t('dashboard.viewAll')} <ChevronRight className="w-3 h-3" />
        </motion.button>
      </div>
      <div className="space-y-2.5">
        {logs.slice(0, 5).map((log) => (
          <motion.div key={log.id} whileHover={{ x: 4 }} transition={{ duration: 0.12 }}>
            <Card className="p-3.5 transition-all duration-200 cursor-pointer hover:border-blue-400/30">
              <div className="flex items-start justify-between mb-1.5">
                <Badge variant={log.piiDetected ? 'error' : 'success'}>{log.classification}</Badge>
                <span className="text-[9px] font-mono text-zinc-400 uppercase">
                  {log.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-zinc-400 line-clamp-1 font-mono flex-1">
                  {showDecrypted[log.id] ? decryptData(log.content) : log.content}
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleDecryption(log.id); }}
                  className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showDecrypted[log.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </Card>
          </motion.div>
        ))}
        {logs.length === 0 && (
          <div className="text-center py-10 border-2 border-dashed rounded-2xl" style={{ borderColor: 'rgba(96,165,250,0.15)', background: 'rgba(10,20,45,0.3)' }}>
            <Database className="w-7 h-7 text-zinc-500 mx-auto mb-2" />
            <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{t('dashboard.noLogs')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickActionsWidget({ t, setActiveTab, accent }: { t: TFunc; setActiveTab: (tab: string) => void; accent: string }) {
  const actions = [
    { label: t('sidebar.logs') || 'Data Logs',       tab: 'logs',     icon: Database,    color: '#38bdf8' },
    { label: t('sidebar.policies') || 'Policies',     tab: 'policies', icon: Shield,      color: '#34d399' },
    { label: t('sidebar.audit') || 'Audit',           tab: 'audit',    icon: CheckCircle, color: '#a78bfa' },
    { label: t('sidebar.settings') || 'Settings',     tab: 'settings', icon: Settings2,   color: '#f97316' },
  ];
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg" style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
          <Zap className="w-3.5 h-3.5" style={{ color: accent }} />
        </div>
        <h3 className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          {t('dashboard.quickActions') || 'Quick Actions'}
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {actions.map(({ label, tab, icon: Icon, color }) => (
          <motion.button
            key={tab}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveTab(tab)}
            className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold text-left transition-all"
            style={{ background: `${color}10`, border: `1px solid ${color}20`, color }}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </motion.button>
        ))}
      </div>
    </Card>
  );
}

function PolicyOverviewWidget({ t, policies, accent }: { t: TFunc; policies: SecurityPolicy[]; accent: string }) {
  const active = policies.filter((p) => p.isActive).length;
  const synced = policies.filter((p) => p.syncStatus === 'synced').length;
  const errored = policies.filter((p) => p.syncStatus === 'error').length;
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg" style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
          <Shield className="w-3.5 h-3.5" style={{ color: accent }} />
        </div>
        <h3 className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          {t('dashboard.policyStatus') || 'Policy Status'}
        </h3>
      </div>
      {policies.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>{t('policies.noActivePolicies') || 'No policies yet'}</p>
      ) : (
        <div className="space-y-2">
          {[
            { label: t('policies.active') || 'Active', value: active, color: '#34d399' },
            { label: t('policies.synced') || 'Synced', value: synced, color: '#38bdf8' },
            { label: t('policies.syncError') || 'Error',  value: errored, color: '#f43f5e' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'rgba(6,13,31,0.5)' }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-xs text-slate-300">{label}</span>
              </div>
              <span className="text-xs font-bold" style={{ color }}>{value}</span>
            </div>
          ))}
          <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,50,80,0.6)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: policies.length > 0 ? `${(active / policies.length) * 100}%` : '0%' }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg,${accent},${accent}88)` }}
            />
          </div>
          <p className="text-[10px] font-mono text-center" style={{ color: 'var(--text-muted)' }}>
            {active}/{policies.length} {t('dashboard.activePolicies') || 'active'}
          </p>
        </div>
      )}
    </Card>
  );
}

function ThreatBreakdownWidget({ t, logs, accent }: { t: TFunc; logs: DataLog[]; accent: string }) {
  const total = logs.length;
  const categories = [
    { label: 'Highly Sensitive', count: logs.filter((l) => l.classification === 'Highly Sensitive').length, color: '#f43f5e' },
    { label: 'Confidential',     count: logs.filter((l) => l.classification === 'Confidential').length,     color: '#f97316' },
    { label: 'Internal',         count: logs.filter((l) => l.classification === 'Internal').length,          color: '#38bdf8' },
    { label: 'Public',           count: logs.filter((l) => l.classification === 'Public').length,            color: '#34d399' },
  ];
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg" style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
          <BarChart3 className="w-3.5 h-3.5" style={{ color: accent }} />
        </div>
        <h3 className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          {t('dashboard.threatBreakdown') || 'Threat Breakdown'}
        </h3>
      </div>
      {total === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>{t('dashboard.noLogs')}</p>
      ) : (
        <div className="space-y-2.5">
          {categories.map(({ label, count, color }) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-400">{label}</span>
                <span className="text-[10px] font-bold" style={{ color }}>{count}</span>
              </div>
              <div className="h-1 rounded-full" style={{ background: 'rgba(30,50,80,0.7)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }}
                  transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                  className="h-full rounded-full"
                  style={{ background: color }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ─── Main DashboardPage ────────────────────────────────────────────── */
export function DashboardPage({
  t, dir, language, logs, policies,
  agentRun, setAgentRun, showAgentPanel, setShowAgentPanel,
  showDecrypted, toggleDecryption,
  setActiveTab,
  userDisplayName,
}: DashboardPageProps) {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const { config, updateConfig, toggleWidget, reorderWidgets, resetConfig, isVisible } = useDashboardConfig();
  const accent = config.accentColor;
  const isCompact = config.layout === 'compact';
  const isAr = language === 'ar';

  // Build the gapClass based on layout
  const gapClass = isCompact ? 'gap-4' : config.layout === 'wide' ? 'gap-10' : 'gap-8';

// Widget renderer
  const renderWidget = useCallback((id: WidgetId) => {
    if (!isVisible(id)) return null;
    switch (id) {
      case 'stats':
        return (
          <StatsWidget
            key="stats" t={t} logs={logs} policies={policies}
            compact={config.compactStats || isCompact}
            cols={config.statsColumns} accent={accent}
          />
        );
      case 'recent-logs':
        return (
          <RecentLogsWidget
            key="recent-logs" t={t} logs={logs}
            showDecrypted={showDecrypted} toggleDecryption={toggleDecryption}
            setActiveTab={setActiveTab}
          />
        );
      case 'quick-actions':
        return <QuickActionsWidget key="quick-actions" t={t} setActiveTab={setActiveTab} accent={accent} />;
      case 'policy-overview':
        return <PolicyOverviewWidget key="policy-overview" t={t} policies={policies} accent={accent} />;
      case 'threat-breakdown':
        return <ThreatBreakdownWidget key="threat-breakdown" t={t} logs={logs} accent={accent} />;
      default:
        return null;
    }
  }, [isVisible, config, t, logs, policies, isCompact, accent, showDecrypted, toggleDecryption, setActiveTab]);

  // Split widgets into columns: main (col-span-2) vs sidebar
  const mainWidgets: WidgetId[]    = ['stats'];
  const sidebarWidgets: WidgetId[] = ['recent-logs', 'quick-actions', 'policy-overview', 'threat-breakdown'];

  const orderedMainWidgets    = config.widgetOrder.filter((id) => mainWidgets.includes(id));
  const orderedSidebarWidgets = config.widgetOrder.filter((id) => sidebarWidgets.includes(id));

  return (
    <>
      <motion.div
        key="dashboard"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={`space-y-${isCompact ? '5' : '8'}`}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            {config.showGreeting && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h1 className="text-xl font-bold tracking-tight text-white">
                  {isAr
                    ? `مرحباً${userDisplayName ? ` ${userDisplayName}` : ''} 👋`
                    : `Welcome back${userDisplayName ? `, ${userDisplayName}` : ''} 👋`}
                </h1>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {isAr ? 'لوحة تحكم DataGuard AI — بياناتك محمية في الوقت الفعلي.' : 'DataGuard AI — your data is protected in real-time.'}
                </p>
              </motion.div>
            )}
          </div>
          <motion.button
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setCustomizeOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-white transition-all"
            style={{
              background: `linear-gradient(135deg,${accent}22,${accent}10)`,
              border: `1px solid ${accent}40`,
              boxShadow: `0 2px 12px ${accent}20`,
            }}
          >
            <Settings2 className="w-3.5 h-3.5" style={{ color: accent }} />
            {isAr ? 'تخصيص' : 'Customize'}
          </motion.button>
        </div>

        {/* Customization Card - Inserted after header row */}
        <CustomizeDrawer
          config={config}
          onToggleWidget={toggleWidget}
          onReorder={reorderWidgets}
          onUpdateConfig={updateConfig}
          onReset={resetConfig}
          language={language}
          accent={accent}
        />

        {/* Widget grid */}
        <div className={`grid grid-cols-1 lg:grid-cols-3 ${gapClass}`}>
          {/* Main column (col-span-2) */}
          <div className={`lg:col-span-2 space-y-${isCompact ? '4' : '6'}`}>
            {orderedMainWidgets.map((id) => renderWidget(id))}
          </div>

          {/* Sidebar column */}
          <div className={`space-y-${isCompact ? '4' : '5'}`}>
            {orderedSidebarWidgets.map((id) => renderWidget(id))}
          </div>
        </div>
      </motion.div>

      {/* Agent FAB */}
      <AnimatePresence>
        {agentRun && (
          <motion.button
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            onClick={() => setShowAgentPanel(!showAgentPanel)}
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
            className="fixed bottom-8 right-8 w-14 h-14 rounded-full text-white flex items-center justify-center z-40"
            style={{
              background: `linear-gradient(135deg,${accent},${accent}99)`,
              boxShadow: `0 8px 32px ${accent}50, 0 0 0 1px ${accent}30`,
            }}
          >
            <Activity className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
