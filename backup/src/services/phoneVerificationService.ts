// تمت إزالة جميع وظائف التحقق من رقم الهاتف حفاظاً على الخصوصية

/**
 * Format a phone number to E.164 format.
 * Handles common Egyptian and international formats.
 */
export function formatPhoneE164(phone: string, defaultCountryCode = '+20'): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Already in E.164 format
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Starts with 00 (international prefix)
  if (cleaned.startsWith('00')) {
    return '+' + cleaned.slice(2);
  }

  // Starts with 0 (local number, add country code)
  if (cleaned.startsWith('0')) {
    return defaultCountryCode + cleaned.slice(1);
  }

  // No prefix — add country code
  return defaultCountryCode + cleaned;
}
