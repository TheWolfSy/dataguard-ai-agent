import 'package:shorebird_code_push/shorebird_code_push.dart';

class UpdateService {
  static final UpdateService _instance = UpdateService._internal();
  factory UpdateService() => _instance;
  UpdateService._internal();

  final ShorebirdCodePush _shorebird = ShorebirdCodePush();

  Future<bool> isNewPatchAvailable() async {
    try {
      return await _shorebird.isNewPatchAvailableForDownload();
    } catch (_) {
      return false;
    }
  }

  Future<void> downloadUpdate() async {
    await _shorebird.downloadUpdate();
  }

  Future<bool> isNewPatchReadyToInstall() async {
    try {
      return await _shorebird.isNewPatchReadyToInstall();
    } catch (_) {
      return false;
    }
  }

  Future<int?> currentPatchNumber() async {
    try {
      return await _shorebird.currentPatchNumber();
    } catch (_) {
      return null;
    }
  }

  Future<int?> nextPatchNumber() async {
    try {
      return await _shorebird.nextPatchNumber();
    } catch (_) {
      return null;
    }
  }
}
