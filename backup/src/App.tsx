
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Clock, ChevronRight, Info, Shield, KeyRound, Menu, Globe, LogOut, Activity, Database, ShieldAlert, User, History, Settings, Zap, ShieldCheck, ShieldQuestion, Plus, MessageSquare, Eye, EyeOff, Lock, X, CheckCircle, GraduationCap, Bell, Wrench, Download } from 'lucide-react';
import { cn } from './lib/utils';
import { SidebarItem } from './components/ui/SidebarItem';
import { Badge } from './components/ui/Badge';
import { DashboardPage } from './components/pages/DashboardPage';
import { LogsPage } from './components/pages/LogsPage';
import { PoliciesPage } from './components/pages/PoliciesPage';
import { ProfilePage } from './components/pages/ProfilePage';
import { SettingsPage } from './components/pages/SettingsPage';
import { TestsPage } from './components/pages/TestsPage';
import { AuditPage } from './components/pages/AuditPage';
import { AIProvidersPage } from './components/pages/AIProvidersPage';
import { MasterPanel } from './components/pages/MasterPanel';
import { AdvancedToolsPage } from './components/pages/AdvancedToolsPage';
import { DownloadPage } from './components/pages/DownloadPage';
import { useToast } from './components/Toast';
import { ToastContainer } from './components/Toast';
import { useTheme } from './hooks/useTheme';
import { useAutoRedaction } from './hooks/useAutoRedaction';
import { useLanguage } from './i18n/useLanguage';
import { NotificationsPanel } from './components/ui/NotificationsPanel';
import { GuidesPanel } from './components/ui/GuidesPanel';
import {
  getThreatCountSince,
  getDataLogs,
  getSecurityPolicies,
  getAuditLogs,
  getUserProfile,
  upsertUserProfile,
  initializeDefaultCVESource,
  getFileSystemReferences,
  insertAuditLog
} from './services/sqlService';
import { requestFileSystemAccess, scanDirectoryForThreats } from './services/fileAccessService';
import { initProviderCache, getCachedActiveProvider } from './services/aiProviderService';
import { setAgentLlmProvider, AGENT_LLM_PROVIDERS, AgentLlmProviderId, setActiveUser as setAgentActiveUser, generateLiveAgentChatReply } from './services/agentOrchestrator';
import { getLocalUserProfile } from './services/authService';
import { isDevBypassEmail } from './services/devBypass';
import { clearAllAlerts, dismissAlert, disconnectGmail, getEmailMonitorState, setEmailMonitorEnabled, addCashRule, removeCashRule, toggleCashRule, CashRule, startMonitorLoop, stopMonitorLoop } from './services/emailMonitorService';
import { clearNotifications, getNotificationsSnapshot, markAllNotificationsRead, markNotificationRead, pushNotification, subscribeNotifications } from './services/notificationCenter';
import {
  loginUser,
  registerUser as registerUserFn,
  startRegistrationVerification,
  sendEmailRecoveryCode,
  verifyEmailRecoveryCode,
  getRecoveryQuestions,
  verifySecurityAnswersForRecovery,
  resetPasswordAfterVerification,
  changePasswordWithCurrent,
  updateLocalUserProfileWithCurrentPassword,
  updateLocalUserAvatar,
  clearLocalUserAvatar,
  touchUserActivity,
  sendEmailVerificationCode,
  confirmEmailVerification,
} from './services/authService';
import { validateMasterLogin, validateMasterSecurityAnswer, isMasterSessionActive, activateMasterSession, clearMasterSession, type MasterAuthCandidate } from './services/masterAuthService';
import {
  getPasswordManagerState,
  addPasswordEntry as addPmEntry,
  removePasswordEntry as removePmEntry,
  runWeakPasswordScan,
  dismissWeakAlert as dismissPmAlert,
  decryptEntryPassword,
} from './services/passwordManagerService';
import { createRemoteSecurityPolicy, syncRemoteSecurityPolicy } from './services/sqlService';
import { getTestExecutor } from './services/testMetrics';
import { TEST_SCENARIOS } from './tests/scenarioTests';
import { scanData } from './services/securityScanner';
import type { UserProfile } from './services/sqlService';
// import { LEARN_TOPICS, LEVEL_COLORS, TOPIC_HEADER_COLORS } from './lib/utils';
// import { initProviderCache } from './lib/agent-llm-provider';

type LocalUser = {
  uid: string;
  email: string;
  displayName?: string;
};

