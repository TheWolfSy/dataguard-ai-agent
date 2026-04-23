// Lazy loading patch for App.tsx
// Replaces 7 inline JSX blocks with lazy-loaded component calls + Suspense wrappers
// Also adds clearTestResults callback

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.tsx');
let lines = fs.readFileSync(filePath, 'utf-8').split('\n');
console.log('Initial line count:', lines.length);

// Helper: replace lines[start..end] (1-indexed, inclusive) with newContent
function replaceRange(start, end, newContent) {
  const newLines = newContent.split('\n');
  lines.splice(start - 1, end - start + 1, ...newLines);
  console.log(`Replaced lines ${start}-${end} (${end - start + 1} lines) → ${newLines.length} lines`);
}

// ── Process from HIGHEST line number to LOWEST ──────────────────────────────

// 7. AI PROVIDERS (2916-2926) → wrap with Suspense
replaceRange(2916, 2926, `          {/* ---- AI PROVIDERS ---- */}
          {activeTab === 'ai-providers' && (
            <React.Suspense fallback={<PageSkeleton />}>
              <AIProvidersPage
                t={t}
                dir={dir}
                agentLlmProvider={agentLlmProvider}
                handleAgentProviderChange={handleAgentProviderChange}
                agentLlmProviderNotice={agentLlmProviderNotice}
              />
            </React.Suspense>
          )}
`);

// 6. TESTS (2662-2910) → TestsPage component
replaceRange(2662, 2910, `          {/* ---- TESTS ---- */}
          {activeTab === 'tests' && userProfile?.role === 'Administrator' && (
            <React.Suspense fallback={<PageSkeleton />}>
              <TestsPage
                t={t}
                dir={dir}
                language={language}
                testResults={testResults}
                isRunningTests={isRunningTests}
                testExecutionProgress={testExecutionProgress}
                selectedScenarioCategory={selectedScenarioCategory}
                setSelectedScenarioCategory={setSelectedScenarioCategory}
                testResultsSecondsLeft={testResultsSecondsLeft}
                handleRunTests={handleRunTests}
                clearTestResults={clearTestResults}
              />
            </React.Suspense>
          )}
`);

// 5. PROFILE (2482-2661) → ProfilePage component
replaceRange(2482, 2661, `          {/* ---- PROFILE ---- */}
          {activeTab === 'profile' && (
            <React.Suspense fallback={<PageSkeleton />}>
              <ProfilePage
                t={t}
                dir={dir}
                language={language}
                setLanguage={setLanguage}
                user={user!}
                localProfile={localProfile}
                currentPasswordInput={currentPasswordInput}
                setCurrentPasswordInput={setCurrentPasswordInput}
                newPasswordInput={newPasswordInput}
                setNewPasswordInput={setNewPasswordInput}
                confirmPasswordInput={confirmPasswordInput}
                setConfirmPasswordInput={setConfirmPasswordInput}
                isUpdatingPassword={isUpdatingPassword}
                isUpdatingAvatar={isUpdatingAvatar}
                profileEditFullName={profileEditFullName}
                setProfileEditFullName={setProfileEditFullName}
                profileEditBackupEmail={profileEditBackupEmail}
                setProfileEditBackupEmail={setProfileEditBackupEmail}
                profileEditPhone={profileEditPhone}
                setProfileEditPhone={setProfileEditPhone}
                profileEditBirthDate={profileEditBirthDate}
                setProfileEditBirthDate={setProfileEditBirthDate}
                profileEditCurrentPassword={profileEditCurrentPassword}
                setProfileEditCurrentPassword={setProfileEditCurrentPassword}
                isUpdatingProfileInfo={isUpdatingProfileInfo}
                handleAvatarChange={handleAvatarChange}
                handleRemoveAvatar={handleRemoveAvatar}
                handleUpdateProfileInfo={handleUpdateProfileInfo}
                handleChangeCurrentPassword={handleChangeCurrentPassword}
                loginError={loginError}
                authSuccess={authSuccess}
              />
            </React.Suspense>
          )}
`);

