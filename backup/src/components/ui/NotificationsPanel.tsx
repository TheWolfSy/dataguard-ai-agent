import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle2, Trash2, X, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import type { AppNotification, NotificationLevel } from '../../services/notificationCenter';

function levelIcon(level: NotificationLevel) {
  switch (level) {
    case 'critical':
    case 'error':
      return <ShieldAlert className="w-4 h-4 text-rose-400" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-300" />;
    case 'info':
    default:
      return <Info className="w-4 h-4 text-sky-300" />;
  }
}

export function NotificationsPanel({
  open,
  dir,
  items,
  unreadCount,
  onClose,
  onMarkAllRead,
  onClearAll,
  onToggleRead,
}: {
  open: boolean;
  dir: string;
  items: AppNotification[];
  unreadCount: number;
  onClose: () => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onToggleRead: (id: string, nextRead: boolean) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="notif-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            key="notif-panel"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={[
              'fixed z-50 top-20 w-[min(420px,calc(100vw-2rem))] rounded-2xl overflow-hidden',
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
                <Bell className="w-4 h-4 text-slate-200" />
                <span className="text-xs font-black uppercase tracking-widest text-white">Alerts</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/90 text-white font-bold">
                    {unreadCount}
                  </span>
                )}
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 text-slate-300 hover:text-white" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 py-2 flex items-center justify-between gap-2 text-[11px]">
              <button
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark all read
              </button>
              <button
                onClick={onClearAll}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-rose-500/10 text-rose-300 border border-rose-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm font-bold text-white">No alerts</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Everything looks quiet right now.</p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {items.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => onToggleRead(n.id, !n.read)}
                      className={[
                        'w-full text-left rounded-xl p-3 border transition-all',
                        n.read ? 'opacity-70' : 'opacity-100',
                      ].join(' ')}
                      style={{
                        background: n.read ? 'rgba(10,20,45,0.45)' : 'rgba(10,20,45,0.7)',
                        borderColor: n.read ? 'rgba(148,163,184,0.12)' : 'rgba(96,165,250,0.18)',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{levelIcon(n.level)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-white truncate">{n.title}</p>
                            <span className="text-[10px] font-mono uppercase" style={{ color: 'var(--text-accent)' }}>
                              {new Date(n.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          {n.message && (
                            <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                              {n.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

