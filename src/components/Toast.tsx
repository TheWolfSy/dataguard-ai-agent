import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ---------- Types ----------

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

// ---------- Hook ----------

export interface UseToastReturn {
  toasts: Toast[];
  toast: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: string) => void;
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timerRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timerRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev.slice(-4), { id, message, variant }]);

      const timer = setTimeout(() => {
        dismiss(id);
      }, variant === 'error' ? 5000 : 3500);

      timerRef.current.set(id, timer);
    },
    [dismiss],
  );

  return { toasts, toast, dismiss };
}

// ---------- Icons & colours ----------

const VARIANT_STYLES: Record<ToastVariant, { icon: React.ReactNode; bar: string; bg: string; border: string; text: string }> = {
  success: {
    icon: <CheckCircle className="w-4 h-4 shrink-0" />,
    bar: 'bg-emerald-500',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
  },
  error: {
    icon: <XCircle className="w-4 h-4 shrink-0" />,
    bar: 'bg-red-500',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
    bar: 'bg-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
  },
  info: {
    icon: <Info className="w-4 h-4 shrink-0" />,
    bar: 'bg-sky-500',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-800',
  },
};

// ---------- Single Toast item ----------

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const s = VARIANT_STYLES[t.variant];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`relative flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg max-w-sm w-full overflow-hidden ${s.bg} ${s.border}`}
    >
      {/* accent bar */}
      <span className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${s.bar}`} />
      <span className={`mt-0.5 ${s.text}`}>{s.icon}</span>
      <p className={`flex-1 text-sm leading-snug ${s.text}`}>{t.message}</p>
      <button
        onClick={() => onDismiss(t.id)}
        className={`mt-0.5 opacity-50 hover:opacity-100 transition-opacity ${s.text}`}
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

// ---------- Container ----------

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={onDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
