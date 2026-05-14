export function parseDevBypassEmails(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isDevBypassEmail(emailRaw: string): boolean {
  // Important: bypass is ONLY allowed in local development.
  if (!import.meta.env.DEV) return false;

  const email = (emailRaw ?? '').trim().toLowerCase();
  if (!email) return false;

  const single = String(import.meta.env.VITE_DEV_BYPASS_EMAIL ?? '').trim().toLowerCase();
  const list = parseDevBypassEmails(import.meta.env.VITE_DEV_BYPASS_EMAILS);

  return (single && email === single) || (list.length > 0 && list.includes(email));
}

export function getDevBypassPassword(): string {
  if (!import.meta.env.DEV) return '';
  return String(import.meta.env.VITE_DEV_BYPASS_PASSWORD ?? '');
}

