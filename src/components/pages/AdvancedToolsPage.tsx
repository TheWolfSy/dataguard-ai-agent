import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Radar, Network, Workflow, Activity, Power, PowerOff, Zap, FileCode, Bot, Search, Code, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { NDRDashboard } from '../NDRDashboard';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';
import { initAdvancedTools, getAllToolsState, activateTool, type AdvancedToolId, type ToolActivationResult } from '../../services/advancedToolsService';
import { runCveScanTool, type CveMatch } from '../../services/securityScanner';

type TFunc = (key: string) => string;

interface ToolCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: 'sky' | 'emerald' | 'amber' | 'violet' | 'rose';
  toolId: AdvancedToolId;
  isEnabled: boolean;
  isLoading: boolean;
  lastResult?: ToolActivationResult;
  onToggle: (id: AdvancedToolId, enabled: boolean) => void;
}

function ToolCard({
  title,
  subtitle,
  icon,
  accent,
  toolId,
  isEnabled,
  isLoading,
  lastResult,
  onToggle,
}: ToolCardProps) {
  const accents: Record<typeof accent, { border: string; glow: string; text: string }> = {
    sky: { border: 'rgba(96,165,250,0.28)', glow: 'rgba(96,165,250,0.18)', text: '#93c5fd' },
    emerald: { border: 'rgba(52,211,153,0.28)', glow: 'rgba(52,211,153,0.18)', text: '#6ee7b7' },
    amber: { border: 'rgba(251,191,36,0.30)', glow: 'rgba(251,191,36,0.18)', text: '#fcd34d' },
    violet: { border: 'rgba(167,139,250,0.30)', glow: 'rgba(167,139,250,0.18)', text: '#c4b5fd' },
    rose: { border: 'rgba(244,63,94,0.30)', glow: 'rgba(244,63,94,0.18)', text: '#fda4af' },
  };
  const a = accents[accent];

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'ai':
        return <Bot className="w-3 h-3" />;
      case 'local-rules':
        return <FileCode className="w-3 h-3" />;
      default:
        return <Zap className="w-3 h-3" />;
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'ai':
        return 'AI';
      case 'local-rules':
        return 'القواعد';
      default:
        return 'النظام';
    }
  };

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cn('rounded-2xl p-4 border transition-all')}
      style={{
        background: 'rgba(10,20,45,0.65)',
        borderColor: a.border,
        boxShadow: `0 18px 50px rgba(0,0,0,0.45), 0 0 0 1px ${a.glow}`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center border"
          style={{ background: 'rgba(6,13,31,0.65)', borderColor: a.border, color: a.text }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-black tracking-tight text-white truncate">{title}</h3>
            <button
              onClick={() => onToggle(toolId, !isEnabled)}
              disabled={isLoading}
              className="flex items-center gap-1 px-2 py-1 rounded-full border transition-all disabled:opacity-50"
              style={{ 
                color: isEnabled ? '#6ee7b7' : '#fda4af',
                borderColor: isEnabled ? 'rgba(52,211,153,0.5)' : 'rgba(244,63,94,0.5)',
                background: isEnabled ? 'rgba(52,211,153,0.15)' : 'rgba(244,63,94,0.15)'
              }}
            >
              {isLoading ? (
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isEnabled ? (
                <Power className="w-3 h-3" />
              ) : (
                <PowerOff className="w-3 h-3" />
              )}
              <span className="text-[10px] font-mono uppercase">{isEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: '#94a3b8' }}>
            {subtitle}
          </p>
          {lastResult && (
            <div className="mt-2 flex items-center gap-2 text-[10px]">
              <span
                className="flex items-center gap-1 px-1.5 py-0.5 rounded"
                style={{
                  color: a.text,
                  background: a.glow,
                  border: `1px solid ${a.border}`,
                }}
              >
                {getSourceIcon(lastResult.source)}
                {getSourceLabel(lastResult.source)}
              </span>
              <span style={{ color: 'var(--text-muted)' }} className="truncate">
                {lastResult.message}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function AdvancedToolsPage({ t, dir }: { t: TFunc; dir: string }) {
  const [toolStates, setToolStates] = useState<Record<AdvancedToolId, boolean>>({
    siem: false,
    edr: false,
    xdr: false,
    soar: false,
    ndr: false,
    'cve-scanner': false,
  });
  const [loadingTool, setLoadingTool] = useState<AdvancedToolId | null>(null);
  const [lastResults, setLastResults] = useState<Record<AdvancedToolId, ToolActivationResult | undefined>>({} as any);
  const [showNDRDashboard, setShowNDRDashboard] = useState(false);
  
  const [cveCodeInput, setCveCodeInput] = useState('');
  const [isCveScanning, setIsCveScanning] = useState(false);
  const [cveResults, setCveResults] = useState<CveMatch[]>([]);
  const [cveScanComplete, setCveScanComplete] = useState(false);
  const [cveKeywordsFound, setCveKeywordsFound] = useState<string[]>([]);

  useEffect(() => {
    initAdvancedTools().then(() => {
      getAllToolsState().then(setToolStates);
    });
  }, []);

  const handleToggle = async (toolId: AdvancedToolId, enabled: boolean) => {
    setLoadingTool(toolId);
    try {
      const result = await activateTool(toolId, enabled);
      setToolStates((prev) => ({ ...prev, [toolId]: enabled }));
      setLastResults((prev) => ({ ...prev, [toolId]: result }));
    } catch (err) {
      console.error('Tool activation failed:', err);
    } finally {
      setLoadingTool(null);
    }
  };

  const handleCveScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cveCodeInput.trim()) return;
    
    setIsCveScanning(true);
    setCveScanComplete(false);
    
    try {
      const result = await runCveScanTool(cveCodeInput);
      setCveResults(result.output.vulnerabilities);
      setCveKeywordsFound(result.output.keywordsFound);
      setCveScanComplete(true);
      setLastResults((prev) => ({ 
        ...prev, 
        'cve-scanner': {
          success: result.success === 'success',
          source: result.riskLevel === 'critical' || result.riskLevel === 'high' ? 'local-rules' : 'fallback',
          message: result.output.hasVulnerabilities 
            ? `Found ${result.output.vulnerabilities.length} vulnerability matches` 
            : 'No vulnerabilities detected',
        }
      }));
    } catch (err) {
      console.error('CVE scan failed:', err);
    } finally {
      setIsCveScanning(false);
    }
  };

  return (
    <motion.div
      key="advanced-tools"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 max-w-5xl"
      dir={dir as any}
    >
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-white">{t('advancedTools.title')}</h2>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('advancedTools.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ToolCard
          title="SIEM"
          subtitle={t('advancedTools.siem')}
          icon={<ShieldAlert className="w-5 h-5" />}
          accent="sky"
          toolId="siem"
          isEnabled={toolStates.siem}
          isLoading={loadingTool === 'siem'}
          lastResult={lastResults.siem}
          onToggle={handleToggle}
        />
        <ToolCard
          title="EDR"
          subtitle={t('advancedTools.edr')}
          icon={<Activity className="w-5 h-5" />}
          accent="emerald"
          toolId="edr"
          isEnabled={toolStates.edr}
          isLoading={loadingTool === 'edr'}
          lastResult={lastResults.edr}
          onToggle={handleToggle}
        />
        <ToolCard
          title="XDR"
          subtitle={t('advancedTools.xdr')}
          icon={<Radar className="w-5 h-5" />}
          accent="violet"
          toolId="xdr"
          isEnabled={toolStates.xdr}
          isLoading={loadingTool === 'xdr'}
          lastResult={lastResults.xdr}
          onToggle={handleToggle}
        />
        <ToolCard
          title="SOAR"
          subtitle={t('advancedTools.soar')}
          icon={<Workflow className="w-5 h-5" />}
          accent="amber"
          toolId="soar"
          isEnabled={toolStates.soar}
          isLoading={loadingTool === 'soar'}
          lastResult={lastResults.soar}
          onToggle={handleToggle}
        />
        <ToolCard
          title="NDR"
          subtitle={t('advancedTools.ndr')}
          icon={<Network className="w-5 h-5" />}
          accent="rose"
          toolId="ndr"
          isEnabled={toolStates.ndr}
          isLoading={loadingTool === 'ndr'}
          lastResult={lastResults.ndr}
          onToggle={(id, enabled) => {
            handleToggle(id, enabled);
            if (enabled) {
              setTimeout(() => setShowNDRDashboard(true), 500);
            }
          }}
        />
        <ToolCard
          title="CVE Scanner"
          subtitle={t('cveScanner.subtitle')}
          icon={<Code className="w-5 h-5" />}
          accent="emerald"
          toolId="cve-scanner"
          isEnabled={toolStates['cve-scanner']}
          isLoading={loadingTool === 'cve-scanner'}
          lastResult={lastResults['cve-scanner']}
          onToggle={handleToggle}
        />
      </div>

      {toolStates['cve-scanner'] && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 space-y-4"
        >
          <Card className="p-6" style={{ borderColor: 'rgba(52,211,153,0.28)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Code className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold uppercase tracking-tight">{t('cveScanner.title')}</h3>
            </div>
            
            <form onSubmit={handleCveScan} className="space-y-4">
<div className="relative">
                <textarea
                  value={cveCodeInput}
                  onChange={(e) => setCveCodeInput(e.target.value)}
                  placeholder={t('cveScanner.placeholder')}
                  className="w-full h-40 rounded-lg p-4 text-sm font-mono placeholder:text-slate-500 focus:ring-2 focus:border-transparent outline-none transition-all resize-none text-slate-200"
                  style={{ background: 'rgba(6,13,31,0.7)', border: '1px solid rgba(52,211,153,0.25)', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.2)' }}
                  dir="ltr"
                />
              </div>
              
              <motion.button
                type="submit"
                disabled={isCveScanning || !cveCodeInput.trim()}
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.99 }}
                className="w-full py-3 rounded-lg font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all duration-200 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                style={isCveScanning
                  ? { background: 'rgba(10,20,45,0.5)', border: '1px solid rgba(52,211,153,0.1)' }
                  : { background: 'linear-gradient(135deg, #34d399, #34d399cc)', boxShadow: '0 4px 20px rgba(52,211,153,0.25)' }}
              >
                {isCveScanning
                  ? <><Activity className="w-4 h-4 animate-spin" />{t('cveScanner.scanning')}</>
                  : <><Search className="w-4 h-4" />{t('cveScanner.scanButton')}</>}
              </motion.button>
            </form>
            
            {cveScanComplete && (
              <div className="mt-6 space-y-4">
                {cveKeywordsFound.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {cveKeywordsFound.map((kw) => (
                      <Badge key={kw} variant="warning">{kw}</Badge>
                    ))}
                  </div>
                )}
                
                {cveResults.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      {t('cveScanner.detected')}: {cveResults.length}
                    </div>
                    
                    {cveResults.map((vuln, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-lg border"
                        style={{ 
                          background: 'rgba(6,13,31,0.6)', 
                          borderColor: vuln.severity === 'CRITICAL' ? 'rgba(239,68,68,0.5)' : vuln.severity === 'HIGH' ? 'rgba(249,115,22,0.5)' : 'rgba(251,191,36,0.3)' 
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-sm font-bold text-red-400">{vuln.cveId}</span>
                          <Badge 
                            variant={vuln.severity === 'CRITICAL' ? 'error' : vuln.severity === 'HIGH' ? 'warning' : 'default'}
                          >
                            {vuln.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-300 mb-2">{vuln.description}</p>
                        <p className="text-xs text-emerald-400">{vuln.recommendation}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle className="w-4 h-4" />
                    {t('cveScanner.noResults')}
                  </div>
                )}
                
                <button
                  onClick={() => {
                    setCveCodeInput('');
                    setCveResults([]);
                    setCveScanComplete(false);
                    setCveKeywordsFound([]);
                  }}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3 inline ml-1" />
                  Clear
                </button>
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {showNDRDashboard && toolStates.ndr && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <NDRDashboard t={t} dir={dir} />
        </motion.div>
      )}
    </motion.div>
  );
}