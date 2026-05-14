import 'dart:async';
import 'package:flutter/foundation.dart';
import '../services/update_service.dart';

enum UpdateStatus { checking, available, downloading, readyToInstall, upToDate, error, unavailable }

class UpdateProvider extends ChangeNotifier {
  final UpdateService _service = UpdateService();
  Timer? _timer;

  UpdateStatus _status = UpdateStatus.unavailable;
  String _statusMessage = 'Initializing...';
  bool _isChecking = false;
  int? _currentPatch;
  int? _nextPatch;

  UpdateStatus get status => _status;
  String get statusMessage => _statusMessage;
  bool get isChecking => _isChecking;
  bool get hasUpdate => _status == UpdateStatus.available || _status == UpdateStatus.readyToInstall;
  bool get isDownloading => _status == UpdateStatus.downloading;
  int? get currentPatch => _currentPatch;
  int? get nextPatch => _nextPatch;

  UpdateProvider() {
    _init();
  }

  void _init() {
    _checkNow();
    _timer = Timer.periodic(const Duration(minutes: 5), (_) => _checkNow());
  }

  Future<void> _checkNow() async {
    _isChecking = true;
    _status = UpdateStatus.checking;
    _statusMessage = 'Checking for updates...';
    notifyListeners();

    try {
      _currentPatch = await _service.currentPatchNumber();
      final available = await _service.isNewPatchAvailable();
      if (available) {
        _status = UpdateStatus.available;
        _statusMessage = 'Update available!';
        _nextPatch = await _service.nextPatchNumber();
      } else {
        final readyToInstall = await _service.isNewPatchReadyToInstall();
        if (readyToInstall) {
          _status = UpdateStatus.readyToInstall;
          _statusMessage = 'Update ready to install! Restart to apply.';
        } else {
          _status = UpdateStatus.upToDate;
          _statusMessage = 'App is up to date!';
        }
      }
    } catch (e) {
      _status = UpdateStatus.unavailable;
      _statusMessage = 'Update service not available';
    }

    _isChecking = false;
    notifyListeners();
  }

  Future<void> checkForUpdate() async {
    await _checkNow();
  }

  Future<void> downloadUpdate() async {
    _status = UpdateStatus.downloading;
    _statusMessage = 'Downloading update...';
    notifyListeners();

    try {
      await _service.downloadUpdate();
      _status = UpdateStatus.readyToInstall;
      _statusMessage = 'Update ready to install! Restart to apply.';
    } catch (e) {
      _status = UpdateStatus.error;
      _statusMessage = 'Error downloading update';
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
