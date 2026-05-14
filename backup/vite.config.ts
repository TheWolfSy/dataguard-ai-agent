import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['logo.png', 'favicon.ico', 'robots.txt'],
        manifest: {
          name: 'DataGuard AI',
          short_name: 'DataGuard',
          description: 'نظام حماية البيانات بالذكاء الاصطناعي',
          theme_color: '#09090b',
          background_color: '#09090b',
          display: 'standalone',
          orientation: 'any',
          scope: '/',
          start_url: '/',
          icons: [
            { src: '/logo.png', sizes: '192x192', type: 'image/png' },
            { src: '/logo.png', sizes: '512x512', type: 'image/png' },
            { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // ذاكرة تخزين مؤقتة للملفات الثابتة
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // استراتيجية Network First للـ API / Stale-While-Revalidate للأصول
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/generativelanguage\.googleapis\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'gemini-api-cache',
                networkTimeoutSeconds: 10,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/api\.openai\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'openai-api-cache',
                networkTimeoutSeconds: 15,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    // جميع المفاتيح الحساسة يجب أن تأتي من متغيرات البيئة فقط
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.DATA_ENCRYPTION_KEY': JSON.stringify(env.DATA_ENCRYPTION_KEY),
      'process.env.FIREBASE_API_KEY': JSON.stringify(env.FIREBASE_API_KEY),
      'process.env.FIREBASE_PROJECT_ID': JSON.stringify(env.FIREBASE_PROJECT_ID),
      'process.env.FIREBASE_APP_ID': JSON.stringify(env.FIREBASE_APP_ID),
      'process.env.FIREBASE_AUTH_DOMAIN': JSON.stringify(env.FIREBASE_AUTH_DOMAIN),
      'process.env.FIREBASE_DATABASE_ID': JSON.stringify(env.FIREBASE_DATABASE_ID),
      'process.env.FIREBASE_STORAGE_BUCKET': JSON.stringify(env.FIREBASE_STORAGE_BUCKET),
      'process.env.FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.FIREBASE_MESSAGING_SENDER_ID),
      'process.env.FIREBASE_MEASUREMENT_ID': JSON.stringify(env.FIREBASE_MEASUREMENT_ID),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      exclude: ['@electric-sql/pglite'],
    },
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 2000,
      minify: 'esbuild',
      cssMinify: true,
      reportCompressedSize: true,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            // مكتبات React الأساسية
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'vendor-react';
            }
            // مكتبة الحركة
            if (id.includes('node_modules/motion/')) {
              return 'vendor-motion';
            }
            // أيقونات Lucide
            if (id.includes('node_modules/lucide-react/')) {
              return 'vendor-icons';
            }
            // مكتبات الذكاء الاصطناعي
            if (id.includes('node_modules/openai/') || id.includes('node_modules/@google/genai/')) {
              return 'vendor-ai';
            }
            // التشفير
            if (id.includes('node_modules/crypto-js/')) {
              return 'vendor-crypto';
            }
            // PGlite — يبقى في chunk منفصl تلقائياً
          },
        },
        onwarn(warning: any, defaultHandler) {
          if (warning?.code === 'EVAL' && typeof warning?.id === 'string' && warning.id.includes('@electric-sql/pglite')) {
            return;
          }
          if (
            warning?.code === 'MISSING_EXPORT' &&
            typeof warning?.id === 'string' &&
            warning.id.includes('@electric-sql/pglite/dist/fs/nodefs.js') &&
            typeof warning?.message === 'string' &&
            warning.message.includes('__vite-browser-external')
          ) {
            return;
          }
          defaultHandler(warning);
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
