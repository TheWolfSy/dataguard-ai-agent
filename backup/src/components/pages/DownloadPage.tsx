import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Monitor, Cpu, HardDrive, CheckCircle, Info, ExternalLink } from 'lucide-react';
import { useLanguage } from '../../i18n/useLanguage';

export function DownloadPage() {
  const { t, language } = useLanguage();
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const link = document.createElement('a');
      link.href = '/install/DataGuard-Setup.exe';
      link.download = 'DataGuard-Setup.exe';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloaded(true);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloading(false);
    }
  };

  const requirements = [
    {
      icon: Monitor,
      label: language === 'ar' ? 'نظام التشغيل' : 'Operating System',
      value: 'Windows 10 / 11 (64-bit)',
    },
    {
      icon: Cpu,
      label: language === 'ar' ? 'المعالج' : 'Processor',
      value: 'Intel Core i5 / AMD Ryzen 5 or better',
    },
    {
      icon: HardDrive,
      label: language === 'ar' ? 'الذاكرة المؤقتة' : 'RAM',
      value: '4 GB minimum (8 GB recommended)',
    },
    {
      icon: HardDrive,
      label: language === 'ar' ? 'مساحة التخزين' : 'Storage',
      value: '200 MB available space',
    },
  ];

  const features = [
    language === 'ar' ? 'حماية البيانات بالذكاء الاصطناعي' : 'AI-powered Data Protection',
    language === 'ar' ? 'كشف PII التلقائي' : 'Automatic PII Detection',
    language === 'ar' ? 'إدارة كلمات المرور المشفرة' : 'Encrypted Password Manager',
    language === 'ar' ? 'مراقبة الشبكة المستمرة' : 'Continuous Network Monitoring',
    language === 'ar' ? 'لوحة تحكم تفاعلية' : 'Interactive Dashboard',
  ];

  const installSteps = language === 'ar' ? [
    'قم بتنزيل ملف التثبيت',
    'افتح الملف وقم بتشغيل معالج التثبيت',
    'اتبع التعليمات على الشاشة',
    'أدخل مفاتيح API المطلوبة عند أول تشغيل',
    'ابدأ حماية بياناتك',
  ] : [
    'Download the installer file',
    'Open the file and run the setup wizard',
    'Follow the on-screen instructions',
    'Enter your API keys on first launch',
    'Start protecting your data',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-3 mb-4">
            <Download className="w-10 h-10 text-blue-500" />
            <h1 className="text-4xl font-bold text-white">
              {language === 'ar' ? 'تنزيل التطبيق' : 'Download App'}
            </h1>
          </div>
          <p className="text-zinc-400 text-lg">
            {language === 'ar' 
              ? 'احصل على تطبيق DataGuard AI كتطبيق سطح مكتب مستقل'
              : 'Get DataGuard AI as a standalone desktop application'}
          </p>
        </motion.div>

        {/* System Requirements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-blue-500" />
            {language === 'ar' ? 'متطلبات النظام' : 'System Requirements'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requirements.map((req, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50"
              >
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <req.icon className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-zinc-400 text-sm">{req.label}</p>
                  <p className="text-white font-medium">{req.value}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Download Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-blue-900/30 to-zinc-900/50 border border-blue-500/30 rounded-2xl p-8 mb-6"
        >
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-full mb-4">
              <span className="text-blue-400 text-sm font-medium">Tauri App</span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-400 text-sm">~50 MB</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              DataGuard AI v1.0.0
            </h3>
            <p className="text-zinc-400 mb-6">
              {language === 'ar' 
                ? 'تطبيق سطح مكتب سريع ومحمول يعمل بدون متصفح'
                : 'Fast, portable desktop app that runs without a browser'}
            </p>
            <motion.button
              onClick={handleDownload}
              disabled={downloading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`
                inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg
                ${downloaded 
                  ? 'bg-green-600 text-white' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white'}
                transition-colors duration-200
              `}
            >
              {downloading ? (
                <>
                  <span className="animate-spin">
                    <Download className="w-5 h-5" />
                  </span>
                  {language === 'ar' ? 'جارٍ التنزيل...' : 'Downloading...'}
                </>
              ) : downloaded ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  {language === 'ar' ? 'تم التنزيل!' : 'Downloaded!'}
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  {language === 'ar' ? 'تنزيل التطبيق' : 'Download App'}
                </>
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            {language === 'ar' ? 'مميزات التطبيق' : 'Features'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-zinc-800/30 rounded-lg"
              >
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-zinc-300">{feature}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Installation Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Info className="w-5 h-5 text-yellow-500" />
            {language === 'ar' ? 'خطوات التثبيت' : 'Installation Steps'}
          </h2>
          <div className="space-y-4">
            {installSteps.map((step, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center">
                  <span className="text-blue-400 font-bold text-sm">{index + 1}</span>
                </div>
                <p className="text-zinc-300 pt-1">{step}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-200 font-medium mb-1">
                {language === 'ar' ? 'ملاحظة مهمة' : 'Important Note'}
              </p>
              <p className="text-yellow-100/80 text-sm">
                {language === 'ar' 
                  ? 'عند أول تشغيل للتطبيق، ستحتاج لإدخال مفاتيح API الخاصة بك (GEMINI_API_KEY و Firebase config). هذه المفاتيح ليست مضمنة في التطبيق.'
                  : 'On first launch, you will need to enter your API keys (GEMINI_API_KEY and Firebase config). These keys are not included in the app.'}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}