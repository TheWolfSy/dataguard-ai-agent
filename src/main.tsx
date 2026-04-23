import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { LanguageProvider } from './i18n/useLanguage.tsx';
import { UpdateNotification } from './components/UpdateNotification';
import './index.css';

// ── Auto-update check on startup ──────────────────────────────────────────────
if (typeof window !== 'undefined') {
  const checkVersionOnLoad = async () => {
    try {
      const { versionCheckService } = await import('./services/versionCheck');
      const result = await versionCheckService.checkForUpdate();
      if (result.hasUpdate) {
        console.log('[DataGuard] New version available:', result.latestVersion);
      }
    } catch (e) {
      console.warn('[DataGuard] Version check failed:', e);
    }
  };
  checkVersionOnLoad();
}

// ── Auth Integration Test (dev only) ──────────────────────────────────────
import { runAuthIntegrationTests } from './tests/authIntegrationTest';
import { runPhoneVerificationAttempts, confirmReceivedOtp } from './tests/phoneVerificationRunner';
if (import.meta.env.DEV) {
  (window as any).runAuthTest = runAuthIntegrationTests;
  (window as any).runPhoneVerify = runPhoneVerificationAttempts;
  (window as any).confirmPhoneOtp = confirmReceivedOtp;
  console.log('%c[DataGuard] Available dev commands:', 'color: #a78bfa; font-weight: bold;');
  console.log('%c  await window.runAuthTest()         — اختبار نظام المصادقة', 'color: #a78bfa;');
  console.log('%c  await window.runPhoneVerify()       — 5 محاولات تأكيد هاتف +905395493089', 'color: #f59e0b;');
  console.log("%c  await window.confirmPhoneOtp('code') — تأكيد OTP بعد استلامه", 'color: #22c55e;');
}

// Defensive shim for environments that provide a partial Performance API.
// Some third-party libs call these methods unconditionally.
if (typeof window !== 'undefined' && window.performance) {
  const perf = window.performance as Performance & {
    mark?: unknown;
    measure?: unknown;
    clearMarks?: unknown;
    clearMeasures?: unknown;
  };

  if (typeof perf.mark !== 'function') {
    perf.mark = (() => undefined) as Performance['mark'];
  }
  if (typeof perf.measure !== 'function') {
    perf.measure = (() => undefined) as Performance['measure'];
  }
  if (typeof perf.clearMarks !== 'function') {
    perf.clearMarks = (() => undefined) as Performance['clearMarks'];
  }
  if (typeof perf.clearMeasures !== 'function') {
    perf.clearMeasures = (() => undefined) as Performance['clearMeasures'];
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <ErrorBoundary>
        <UpdateNotification checkOnMount />
        <App />
      </ErrorBoundary>
    </LanguageProvider>
  </StrictMode>,
);
