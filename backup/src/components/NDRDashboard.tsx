import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, AlertTriangle, Shield, Network, Globe, Server,
  Clock, Trash2, RefreshCw, CheckCircle, XCircle, Info,
  ArrowUpRight, ArrowDownLeft, Wifi, Ban, ChevronRight,
} from 'lucide-react';
import { Card } from './ui/Card';

interface NDRAlert {
  alert_id: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  source_ip: string;
  dest_ip: string;
  acknowledged: boolean;
}

interface NDRStats {
  total_flows: number;
  total_bytes_sent: number;
  total_bytes_received: number;
  unique_destinations: number;
  unique_ports: number;
  alerts_by_category: Record<string, number>;
}

interface NetworkFlow {
  flow_id: string;
  timestamp: string;
  src_ip: string;
  dst_ip: string;
  dst_port: number;
  protocol: string;
  bytes_sent: number;
  bytes_received: number;
  host?: string;
}

interface TopDestination {
  ip: string;
  flows: number;
  bytes: number;
  ports: number;
}

interface NDRDashboardProps {
  t: (key: string) => string;
  dir: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return timestamp;
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<any>;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: color + '20' }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div>
          <div className="text-slate-400 text-xs">{label}</div>
          <div className="text-white text-lg font-semibold">{value}</div>
        </div>
      </div>
    </div>
  );
}

