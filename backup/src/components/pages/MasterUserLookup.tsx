import React, { useMemo, useState } from 'react';
import { getAuthDb } from '../../authDatabase';
import { resetUserPasswordByMaster } from '../../services/authService';

const USERS_STORAGE_KEY = 'dataguard_users_id_json';

type StoredUsers = { users: Array<{ id: string; email?: string; fullName?: string; birthDate?: string; createdAt?: string; subscription?: string }> };

function readUsers(): StoredUsers {
  const raw = localStorage.getItem(USERS_STORAGE_KEY);
  if (!raw) return { users: [] };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.users)) return parsed;
  } catch {
    // ignore
  }
  return { users: [] };
}

function writeUsers(data: StoredUsers) {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(data));
}

export default function MasterUserLookup() {
  const [userId, setUserId] = useState('');
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const canResetPassword = useMemo(() => !!user?.id, [user]);

  const handleSearch = async () => {
    setError('');
    setUser(null);
    setPwdMsg('');
    try {
      const id = userId.trim();
      if (!id) {
        setError('أدخل معرف المستخدم');
        return;
      }

      // Primary source: auth database (authoritative)
      try {
        setIsSearching(true);
        const db = await getAuthDb();
        const res = await db.query<any>(
          `SELECT id, full_name, email, backup_email, birth_date, created_at FROM auth_users WHERE id = $1 LIMIT 1`,
          [id]
        );
        const row = res.rows?.[0];
        if (row) {
          setUser({
            id: row.id,
            fullName: row.full_name,
            email: row.email,
            birthDate: row.birth_date,
            createdAt: row.created_at,
          });
          setIsSearching(false);
          return;
        }
      } catch {
        // ignore and fallback to localStorage mapping
      } finally {
        setIsSearching(false);
      }

      const usersJson = readUsers();
      const found = usersJson.users.find((u: any) => u.id === id);
      if (found) setUser(found);
      else setError('لم يتم العثور على مستخدم بهذا المعرف');
    } catch (err) {
      setError('حدث خطأ أثناء البحث');
    }
  };

  const handleResetPassword = async () => {
    setPwdMsg('');
    setError('');
    try {
      if (!canResetPassword) {
        setPwdMsg('ابحث عن المستخدم أولاً.');
        return;
      }
      if (!newPassword || !confirmNewPassword) {
        setPwdMsg('يرجى إدخال كلمة المرور الجديدة وتأكيدها.');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setPwdMsg('كلمة المرور الجديدة وتأكيدها غير متطابقين.');
        return;
      }

      setPwdLoading(true);
      await resetUserPasswordByMaster(user.id, newPassword);
      setPwdMsg('تم تحديث كلمة المرور بنجاح.');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setPwdMsg(err instanceof Error ? err.message : 'فشل تحديث كلمة المرور.');
    } finally {
      setPwdLoading(false);
    }
  };


  // إدارة الاشتراك
  const [subscription, setSubscription] = useState('none');
  const [subMsg, setSubMsg] = useState('');
  const handleSubscription = () => {
    setSubMsg('');
    try {
      const usersJson = readUsers();
      const idx = usersJson.users.findIndex((u: any) => u.id === userId);
      if (idx === -1) return setSubMsg('لم يتم العثور على المستخدم');
      usersJson.users[idx].subscription = subscription;
      writeUsers(usersJson);
      setSubMsg('تم تحديث حالة الاشتراك بنجاح');
    } catch (err) {
      setSubMsg('حدث خطأ أثناء تحديث الاشتراك');
    }
  };

  const handleReset = () => {
    setSubMsg('');
    setSubscription('none');
    setUser(null);
    setUserId('');
    setError('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPwdMsg('');
  };

  return (
    <div style={{maxWidth: 400, margin: '40px auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px #0001'}}>
      <h2>بحث عن مستخدم بالمعرف (ID)</h2>
      <input
        type="text"
        value={userId}
        onChange={e => setUserId(e.target.value)}
        placeholder="أدخل معرف المستخدم"
        style={{width: '100%', padding: 8, margin: '12px 0', borderRadius: 6, border: '1px solid #ccc'}}
      />
      <button
        onClick={handleSearch}
        disabled={isSearching}
        style={{padding: '8px 24px', borderRadius: 6, background: '#065f46', color: '#fff', border: 'none', opacity: isSearching ? 0.7 : 1}}
      >
        {isSearching ? 'جاري البحث...' : 'بحث'}
      </button>
      {error && <div style={{color: 'red', marginTop: 12}}>{error}</div>}
      {user && (
        <div style={{marginTop: 24, background: '#f6f6f6', padding: 16, borderRadius: 8}}>
          <div><b>الاسم:</b> {user.fullName}</div>
          <div><b>البريد:</b> {user.email}</div>
          {/* تمت إزالة عرض رقم الهاتف حفاظاً على الخصوصية */}
          <div><b>تاريخ الميلاد:</b> {user.birthDate}</div>
          <div><b>تاريخ الإنشاء:</b> {user.createdAt}</div>

          <div style={{marginTop: 18, padding: 12, background: '#eef2ff', borderRadius: 8, border: '1px solid #c7d2fe'}}>
            <b>إعادة تعيين كلمة المرور:</b>
            <div style={{display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginTop: 10}}>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="كلمة المرور الجديدة"
                style={{width: '100%', padding: 8, borderRadius: 6, border: '1px solid #c7d2fe'}}
              />
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="تأكيد كلمة المرور الجديدة"
                style={{width: '100%', padding: 8, borderRadius: 6, border: '1px solid #c7d2fe'}}
              />
              <button
                onClick={handleResetPassword}
                disabled={pwdLoading}
                style={{padding: '8px 16px', borderRadius: 6, background: '#1d4ed8', color: '#fff', border: 'none', opacity: pwdLoading ? 0.7 : 1}}
              >
                {pwdLoading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
              </button>
              {pwdMsg && (
                <div style={{color: pwdMsg.includes('بنجاح') ? 'green' : 'red'}}>{pwdMsg}</div>
              )}
            </div>
          </div>

          <div style={{marginTop: 18, padding: 12, background: '#fffbe6', borderRadius: 8, border: '1px solid #ffe58f'}}>
            <b>إدارة الاشتراك:</b>
            <select value={subscription} onChange={e => setSubscription(e.target.value)} style={{margin: '0 8px', padding: 4}}>
              <option value="none">بدون اشتراك</option>
              <option value="active">مفعل</option>
              <option value="expired">منتهي</option>
            </select>
            <button onClick={handleSubscription} style={{padding: '4px 16px', borderRadius: 6, background: '#065f46', color: '#fff', border: 'none'}}>تحديث الاشتراك</button>
            {subMsg && <div style={{color: subMsg.includes('نجاح') ? 'green' : 'red', marginTop: 8}}>{subMsg}</div>}
          </div>
          <button onClick={handleReset} style={{marginTop: 16, padding: '6px 18px', borderRadius: 6, background: '#f59e42', color: '#fff', border: 'none'}}>إرجاع الإعدادات الافتراضية</button>
        </div>
      )}
    </div>
  );
}
