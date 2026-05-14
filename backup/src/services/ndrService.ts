import { getToolState } from './advancedToolsService';
import type { NetworkRequest } from './networkMonitor';

export interface NDRAlert {
  alert_id: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  source_ip: string;
  dest_ip: string;
  details: Record<string, unknown>;
  acknowledged: boolean;
}

export interface NDRStats {
  total_flows: number;
  total_bytes_sent: number;
  total_bytes_received: number;
  unique_destinations: number;
  unique_ports: number;
  alerts_by_category: Record<string, number>;
}

export interface NetworkFlow {
  flow_id: string;
  timestamp: string;
  src_ip: string;
  dst_ip: string;
  src_port: number;
  dst_port: number;
  protocol: string;
  bytes_sent: number;
  bytes_received: number;
  duration_ms: number;
  status_code?: number;
  user_agent?: string;
  host?: string;
  path?: string;
  method?: string;
}

const NDR_EVENTS_KEY = 'dataguard_ndr_events';
const NDR_ALERTS_KEY = 'dataguard_ndr_alerts';
const NDR_FLOWS_KEY = 'dataguard_ndr_flows';
const MAX_FLOWS = 500;
const MAX_ALERTS = 100;

export async function checkNDREnabled(): Promise<boolean> {
  try {
    return await getToolState('ndr');
  } catch {
    return false;
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

function getLocalIP(): string {
  return '127.0.0.1';
}

function convertRequestToFlow(req: NetworkRequest): NetworkFlow {
  return {
    flow_id: req.id,
    timestamp: req.timestamp,
    src_ip: getLocalIP(),
    dst_ip: req.host || 'unknown',
    src_port: 0,
    dst_port: req.port || (req.protocol === 'https' ? 443 : 80),
    protocol: req.protocol.toUpperCase(),
    bytes_sent: req.bytesSent,
    bytes_received: req.bytesReceived,
    duration_ms: req.durationMs,
    status_code: req.statusCode,
    user_agent: req.userAgent,
    host: req.host,
    path: req.path,
    method: req.method,
  };
}

const SUSPICIOUS_PORTS = [4444, 5555, 6667, 8080, 3128, 1080];
const SUSPICIOUS_IPS = [
  '185.141.25.68', '92.63.197.153', '45.33.32.156',
  '104.211.55.0', '192.99.144.0', '91.92.109.43'
];

function analyzeFlow(flow: NetworkFlow): NDRAlert[] {
  const alerts: NDRAlert[] = [];
  const now = new Date().toISOString();

  if (flow.bytes_sent > 1_000_000) {
    alerts.push({
      alert_id: generateId(),
      timestamp: now,
      severity: 'high',
      category: 'exfiltration',
      title: 'Large Data Exfiltration',
      description: `Large outbound data transfer: ${flow.bytes_sent} bytes to ${flow.host || flow.dst_ip}`,
      source_ip: flow.src_ip,
      dest_ip: flow.dst_ip,
      details: { flow_id: flow.flow_id, bytes: flow.bytes_sent },
      acknowledged: false,
    });
  }

  if (flow.dst_port && SUSPICIOUS_PORTS.includes(flow.dst_port)) {
    alerts.push({
      alert_id: generateId(),
      timestamp: now,
      severity: 'high',
      category: 'suspicious_port',
      title: 'Suspicious Port Access',
      description: `Connection to suspicious port ${flow.dst_port}`,
      source_ip: flow.src_ip,
      dest_ip: flow.dst_ip,
      details: { flow_id: flow.flow_id, port: flow.dst_port },
      acknowledged: false,
    });
  }

  if (SUSPICIOUS_IPS.includes(flow.dst_ip)) {
    alerts.push({
      alert_id: generateId(),
      timestamp: now,
      severity: 'critical',
      category: 'malicious_ip',
      title: 'Known Malicious IP',
      description: `Connection to known malicious IP: ${flow.dst_ip}`,
      source_ip: flow.src_ip,
      dest_ip: flow.dst_ip,
      details: { flow_id: flow.flow_id },
      acknowledged: false,
    });
  }

  if (flow.duration_ms < 100 && flow.bytes_sent < 100 && flow.bytes_received < 100) {
    alerts.push({
      alert_id: generateId(),
      timestamp: now,
      severity: 'medium',
      category: 'reconnaissance',
      title: 'Rapid Connection Pattern',
      description: `Rapid connection to ${flow.host || flow.dst_ip} with minimal data transfer`,
      source_ip: flow.src_ip,
      dest_ip: flow.dst_ip,
      details: { flow_id: flow.flow_id, duration_ms: flow.duration_ms },
      acknowledged: false,
    });
  }

  if (flow.status_code && flow.status_code >= 400) {
    alerts.push({
      alert_id: generateId(),
      timestamp: now,
      severity: 'low',
      category: 'errors',
      title: 'Error Response',
      description: `HTTP ${flow.status_code} from ${flow.host || flow.dst_ip}`,
      source_ip: flow.src_ip,
      dest_ip: flow.dst_ip,
      details: { flow_id: flow.flow_id, status: flow.status_code },
      acknowledged: false,
    });
  }

  return alerts;
}

export async function processNetworkRequest(req: NetworkRequest): Promise<NDRAlert[]> {
  if (!await checkNDREnabled()) return [];

  const flow = convertRequestToFlow(req);
  const alerts = analyzeFlow(flow);

  if (alerts.length > 0) {
    const flows = loadFlows();
    flows.push(flow);
    saveFlows(flows);

    const existingAlerts = loadAlerts();
    const newAlerts = [...existingAlerts, ...alerts];
    saveAlerts(newAlerts);

    console.log('[NDR] Processed flow:', flow.flow_id, 'Alerts:', alerts.length);
  }

  return alerts;
}

export async function processNetworkRequests(requests: NetworkRequest[]): Promise<NDRAlert[]> {
  if (!await checkNDREnabled()) return [];

  const allAlerts: NDRAlert[] = [];
  const flows: NetworkFlow[] = [];

  for (const req of requests) {
    const flow = convertRequestToFlow(req);
    flows.push(flow);
    const alerts = analyzeFlow(flow);
    allAlerts.push(...alerts);
  }

  if (flows.length > 0) {
    const existingFlows = loadFlows();
    saveFlows([...existingFlows, ...flows].slice(-MAX_FLOWS));
  }

  if (allAlerts.length > 0) {
    const existingAlerts = loadAlerts();
    saveAlerts([...existingAlerts, ...allAlerts].slice(-MAX_ALERTS));
  }

  return allAlerts;
}

function loadFlows(): NetworkFlow[] {
  try {
    const raw = localStorage.getItem(NDR_FLOWS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveFlows(flows: NetworkFlow[]): void {
  try {
    localStorage.setItem(NDR_FLOWS_KEY, JSON.stringify(flows.slice(-MAX_FLOWS)));
  } catch {
    // Ignore
  }
}

function loadAlerts(): NDRAlert[] {
  try {
    const raw = localStorage.getItem(NDR_ALERTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveAlerts(alerts: NDRAlert[]): void {
  try {
    localStorage.setItem(NDR_ALERTS_KEY, JSON.stringify(alerts.slice(-MAX_ALERTS)));
  } catch {
    // Ignore
  }
}

export async function getNDRAlerts(limit = 50): Promise<NDRAlert[]> {
  const alerts = loadAlerts();
  return alerts.slice(0, limit).reverse();
}

export async function getNDRStats(): Promise<NDRStats> {
  const flows = loadFlows();
  const alerts = loadAlerts();

  const totalBytesSent = flows.reduce((sum, f) => sum + f.bytes_sent, 0);
  const totalBytesReceived = flows.reduce((sum, f) => sum + f.bytes_received, 0);
  const uniqueDestinations = new Set(flows.map(f => f.dst_ip)).size;
  const uniquePorts = new Set(flows.map(f => f.dst_port)).size;

  const alertsByCategory: Record<string, number> = {};
  for (const alert of alerts) {
    alertsByCategory[alert.category] = (alertsByCategory[alert.category] || 0) + 1;
  }

  return {
    total_flows: flows.length,
    total_bytes_sent: totalBytesSent,
    total_bytes_received: totalBytesReceived,
    unique_destinations: uniqueDestinations,
    unique_ports: uniquePorts,
    alerts_by_category: alertsByCategory,
  };
}

export async function getRecentFlows(limit = 20): Promise<NetworkFlow[]> {
  const flows = loadFlows();
  return flows.slice(0, limit).reverse();
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  const alerts = loadAlerts();
  const updated = alerts.map(a => 
    a.alert_id === alertId ? { ...a, acknowledged: true } : a
  );
  saveAlerts(updated);
}

export async function clearNDRData(): Promise<void> {
  localStorage.removeItem(NDR_FLOWS_KEY);
  localStorage.removeItem(NDR_ALERTS_KEY);
}

export async function getTopDestinations(limit = 10): Promise<Array<{
  ip: string;
  flows: number;
  bytes: number;
  ports: number;
}>> {
  const flows = loadFlows();

  const byIP: Record<string, { flows: number; bytes: number; ports: Set<number> }> = {};
  
  for (const flow of flows) {
    if (!byIP[flow.dst_ip]) {
      byIP[flow.dst_ip] = { flows: 0, bytes: 0, ports: new Set() };
    }
    byIP[flow.dst_ip].flows++;
    byIP[flow.dst_ip].bytes += flow.bytes_sent;
    byIP[flow.dst_ip].ports.add(flow.dst_port);
  }

  const sorted = Object.entries(byIP)
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .slice(0, limit);

  return sorted.map(([ip, data]) => ({
    ip,
    flows: data.flows,
    bytes: data.bytes,
    ports: data.ports.size,
  }));
}