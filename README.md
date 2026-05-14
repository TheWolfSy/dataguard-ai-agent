# DataGuard AI Agent

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-2.0.0-orange)

> AI-powered security platform for data protection and threat prevention

## Overview

DataGuard AI is an advanced security agent that uses artificial intelligence to protect your data and prevent security threats. The application provides:

- 🔒 **Password Management**: Secure storage and encrypted passwords using AES-256-GCM
- 🛡️ **Security Scanning**: Scan data and content to detect security threats
- 📊 **Dashboard**: Monitor security activity and threats in real-time
- 📧 **Email Monitoring**: Scan email messages to detect phishing attempts
- 🔍 **Vulnerability Database**: Automatic synchronization with NVD database for known vulnerabilities
- 🤖 **Smart Agent**: Intelligent assistant using advanced language models to answer security queries

## Requirements

- Node.js 18+
- npm or yarn
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Flutter SDK 3.41.9+ (for mobile builds)
- Android Studio (for Android builds)
- Xcode (for iOS builds)

## Installation

### Web App (React)

```bash
# Clone the repository
git clone https://github.com/your-repo/dataguard-ai-agent.git
cd dataguard-ai-agent

# Install dependencies
npm install

# Copy and modify the environment file
cp .env.example .env
# Then edit .env and add your API keys

# Run in development mode
npm run dev
```

### Mobile App (Flutter)

```bash
cd dataguard_mobile

# Get Flutter dependencies
flutter pub get

# Run on connected device
flutter run

# Build for Android
flutter build apk --release

# Build for iOS
flutter build ios --release
```

## Environment Variables

Create a `.env` file in the project root and add the following variables:

```env
# Firebase Keys
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_APP_ID=your_app_id
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_DATABASE_ID=your_database_id
FIREBASE_STORAGE_BUCKET=your_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_sender_id

# Gemini API (optional)
GEMINI_API_KEY=your_gemini_api_key

# EmailJS (for sending emails)
VITE_EMAILJS_SERVICE_ID=service_xxxxxxx
VITE_EMAILJS_TEMPLATE_ID=template_xxxxxxx
VITE_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxxxxxxx

# NVD API (for vulnerability database)
VITE_NVD_API_KEY=your_nvd_api_key

# Ollama (for local running - optional)
VITE_OLLAMA_URL=http://localhost:11434
VITE_OLLAMA_MODEL=deepseek-coder:1.3b

# Dev Bypass (for development only - do not use in production!)
VITE_DEV_BYPASS_EMAIL=dev@example.com
VITE_DEV_BYPASS_PASSWORD=your_dev_password
```

## Available Commands

### Web App
```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Preview the built version
npm run preview

# Clean build files
npm run clean

# TypeScript checking
npm run lint
```

### Mobile App
```bash
# Analyze Dart code
cd dataguard_mobile
flutter analyze

# Run tests
flutter test

# Build for Android
flutter build apk --release

# Build for iOS (macOS only)
flutter build ios --release

# Shorebird OTA update
shorebird patch --flavor=production
```

## Mobile App (Flutter)

The mobile version is built with **Flutter** and replaces the previous Ionic Capacitor wrapper. It provides a native experience on both Android and iOS with the same feature set as the web app.

### Features

- **Cross-platform**: Android & iOS from a single codebase
- **Over-the-Air Updates**: Powered by Shorebird Code Push for instant updates without app store review
- **Glassmorphism UI**: Native recreation of the web app's glassmorphism design
- **Firebase Auth**: Secure authentication with email/password
- **RTL Support**: Full Arabic (RTL) and English localization
- **Dark/Light Theme**: Persistent theme preference
- **Real-time Dashboard**: Stat cards, recent logs, threat breakdown
- **Data Logs**: Searchable, filterable log viewer
- **Security Policies**: Policy management with sync status
- **Profile Management**: Account info and security settings

### Project Structure

