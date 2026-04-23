import { useCallback, useEffect, useRef } from 'react';

export interface NetworkRequest {
  id: string;
  timestamp: string;
  url: string;
  method: string;
  statusCode?: number;
  statusText?: string;
  bytesSent: number;
  bytesReceived: number;
  durationMs: number;
  host: string;
  path: string;
  port?: number;
  protocol: string;
  userAgent?: string;
  error?: string;
}

export interface NetworkMonitorOptions {
  enabled?: boolean;
  maxRequests?: number;
  onRequest?: (req: NetworkRequest) => void;
}

const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

const parseUrl = (urlStr: string): { host: string; path: string; port?: number; protocol: string } => {
  try {
    const url = new URL(urlStr);
    return {
      host: url.hostname,
      path: url.pathname + url.search,
      port: url.port ? parseInt(url.port, 10) : undefined,
      protocol: url.protocol.replace(':', ''),
    };
  } catch {
    return {
      host: 'unknown',
      path: urlStr,
      port: undefined,
      protocol: 'unknown',
    };
  }
};

export function useNetworkMonitor(): {
  requests: NetworkRequest[];
  clear: () => void;
  getRequestsByHost: () => Record<string, NetworkRequest[]>;
  getStats: () => {
    totalRequests: number;
    totalBytesSent: number;
    totalBytesReceived: number;
    uniqueHosts: number;
    avgDuration: number;
  };
} {
  const requestsRef = useRef<NetworkRequest[]>([]);
  const originalFetch = useRef<typeof fetch | null>(null);
  const originalXHR = useRef<typeof XMLHttpRequest | null>(null);

  useEffect(() => {
    originalFetch.current = window.fetch;

    const monitoredFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const urlStr = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as Request).url);
      const method = init?.method || (input instanceof Request ? input.method : 'GET') || 'GET';
      const startTime = performance.now();

      const parsed = parseUrl(urlStr);
      const requestId = generateId();

      let req: NetworkRequest = {
        id: requestId,
        timestamp: new Date().toISOString(),
        url: urlStr,
        method: method.toUpperCase(),
        bytesSent: 0,
        bytesReceived: 0,
        durationMs: 0,
        host: parsed.host,
        path: parsed.path,
        port: parsed.port,
        protocol: parsed.protocol,
        userAgent: navigator.userAgent,
      };

      try {
        if (init?.body) {
          req.bytesSent = typeof init.body === 'string' 
            ? init.body.length 
            : init.body instanceof Blob 
              ? init.body.size 
              : 0;
        }

        const response = await originalFetch.current!(input, init);
        const duration = performance.now() - startTime;

        const clone = response.clone();
        try {
          const blob = await clone.blob();
          req.bytesReceived = blob.size;
        } catch {
          req.bytesReceived = 0;
        }

        req.statusCode = response.status;
        req.statusText = response.statusText;
        req.durationMs = Math.round(duration);

        requestsRef.current.push(req);
        if (requestsRef.current.length > 500) {
          requestsRef.current = requestsRef.current.slice(-500);
        }

        return response;
      } catch (error) {
        const duration = performance.now() - startTime;
        req.durationMs = Math.round(duration);
        req.error = error instanceof Error ? error.message : 'Request failed';
        req.statusCode = 0;

        requestsRef.current.push(req);
        if (requestsRef.current.length > 500) {
          requestsRef.current = requestsRef.current.slice(-500);
        }

        throw error;
      }
    };

    (window as any).fetch = monitoredFetch;

    return () => {
      (window as any).fetch = originalFetch.current;
    };
  }, []);

  const clear = useCallback(() => {
    requestsRef.current = [];
  }, []);

  const getRequestsByHost = useCallback((): Record<string, NetworkRequest[]> => {
    const byHost: Record<string, NetworkRequest[]> = {};
    for (const req of requestsRef.current) {
      if (!byHost[req.host]) {
        byHost[req.host] = [];
      }
      byHost[req.host].push(req);
    }
    return byHost;
  }, []);

  const getStats = useCallback(() => {
    const requests = requestsRef.current;
    const totalBytesSent = requests.reduce((sum, r) => sum + r.bytesSent, 0);
    const totalBytesReceived = requests.reduce((sum, r) => sum + r.bytesReceived, 0);
    const uniqueHosts = new Set(requests.map(r => r.host)).size;
    const avgDuration = requests.length > 0
      ? requests.reduce((sum, r) => sum + r.durationMs, 0) / requests.length
      : 0;

    return {
      totalRequests: requests.length,
      totalBytesSent,
      totalBytesReceived,
      uniqueHosts,
      avgDuration: Math.round(avgDuration),
    };
  }, []);

  return {
    get requests() {
      return [...requestsRef.current];
    },
    clear,
    getRequestsByHost,
    getStats,
  };
}

export function createNetworkRequest(
  input: RequestInfo | URL,
  response: Response | { status: number; size: number },
  durationMs: number,
  method: string = 'GET'
): NetworkRequest {
  const urlStr = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as Request).url);
  const parsed = parseUrl(urlStr);

  return {
    id: generateId(),
    timestamp: new Date().toISOString(),
    url: urlStr,
    method: method.toUpperCase(),
    statusCode: 'status' in response ? response.status : undefined,
    bytesSent: 0,
    bytesReceived: 'size' in response ? response.size : 0,
    durationMs,
    host: parsed.host,
    path: parsed.path,
    port: parsed.port,
    protocol: parsed.protocol,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export const NETWORK_EVENT_KEY = 'dataguard_network_events';

export function saveNetworkEvents(events: NetworkRequest[]): void {
  try {
    const limited = events.slice(-500);
    localStorage.setItem(NETWORK_EVENT_KEY, JSON.stringify(limited));
  } catch {
    // Ignore storage errors
  }
}

export function loadNetworkEvents(): NetworkRequest[] {
  try {
    const raw = localStorage.getItem(NETWORK_EVENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}