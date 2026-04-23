import React from 'react';
import { motion } from 'motion/react';
import { FileDown, FileSpreadsheet, History } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import type { AuditLog } from '../../services/sqlService';

type TFunc = (key: string) => string;

interface AuditPageProps {
  t: TFunc;
  dir: string;
  language: string;
  auditLogs: AuditLog[];
  auditImportRef: React.RefObject<HTMLInputElement | null>;
  handleAuditImport: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  downloadAuditPDF: () => void;
}

export function AuditPage({
  t, dir, language, auditLogs,
  auditImportRef, handleAuditImport, downloadAuditPDF,
}: AuditPageProps) {
  const [riskFilter, setRiskFilter] = React.useState<'all' | 'high' | 'medium' | 'low'>('all');

  const getLogRisk = (log: AuditLog): 'high' | 'medium' | 'low' => {
    if (log.operation === 'DELETE' || log.operation === 'SECURITY') return 'high';
    if (log.operation === 'UPDATE' || log.changeStatus === 'MODIFIED' || log.changeStatus === 'REMOVED') return 'medium';
    return 'low';
  };

  const filteredLogs = riskFilter === 'all' ? auditLogs : auditLogs.filter((l) => getLogRisk(l) === riskFilter);
  const downloadAuditCSV = () => {
    const isRtl = dir === 'rtl';
    const headers = isRtl
      ? ['التاريخ', 'البريد الإلكتروني', 'المعرف', 'نوع التدقيق', 'مستوى الخطر', 'المورد', 'حالة التغيير', 'التفاصيل']
      : ['Date', 'User Email', 'UID', 'Operation', 'Risk Level', 'Resource', 'Change Status', 'Details'];
    const rows = auditLogs.map((log) => {
      const isHigh = log.operation === 'DELETE' || log.operation === 'SECURITY';
      const isMedium = !isHigh && (log.operation === 'UPDATE' || log.changeStatus === 'MODIFIED' || log.changeStatus === 'REMOVED');
      const risk = isHigh ? (isRtl ? 'عالٍ' : 'High') : isMedium ? (isRtl ? 'متوسط' : 'Medium') : (isRtl ? 'منخفض' : 'Low');
      return [
        log.timestamp.toLocaleString(),
        log.userEmail,
        log.uid,
        log.operation,
        risk,
        log.resourcePath,
        log.changeStatus ?? '',
        log.details.replace(/"/g, '""'),
      ].map((v) => `"${v}"`).join(',');
    });
    const csv = [headers.map((h) => `"${h}"`).join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dataguard-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      key="audit"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{t('audit.title')}</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('audit.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input ref={auditImportRef} type="file" accept="application/json" onChange={handleAuditImport} className="hidden" />
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
            onClick={() => auditImportRef.current?.click()}
            className="px-3 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all duration-200 text-slate-300 hover:text-white"
            style={{ background: 'rgba(10,20,45,0.7)', borderColor: 'rgba(96,165,250,0.25)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
          >
            {t('audit.importTest')}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
            onClick={downloadAuditCSV}
            disabled={auditLogs.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-[10px] font-bold uppercase tracking-widest text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-3 h-3" />
            {t('audit.downloadCsv')}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
            onClick={downloadAuditPDF}
            disabled={auditLogs.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-[10px] font-bold uppercase tracking-widest text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileDown className="w-3 h-3" />
            {t('audit.downloadPdf')}
          </motion.button>
          <Badge variant="error">{t('audit.adminOnly')}</Badge>
        </div>
      </div>

      {/* Stats */}
      {auditLogs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: 'high' as const, label: t('audit.riskHigh'), count: auditLogs.filter(l => l.operation === 'DELETE' || l.operation === 'SECURITY').length, color: 'border-l-rose-500', text: 'text-rose-600', bg: 'bg-rose-50', activeBg: 'bg-rose-100 ring-2 ring-rose-400' },
            { key: 'medium' as const, label: t('audit.riskMedium'), count: auditLogs.filter(l => l.operation === 'UPDATE' || l.changeStatus === 'MODIFIED' || l.changeStatus === 'REMOVED').length, color: 'border-l-amber-500', text: 'text-amber-600', bg: 'bg-amber-50', activeBg: 'bg-amber-100 ring-2 ring-amber-400' },
            { key: 'low' as const, label: t('audit.riskLow'), count: auditLogs.filter(l => l.operation === 'READ' || l.operation === 'SCAN' || l.operation === 'CREATE').length, color: 'border-l-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50', activeBg: 'bg-emerald-100 ring-2 ring-emerald-400' },
            { key: 'all' as const, label: t('audit.operation'), count: auditLogs.length, color: 'border-l-zinc-900', text: 'text-zinc-900', bg: 'bg-zinc-50', activeBg: 'bg-zinc-200 ring-2 ring-zinc-400' },
          ].map((s) => {
            const isActive = riskFilter === s.key;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => setRiskFilter(isActive ? 'all' : s.key)}
                className={`text-start border border-l-4 ${s.color} rounded-lg px-4 py-3 transition-all duration-150 cursor-pointer focus:outline-none`}
                style={{ background: isActive ? undefined : 'rgba(6,13,31,0.7)', borderColor: isActive ? undefined : 'rgba(96,165,250,0.12)' }}
              >
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  {s.label}
                  {isActive && <span className="text-[8px] font-bold uppercase tracking-widest opacity-60">✕</span>}
                </div>
                <div className={`text-2xl font-bold tracking-tighter ${s.text}`}>{s.count}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      <Card className="overflow-x-auto">
        {auditLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-3">
            <History className="w-8 h-8 opacity-30" />
            <span className="text-xs font-mono uppercase tracking-widest">{t('audit.noLogs')}</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-3">
            <History className="w-8 h-8 opacity-30" />
            <span className="text-xs font-mono uppercase tracking-widest">{t('audit.noLogs')}</span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b" style={{ background: 'rgba(10,20,45,0.6)', borderColor: 'rgba(96,165,250,0.12)' }}>
                <th className="px-4 py-3 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('audit.date')}</th>
                <th className="px-4 py-3 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('audit.user')}</th>
                <th className="px-4 py-3 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('audit.riskLevel')}</th>
                <th className="px-4 py-3 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('audit.operation')}</th>
                <th className="px-4 py-3 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('audit.resource')}</th>
                <th className="px-4 py-3 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('audit.change')}</th>
                <th className="px-4 py-3 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('audit.details')}</th>
              </tr>
            </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredLogs.map((log) => {
                const isHigh = log.operation === 'DELETE' || log.operation === 'SECURITY';
                const isMedium = !isHigh && (log.operation === 'UPDATE' || log.changeStatus === 'MODIFIED' || log.changeStatus === 'REMOVED');
                const riskVariant = isHigh ? 'error' : isMedium ? 'warning' : 'success';
                const riskLabel = isHigh ? t('audit.riskHigh') : isMedium ? t('audit.riskMedium') : t('audit.riskLow');
                return (
                  <tr key={log.id} className="transition-colors hover:bg-blue-400/5" style={{ borderBottom: '1px solid rgba(96,165,250,0.07)' }}>
                    <td className="px-4 py-3 text-[10px] font-mono whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      <div className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>{log.timestamp.toLocaleDateString()}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{log.timestamp.toLocaleTimeString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-slate-200 truncate max-w-[140px]">{log.userEmail}</span>
                        <span className="text-[9px] font-mono uppercase truncate max-w-[140px]" style={{ color: 'var(--text-muted)' }}>{log.uid}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge variant={riskVariant}>{riskLabel}</Badge></td>
                    <td className="px-4 py-3">
                      <Badge variant={log.operation === 'DELETE' ? 'error' : log.operation === 'CREATE' ? 'success' : log.operation === 'SECURITY' ? 'warning' : log.operation === 'SCAN' ? 'info' : 'default'}>
                        {log.operation}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[10px] font-mono max-w-[160px] truncate" style={{ color: 'var(--text-muted)' }}>{log.resourcePath}</td>
                    <td className="px-4 py-3">
                      {log.changeStatus ? (
                        <Badge variant={log.changeStatus === 'MODIFIED' || log.changeStatus === 'REMOVED' ? 'warning' : log.changeStatus === 'NEW' ? 'success' : 'default'}>
                          {log.changeStatus}
                        </Badge>
                      ) : (
                        <span className="text-[10px] font-mono text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[220px] text-slate-300">
                      <span className="line-clamp-2">{log.details}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </motion.div>
  );
}
