"""
Script to replace tab JSX blocks in App.tsx with page component calls.
"""

import re

file_path = 'src/App.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# ---- HELPER: replace block between two markers ----
def replace_between(text, start_marker, end_marker, new_block):
    start_idx = text.find(start_marker)
    if start_idx == -1:
        print(f"ERROR: Could not find start marker: {start_marker[:60]!r}")
        return text
    # end_marker is the start of the NEXT block section
    end_idx = text.find(end_marker, start_idx)
    if end_idx == -1:
        print(f"ERROR: Could not find end marker: {end_marker[:60]!r}")
        return text
    # We replace from start_marker up to (but not including) end_marker
    text = text[:start_idx] + new_block + '\n\n          ' + text[end_idx:]
    print(f"OK: Replaced block starting with: {start_marker[:50]!r}")
    return text


# ============================================================
# 1. POLICIES block  →  <PoliciesPage>
# ============================================================
POLICIES_START = "          {/* ---- SECURITY POLICIES ---- */}"
POLICIES_END   = "          {/* ---- AUDIT LOGS ---- */}"
POLICIES_NEW = """\
          {/* ---- SECURITY POLICIES ---- */}
          {activeTab === 'policies' && (
            <PoliciesPage
              t={t} dir={dir}
              policies={policies}
              policyName={policyName} setPolicyName={setPolicyName}
              policySourceUrl={policySourceUrl} setPolicySourceUrl={setPolicySourceUrl}
              policySyncIntervalHours={policySyncIntervalHours} setPolicySyncIntervalHours={setPolicySyncIntervalHours}
              isCreatingPolicy={isCreatingPolicy}
              isAutoSyncingPolicies={isAutoSyncingPolicies}
              syncingPolicyId={syncingPolicyId}
              isPolicyFormOpen={isPolicyFormOpen} setIsPolicyFormOpen={setIsPolicyFormOpen}
              handleCreatePolicy={handleCreatePolicy}
              handleSyncPolicy={handleSyncPolicy}
              userRole={userProfile?.role}
            />
          )}"""

content = replace_between(content, POLICIES_START, POLICIES_END, POLICIES_NEW)


# ============================================================
# 2. AUDIT block  →  <AuditPage>
# ============================================================
AUDIT_START = "          {/* ---- AUDIT LOGS ---- */}"
AUDIT_END   = "          {/* ---- SETTINGS ---- */}"
AUDIT_NEW = """\
          {/* ---- AUDIT LOGS ---- */}
          {activeTab === 'audit' && userProfile?.role === 'Administrator' && (
            <AuditPage
              t={t} dir={dir} language={language}
              auditLogs={auditLogs}
              auditImportRef={auditImportRef}
              handleAuditImport={handleAuditImport}
              downloadAuditPDF={downloadAuditPDF}
            />
          )}"""

content = replace_between(content, AUDIT_START, AUDIT_END, AUDIT_NEW)


# ============================================================
# 3. SETTINGS block  →  <SettingsPage>
# ============================================================
SETTINGS_START = "          {/* ---- SETTINGS ---- */}"
SETTINGS_END   = "          {/* ---- PROFILE ---- */}"
SETTINGS_NEW = """\
          {/* ---- SETTINGS ---- */}
          {activeTab === 'settings' && (
            <SettingsPage
              t={t} dir={dir}
              agentLlmProvider={agentLlmProvider}
              agentLlmProviderNotice={agentLlmProviderNotice}
              handleAgentProviderChange={handleAgentProviderChange}
              isFileScanning={isFileScanning}
              selectedScanInterval={selectedScanInterval} setSelectedScanInterval={setSelectedScanInterval}
              fileReferences={fileReferences}
              scanResults={scanResults}
              handleRequestFileAccess={handleRequestFileAccess}
              handleRescanDirectory={handleRescanDirectory}
              handleRemoveFileAccess={handleRemoveFileAccess}
            />
          )}"""

content = replace_between(content, SETTINGS_START, SETTINGS_END, SETTINGS_NEW)


# ============================================================
# 4. PROFILE block  →  <ProfilePage>
# ============================================================
PROFILE_START = "          {/* ---- PROFILE ---- */}"
# Find the tests section comment
PROFILE_END   = "          {/* ---- TESTS ---- */}"
PROFILE_NEW = """\
          {/* ---- PROFILE ---- */}
          {activeTab === 'profile' && (
            <ProfilePage
              t={t} dir={dir} language={language} setLanguage={setLanguage}
              user={user} localProfile={localProfile}
              currentPasswordInput={currentPasswordInput} setCurrentPasswordInput={setCurrentPasswordInput}
              newPasswordInput={newPasswordInput} setNewPasswordInput={setNewPasswordInput}
              confirmPasswordInput={confirmPasswordInput} setConfirmPasswordInput={setConfirmPasswordInput}
              isUpdatingPassword={isUpdatingPassword}
              isUpdatingAvatar={isUpdatingAvatar}
              profileEditFullName={profileEditFullName} setProfileEditFullName={setProfileEditFullName}
              profileEditBackupEmail={profileEditBackupEmail} setProfileEditBackupEmail={setProfileEditBackupEmail}
              profileEditPhone={profileEditPhone} setProfileEditPhone={setProfileEditPhone}
              profileEditBirthDate={profileEditBirthDate} setProfileEditBirthDate={setProfileEditBirthDate}
              profileEditCurrentPassword={profileEditCurrentPassword} setProfileEditCurrentPassword={setProfileEditCurrentPassword}
              isUpdatingProfileInfo={isUpdatingProfileInfo}
              handleAvatarChange={handleAvatarChange}
              handleRemoveAvatar={handleRemoveAvatar}
              handleUpdateProfileInfo={handleUpdateProfileInfo}
              handleChangeCurrentPassword={handleChangeCurrentPassword}
              loginError={loginError}
              authSuccess={authSuccess}
            />
          )}"""

content = replace_between(content, PROFILE_START, PROFILE_END, PROFILE_NEW)


# ============================================================
# 5. TESTS block  →  <TestsPage>
# ============================================================
TESTS_START = "          {/* ---- TESTS ---- */}"
# Find the learn section or end of main
TESTS_END   = "          {/* ---- CYBERSECURITY LEARNING ---- */}"
TESTS_NEW = """\
          {/* ---- SCENARIO TESTS ---- */}
          {activeTab === 'tests' && (
            <TestsPage
              t={t} dir={dir} language={language}
              testResults={testResults}
              isRunningTests={isRunningTests}
              testExecutionProgress={testExecutionProgress}
              selectedScenarioCategory={selectedScenarioCategory} setSelectedScenarioCategory={setSelectedScenarioCategory}
              testResultsSecondsLeft={testResultsSecondsLeft}
              handleRunTests={handleRunTests}
              clearTestResults={() => {
                if (testResultsTimerRef.current) clearTimeout(testResultsTimerRef.current);
                if (testResultsCountdownRef.current) clearInterval(testResultsCountdownRef.current);
                setTestResults([]);
                setTestResultsExpiresAt(null);
                setTestResultsSecondsLeft(null);
              }}
            />
          )}"""

content = replace_between(content, TESTS_START, TESTS_END, TESTS_NEW)


# Save
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("\nAll replacements done. App.tsx saved.")
