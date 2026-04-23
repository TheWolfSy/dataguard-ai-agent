import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle, Eye, EyeOff, FileSpreadsheet, Search } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { decryptData } from '../../services/encryption';
import type { DataLog } from '../../services/sqlService';

type TFunc = (key: string) => string;

interface LogsPageProps {
  t: TFunc;
  dir: string;
  logs: DataLog[];
  showDecrypted: Record<string, boolean>;
  toggleDecryption: (id: string) => void;
}

export function LogsPage({ t, dir, logs, showDecrypted, toggleDecryption }: LogsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // مُرشَّح السجلات — يُعاد احتسابه فقط عند تغيّر logs أو البحث
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(
      (log) =>
        log.classification?.toLowerCase().includes(q) ||
        log.protectionStatus?.toLowerCase().includes(q) ||
        log.content?.toLowerCase().includes(q) ||
        log.createdAt.toLocaleString().toLowerCase().includes(q)
    );
  }, [logs, searchQuery]);

  // دالة البحث — ثابتة المرجع
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  // جدول المحتوى المفكوك التشفير مُخزَّن — لا يُعيد حساب decryptData إلا عند الحاجة
  const decryptedContents = useMemo(() => {
    const map: Record<string, string> = {};
    for (const log of filteredLogs) {
      if (showDecrypted[log.id]) {
        map[log.id] = decryptData(log.content);
      }
    }
    return map;
  }, [filteredLogs, showDecrypted]);

  const downloadLogsCSV = useCallback(() => {
    const isRtl = dir === 'rtl';
    const headers = isRtl
      ? ['التاريخ', 'التصنيف', 'المحتوى', 'معلومات شخصية', 'تفاصيل المعلومات الشخصية', 'حالة الحماية']
      : ['Date', 'Classification', 'Content', 'PII Detected', 'PII Details', 'Protection Status'];
    const rows = filteredLogs.map((log) => [
      log.createdAt.toLocaleString(),
      log.classification,
      log.content.replace(/"/g, '""'),
      log.piiDetected ? (isRtl ? 'نعم' : 'Yes') : (isRtl ? 'لا' : 'No'),
      log.piiDetails.replace(/"/g, '""'),
      log.protectionStatus,
    ].map((v) => `"${v}"`).join(','));
    const csv = [headers.map((h) => `"${h}"`).join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dataguard-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs, dir]);

  return (
    <motion.div
      key="logs"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold tracking-tight">{t('logs.title')}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <motion.button
            onClick={downloadLogsCSV}
            disabled={filteredLogs.length === 0}
            whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed text-blue-300 hover:text-white"
            style={{ background: 'rgba(10,20,45,0.7)', borderColor: 'rgba(96,165,250,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
          >
            <FileSpreadsheet className="w-3 h-3" />
            {t('logs.downloadCsv')}
          </motion.button>
          <div className="relative">
          <Search className={`w-4 h-4 absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-zinc-400`} />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={t('logs.searchPlaceholder')}
            className={`${dir === 'rtl' ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 rounded-lg text-xs outline-none text-slate-200 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 transition-all`}
            style={{ background: 'rgba(6,13,31,0.7)', border: '1px solid rgba(96,165,250,0.25)' }}
            dir={dir}
          />
          </div>
        </div>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
              <tr className="border-b" style={{ background: 'rgba(10,20,45,0.7)', borderColor: 'rgba(96,165,250,0.15)' }}>
              <th className="px-6 py-3 text-[10px] font-mono text-zinc-400 uppercase tracking-widest italic">{t('logs.timestamp')}</th>
              <th className="px-6 py-3 text-[10px] font-mono text-zinc-400 uppercase tracking-widest italic">{t('logs.classification')}</th>
              <th className="px-6 py-3 text-[10px] font-mono text-zinc-400 uppercase tracking-widest italic">{t('logs.contentSnippet')}</th>
              <th className="px-6 py-3 text-[10px] font-mono text-zinc-400 uppercase tracking-widest italic">{t('logs.piiStatus')}</th>
              <th className="px-6 py-3 text-[10px] font-mono text-zinc-400 uppercase tracking-widest italic">{t('logs.protection')}</th>
            </tr>
          </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="transition-colors hover:bg-blue-400/5" style={{ borderBottom: '1px solid rgba(96,165,250,0.07)' }}>
                <td className="px-6 py-4 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{log.createdAt.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <Badge variant={log.classification === 'Highly Sensitive' ? 'error' : log.classification === 'Confidential' ? 'warning' : 'default'}>
                    {log.classification}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono truncate max-w-xs text-slate-300">
                      {showDecrypted[log.id] ? decryptedContents[log.id] : log.content}
                    </p>
                    <motion.button
                      onClick={() => toggleDecryption(log.id)}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1 hover:bg-orange-500/10 hover:text-orange-400 rounded transition-colors text-slate-500"
                    >
                      {showDecrypted[log.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </motion.button>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {log.piiDetected ? (
                    <div className="flex items-center gap-1.5 text-rose-600">
                      <AlertTriangle className="w-3 h-3" />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">{t('logs.detected')}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle className="w-3 h-3" />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">{t('logs.clear')}</span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-[10px] font-mono uppercase" style={{ color: 'var(--text-muted)' }}>{log.protectionStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </motion.div>
  );
}
