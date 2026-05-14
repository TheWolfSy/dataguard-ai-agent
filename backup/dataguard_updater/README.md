# DataGuard Updater

Flutter application with Shorebird OTA (Over-The-Air) update support.

## Prerequisites

- Flutter SDK 3.22+
- Dart SDK 3.22+

## Installation

1. Clone the repository
2. Install dependencies:

```bash
cd dataguard_updater
flutter pub get
```

## Shorebird Setup

1. Install Shorebird CLI:

```bash
dart pub global activate shorebird_cli
```

2. Initialize Shorebird:

```bash
shorebird init
```

3. Create a release:

```bash
shorebird release android
```

## Development

Run the app:

```bash
flutter run
```

## Creating Updates

After making code changes:

```bash
shorebird patch android
```

This will create a patch and upload it to Shorebird servers. Users will receive the update on next app launch.

## File Structure

```
dataguard_updater/
├── lib/
│   ├── main.dart              # App entry point
│   ├── services/
│   │   └── update_service.dart   # Shorebird integration
│   └── widgets/
│       └── update_banner.dart  # Update notification widget
├── android/                  # Android configuration
├── ios/                     # iOS configuration
├── shorebird.yaml          # Shorebird configuration
└── pubspec.yaml           # Dependencies
```

## How It Works

1. App starts and calls `checkAndUpdate()` in main()
2. Shorebird checks for updates on server
3. If update available, downloads patch
4. On next launch, applies new code

## Limitations

- Only Dart code can be updated via OTA
- Native plugins require app store update
- Flutter engine updates require app store update