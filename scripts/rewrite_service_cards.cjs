const fs = require('fs');
const filePath = 'src/components/pages/PoliciesPage.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const GRID_OPEN = `        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> {/* Grid wrapper for service cards */}`;
const GRID_CLOSE = `        </div> {/* End of grid wrapper for service cards */}`;

const startIdx = content.indexOf(GRID_OPEN);
const endIdx = content.indexOf(GRID_CLOSE) + GRID_CLOSE.length;

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find grid boundaries');
  process.exit(1);
}

const newGrid = `        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── File Protection Card ── */}
        <Card className="p-6 border-t-4 border-t-blue-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 shrink-0">
                <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-bold text-sm uppercase tracking-tight text-zinc-900 dark:text-zinc-100">{t('fileProtection.title')}</h3>
            </div>
            <div className="px-2 py-0.5 rounded text-[9px] font-mono uppercase bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
              {t('policies.serviceActive')}
            </div>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 italic leading-relaxed">"{t('fileProtection.description')}"</p>
          <div className="space-y-3 mb-6">
            <motion.button
              onClick={handleRequestFileAccess}
              disabled={isFileScanning}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-all"
            >
              {isFileScanning ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                  {t('fileProtection.scanning')}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4" />
                  {t('fileProtection.grantAccess')}
                </div>
              )}
            </motion.button>
            <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-3">
              <div>
                <label className="text-xs font-bold uppercase block mb-2 text-zinc-700 dark:text-zinc-200">
                  {t('fileProtection.scanInterval')}
                </label>
                <select
                  value={selectedScanInterval}
                  onChange={(e) => setSelectedScanInterval(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>1 {t('fileProtection.scanInterval')}</option>
                  <option value={6}>6 {t('fileProtection.scanInterval')}</option>
                  <option value={12}>12 {t('fileProtection.scanInterval')}</option>
                  <option value={24}>24 {t('fileProtection.scanInterval')}</option>
                  <option value={48}>48 {t('fileProtection.scanInterval')}</option>
                  <option value={168}>1 week</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4" />
                <span className="text-xs font-bold uppercase text-zinc-700 dark:text-zinc-200">{t('fileProtection.enableAutoScan')}</span>
              </label>
            </div>
            {fileReferences.length > 0 ? (
              <div className="space-y-2">
                {fileReferences.map((fileRef) => (
                  <div key={fileRef.id} className="p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-500" />
                        <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100">{fileRef.directoryName}</span>
                      </div>
                      {fileRef.threatsFound > 0 && <Badge variant="error">{fileRef.threatsFound} threats</Badge>}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-white dark:bg-zinc-900 p-2 rounded border border-zinc-200 dark:border-zinc-700">
                        <span className="text-zinc-500 dark:text-zinc-400 block">{t('fileProtection.lastScanned')}</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{fileRef.lastScannedAt ? new Date(fileRef.lastScannedAt).toLocaleDateString() : 'Never'}</span>
                      </div>
                      <div className="bg-white dark:bg-zinc-900 p-2 rounded border border-zinc-200 dark:border-zinc-700">
                        <span className="text-zinc-500 dark:text-zinc-400 block">{t('fileProtection.totalScanned')}</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{fileRef.totalFilesScanned}</span>
                      </div>
                      <div className="bg-white dark:bg-zinc-900 p-2 rounded border border-zinc-200 dark:border-zinc-700">
                        <span className="text-zinc-500 dark:text-zinc-400 block">{t('fileProtection.threatsFound')}</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{fileRef.threatsFound}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <motion.button onClick={() => handleRescanDirectory(fileRef.id)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-200 transition-all">
                        {t('fileProtection.rescan')}
                      </motion.button>
                      <motion.button onClick={() => handleRemoveFileAccess(fileRef.id)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1 px-3 py-2 bg-red-100 text-red-700 text-xs font-bold rounded-lg hover:bg-red-200 transition-all">
                        {t('fileProtection.removeAccess')}
                      </motion.button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                <Shield className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <p className="text-xs text-zinc-600 dark:text-zinc-300">{t('fileProtection.noDirectories')}</p>
              </div>
            )}
            {scanResults.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {scanResults.map((result) => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      'p-3 rounded-lg border text-xs',
                      result.riskLevel === 'critical' ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800' :
                      result.riskLevel === 'high' ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' :
                      'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-zinc-900 dark:text-zinc-100 truncate">{result.fileName}</span>
                      <Badge variant={result.riskLevel === 'safe' ? 'success' : result.riskLevel === 'high' ? 'warning' : 'error'}>
                        {result.riskLevel.toUpperCase()}
                      </Badge>
                    </div>
                    {result.findings.length > 0 && (
                      <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-300">
                        {result.findings.slice(0, 2).map((finding, idx) => (
                          <li key={idx} className="text-[10px]">{finding.description}</li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-[9px] font-mono text-zinc-400 uppercase">{fileReferences.length} {t('fileProtection.managedDirectories')}</span>
            <motion.button whileHover={{ x: 2 }} whileTap={{ scale: 0.96 }} onClick={handleRequestFileAccess} disabled={isFileScanning} className="text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-800 disabled:opacity-50">
              {isFileScanning ? t('fileProtection.scanning') : t('fileProtection.grantAccess')}
            </motion.button>
          </div>
        </Card>

        {/* ── Database Encryption Card ── */}
        <Card className="p-6 border-t-4 border-t-violet-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/40 shrink-0">
                <KeyRound className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="font-bold text-sm uppercase tracking-tight text-zinc-900 dark:text-zinc-100">{t('encryption.title')}</h3>
            </div>
            <Badge variant="success">{t('encryption.secureStorage')}</Badge>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 italic leading-relaxed">"{t('encryption.subtitle')}"</p>
          <div className="space-y-3 mb-6">
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
              <div className="p-4 flex items-center justify-between bg-white dark:bg-zinc-900">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('encryption.algorithm')}</p>
                  <p className="text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100">AES-256-GCM</p>
                </div>
                <Badge variant="success">{t('encryption.secureStorage')}</Badge>
              </div>
              <div className="p-4 flex items-center justify-between bg-white dark:bg-zinc-900">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('encryption.keyCreated')}</p>
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {keyInfo.createdAt
                      ? keyInfo.createdAt.toLocaleString()
                      : <span className="text-zinc-400 font-normal text-xs">{t('encryption.keyUnknown')}</span>}
                  </p>
                </div>
                <KeyRound className="w-4 h-4 text-zinc-300" />
              </div>
              <div className="p-4 space-y-2 bg-white dark:bg-zinc-900">
                <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('encryption.fieldsEncrypted')}</p>
                <div className="flex flex-wrap gap-2">
                  {['API Keys', 'Data Logs', 'Audit Details'].map((f) => (
                    <span key={f} className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-mono font-bold text-emerald-700">{f}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg flex gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase">{t('encryption.warningTitle')}</h4>
                <p className="text-[10px] text-rose-800 dark:text-rose-300 leading-relaxed">{t('encryption.warningText')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                onClick={handleExportKey}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-700 transition-all"
              >
                <Download className="w-4 h-4" />
                {t('encryption.exportKey')}
              </motion.button>
              <motion.button
                onClick={() => importKeyRef.current?.click()}
                disabled={importStatus === 'loading'}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-bold uppercase tracking-widest hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-all"
              >
                <Upload className="w-4 h-4" />
                {importStatus === 'loading' ? '...' : t('encryption.importKey')}
              </motion.button>
              <input ref={importKeyRef} type="file" accept="application/json,.json" onChange={handleImportKey} className="hidden" />
            </div>
            {importStatus === 'success' && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2 font-mono">
                ✓ {t('encryption.importSuccess')}
              </p>
            )}
            {importStatus === 'error' && importError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2 font-mono">
                {importError}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-[9px] font-mono text-zinc-400 uppercase">{t('encryption.keyCreated')} {keyInfo.createdAt ? keyInfo.createdAt.toLocaleDateString() : '-'}</span>
            <div className="flex items-center gap-3">
              <motion.button onClick={handleExportKey} whileHover={{ x: 2 }} whileTap={{ scale: 0.96 }} className="text-[10px] font-bold uppercase tracking-widest text-violet-600 hover:text-violet-800">
                {t('encryption.exportKey')}
              </motion.button>
            </div>
          </div>
        </Card>

        {/* ── Gmail Email Monitor Card ── */}
        <Card className={cn('p-6 border-t-4',
          emailMonitorState.connection
            ? emailMonitorState.enabled ? 'border-t-emerald-500' : 'border-t-amber-400'
            : 'border-t-zinc-300',
        )}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg shrink-0',
                emailMonitorState.connection
                  ? emailMonitorState.enabled ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-amber-100 dark:bg-amber-900/40'
                  : 'bg-zinc-100 dark:bg-zinc-800',
              )}>
                <Mail className={cn('w-4 h-4',
                  emailMonitorState.connection
                    ? emailMonitorState.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'
                    : 'text-zinc-400',
                )} />
              </div>
              <h3 className="font-bold text-sm uppercase tracking-tight text-zinc-900 dark:text-zinc-100">{t('emailMonitor.title')}</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className={cn('px-2 py-0.5 rounded text-[9px] font-mono uppercase',
                emailMonitorState.connection && emailMonitorState.enabled
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                  : emailMonitorState.connection
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
              )}>
                {emailMonitorState.connection
                  ? emailMonitorState.enabled ? t('policies.serviceActive') : t('emailMonitor.statusPaused')
                  : t('policies.serviceInactive')}
              </div>
              {emailMonitorState.connection && (
                <button
                  type="button"
                  onClick={() => handleSetEmailMonitorEnabled(!emailMonitorState.enabled)}
                  className={cn('relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 shrink-0',
                    emailMonitorState.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600',
                  )}
                  aria-label={t('emailMonitor.toggleLabel')}
                >
                  <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
                    emailMonitorState.enabled ? 'translate-x-5' : 'translate-x-0',
                  )} />
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 italic leading-relaxed">
            "{emailMonitorState.connection ? emailMonitorState.connection.email : t('emailMonitor.subtitle')}"
          </p>
          <div className="space-y-3 mb-6">
            {isConnectingGmail && (
              <div className="flex items-center justify-center gap-3 py-6">
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">{t('emailMonitor.connecting')}</span>
              </div>
            )}
            {!isConnectingGmail && emailMonitorState.connection && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', emailMonitorState.isMonitoring ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400')} />
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 font-mono" dir="ltr">{emailMonitorState.connection.email}</span>
                  </div>
                  <button type="button" onClick={handleDisconnectGmail} className="text-[10px] font-bold uppercase text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 transition-colors">
                    {t('emailMonitor.disconnect')}
                  </button>
                </div>
                {!emailMonitorState.enabled && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">{t('emailMonitor.pausedWarning')}</p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-center">
                    <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{emailMonitorState.totalScanned}</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-mono">{t('emailMonitor.scanned')}</p>
                  </div>
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg text-center">
                    <p className="text-xl font-bold text-rose-600 dark:text-rose-400">
                      {emailMonitorState.alerts.filter((a) => !a.dismissed && a.riskLevel === 'dangerous').length}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-mono">{t('emailMonitor.dangerous')}</p>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center">
                    <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                      {emailMonitorState.alerts.filter((a) => !a.dismissed && a.riskLevel === 'suspicious').length}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-mono">{t('emailMonitor.suspicious')}</p>
                  </div>
                </div>
                {emailMonitorState.alerts.filter((a) => !a.dismissed).length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{t('emailMonitor.alerts')}</p>
                      <button type="button" onClick={handleClearAlerts} className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-mono uppercase">{t('emailMonitor.clearAlerts')}</button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {emailMonitorState.alerts.filter((a) => !a.dismissed).slice(-5).reverse().map((alert) => (
                        <div key={alert.id} className={cn('p-3 rounded-lg border text-xs', alert.riskLevel === 'dangerous' ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800' : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800')}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {alert.riskLevel === 'dangerous' ? <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                                <span className={cn('font-bold uppercase text-[9px] font-mono px-1.5 py-0.5 rounded', alert.riskLevel === 'dangerous' ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300')}>{alert.riskLevel}</span>
                              </div>
                              <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{alert.subject}</p>
                              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono truncate" dir="ltr">{alert.from}</p>
                              {alert.matchedRules.length > 0 && (
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                                  {t('emailMonitor.triggeredBy')}: {alert.matchedRules[0].description}
                                  {alert.matchedRules.length > 1 ? \` +\${alert.matchedRules.length - 1}\` : ''}
                                </p>
                              )}
                            </div>
                            <button type="button" onClick={() => handleDismissAlert(alert.id)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 shrink-0 text-lg leading-none" title={t('emailMonitor.dismiss')}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                  <button type="button" onClick={() => setShowRulesPanel((v) => !v)} className="w-full flex items-center justify-between p-3 text-start bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{t('emailMonitor.cashRules')}</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{emailMonitorState.rules.filter((r) => r.enabled).length} / {emailMonitorState.rules.length} {t('emailMonitor.rulesActive')}</p>
                    </div>
                    {showRulesPanel ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                  </button>
                  <AnimatePresence initial={false}>
                    {showRulesPanel && (
                      <motion.div key="rules-panel" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15, ease: 'easeOut' }} className="overflow-hidden">
                        <div className="p-3 space-y-3 bg-white dark:bg-zinc-900">
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {emailMonitorState.rules.map((rule) => (
                              <div key={rule.id} className="flex items-center gap-2 p-2 rounded border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                                <button type="button" onClick={() => handleToggleCashRule(rule.id, !rule.enabled)} className={cn('relative w-8 h-4 rounded-full transition-colors duration-200 shrink-0', rule.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600')}>
                                  <span className={cn('absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200', rule.enabled ? 'translate-x-4' : 'translate-x-0')} />
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-mono text-zinc-700 dark:text-zinc-300 truncate">{rule.pattern}</p>
                                  <p className="text-[9px] text-zinc-400 dark:text-zinc-500">{rule.type}</p>
                                </div>
                                <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase shrink-0', rule.riskLevel === 'dangerous' ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300')}>{rule.riskLevel}</span>
                                {!rule.isDefault && (
                                  <button type="button" onClick={() => handleRemoveCashRule(rule.id)} className="text-zinc-400 hover:text-rose-500 text-base leading-none shrink-0" title={t('emailMonitor.removeRule')}>×</button>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t('emailMonitor.addRule')}</p>
                            <input value={newRulePattern} onChange={(e) => setNewRulePattern(e.target.value)} placeholder={t('emailMonitor.rulePattern')} className="w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-600 rounded text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                            <div className="grid grid-cols-2 gap-2">
                              <select value={newRuleType} onChange={(e) => setNewRuleType(e.target.value as CashRuleType)} className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-600 rounded text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none">
                                <option value="keyword">{t('emailMonitor.typeKeyword')}</option>
                                <option value="sender_domain">{t('emailMonitor.typeSenderDomain')}</option>
                                <option value="subject_pattern">{t('emailMonitor.typeSubject')}</option>
                              </select>
                              <select value={newRuleRisk} onChange={(e) => setNewRuleRisk(e.target.value as MonitorRiskLevel)} className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-600 rounded text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none">
                                <option value="suspicious">{t('emailMonitor.riskSuspicious')}</option>
                                <option value="dangerous">{t('emailMonitor.riskDangerous')}</option>
                              </select>
                            </div>
                            <button type="button" onClick={handleAddRuleClick} disabled={!newRulePattern.trim()} className="w-full py-1.5 rounded text-[10px] font-bold uppercase bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40 transition-colors">{t('emailMonitor.addRuleButton')}</button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
            {!isConnectingGmail && !emailMonitorState.connection && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg">
                  <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300">{t('emailMonitor.infoTitle')}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">{t('emailMonitor.infoText')}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">{t('emailMonitor.setupTitle')}</p>
                  <ol className="space-y-1.5">
                    {[t('emailMonitor.step1'), t('emailMonitor.step2').replace('{origin}', window.location.origin + '/auth/gmail.html'), t('emailMonitor.step3')].map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-zinc-600 dark:text-zinc-300">
                        <span className="shrink-0 w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t('emailMonitor.clientIdLabel')}</label>
                  <input value={gmailClientId} onChange={(e) => setGmailClientId(e.target.value)} placeholder="123456789-xxxxx.apps.googleusercontent.com" dir="ltr" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  <button type="button" onClick={() => setShowGmailSecret((v) => !v)} className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-mono">
                    {showGmailSecret ? '▲' : '▼'} {t('emailMonitor.optionalSecret')}
                  </button>
                  <AnimatePresence initial={false}>
                    {showGmailSecret && (
                      <motion.div key="secret-input" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                        <input value={gmailClientSecret} onChange={(e) => setGmailClientSecret(e.target.value)} type="password" placeholder={t('emailMonitor.clientSecretPlaceholder')} dir="ltr" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <motion.button onClick={handleConnectPress} disabled={!gmailClientId.trim() || isConnectingGmail} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all">
                    <Mail className="w-4 h-4" />
                    {t('emailMonitor.connectButton')}
                  </motion.button>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-[9px] font-mono text-zinc-400 uppercase">
              {emailMonitorState.lastCheckedAt ? \`\${t('emailMonitor.lastChecked')}: \${new Date(emailMonitorState.lastCheckedAt).toLocaleString()}\` : t('policies.serviceInactive')}
            </span>
            {emailMonitorState.connection && (
              <motion.button whileHover={{ x: 2 }} whileTap={{ scale: 0.96 }} onClick={handleDisconnectGmail} className="text-[10px] font-bold uppercase tracking-widest text-rose-500 hover:text-rose-700">
                {t('emailMonitor.disconnect')}
              </motion.button>
            )}
          </div>
        </Card>

        </div>`;

const before = content.slice(0, startIdx);
const after = content.slice(endIdx);
const newContent = before + newGrid + after;
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Done! Cards rewritten as full non-collapsible cards.');
console.log('File length:', newContent.length);
