import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, X, UserPlus, LogIn, KeyRound, Wrench, ShieldAlert, Headset, Zap, FlaskConical, MailSearch, Vault, GraduationCap, Bot } from 'lucide-react';

type TFunc = (key: string) => string;

function Step({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-xl p-3 border"
      style={{ background: 'rgba(10,20,45,0.65)', borderColor: 'rgba(96,165,250,0.16)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center border"
          style={{ background: 'rgba(6,13,31,0.65)', borderColor: 'rgba(96,165,250,0.18)', color: '#93c5fd' }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-white">{title}</p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: '#94a3b8' }}>
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}

export function GuidesPanel({
  open,
  dir,
  t,
  onClose,
}: {
  open: boolean;
  dir: string;
  t: TFunc;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="guides-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            key="guides-panel"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={[
              'fixed z-50 top-20 w-[min(520px,calc(100vw-2rem))] rounded-2xl overflow-hidden',
              dir === 'rtl' ? 'left-4 md:left-6' : 'right-4 md:right-6',
            ].join(' ')}
            style={{
              background: 'rgba(6,13,31,0.96)',
              border: '1px solid rgba(96,165,250,0.22)',
              backdropFilter: 'blur(28px)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
            }}
          >
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(96,165,250,0.16)' }}>
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-200" />
                <span className="text-xs font-black uppercase tracking-widest text-white">{t('guides.title')}</span>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 text-slate-300 hover:text-white" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <p className="text-xs" style={{ color: '#94a3b8' }}>
                {t('guides.subtitle')}
              </p>

              <div className="grid grid-cols-1 gap-2">
                <Step icon={<UserPlus className="w-4 h-4" />} title={t('guides.registerTitle')} body={t('guides.registerBody')} />
                <Step icon={<LogIn className="w-4 h-4" />} title={t('guides.loginTitle')} body={t('guides.loginBody')} />
                <Step icon={<KeyRound className="w-4 h-4" />} title={t('guides.changePwdTitle')} body={t('guides.changePwdBody')} />
                <Step icon={<ShieldAlert className="w-4 h-4" />} title={t('guides.toolsTitle')} body={t('guides.toolsBody')} />
                <Step icon={<Wrench className="w-4 h-4" />} title={t('guides.advancedTitle')} body={t('guides.advancedBody')} />
                <Step icon={<Zap className="w-4 h-4" />} title={t('guides.aiProvidersTitle')} body={t('guides.aiProvidersBody')} />
                <Step icon={<Bot className="w-4 h-4" />} title={t('guides.ollamaTitle')} body={t('guides.ollamaBody')} />
                <Step icon={<FlaskConical className="w-4 h-4" />} title={t('guides.testsTitle')} body={t('guides.testsBody')} />
                <Step icon={<MailSearch className="w-4 h-4" />} title={t('guides.emailMonitorTitle')} body={t('guides.emailMonitorBody')} />
                <Step icon={<Vault className="w-4 h-4" />} title={t('guides.passwordManagerTitle')} body={t('guides.passwordManagerBody')} />
                <Step icon={<GraduationCap className="w-4 h-4" />} title={t('guides.learningTitle')} body={t('guides.learningBody')} />
              </div>

              <div
                className="rounded-xl p-3 border"
                style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.22)' }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center border" style={{ borderColor: 'rgba(239,68,68,0.25)', color: '#fda4af', background: 'rgba(6,13,31,0.55)' }}>
                    <Headset className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black uppercase tracking-widest text-white">{t('guides.supportTitle')}</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: '#fca5a5' }}>
                      {t('guides.supportBody')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

