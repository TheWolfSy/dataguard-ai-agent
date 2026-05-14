import 'package:shorebird_code_push/shorebird_code_push.dart';

class UpdateService {
  static final UpdateService _instance = UpdateService._internal();
  factory UpdateService() => _instance;
  UpdateService._internal();

  final ShorebirdCodePush _shorebirdCodePush = ShorebirdCodePush();
  bool _isChecking = false;

  Future<UpdateCheckResult> checkForUpdate() async {
    if (_isChecking) {
      return UpdateCheckResult(
        hasUpdate: false,
        status: UpdateCheckStatus.alreadyChecking,
      );
    }

    _isChecking = true;
    try {
      final result = await _shorebirdCodePush.checkForUpdate();
      return result;
    } finally {
      _isChecking = false;
    }
  }

  Future<DownloadUpdateResult> downloadUpdate() async {
    final result = await _shorebirdCodePush.downloadUpdate();
    return result;
  }

  Future<InstallUpdateResult> installUpdate() async {
    final result = await _shorebirdCodePush.installUpdate();
    return result;
  }

  Future<void> checkAndUpdate() async {
    final checkResult = await checkForUpdate();
    
    if (checkResult.hasUpdate) {
      final downloadResult = await downloadUpdate();
      
      if (downloadResult.downloadSuccessful) {
        await installUpdate();
      }
    }
  }

  Stream<CodePushStatus> get statusStream =>
      _shorebirdCodePush.codePushStatusStream;
}