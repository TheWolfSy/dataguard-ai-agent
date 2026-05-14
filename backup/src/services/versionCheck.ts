export interface VersionInfo {
  version: string;
  releaseDate: string;
  buildNumber: number;
  changelog: string;
  minVersion: string;
}

export interface VersionCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseDate?: string;
  changelog?: string;
}

const STORED_VERSION_KEY = 'dataguard_version';

class VersionCheckService {
  private currentVersion: string;
  private cachedVersion: VersionInfo | null = null;

  constructor() {
    this.currentVersion = this.getCurrentVersion();
  }

  private getCurrentVersion(): string {
    try {
      return typeof window !== 'undefined'
        ? (localStorage.getItem(STORED_VERSION_KEY) || '1.0.0')
        : '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  async checkForUpdate(): Promise<VersionCheckResult> {
    try {
      const response = await fetch('/api/version.json', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const latestVersion: VersionInfo = await response.json();
      this.cachedVersion = latestVersion;

      const hasUpdate = this.compareVersions(this.currentVersion, latestVersion.version) < 0;

      return {
        hasUpdate,
        currentVersion: this.currentVersion,
        latestVersion: latestVersion.version,
        releaseDate: latestVersion.releaseDate,
        changelog: latestVersion.changelog,
      };
    } catch (error) {
      console.error('Version check failed:', error);
      return {
        hasUpdate: false,
        currentVersion: this.currentVersion,
        latestVersion: this.currentVersion,
      };
    }
  }

  compareVersions(current: string, latest: string): number {
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);

    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const latestPart = latestParts[i] || 0;

      if (currentPart < latestPart) return -1;
      if (currentPart > latestPart) return 1;
    }

    return 0;
  }

  setCurrentVersion(version: string): void {
    this.currentVersion = version;
    try {
      localStorage.setItem(STORED_VERSION_KEY, version);
    } catch {
      console.warn('Could not save version to localStorage');
    }
  }

  getCachedVersion(): VersionInfo | null {
    return this.cachedVersion;
  }
}

export const versionCheckService = new VersionCheckService();
export default versionCheckService;