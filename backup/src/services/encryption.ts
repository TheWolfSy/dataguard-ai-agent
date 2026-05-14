import CryptoJS from 'crypto-js';
import type { ToolResult } from './toolContract';

// يجب ضبط مفتاح التشفير عبر متغير بيئة فقط ولا يسمح بمفتاح افتراضي في الإنتاج
const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  throw new Error('مفتاح التشفير غير مضبوط أو ضعيف. يجب ضبط DATA_ENCRYPTION_KEY في متغيرات البيئة (32 محرف أو أكثر)');
}

export function encryptData(text: string): string {
  try {
    return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error('Encryption failed', error);
    return text;
  }
}

export function decryptData(ciphertext: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    if (!originalText) throw new Error('Decryption resulted in empty string');
    return originalText;
  } catch (error) {
    console.error('Decryption failed', error);
    return '[ENCRYPTED DATA - DECRYPTION FAILED]';
  }
}

export interface EncryptionOutput {
  encryptedText: string;
  algorithm: 'AES-256';
  ciphertextLength: number;
}

export function runEncryptionTool(text: string): ToolResult<EncryptionOutput> {
  try {
    const encryptedText = encryptData(text);
    if (!encryptedText || encryptedText === text) {
      return {
        success: 'failure',
        output: {
          encryptedText: text,
          algorithm: 'AES-256',
          ciphertextLength: text.length,
        },
        riskLevel: 'high',
        nextSuggestions: [
          'Do not persist raw content until encryption succeeds.',
          'Verify encryption key configuration and retry.',
        ],
        error: 'Encryption output is invalid or unchanged.',
      };
    }

    return {
      success: 'success',
      output: {
        encryptedText,
        algorithm: 'AES-256',
        ciphertextLength: encryptedText.length,
      },
      riskLevel: 'low',
      nextSuggestions: ['Persist encrypted payload in storage.', 'Record audit event for secure write.'],
    };
  } catch (error) {
    return {
      success: 'failure',
      output: {
        encryptedText: text,
        algorithm: 'AES-256',
        ciphertextLength: text.length,
      },
      riskLevel: 'critical',
      nextSuggestions: ['Block data persistence.', 'Escalate encryption failure to operator.'],
      error: error instanceof Error ? error.message : 'Unknown encryption error',
    };
  }
}
