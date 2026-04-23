import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle, ChevronDown, ChevronUp, Download,
  Eye, EyeOff, Info, KeyRound, Lock, Mail, Plus, RefreshCw,
  Shield, ShieldAlert, Upload,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';
import type { SecurityPolicy, FileSystemReference } from '../../services/sqlService';
import type { FileScanResult } from '../../services/fileAccessService';
import type {
  EmailMonitorState,
  CashRule,
  CashRuleType,
  MonitorRiskLevel,
} from '../../services/emailMonitorService';
import { getKeyInfo, exportDbKeyBase64, importDbKeyBase64 } from '../../services/dbCrypto';
import type {
  PasswordManagerState,
  PasswordEntry,
  WeakPasswordAlert,
} from '../../services/passwordManagerService';
import { analyzePasswordStrength } from '../../services/passwordManagerService';

type TFunc = (key: string) => string;

interface PoliciesPageProps {
  t: TFunc;
  dir: string;
  policies: SecurityPolicy[];
  policyName: string;
  setPolicyName: (v: string) => void;
  policySourceUrl: string;
  setPolicySourceUrl: (v: string) => void;
  policySyncIntervalHours: number;
  setPolicySyncIntervalHours: (v: number) => void;
  isCreatingPolicy: boolean;
  isAutoSyncingPolicies: boolean;
  syncingPolicyId: string | null;
  isPolicyFormOpen: boolean;
  setIsPolicyFormOpen: (v: boolean) => void;
  handleCreatePolicy: (e: React.FormEvent) => Promise<void>;
  handleSyncPolicy: (policyId: string) => Promise<void>;
  userRole?: string;
  // Security Services: File Protection
  isFileScanning: boolean;
  selectedScanInterval: number;
  setSelectedScanInterval: (v: number) => void;
  fileReferences: FileSystemReference[];
  scanResults: FileScanResult[];
  handleRequestFileAccess: () => Promise<void>;
  handleRescanDirectory: (id: string) => Promise<void>;
  handleRemoveFileAccess: (id: string) => Promise<void>;
  // Security Services: Email Monitor (Gmail)
  emailMonitorState: EmailMonitorState;
  isConnectingGmail: boolean;
  handleConnectGmail: (clientId: string, clientSecret?: string) => Promise<void>;
  handleDisconnectGmail: () => void;
  handleSetEmailMonitorEnabled: (enabled: boolean) => void;
  handleAddCashRule: (rule: Omit<CashRule, 'id' | 'createdAt' | 'isDefault'>) => void;
  handleRemoveCashRule: (id: string) => void;
  handleToggleCashRule: (id: string, enabled: boolean) => void;
  handleDismissAlert: (id: string) => void;
  handleClearAlerts: () => void;
  isInitializingCVE: boolean;
  handleInitializeCVESource: () => Promise<void>;
  // Security Services: Password Manager
  passwordManagerState: PasswordManagerState;
  isPasswordManagerScanning: boolean;
  isEmailSyncing: boolean;
  emailSyncHints: Array<{ messageId: string; service: string; username: string; suggestedPassword: string; from: string; subject: string; date: string }>;
  handleAddPasswordEntry: (data: { service: string; username: string; password: string; url?: string; notes?: string }) => Promise<void>;
  handleRemovePasswordEntry: (id: string) => void;
  handleRunWeakPasswordScan: () => Promise<void>;
  handleSyncEmailPasswords: () => Promise<void>;
  handleImportEmailHint: (hint: { messageId: string; service: string; username: string; suggestedPassword: string }) => Promise<void>;
  handleImportAllEmailHints: () => Promise<void>;
  handleDismissWeakAlert: (alertId: string) => void;
  handleDecryptPassword: (entry: PasswordEntry) => Promise<string>;
}