function AlertItem({ alert, onAck }: { alert: NDRAlert; onAck?: () => void }) {
  const color = SEVERITY_COLORS[alert.severity] || '#22c55e';

  return (
    <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30 hover:border-slate-600/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {alert.severity === 'critical' || alert.severity === 'high' ? (
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color }} />
          ) : (
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color }} />
          )}
          <div>
            <div className="text-white text-sm font-medium">{alert.title}</div>
            <div className="text-slate-400 text-xs mt-0.5">{alert.description}</div>
            <div className="text-slate-500 text-xs mt-1">
              {alert.source_ip} → {alert.dest_ip}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: color + '20', color }}
          >
            {alert.severity}
          </span>
          <span className="text-slate-500 text-xs">{formatTime(alert.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

function FlowItem({ flow }: { flow: NetworkFlow }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-slate-800/30 rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center">
          <Globe className="w-4 h-4 text-slate-400" />
        </div>
        <div>
          <div className="text-white text-sm">{flow.host || flow.dst_ip}</div>
          <div className="text-slate-500 text-xs">
            {flow.dst_port} • {flow.protocol}
          </div>
        </div>
      </div>
      <div className="text-left">
        <div className="text-white text-sm">{formatBytes(flow.bytes_sent)}</div>
        <div className="text-slate-500 text-xs flex items-center gap-1">
          <ArrowUpRight className="w-3 h-3" />
          {formatBytes(flow.bytes_received)}
        </div>
      </div>
    </div>
  );
}

export function NDRDashboard({ t, dir }: NDRDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'flows' | 'destinations' | 'analysis'>('overview');
  const [alerts, setAlerts] = useState<NDRAlert[]>([]);
  const [stats, setStats] = useState<NDRStats | null>(null);
  const [flows, setFlows] = useState<NetworkFlow[]>([]);
  const [destinations, setDestinations] = useState<TopDestination[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { getNDRAlerts, getNDRStats, getRecentFlows, getTopDestinations } = await import('../services/ndrService');
      
      const [alertsData, statsData, flowsData, destsData] = await Promise.all([
        getNDRAlerts(20),
        getNDRStats(),
        getRecentFlows(15),
        getTopDestinations(10),
      ]);
      
      setAlerts(alertsData);
      setStats(statsData);
      setFlows(flowsData);
      setDestinations(destsData);
    } catch (err) {
      console.error('NDR load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleClear = useCallback(async () => {
    try {
      const { clearNDRData } = await import('../services/ndrService');
      await clearNDRData();
      await loadData();
    } catch (err) {
      console.error('Clear error:', err);
    }
  }, [loadData]);

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const highCount = alerts.filter(a => a.severity === 'high').length;
  const mediumCount = alerts.filter(a => a.severity === 'medium').length;
  const lowCount = alerts.filter(a => a.severity === 'low').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-rose-400" />
          <h2 className="text-lg font-semibold text-white">{t('advancedTools.ndr')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleClear}
            className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'overview', label: t('dashboard.overview') || 'Overview' },
          { key: 'flows', label: 'Flows' },
          { key: 'destinations', label: t('ndr.destinations') || 'Destinations' },
          { key: 'analysis', label: t('ndr.analysis') || 'Analysis' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              icon={Activity}
              label={t('ndr.totalFlows') || 'Total Flows'}
              value={stats?.total_flows || 0}
              color="#38bdf8"
            />
            <StatCard
              icon={ArrowUpRight}
              label={t('ndr.sent') || 'Sent'}
              value={formatBytes(stats?.total_bytes_sent || 0)}
              color="#f97316"
            />
            <StatCard
              icon={ArrowDownLeft}
              label={t('ndr.received') || 'Received'}
              value={formatBytes(stats?.total_bytes_received || 0)}
              color="#22c55e"
            />
            <StatCard
              icon={Globe}
              label={t('ndr.destinations') || 'Destinations'}
              value={stats?.unique_destinations || 0}
              color="#a78bfa"
            />
            <StatCard
              icon={Server}
              label={t('ndr.ports') || 'Ports'}
              value={stats?.unique_ports || 0}
              color="#f43f5e"
            />
            <StatCard
              icon={AlertTriangle}
              label={t('ndr.alerts') || 'Alerts'}
              value={alerts.length}
              color="#eab308"
            />
          </div>

          {criticalCount > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                <span className="text-red-400 font-medium">
                  {criticalCount} {t('ndr.criticalAlerts') || 'Critical Alerts'}
                </span>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  {t('ndr.recentAlerts') || 'Recent Alerts'}
                </h3>
              </div>
              <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                {alerts.length === 0 ? (
                  <div className="text-slate-500 text-center py-8">
                    <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>{t('ndr.noAlerts') || 'No alerts detected'}</p>
                  </div>
                ) : (
                  alerts.slice(0, 10).map(alert => (
                    <AlertItem key={alert.alert_id} alert={alert} />
                  ))
                )}
              </div>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <Activity className="w-4 h-4 text-sky-400" />
                  {t('ndr.recentFlows') || 'Recent Flows'}
                </h3>
              </div>
              <div className="p-3 space-y-1 max-h-80 overflow-y-auto">
                {flows.length === 0 ? (
                  <div className="text-slate-500 text-center py-8">
                    <Network className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>{t('ndr.noFlows') || 'No network flows recorded'}</p>
                  </div>
                ) : (
                  flows.slice(0, 10).map(flow => (
                    <FlowItem key={flow.flow_id} flow={flow} />
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'flows' && (
        <Card className="bg-slate-900/50 border-slate-800">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-white font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              {t('ndr.networkFlows') || 'Network Flows'}
            </h3>
          </div>
          <div className="divide-y divide-slate-800">
            {flows.length === 0 ? (
              <div className="text-slate-500 text-center py-12">
                <Network className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t('ndr.noFlows') || 'No flows recorded yet'}</p>
              </div>
            ) : (
              flows.map(flow => (
                <FlowItem key={flow.flow_id} flow={flow} />
              ))
            )}
          </div>
        </Card>
      )}

      {activeTab === 'destinations' && (
        <Card className="bg-slate-900/50 border-slate-800">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-white font-medium flex items-center gap-2">
              <Globe className="w-4 h-4 text-violet-400" />
              {t('ndr.topDestinations') || 'Top Destinations'}
            </h3>
          </div>
          <div className="divide-y divide-slate-800">
            {destinations.length === 0 ? (
              <div className="text-slate-500 text-center py-12">
                <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t('ndr.noDestinations') || 'No destinations recorded'}</p>
              </div>
            ) : (
              destinations.map((dest, idx) => (
                <div
                  key={dest.ip}
                  className="flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-slate-500 w-6 text-center">{idx + 1}</span>
                    <Globe className="w-5 h-5 text-slate-500" />
                    <div>
                      <div className="text-white font-mono text-sm">{dest.ip}</div>
                      <div className="text-slate-500 text-xs">
                        {dest.flows} flows • {dest.ports} ports
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white">{formatBytes(dest.bytes)}</div>
                    <div className="text-slate-500 text-xs">{t('ndr.totalSent') || 'total sent'}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {activeTab === 'analysis' && (
        <div className="space-y-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                {t('ndr.threatSummary') || 'Threat Summary'}
              </h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 bg-red-500/10 rounded-lg">
                  <div className="text-3xl font-bold text-red-400">{criticalCount}</div>
                  <div className="text-slate-400 text-sm mt-1">Critical</div>
                </div>
                <div className="text-center p-4 bg-orange-500/10 rounded-lg">
                  <div className="text-3xl font-bold text-orange-400">{highCount}</div>
                  <div className="text-slate-400 text-sm mt-1">High</div>
                </div>
                <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
                  <div className="text-3xl font-bold text-yellow-400">{mediumCount}</div>
                  <div className="text-slate-400 text-sm mt-1">Medium</div>
                </div>
                <div className="text-center p-4 bg-green-500/10 rounded-lg">
                  <div className="text-3xl font-bold text-green-400">{lowCount}</div>
                  <div className="text-slate-400 text-sm mt-1">Low</div>
                </div>
              </div>
            </div>
          </Card>

          {stats?.alerts_by_category && Object.keys(stats.alerts_by_category).length > 0 && (
            <Card className="bg-slate-900/50 border-slate-800">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-white font-medium">
                  {t('ndr.alertsByCategory') || 'Alerts by Category'}
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {Object.entries(stats.alerts_by_category).map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between">
                    <span className="text-slate-300 capitalize">{category}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500"
                          style={{
                            width: `${(count / alerts.length) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-white w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}