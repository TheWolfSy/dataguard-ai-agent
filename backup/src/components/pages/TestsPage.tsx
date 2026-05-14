import React from 'react';
import { motion } from 'motion/react';
import { Clock } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';
import { getTestExecutor } from '../../services/testMetrics';
import type { TestResult } from '../../services/testMetrics';

type TFunc = (key: string) => string;

interface TestsPageProps {
  t: TFunc;
  dir: string;
  language: string;
  testResults: TestResult[];
  isRunningTests: boolean;
  testExecutionProgress: number;
  selectedScenarioCategory: 'simple' | 'multi-step' | 'injection' | 'all';
  setSelectedScenarioCategory: (v: 'simple' | 'multi-step' | 'injection' | 'all') => void;
  testResultsSecondsLeft: number | null;
  handleRunTests: () => Promise<void>;
  clearTestResults: () => void;
}

export function TestsPage({
  t, dir, language,
  testResults, isRunningTests, testExecutionProgress,
  selectedScenarioCategory, setSelectedScenarioCategory,
  testResultsSecondsLeft,
  handleRunTests, clearTestResults,
}: TestsPageProps) {
  return (
    <motion.div
      key="tests"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="max-w-4xl space-y-8"
    >
      <div>
        <h2 className="text-xl font-bold tracking-tight">{t('testScenarios.title')}</h2>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('testScenarios.description')}</p>
      </div>

      {/* Controls */}
      <Card className="p-6 space-y-4">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase block mb-2" style={{ color: '#94a3b8' }}>
              {t('testScenarios.runByCategory')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['all', 'simple', 'multi-step', 'injection'] as const).map((cat) => (
                <motion.button
                  key={cat}
                  onClick={() => setSelectedScenarioCategory(cat)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs font-bold transition-all uppercase',
                    selectedScenarioCategory === cat
                      ? 'text-white'
                      : 'text-slate-300 hover:text-white'
                  )}
                  style={selectedScenarioCategory === cat
                    ? { background: 'linear-gradient(135deg,#3b82f6,#2563eb)', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }
                    : { background: 'rgba(10,20,45,0.6)', border: '1px solid rgba(96,165,250,0.15)' }}
                >
                  {t(`testScenarios.${cat === 'all' ? 'runAllTests' : cat === 'simple' ? 'simple' : cat === 'multi-step' ? 'multiStep' : 'injection'}`)}
                </motion.button>
              ))}
            </div>
          </div>
          <motion.button
            onClick={handleRunTests}
            disabled={isRunningTests}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full px-4 py-3 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={isRunningTests ? { background: 'rgba(10,20,45,0.6)', border: '1px solid rgba(52,211,153,0.2)' } : { background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 20px rgba(16,185,129,0.25)' }}
          >
            {isRunningTests ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                {t('testScenarios.runTests')} ({testExecutionProgress}%)
              </div>
            ) : (
              t('testScenarios.runAllTests')
            )}
          </motion.button>
        </div>
      </Card>

      {/* Progress */}
      {isRunningTests && (
        <div className="rounded-lg p-4 space-y-2" style={{ background: 'rgba(10,20,45,0.6)', border: '1px solid rgba(96,165,250,0.15)' }}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold" style={{ color: '#94a3b8' }}>{t('testScenarios.running')}</span>
            <span style={{ color: 'var(--text-muted)' }}>{testExecutionProgress}%</span>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'rgba(30,50,80,0.6)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${testExecutionProgress}%` }}
              className="h-full transition-all" style={{ background: 'linear-gradient(90deg,#10b981,#3b82f6)' }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {testResults.length > 0 && (
        <div className="space-y-4">
          {testResultsSecondsLeft !== null && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg" style={{ background: 'rgba(120,60,0,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-xs font-mono" style={{ color: '#d97706' }}>
                {language === 'ar'
                  ? `سيتم مسح النتائج تلقائياً خلال ${Math.floor(testResultsSecondsLeft / 60)}:${String(testResultsSecondsLeft % 60).padStart(2, '0')} دقيقة`
                  : `Results will be cleared in ${Math.floor(testResultsSecondsLeft / 60)}:${String(testResultsSecondsLeft % 60).padStart(2, '0')}`}
              </span>
              <button
                onClick={clearTestResults}
                className="ms-auto text-[10px] underline font-mono hover:opacity-80" style={{ color: '#d97706' }}
              >
                {language === 'ar' ? 'مسح الآن' : 'Clear now'}
              </button>
            </div>
          )}

          {/* Summary */}
          <Card className="p-6">
          <h3 className="text-sm font-bold uppercase tracking-tight mb-4 text-slate-200">{t('testScenarios.summary')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(() => {
                const executor = getTestExecutor();
                const summary = executor.generateSummary(testResults);
                return (
                  <>
                    <StatBox label={t('testScenarios.testsPassed')} value={`${testResults.filter(r => r.metrics.success).length}/${testResults.length}`} color="text-green-600" />
                    <StatBox label={t('testScenarios.successRate')} value={`${summary.successRate}%`} color="text-blue-600" />
                    <StatBox label={t('testScenarios.averageResponseTime')} value={`${summary.averageResponseTime}ms`} color="text-purple-600" />
                    <StatBox label={t('testScenarios.falsePositiveRate')} value={`${summary.averageFalsePositiveRate}%`} color="text-amber-600" />
                    <StatBox label={t('testScenarios.threatDetections')} value={String(summary.totalThreatsDetected)} color="text-red-600" />
                    <StatBox label={t('testScenarios.blockedAttempts')} value={String(summary.totalBlockedAttempts)} color="text-orange-600" />
                    <StatBox label={t('testScenarios.simple')} value={String(summary.byCategory?.simple ?? 0)} color="text-sky-600" />
                    <StatBox label={t('testScenarios.multiStep')} value={String(summary.byCategory?.multiStep ?? 0)} color="text-indigo-600" />
                  </>
                );
              })()}
            </div>
          </Card>

          {/* Individual Results */}
          <h3 className="text-sm font-bold uppercase tracking-tight text-slate-200">{t('testScenarios.results')}</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {testResults.map((result) => (
              <motion.div
                key={result.scenario.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  'p-4 rounded-lg',
                  result.metrics.success ? '' : ''
                )}
                style={result.metrics.success
                  ? { background: 'rgba(5,46,22,0.3)', border: '1px solid rgba(52,211,153,0.25)' }
                  : { background: 'rgba(69,10,10,0.3)', border: '1px solid rgba(248,113,113,0.25)' }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <h4 className="font-bold text-sm text-slate-200">{result.scenario.name}</h4>
                    <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{result.scenario.description}</p>
                  </div>
                  <Badge variant={result.metrics.success ? 'success' : 'error'}>
                    {result.metrics.success ? t('testScenarios.metrics.success') : t('testScenarios.metrics.failed')}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs mt-3">
                  <StatBox label={t('testScenarios.metrics.taskCompletion')} value={`${result.metrics.taskCompletionRate}%`} />
                  <StatBox label={t('testScenarios.metrics.unnecessarySteps')} value={String(result.metrics.unnecessarySteps)} />
                  <StatBox label={t('testScenarios.metrics.responseTime')} value={`${result.metrics.responseTimeMs}ms`} />
                  <StatBox label={t('testScenarios.metrics.falsePositives')} value={`${result.metrics.falsePositiveRate}%`} />
                  <StatBox label={t('testScenarios.metrics.threatDetections')} value={String(result.metrics.threatDetections)} />
                  <StatBox label={t('testScenarios.metrics.blockedOperations')} value={String(result.metrics.blockedAttempts)} />
                </div>
                {result.details.stepsExecuted.length > 0 && (
                  <details className="mt-3 cursor-pointer">
                    <summary className="text-xs font-bold hover:text-slate-200" style={{ color: '#94a3b8' }}>
                      {t('testScenarios.details.stepsExecuted')} ({result.details.stepsExecuted.length})
                    </summary>
                    <ul className="list-disc list-inside text-[10px] mt-2 space-y-1" style={{ color: '#94a3b8' }}>
                      {result.details.stepsExecuted.slice(0, 5).map((step, idx) => <li key={idx}>{step}</li>)}
                    </ul>
                  </details>
                )}
                {result.details.securityWarnings.length > 0 && (
                  <details className="mt-2 cursor-pointer">
                    <summary className="text-xs font-bold text-amber-600 hover:text-amber-900">
                      {t('testScenarios.details.securityWarnings')} ({result.details.securityWarnings.length})
                    </summary>
                    <ul className="list-disc list-inside text-[10px] text-amber-600 mt-2 space-y-1">
                      {result.details.securityWarnings.slice(0, 5).map((w, idx) => <li key={idx}>{w}</li>)}
                    </ul>
                  </details>
                )}
                {result.details.blockedOperations.length > 0 && (
                  <details className="mt-2 cursor-pointer">
                    <summary className="text-xs font-bold text-red-600 hover:text-red-900">
                      {t('testScenarios.details.blockedOperations')} ({result.details.blockedOperations.length})
                    </summary>
                    <ul className="list-disc list-inside text-[10px] text-red-600 mt-2 space-y-1">
                      {result.details.blockedOperations.slice(0, 5).map((op, idx) => <li key={idx}>{op}</li>)}
                    </ul>
                  </details>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function StatBox({ label, value, color = 'text-zinc-900' }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-2 rounded" style={{ background: 'rgba(6,13,31,0.7)', border: '1px solid rgba(96,165,250,0.1)' }}>
      <span className="text-[10px] block" style={{ color: '#64748b' }}>{label}</span>
      <span className={`text-lg font-bold ${color}`}>{value}</span>
    </div>
  );
}
