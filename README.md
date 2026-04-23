# DataGuard AI Agent

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-1.0.0-orange)

> منصة أمان ذكاء اصطناعي لحماية البيانات ومنع التهديدات الأمنية

## نظرة عامة

DataGuard AI هو وكيل أمان متقدم يستخدم الذكاء الاصطناعي لحماية بياناتك ومنع التهديدات الأمنية. يوفر التطبيق:

- 🔒 **إدارة كلمات المرور**: تخزين آمن ومشفير بكلمات المرور باستخدام AES-256-GCM
- 🛡️ **فحص أمني**: فحص البيانات والمحتوى للكشف عن تهديدات أمنية
- 📊 **لوحة تحكم**: مراقبة النشاط الأمني والتهديدات في الوقت الفعلي
- 📧 **مراقبة البريد**: فحص رسائل البريد الإلكتروني للكشف عن محاولات التصيد
- 🔍 **قاعدة بيانات الثغرات**: مزامنة تلقائية مع قاعدة بيانات NVD للثغرات المعروفة
- 🤖 **وكيل ذكي**: مساعد ذكي يستخدم نماذج لغوية متقدمة للإجابة على استفسارات الأمان

## المتطلبات

- Node.js 18+
- npm أو yarn
- متصفح ويب حديث (Chrome, Firefox, Safari, Edge)

## التثبيت

```bash
# استنساخ المستودع
git clone https://github.com/your-repo/dataguard-ai-agent.git
cd dataguard-ai-agent

# تثبيت التبعيات
npm install

# نسخ ملف البيئة وتعديله
cp .env.example .env
# ثم قم بتعديل .env وإضافة مفاتيح API الخاصة بك

# تشغيل في وضع التطوير
npm run dev
```

## إعداد المتغيرات البيئية

أنشئ ملف `.env` في جذر المشروع وأضف المتغيرات التالية:

```env
# مفاتيح Firebase
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_APP_ID=your_app_id
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_DATABASE_ID=your_database_id
FIREBASE_STORAGE_BUCKET=your_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_sender_id

# Gemini API (اختياري)
GEMINI_API_KEY=your_gemini_api_key

# EmailJS (لإرسال رسائل البريد الإلكتروني)
VITE_EMAILJS_SERVICE_ID=service_xxxxxxx
VITE_EMAILJS_TEMPLATE_ID=template_xxxxxxx
VITE_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxxxxxxx

# NVD API (لقاعدة بيانات الثغرات)
VITE_NVD_API_KEY=your_nvd_api_key

# Ollama (للتشغيل المحلي - اختياري)
VITE_OLLAMA_URL=http://localhost:11434
VITE_OLLAMA_MODEL=deepseek-coder:1.3b

# Dev Bypass (للتطوير فقط - لا تستخدم في الإنتاج!)
VITE_DEV_BYPASS_EMAIL=dev@example.com
VITE_DEV_BYPASS_PASSWORD=your_dev_password
```

## الأوامر المتاحة

```bash
# تشغيل في وضع التطوير
npm run dev

# البناء للإنتاج
npm run build

# معاينة النسخة المبنية
npm run preview

# تنظيف ملفات البناء
npm run clean

# فحص TypeScript
npm run lint
```

## البنية التقنية

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Framer Motion
- **Database**: PGlite (SQLite في المتصفح)
- **Encryption**: Web Crypto API (AES-256-GCM)
- **AI**: OpenAI API, Gemini, Claude, Ollama
- **Email**: EmailJS

## الأمان

- ✅ جميع كلمات المرور مشفرة بـ AES-256-GCM
- ✅ لا يتم تخزين أي بيانات حساسة بشكل نص عادي
- ✅ التحقق من صحة المدخلات على مستوى التطبيق وقاعدة البيانات
- ✅ حماية من CSRF و XSS
- ✅ تشفير البيانات أثناء النقل (TLS)

## المساهمة

نرحب بالمساهمات! يرجى قراءة إرشادات المساهمة قبل إرسال طلب سحب.

## الترخيص

هذا المشروع مرخص بموجب [MIT License](LICENSE).

## التواصل

- 📧 البريد الإلكتروني: support@dataguardai.com
- 🌐 الموقع: https://dataguardai.com