```
dataguard_mobile/
├── lib/
│   ├── main.dart              # App entry point with providers
│   ├── app.dart               # MaterialApp with auth gating
│   ├── i18n/                  # Translations (EN/AR)
│   ├── theme/                 # Colors, ThemeData (glassmorphism)
│   ├── models/                # Data models
│   ├── services/              # Firebase config, auth, updates
│   ├── providers/             # State management (Provider)
│   ├── screens/
│   │   ├── auth/              # Login / Register / Recover
│   │   ├── home/              # Shell with sidebar
│   │   ├── dashboard/         # Main dashboard
│   │   ├── logs/              # Data logs viewer
│   │   ├── policies/          # Security policies
│   │   ├── profile/           # User profile
│   │   └── settings/          # App settings & updates
│   └── widgets/               # Reusable UI components
├── android/                   # Android native project
└── pubspec.yaml               # Dart dependencies
```

### Tech Stack

- **Framework**: Flutter 3.41.9
- **State Management**: Provider
- **Authentication**: Firebase Auth
- **Local Storage**: SharedPreferences
- **OTA Updates**: Shorebird Code Push
- **UI**: Material 3 + Custom glassmorphism theming
- **Encryption**: encrypt package (AES-256)

## Building APK for Android

The application can be built as a native Android app using either the legacy Capacitor build or the new Flutter build.

### Flutter APK Build

```bash
cd dataguard_mobile

# Debug APK
flutter build apk --debug

# Release APK
flutter build apk --release

# App Bundle (for Play Store)
flutter build appbundle --release
```

The APK will be at:
```
dataguard_mobile/build/app/outputs/flutter-apk/app-release.apk
```

### Capacitor APK Build (Legacy)

```bash
# 1. Build the web app
npm run build

# 2. Copy files to Android project
npx cap copy android

# 3. Open Android Studio
npx cap open android

# 4. In Android Studio: Build → Build Bundle(s) / APK → Build APK
```

## Technical Stack

- **Frontend (Web)**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Framer Motion
- **Mobile**: Flutter (native Android & iOS)
- **Database**: PGlite (SQLite in the browser)
- **Encryption**: Web Crypto API (AES-256-GCM)
- **AI**: OpenAI API, Gemini, Claude, Ollama
- **Email**: EmailJS
- **OTA Updates**: Shorebird Code Push

## Security

- ✅ All passwords are encrypted with AES-256-GCM
- ✅ No sensitive data is stored in plain text
- ✅ Input validation at application and database level
- ✅ Protection against CSRF and XSS
- ✅ Data encryption in transit (TLS)
- ✅ Firebase security rules for data access

## Release

### v2.0.0 (Current - Beta)
- Flutter mobile app replacing Ionic Capacitor
- Native Android & iOS support
- Shorebird OTA update system
- Full glassmorphism UI recreation
- Firebase authentication
- Dashboard, Logs, Policies, Profile, Settings screens
- Dark/Light theme with RTL support

### v1.0.0
- Initial release of DataGuard AI Agent
- Password management with AES-256-GCM encryption
- Real-time security dashboard
- Email monitoring for phishing detection
- Vulnerability database sync with NVD
- Smart AI agent for security queries
- Android APK support via Ionic Capacitor
- Firebase hosting deployment ready

### Downloads

| Platform | Version | Link |
|----------|---------|------|
| Android APK (Flutter) | v2.0.0-beta | [Download APK](dataguard_mobile/build/app/outputs/flutter-apk/app-release.apk) |
| Android APK (Legacy) | v1.0.0 | [Download APK](android/app/build/outputs/apk/debug/app-debug.apk) |
| Web App | v1.0.0 | [Live Demo](https://dataguardai.com) |

## Contributing

We welcome contributions! Please read the contribution guidelines before submitting a pull request.

## License

This project is licensed under the [MIT License](LICENSE).

## Contact

- 📧 Email: support@dataguardai.com
- 🌐 Website: https://dataguardai.com