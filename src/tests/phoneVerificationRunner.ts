
// تم إلغاء جميع اختبارات التحقق عبر الهاتف في هذا المشروع.
// جميع الدوال أدناه رمزية فقط.

/**
 * إرسال OTP للهاتف (ملغاة)
 */
export async function sendPhoneOtpMock() {
  console.warn('تم إلغاء ميزة إرسال OTP للهاتف في هذا النظام.');
  return false;
}

/**
 * تأكيد رمز OTP (ملغاة)
 */
export async function confirmReceivedOtpMock(otpCode: string) {
  console.warn('تم إلغاء ميزة تأكيد OTP للهاتف في هذا النظام.');
  return false;
}

// Backwards-compatible exports used by src/main.tsx
export async function runPhoneVerificationAttempts() {
  return await sendPhoneOtpMock();
}

export async function confirmReceivedOtp(otpCode: string) {
  return await confirmReceivedOtpMock(otpCode);
}
