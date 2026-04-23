import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, X, ArrowDown, Package } from 'lucide-react';
import { versionCheckService, VersionCheckResult } from '../services/versionCheck';

interface UpdateNotificationProps {
  checkOnMount?: boolean;
  checkInterval?: number;
}

export function UpdateNotification({
  checkOnMount = true,
  checkInterval = 0,
}: UpdateNotificationProps) {
  const [updateInfo, setUpdateInfo] = useState<VersionCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const checkForUpdate = useCallback(async () => {
    setIsChecking(true);
    try {
      const result = await versionCheckService.checkForUpdate();
      setUpdateInfo(result);
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    if (checkOnMount) {
      checkForUpdate();
    }
    if (checkInterval > 0) {
      const interval = setInterval(checkForUpdate, checkInterval);
      return () => clearInterval(interval);
    }
  }, [checkOnMount, checkInterval, checkForUpdate]);

  const handleRefresh = useCallback(() => {
    setIsDownloading(true);
    window.location.reload();
  }, []);

  const handleDismiss = useCallback(() => {
    setIsHidden(true);
  }, []);

  if (!updateInfo?.hasUpdate || isHidden) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -100 }}
        className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              <span className="font-medium">تحديث جديد متاح</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm text-blue-100">
              <span>الإصدار الحالي: {updateInfo.currentVersion}</span>
              <span>→</span>
              <span>الإصدار الجديد: {updateInfo.latestVersion}</span>
            </div>
            {updateInfo.changelog && (
              <span className="hidden md:inline text-sm text-blue-100">
                {updateInfo.changelog}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={checkForUpdate}
              disabled={isChecking}
              className="p-2 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
              title="التحقق من التحديثات"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleRefresh}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              <ArrowDown className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
              <span>تحديث الآن</span>
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
              title="تجاهل"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default UpdateNotification;