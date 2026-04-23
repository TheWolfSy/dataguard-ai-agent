import React, { useState, useEffect, useCallback } from 'react';
import { getDb } from '../../database';
import { getAuthDb } from '../../authDatabase';
import {
  CVE_DEFAULT_SOURCE,
  initializeDefaultCVESource,
  syncRemoteSecurityPolicy,
  getSecurityPolicies,
  searchLocalPolicyData,
  type SecurityPolicy,
} from '../../services/sqlService';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database,
  Shield,
  Search,
  RefreshCw,
  Table,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit3,
  Save,
  X,
  Terminal,
  AlertTriangle,
  Bug,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import MasterUserLookup from './MasterUserLookup';
import { MasterAccountsManager } from './MasterAccountsManager';

type DbType = 'main' | 'auth';
type ActiveSection = 'databases' | 'cve';
type TableInfo = { name: string; rowCount: number };
type RowData = Record<string, unknown>;

export function MasterPanel({ dir }: { dir: string }) {
  const [activeSection, setActiveSection] = useState<'databases' | 'cve'>('databases');
  const [activeDb, setActiveDb] = useState<DbType>('main');
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlResult, setSqlResult] = useState<string>('');
  const [editingRow, setEditingRow] = useState<{ table: string; id: string; data: RowData } | null>(null);
  const [showSqlConsole, setShowSqlConsole] = useState(false);
  const [showUserLookup, setShowUserLookup] = useState(false);
  const [showMasterAccounts, setShowMasterAccounts] = useState(false);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // CVE state
  const [cvePolicies, setCvePolicies] = useState<SecurityPolicy[]>([]);
  const [cveSearchQuery, setCveSearchQuery] = useState('');
  const [cveSearchResults, setCveSearchResults] = useState<string>('');
  const [cveSyncing, setCveSyncing] = useState(false);
  const [cveInitializing, setCveInitializing] = useState(false);
  const [cveRefCount, setCveRefCount] = useState(0);
  const [cveLastSync, setCveLastSync] = useState<string | null>(null);

  const getDatabase = useCallback(async () => {
    return activeDb === 'main' ? getDb() : getAuthDb();
  }, [activeDb]);

  const loadTables = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const db = await getDatabase();
      const res = await db.query<{ tablename: string }>(
        `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename`
      );
      const tableInfos: TableInfo[] = [];
      for (const row of res.rows) {
        const countRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM "${row.tablename}"`);
        tableInfos.push({ name: row.tablename, rowCount: parseInt(countRes.rows[0]?.count ?? '0', 10) });
      }
      setTables(tableInfos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحميل الجداول');
    } finally {
      setLoading(false);
    }
  }, [getDatabase]);

  const loadTableData = useCallback(async (tableName: string) => {
    setLoading(true);
    setError('');
    try {
      const db = await getDatabase();
      const res = await db.query(`SELECT * FROM "${tableName}" ORDER BY 1 LIMIT 500`);
      if (res.rows.length > 0) {
        setColumns(Object.keys(res.rows[0] as object));
      } else {
        // Get column names even if table is empty
        const colRes = await db.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
          [tableName]
        );
        setColumns(colRes.rows.map(r => r.column_name));
      }
      setRows(res.rows as RowData[]);
      setSelectedTable(tableName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, [getDatabase]);

  const executeSql = useCallback(async () => {
    if (!sqlQuery.trim()) return;
    setLoading(true);
    setError('');
    setSqlResult('');
    try {
      const db = await getDatabase();
      const res = await db.query(sqlQuery);
      const resultText = res.rows.length > 0
        ? JSON.stringify(res.rows, null, 2)
        : `تم التنفيذ بنجاح. (${res.affectedRows ?? 0} صفوف متأثرة)`;
      setSqlResult(resultText);
      setSuccess('تم تنفيذ الاستعلام بنجاح');
      // Refresh tables after any query
      await loadTables();
      if (selectedTable) await loadTableData(selectedTable);
    } catch (err) {
      setSqlResult(`خطأ: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [sqlQuery, getDatabase, loadTables, loadTableData, selectedTable]);

  const deleteRow = useCallback(async (tableName: string, row: RowData) => {
    const pkCol = columns[0];
    if (!pkCol) return;
    const pkVal = row[pkCol];
    setLoading(true);
    setError('');
    try {
      const db = await getDatabase();
      await db.query(`DELETE FROM "${tableName}" WHERE "${pkCol}" = $1`, [pkVal]);
      setSuccess(`تم حذف السجل بنجاح`);
      await loadTableData(tableName);
      await loadTables();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحذف');
    } finally {
      setLoading(false);
    }
  }, [columns, getDatabase, loadTableData, loadTables]);

  const saveEditedRow = useCallback(async () => {
    if (!editingRow) return;
    setLoading(true);
    setError('');
    try {
      const db = await getDatabase();
      const pkCol = columns[0];
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(editingRow.data)) {
        if (key === pkCol) continue;
        setClauses.push(`"${key}" = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
      values.push(editingRow.id);

      await db.query(
        `UPDATE "${editingRow.table}" SET ${setClauses.join(', ')} WHERE "${pkCol}" = $${paramIndex}`,
        values
      );
      setSuccess('تم تحديث السجل بنجاح');
      setEditingRow(null);
      await loadTableData(editingRow.table);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحديث');
    } finally {
      setLoading(false);
    }
  }, [editingRow, columns, getDatabase, loadTableData]);

  // --- CVE functions ---
  const loadCveData = useCallback(async () => {
    try {
      const db = await getDb();
      // Get all policies
      const policies = await getSecurityPolicies('master-root');
      setCvePolicies(policies);

      // Count CVE references
      const refRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM policy_rule_references`);
      setCveRefCount(parseInt(refRes.rows[0]?.count ?? '0', 10));

      // Get last sync time for default CVE source
      const syncRes = await db.query<{ last_synced_at: string }>(
        `SELECT last_synced_at FROM policy_rule_references WHERE is_default_source = TRUE ORDER BY last_synced_at DESC LIMIT 1`
      );
      setCveLastSync(syncRes.rows[0]?.last_synced_at ?? null);
    } catch (err) {
      console.error('Failed to load CVE data', err);
    }
  }, []);

  const handleCveInit = useCallback(async () => {
    setCveInitializing(true);
    setError('');
    try {
      await initializeDefaultCVESource('master-root', 'master@dataguard.local');
      setSuccess('تم تهيئة مصدر CVE الافتراضي بنجاح');
      await loadCveData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تهيئة CVE');
    } finally {
      setCveInitializing(false);
    }
  }, [loadCveData]);

  const handleCveSync = useCallback(async (policyId: string, uid: string) => {
    setCveSyncing(true);
    setError('');
    try {
      await syncRemoteSecurityPolicy(policyId, { uid, userEmail: 'master@dataguard.local' });
      setSuccess('تمت مزامنة CVE بنجاح');
      await loadCveData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشلت المزامنة');
    } finally {
      setCveSyncing(false);
    }
  }, [loadCveData]);

  const handleCveSearch = useCallback(async () => {
    if (!cveSearchQuery.trim()) return;
    try {
      const results = await searchLocalPolicyData(cveSearchQuery, 'master-root');
      if (results.length === 0) {
        setCveSearchResults('لا توجد نتائج لـ "' + cveSearchQuery + '"');
      } else {
        setCveSearchResults(JSON.stringify(results, null, 2));
      }
    } catch (err) {
      setCveSearchResults(`خطأ: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [cveSearchQuery]);

  useEffect(() => {
    if (activeSection === 'cve') {
      loadCveData();
    }
  }, [activeSection, loadCveData]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const filteredRows = searchTerm
    ? rows.filter(row =>
        Object.values(row).some(v =>
          String(v ?? '').toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    : rows;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-full space-y-4"
      dir={dir}
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              لوحة تحكم Master
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-mono uppercase">ROOT</span>
            </h2>
            <p className="text-[11px] text-slate-400">وصول كامل لجميع قواعد البيانات والإعدادات</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSqlConsole(!showSqlConsole)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              showSqlConsole
                ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-violet-500/30'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            SQL Console
          </button>
          <button
            onClick={loadTables}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          <button
            onClick={() => setShowUserLookup((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all"
          >
            {showUserLookup ? 'إغلاق البحث عن مستخدم' : 'بحث عن مستخدم بالمعرف (ID)'}
          </button>
          <button
            onClick={() => setShowMasterAccounts((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/15 text-red-300 border border-red-500/25 hover:bg-red-500/25 transition-all"
          >
            {showMasterAccounts ? 'إغلاق إدارة الماستر' : 'إدارة حسابات الماستر'}
          </button>
        </div>
      </div>

      {showUserLookup && <MasterUserLookup />}
      {showMasterAccounts && <MasterAccountsManager />}

      {/* ═══ CVE SECTION ═══ */}
      {activeSection === 'cve' && (
        <div className="space-y-4">
          {/* CVE Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl" style={{ background: 'rgba(10,20,45,0.8)', border: '1px solid rgba(251,191,36,0.25)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Bug className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400/70">مصدر CVE</span>
              </div>
              <p className="text-sm font-bold text-white truncate">{CVE_DEFAULT_SOURCE.name}</p>
              <p className="text-[10px] text-slate-500 mt-1 font-mono truncate" dir="ltr">{CVE_DEFAULT_SOURCE.sourceUrl}</p>
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(10,20,45,0.8)', border: '1px solid rgba(96,165,250,0.2)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400/70">مراجع السياسات</span>
              </div>
              <p className="text-2xl font-bold text-white">{cveRefCount}</p>
              <p className="text-[10px] text-slate-500 mt-1">سجلات في policy_rule_references</p>
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(10,20,45,0.8)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/70">آخر مزامنة</span>
              </div>
              <p className="text-sm font-bold text-white">
                {cveLastSync ? new Date(cveLastSync).toLocaleString('ar') : 'لم تتم بعد'}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">كل {CVE_DEFAULT_SOURCE.syncIntervalHours} ساعة</p>
            </div>
          </div>

          {/* CVE Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCveInit}
              disabled={cveInitializing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-all disabled:opacity-50"
            >
              <Download className={`w-3.5 h-3.5 ${cveInitializing ? 'animate-spin' : ''}`} />
              {cveInitializing ? 'جاري التهيئة...' : 'تهيئة مصدر CVE الافتراضي'}
            </button>
            <button
              onClick={loadCveData}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              تحديث البيانات
            </button>
          </div>

          {/* CVE Search */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(6,13,31,0.9)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">بحث في قاعدة CVE</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={cveSearchQuery}
                onChange={(e) => setCveSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCveSearch()}
                placeholder="CVE-2024-1234 أو كلمة بحث..."
                className="flex-1 px-3 py-2 rounded-lg text-xs bg-black/50 border border-slate-700 text-slate-300 focus:border-amber-500 focus:outline-none font-mono"
                dir="ltr"
              />
              <button
                onClick={handleCveSearch}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition-all"
              >
                بحث
              </button>
            </div>
            {cveSearchResults && (
              <pre className="bg-black/50 text-amber-400 font-mono text-[11px] p-3 rounded-lg border border-slate-700 max-h-48 overflow-auto whitespace-pre-wrap" dir="ltr">
                {cveSearchResults}
              </pre>
            )}
          </div>

          {/* Policies list */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              السياسات الأمنية ({cvePolicies.length})
            </h3>
            {cvePolicies.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                <Bug className="w-8 h-8 mx-auto mb-2 opacity-30" />
                لا توجد سياسات. اضغط "تهيئة مصدر CVE الافتراضي" للبدء.
              </div>
            ) : (
              cvePolicies.map((policy) => (
                <div
                  key={policy.id}
                  className="p-3 rounded-xl flex items-center justify-between gap-3"
                  style={{ background: 'rgba(10,20,45,0.7)', border: '1px solid rgba(96,165,250,0.12)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{policy.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono uppercase ${
                        policy.isActive
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-700 text-slate-400 border border-slate-600'
                      }`}>
                        {policy.isActive ? 'نشط' : 'معطل'}
                      </span>
                      {policy.syncStatus && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${
                          policy.syncStatus === 'synced'
                            ? 'bg-blue-500/20 text-blue-400'
                            : policy.syncStatus === 'error'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {policy.syncStatus === 'synced' ? '✓ synced' : policy.syncStatus}
                        </span>
                      )}
                    </div>
                    {policy.sourceUrl && (
                      <p className="text-[10px] text-slate-500 font-mono mt-1 truncate" dir="ltr">{policy.sourceUrl}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleCveSync(policy.id, policy.uid)}
                    disabled={cveSyncing}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw className={`w-3 h-3 ${cveSyncing ? 'animate-spin' : ''}`} />
                    مزامنة
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Direct policy_rule_references viewer */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Table className="w-3.5 h-3.5" />
              سجلات policy_rule_references
            </h3>
            <button
              onClick={() => { setActiveSection('databases'); setActiveDb('main'); setTimeout(() => loadTableData('policy_rule_references'), 100); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-blue-500/30 hover:text-blue-400 transition-all"
            >
              <Database className="w-3.5 h-3.5" />
              عرض الجدول الكامل في متصفح قواعد البيانات
            </button>
          </div>
        </div>
      )}

      {/* ═══ DATABASES SECTION ═══ */}
      {activeSection === 'databases' && (<>
      {/* Database switcher */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(96,165,250,0.12)' }}>
        <button
          onClick={() => { setActiveDb('main'); setSelectedTable(null); setRows([]); }}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeDb === 'main'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Database className="w-3.5 h-3.5 inline-block mr-1.5" />
          قاعدة البيانات الرئيسية
        </button>
        <button
          onClick={() => { setActiveDb('auth'); setSelectedTable(null); setRows([]); }}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeDb === 'auth'
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Shield className="w-3.5 h-3.5 inline-block mr-1.5" />
          قاعدة بيانات المصادقة
        </button>
      </div>

      {/* SQL Console */}
      <AnimatePresence>
        {showSqlConsole && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl overflow-hidden"
            style={{ background: 'rgba(6,13,31,0.9)', border: '1px solid rgba(139,92,246,0.3)' }}
          >
            <div className="p-3 border-b flex items-center gap-2" style={{ borderColor: 'rgba(139,92,246,0.2)', background: 'rgba(139,92,246,0.05)' }}>
              <Terminal className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">SQL Console — {activeDb === 'main' ? 'Main DB' : 'Auth DB'}</span>
            </div>
            <div className="p-3 space-y-2">
              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                className="w-full h-24 bg-black/50 text-green-400 font-mono text-xs p-3 rounded-lg border border-slate-700 focus:border-violet-500 focus:outline-none resize-y"
                placeholder="SELECT * FROM users LIMIT 10;"
                dir="ltr"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={executeSql}
                  disabled={loading || !sqlQuery.trim()}
                  className="px-4 py-1.5 bg-violet-500 text-white rounded-lg text-xs font-bold hover:bg-violet-600 disabled:opacity-50 transition-all"
                >
                  ▶ تنفيذ
                </button>
                <button
                  onClick={() => { setSqlQuery(''); setSqlResult(''); }}
                  className="px-4 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-600 transition-all"
                >
                  مسح
                </button>
              </div>
              {sqlResult && (
                <pre className="bg-black/50 text-emerald-400 font-mono text-[11px] p-3 rounded-lg border border-slate-700 max-h-64 overflow-auto whitespace-pre-wrap" dir="ltr">
                  {sqlResult}
                </pre>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Tables sidebar */}
        <div className="lg:col-span-1 space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2 px-1">
            الجداول ({tables.length})
          </div>
          {tables.map((table) => (
            <button
              key={table.name}
              onClick={() => {
                loadTableData(table.name);
                setExpandedTable(expandedTable === table.name ? null : table.name);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                selectedTable === table.name
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:bg-white/5 border border-transparent hover:border-slate-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <Table className="w-3.5 h-3.5" />
                <span className="font-mono text-[11px]">{table.name}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono">{table.rowCount}</span>
                {selectedTable === table.name ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </span>
            </button>
          ))}
        </div>

        {/* Table data */}
        <div className="lg:col-span-3">
          {selectedTable ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Table className="w-4 h-4 text-blue-400" />
                  <span className="font-mono">{selectedTable}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">{rows.length} صف</span>
                </h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="بحث..."
                      className="pr-8 pl-3 py-1.5 rounded-lg text-xs bg-slate-800/50 border border-slate-700 text-slate-300 focus:border-blue-500 focus:outline-none w-48"
                    />
                  </div>
                </div>
              </div>

              {/* Edit modal */}
              <AnimatePresence>
                {editingRow && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="p-4 rounded-xl space-y-3"
                    style={{ background: 'rgba(10,20,45,0.95)', border: '1px solid rgba(251,191,36,0.3)' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-2">
                        <Edit3 className="w-3.5 h-3.5" /> تعديل السجل
                      </span>
                      <button onClick={() => setEditingRow(null)} className="text-slate-400 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(editingRow.data).map(([key, val]) => (
                        <div key={key} className="space-y-0.5">
                          <label className="text-[10px] font-mono text-slate-500 uppercase">{key}</label>
                          <input
                            type="text"
                            value={String(val ?? '')}
                            onChange={(e) => setEditingRow({
                              ...editingRow,
                              data: { ...editingRow.data, [key]: e.target.value }
                            })}
                            className="w-full px-2 py-1.5 rounded text-xs bg-black/50 border border-slate-700 text-slate-300 font-mono focus:border-amber-500 focus:outline-none"
                            dir="ltr"
                            readOnly={key === columns[0]}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveEditedRow}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 disabled:opacity-50 transition-all"
                      >
                        <Save className="w-3.5 h-3.5" /> حفظ
                      </button>
                      <button
                        onClick={() => setEditingRow(null)}
                        className="px-4 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-600 transition-all"
                      >
                        إلغاء
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Data table */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(96,165,250,0.15)' }}>
                <div className="overflow-x-auto max-h-[60vh]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10" style={{ background: 'rgba(6,13,31,0.98)' }}>
                      <tr>
                        <th className="px-3 py-2 text-right text-[10px] font-mono uppercase tracking-widest text-slate-500 border-b" style={{ borderColor: 'rgba(96,165,250,0.15)' }}>
                          إجراءات
                        </th>
                        {columns.map((col) => (
                          <th
                            key={col}
                            className="px-3 py-2 text-right text-[10px] font-mono uppercase tracking-widest text-slate-500 border-b whitespace-nowrap"
                            style={{ borderColor: 'rgba(96,165,250,0.15)' }}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-3 py-2 border-b whitespace-nowrap" style={{ borderColor: 'rgba(96,165,250,0.08)' }}>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setEditingRow({
                                  table: selectedTable,
                                  id: String(row[columns[0]] ?? ''),
                                  data: { ...row }
                                })}
                                className="p-1 rounded hover:bg-amber-500/20 text-slate-500 hover:text-amber-400 transition-colors"
                                title="تعديل"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('هل أنت متأكد من حذف هذا السجل؟')) {
                                    deleteRow(selectedTable, row);
                                  }
                                }}
                                className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                                title="حذف"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          {columns.map((col) => (
                            <td
                              key={col}
                              className="px-3 py-2 border-b font-mono text-[11px] text-slate-300 max-w-[200px] truncate"
                              style={{ borderColor: 'rgba(96,165,250,0.08)' }}
                              title={String(row[col] ?? '')}
                            >
                              {String(row[col] ?? '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredRows.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-xs">لا توجد بيانات</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Database className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">اختر جدولاً من القائمة لعرض بياناته</p>
            </div>
          )}
        </div>
      </div>
      </>)}
    </motion.div>
  );
}
