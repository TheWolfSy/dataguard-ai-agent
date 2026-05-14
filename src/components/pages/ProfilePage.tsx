import React from 'react';
import { motion } from 'motion/react';
import { Globe, ImagePlus, KeyRound, User, MailCheck, ShieldAlert, Phone } from 'lucide-react';
import { Card } from '../ui/Card';
import type { AuthUser } from '../../services/authService';
import type { Language } from '../../i18n/translations';

type TFunc = (key: string) => string;

interface LocalUser {
  uid: string;
  email: string;
  displayName?: string;
}

interface ProfilePageProps {
  t: TFunc;
  dir: string;
  language: Language;
  setLanguage: (lang: Language) => void;
  user: LocalUser;
  localProfile: AuthUser | null;
  currentPasswordInput: string;
  setCurrentPasswordInput: (v: string) => void;
  newPasswordInput: string;
  setNewPasswordInput: (v: string) => void;
  confirmPasswordInput: string;
  setConfirmPasswordInput: (v: string) => void;
  isUpdatingPassword: boolean;
  isUpdatingAvatar: boolean;
  profileEditFullName: string;
  setProfileEditFullName: (v: string) => void;
  profileEditBackupEmail: string;
  setProfileEditBackupEmail: (v: string) => void;
  profileEditPhone: string;
  setProfileEditPhone: (v: string) => void;
  profileEditBirthDate: string;
  setProfileEditBirthDate: (v: string) => void;
  profileEditCurrentPassword: string;
  setProfileEditCurrentPassword: (v: string) => void;
  isUpdatingProfileInfo: boolean;
  handleAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleRemoveAvatar: () => Promise<void>;
  handleUpdateProfileInfo: (e: React.FormEvent) => Promise<void>;
  handleChangeCurrentPassword: (e: React.FormEvent) => Promise<void>;
  loginError: string;
  authSuccess: string;
  emailVerifyCode: string;
  setEmailVerifyCode: (v: string) => void;
  showEmailVerifyInput: boolean;
  emailVerifyLoading: boolean;
  handleSendEmailVerification: () => Promise<void>;
  handleConfirmEmailVerification: () => Promise<void>;
  phoneVerifyOtp: string;
  setPhoneVerifyOtp: (v: string) => void;
  showPhoneVerifyInput: boolean;
  phoneVerifyLoading: boolean;
  handleSendPhoneVerification: () => Promise<void>;
  handleConfirmPhoneVerification: () => Promise<void>;
}

