export type TransferPayload = {
  fileName: string;
  fileContentBase64: string;
  mimeType?: string;
};

export type TransferOptions = {
  endpoint: string;
  apiKey?: string;
};

// Secure transfer for extracted reports over HTTPS.
// Note: browsers cannot do raw FTP securely; use HTTPS/FTPS gateway endpoint.
// Per requirement, this function intentionally does NOT persist transfer activity.
export async function transferReportSecurely(
  payload: TransferPayload,
  options: TransferOptions
): Promise<{ ok: boolean; status: number; message: string }> {
  const endpoint = options.endpoint.trim();
  if (!endpoint.startsWith('https://')) {
    throw new Error('يجب أن يكون النقل عبر HTTPS فقط.');
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
      'X-Transfer-Mode': 'FTP_OVER_HTTPS_GATEWAY',
    },
    body: JSON.stringify({
      fileName: payload.fileName,
      fileContentBase64: payload.fileContentBase64,
      mimeType: payload.mimeType ?? 'application/octet-stream',
      sentAt: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: 'فشل نقل التقرير عبر القناة الآمنة.',
    };
  }

  return {
    ok: true,
    status: res.status,
    message: 'تم نقل التقرير عبر HTTPS بنجاح.',
  };
}
