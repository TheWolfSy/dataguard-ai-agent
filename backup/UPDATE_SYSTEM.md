# DataGuard AI - نظام التحديث التلقائي

## نظرة عامة

هذا المشروع يحتوي على نظامين للتحديث:

1. **Web App** - للتطبيق الويب (React/Vite)
2. **Flutter Desktop** - لتطبيق Windows Desktop

---

## هيكل الملفات

```
dataguard-ai-agent/
├── .github/workflows/
│   └── deploy.yml              # CI/CD للنشر التلقائي
├── public/api/
│   └── version.json           # ملف معلومات الإصدار
├── src/
│   ├── services/
│   │   └── versionCheck.ts   # خدمة التحقق من الإصدار
│   └── components/
│       └── UpdateNotification.tsx  # واجهة الإشعار
└── dataguard_updater/         # تطبيق Flutter Desktop
    ├── lib/
    │   └── main.dart    # مع Shorebird
    └── shorebird.yaml  # إعدادات Shorebird
```

---

## Web App - نظام التحديث

### ملف API

```json
// GET /api/version.json
{
  "version": "1.0.0",
  "releaseDate": "2026-04-22T00:00:00Z",
  "buildNumber": 1,
  "changelog": "Initial release",
  "minVersion": "1.0.0"
}
```

### Workflow التلقائي

عند كل `push` إلى `main`:
1. GitHub Actions يبني التطبيق
2. ينشر إلى Firebase Hosting
3. يحدث `version.json`
4. يظهر إشعار للتحديث عند فتح التطبيق

---

## Flutter Desktop - نظام التحديث

### Shorebird

```bash
# تهيئة Shorebird
shorebird init

# إنشاء Release
shorebird release windows

# إنشاء Patch للتحديث
shorebird patch windows --release-version=1.0.0+1
```

---

## تفعيل التحديث

### Web

التحديث يحدث تلقائياً عند كل نشر. لكن للتحديث الفوري:

```bash
# GitHub Actions يعمل تلقائياً
# أو:
npm run build
firebase deploy
```

### Windows Desktop

```bash
# بعد تعديل الكود
shorebird patch windows
```

---

## القيود

| الميزة | Web | Windows Desktop |
|--------|-----|-------------|
| تحديث تلقائي | ✅ CI/CD | ✅ Shorebird |
| تحديث OTA حقيقي | ❌ | ✅ Shorebird |
| الدعم العكسي | ✅ | ✅ Shorebird |

---

## المراجع

- [Shorebird Documentation](https://docs.shorebird.dev)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)
- [GitHub Actions](https://docs.github.com/en/actions)