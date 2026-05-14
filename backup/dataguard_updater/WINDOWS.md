# Flutter Windows Desktop Configuration

# This directory contains files needed for Windows Desktop development

# Enable Windows desktop support (run this once)
flutter config --enable-windows-desktop

# Build for Windows
flutter build windows

# Run on Windows
flutter run -d windows

# Create Shorebird release for Windows
shorebird release windows

# Create Shorebird patch for Windows
shorebird patch windows --release-version=1.0.0+1