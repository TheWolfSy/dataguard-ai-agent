/**
 * إرسال تنبيه أمني إلى بريد محدد عند اكتشاف تهديد.
 * النوع: نوع التهديد (مثال: secret_leak, login_bruteforce, env_change, ...)
 * التفاصيل: نص أو كائن JSON يوضح تفاصيل الحادثة.
 */
export async function sendSecurityAlert(type: string, details: string | object): Promise<void> {
  if (!isConfigured()) throw new Error('خدمة البريد الإلكتروني غير مُهيأة.');
  const toEmail = import.meta.env.VITE_SECURITY_ALERT_EMAIL as string | undefined;
  if (!toEmail) throw new Error('لم يتم ضبط بريد التنبيهات الأمنية في متغيرات البيئة.');
  const now = new Date().toISOString();
  let detailsText = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
  try {
    await emailjs.send(
      SERVICE_ID!,
      TEMPLATE_ID!,
      {
        to_email: toEmail,
        app_name: 'DataGuard AI',
        verification_code: type.toUpperCase(),
        purpose_label_ar: `تنبيه أمني: ${type}`,
        purpose_label_en: `Security Alert: ${type}`,
        details: `وقت الحدث: ${now}\n\n${detailsText}`,
      },
      { publicKey: PUBLIC_KEY! }
    );
    console.log('[SecurityAlert] Email alert sent!');
  } catch (err) {
    console.error('[SecurityAlert] Failed to send alert:', err);
  }
}
/**
 * Email Sender Service — EmailJS Integration
 *
 * Sends transactional emails (verification codes, OTPs) via EmailJS directly
 * from the browser without requiring a backend server.
 *
 * Setup (one-time):
 *  1. Create a free account at https://www.emailjs.com
 *  2. Add an Email Service (Gmail, Outlook, etc.) → copy Service ID
 *  3. Create an Email Template with these variables:
 *       {{to_email}}          — recipient address
 *       {{app_name}}          — "DataGuard AI"
 *       {{verification_code}} — the 6-digit code
 *       {{purpose_label}}     — e.g. "تسجيل الحساب" / "استعادة الحساب"
 *     Copy Template ID
 *  4. From Account → API Keys → copy Public Key
 *  5. Add to your .env file:
 *       VITE_EMAILJS_SERVICE_ID=service_xxxxxxx
 *       VITE_EMAILJS_TEMPLATE_ID=template_xxxxxxx
 *       VITE_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxxxxxxx
 */

import emailjs from '@emailjs/browser';

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  as string | undefined;

function isConfigured(): boolean {
  return !!(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);
}

export type EmailPurpose =
  | 'registration'
  | 'email_recovery'
  | 'profile_verify';

const PURPOSE_LABELS: Record<EmailPurpose, { ar: string; en: string }> = {
  registration:    { ar: 'تسجيل الحساب',          en: 'Account Registration' },
  email_recovery:  { ar: 'استعادة كلمة المرور',   en: 'Password Recovery' },
  profile_verify:  { ar: 'توثيق البريد الإلكتروني', en: 'Email Verification' },
};

/**
 * Sends a 6-digit verification code to the specified email address.
 * Returns true on success. Throws if EmailJS is not configured or sending fails.
 */
export async function sendVerificationEmail(
  toEmail: string,
  code: string,
  purpose: EmailPurpose
): Promise<void> {
  if (!isConfigured()) {
    // In production this always throws — the app will show an error.
    // During development, log to console as last resort.
    if (import.meta.env.DEV) {
      console.warn(
        '[EmailSender] EmailJS not configured. Code NOT sent.\n' +
        'Add VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY to .env'
      );
      // Throw even in dev so the UI shows a configuration error.
    }
    throw new Error(
      'خدمة البريد الإلكتروني غير مُهيأة. ' +
      'يرجى إضافة مفاتيح EmailJS في ملف .env ' +
      '(VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY).'
    );
  }

  const label = PURPOSE_LABELS[purpose];

  console.log('[EmailSender] Sending email...', {
    serviceId: SERVICE_ID,
    templateId: TEMPLATE_ID,
    publicKeyLength: PUBLIC_KEY?.length,
    toEmail,
    purpose,
  });

  try {
    await emailjs.send(
      SERVICE_ID!,
      TEMPLATE_ID!,
      {
        to_email:          toEmail,
        app_name:          'DataGuard AI',
        verification_code: code,
        purpose_label_ar:  label.ar,
        purpose_label_en:  label.en,
      },
      { publicKey: PUBLIC_KEY! }
    );
    console.log('[EmailSender] Email sent successfully!');
  } catch (emailError: any) {
    console.error('[EmailSender] EmailJS error:', emailError);
    throw new Error(
      `فشل إرسال البريد: ${emailError?.text || emailError?.message || JSON.stringify(emailError)}`
    );
  }
}
