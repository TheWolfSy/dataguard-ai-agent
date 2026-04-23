import React, { useEffect, useMemo, useState } from 'react';
import { createManagedMasterAccount, listManagedMasterAccounts, setManagedMasterAccountEnabled } from '../../services/masterAuthService';

export function MasterAccountsManager() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const [accounts, setAccounts] = useState<Array<{ id: string; enabled: boolean; createdAt: string }>>([]);
  const [listLoading, setListLoading] = useState(false);

  const canCreate = useMemo(() => {
    return username.trim() && password && confirmPassword && securityAnswer.trim() && password === confirmPassword;
  }, [username, password, confirmPassword, securityAnswer]);

  const refresh = async () => {
    setListLoading(true);
    try {
      const rows = await listManagedMasterAccounts();
      setAccounts(rows);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  const handleCreate = async () => {
    setMsg('');
    if (password !== confirmPassword) {
      setMsg('كلمة المرور وتأكيدها غير متطابقين.');
      return;
    }
    setLoading(true);
    try {
      await createManagedMasterAccount({
        username,
        password,
        securityAnswer,
      });
      setMsg('تم إنشاء حساب ماستر جديد بنجاح.');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setSecurityAnswer('');
      await refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'فشل إنشاء الحساب.');
    } finally {
      setLoading(false);
    }
  };

  const toggleEnabled = async (id: string, nextEnabled: boolean) => {
    setMsg('');
    try {
      await setManagedMasterAccountEnabled(id, nextEnabled);
      await refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'فشل تحديث حالة الحساب.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: 'rgba(6,13,31,0.9)', border: '1px solid rgba(239,68,68,0.18)' }}>
        <h3 className="text-sm font-bold text-white mb-1">إدارة حسابات الماستر</h3>
        <p className="text-[11px] text-slate-400">
          أنشئ حسابات ماستر إضافية للدخول عبر نافذة <span className="font-mono">Master Login</span> نفسها.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
          <input
            className="auth-input"
            placeholder="Master Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            dir="ltr"
          />
          <input
            className="auth-input"
            placeholder="Master Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
          />
          <input
            className="auth-input"
            placeholder="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            dir="ltr"
          />
          <input
            className="auth-input"
            placeholder="Security answer"
            value={securityAnswer}
            onChange={(e) => setSecurityAnswer(e.target.value)}
            dir="ltr"
          />
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            disabled={loading || !canCreate}
            onClick={handleCreate}
            className="auth-btn-primary"
            style={{ opacity: loading || !canCreate ? 0.7 : 1 }}
          >
            {loading ? 'جاري الإنشاء...' : 'إنشاء ماستر جديد'}
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={listLoading}
            className="auth-btn-secondary"
            style={{ fontSize: '12px', opacity: listLoading ? 0.7 : 1 }}
          >
            {listLoading ? '...' : 'تحديث القائمة'}
          </button>
        </div>

        {msg && <div className={`mt-2 text-xs font-mono ${msg.includes('بنجاح') ? 'text-emerald-400' : 'text-rose-400'}`}>{msg}</div>}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(96,165,250,0.15)' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(10,20,45,0.7)' }}>
          <div className="text-xs font-bold text-slate-200">الحسابات المُدارة</div>
          <div className="text-[10px] font-mono text-slate-500">{accounts.length} حساب</div>
        </div>
        <div className="p-4 space-y-2" style={{ background: 'rgba(6,13,31,0.7)' }}>
          {accounts.length === 0 ? (
            <div className="text-xs text-slate-500">لا يوجد حسابات ماستر مُدارة حتى الآن.</div>
          ) : (
            accounts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 p-3 rounded-lg"
                style={{ background: 'rgba(10,20,45,0.6)', border: '1px solid rgba(96,165,250,0.12)' }}
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-mono text-slate-200 truncate" title={a.id}>ID: {a.id}</div>
                  <div className="text-[10px] text-slate-500">Created: {new Date(a.createdAt).toLocaleString()}</div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleEnabled(a.id, !a.enabled)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    a.enabled
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/25'
                      : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-emerald-500/30 hover:text-emerald-300'
                  }`}
                >
                  {a.enabled ? 'مفعّل' : 'معطّل'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

