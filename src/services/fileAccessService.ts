export interface FileScanResult {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  scanTime: Date;
  riskLevel: 'safe' | 'high' | 'critical';
  findings: Array<{ type: string; severity: string; description: string }>;
  hasSuspiciousPatterns: boolean;
  hasMaliciousContent: boolean;
  hasSensitiveData: boolean;
}

const SYSTEM_DIRECTORIES = new Set([
  'Windows', 'System32', 'AppData', 'Program Files', 'Program Files (x86)',
  '.git', '.vscode', 'node_modules', '__pycache__', '.cache', '.local',
  '.config', 'Library', 'Applications', '.npm', 'bower_components',
  'dist', 'build', '.next', '.nuxt', 'vendor', '.env'
]);

function isSystemDirectory(name: string): boolean {
  return SYSTEM_DIRECTORIES.has(name);
}

export async function requestFileSystemAccess(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if ('showDirectoryPicker' in window) {
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'read',
        startIn: 'documents'
      });
      return dirHandle;
    } else {
      console.warn('File System Access API not supported');
      return null;
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('User cancelled directory selection');
    } else {
      console.error('Error requesting directory access:', error);
    }
    return null;
  }
}

export async function scanDirectoryForThreats(
  dirHandle: FileSystemDirectoryHandle,
  excludedPaths: Set<string>,
  maxDepth: number = 3,
  currentDepth: number = 0
): Promise<FileScanResult[]> {
  const results: FileScanResult[] = [];
  
  if (currentDepth >= maxDepth) {
    return results;
  }

  try {
    for await (const entry of (dirHandle as any).values()) {
      // تجاهل مجلدات النظام الحساسة
      if (isSystemDirectory(entry.name)) continue;
      
      // تجاهل الملفات المستبعدة
      if (excludedPaths.has(entry.name)) continue;

      try {
        if (entry.kind === 'file') {
          const fileHandle = entry as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          
          // فحص الملفات الخطرة فقط (تجاهل الملفات الضخمة جداً)
          if (file.size < 50 * 1024 * 1024) { // 50 MB max
            const content = await file.text().catch(() => '');
            const scanResult: FileScanResult = {
              id: `${file.name}-${Date.now()}`,
              fileName: file.name,
              filePath: file.name,
              fileSize: file.size,
              scanTime: new Date(),
              riskLevel: 'safe' as const,
              findings: [],
              hasSuspiciousPatterns: false,
              hasMaliciousContent: false,
              hasSensitiveData: false
            };
            
            // فحص المحتوى للأنماط المريبة
            if (containsDangerousPatterns(content, file.name)) {
              scanResult.riskLevel = 'critical';
              scanResult.hasSuspiciousPatterns = true;
              scanResult.findings.push({
                type: 'dangerous_pattern',
                severity: 'critical',
                description: 'Found suspicious code patterns'
              });
            }
            
            if (containsSensitiveData(content)) {
              scanResult.riskLevel = 'high';
              scanResult.hasSensitiveData = true;
              scanResult.findings.push({
                type: 'sensitive_data',
                severity: 'high',
                description: 'Found potential sensitive information'
              });
            }
            
            results.push(scanResult);
          }
        } else if (entry.kind === 'directory') {
          // المسح العميق في المجلدات الفرعية
          const subDirHandle = entry as FileSystemDirectoryHandle;
          const subResults = await scanDirectoryForThreats(
            subDirHandle,
            excludedPaths,
            maxDepth,
            currentDepth + 1
          );
          results.push(...(subResults as FileScanResult[]));
        }
      } catch (error) {
        console.warn(`Error scanning entry ${entry.name}:`, error);
        continue;
      }
    }
  } catch (error) {
    console.error('Error scanning directory:', error);
  }
  
  return results;
}

function containsDangerousPatterns(content: string, fileName: string): boolean {
  const dangerousPatterns = [
    /eval\s*\(/gi,
    /exec\s*\(/gi,
    /__import__/gi,
    /subprocess\s*\./gi,
    /os\.system/gi,
    /system\(/gi,
    /rm\s+-rf/gi,
    /format\s+C:/gi,
    /DROP\s+TABLE/gi,
    /DELETE\s+FROM/gi
  ];

  return dangerousPatterns.some(pattern => pattern.test(content));
}

function containsSensitiveData(content: string): boolean {
  const sensitivePatterns = [
    /password\s*[:=]\s*['"][^'"]*['"]/gi,
    /api[_-]?key\s*[:=]\s*['"][^'"]*['"]/gi,
    /secret\s*[:=]\s*['"][^'"]*['"]/gi,
    /token\s*[:=]\s*['"][^'"]*['"]/gi,
    /private[_-]?key\s*[:=]\s*['"][^'"]*['"]/gi,
    /aws_access_key_id/gi,
    /AKIA[0-9A-Z]{16}/gi,
    /-----BEGIN PRIVATE KEY-----/gi
  ];

  return sensitivePatterns.some(pattern => pattern.test(content));
}

export async function serializeFileSystemHandle(
  dirHandle: FileSystemDirectoryHandle
): Promise<string> {
  try {
    return JSON.stringify(await (dirHandle as any).getPermissionStatus());
  } catch (error) {
    console.warn('Cannot serialize handle:', error);
    return '';
  }
}

export async function verifyFileSystemAccess(dirHandle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const permission = await (dirHandle as any).queryPermission({ mode: 'read' });
    return permission === 'granted';
  } catch (error) {
    return false;
  }
}
