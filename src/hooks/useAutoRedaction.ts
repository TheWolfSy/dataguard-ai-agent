import { useState, useEffect } from 'react';

const STORAGE_KEY = 'dataguard.autoRedaction';

function getStored(): boolean {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s === 'true';
  } catch { return false; }
}

export function useAutoRedaction() {
  const [autoRedaction, setAutoRedaction] = useState<boolean>(getStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(autoRedaction));
    } catch { /* ignore */ }
  }, [autoRedaction]);

  const toggleAutoRedaction = () => setAutoRedaction((prev) => !prev);

  return { autoRedaction, toggleAutoRedaction };
}