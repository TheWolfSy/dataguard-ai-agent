# DataGuard AI Agent

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-1.0.0-orange)

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
- Android Studio (for building APK)

## Installation

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

```bash
# Run in development mode
npm run build

# Build for production
npm run build

# Preview the built version
npm run preview

# Clean build files
npm run clean

# TypeScript checking
npm run lint
```

## Building APK for Android

The application uses **Ionic Capacitor** to wrap the web app into a native Android application.

### Prerequisites

- **Android Studio** (includes Android SDK)
- **Java JDK 17+**

### APK Build Steps

```bash
# 1. Build the web app
npm run build

# 2. Copy files to Android project
npx cap copy android

# 3. Open Android Studio
npx cap open android

# 4. In Android Studio:
#    Build → Build Bundle(s) / APK → Build APK
```

The APK will be at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Updating APK after code changes
```bash
npm run build
npx cap copy android
# Then rebuild the APK from Android Studio
```

## Technical Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Framer Motion
- **Mobile**: Ionic Capacitor (Android APK)
- **Database**: PGlite (SQLite in the browser)
- **Encryption**: Web Crypto API (AES-256-GCM)
- **AI**: OpenAI API, Gemini, Claude, Ollama
- **Email**: EmailJS

## Security

- ✅ All passwords are encrypted with AES-256-GCM
- ✅ No sensitive data is stored in plain text
- ✅ Input validation at application and database level
- ✅ Protection against CSRF and XSS
- ✅ Data encryption in transit (TLS)

## Release

### v1.0.0 (Current)
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
| Android APK | v1.0.0 | [Download APK](android/app/build/outputs/apk/debug/app-debug.apk) |
| Web App | v1.0.0 | [Live Demo](https://dataguardai.com) |

## Contributing

We welcome contributions! Please read the contribution guidelines before submitting a pull request.

## License

This project is licensed under the [MIT License](LICENSE).

## Contact

- 📧 Email: support@dataguardai.com
- 🌐 Website: https://dataguardai.com