// 4. SETTINGS (2227-2481) → SettingsPage component
replaceRange(2227, 2481, `          {/* ---- SETTINGS ---- */}
          {activeTab === 'settings' && (
            <React.Suspense fallback={<PageSkeleton />}>
              <SettingsPage
                t={t}
                dir={dir}
                agentLlmProvider={agentLlmProvider}
                agentLlmProviderNotice={agentLlmProviderNotice}
                handleAgentProviderChange={handleAgentProviderChange}
                isFileScanning={isFileScanning}
                selectedScanInterval={selectedScanInterval}
                setSelectedScanInterval={setSelectedScanInterval}
                fileReferences={fileReferences}
                scanResults={scanResults}
                handleRequestFileAccess={handleRequestFileAccess}
                handleRescanDirectory={handleRescanDirectory}
                handleRemoveFileAccess={handleRemoveFileAccess}
              />
            </React.Suspense>
          )}
`);

// 3. AUDIT (2104-2226) → AuditPage component
replaceRange(2104, 2226, `          {/* ---- AUDIT LOGS ---- */}
          {activeTab === 'audit' && userProfile?.role === 'Administrator' && (
            <React.Suspense fallback={<PageSkeleton />}>
              <AuditPage
                t={t}
                dir={dir}
                language={language}
                auditLogs={auditLogs}
                auditImportRef={auditImportRef}
                handleAuditImport={handleAuditImport}
                downloadAuditPDF={downloadAuditPDF}
              />
            </React.Suspense>
          )}
`);

// 2. SECURITY POLICIES (1925-2103) → PoliciesPage component
replaceRange(1925, 2103, `          {/* ---- SECURITY POLICIES ---- */}
          {activeTab === 'policies' && (
            <React.Suspense fallback={<PageSkeleton />}>
              <PoliciesPage
                t={t}
                dir={dir}
                policies={policies}
                policyName={policyName}
                setPolicyName={setPolicyName}
                policySourceUrl={policySourceUrl}
                setPolicySourceUrl={setPolicySourceUrl}
                policySyncIntervalHours={policySyncIntervalHours}
                setPolicySyncIntervalHours={setPolicySyncIntervalHours}
                isCreatingPolicy={isCreatingPolicy}
                isAutoSyncingPolicies={isAutoSyncingPolicies}
                syncingPolicyId={syncingPolicyId}
                isPolicyFormOpen={isPolicyFormOpen}
                setIsPolicyFormOpen={setIsPolicyFormOpen}
                handleCreatePolicy={handleCreatePolicy}
                handleSyncPolicy={handleSyncPolicy}
                userRole={userProfile?.role}
              />
            </React.Suspense>
          )}
`);

// 1. DATA LOGS (1915-1924) → wrap LogsPage with Suspense
replaceRange(1915, 1924, `          {/* ---- DATA LOGS ---- */}
          {activeTab === 'logs' && (
            <React.Suspense fallback={<PageSkeleton />}>
              <LogsPage
                t={t} dir={dir}
                logs={logs}
                showDecrypted={showDecrypted}
                toggleDecryption={toggleDecryption}
              />
            </React.Suspense>
          )}
`);

// ── Add clearTestResults callback after handleRunTests (line 780) ───────────
// Lines 1-780 are unchanged at this point (all replacements were at 1915+)
const clearTestResultsFn = `
  const clearTestResults = useCallback(() => {
    if (testResultsTimerRef.current) clearTimeout(testResultsTimerRef.current);
    if (testResultsCountdownRef.current) clearInterval(testResultsCountdownRef.current);
    setTestResults([]);
    setTestResultsExpiresAt(null);
    setTestResultsSecondsLeft(null);
  }, []);`;

// Insert after line 780 (0-indexed: 780)
lines.splice(780, 0, clearTestResultsFn);
console.log('Inserted clearTestResults after line 780');

const result = lines.join('\n');
fs.writeFileSync(filePath, result, 'utf-8');
console.log('Final line count:', lines.length);
console.log('Done!');