export function ProfilePage({
  t, dir, language, setLanguage,
  user, localProfile,
  currentPasswordInput, setCurrentPasswordInput,
  newPasswordInput, setNewPasswordInput,
  confirmPasswordInput, setConfirmPasswordInput,
  isUpdatingPassword, isUpdatingAvatar,
  profileEditFullName, setProfileEditFullName,
  profileEditBackupEmail, setProfileEditBackupEmail,
  profileEditPhone, setProfileEditPhone,
  profileEditBirthDate, setProfileEditBirthDate,
  profileEditCurrentPassword, setProfileEditCurrentPassword,
  isUpdatingProfileInfo,
  handleAvatarChange, handleRemoveAvatar,
  handleUpdateProfileInfo, handleChangeCurrentPassword,
  loginError, authSuccess,
  emailVerifyCode, setEmailVerifyCode,
  showEmailVerifyInput, emailVerifyLoading,
  handleSendEmailVerification, handleConfirmEmailVerification,
  // تمت إزالة جميع متغيرات التحقق من الهاتف
}: ProfilePageProps) {
  return (
    <motion.div
      key="profile"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="max-w-3xl space-y-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{t('profile.title')}</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('profile.subtitle')}</p>
        </div>
        <motion.button
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-bold text-slate-300 hover:text-white transition-colors"
          style={{ background: 'rgba(6,13,31,0.6)', borderColor: 'rgba(96,165,250,0.25)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
        >
          <Globe className="w-4 h-4" />
          <span>{t('profile.language')}:</span>
            <span className="px-2 py-0.5 rounded-full text-white text-[10px] uppercase tracking-wider" style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>
            {language === 'en' ? 'EN' : 'AR'}
          </span>
          <span className="text-zinc-400">→</span>
          <span className="text-zinc-500">{language === 'en' ? 'AR' : 'EN'}</span>
        </motion.button>
      </div>

      {/* Avatar */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center" style={{ border: '2px solid rgba(96,165,250,0.35)', background: 'rgba(10,20,45,0.7)', boxShadow: '0 0 16px rgba(96,165,250,0.1)' }}>
            {localProfile?.avatarDataUrl ? (
              <img src={localProfile.avatarDataUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-zinc-400" />
            )}
          </div>
          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold cursor-pointer text-slate-300 hover:text-white transition-colors" style={{ borderColor: 'rgba(96,165,250,0.25)', background: 'rgba(10,20,45,0.7)' }}>
              <ImagePlus className="w-4 h-4" />
              {isUpdatingAvatar ? t('profile.updating') : t('profile.changeAvatar')}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={isUpdatingAvatar || !localProfile?.avatarDataUrl}
              className="inline-flex items-center gap-2 px-3 py-2 rounded border border-rose-400/40 text-xs font-bold text-rose-400 hover:bg-rose-400/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('profile.removeAvatar')}
            </button>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('profile.avatarNote')}</p>
          </div>
        </div>
      </Card>

      {/* Email Verification Banner */}
      {localProfile && !localProfile.emailVerified && (
        <Card className="p-4 border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">{t('profile.emailNotVerified')}</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{t('profile.verifyEmailBanner')}</p>
              </div>
              {!showEmailVerifyInput ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={handleSendEmailVerification}
                  disabled={emailVerifyLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  <MailCheck className="w-4 h-4" />
                  {emailVerifyLoading ? t('profile.sendingVerifyCode') : t('profile.sendVerifyCode')}
                </motion.button>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="w-full px-3 py-2 border border-amber-300 dark:border-amber-600 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                    placeholder={t('profile.verifyCodePlaceholder')}
                    value={emailVerifyCode}
                    onChange={(e) => setEmailVerifyCode(e.target.value.replace(/\D/g, ''))}
                  />
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={handleConfirmEmailVerification}
                      disabled={emailVerifyLoading}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                    >
                      <MailCheck className="w-4 h-4" />
                      {emailVerifyLoading ? t('profile.confirmingVerifyCode') : t('profile.confirmVerifyCode')}
                    </motion.button>
                    <button
                      type="button"
                      onClick={handleSendEmailVerification}
                      disabled={emailVerifyLoading}
                      className="px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-50"
                    >
                      {t('profile.resendVerifyCode')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Email Verified Badge */}
      {localProfile?.emailVerified && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
          <MailCheck className="w-4 h-4" />
          {t('profile.emailVerified')}
        </div>
      )}

      {/* تمت إزالة واجهة التحقق من الهاتف حفاظاً على الخصوصية */}

      {/* Info */}
      <Card className="p-6">
        <h3 className="text-sm font-bold uppercase tracking-tight mb-4">{t('profile.localInfo')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {[
            { label: t('profile.fullName'), value: localProfile?.fullName },
            { label: t('profile.email'), value: localProfile?.email ?? user?.email },
            { label: t('profile.backupEmail'), value: localProfile?.backupEmail },
            {
              label: t('profile.birthDate'),
              value: localProfile?.birthDate ? new Date(localProfile.birthDate).toLocaleDateString() : undefined,
            },
            {
              label: t('profile.verification'),
              value: localProfile?.emailVerified ? t('profile.emailVerified') : t('profile.emailNotVerified'),
            },
          ].map(({ label, value }) => (
        <div key={label} className="p-3 rounded" style={{ background: 'rgba(6,13,31,0.7)', border: '1px solid rgba(96,165,250,0.12)' }}>
              <p style={{ color: 'var(--text-muted)' }} className="mb-1">{label}</p>
              <p className="font-bold text-slate-200">{value ?? '-'}</p>
            </div>
          ))}
        </div>

        <form onSubmit={handleUpdateProfileInfo} className="mt-4 space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300">{t('profile.editInfo')}</h4>
          <input type="text" className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ background: 'rgba(6,13,31,0.8)', border: '1px solid rgba(96,165,250,0.2)' }} placeholder={t('profile.fullNamePlaceholder')} value={profileEditFullName} onChange={(e) => setProfileEditFullName(e.target.value)} />
          <input type="email" className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ background: 'rgba(6,13,31,0.8)', border: '1px solid rgba(96,165,250,0.2)' }} placeholder={t('profile.backupEmailPlaceholder')} value={profileEditBackupEmail} onChange={(e) => setProfileEditBackupEmail(e.target.value)} />
          <input type="date" className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ background: 'rgba(6,13,31,0.8)', border: '1px solid rgba(96,165,250,0.2)' }} value={profileEditBirthDate} onChange={(e) => setProfileEditBirthDate(e.target.value)} />
          <input type="password" className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ background: 'rgba(6,13,31,0.8)', border: '1px solid rgba(96,165,250,0.2)' }} placeholder={t('profile.currentPasswordConfirm')} value={profileEditCurrentPassword} onChange={(e) => setProfileEditCurrentPassword(e.target.value)} />
          <button type="submit" disabled={isUpdatingProfileInfo} className="w-full py-2 rounded text-white text-xs font-bold disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>
            {isUpdatingProfileInfo ? t('profile.updatingInfo') : t('profile.updateProfileBtn')}
          </button>
          {/* Inline feedback for profile edit */}
          {loginError && <p className="text-xs text-rose-500 font-mono mt-1">{loginError}</p>}
          {authSuccess && <p className="text-xs text-emerald-500 font-mono mt-1">{authSuccess}</p>}
        </form>
      </Card>

      {/* Change Password */}
      <Card className="p-6">
          <h3 className="text-sm font-bold uppercase tracking-tight mb-4 text-slate-200">{t('profile.changePassword')}</h3>
        <form onSubmit={handleChangeCurrentPassword} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-accent)' }}>{t('profile.currentPassword')}</label>
          <input type="password" value={currentPasswordInput} onChange={(e) => setCurrentPasswordInput(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ background: 'rgba(6,13,31,0.8)', border: '1px solid rgba(96,165,250,0.2)' }} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-accent)' }}>{t('profile.newPassword')}</label>
            <input type="password" value={newPasswordInput} onChange={(e) => setNewPasswordInput(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ background: 'rgba(6,13,31,0.8)', border: '1px solid rgba(96,165,250,0.2)' }} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-accent)' }}>{t('profile.confirmNewPassword')}</label>
            <input type="password" value={confirmPasswordInput} onChange={(e) => setConfirmPasswordInput(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ background: 'rgba(6,13,31,0.8)', border: '1px solid rgba(96,165,250,0.2)' }} />
          </div>
          <motion.button
            type="submit"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            disabled={isUpdatingPassword}
            className="w-full py-2 rounded text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}
          >
            <KeyRound className="w-4 h-4" />
            {isUpdatingPassword ? t('profile.changingPassword') : t('profile.changePasswordBtn')}
          </motion.button>
        </form>
      </Card>

      {/* Feedback messages */}
      {loginError && <p className="text-xs text-rose-600 font-mono">{loginError}</p>}
      {authSuccess && <p className="text-xs text-emerald-600 font-mono">{authSuccess}</p>}
    </motion.div>
  );
}
