export type NotificationLevel = 'info' | 'warning' | 'error' | 'critical';
export type NotificationSource =
  | 'system'
  | 'file_scan'
  | 'email_monitor'
  | 'policy'
  | 'auth'
  | 'agent'
  | 'audit'
  | 'advanced-tool';

export type AppNotification = {
  id: string;
  createdAt: string; // ISO
  level: NotificationLevel;
  source: NotificationSource;
  title: string;
  message?: string;
  read: boolean;
  meta?: Record<string, unknown>;
};

const STORAGE_KEY = 'dataguard_notifications_v1';
const MAX_ITEMS = 100;
const CHANNEL_NAME = 'dataguard_notifications';

type Listener = (event: { type: 'added'; notification: AppNotification } | { type: 'cleared' } | { type: 'updated' }) => void;

let listeners: Set<Listener> | null = null;
let channel: BroadcastChannel | null = null;

function ensureGlobals() {
  if (!listeners) listeners = new Set();
  if (!channel && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (ev: MessageEvent<any>) => {
      if (!ev?.data?.type) return;
      // Only used to trigger refresh; payload is optional.
      emit(ev.data);
    };
  }
}

function emit(payload: any) {
  if (!listeners) return;
  for (const l of listeners) {
    try { l(payload); } catch { /* ignore */ }
  }
}

function broadcast(payload: any) {
  try { channel?.postMessage(payload); } catch { /* ignore */ }
}

function load(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as AppNotification[];
  } catch {
    return [];
  }
}

function save(items: AppNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
}

export function getNotificationsSnapshot(): { items: AppNotification[]; unreadCount: number } {
  const items = load().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const unreadCount = items.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);
  return { items, unreadCount };
}

export function subscribeNotifications(listener: Listener): () => void {
  ensureGlobals();
  listeners!.add(listener);
  return () => listeners!.delete(listener);
}

export function pushNotification(input: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & Partial<Pick<AppNotification, 'id' | 'createdAt' | 'read'>>): AppNotification {
  ensureGlobals();
  const n: AppNotification = {
    id: input.id ?? crypto.randomUUID(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    read: input.read ?? false,
    level: input.level,
    source: input.source,
    title: input.title,
    message: input.message,
    meta: input.meta,
  };
  const items = load();
  items.push(n);
  save(items);
  const payload = { type: 'added', notification: n };
  emit(payload);
  broadcast(payload);
  return n;
}

export function markNotificationRead(id: string, read: boolean = true): void {
  ensureGlobals();
  const items = load().map((n) => (n.id === id ? { ...n, read } : n));
  save(items);
  const payload = { type: 'updated' as const };
  emit(payload);
  broadcast(payload);
}

export function markAllNotificationsRead(): void {
  ensureGlobals();
  const items = load().map((n) => ({ ...n, read: true }));
  save(items);
  const payload = { type: 'updated' as const };
  emit(payload);
  broadcast(payload);
}

export function clearNotifications(): void {
  ensureGlobals();
  save([]);
  const payload = { type: 'cleared' as const };
  emit(payload);
  broadcast(payload);
}

export async function notifyToolActivation(
  toolId: string,
  enabled: boolean,
  source: 'ai' | 'local-rules' | 'fallback',
): Promise<void> {
  const toolNames: Record<string, string> = {
    siem: 'SIEM',
    edr: 'EDR',
    xdr: 'XDR',
    soar: 'SOAR',
    ndr: 'NDR',
  };

  const toolName = toolNames[toolId] || toolId.toUpperCase();
  const action = enabled ? 'مُفعَّل' : 'مُعطَّل';
  const sourceLabels: Record<string, string> = {
    ai: 'الذكاء الاصطناعي',
    'local-rules': 'القواعد المحلية',
    fallback: 'النظام',
  };

  pushNotification({
    level: enabled ? 'info' : 'warning',
    source: 'advanced-tool',
    title: `${toolName} ${action}`,
    message: `${sourceLabels[source]} - ${new Date().toLocaleTimeString('ar-SA')}`,
  });
}