export function PoliciesPage({
  t, dir, policies,
  policyName, setPolicyName,
  policySourceUrl, setPolicySourceUrl,
  policySyncIntervalHours, setPolicySyncIntervalHours,
  isCreatingPolicy, isAutoSyncingPolicies, syncingPolicyId,
  isPolicyFormOpen, setIsPolicyFormOpen,
  handleCreatePolicy, handleSyncPolicy,
  userRole,
  // Security Services
  isFileScanning, selectedScanInterval, setSelectedScanInterval,
  fileReferences, scanResults,
  handleRequestFileAccess, handleRescanDirectory, handleRemoveFileAccess,
  emailMonitorState,
  isConnectingGmail,
  handleConnectGmail,
  handleDisconnectGmail,
  handleSetEmailMonitorEnabled,
  handleAddCashRule,
  handleRemoveCashRule,
  handleToggleCashRule,
  handleDismissAlert,
  handleClearAlerts,
  isInitializingCVE,
  handleInitializeCVESource,
  // Password Manager
  passwordManagerState,
  isPasswordManagerScanning,
  isEmailSyncing,
  emailSyncHints,
  handleAddPasswordEntry,
  handleRemovePasswordEntry,
  handleRunWeakPasswordScan,
  handleSyncEmailPasswords,
  handleImportEmailHint,
  handleImportAllEmailHints,
  handleDismissWeakAlert,
  handleDecryptPassword,
}: PoliciesPageProps) {
  // Card open state: each service card can be opened/closed independently
  const [openServices, setOpenServices] = React.useState<Set<string>>(
    () => new Set<string>()
  );
  const toggleServiceCard = (id: string) =>
    setOpenServices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // Encryption local state (business logic unchanged — managed here after move from Settings)
  const importKeyRef = React.useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importError, setImportError] = React.useState('');
  const [keyInfo, setKeyInfo] = React.useState(() => getKeyInfo());

  const handleExportKey = () => {
    const raw = exportDbKeyBase64();
    if (!raw) return;
    const payload = JSON.stringify(
      { version: 1, algorithm: 'AES-256-GCM', keyBase64: raw, exportedAt: new Date().toISOString() },
      null, 2
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dataguard-key-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportKey = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('loading');
    setImportError('');
    try {
      const parsed = JSON.parse(await file.text()) as { keyBase64?: string };
      if (!parsed.keyBase64) throw new Error(t('encryption.invalidFile'));
      await importDbKeyBase64(parsed.keyBase64);
      setKeyInfo(getKeyInfo());
      setImportStatus('success');
      setTimeout(() => setImportStatus('idle'), 4000);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t('encryption.importFailed'));
      setImportStatus('error');
    } finally {
      e.target.value = '';
    }
  };

  // ── Gmail Monitor local UI state ──────────────────────────────────────────
  const [gmailClientId, setGmailClientId] = React.useState('');
  const [gmailClientSecret, setGmailClientSecret] = React.useState('');
  const [showGmailSecret, setShowGmailSecret] = React.useState(false);
  const [showRulesPanel, setShowRulesPanel] = React.useState(false);
  const [newRulePattern, setNewRulePattern] = React.useState('');
  const [newRuleType, setNewRuleType] = React.useState<CashRuleType>('keyword');
  const [newRuleRisk, setNewRuleRisk] = React.useState<MonitorRiskLevel>('suspicious');

  const handleConnectPress = async () => {
    if (!gmailClientId.trim()) return;
    await handleConnectGmail(gmailClientId.trim(), gmailClientSecret.trim() || undefined);
    setGmailClientId('');
    setGmailClientSecret('');
    setShowGmailSecret(false);
  };

  const handleAddRuleClick = () => {
    if (!newRulePattern.trim()) return;
    handleAddCashRule({
      type: newRuleType,
      pattern: newRulePattern.trim(),
      riskLevel: newRuleRisk,
      enabled: true,
      description: `${newRuleType}: ${newRulePattern.trim()}`,
    });
    setNewRulePattern('');
  };

  // ── Password Manager local UI state ──────────────────────────────────────
  const [isPmFormOpen, setIsPmFormOpen] = React.useState(false);
  const [pmService, setPmService] = React.useState('');
  const [pmUsername, setPmUsername] = React.useState('');
  const [pmPassword, setPmPassword] = React.useState('');
  const [pmUrl, setPmUrl] = React.useState('');
  const [pmNotes, setPmNotes] = React.useState('');
  const [isPmSaving, setIsPmSaving] = React.useState(false);
  const [showPmPassword, setShowPmPassword] = React.useState(false);
  const [revealedPasswords, setRevealedPasswords] = React.useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = React.useState<string | null>(null);
  const pmPasswordRef = React.useRef<HTMLInputElement>(null);

  const pmLiveStrength = pmPassword ? analyzePasswordStrength(pmPassword) : null;

  const handlePmAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pmService.trim() || !pmUsername.trim() || !pmPassword.trim()) return;
    setIsPmSaving(true);
    try {
      await handleAddPasswordEntry({
        service: pmService,
        username: pmUsername,
        password: pmPassword,
        url: pmUrl,
        notes: pmNotes,
      });
      setPmService('');
      setPmUsername('');
      setPmPassword('');
      setPmUrl('');
      setPmNotes('');
      setIsPmFormOpen(false);
      setShowPmPassword(false);
    } finally {
      setIsPmSaving(false);
    }
  };

  const handleRevealPassword = async (entry: PasswordEntry) => {
    if (revealedPasswords[entry.id]) {
      setRevealedPasswords((prev) => { const r = { ...prev }; delete r[entry.id]; return r; });
      return;
    }
    setRevealingId(entry.id);
    try {
      const plain = await handleDecryptPassword(entry);
      setRevealedPasswords((prev) => ({ ...prev, [entry.id]: plain }));
    } finally {
      setRevealingId(null);
    }
  };

  return (
    <motion.div
      key="policies"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{t('policies.title')}</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('policies.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {isAutoSyncingPolicies && <Badge variant="info">{t('policies.autoSyncing')}</Badge>}
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsPolicyFormOpen(!isPolicyFormOpen)}
            className="btn-primary-hover flex items-center gap-2 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
            style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', boxShadow: '0 4px 20px rgba(249,115,22,0.35)' }}
          >
            <Plus className="w-4 h-4" />
            {t('policies.newPolicy')}
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {isPolicyFormOpen && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Card className="p-6" style={{ borderTop: '4px solid #0284c7', boxShadow: '0 -4px 20px rgba(2,132,199,0.15)' }}>
              <form onSubmit={handleCreatePolicy} className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-tight">{t('policies.referenceTitle')}</h3>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('policies.referenceSubtitle')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="success">{t('policies.httpsOnly')}</Badge>
                    <Badge variant="info">{t('policies.encryptedCache')}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-accent)' }}>{t('policies.ruleName')}</label>
                    <input
                      value={policyName}
                      onChange={(e) => setPolicyName(e.target.value)}
                      placeholder={t('policies.ruleNamePlaceholder')}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-500"
                      dir={dir}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-accent)' }}>{t('policies.sourceUrl')}</label>
                    <input
                      type="url"
                      value={policySourceUrl}
                      onChange={(e) => setPolicySourceUrl(e.target.value)}
                      placeholder={t('policies.sourceUrlPlaceholder')}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-500"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-accent)' }}>{t('policies.syncInterval')}</label>
                    <input
                      type="number"
                      min="1"
                      value={policySyncIntervalHours}
                      onChange={(e) => setPolicySyncIntervalHours(Math.max(1, parseInt(e.target.value) || 24))}
                      placeholder={t('policies.syncIntervalPlaceholder')}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-500"
                    />
                  </div>
                </div>
                <div className="p-4 rounded-xl text-xs leading-relaxed text-slate-300" style={{ background: 'rgba(6,13,31,0.6)', border: '1px solid rgba(96,165,250,0.15)', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.15)' }}>
                  {t('policies.referenceHint')}
                </div>
                <div className="flex items-center justify-end gap-3">
                  <motion.button
                    type="button"
                    onClick={() => setIsPolicyFormOpen(false)}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-3 py-2 rounded-lg border text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-white transition-colors"
                    style={{ borderColor: 'rgba(96,165,250,0.2)', background: 'rgba(10,20,45,0.6)' }}
                  >
                    {t('common.cancel')}
                  </motion.button>
                  <motion.button
                    type="submit"
                    disabled={isCreatingPolicy || !policyName.trim() || !policySourceUrl.trim()}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-4 py-2 rounded-lg text-white text-xs font-bold uppercase tracking-widest disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}
                  >
                    {isCreatingPolicy ? t('policies.importing') : t('policies.createRemotePolicy')}
                  </motion.button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {policies.map((policy) => (
          <Card key={policy.id} className={cn('p-6 border-t-4', policy.isActive ? 'border-t-emerald-500' : 'border-t-zinc-300')}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm uppercase tracking-tight">{policy.name}</h3>
              <div className={cn('px-2 py-0.5 rounded text-[9px] font-mono uppercase', policy.isActive ? 'text-emerald-400' : 'text-slate-500')}
                style={policy.isActive ? { background: 'rgba(5,46,22,0.4)', border: '1px solid rgba(52,211,153,0.25)' } : { background: 'rgba(10,20,45,0.5)', border: '1px solid rgba(96,165,250,0.1)' }}>
                {policy.isActive ? t('policies.active') : t('policies.disabled')}
              </div>
            </div>
            <p className="text-xs mb-6 italic leading-relaxed" style={{ color: '#94a3b8' }}>&#8220;{policy.rules}&#8221;</p>
            <div className="space-y-3 mb-6">
              <div className="flex flex-wrap items-center gap-2">
                {policy.sourceUrl && <Badge variant="info">{t('policies.remoteReference')}</Badge>}
                {policy.isDefaultSource && <Badge variant="success">{t('policies.defaultSource')}</Badge>}
                {policy.transportEncryption && <Badge variant="success">{policy.transportEncryption}</Badge>}
                {policy.syncStatus === 'error' ? (
                  <Badge variant="error">{t('policies.syncError')}</Badge>
                ) : policy.syncStatus === 'synced' ? (
                  <Badge variant="success">{t('policies.synced')}</Badge>
                ) : (
                  <Badge variant="default">{policy.syncStatus ?? 'manual'}</Badge>
                )}
              </div>
              {policy.sourceUrl && (
                <div className="p-3 rounded-lg space-y-2" style={{ background: 'rgba(6,13,31,0.7)', border: '1px solid rgba(96,165,250,0.1)' }}>
                  <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-accent)' }}>{t('policies.source')}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 break-all" dir="ltr">{policy.sourceUrl}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono text-zinc-500 dark:text-zinc-400 uppercase">
                    <span>{t('policies.lastSync')}: {policy.lastSyncedAt ? policy.lastSyncedAt.toLocaleString() : '-'}</span>
                    <span>{t('policies.integrity')}: {policy.integrityHash ? `${policy.integrityHash.slice(0, 12)}...` : '-'}</span>
                    <span>{t('policies.syncInterval')}: {policy.syncIntervalHours ?? 24} {t('policies.hours')}</span>
                  </div>
                </div>
              )}
              <div className="p-3 bg-zinc-950 rounded-lg overflow-auto max-h-56">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">{t('policies.jsonRules')}</p>
                <pre className="text-[11px] leading-5 text-emerald-200 whitespace-pre-wrap break-words">{policy.rulesJson ?? t('policies.noJsonYet')}</pre>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-[9px] font-mono text-zinc-400 uppercase">{t('policies.created')} {policy.createdAt.toLocaleDateString()}</span>
              <div className="flex items-center gap-3">
                {policy.sourceUrl && (
                  <motion.button
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.96 }}
                    disabled={syncingPolicyId === policy.id}
                    onClick={() => handleSyncPolicy(policy.id)}
                    className="text-[10px] font-bold uppercase tracking-widest text-sky-600 hover:text-sky-800 disabled:opacity-50"
                  >
                    {syncingPolicyId === policy.id ? t('policies.syncing') : t('policies.syncNow')}
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.96 }}
                  className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-900"
                >
                  {t('policies.editPolicy')}
                </motion.button>
              </div>
            </div>
          </Card>
        ))}
        {policies.length === 0 && (
          <div className="col-span-full text-center py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl">
            <ShieldAlert className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
            <h3 className="text-sm font-bold uppercase tracking-tight text-zinc-400">{t('policies.noActivePolicies')}</h3>
            <p className="text-xs text-zinc-400 mt-1">{t('policies.createFirst')}</p>
          </div>
        )}
      </div>

      {/* ── Security Services ──────────────────────────────────────────── */}
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{t('policies.servicesTitle')}</h2>
          <p className="text-xs text-zinc-500">{t('policies.servicesSubtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── File Protection Card ── */}
        <Card className="p-6 border-t-4 border-t-blue-500 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 shrink-0">
                <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-bold text-sm uppercase tracking-tight text-zinc-900 dark:text-zinc-100">{t('fileProtection.title')}</h3>
            </div>
            <div className="px-2 py-0.5 rounded text-[9px] font-mono uppercase bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
              {t('policies.serviceActive')}
            </div>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 italic leading-relaxed">"{t('fileProtection.description')}"</p>
          <div className="space-y-3 mb-6">
            <motion.button
              onClick={handleRequestFileAccess}
              disabled={isFileScanning}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-all"
            >
              {isFileScanning ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                  {t('fileProtection.scanning')}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4" />
                  {t('fileProtection.grantAccess')}
                </div>
              )}
            </motion.button>
            <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-3">
              <div>
                <label className="text-xs font-bold uppercase block mb-2 text-zinc-700 dark:text-zinc-200">
                  {t('fileProtection.scanInterval')}
                </label>
                <select
                  value={selectedScanInterval}
                  onChange={(e) => setSelectedScanInterval(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>1 {t('fileProtection.scanInterval')}</option>
                  <option value={6}>6 {t('fileProtection.scanInterval')}</option>
                  <option value={12}>12 {t('fileProtection.scanInterval')}</option>
                  <option value={24}>24 {t('fileProtection.scanInterval')}</option>
                  <option value={48}>48 {t('fileProtection.scanInterval')}</option>
                  <option value={168}>1 week</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4" />
                <span className="text-xs font-bold uppercase text-zinc-700 dark:text-zinc-200">{t('fileProtection.enableAutoScan')}</span>
              </label>
            </div>
            {fileReferences.length > 0 ? (
              <div className="space-y-2">
                {fileReferences.map((fileRef) => (
                  <div key={fileRef.id} className="p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-500" />
                        <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100">{fileRef.directoryName}</span>
                      </div>
                      {fileRef.threatsFound > 0 && <Badge variant="error">{fileRef.threatsFound} threats</Badge>}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-white dark:bg-zinc-900 p-2 rounded border border-zinc-200 dark:border-zinc-700">
                        <span className="text-zinc-500 dark:text-zinc-400 block">{t('fileProtection.lastScanned')}</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{fileRef.lastScannedAt ? new Date(fileRef.lastScannedAt).toLocaleDateString() : 'Never'}</span>
                      </div>
                      <div className="bg-white dark:bg-zinc-900 p-2 rounded border border-zinc-200 dark:border-zinc-700">
                        <span className="text-zinc-500 dark:text-zinc-400 block">{t('fileProtection.totalScanned')}</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{fileRef.totalFilesScanned}</span>
                      </div>
                      <div className="bg-white dark:bg-zinc-900 p-2 rounded border border-zinc-200 dark:border-zinc-700">
                        <span className="text-zinc-500 dark:text-zinc-400 block">{t('fileProtection.threatsFound')}</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{fileRef.threatsFound}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <motion.button onClick={() => handleRescanDirectory(fileRef.id)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-200 transition-all">
                        {t('fileProtection.rescan')}
                      </motion.button>
                      <motion.button onClick={() => handleRemoveFileAccess(fileRef.id)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1 px-3 py-2 bg-red-100 text-red-700 text-xs font-bold rounded-lg hover:bg-red-200 transition-all">
                        {t('fileProtection.removeAccess')}
                      </motion.button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                <Shield className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <p className="text-xs text-zinc-600 dark:text-zinc-300">{t('fileProtection.noDirectories')}</p>
              </div>
            )}
            {scanResults.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {scanResults.map((result) => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      'p-3 rounded-lg border text-xs',
                      result.riskLevel === 'critical' ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800' :
                      result.riskLevel === 'high' ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' :
                      'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-zinc-900 dark:text-zinc-100 truncate">{result.fileName}</span>
                      <Badge variant={result.riskLevel === 'safe' ? 'success' : result.riskLevel === 'high' ? 'warning' : 'error'}>
                        {result.riskLevel.toUpperCase()}
                      </Badge>
                    </div>
                    {result.findings.length > 0 && (
                      <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-300">
                        {result.findings.slice(0, 2).map((finding, idx) => (
                          <li key={idx} className="text-[10px]">{finding.description}</li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-auto">
            <span className="text-[9px] font-mono text-zinc-400 uppercase">{fileReferences.length} {t('fileProtection.managedDirectories')}</span>
            <motion.button whileHover={{ x: 2 }} whileTap={{ scale: 0.96 }} onClick={handleRequestFileAccess} disabled={isFileScanning} className="text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-800 disabled:opacity-50">
              {isFileScanning ? t('fileProtection.scanning') : t('fileProtection.grantAccess')}
            </motion.button>
          </div>
        </Card>

        {/* ── Database Encryption Card ── */}
        <Card className="p-6 border-t-4 border-t-violet-500 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/40 shrink-0">
                <KeyRound className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="font-bold text-sm uppercase tracking-tight text-zinc-900 dark:text-zinc-100">{t('encryption.title')}</h3>
            </div>
            <Badge variant="success">{t('encryption.secureStorage')}</Badge>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 italic leading-relaxed">"{t('encryption.subtitle')}"</p>
          <div className="space-y-3 mb-6">
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
              <div className="p-4 flex items-center justify-between bg-white dark:bg-zinc-900">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('encryption.algorithm')}</p>
                  <p className="text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100">AES-256-GCM</p>
                </div>
                <Badge variant="success">{t('encryption.secureStorage')}</Badge>
              </div>
              <div className="p-4 flex items-center justify-between bg-white dark:bg-zinc-900">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('encryption.keyCreated')}</p>
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {keyInfo.createdAt
                      ? keyInfo.createdAt.toLocaleString()
                      : <span className="text-zinc-400 font-normal text-xs">{t('encryption.keyUnknown')}</span>}
                  </p>
                </div>
                <KeyRound className="w-4 h-4 text-zinc-300" />
              </div>
              <div className="p-4 space-y-2 bg-white dark:bg-zinc-900">
                <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('encryption.fieldsEncrypted')}</p>
                <div className="flex flex-wrap gap-2">
                  {['API Keys', 'Data Logs', 'Audit Details'].map((f) => (
                    <span key={f} className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-mono font-bold text-emerald-700">{f}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg flex gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase">{t('encryption.warningTitle')}</h4>
                <p className="text-[10px] text-rose-800 dark:text-rose-300 leading-relaxed">{t('encryption.warningText')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                onClick={handleExportKey}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-700 transition-all"
              >
                <Download className="w-4 h-4" />
                {t('encryption.exportKey')}
              </motion.button>
              <motion.button
                onClick={() => importKeyRef.current?.click()}
                disabled={importStatus === 'loading'}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-bold uppercase tracking-widest hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-all"
              >
                <Upload className="w-4 h-4" />
                {importStatus === 'loading' ? '...' : t('encryption.importKey')}
              </motion.button>
              <input ref={importKeyRef} type="file" accept="application/json,.json" onChange={handleImportKey} className="hidden" />
            </div>
            {importStatus === 'success' && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2 font-mono">
                ✓ {t('encryption.importSuccess')}
              </p>
            )}
            {importStatus === 'error' && importError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2 font-mono">
                {importError}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-auto">
            <span className="text-[9px] font-mono text-zinc-400 uppercase">{t('encryption.keyCreated')} {keyInfo.createdAt ? keyInfo.createdAt.toLocaleDateString() : '-'}</span>
            <div className="flex items-center gap-3">
              <motion.button onClick={handleExportKey} whileHover={{ x: 2 }} whileTap={{ scale: 0.96 }} className="text-[10px] font-bold uppercase tracking-widest text-violet-600 hover:text-violet-800">
                {t('encryption.exportKey')}
              </motion.button>
            </div>
          </div>
        </Card>

        {/* ── Gmail Email Monitor Card ── */}
        <Card className={cn('p-6 border-t-4 flex flex-col',
          emailMonitorState.connection
            ? emailMonitorState.enabled ? 'border-t-emerald-500' : 'border-t-amber-400'
            : 'border-t-zinc-300',
        )}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg shrink-0',
                emailMonitorState.connection
                  ? emailMonitorState.enabled ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-amber-100 dark:bg-amber-900/40'
                  : 'bg-zinc-100 dark:bg-zinc-800',
              )}>
                <Mail className={cn('w-4 h-4',
                  emailMonitorState.connection
                    ? emailMonitorState.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'
                    : 'text-zinc-400',
                )} />
              </div>
              <h3 className="font-bold text-sm uppercase tracking-tight text-zinc-900 dark:text-zinc-100">{t('emailMonitor.title')}</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className={cn('px-2 py-0.5 rounded text-[9px] font-mono uppercase',
                emailMonitorState.connection && emailMonitorState.enabled
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                  : emailMonitorState.connection
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
              )}>
                {emailMonitorState.connection
                  ? emailMonitorState.enabled ? t('policies.serviceActive') : t('emailMonitor.statusPaused')
                  : t('policies.serviceInactive')}
              </div>
              {emailMonitorState.connection && (
                <button
                  type="button"
                  onClick={() => handleSetEmailMonitorEnabled(!emailMonitorState.enabled)}
                  className={cn('relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 shrink-0',
                    emailMonitorState.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600',
                  )}
                  aria-label={t('emailMonitor.toggleLabel')}
                >
                  <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
                    emailMonitorState.enabled ? 'translate-x-5' : 'translate-x-0',
                  )} />
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 italic leading-relaxed">
            "{emailMonitorState.connection ? emailMonitorState.connection.email : t('emailMonitor.subtitle')}"
          </p>
          <div className="space-y-3 mb-6">
            {isConnectingGmail && (
              <div className="flex items-center justify-center gap-3 py-6">
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">{t('emailMonitor.connecting')}</span>
              </div>
            )}
            {!isConnectingGmail && emailMonitorState.connection && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', emailMonitorState.isMonitoring ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400')} />
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 font-mono" dir="ltr">{emailMonitorState.connection.email}</span>
                  </div>
                  <button type="button" onClick={handleDisconnectGmail} className="text-[10px] font-bold uppercase text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 transition-colors">
                    {t('emailMonitor.disconnect')}
                  </button>
                </div>
                {!emailMonitorState.enabled && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">{t('emailMonitor.pausedWarning')}</p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-center">
                    <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{emailMonitorState.totalScanned}</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-mono">{t('emailMonitor.scanned')}</p>
                  </div>
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg text-center">
                    <p className="text-xl font-bold text-rose-600 dark:text-rose-400">
                      {emailMonitorState.alerts.filter((a) => !a.dismissed && a.riskLevel === 'dangerous').length}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-mono">{t('emailMonitor.dangerous')}</p>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center">
                    <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                      {emailMonitorState.alerts.filter((a) => !a.dismissed && a.riskLevel === 'suspicious').length}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-mono">{t('emailMonitor.suspicious')}</p>
                  </div>
                </div>
                {emailMonitorState.alerts.filter((a) => !a.dismissed).length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{t('emailMonitor.alerts')}</p>
                      <button type="button" onClick={handleClearAlerts} className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-mono uppercase">{t('emailMonitor.clearAlerts')}</button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {emailMonitorState.alerts.filter((a) => !a.dismissed).slice(-5).reverse().map((alert) => (
                        <div key={alert.id} className={cn('p-3 rounded-lg border text-xs', alert.riskLevel === 'dangerous' ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800' : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800')}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {alert.riskLevel === 'dangerous' ? <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                                <span className={cn('font-bold uppercase text-[9px] font-mono px-1.5 py-0.5 rounded', alert.riskLevel === 'dangerous' ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300')}>{alert.riskLevel}</span>
                              </div>
                              <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{alert.subject}</p>
                              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono truncate" dir="ltr">{alert.from}</p>
                              {alert.matchedRules.length > 0 && (
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                                  {t('emailMonitor.triggeredBy')}: {alert.matchedRules[0].description}
                                  {alert.matchedRules.length > 1 ? ` +${alert.matchedRules.length - 1}` : ''}
                                </p>
                              )}
                            </div>
                            <button type="button" onClick={() => handleDismissAlert(alert.id)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 shrink-0 text-lg leading-none" title={t('emailMonitor.dismiss')}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                  <button type="button" onClick={() => setShowRulesPanel((v) => !v)} className="w-full flex items-center justify-between p-3 text-start bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{t('emailMonitor.cashRules')}</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{emailMonitorState.rules.filter((r) => r.enabled).length} / {emailMonitorState.rules.length} {t('emailMonitor.rulesActive')}</p>
                    </div>
                    {showRulesPanel ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                  </button>
                  <AnimatePresence initial={false}>
                    {showRulesPanel && (
                      <motion.div key="rules-panel" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15, ease: 'easeOut' }} className="overflow-hidden">
                        <div className="p-3 space-y-3 bg-white dark:bg-zinc-900">
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {emailMonitorState.rules.map((rule) => (
                              <div key={rule.id} className="flex items-center gap-2 p-2 rounded border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                                <button type="button" onClick={() => handleToggleCashRule(rule.id, !rule.enabled)} className={cn('relative w-8 h-4 rounded-full transition-colors duration-200 shrink-0', rule.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600')}>
                                  <span className={cn('absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200', rule.enabled ? 'translate-x-4' : 'translate-x-0')} />
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-mono text-zinc-700 dark:text-zinc-300 truncate">{rule.pattern}</p>
                                  <p className="text-[9px] text-zinc-400 dark:text-zinc-500">{rule.type}</p>
                                </div>
                                <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase shrink-0', rule.riskLevel === 'dangerous' ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300')}>{rule.riskLevel}</span>
                                {!rule.isDefault && (
                                  <button type="button" onClick={() => handleRemoveCashRule(rule.id)} className="text-zinc-400 hover:text-rose-500 text-base leading-none shrink-0" title={t('emailMonitor.removeRule')}>×</button>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t('emailMonitor.addRule')}</p>
                            <input value={newRulePattern} onChange={(e) => setNewRulePattern(e.target.value)} placeholder={t('emailMonitor.rulePattern')} className="w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-600 rounded text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                            <div className="grid grid-cols-2 gap-2">
                              <select value={newRuleType} onChange={(e) => setNewRuleType(e.target.value as CashRuleType)} className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-600 rounded text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none">
                                <option value="keyword">{t('emailMonitor.typeKeyword')}</option>
                                <option value="sender_domain">{t('emailMonitor.typeSenderDomain')}</option>
                                <option value="subject_pattern">{t('emailMonitor.typeSubject')}</option>
                              </select>
                              <select value={newRuleRisk} onChange={(e) => setNewRuleRisk(e.target.value as MonitorRiskLevel)} className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-600 rounded text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none">
                                <option value="suspicious">{t('emailMonitor.riskSuspicious')}</option>
                                <option value="dangerous">{t('emailMonitor.riskDangerous')}</option>
                              </select>
                            </div>
                            <button type="button" onClick={handleAddRuleClick} disabled={!newRulePattern.trim()} className="w-full py-1.5 rounded text-[10px] font-bold uppercase bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40 transition-colors">{t('emailMonitor.addRuleButton')}</button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
            {!isConnectingGmail && !emailMonitorState.connection && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg">
                  <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300">{t('emailMonitor.infoTitle')}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">{t('emailMonitor.infoText')}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">{t('emailMonitor.setupTitle')}</p>
                  <ol className="space-y-1.5">
                    {[t('emailMonitor.step1'), t('emailMonitor.step2').replace('{origin}', window.location.origin + '/auth/gmail.html'), t('emailMonitor.step3')].map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-zinc-600 dark:text-zinc-300">
                        <span className="shrink-0 w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('emailMonitor.clientIdLabel')}</label>
                  <input value={gmailClientId} onChange={(e) => setGmailClientId(e.target.value)} placeholder="123456789-xxxxx.apps.googleusercontent.com" dir="ltr" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  <button type="button" onClick={() => setShowGmailSecret((v) => !v)} className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-mono">
                    {showGmailSecret ? '▲' : '▼'} {t('emailMonitor.optionalSecret')}
                  </button>
                  <AnimatePresence initial={false}>
                    {showGmailSecret && (
                      <motion.div key="secret-input" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                        <input value={gmailClientSecret} onChange={(e) => setGmailClientSecret(e.target.value)} type="password" placeholder={t('emailMonitor.clientSecretPlaceholder')} dir="ltr" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <motion.button onClick={handleConnectPress} disabled={!gmailClientId.trim() || isConnectingGmail} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all">
                    <Mail className="w-4 h-4" />
                    {t('emailMonitor.connectButton')}
                  </motion.button>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-auto">
            <span className="text-[9px] font-mono text-zinc-400 uppercase">
              {emailMonitorState.lastCheckedAt ? `${t('emailMonitor.lastChecked')}: ${new Date(emailMonitorState.lastCheckedAt).toLocaleString()}` : t('policies.serviceInactive')}
            </span>
            {emailMonitorState.connection && (
              <motion.button whileHover={{ x: 2 }} whileTap={{ scale: 0.96 }} onClick={handleDisconnectGmail} className="text-[10px] font-bold uppercase tracking-widest text-rose-500 hover:text-rose-700">
                {t('emailMonitor.disconnect')}
              </motion.button>
            )}
          </div>
        </Card>

        {/* ── Password Manager Card ── */}
        <Card className="p-6 border-t-4 border-t-amber-500 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 shrink-0">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-bold text-sm uppercase tracking-tight text-zinc-900 dark:text-zinc-100">
                {t('passwordManager.title')}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success">{t('passwordManager.encryptedStorage')}</Badge>
            </div>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 italic leading-relaxed">
            "{t('passwordManager.subtitle')}"
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-center">
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{passwordManagerState.meta.totalEntries}</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-mono">{t('passwordManager.totalEntries')}</p>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg text-center">
              <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{passwordManagerState.meta.weakCount}</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-mono">{t('passwordManager.weakPasswords')}</p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center">
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {passwordManagerState.weakAlerts.filter((a) => !a.dismissed).length}
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-mono">{t('passwordManager.weakAlerts')}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mb-5">
            <motion.button
              onClick={() => setIsPmFormOpen((v) => !v)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('passwordManager.addEntry')}
            </motion.button>
            <motion.button
              onClick={handleRunWeakPasswordScan}
              disabled={isPasswordManagerScanning}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 text-xs font-bold rounded-lg transition-all disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isPasswordManagerScanning && 'animate-spin')} />
              {isPasswordManagerScanning ? t('passwordManager.scanning') : t('passwordManager.scanNow')}
            </motion.button>
            <motion.button
              onClick={handleSyncEmailPasswords}
              disabled={isEmailSyncing || !emailMonitorState.connection}
              title={!emailMonitorState.connection ? t('passwordManager.emailSyncNotConnected') : t('passwordManager.emailSyncHint')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-lg transition-all disabled:opacity-50"
            >
              <Mail className="w-3.5 h-3.5" />
              {isEmailSyncing ? t('passwordManager.emailSyncing') : t('passwordManager.emailSync')}
            </motion.button>
          </div>

          {/* Add password form */}
          <AnimatePresence>
            {isPmFormOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mb-5"
              >
                <form onSubmit={handlePmAddSubmit} className="p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-700 dark:text-zinc-200">{t('passwordManager.addEntry')}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('passwordManager.service')}</label>
                      <input
                        value={pmService}
                        onChange={(e) => setPmService(e.target.value)}
                        placeholder={t('passwordManager.servicePlaceholder')}
                        required
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        dir={dir}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('passwordManager.username')}</label>
                      <input
                        value={pmUsername}
                        onChange={(e) => setPmUsername(e.target.value)}
                        placeholder={t('passwordManager.usernamePlaceholder')}
                        required
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('passwordManager.password')}</label>
                      <div className="relative">
                        <input
                          ref={pmPasswordRef}
                          type={showPmPassword ? 'text' : 'password'}
                          value={pmPassword}
                          onChange={(e) => setPmPassword(e.target.value)}
                          placeholder={t('passwordManager.passwordPlaceholder')}
                          required
                          className="w-full px-3 py-2 pr-9 border border-zinc-200 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPmPassword((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        >
                          {showPmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {pmLiveStrength && (
                        <div className="mt-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                              <div
                                className={cn('h-full rounded-full transition-all duration-300',
                                  pmLiveStrength.score >= 80 ? 'bg-emerald-500' :
                                  pmLiveStrength.score >= 50 ? 'bg-amber-400' : 'bg-rose-500'
                                )}
                                style={{ width: `${pmLiveStrength.score}%` }}
                              />
                            </div>
                            <span className={cn('text-[10px] font-bold font-mono',
                              pmLiveStrength.score >= 80 ? 'text-emerald-600' :
                              pmLiveStrength.score >= 50 ? 'text-amber-500' : 'text-rose-500'
                            )}>
                              {pmLiveStrength.score >= 80 ? t('passwordManager.strengthStrong') :
                               pmLiveStrength.score >= 50 ? t('passwordManager.strengthFair') :
                               t('passwordManager.strengthWeak')}
                            </span>
                          </div>
                          {pmLiveStrength.reasons.length > 0 && (
                            <ul className="space-y-0.5">
                              {pmLiveStrength.reasons.map((r, i) => (
                                <li key={i} className="text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                  <AlertTriangle className="w-2.5 h-2.5 shrink-0" /> {r}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('passwordManager.url')}</label>
                      <input
                        value={pmUrl}
                        onChange={(e) => setPmUrl(e.target.value)}
                        placeholder={t('passwordManager.urlPlaceholder')}
                        type="url"
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('passwordManager.notes')}</label>
                    <textarea
                      value={pmNotes}
                      onChange={(e) => setPmNotes(e.target.value)}
                      placeholder={t('passwordManager.notesPlaceholder')}
                      rows={2}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                      dir={dir}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <motion.button
                      type="button"
                      onClick={() => setIsPmFormOpen(false)}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      {t('passwordManager.cancel')}
                    </motion.button>
                    <motion.button
                      type="submit"
                      disabled={isPmSaving || !pmService.trim() || !pmUsername.trim() || !pmPassword.trim()}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-amber-600 transition-all"
                    >
                      {isPmSaving ? t('passwordManager.saving') : t('passwordManager.save')}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email sync hints */}
          <AnimatePresence>
            {emailSyncHints.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mb-5 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" />
                    {t('passwordManager.emailSyncHintsFound').replace('{count}', String(emailSyncHints.length))}
                  </p>
                  <motion.button
                    onClick={handleImportAllEmailHints}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200"
                  >
                    {t('passwordManager.importAllHints')}
                  </motion.button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {emailSyncHints.map((hint) => (
                    <div key={hint.messageId} className="flex items-center justify-between gap-3 p-2 bg-white dark:bg-zinc-900 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{hint.service}</p>
                        <p className="text-zinc-500 dark:text-zinc-400 font-mono text-[10px] truncate" dir="ltr">{hint.from}</p>
                        <p className="text-zinc-400 dark:text-zinc-500 font-mono text-[10px] truncate">{hint.subject}</p>
                      </div>
                      <motion.button
                        onClick={() => handleImportEmailHint(hint)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-all shrink-0"
                      >
                        {t('passwordManager.importHint')}
                      </motion.button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Weak password alerts */}
          {passwordManagerState.weakAlerts.filter((a) => !a.dismissed).length > 0 && (
            <div className="mb-5 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                {t('passwordManager.weakAlerts')} ({passwordManagerState.weakAlerts.filter((a) => !a.dismissed).length})
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {passwordManagerState.weakAlerts.filter((a) => !a.dismissed).map((alert) => (
                  <div key={alert.id} className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg text-xs flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-zinc-900 dark:text-zinc-100">{alert.service}</p>
                      <p className="text-zinc-500 dark:text-zinc-400 font-mono text-[10px] truncate" dir="ltr">{alert.username}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {alert.reasons.map((r, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-[9px] font-mono rounded">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                    <motion.button
                      onClick={() => handleDismissWeakAlert(alert.id)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="text-[10px] font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 uppercase shrink-0"
                    >
                      {t('passwordManager.dismissAlert')}
                    </motion.button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Password entries list */}
          {passwordManagerState.entries.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl">
              <Lock className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
              <p className="text-xs text-zinc-400">{t('passwordManager.noEntries')}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {passwordManagerState.entries.map((entry) => {
                const revealed = revealedPasswords[entry.id];
                return (
                  <motion.div
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      'p-3 rounded-xl border text-xs',
                      entry.isWeak
                        ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <KeyRound className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{entry.service}</span>
                        {entry.isWeak && <Badge variant="error">{t('passwordManager.strengthWeak')}</Badge>}
                        {entry.source === 'email_sync' && <Badge variant="info">{t('passwordManager.sourceEmail')}</Badge>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <motion.button
                          onClick={() => handleRevealPassword(entry)}
                          whileTap={{ scale: 0.95 }}
                          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors"
                          title={revealed ? t('passwordManager.hide') : t('passwordManager.reveal')}
                        >
                          {revealingId === entry.id ? (
                            <div className="w-3.5 h-3.5 border border-zinc-400 border-t-transparent rounded-full animate-spin" />
                          ) : revealed ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </motion.button>
                        <motion.button
                          onClick={() => handleRemovePasswordEntry(entry.id)}
                          whileTap={{ scale: 0.95 }}
                          className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-900/40 text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                          title={t('passwordManager.remove')}
                        >
                          <Plus className="w-3.5 h-3.5 rotate-45" />
                        </motion.button>
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono truncate" dir="ltr">{entry.username}</p>
                    {revealed && (
                      <div className="mt-1.5 p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded font-mono text-xs text-emerald-700 dark:text-emerald-400 break-all select-all" dir="ltr">
                        {revealed}
                      </div>
                    )}
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full',
                            entry.strengthScore >= 80 ? 'bg-emerald-500' :
                            entry.strengthScore >= 50 ? 'bg-amber-400' : 'bg-rose-500'
                          )}
                          style={{ width: `${entry.strengthScore}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-zinc-400 uppercase">{entry.strengthScore}%</span>
                    </div>
                    <p className="text-[9px] font-mono text-zinc-400 mt-1 uppercase">{t('passwordManager.addedOn')}: {new Date(entry.createdAt).toLocaleDateString()}</p>
                  </motion.div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-auto">
            <span className="text-[9px] font-mono text-zinc-400 uppercase">
              {t('passwordManager.lastScan')}: {passwordManagerState.meta.lastWeakScanAt ? new Date(passwordManagerState.meta.lastWeakScanAt).toLocaleString() : '—'}
            </span>
            <span className="text-[9px] font-mono text-zinc-400 uppercase">{t('passwordManager.encryptedStorage')}</span>
          </div>
        </Card>

        </div>
      </div>
    </motion.div>
  );
}