/* ── Animated particle / network canvas for the auth background ── */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Particles
    const COUNT = 55;
    type Particle = { x: number; y: number; vx: number; vy: number; r: number; alpha: number };
    const particles: Particle[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 1,
      alpha: Math.random() * 0.5 + 0.15,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(96,165,250,${0.08 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      // Draw & move particles
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(96,165,250,${p.alpha})`;
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}

export default function App(): React.ReactElement {
  const { toasts, toast, dismiss } = useToast();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState<any[]>([]);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [guidesOpen, setGuidesOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMaster, setIsMaster] = useState(false);
  const [showMasterLogin, setShowMasterLogin] = useState(false);
  const [masterUsername, setMasterUsername] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [masterSecurityAnswer, setMasterSecurityAnswer] = useState('');
  const [masterLoginStep, setMasterLoginStep] = useState<'credentials' | 'security'>('credentials');
  const [masterCandidate, setMasterCandidate] = useState<MasterAuthCandidate | null>(null);
  const [masterError, setMasterError] = useState('');
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterLogoClicks, setMasterLogoClicks] = useState(0);
  const masterClickTimer = useRef<NodeJS.Timeout | null>(null);

  const threatScanCursorRef = useRef<Date | null>(null);
  const threatScanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [threatBadgeCount, setThreatBadgeCount] = useState(0);

  const [agentLlmProviderState, setAgentLlmProviderState] = useState('');
  const [agentLlmProviderNotice, setAgentLlmProviderNotice] = useState('');
  const [chatProviderLabel, setChatProviderLabel] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  const [logs, setLogs] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [scanContent, setScanContent] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [agentRun, setAgentRun] = useState<any>(null);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const [agentMode, setAgentMode] = useState('analyst');
  const [agentProfile, setAgentProfile] = useState<any>('security-auditor');
  const [showDecrypted, setShowDecrypted] = useState<Record<string, boolean>>({});

  const [policyName, setPolicyName] = useState('');
  const [policySourceUrl, setPolicySourceUrl] = useState('');
  const [policySyncIntervalHours, setPolicySyncIntervalHours] = useState(24);
  const [isCreatingPolicy, setIsCreatingPolicy] = useState(false);
  const [isAutoSyncingPolicies, setIsAutoSyncingPolicies] = useState(false);
  const [syncingPolicyId, setSyncingPolicyId] = useState<string | null>(null);
  const [isPolicyFormOpen, setIsPolicyFormOpen] = useState(false);

  const [isFileScanning, setIsFileScanning] = useState(false);
  const [selectedScanInterval, setSelectedScanInterval] = useState(24);
  const [fileReferences, setFileReferences] = useState<any[]>([]);
  const [scanResults, setScanResults] = useState<any[]>([]);
  const fileSystemHandleRef = useRef<{ handle: any }>({ handle: null });

  const [emailMonitorState, setEmailMonitorState] = useState<any>({ enabled: false });
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const emailMonitorCleanupRef = useRef<any>(null);

  const [isInitializingCVE, setIsInitializingCVE] = useState(false);

  const [passwordManagerState, setPasswordManagerState] = useState<any>({ meta: { weakCount: 0 } });
  const [isPasswordManagerScanning, setIsPasswordManagerScanning] = useState(false);
  const [isEmailSyncing, setIsEmailSyncing] = useState(false);
  const [emailSyncHints, setEmailSyncHints] = useState<any[]>([]);
  const pmScanLoopCleanupRef = useRef<any>(null);

  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testExecutionProgress, setTestExecutionProgress] = useState(0);
  const [selectedScenarioCategory, setSelectedScenarioCategory] = useState('all');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testResultsSecondsLeft, setTestResultsSecondsLeft] = useState<number | null>(null);
  const [testResultsExpiresAt, setTestResultsExpiresAt] = useState<number | null>(null);
  const testResultsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const testResultsCountdownRef = useRef<NodeJS.Timeout | null>(null);

  // --- Notifications (realtime) ---
  useEffect(() => {
    const snap = getNotificationsSnapshot();
    setNotificationItems(snap.items);
    setNotificationUnread(snap.unreadCount);

    const unsub = subscribeNotifications((ev) => {
      const next = getNotificationsSnapshot();
      setNotificationItems(next.items);
      setNotificationUnread(next.unreadCount);

      if (ev?.type === 'added' && ev.notification) {
        const lvl = ev.notification.level;
        toast(
          ev.notification.title + (ev.notification.message ? ` — ${ev.notification.message}` : ''),
          lvl === 'critical' || lvl === 'error' ? 'error' : lvl === 'warning' ? 'warning' : 'info'
        );
      }
    });
    return () => unsub();
  }, [toast]);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const { t, language, setLanguage, dir } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { autoRedaction, toggleAutoRedaction } = useAutoRedaction();

  const handleAutoRedactionToggle = () => {
    toggleAutoRedaction();
    toast(
      autoRedaction
        ? t('settings.autoRedactionDisabled')
        : t('settings.autoRedactionEnabled'),
      'info'
    );
  };
  const auditImportRef = useRef<HTMLInputElement | null>(null);
  const [user, setUser] = useState<LocalUser | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Login form
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'recover'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState('');
  const [localProfile, setLocalProfile] = useState<any | null>(null);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [profileEditFullName, setProfileEditFullName] = useState('');
  const [profileEditBackupEmail, setProfileEditBackupEmail] = useState('');
  // إصلاح: إعادة تعريف متغيرات الهاتف والبريد الإلكتروني المطلوبة للواجهة
  const [profileEditPhone, setProfileEditPhone] = useState('');
  const [profileEditBirthDate, setProfileEditBirthDate] = useState('');
  const [profileEditCurrentPassword, setProfileEditCurrentPassword] = useState('');
  const [isUpdatingProfileInfo, setIsUpdatingProfileInfo] = useState(false);

  /** يحذف الرموز الخطرة التي قد تُستخدم في حقن قواعد البيانات */
  const sanitizeName = (v: string) => v.replace(/[$+.]/g, '');

  const [regStep, setRegStep] = useState<1 | 2 | 3>(1);
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regBackupEmail, setRegBackupEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBirthDate, setRegBirthDate] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regQ1, setRegQ1] = useState('');
  const [regA1, setRegA1] = useState('');
  const [regQ2, setRegQ2] = useState('');
  const [regA2, setRegA2] = useState('');
  const [regQ3, setRegQ3] = useState('');
  const [regA3, setRegA3] = useState('');
  const [regEmailCode, setRegEmailCode] = useState('');
  const [regPhoneOtp, setRegPhoneOtp] = useState('');
  const [regCodesSent, setRegCodesSent] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [showRegPwd, setShowRegPwd] = useState(false);

  const [recStep, setRecStep] = useState<string>('email-input');
  const [recEmail, setRecEmail] = useState('');
  const [recLoading, setRecLoading] = useState(false);
  const [recEmailCode, setRecEmailCode] = useState('');
  const [recPhoneOtp, setRecPhoneOtp] = useState('');
  const [recQ1, setRecQ1] = useState('');
  const [recA1, setRecA1] = useState('');
  const [recQ2, setRecQ2] = useState('');
  const [recA2, setRecA2] = useState('');
  const [recQ3, setRecQ3] = useState('');
  const [recA3, setRecA3] = useState('');
  const [recNewPassword, setRecNewPassword] = useState('');
  const [showRecPwd, setShowRecPwd] = useState(false);

  const [showLoginPwd, setShowLoginPwd] = useState(false);

  const [emailVerifyCode, setEmailVerifyCode] = useState('');
  const [showEmailVerifyInput, setShowEmailVerifyInput] = useState(false);
  const [emailVerifyLoading, setEmailVerifyLoading] = useState(false);

  const [phoneVerifyOtp, setPhoneVerifyOtp] = useState('');
  const [showPhoneVerifyInput, setShowPhoneVerifyInput] = useState(false);
  const [phoneVerifyLoading, setPhoneVerifyLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setAuthSuccess('');
    setRegLoading(true);
    try {
      const { userId } = await registerUserFn({
        fullName: regFullName,
        email: regEmail,
        backupEmail: regBackupEmail,
        birthDate: regBirthDate,
        password: regPassword,
        securityQuestions: {
          q1: regQ1, a1: regA1,
          q2: regQ2, a2: regA2,
          q3: regQ3, a3: regA3,
        },
        emailCode: regEmailCode,
      });
      setAuthSuccess(language === 'ar'
        ? `تم إنشاء الحساب بنجاح. معرفك: ${userId}`
        : `Account created successfully. Your ID: ${userId}`);
      setAuthMode('login');
      setLoginEmail(regEmail);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'فشل إنشاء الحساب.');
    } finally {
      setRegLoading(false);
    }
  };

  const handleSendEmailRecovery = async () => {
    setLoginError('');
    setAuthSuccess('');
    setRecLoading(true);
    try {
      await sendEmailRecoveryCode(recEmail);
      setRecStep('email-verify');
      setAuthSuccess('تم إرسال رمز التحقق إلى بريدك الإلكتروني.');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'فشل إرسال رمز التحقق.');
    } finally {
      setRecLoading(false);
    }
  };

  const handleVerifyEmailCode = async () => {
    setLoginError('');
    setAuthSuccess('');
    setRecLoading(true);
    try {
      await verifyEmailRecoveryCode(recEmail, recEmailCode);
      // Load security questions after email verification
      try {
        const qs = await getRecoveryQuestions(recEmail);
        setRecQ1(qs.q1); setRecQ2(qs.q2); setRecQ3(qs.q3);
      } catch { /* questions may be empty */ }
      setRecStep('questions');
      setAuthSuccess('تم التحقق من البريد الإلكتروني.');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'رمز التحقق غير صحيح.');
    } finally {
      setRecLoading(false);
    }
  };

  const handleSendPhoneRecovery = async () => {
    setLoginError('');
    setAuthSuccess('');
    setRecLoading(true);
    setLoginError('استرجاع الحساب عبر الهاتف غير متاح حالياً. استخدم البريد الإلكتروني أو الأسئلة الأمنية.');
    setRecLoading(false);
  };

  const handleVerifyPhoneOtp = async () => {
    setLoginError('');
    setAuthSuccess('');
    setRecLoading(true);
    setLoginError('استرجاع الحساب عبر الهاتف غير متاح حالياً. استخدم البريد الإلكتروني أو الأسئلة الأمنية.');
    setRecLoading(false);
  };

  useEffect(() => {
    const runScan = async () => {
      try {
        if (!user || !userProfile) return;
        const cursor = threatScanCursorRef.current ? threatScanCursorRef.current : undefined;
        const { count, latestCreatedAt } = await getThreatCountSince(
          user.uid,
          userProfile.role,
          cursor as Date,
        );
        if (count > 0) {
          setThreatBadgeCount((prev: number) => prev + count);
          toast(
            `⚠ ${count} تهديد${count > 1 ? 'ات' : ''} جديد${count > 1 ? 'ة' : ''} رُصد${count > 1 ? 'ت' : ''} في السجلات`,
            'error',
          );
          if (latestCreatedAt) {
            threatScanCursorRef.current = new Date(latestCreatedAt.getTime() + 1);
          }
        }
      } catch {
        // silent — background task, never interrupt UX
      }
    };

    threatScanIntervalRef.current = setInterval(runScan, 30_000);
    return () => {
      if (threatScanIntervalRef.current) clearInterval(threatScanIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, userProfile?.role]);

  useEffect(() => {
    // Boot: initialise the AI provider DB cache (migrates any legacy localStorage data)
    // then hydrate the agent with the persisted active provider.
    initProviderCache().then(() => {
      const storedProvider = getCachedActiveProvider() as AgentLlmProviderId;
      const result = setAgentLlmProvider(storedProvider);
      setAgentLlmProviderState(result.activeProviderId);
      setAgentLlmProviderNotice(result.warning ?? '');
      setChatProviderLabel(
        AGENT_LLM_PROVIDERS.find((provider) => provider.id === result.activeProviderId)?.label ?? result.activeProviderId
      );
    });
  }, []);

  useEffect(() => {
    // If the first message is a greeting, keep it in sync with UI language
    setChatMessages((prev) => {
      if (prev.length !== 1) return prev;
      const first = prev[0];
      if (first?.role !== 'assistant' || first?.kind !== 'greeting') return prev;

      const name =
        (localProfile?.fullName && String(localProfile.fullName).trim()) ||
        (user?.displayName && String(user.displayName).trim()) ||
        (user?.email ? String(user.email).split('@')[0] : '') ||
        (language === 'ar' ? 'مستخدم' : 'User');

      const content =
        language === 'ar'
          ? `مرحباً ${name}! كيف يمكنني مساعدتك اليوم؟`
          : `Hi ${name}! How can I help you today?`;

      return [{ ...first, content }];
    });
  }, [language, localProfile?.fullName, user?.displayName, user?.email]);

  useEffect(() => {
    if (!isChatOpen) return;
    // Only greet once per session (chatMessages cleared on logout)
    if (chatMessages.length !== 0) return;

    const name =
      (localProfile?.fullName && String(localProfile.fullName).trim()) ||
      (user?.displayName && String(user.displayName).trim()) ||
      (user?.email ? String(user.email).split('@')[0] : '') ||
      (language === 'ar' ? 'مستخدم' : 'User');

    const content =
      language === 'ar'
        ? `مرحباً ${name}! كيف يمكنني مساعدتك اليوم؟`
        : `Hi ${name}! How can I help you today?`;

    setChatMessages([{ role: 'assistant', kind: 'greeting', content }]);
  }, [isChatOpen, chatMessages.length, language, localProfile?.fullName, user?.displayName, user?.email]);

  // --- SQL data refresh ---
  const refreshData = useCallback(async (uid: string, profile: UserProfile) => {
    const [fetchedLogs, fetchedPolicies] = await Promise.all([
      getDataLogs(uid, profile.role),
      getSecurityPolicies(uid),
    ]);
    setLogs(fetchedLogs);
    setPolicies(fetchedPolicies);
    if (profile.role === 'Administrator') {
      const fetchedAudit = await getAuditLogs();
      setAuditLogs(fetchedAudit);
    }
  }, []);

  const initializeLocalSession = useCallback(
    async (emailInput: string) => {
      const email = emailInput.trim().toLowerCase();
      const uid = `local-${email.replace(/[^a-z0-9]/g, '_')}`;
      const localUser: LocalUser = {
        uid,
        email,
        displayName: email.split('@')[0],
      };

      setUser(localUser);

      let profile = await getUserProfile(localUser.uid);
      if (!profile) {
        profile = await upsertUserProfile({
          uid: localUser.uid,
          email: localUser.email,
          role: 'Administrator',
        });
      } else if (profile.role !== 'Administrator') {
        profile = await upsertUserProfile({
          uid: localUser.uid,
          email: localUser.email,
          role: 'Administrator',
        });
      }

      setUserProfile(profile);
      await refreshData(localUser.uid, profile);

      try {
        const authProfile = await getLocalUserProfile(localUser.email);
        setLocalProfile(authProfile);
        setProfileEditFullName(authProfile.fullName ?? '');
        setProfileEditBackupEmail(authProfile.backupEmail ?? '');
        // تمت إزالة تعيين رقم الهاتف حفاظاً على الخصوصية
        setProfileEditBirthDate(
          authProfile.birthDate ? new Date(authProfile.birthDate).toISOString().slice(0, 10) : ''
        );
      } catch {
        setLocalProfile(null);
      }

      // Initialize default CVE source for non-read-only users
      if (profile.role !== 'Read-Only User') {
        setIsInitializingCVE(true);
        try {
          await initializeDefaultCVESource(localUser.uid, localUser.email);
          await refreshData(localUser.uid, profile);
        } catch (error) {
          console.error('Failed to initialize CVE source', error);
        } finally {
          setIsInitializingCVE(false);
        }
      }

      // Pre-load CVE/policy rules for the agent policy engine
      setAgentActiveUser(localUser.uid).catch(console.error);

      // Load file system references
      try {
        const refs = await getFileSystemReferences(localUser.uid);
        setFileReferences(refs);
      } catch (error) {
        console.error('Failed to load file system references', error);
      }

      localStorage.setItem('dataguard_user_email', localUser.email);
    },
    [refreshData]
  );

  // --- CVE Source Handler ---
  const handleInitializeCVESource = useCallback(async () => {
    if (!user || !userProfile) return;
    setIsInitializingCVE(true);
    try {
      await initializeDefaultCVESource(user.uid, user.email);
      await refreshData(user.uid, userProfile);
      // Refresh policy rules so the agent uses the newly added CVE policy
      setAgentActiveUser(user.uid).catch(console.error);
    } catch (error) {
      console.error('Failed to initialize CVE source', error);
    } finally {
      setIsInitializingCVE(false);
    }
  }, [user, userProfile, refreshData]);

  // --- File Protection Handlers ---
  const handleRequestFileAccess = useCallback(async () => {
    if (!user) return;

    setIsFileScanning(true);
    try {
      const dirHandle = await requestFileSystemAccess();
      if (dirHandle) {
        fileSystemHandleRef.current.handle = dirHandle;

        // Save reference to database
        const directoryPath = (dirHandle as any).name || 'User Directory';
        // const savedRef = await saveFileSystemReference(
        //   user.uid,
        //   directoryPath,
        //   directoryPath,
        //   selectedScanInterval
        // );

        // Start scanning
        const threats = await scanDirectoryForThreats(dirHandle, new Set());
        setScanResults(threats);
        const badCount = threats.filter((t: any) => t.riskLevel !== 'safe').length;
        if (badCount > 0) {
          const hasCritical = threats.some((t: any) => t.riskLevel === 'critical');
          pushNotification({
            level: hasCritical ? 'critical' : 'warning',
            source: 'file_scan',
            title: language === 'ar' ? 'تم رصد تهديدات أثناء فحص الملفات' : 'Threats detected during file scan',
            message:
              (language === 'ar'
                ? `المجلد: ${directoryPath} — تم رصد ${badCount} عنصر/عناصر خطرة.`
                : `Directory: ${directoryPath} — detected ${badCount} risky item(s).`),
            meta: { directoryPath, badCount },
          });
        }

        // Update results in database
        // await updateFileSystemScanResults(
        //   savedRef.id,
        //   threats.length,
        //   threats.filter(t => t.riskLevel !== 'safe').length
        // );

        // Refresh references list
        const updatedRefs = await getFileSystemReferences(user.uid);
        setFileReferences(updatedRefs);

        // Log the action
        await insertAuditLog({
          uid: user.uid,
          userEmail: user.email,
          operation: 'SCAN',
          resourcePath: 'file_system',
          details: `Scanned directory: ${directoryPath}. Found ${threats.length} items, ${threats.filter(t => t.riskLevel !== 'safe').length} threats.`,
        });
      }
    } catch (error) {
      console.error('File scanning error:', error);
      pushNotification({
        level: 'error',
        source: 'file_scan',
        title: language === 'ar' ? 'فشل فحص الملفات' : 'File scan failed',
        message: String(error),
      });
      await insertAuditLog({
        uid: user.uid,
        userEmail: user.email,
        operation: 'SECURITY',
        resourcePath: 'file_system',
        details: `File system scan failed: ${String(error)}`,
      });
    } finally {
      setIsFileScanning(false);
    }
  }, [user, selectedScanInterval, language]);

  const handleRemoveFileAccess = useCallback(async (referenceId: string) => {
    if (!user) return;
    try {
      // await removeFileSystemReference(referenceId);
      const updatedRefs = await getFileSystemReferences(user.uid);
      setFileReferences(updatedRefs);

      await insertAuditLog({
        uid: user.uid,
        userEmail: user.email,
        operation: 'DELETE',
        resourcePath: 'file_system_references',
        details: `Removed file system access reference: ${referenceId}`,
      });
    } catch (error) {
      console.error('Error removing file reference:', error);
    }
  }, [user]);

  const handleRescanDirectory = useCallback(async (referenceId: string) => {
    if (!user || !fileSystemHandleRef.current.handle) return;

    setIsFileScanning(true);
    try {
      const threats = await scanDirectoryForThreats(fileSystemHandleRef.current.handle, new Set());
      setScanResults(threats);
      const badCount = threats.filter((t: any) => t.riskLevel !== 'safe').length;
      if (badCount > 0) {
        const hasCritical = threats.some((t: any) => t.riskLevel === 'critical');
        pushNotification({
          level: hasCritical ? 'critical' : 'warning',
          source: 'file_scan',
          title: language === 'ar' ? 'تم رصد تهديدات أثناء إعادة الفحص' : 'Threats detected during rescan',
          message:
            (language === 'ar'
              ? `تم رصد ${badCount} عنصر/عناصر خطرة أثناء إعادة الفحص.`
              : `Detected ${badCount} risky item(s) during rescan.`),
          meta: { referenceId, badCount },
        });
      }

      // Update results in database
      // await updateFileSystemScanResults(
      //   referenceId,
      //   threats.length,
      //   threats.filter(t => t.riskLevel !== 'safe').length
      // );

      // Refresh references list
      const updatedRefs = await getFileSystemReferences(user.uid);
      setFileReferences(updatedRefs);

      // Log the action
      await insertAuditLog({
        uid: user.uid,
        userEmail: user.email,
        operation: 'SCAN',
        resourcePath: 'file_system',
        details: `Rescanned directory. Found ${threats.length} items, ${threats.filter(t => t.riskLevel !== 'safe').length} threats.`,
      });
    } catch (error) {
      console.error('Rescan error:', error);
      pushNotification({
        level: 'error',
        source: 'file_scan',
        title: language === 'ar' ? 'فشل إعادة فحص الملفات' : 'Rescan failed',
        message: String(error),
      });
    } finally {
      setIsFileScanning(false);
    }
  }, [user, language]);

  // --- Email Monitor Handlers ---
  const refreshEmailMonitorState = useCallback(() => {
    const st = getEmailMonitorState();
    setEmailMonitorState(st);

    // (Re)start realtime loop based on state
    if (emailMonitorCleanupRef.current) {
      try { emailMonitorCleanupRef.current(); } catch { /* ignore */ }
      emailMonitorCleanupRef.current = null;
    }
    if (st.enabled && st.connection) {
      emailMonitorCleanupRef.current = startMonitorLoop((alert) => {
        const lvl = alert.riskLevel === 'dangerous' ? 'critical' : 'warning';
        pushNotification({
          level: lvl,
          source: 'email_monitor',
          title: alert.riskLevel === 'dangerous'
            ? (language === 'ar' ? 'تم رصد بريد خطير' : 'Dangerous email detected')
            : (language === 'ar' ? 'تم رصد بريد مشبوه' : 'Suspicious email detected'),
          message: (language === 'ar'
            ? `من: ${alert.from} — الموضوع: ${alert.subject}`
            : `From: ${alert.from} — Subject: ${alert.subject}`),
          meta: { messageId: alert.messageId, riskLevel: alert.riskLevel, matchedRules: alert.matchedRules },
        });
      });
    } else {
      stopMonitorLoop();
    }
  }, [language]);

  const handleConnectGmail = useCallback(async (clientId: string, clientSecret?: string) => {
    setIsConnectingGmail(true);
    try {
      // await connectGmail(clientId, clientSecret);
      refreshEmailMonitorState();
      toast('تم ربط Gmail بنجاح', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'فشل ربط Gmail', 'error');
    } finally {
      setIsConnectingGmail(false);
    }
  }, [refreshEmailMonitorState]);

  const handleDisconnectGmail = useCallback(() => {
    disconnectGmail();
    refreshEmailMonitorState();
  }, [refreshEmailMonitorState]);

  const handleSetEmailMonitorEnabled = useCallback((enabled: boolean) => {
    setEmailMonitorEnabled(enabled);
    refreshEmailMonitorState();
  }, [refreshEmailMonitorState]);

  const handleAddCashRule = useCallback((rule: Omit<CashRule, 'id' | 'createdAt' | 'isDefault'>) => {
    addCashRule(rule);
    refreshEmailMonitorState();
  }, [refreshEmailMonitorState]);

  const handleRemoveCashRule = useCallback((id: string) => {
    removeCashRule(id);
    refreshEmailMonitorState();
  }, [refreshEmailMonitorState]);

  const handleToggleCashRule = useCallback((id: string, enabled: boolean) => {
    toggleCashRule(id, enabled);
    refreshEmailMonitorState();
  }, [refreshEmailMonitorState]);

  const handleDismissAlert = useCallback((id: string) => {
    dismissAlert(id);
    refreshEmailMonitorState();
  }, [refreshEmailMonitorState]);

  const handleClearAlerts = useCallback(() => {
    clearAllAlerts();
    refreshEmailMonitorState();
  }, [refreshEmailMonitorState]);

  // Boot email monitor state on mount
  useEffect(() => { refreshEmailMonitorState(); }, [refreshEmailMonitorState]);

  // --- Password Manager Handlers ---
  const refreshPasswordManagerState = useCallback(() => {
    setPasswordManagerState(getPasswordManagerState());
  }, []);

  // Boot PM state on mount
  useEffect(() => { refreshPasswordManagerState(); }, [refreshPasswordManagerState]);

  const handleAddPasswordEntry = useCallback(async (data: { service: string; username: string; password: string; url?: string; notes?: string }) => {
    await addPmEntry(data);
    refreshPasswordManagerState();
    toast('تم حفظ كلمة المرور بتشفير AES-256-GCM', 'success');
  }, [refreshPasswordManagerState]);

  const handleRemovePasswordEntry = useCallback((id: string) => {
    removePmEntry(id);
    refreshPasswordManagerState();
    toast('تم حذف المدخل من الخزنة', 'success');
  }, [refreshPasswordManagerState]);

  const handleRunWeakPasswordScan = useCallback(async () => {
    setIsPasswordManagerScanning(true);
    try {
      const { newWeakCount } = await runWeakPasswordScan();
      refreshPasswordManagerState();
      if (newWeakCount > 0) {
        toast(`تم اكتشاف ${newWeakCount} كلمة مرور ضعيفة جديدة!`, 'error');
        pushNotification({
          level: 'warning',
          source: 'system',
          title: language === 'ar' ? 'كلمات مرور ضعيفة' : 'Weak passwords',
          message: language === 'ar'
            ? `تم اكتشاف ${newWeakCount} كلمة مرور ضعيفة جديدة.`
            : `Detected ${newWeakCount} new weak password(s).`,
          meta: { newWeakCount },
        });
      }
      else toast('فحص كلمات المرور اكتمل — لا توجد مشكلات جديدة.', 'success');
    } finally {
      setIsPasswordManagerScanning(false);
    }
  }, [refreshPasswordManagerState, language, toast]);

  const handleSyncEmailPasswords = useCallback(async () => {
    setIsEmailSyncing(true);
    try {
      // Email sync requires Gmail connection — surfaced as UI hint only
      refreshPasswordManagerState();
      toast('لا يوجد اتصال Gmail نشط للمزامنة.', 'error');
    } finally {
      setIsEmailSyncing(false);
    }
  }, [refreshPasswordManagerState]);

  const handleImportEmailHint = useCallback(async (hint: { messageId: string; service: string; username: string; suggestedPassword: string }) => {
    await addPmEntry({ service: hint.service, username: hint.username, password: hint.suggestedPassword, source: 'email_sync', emailMessageId: hint.messageId } as any);
    refreshPasswordManagerState();
    setEmailSyncHints((prev) => prev.filter((h) => h.messageId !== hint.messageId));
    toast(`تم استيراد بيانات اعتماد ${hint.service}`, 'success');
  }, [refreshPasswordManagerState]);

  const handleImportAllEmailHints = useCallback(async () => {
    for (const hint of emailSyncHints) {
      await addPmEntry({ service: hint.service, username: hint.username, password: hint.suggestedPassword, source: 'email_sync', emailMessageId: hint.messageId } as any);
    }
    refreshPasswordManagerState();
    setEmailSyncHints([]);
    toast('تم استيراد جميع الاقتراحات', 'success');
  }, [emailSyncHints, refreshPasswordManagerState]);

  const handleDismissWeakAlert = useCallback((alertId: string) => {
    dismissPmAlert(alertId);
    refreshPasswordManagerState();
  }, [refreshPasswordManagerState]);

  const handleDecryptPassword = useCallback(async (entry: any): Promise<string> => {
    return decryptEntryPassword(entry);
  }, []);

  // --- Test Scenarios Handler ---
  const handleRunTests = useCallback(async () => {
    if (!user) return;
    setIsRunningTests(true);
    setTestExecutionProgress(0);
    try {
      const allScenarios = TEST_SCENARIOS;
      const filtered = selectedScenarioCategory === 'all'
        ? allScenarios
        : allScenarios.filter((s) => s.category === selectedScenarioCategory);
      const executor = getTestExecutor();
      const results: any[] = [];
      for (let i = 0; i < filtered.length; i++) {
        const result = await executor.executeScenario(filtered[i], user.uid, user.email);
        results.push(result);
        setTestExecutionProgress(Math.round(((i + 1) / filtered.length) * 100));
      }
      setTestResults(results);
    } catch (error) {
      console.error('Test execution failed:', error);
      toast('فشل تنفيذ الاختبارات. راجع الكونسول.', 'error');
    } finally {
      setIsRunningTests(false);
    }
  }, [user, selectedScenarioCategory]);

  const clearTestResults = useCallback(() => {
    if (testResultsTimerRef.current) clearTimeout(testResultsTimerRef.current);
    if (testResultsCountdownRef.current) clearInterval(testResultsCountdownRef.current);
    setTestResults([]);
    setTestResultsExpiresAt(null);
    setTestResultsSecondsLeft(null);
  }, []);

  // --- 45-minute auto-clear for test results ---
  useEffect(() => {
    if (testResults.length === 0 || isRunningTests) return;

    const expiresAt = Date.now() + 45 * 60 * 1000;
    setTestResultsExpiresAt(expiresAt);
    setTestResultsSecondsLeft(45 * 60);

    if (testResultsTimerRef.current) clearTimeout(testResultsTimerRef.current);
    if (testResultsCountdownRef.current) clearInterval(testResultsCountdownRef.current);

    testResultsTimerRef.current = setTimeout(() => {
      setTestResults([]);
      setTestResultsExpiresAt(null);
      setTestResultsSecondsLeft(null);
      if (testResultsCountdownRef.current) clearInterval(testResultsCountdownRef.current);
    }, 45 * 60 * 1000);

    testResultsCountdownRef.current = setInterval(() => {
      const remaining = Math.round((expiresAt - Date.now()) / 1000);
      if (remaining <= 0) {
        setTestResultsSecondsLeft(null);
        clearInterval(testResultsCountdownRef.current!);
      } else {
        setTestResultsSecondsLeft(remaining);
      }
    }, 1000);

    return () => {
      if (testResultsTimerRef.current) clearTimeout(testResultsTimerRef.current);
      if (testResultsCountdownRef.current) clearInterval(testResultsCountdownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testResults.length, isRunningTests]);

  // --- Audit helper ---

  // --- Audit PDF download ---
  const downloadAuditPDF = useCallback(() => {
    if (auditLogs.length === 0) return;
    const isRtl = language === 'ar';
    const lines = auditLogs.map((l) =>
      `${l.timestamp.toLocaleString()} | ${l.operation} | ${l.userEmail} | ${l.resourcePath} | ${l.details}`
    );
    const content = [
      isRtl ? 'تقرير سجلات التدقيق - DataGuard AI' : 'Audit Log Report - DataGuard AI',
      `${isRtl ? 'تاريخ التصدير' : 'Exported'}: ${new Date().toLocaleString()}`,
      '',
      ...lines,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dataguard-audit-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [auditLogs, language]);

  // --- Chat handler ---
  const handleChatMessage = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput.trim();
    const msgLang: 'ar' | 'en' = /[\u0600-\u06FF]/.test(userMsg) ? 'ar' : 'en';
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setIsChatLoading(true);
    try {
      const reply = await generateLiveAgentChatReply({
        message: userMsg,
        profileId: agentProfile as any,
        responseLanguage: msgLang,
      });
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: reply.text,
          providerLabel: chatProviderLabel,
          fromCache: reply.fromCache,
        },
      ]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ ${error instanceof Error ? error.message : t('chat.error')}` },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  }, [agentProfile, chatInput, chatProviderLabel, isChatLoading, t]);

  // --- Local session bootstrap ---
  useEffect(() => {
    // Restore session from localStorage on mount
    const savedEmail = localStorage.getItem('dataguard_user_email');
    if (savedEmail) {
      initializeLocalSession(savedEmail).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    // Restore master session
    if (isMasterSessionActive()) {
      setIsMaster(true);
    }
  }, [initializeLocalSession]);

  // Refresh on tab change
  useEffect(() => {
    if (user && userProfile) {
      refreshData(user.uid, userProfile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // تم حذف منطق مزامنة السياسات لعدم توفر المتغيرات المطلوبة

  // --- Handlers ---
  const handleSendRegistrationCodes = async () => {
    setLoginError('');
    setAuthSuccess('');
    if (!regEmail.trim()) {
      setLoginError('أدخل البريد الإلكتروني أولاً.');
      return;
    }

    if (isDevBypassEmail(regEmail)) {
      setRegCodesSent(true);
      setRegEmailCode('000000');
      setAuthSuccess('وضع تطوير: تم تخطي إرسال/تأكيد رمز البريد لهذا الحساب.');
      return;
    }

    setRegLoading(true);

    try {
      // تم حذف منطق الإرسال الحقيقي لعدم توفر الخدمات المطلوبة حالياً.
      // نُبقي السلوك الأساسي كي يكتمل مسار التسجيل في الواجهة.
      setRegCodesSent(true);
      setAuthSuccess('تم إرسال رموز التحقق (محاكاة).');
    } finally {
      setRegLoading(false);
    }
  };

  // تمت إزالة جميع دوال التحقق عبر الهاتف وOTP وجميع المتغيرات المرتبطة بها نهائياً من التطبيق

  // ── Recovery Step 3: load questions ──────────────────────────────────────
  const handleLoadQuestions = async () => {
    // تم حذف منطق تحميل الأسئلة لعدم توفر المتغيرات المطلوبة
  };

  // ── Recovery Step 3 verify ────────────────────────────────────────────────
  const handleVerifySecurityAnswers = async () => {
    setLoginError('');
    setAuthSuccess('');
    if (!recA1.trim() || !recA2.trim() || !recA3.trim()) {
      setLoginError('أجب على جميع أسئلة الأمان الثلاثة.');
      return;
    }
    setRecLoading(true);
    try {
      await verifySecurityAnswersForRecovery(recEmail, recA1, recA2, recA3);
      setAuthSuccess('تم التحقق من إجاباتك بنجاح. أدخل كلمة المرور الجديدة.');
      setRecStep('new-password');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'إجابات أسئلة الأمان غير صحيحة.');
    } finally {
      setRecLoading(false);
    }
  };

  // ── Recovery Final: reset password ────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setAuthSuccess('');
    if (!recNewPassword.trim()) {
      setLoginError('أدخل كلمة المرور الجديدة.');
      return;
    }
    setRecLoading(true);
    try {
      await resetPasswordAfterVerification(recEmail, recNewPassword);
      setAuthSuccess('تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.');
      setAuthMode('login');
      setLoginEmail(recEmail);
      setRecStep('email-input');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'فشل تغيير كلمة المرور.');
    } finally {
      setRecLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setLoginError('');
    setAuthSuccess('');
    setIsUpdatingAvatar(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Failed to read image.'));
        reader.readAsDataURL(file);
      });

      await updateLocalUserAvatar(user.email, dataUrl);
      await touchUserActivity(user.email);
      const refreshed = await getLocalUserProfile(user.email);
      setLocalProfile(refreshed);
      setAuthSuccess('تم تحديث الصورة الشخصية بنجاح.');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'فشل تحديث الصورة الشخصية.');
    } finally {
      setIsUpdatingAvatar(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setLoginError('');
    setAuthSuccess('');
    setIsUpdatingAvatar(true);
    try {
      await clearLocalUserAvatar(user.email);
      await touchUserActivity(user.email);
      const refreshed = await getLocalUserProfile(user.email);
      setLocalProfile(refreshed);
      setAuthSuccess('تم حذف الصورة الشخصية والرجوع للوضع الافتراضي.');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'فشل حذف الصورة الشخصية.');
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const handleUpdateProfileInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoginError('');
    setAuthSuccess('');
    if (!profileEditCurrentPassword.trim()) {
      setLoginError('يرجى إدخال كلمة المرور الحالية للتأكيد.');
      return;
    }
    setIsUpdatingProfileInfo(true);
    try {
      await updateLocalUserProfileWithCurrentPassword({
        email: user.email,
        currentPassword: profileEditCurrentPassword,
        fullName: profileEditFullName,
        backupEmail: profileEditBackupEmail,
        phoneNumber: profileEditPhone,
        birthDate: profileEditBirthDate,
      });
      await touchUserActivity(user.email);
      const refreshed = await getLocalUserProfile(user.email);
      setLocalProfile(refreshed);
      setProfileEditCurrentPassword('');
      setAuthSuccess('تم تحديث البيانات الشخصية بنجاح.');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'فشل تحديث البيانات الشخصية.');
    } finally {
      setIsUpdatingProfileInfo(false);
    }
  };

  const handleSendEmailVerification = async () => {
    if (!user) return;
    setLoginError('');
    setAuthSuccess('');
    setEmailVerifyLoading(true);
    try {
      await sendEmailVerificationCode(user.email);
      setShowEmailVerifyInput(true);
      setAuthSuccess('تم إرسال رمز التحقق إلى بريدك الإلكتروني. تحقق من صندوق الوارد.');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'فشل إرسال رمز التحقق.');
    } finally {
      setEmailVerifyLoading(false);
    }
  };

  const handleConfirmEmailVerification = async () => {
    if (!user) return;
    setLoginError('');
    setAuthSuccess('');
    if (!emailVerifyCode.trim()) {
      setLoginError('أدخل رمز التحقق.');
      return;
    }
    setEmailVerifyLoading(true);
    try {
      await confirmEmailVerification(user.email, emailVerifyCode);
      const refreshed = await getLocalUserProfile(user.email);
      setLocalProfile(refreshed);
      setShowEmailVerifyInput(false);
      setEmailVerifyCode('');
      setAuthSuccess('تم توثيق البريد الإلكتروني بنجاح!');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'رمز التحقق غير صحيح.');
    } finally {
      setEmailVerifyLoading(false);
    }
  };

  // إصلاح: حذف resetRecaptcha إذا لم تكن معرفة، أو استبدالها بدالة فارغة
  const resetRecaptcha = () => { };
  const handleSendPhoneVerification = async () => {
    if (!user) return;
    setLoginError('');
    setAuthSuccess('');
    setPhoneVerifyLoading(true);
    try {
      // استدعاء الدالة المحلية فقط
      setShowPhoneVerifyInput(true);
      setAuthSuccess('تم إرسال رمز التحقق SMS إلى رقم هاتفك المسجّل.');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'فشل إرسال رمز التحقق.');
    } finally {
      setPhoneVerifyLoading(false);
    }
  };

  const handleConfirmPhoneVerification = async () => {
    if (!user) return;
    setLoginError('');
    setAuthSuccess('');
    if (!phoneVerifyOtp.trim()) {
      setLoginError('أدخل رمز OTP.');
      return;
    }
    setPhoneVerifyLoading(true);
    try {
      // استدعاء الدالة المحلية فقط
      setShowPhoneVerifyInput(false);
      setPhoneVerifyOtp('');
      setAuthSuccess('تم توثيق رقم الهاتف بنجاح!');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'رمز OTP غير صحيح.');
    } finally {
      setPhoneVerifyLoading(false);
    }
  };

  const handleChangeCurrentPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoginError('');
    setAuthSuccess('');

    if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
      setLoginError('يرجى تعبئة جميع حقول كلمة المرور.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setLoginError('كلمة المرور الجديدة وتأكيدها غير متطابقين.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await changePasswordWithCurrent(user.email, currentPasswordInput, newPasswordInput);
      await touchUserActivity(user.email);
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setAuthSuccess('تم تغيير كلمة المرور بنجاح.');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'فشل تغيير كلمة المرور.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // --- Master Login ---
  const handleMasterLogoClick = () => {
    setMasterLogoClicks(prev => prev + 1);
    if (masterClickTimer.current) clearTimeout(masterClickTimer.current);
    masterClickTimer.current = setTimeout(() => setMasterLogoClicks(0), 2000);
    if (masterLogoClicks + 1 >= 5) {
      setShowMasterLogin(true);
      setMasterLoginStep('credentials');
      setMasterLogoClicks(0);
    }
  };

  const handleMasterLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMasterError('');
    setMasterLoading(true);
    try {
      if (masterLoginStep === 'credentials') {
        const candidate = await validateMasterLogin(masterUsername, masterPassword);
        if (!candidate) throw new Error('بيانات الدخول غير صحيحة.');
        setMasterCandidate(candidate);
        setMasterLoginStep('security');
        setMasterLoading(false);
        return;
      }

      if (!masterCandidate) throw new Error('يرجى إعادة المحاولة.');
      const ok = await validateMasterSecurityAnswer(masterCandidate, masterSecurityAnswer.trim());
      if (!ok) throw new Error('إجابة سؤال الأمان غير صحيحة.');

      activateMasterSession();
      setIsMaster(true);
      setShowMasterLogin(false);
      setMasterUsername('');
      setMasterPassword('');
      setMasterSecurityAnswer('');
      setMasterLoginStep('credentials');
      setMasterCandidate(null);
      setActiveTab('master');
    } catch (error) {
      setMasterError(error instanceof Error ? error.message : 'فشل تسجيل دخول الماستر.');
    } finally {
      setMasterLoading(false);
    }
  };

  const handleMasterLogout = () => {
    clearMasterSession();
    setIsMaster(false);
    setActiveTab('dashboard');
  };

  const handleMasterBackToCredentials = () => {
    setMasterError('');
    setMasterSecurityAnswer('');
    setMasterLoginStep('credentials');
    setMasterCandidate(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setAuthSuccess('');
    setLoginLoading(true);
    try {
      const authUser = await loginUser(loginEmail, loginPassword);
      await initializeLocalSession(authUser.email);
      toast(`مرحباً بك، ${authUser.fullName || authUser.email}!`, 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'فشل تسجيل الدخول.';
      if (msg === 'ACCOUNT_INACTIVE_90_DAYS') {
        setLoginError('تم تعطيل حسابك بسبب عدم النشاط لأكثر من 90 يوماً. يرجى التواصل مع الدعم.');
      } else {
        setLoginError(msg);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setUserProfile(null);
    setLocalProfile(null);
    setLogs([]);
    setPolicies([]);
    setAuditLogs([]);
    setChatMessages([]);
    setActiveTab('dashboard');
    localStorage.removeItem('dataguard_user_email');
    toast('تم تسجيل الخروج بنجاح.', 'success');
  };

  const handleAuditImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !userProfile) return;
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const payload = JSON.parse(raw) as {
        test_round?: number;
        changes?: Array<{
          path: string;
          type: 'file' | 'folder';
          previous_hash?: string | null;
          current_hash?: string | null;
          change_status: 'NEW' | 'MODIFIED' | 'UNCHANGED' | 'REMOVED';
        }>;
      };

      if (payload.test_round !== 2 || !Array.isArray(payload.changes)) {
        toast(t('audit.invalidFile'), 'error');
        return;
      }

      for (const item of payload.changes) {
        await insertAuditLog({
          uid: user.uid,
          userEmail: user.email,
          operation: 'SCAN',
          resourcePath: item.path,
          details: `Filesystem comparison at test #${payload.test_round}`,
          targetPath: item.path,
          targetType: item.type,
          testRound: payload.test_round,
          previousHash: item.previous_hash ?? undefined,
          currentHash: item.current_hash ?? undefined,
          changeStatus: item.change_status,
        });
      }

      await refreshData(user.uid, userProfile);
      toast(t('audit.importSuccess').replace('{count}', payload.changes.length.toString()), 'success');
    } catch (err) {
      console.error('Audit report import failed', err);
      toast(t('audit.importFailed'), 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) return;
    if (!policyName.trim() || !policySourceUrl.trim()) return;
    setIsCreatingPolicy(true);
    try {
      await createRemoteSecurityPolicy({
        uid: user.uid,
        name: policyName.trim(),
        sourceUrl: policySourceUrl.trim(),
        isActive: true,
        syncIntervalHours: policySyncIntervalHours,
        userEmail: user.email,
      });
      setPolicyName('');
      setPolicySourceUrl('');
      setPolicySyncIntervalHours(24);
      setIsPolicyFormOpen(false);
      await refreshData(user.uid, userProfile);
      setAgentActiveUser(user.uid).catch(console.error);
      toast(t('policies.importSuccess') || 'تم استيراد السياسة بنجاح.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'فشل إنشاء السياسة.', 'error');
    } finally {
      setIsCreatingPolicy(false);
    }
  };

  const handleSyncPolicy = useCallback(async (policyId: string) => {
    if (!user || !userProfile) return;
    setSyncingPolicyId(policyId);
    try {
      await syncRemoteSecurityPolicy(policyId, { uid: user.uid, userEmail: user.email });
      await refreshData(user.uid, userProfile);
      setAgentActiveUser(user.uid).catch(console.error);
      toast(t('policies.syncSuccess') || 'تمت المزامنة بنجاح.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'فشلت عملية المزامنة.', 'error');
    } finally {
      setSyncingPolicyId(null);
    }
  }, [refreshData, t, user, userProfile]);

  const handleAgentProviderChange = (providerId: AgentLlmProviderId) => {
    const result = setAgentLlmProvider(providerId);
    setAgentLlmProviderState(result.activeProviderId);
    setAgentLlmProviderNotice(result.warning ?? '');
    setChatProviderLabel(
      AGENT_LLM_PROVIDERS.find((provider) => provider.id === result.activeProviderId)?.label ?? result.activeProviderId
    );
    // Persist active provider to DB (fire-and-forget; cache already updated in-memory)
    // تم حذف منطق مزود قاعدة البيانات لعدم توفر المتغيرات المطلوبة
  };

  // --- Content Scanner handler ---
  const handleScan = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !scanContent.trim()) return;
    setIsScanning(true);
    setScanResult(null);
    setAgentRun(null);
    try {
      const result = await scanData(scanContent);
      setScanResult(result);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'فشل الفحص.', 'error');
    } finally {
      setIsScanning(false);
    }
  }, [user, scanContent]);

  const toggleDecryption = (id: string) => {
    // تم حذف منطق التدقيق عند فك التشفير لعدم توفر الدالة
    setShowDecrypted((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // --- Loading ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono" style={{ background: 'linear-gradient(135deg, #060d1f 0%, #0b1530 50%, #060d1f 100%)' }}>
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-orange-500/30 animate-ping absolute inset-0" />
            <div className="w-16 h-16 rounded-full border-2 border-orange-500 flex items-center justify-center">
              <Shield className="w-7 h-7 text-orange-400" />
            </div>
          </div>
          <span className="text-xs uppercase tracking-widest" style={{ color: '#64748b' }}>{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  // Master-only mode: allow accessing the Master Panel without a user session.
  // This fixes the case where master login succeeds but `user` is still null,
  // which previously forced the app back to the auth screen.
  if (isMaster && !user) {
    return (
      <div className="min-h-screen" dir={dir} style={{ background: 'linear-gradient(135deg, #060d1f 0%, #0b1530 50%, #060d1f 100%)' }}>
        <header className="sticky top-0 z-30 px-6 py-4 flex items-center justify-between" style={{ background: 'rgba(6,13,31,0.92)', borderBottom: '1px solid rgba(239,68,68,0.18)', backdropFilter: 'blur(18px)' }}>
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-red-400" />
            <div className={dir === 'rtl' ? 'text-right' : ''}>
              <div className="text-sm font-black tracking-tight text-white">{language === 'ar' ? 'لوحة تحكم الماستر' : 'Master Panel'}</div>
              <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#fca5a5' }}>{language === 'ar' ? 'وضع الماستر مفعّل' : 'MASTER MODE ACTIVE'}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={language === 'en' ? 'العربية' : 'English'}
              className="p-2 hover:bg-blue-400/10 rounded-full transition-colors text-slate-300 hover:text-white flex items-center gap-2"
            >
              <Globe className="w-4 h-4" />
              <span className="text-xs font-medium">{language.toUpperCase()}</span>
            </motion.button>

            <motion.button
              onClick={handleMasterLogout}
              whileHover={{ rotate: -8, scale: 1.06 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 hover:bg-rose-500/20 rounded-full transition-colors text-slate-400 hover:text-rose-400"
              title={language === 'ar' ? 'خروج الماستر' : 'Master logout'}
            >
              <LogOut className="w-4 h-4" />
            </motion.button>
          </div>
        </header>

        <main className="p-6 md:p-10 max-w-6xl mx-auto">
          <MasterPanel dir={dir} />
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-page-wrapper" dir={dir}>
        {/* Animated particle network */}
        <ParticleCanvas />

        {/* Decorative geometric shapes */}
        <div className="auth-geo-1" />
        <div className="auth-geo-2" />
        <div className="auth-geo-3" />
        <div className="auth-shield-glow" />

        <div className="auth-card-enhanced">
          <div className="flex flex-col items-center text-center gap-5 w-full">

            {/* Logo + title */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative" onClick={handleMasterLogoClick} style={{ cursor: 'pointer' }}>
                <img
                  src="/logo.png"
                  alt="DataGuard AI"
                  className="w-20 h-20 object-contain drop-shadow-2xl"
                  style={{ filter: 'drop-shadow(0 0 18px rgba(249,115,22,0.45))' }}
                />
              </div>
            </div>

            {/* Master login modal */}
            <AnimatePresence>
              {showMasterLogin && (
                <motion.div
                  key="master-login-modal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center px-4"
                >
                  <div
                    className="absolute inset-0 bg-black/60"
                    onClick={() => {
                      setShowMasterLogin(false);
                      setMasterError('');
                      setMasterLoginStep('credentials');
                      setMasterSecurityAnswer('');
                        setMasterCandidate(null);
                    }}
                  />
                  <motion.div
                    initial={{ y: 12, scale: 0.98, opacity: 0 }}
                    animate={{ y: 0, scale: 1, opacity: 1 }}
                    exit={{ y: 12, scale: 0.98, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="relative w-full max-w-md rounded-2xl overflow-hidden"
                    style={{ background: 'rgba(6,13,31,0.96)', border: '1px solid rgba(239,68,68,0.28)', backdropFilter: 'blur(20px)' }}
                  >
                    <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(239,68,68,0.18)' }}>
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-red-400" />
                        <span className="text-xs font-black uppercase tracking-widest text-white">Master Login</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMasterLogin(false);
                          setMasterError('');
                          setMasterLoginStep('credentials');
                          setMasterSecurityAnswer('');
                          setMasterCandidate(null);
                        }}
                        className="p-2 rounded-full hover:bg-white/5 text-slate-300 hover:text-white"
                        aria-label="Close"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleMasterLogin} className="p-4 space-y-3 text-right">
                      {masterLoginStep === 'credentials' && (
                        <>
                          <input
                            className="auth-input"
                            placeholder="Master Username"
                            value={masterUsername}
                            onChange={(e) => setMasterUsername(e.target.value)}
                            dir="ltr"
                            required
                          />
                          <input
                            className="auth-input"
                            placeholder="Master Password"
                            type="password"
                            value={masterPassword}
                            onChange={(e) => setMasterPassword(e.target.value)}
                            dir="ltr"
                            required
                          />
                        </>
                      )}

                      {masterLoginStep === 'security' && (
                        <>
                          {/* Security question text intentionally blank */}
                          <input
                            className="auth-input"
                            placeholder={language === 'ar' ? 'إجابة سؤال الأمان' : 'Security answer'}
                            value={masterSecurityAnswer}
                            onChange={(e) => setMasterSecurityAnswer(e.target.value)}
                            dir="ltr"
                            required
                          />
                          <p className="text-[10px] font-mono" style={{ color: '#94a3b8' }}>
                            {language === 'ar' ? 'تم التحقق من بيانات الدخول ✓ أكمل خطوة الأمان.' : 'Credentials verified ✓ Complete the security step.'}
                          </p>
                        </>
                      )}

                      {masterError && (
                        <p className="text-xs font-mono text-rose-400 text-right">{masterError}</p>
                      )}

                      <div className="flex gap-2">
                        {masterLoginStep === 'security' && (
                          <motion.button
                            type="button"
                            onClick={handleMasterBackToCredentials}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            className="auth-btn-secondary flex-1 flex items-center justify-center gap-2"
                            style={{ fontSize: '12px' }}
                          >
                            {language === 'ar' ? 'رجوع' : 'Back'}
                          </motion.button>
                        )}
                        <motion.button
                          type="submit"
                          disabled={masterLoading}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          className="auth-btn-primary flex-1 flex items-center justify-center gap-2"
                        >
                          <Lock className="w-4 h-4" />
                          {masterLoading
                            ? (language === 'ar' ? 'جاري التحقق...' : 'Verifying...')
                            : masterLoginStep === 'credentials'
                              ? (language === 'ar' ? 'التالي' : 'Next')
                              : (language === 'ar' ? 'دخول الماستر' : 'Login')}
                        </motion.button>
                      </div>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="w-full space-y-4">
              {/* Mode tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(96,165,250,0.12)' }}>
                {(['login', 'register', 'recover'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setAuthMode(mode);
                      setLoginError('');
                      setAuthSuccess('');
                      if (mode === 'register') {
                        setRegStep(1);
                        setRegFullName(''); setRegEmail(''); setRegBackupEmail('');
                        setRegPhone(''); setRegBirthDate(''); setRegPassword('');
                        setRegQ1(t('auth.securityQ1')); setRegA1('');
                        setRegQ2(t('auth.securityQ2')); setRegA2('');
                        setRegQ3(t('auth.securityQ3')); setRegA3('');
                        setRegEmailCode(''); setRegPhoneOtp('');
                        setRegCodesSent(false); setRegLoading(false);
                      }
                      if (mode === 'recover') {
                        setRecStep('email-input');
                        setRecEmail(''); setRecEmailCode(''); setRecPhoneOtp('');
                        setRecA1(''); setRecA2(''); setRecA3(''); setRecNewPassword('');
                      }
                    }}
                    className={`auth-tab${authMode === mode ? ' active' : ''}`}
                  >
                    {mode === 'login' ? t('auth.tabLogin') : mode === 'register' ? t('auth.tabRegister') : t('auth.tabRecover')}
                  </button>
                ))}
              </div>

              {/* ═══ LOGIN ═══ */}
              {authMode === 'login' && (
                <motion.div
                  key="login-form"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  <p className="text-xs text-blue-300/70 text-center mb-3">{t('auth.loginSubtitle')}</p>
                  <form onSubmit={handleLogin} className="space-y-3">
                    <div className="space-y-1 text-right">
                      <label className="text-[10px] font-mono text-blue-400/70 uppercase tracking-widest">{t('auth.email')}</label>
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="auth-input"
                        placeholder="example@email.com"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1 text-right">
                      <label className="text-[10px] font-mono text-blue-400/70 uppercase tracking-widest">{t('auth.password')}</label>
                      <div className="auth-input-wrap">
                        <button type="button" className="auth-input-toggle" onClick={() => setShowLoginPwd(v => !v)} tabIndex={-1}>
                          {showLoginPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <input
                          type={showLoginPwd ? 'text' : 'password'}
                          required={!isDevBypassEmail(loginEmail)}
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="auth-input"
                          placeholder="••••••••••••"
                        />
                      </div>
                    </div>
                    <motion.button
                      type="submit"
                      disabled={loginLoading}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className="auth-btn-primary flex items-center justify-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      {loginLoading ? t('auth.loggingIn') : t('auth.login')}
                    </motion.button>
                  </form>
                </motion.div>
              )}

              {/* ═══ REGISTER ═══ */}
              {authMode === 'register' && (
                <motion.div
                  key="register-form"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-3 w-full"
                >
                  {/* Stepper */}
                  <div className="flex items-center gap-1 w-full">
                    {([1, 2, 3] as const).map((step, idx) => {
                      const labels = [t('auth.stepData'), t('auth.stepSecurity'), t('auth.stepVerify')];
                      const isDone = regStep > step;
                      const isActive = regStep === step;
                      return (
                        <React.Fragment key={step}>
                          <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                            <motion.div
                              animate={{ scale: isActive ? 1.1 : 1 }}
                              className={`auth-stepper-dot ${isDone ? 'done' : isActive ? 'active' : 'pending'}`}
                            >
                              {isDone ? <CheckCircle className="w-3.5 h-3.5" /> : step}
                            </motion.div>
                            <span className={`text-[9px] font-mono uppercase tracking-widest ${isActive ? 'text-orange-400 font-bold' : isDone ? 'text-emerald-400' : 'text-slate-500'}`}>{labels[idx]}</span>
                          </div>
                          {idx < 2 && <div className={`auth-stepper-line ${regStep > step ? 'done' : 'pending'}`} />}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  <div className="p-2.5 rounded-xl text-[11px] leading-relaxed" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: '#fcd34d' }}>
                    ⚠ إذا لم يُسجَّل أي نشاط لمدة 90 يوماً، سيُحذف الحساب تلقائياً.
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (regStep === 1) {
                        // Block step advance if underage
                        if (regBirthDate) {
                          const birth = new Date(regBirthDate);
                          const now = new Date();
                          const ageMs = now.getTime() - birth.getTime();
                          const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
                          if (ageYears < 13) return;
                        }
                        setRegStep(2); return;
                      }
                      if (regStep === 2) { setRegStep(3); return; }
                      handleRegister(e);
                    }}
                    className="space-y-2.5"
                  >
                    {/* Step 1 */}
                    <AnimatePresence mode="wait">
                      {regStep === 1 && (
                        <motion.div
                          key="step1"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.22 }}
                          className="space-y-2"
                        >
                          <p className="text-[11px] text-blue-300/70 text-right">{t('auth.registerSubtitle')}</p>
                          <input className="auth-input" placeholder={t('auth.fullName')} value={regFullName} onChange={(e) => setRegFullName(sanitizeName(e.target.value))} required />
                          <input className="auth-input" placeholder={t('auth.emailAddress')} type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
                          <input className="auth-input" placeholder={t('auth.backupEmail')} type="email" value={regBackupEmail} onChange={(e) => setRegBackupEmail(e.target.value)} />
                          <input className="auth-input" placeholder={t('auth.phone')} value={regPhone} onChange={(e) => setRegPhone(e.target.value)} />
                          <div>
                            <label className="text-[10px] font-mono text-blue-400/60 uppercase tracking-widest block mb-1">{t('auth.birthDate')}</label>
                            <input className="auth-input" type="date" value={regBirthDate} onChange={(e) => setRegBirthDate(e.target.value)} required />
                            {(() => {
                              if (!regBirthDate) return null;
                              const birth = new Date(regBirthDate);
                              const now = new Date();
                              const ageMs = now.getTime() - birth.getTime();
                              const ageYears = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
                              if (ageYears < 0) return null;
                              if (ageYears < 13) return (
                                <p className="text-[11px] mt-1 font-semibold" style={{ color: '#f87171' }}>🚫 {t('auth.ageUnder13')}</p>
                              );
                              if (ageYears < 18) return (
                                <p className="text-[11px] mt-1 font-semibold" style={{ color: '#fb923c' }}>⚠ {t('auth.ageUnder18')}</p>
                              );
                              return (
                                <p className="text-[11px] mt-1" style={{ color: '#34d399' }}>✓ {t('auth.ageOk').replace('{age}', String(ageYears))}</p>
                              );
                            })()}
                          </div>
                          <div className="auth-input-wrap">
                            <button type="button" className="auth-input-toggle" onClick={() => setShowRegPwd(v => !v)} tabIndex={-1}>
                              {showRegPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <input className="auth-input" type={showRegPwd ? 'text' : 'password'} placeholder={t('auth.passwordField')} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required />
                          </div>
                        </motion.div>
                      )}

                      {/* Step 2 */}
                      {regStep === 2 && (
                        <motion.div
                          key="step2"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.22 }}
                          className="space-y-2"
                        >
                          <p className="text-[11px] text-blue-300/70 text-right">{t('auth.securityQuestionsNote')}</p>
                          {[{ q: regQ1, a: regA1, set: setRegA1, ph: t('auth.answer1') }, { q: regQ2, a: regA2, set: setRegA2, ph: t('auth.answer2') }, { q: regQ3, a: regA3, set: setRegA3, ph: t('auth.answer3') }].map((item, i) => (
                            <div key={i} className="auth-sec-question">
                              <p>{item.q}</p>
                              <input className="auth-input" placeholder={item.ph} value={item.a} onChange={(e) => item.set(sanitizeName(e.target.value))} />
                            </div>
                          ))}
                        </motion.div>
                      )}

                      {/* Step 3 */}
                      {regStep === 3 && (
                        <motion.div
                          key="step3"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.22 }}
                          className="space-y-2"
                        >
                          <p className="text-[11px] text-blue-300/70 text-right">{t('auth.verifySubtitle')}</p>
                          {!isDevBypassEmail(regEmail) && (
                            <button
                              type="button"
                              onClick={handleSendRegistrationCodes}
                              disabled={regLoading}
                              className="auth-btn-secondary"
                            >
                              {regLoading ? t('auth.sending') : t('auth.sendVerificationCode')}
                            </button>
                          )}
                          <input
                            className="auth-input"
                            placeholder={t('auth.verificationCodePlaceholder')}
                            value={regEmailCode}
                            onChange={(e) => setRegEmailCode(e.target.value)}
                            required={regCodesSent && !isDevBypassEmail(regEmail)}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Navigation buttons */}
                    <div className="flex gap-3 pt-3">
                      {regStep > 1 && (
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setRegStep((s) => (s - 1) as 1 | 2 | 3)}
                          className="flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                          style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)', color: '#93c5fd' }}
                        >
                          ← {t('auth.back') || 'رجوع'}
                        </motion.button>
                      )}
                      {regStep === 2 && (
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setRegStep(3)}
                          className="py-3 px-5 rounded-xl text-sm font-bold transition-all"
                          style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8' }}
                        >
                          {t('auth.skip') || 'تخطي'}
                        </motion.button>
                      )}
                      {regStep < 3 ? (
                        <motion.button
                          type="submit"
                          whileHover={{ scale: 1.02, y: -1 }}
                          whileTap={{ scale: 0.98 }}
                          className="auth-btn-primary flex-1 flex items-center justify-center gap-2"
                        >
                          {t('auth.next') || 'التالي'} ←
                        </motion.button>
                      ) : (
                        <motion.button
                          type="submit"
                          disabled={regLoading || (!regCodesSent && !isDevBypassEmail(regEmail))}
                          whileHover={{ scale: 1.02, y: -1 }}
                          whileTap={{ scale: 0.98 }}
                          className="auth-btn-primary flex-1 flex items-center justify-center gap-2"
                        >
                          <Shield className="w-4 h-4" />
                          {regLoading ? t('auth.creatingAccount') : t('auth.confirmRegister')}
                        </motion.button>
                      )}
                    </div>
                  </form>
                </motion.div>
              )}

              {/* ═══ RECOVER ═══ */}
              {authMode === 'recover' && (
                <motion.div
                  key="recover-form"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  <form onSubmit={handleResetPassword} className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                    {recStep === 'email-input' && (
                      <div className="space-y-2">
                        <p className="text-xs text-blue-300/70 text-right">{t('auth.recoverEmailSubtitle')}</p>
                        <input className="auth-input" placeholder={t('auth.email')} type="email" value={recEmail} onChange={(e) => setRecEmail(e.target.value)} required />
                        <button type="button" onClick={handleSendEmailRecovery} disabled={recLoading} className="auth-btn-primary">{recLoading ? t('auth.recoverSending') : t('auth.recoverSendCode')}</button>
                      </div>
                    )}
                    {recStep === 'email-verify' && (
                      <div className="space-y-2">
                        <p className="text-xs text-blue-300/70 text-right">{t('auth.recoverCodeSubtitle')}</p>
                        <input className="auth-input" placeholder={t('auth.recoverCodePlaceholder')} value={recEmailCode} onChange={(e) => setRecEmailCode(e.target.value)} maxLength={6} />
                        <button type="button" onClick={handleVerifyEmailCode} disabled={recLoading} className="auth-btn-primary">{recLoading ? t('auth.recoverVerifying') : t('auth.recoverConfirmCode')}</button>
                        <button type="button" onClick={handleSendPhoneRecovery} disabled={recLoading} className="auth-btn-secondary" style={{ fontSize: '11px' }}>{recLoading ? '...' : t('auth.recoverTryPhone')}</button>
                      </div>
                    )}

                    {recStep === 'questions' && (
                      <div className="space-y-2">
                        <p className="text-xs text-blue-300/70 text-right">أجب على أسئلة الأمان المسجّلة.</p>
                        {[{ q: recQ1, a: recA1, set: setRecA1, ph: 'الإجابة الأولى' }, { q: recQ2, a: recA2, set: setRecA2, ph: 'الإجابة الثانية' }, { q: recQ3, a: recA3, set: setRecA3, ph: 'الإجابة الثالثة' }].filter(i => i.q).map((item, i) => (
                          <div key={i} className="auth-sec-question">
                            <p>{item.q}</p>
                            <input className="auth-input" placeholder={item.ph} value={item.a} onChange={(e) => item.set(e.target.value)} />
                          </div>
                        ))}
                        <button type="button" onClick={handleVerifySecurityAnswers} disabled={recLoading} className="auth-btn-primary">{recLoading ? 'جاري التحقق...' : 'تأكيد الإجابات ✓'}</button>
                        <button type="button" onClick={() => setRecStep('support')} className="auth-btn-secondary" style={{ fontSize: '11px' }}>لا أتذكر الإجابات →</button>
                      </div>
                    )}
                    {recStep === 'new-password' && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-right" style={{ color: '#34d399' }}>{t('auth.recoverVerified')}</p>
                        <div className="auth-input-wrap">
                          <button type="button" className="auth-input-toggle" onClick={() => setShowRecPwd(v => !v)} tabIndex={-1}>
                            {showRecPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <input className="auth-input" type={showRecPwd ? 'text' : 'password'} placeholder={t('auth.recoverNewPassword')} value={recNewPassword} onChange={(e) => setRecNewPassword(e.target.value)} required />
                        </div>
                        <button type="submit" disabled={recLoading || !recNewPassword.trim()} className="auth-btn-primary">{recLoading ? t('auth.recoverSaving') : t('auth.recoverSavePassword')}</button>
                      </div>
                    )}
                    {recStep === 'support' && (
                      <div className="space-y-3 text-center py-2">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                          <Lock className="w-6 h-6 text-red-400" />
                        </div>
                        <p className="text-sm font-bold text-white">{t('auth.recoverFailed')}</p>
                        <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{t('auth.recoverFailedDesc')}</p>
                        <a href="mailto:support@dataguardai.com" className="auth-btn-primary block text-center no-underline">{t('auth.recoverContactSupport')}</a>
                        <button type="button" onClick={() => { setRecStep('email-input'); setRecEmail(''); setLoginError(''); setAuthSuccess(''); }} className="auth-btn-secondary" style={{ fontSize: '11px' }}>{t('auth.recoverTryAgain')}</button>
                      </div>
                    )}
                    {recStep !== 'email-input' && recStep !== 'support' && recStep !== 'new-password' && (
                      <button type="button" onClick={() => { setLoginError(''); setAuthSuccess(''); setRecStep('email-input'); }} className="auth-btn-secondary" style={{ fontSize: '11px' }}>{t('auth.recoverBackToStart')}</button>
                    )}
                  </form>
                </motion.div>
              )}

              {loginError && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={`text-xs text-rose-400 text-${language === 'ar' ? 'right' : 'left'} font-mono`}
                >
                  {loginError}
                </motion.p>
              )}
              {authSuccess && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={`text-xs text-emerald-400 text-${language === 'ar' ? 'right' : 'left'} font-mono`}
                >
                  {authSuccess}
                </motion.p>
              )}
            </div>

            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider" style={{ color: '#475569' }}>
              <Lock className="w-3 h-3" />
              {t('common.endToEndEncrypted')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Main App ---
  return (
    <div className="app-main-wrapper min-h-screen text-slate-200 font-sans" dir={dir}>
      {/* Particle background — same as auth page */}
      <ParticleCanvas />
      {/* Decorative geometric shapes */}
      <div className="app-geo-1" />
      <div className="app-geo-2" />
      <div className="app-geo-3" />
      {/* Header */}
      <header className="app-header-glass sticky top-0 z-10 px-5 py-3 flex items-center justify-between" style={{ background: 'rgba(6,13,31,0.88)', borderBottom: '1px solid rgba(96,165,250,0.18)', backdropFilter: 'blur(28px)' }}>
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-3 focus:outline-none group"
        >
          <img
            src="/logo.png"
            alt="DataGuard AI"
            className="w-11 h-11 object-contain logo-glow"
          />
          <div>
            <h1 className="text-sm font-black tracking-tight uppercase text-white group-hover:text-orange-400 transition-colors">DataGuard<span className="text-orange-400"> AI</span></h1>
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#475569' }}>{t('header.subtitle')}</p>
          </div>
        </button>
        <div className="flex items-center gap-4">
          {/* Password Manager shortcut */}
          <motion.button
            onClick={() => {
              setActiveTab('policies');
              setTimeout(() => {
                document.getElementById('password-manager-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 200);
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={t('passwordManager.title')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 transition-all text-xs font-bold" style={{ background: 'rgba(249,115,22,0.08)' }}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t('passwordManager.title')}</span>
            {passwordManagerState.meta.weakCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {passwordManagerState.meta.weakCount}
              </span>
            )}
          </motion.button>
          {/* Hamburger — mobile only */}
          <motion.button
            onClick={() => setIsMobileSidebarOpen(true)}
            whileTap={{ scale: 0.9 }}
            className="md:hidden p-2 hover:bg-blue-400/10 rounded-full transition-colors text-slate-300 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </motion.button>
          <motion.button
            onClick={() => setNotificationsOpen((v) => !v)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={language === 'ar' ? 'التنبيهات' : 'Alerts'}
            className="relative p-2 hover:bg-blue-400/10 rounded-full transition-colors text-slate-300 hover:text-white"
          >
            <Bell className="w-4 h-4" />
            {notificationUnread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {Math.min(99, notificationUnread)}
              </span>
)}
          </motion.button>
          {/* Download App */}
          <motion.button
            onClick={() => setActiveTab('download')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={language === 'ar' ? 'تنزيل التطبيق' : 'Download App'}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-all text-xs font-bold"
            style={{ background: 'rgba(59,130,246,0.08)' }}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{language === 'ar' ? 'تنزيل' : 'Download'}</span>
          </motion.button>
          {/* Password Manager */}
          <motion.button
            onClick={() => setGuidesOpen((v) => !v)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={t('sidebar.guides')}
            className="p-2 hover:bg-blue-400/10 rounded-full transition-colors text-slate-300 hover:text-white"
          >
            <BookOpen className="w-4 h-4" />
          </motion.button>
          <motion.button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={language === 'en' ? 'العربية' : 'English'}
            className="p-2 hover:bg-blue-400/10 rounded-full transition-colors text-slate-300 hover:text-white flex items-center gap-2"
          >
            <Globe className="w-4 h-4" />
            <span className="text-xs font-medium">{language.toUpperCase()}</span>
          </motion.button>
          <div className="flex flex-col items-end">
            {user && typeof user === 'object' && (
              <>
                <span className="text-xs font-medium text-white">
                  {localProfile?.fullName?.trim() || user!.displayName || user!.email?.split('@')[0]}
                </span>
                <span className="text-[10px] font-mono uppercase" style={{ color: '#4a6fa5' }}>
                  {localProfile?.id ? `ID: ${localProfile.id}` : (language === 'ar' ? 'ID: غير متوفر' : 'ID: N/A')}
                </span>
              </>
            )}
          </div>
          <motion.button
            onClick={isMaster ? handleMasterLogout : handleLogout}
            whileHover={{ rotate: -8, scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 hover:bg-rose-500/20 rounded-full transition-colors text-slate-400 hover:text-rose-400"
          >
            <LogOut className="w-4 h-4" />
          </motion.button>
        </div>
      </header>

      <div className="flex">
        <NotificationsPanel
          open={notificationsOpen}
          dir={dir}
          items={notificationItems}
          unreadCount={notificationUnread}
          onClose={() => setNotificationsOpen(false)}
          onMarkAllRead={() => markAllNotificationsRead()}
          onClearAll={() => clearNotifications()}
          onToggleRead={(id, nextRead) => markNotificationRead(id, nextRead)}
        />
        <GuidesPanel
          open={guidesOpen}
          dir={dir}
          t={t}
          onClose={() => setGuidesOpen(false)}
        />
        {/* Mobile sidebar overlay backdrop */}
        <AnimatePresence>
          {isMobileSidebarOpen && (
            <motion.div
              key="mobile-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Sidebar — desktop: sticky, mobile: slide-in drawer */}
        <AnimatePresence>
          {(isMobileSidebarOpen || true) && (
            <motion.aside
              key="sidebar"
              initial={isMobileSidebarOpen ? (dir === 'rtl' ? { x: '100%' } : { x: '-100%' }) : false}
              animate={isMobileSidebarOpen ? { x: 0 } : {}}
              exit={dir === 'rtl' ? { x: '100%' } : { x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              style={{ background: 'rgba(6,13,31,0.92)', borderColor: 'rgba(96,165,250,0.18)' }}
              className={[
                'app-sidebar-glass w-64 backdrop-blur-md h-[calc(100vh-73px)] overflow-y-auto',
                // desktop
                'hidden md:block sticky top-[73px]',
                // mobile: full-height fixed overlay
                isMobileSidebarOpen ? '!flex flex-col fixed top-0 h-full z-50 md:static md:z-auto' : '',
                dir === 'rtl' ? 'border-l border-r-0 right-0' : 'border-r left-0',
              ].join(' ')}
            >
              {/* Close button — mobile only */}
              {isMobileSidebarOpen && (
                <div className="flex items-center justify-between px-5 pt-5 pb-2 md:hidden">
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>القائمة</span>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className="p-1.5 rounded-full hover:bg-blue-400/10 text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>
              )}
              <div className="py-6 space-y-1">
                <SidebarItem icon={Activity} label={t('sidebar.dashboard')} active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsMobileSidebarOpen(false); }} />
                <SidebarItem icon={Database} label={t('sidebar.logs')} active={activeTab === 'logs'} onClick={() => { setActiveTab('logs'); setIsMobileSidebarOpen(false); setThreatBadgeCount(0); }} badge={threatBadgeCount > 0 ? threatBadgeCount : undefined} />
                <SidebarItem icon={ShieldAlert} label={t('sidebar.policies')} active={activeTab === 'policies'} onClick={() => { setActiveTab('policies'); setIsMobileSidebarOpen(false); }} />
                <SidebarItem icon={User} label={t('sidebar.profile')} active={activeTab === 'profile'} onClick={() => { setActiveTab('profile'); setIsMobileSidebarOpen(false); }} />
                {userProfile?.role === 'Administrator' && (
                  <SidebarItem icon={History} label={t('sidebar.audit')} active={activeTab === 'audit'} onClick={() => { setActiveTab('audit'); setIsMobileSidebarOpen(false); }} />
                )}
                <SidebarItem icon={Settings} label={t('sidebar.settings')} active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsMobileSidebarOpen(false); }} />
                <SidebarItem icon={Zap} label={t('sidebar.aiProviders')} active={activeTab === 'ai-providers'} onClick={() => { setActiveTab('ai-providers'); setIsMobileSidebarOpen(false); }} />
                <SidebarItem icon={Wrench} label={t('sidebar.advancedTools')} active={activeTab === 'advanced-tools'} onClick={() => { setActiveTab('advanced-tools'); setIsMobileSidebarOpen(false); }} />
                {userProfile?.role === 'Administrator' && (
                  <SidebarItem icon={ShieldCheck} label={t('testScenarios.title')} active={activeTab === 'tests'} onClick={() => { setActiveTab('tests'); setIsMobileSidebarOpen(false); }} />
                )}
                <SidebarItem icon={GraduationCap} label={t('sidebar.learn')} active={activeTab === 'learn'} onClick={() => { setActiveTab('learn'); setIsMobileSidebarOpen(false); }} />
                {isMaster && (
                  <SidebarItem icon={Shield} label="Master Panel" active={activeTab === 'master'} onClick={() => { setActiveTab('master'); setIsMobileSidebarOpen(false); }} />
                )}
              </div>
              <div className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : ''}`}>
                <div className="p-3 rounded-xl border space-y-2" style={{ background: 'rgba(10,20,45,0.7)', borderColor: 'rgba(96,165,250,0.18)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-2">
                    <ShieldQuestion className="w-3 h-3" style={{ color: '#60a5fa' }} />
                    <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#64748b' }}>{t('sidebar.yourRole')}</span>
                  </div>
                  <Badge variant={userProfile?.role === 'Administrator' ? 'error' : userProfile?.role === 'Data Analyst' ? 'warning' : 'info'}>
                    {userProfile?.role ?? 'Loading...'}
                  </Badge>
                </div>
              </div>
              <div className="mt-auto p-6 border-t" style={{ borderColor: 'rgba(96,165,250,0.12)' }}>
                <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: 'rgba(10,20,45,0.7)', borderColor: isMaster ? 'rgba(239,68,68,0.3)' : 'rgba(96,165,250,0.18)', boxShadow: isMaster ? '0 0 12px rgba(239,68,68,0.1)' : 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                  <div className={`w-2.5 h-2.5 rounded-full ${isMaster ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`} style={{ boxShadow: isMaster ? '0 0 8px rgba(239,68,68,0.5)' : '0 0 8px rgba(52,211,153,0.5)' }} />
                  <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: isMaster ? '#ef4444' : '#64748b' }}>{isMaster ? 'MASTER MODE' : t('sidebar.status')}</span>
                </div>

                {/* Easier access to Master login */}
                {!isMaster && (
                  <button
                    type="button"
                    onClick={() => { setShowMasterLogin(true); setMasterLoginStep('credentials'); setMasterError(''); }}
                    className="mt-3 w-full px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border hover:bg-red-500/10 transition-colors"
                    style={{ borderColor: 'rgba(239,68,68,0.22)', color: '#fca5a5', background: 'rgba(6,13,31,0.55)' }}
                  >
                    {language === 'ar' ? 'دخول الماستر' : 'Master Login'}
                  </button>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="app-main-content flex-1 p-6 md:p-10 max-w-6xl mx-auto">

          {/* ---- DASHBOARD ---- */}
          {activeTab === 'dashboard' && (
            <DashboardPage
              t={t} dir={dir}
              logs={logs} policies={policies}
              agentRun={agentRun} setAgentRun={setAgentRun}
              showAgentPanel={showAgentPanel} setShowAgentPanel={setShowAgentPanel}
              showDecrypted={showDecrypted} toggleDecryption={toggleDecryption}
              setActiveTab={setActiveTab as any}
            />
          )}

          {/* ---- DATA LOGS ---- */}
          {activeTab === 'logs' && (
            <LogsPage
              t={t} dir={dir}
              logs={logs}
              showDecrypted={showDecrypted}
              toggleDecryption={toggleDecryption}
            />
          )}

          {/* ---- SECURITY POLICIES ---- */}
          {activeTab === 'policies' && (
            <PoliciesPage
              t={t} dir={dir}
              policies={policies}
              policyName={policyName} setPolicyName={setPolicyName}
              policySourceUrl={policySourceUrl} setPolicySourceUrl={setPolicySourceUrl}
              policySyncIntervalHours={policySyncIntervalHours} setPolicySyncIntervalHours={setPolicySyncIntervalHours}
              isCreatingPolicy={isCreatingPolicy}
              isAutoSyncingPolicies={isAutoSyncingPolicies}
              syncingPolicyId={syncingPolicyId}
              isPolicyFormOpen={isPolicyFormOpen} setIsPolicyFormOpen={setIsPolicyFormOpen}
              handleCreatePolicy={handleCreatePolicy}
              handleSyncPolicy={handleSyncPolicy}
              userRole={userProfile?.role}
              isFileScanning={isFileScanning}
              selectedScanInterval={selectedScanInterval} setSelectedScanInterval={setSelectedScanInterval}
              fileReferences={fileReferences} scanResults={scanResults}
              handleRequestFileAccess={handleRequestFileAccess}
              handleRescanDirectory={handleRescanDirectory}
              handleRemoveFileAccess={handleRemoveFileAccess}
              emailMonitorState={emailMonitorState}
              isConnectingGmail={isConnectingGmail}
              handleConnectGmail={handleConnectGmail}
              handleDisconnectGmail={handleDisconnectGmail}
              handleSetEmailMonitorEnabled={handleSetEmailMonitorEnabled}
              handleAddCashRule={handleAddCashRule}
              handleRemoveCashRule={handleRemoveCashRule}
              handleToggleCashRule={handleToggleCashRule}
              handleDismissAlert={handleDismissAlert}
              handleClearAlerts={handleClearAlerts}
              isInitializingCVE={isInitializingCVE}
              handleInitializeCVESource={handleInitializeCVESource}
              passwordManagerState={passwordManagerState}
              isPasswordManagerScanning={isPasswordManagerScanning}
              isEmailSyncing={isEmailSyncing}
              emailSyncHints={emailSyncHints}
              handleAddPasswordEntry={handleAddPasswordEntry}
              handleRemovePasswordEntry={handleRemovePasswordEntry}
              handleRunWeakPasswordScan={handleRunWeakPasswordScan}
              handleSyncEmailPasswords={handleSyncEmailPasswords}
              handleImportEmailHint={handleImportEmailHint}
              handleImportAllEmailHints={handleImportAllEmailHints}
              handleDismissWeakAlert={handleDismissWeakAlert}
              handleDecryptPassword={handleDecryptPassword}
            />
          )}

          {/* ---- AUDIT LOGS ---- */}
          {activeTab === 'audit' && userProfile?.role === 'Administrator' && (
            <AuditPage
              t={t} dir={dir} language={language}
              auditLogs={auditLogs}
              auditImportRef={auditImportRef}
              handleAuditImport={handleAuditImport}
              downloadAuditPDF={downloadAuditPDF}
            />
          )}

          {/* ---- SETTINGS ---- */}
          {activeTab === 'settings' && (
            <SettingsPage
              t={t} dir={dir}
              theme={theme} toggleTheme={toggleTheme}
              agentLlmProvider={agentLlmProviderState as any}
              agentLlmProviderNotice={agentLlmProviderNotice}
              handleAgentProviderChange={handleAgentProviderChange}
              autoRedactionEnabled={autoRedaction}
              toggleAutoRedaction={handleAutoRedactionToggle}
            />
          )}

          {/* ---- PROFILE ---- */}
          {activeTab === 'profile' && user && (
            <ProfilePage
              t={t} dir={dir} language={language} setLanguage={setLanguage}
              user={user}
              localProfile={localProfile}
              currentPasswordInput={currentPasswordInput} setCurrentPasswordInput={setCurrentPasswordInput}
              newPasswordInput={newPasswordInput} setNewPasswordInput={setNewPasswordInput}
              confirmPasswordInput={confirmPasswordInput} setConfirmPasswordInput={setConfirmPasswordInput}
              isUpdatingPassword={isUpdatingPassword} isUpdatingAvatar={isUpdatingAvatar}
              profileEditFullName={profileEditFullName} setProfileEditFullName={setProfileEditFullName}
              profileEditBackupEmail={profileEditBackupEmail} setProfileEditBackupEmail={setProfileEditBackupEmail}
              profileEditPhone={profileEditPhone} setProfileEditPhone={setProfileEditPhone}
              profileEditBirthDate={profileEditBirthDate} setProfileEditBirthDate={setProfileEditBirthDate}
              profileEditCurrentPassword={profileEditCurrentPassword} setProfileEditCurrentPassword={setProfileEditCurrentPassword}
              isUpdatingProfileInfo={isUpdatingProfileInfo}
              handleAvatarChange={handleAvatarChange}
              handleRemoveAvatar={handleRemoveAvatar}
              handleUpdateProfileInfo={handleUpdateProfileInfo}
              handleChangeCurrentPassword={handleChangeCurrentPassword}
              loginError={loginError} authSuccess={authSuccess}
              emailVerifyCode={emailVerifyCode} setEmailVerifyCode={setEmailVerifyCode}
              showEmailVerifyInput={showEmailVerifyInput} emailVerifyLoading={emailVerifyLoading}
              handleSendEmailVerification={handleSendEmailVerification}
              handleConfirmEmailVerification={handleConfirmEmailVerification}
              phoneVerifyOtp={phoneVerifyOtp} setPhoneVerifyOtp={setPhoneVerifyOtp}
              showPhoneVerifyInput={showPhoneVerifyInput} phoneVerifyLoading={phoneVerifyLoading}
              handleSendPhoneVerification={handleSendPhoneVerification}
              handleConfirmPhoneVerification={handleConfirmPhoneVerification}
            />
          )}

          {/* ---- TESTS ---- */}
          {activeTab === 'tests' && userProfile?.role === 'Administrator' && (
            <TestsPage
              t={t} dir={dir} language={language}
              testResults={testResults}
              isRunningTests={isRunningTests}
              testExecutionProgress={testExecutionProgress}
              selectedScenarioCategory={selectedScenarioCategory as any}
              setSelectedScenarioCategory={setSelectedScenarioCategory as any}
              testResultsSecondsLeft={testResultsSecondsLeft}
              handleRunTests={handleRunTests}
              clearTestResults={clearTestResults}
            />
          )}

          {/* ---- CYBERSECURITY LEARNING ---- */}
          {activeTab === 'learn' && (
            <motion.div
              key="learn"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-8 max-w-3xl"
            >
              <div>
                <h2 className="text-xl font-bold tracking-tight">{t('sidebar.learn')}</h2>
                <p className="text-xs mt-1" style={{ color: '#64748b' }}>{language === 'ar' ? 'تعلّم مفاهيم أمان البيانات وأفضل الممارسات.' : 'Learn data security concepts and best practices.'}</p>
              </div>
              {[
                { icon: '🔐', title: language === 'ar' ? 'تشفير البيانات' : 'Data Encryption', desc: language === 'ar' ? 'يحوّل التشفير البيانات إلى صيغة غير قابلة للقراءة إلا للمُخوَّلين. يستخدم DataGuard AI معيار AES-256-GCM.' : 'Encryption converts data into an unreadable format for unauthorized parties. DataGuard AI uses AES-256-GCM.' },
                { icon: '🛡️', title: language === 'ar' ? 'الكشف عن معلومات PII' : 'PII Detection', desc: language === 'ar' ? 'المعلومات الشخصية القابلة للتعريف (PII) تشمل الأسماء والعناوين وأرقام البطاقات. يكشف النظام عنها تلقائياً.' : 'Personally Identifiable Information (PII) includes names, addresses, card numbers. The system detects them automatically.' },
                { icon: '📋', title: language === 'ar' ? 'سياسات الأمان' : 'Security Policies', desc: language === 'ar' ? 'قواعد تحدد كيفية التعامل مع البيانات. يدعم التطبيق استيراد سياسات من مصادر خارجية عبر HTTPS.' : 'Rules defining how data is handled. The app supports importing policies from external sources via HTTPS.' },
                { icon: '🔍', title: language === 'ar' ? 'تصنيف البيانات' : 'Data Classification', desc: language === 'ar' ? 'يُصنّف النظام البيانات إلى: عامة، داخلية، سرية، وشديدة السرية. كل تصنيف له مستوى حماية مختلف.' : 'The system classifies data as: Public, Internal, Confidential, Highly Sensitive — each with different protection levels.' },
                { icon: '📊', title: language === 'ar' ? 'سجلات التدقيق' : 'Audit Logs', desc: language === 'ar' ? 'تتبع جميع العمليات المنفذة في النظام. تساعد في الامتثال للأنظمة والكشف عن الاختراقات.' : 'Track all operations performed in the system. Essential for compliance and breach detection.' },
                { icon: '🤖', title: language === 'ar' ? 'الذكاء الاصطناعي في الأمن' : 'AI in Security', desc: language === 'ar' ? 'يستخدم DataGuard AI وكلاء ذكاء اصطناعي لتحليل التهديدات واقتراح الإجراءات الأمنية تلقائياً.' : 'DataGuard AI uses AI agents to analyze threats and suggest security measures automatically.' },
              ].map((item) => (
                <div key={item.title} className="p-5 rounded-xl" style={{ background: 'rgba(10,20,45,0.6)', border: '1px solid rgba(96,165,250,0.15)' }}>
                  <div className="flex items-start gap-4">
                    <span className="text-3xl">{item.icon}</span>
                    <div>
                      <h3 className="font-bold text-sm uppercase tracking-tight text-white mb-1">{item.title}</h3>
                      <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* ---- AI PROVIDERS ---- */}
          {activeTab === 'ai-providers' && (
            <AIProvidersPage
              t={t} dir={dir}
              agentLlmProvider={agentLlmProviderState as any}
              agentLlmProviderNotice={agentLlmProviderNotice}
              handleAgentProviderChange={handleAgentProviderChange}
            />
          )}

          {/* ---- ADVANCED TOOLS ---- */}
          {activeTab === 'advanced-tools' && (
            <AdvancedToolsPage t={t} dir={dir} />
          )}

          {/* ---- MASTER PANEL ---- */}
          {activeTab === 'master' && isMaster && (
            <MasterPanel dir={dir} />
          )}

          {/* ---- DOWNLOAD PAGE ---- */}
          {activeTab === 'download' && (
            <DownloadPage />
          )}

        </main>

        {/* Floating Agent Panel */}
        <AnimatePresence>
          {agentRun && showAgentPanel && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className={cn(
                'fixed inset-4 sm:inset-auto sm:bottom-8 sm:w-96 rounded-2xl z-50 overflow-hidden',
                dir === 'rtl' ? 'sm:left-8' : 'sm:right-8'
              )}
              style={{ background: 'rgba(6,13,31,0.95)', border: '1px solid rgba(96,165,250,0.25)', backdropFilter: 'blur(28px)', boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(96,165,250,0.08)' }}
            >
              <div className="h-96 flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 animate-pulse" />
                    <span className="text-sm font-bold uppercase">{t('agentBrainLoop.title')}</span>
                  </div>
                  <motion.button
                    onClick={() => setShowAgentPanel(false)}
                    whileHover={{ rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    className="text-white hover:text-sky-100"
                  >
                    <Plus className="w-4 h-4 rotate-45" />
                  </motion.button>
                </div>

                {/* Content Tabs */}
                <div className="flex-1 overflow-y-auto">
                  <div className="p-4 space-y-4">
                    {/* Mode Selector */}
                    <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(10,20,45,0.6)', border: '1px solid rgba(96,165,250,0.1)' }}>
                      <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#4a6fa5' }}>{t('agentBrainLoop.analyzeMode')}</p>
                      <div className="flex gap-2">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setAgentMode('analyst')}
                          className={cn(
                            'flex-1 py-2 px-3 rounded border text-[10px] font-bold uppercase tracking-widest transition-colors',
                            agentMode === 'analyst'
                              ? 'bg-sky-500 border-sky-500 text-white'
                              : 'border-blue-400/20 hover:border-blue-400/60'
                          )}
                          style={{ background: agentMode !== 'analyst' ? 'rgba(10,20,45,0.6)' : undefined, color: agentMode !== 'analyst' ? '#94a3b8' : undefined }}
                        >
                          {t('agentBrainLoop.analyzeMode')}
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setAgentMode('safe-execute')}
                          className={cn(
                            'flex-1 py-2 px-3 rounded border text-[10px] font-bold uppercase tracking-widest transition-colors',
                            agentMode === 'safe-execute'
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-blue-400/20 hover:border-emerald-400/60'
                          )}
                          style={{ background: agentMode !== 'safe-execute' ? 'rgba(10,20,45,0.6)' : undefined, color: agentMode !== 'safe-execute' ? '#94a3b8' : undefined }}
                        >
                          {t('agentBrainLoop.safeMode')}
                        </motion.button>
                      </div>
                      <p className="text-[9px]" style={{ color: '#64748b' }}>
                        {agentMode === 'analyst' ? t('agentBrainLoop.analyzeModeDesc') : t('agentBrainLoop.safeModeDesc')}
                      </p>
                    </div>

                    {/* Profile Selector */}
                    <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(10,20,45,0.6)', border: '1px solid rgba(96,165,250,0.1)' }}>
                      <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#4a6fa5' }}>Agent Profile</p>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { id: 'security-auditor', label: 'Security Auditor' },
                          { id: 'sql-assistant', label: 'SQL Assistant' },
                          { id: 'compliance-advisor', label: 'Compliance Advisor' },
                        ].map((profile) => (
                          <motion.button
                            key={profile.id}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setAgentProfile(profile.id)}
                            className={cn(
                              'py-2 px-3 rounded border text-[10px] font-bold uppercase tracking-widest transition-colors text-left',
                              agentProfile === profile.id
                                ? 'bg-sky-500 border-sky-500 text-white'
                                : 'border-blue-400/20 text-slate-400 hover:border-blue-400/60'
                            )}
                          >
                            {profile.label}
                          </motion.button>
                        ))}
                      </div>
                      {agentRun?.profile && (
                        <div className="rounded p-2 space-y-1" style={{ background: 'rgba(10,20,45,0.8)', border: '1px solid rgba(96,165,250,0.1)' }}>
                          <p className="text-[10px] font-bold text-blue-300">Style: {agentRun.profile.responseStyle}</p>
                          <p className="text-[10px]" style={{ color: '#64748b' }}>Conservatism: {agentRun.profile.conservatism}</p>
                          <p className="text-[10px]" style={{ color: '#64748b' }}>Allowed Tools: {agentRun.availableTools.map((tool: any) => tool.name).join(', ') || 'none'}</p>
                        </div>
                      )}
                    </div>

                    {/* Phase Timeline*/}
                    <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(10,20,45,0.6)', border: '1px solid rgba(96,165,250,0.1)' }}>
                      <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#4a6fa5' }}>{t('agentBrainLoop.timeline')}</p>
                      <div className="space-y-2">
                        {[
                          { phase: 'thinking', label: t('agentBrainLoop.thinking') },
                          { phase: 'planning', label: t('agentBrainLoop.planning') },
                          { phase: 'running-tool', label: t('agentBrainLoop.runningTool') },
                          { phase: 'final-answer', label: t('agentBrainLoop.finalAnswer') },
                        ].map((item) => (
                          <div key={item.phase} className="flex items-center gap-2">
                            <div className={cn(
                              'w-2 h-2 rounded-full',
                              agentRun.decisions.some((d: any) => d.phase === item.phase.replace('-', '_'))
                                ? 'bg-emerald-400'
                                : 'bg-slate-600'
                            )} />
                            <span className="text-[10px] font-medium" style={{ color: '#94a3b8' }}>{item.label}</span>
                            {agentRun.decisions.some((d: any) => d.phase === item.phase.replace('-', '_')) && (
                              <CheckCircle className="w-3 h-3 text-emerald-500 ml-auto" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Key Decisions Timeline */}
                    <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(14,30,68,0.8)', border: '1px solid rgba(96,165,250,0.2)' }}>
                      <p className="text-[10px] font-mono text-blue-400 uppercase tracking-widest font-bold">{t('agentBrainLoop.decisionLog')}</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {agentRun.decisions.slice(0, 3).map((decision: any, idx: number) => (
                          <div key={idx} className="text-[9px] text-blue-300 border-l-2 border-blue-600/50 pl-2 py-1">
                            <span className="font-bold">{decision.decision}</span>
                            {decision.tool && <span className="text-blue-600"> ({decision.tool})</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="rounded-lg p-3" style={{ background: 'rgba(10,20,45,0.6)', border: '1px solid rgba(96,165,250,0.1)' }}>
                      <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: '#4a6fa5' }}>{t('agentBrainLoop.summary')}</p>
                      <p className="text-[11px] font-medium" style={{ color: '#94a3b8' }}>{agentRun.summary}</p>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="border-t p-3 flex gap-2" style={{ borderColor: 'rgba(96,165,250,0.1)', background: 'rgba(6,13,31,0.8)' }}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setAgentRun(null);
                      setShowAgentPanel(false);
                    }}
                    className="flex-1 px-3 py-2 rounded border text-[10px] font-bold text-slate-300 uppercase tracking-widest hover:bg-blue-400/10 transition-colors" style={{ background: 'rgba(10,20,45,0.8)', borderColor: 'rgba(96,165,250,0.2)' }}
                  >
                    {t('common.cancel')}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-3 py-2 rounded bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-red-600"
                  >
                    {t('agentBrainLoop.retryStrict')}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Chat Button */}
        <motion.button
          onClick={() => setIsChatOpen(!isChatOpen)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'fixed bottom-8 w-14 h-14 rounded-full shadow-lg flex items-center justify-center font-bold text-lg z-30 transition-all duration-300',
            dir === 'rtl' ? 'left-8' : 'right-8',
            isChatOpen
              ? 'bg-emerald-500 text-white'
              : 'bg-transparent border-2 border-gray-400 text-gray-600 hover:border-amber-500 hover:text-amber-500 hover:shadow-xl hover:shadow-amber-300'
          )}
        >
          {isChatOpen ? <Plus className="w-6 h-6 rotate-45" /> : <MessageSquare className="w-6 h-6" />}
        </motion.button>

        {/* Chat Panel */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className={cn(
                'fixed inset-4 sm:inset-auto sm:bottom-24 sm:w-96 rounded-xl shadow-2xl z-40 overflow-hidden',
                dir === 'rtl' ? 'sm:left-8' : 'sm:right-8'
              )}
              style={{ background: 'rgba(6,13,31,0.97)', border: '1px solid rgba(139,92,246,0.3)', backdropFilter: 'blur(20px)' }}
            >
              <div className="h-96 flex flex-col">
                {/* Chat Header */}
                <div className="bg-gradient-to-r from-violet-500 to-violet-700 text-white p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-sm font-bold uppercase">{t('chat.title')}</span>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded bg-white/20 border border-white/30 uppercase font-bold tracking-wide">
                    {chatProviderLabel}
                  </span>
                  <motion.button
                    onClick={() => setIsChatOpen(false)}
                    whileHover={{ rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    className="text-white hover:text-violet-100"
                  >
                    <Plus className="w-4 h-4 rotate-45" />
                  </motion.button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: 'rgba(8,16,40,0.8)' }}>
                  {chatMessages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'flex gap-2',
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          A
                        </div>
                      )}
                      <div
                        className={cn(
                          'max-w-xs px-3 py-2 rounded-lg text-sm leading-relaxed',
                          msg.role === 'user'
                            ? 'bg-violet-600 text-white rounded-br-none'
                            : 'rounded-bl-none text-slate-200'
                        )}
                        style={msg.role === 'assistant' ? { background: 'rgba(14,30,68,0.9)', border: '1px solid rgba(96,165,250,0.15)' } : undefined}
                      >
                        <div>{msg.content}</div>
                        {msg.role === 'assistant' && msg.providerLabel && (
                          <div className="mt-2 pt-2 border-t text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ borderColor: 'rgba(96,165,250,0.15)', color: '#4a6fa5' }}>
                            {msg.fromCache && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 text-[9px]">
                                <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2a1 1 0 011 1v4l2.5 1.5a1 1 0 01-1 1.73L7 9.73A1 1 0 017 9V4a1 1 0 011-1z" /></svg>
                                {language === 'ar' ? 'كاش' : 'CACHE'}
                              </span>
                            )}
                            {t('chat.usedProvider')}: {msg.providerLabel}
                          </div>
                        )}
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          U
                        </div>
                      )}
                    </motion.div>
                  ))}
                  {isChatLoading && (
                    <div className="flex gap-2 justify-start">
                      <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        A
                      </div>
                      <div className="rounded-lg rounded-bl-none px-3 py-2" style={{ background: 'rgba(14,30,68,0.9)', border: '1px solid rgba(96,165,250,0.15)' }}>
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="border-t p-3 flex gap-2" style={{ borderColor: 'rgba(139,92,246,0.2)', background: 'rgba(6,13,31,0.9)' }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleChatMessage()}
                    placeholder={t('chat.placeholder')}
                    className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-200 placeholder:text-slate-500"
                    style={{ background: 'rgba(10,20,45,0.8)', border: '1px solid rgba(139,92,246,0.3)' }}
                    disabled={isChatLoading}
                  />
                  <motion.button
                    onClick={handleChatMessage}
                    disabled={isChatLoading || !chatInput.trim()}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-3 py-2 bg-violet-500 text-white rounded-lg font-bold text-xs uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:bg-violet-600 transition-colors"
                  >
                    {isChatLoading ? t('chat.typing') : t('chat.send')}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
