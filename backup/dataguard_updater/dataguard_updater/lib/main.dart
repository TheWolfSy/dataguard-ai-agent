import 'package:flutter/material.dart';
import 'package:shorebird_code_push/shorebird_code_push.dart';
import 'services/update_service.dart';
import 'widgets/update_banner.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  _initAutoUpdate();
  runApp(const DataGuardUpdaterApp());
}

void _initAutoUpdate() {
  final updateService = UpdateService();
  updateService.checkAndUpdate();
}

class DataGuardUpdaterApp extends StatelessWidget {
  const DataGuardUpdaterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DataGuard Updater',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      home: const UpdaterHomePage(),
    );
  }
}

class UpdaterHomePage extends StatefulWidget {
  const UpdaterHomePage({super.key});

  @override
  State<UpdaterHomePage> createState() => _UpdaterHomePageState();
}

class _UpdaterHomePageState extends State<UpdaterHomePage> {
  String _statusMessage = 'Initializing...';
  bool _isChecking = false;
  bool _hasUpdate = false;
  String _appVersion = '1.0.0';

  @override
  void initState() {
    super.initState();
    _initShorebird();
  }

  Future<void> _initShorebird() async {
    try {
      final updateService = UpdateService();
      updateService.statusStream.listen((status) {
        if (mounted) {
          setState(() {
            switch (status) {
              case CodePushStatus.checkingForUpdate:
                _statusMessage = 'Checking for updates...';
                _isChecking = true;
              case CodePushStatus.updateAvailable:
                _statusMessage = 'Update available!';
                _hasUpdate = true;
                _isChecking = false;
              case CodePushStatus.downloadingUpdate:
                _statusMessage = 'Downloading update...';
              case CodePushStatus.installingUpdate:
                _statusMessage = 'Installing update...';
              case CodePushStatus.updateInstalled:
                _statusMessage = 'Update installed! Restart to apply.';
              case CodePushStatus.noUpdateAvailable:
                _statusMessage = 'App is up to date!';
                _isChecking = false;
              default:
                break;
            }
          });
        }
      });
    } catch (e) {
      setState(() {
        _statusMessage = 'Ready (Shorebird not configured)';
        _isChecking = false;
      });
    }
  }

  Future<void> _checkForUpdates() async {
    setState(() {
      _isChecking = true;
      _statusMessage = 'Checking for updates...';
    });

    try {
      final updateService = UpdateService();
      final result = await updateService.checkForUpdate();
      
      setState(() {
        if (result.hasUpdate) {
          _statusMessage = 'Update available!';
          _hasUpdate = true;
        } else {
          _statusMessage = 'App is up to date!';
        }
        _isChecking = false;
      });
    } catch (e) {
      setState(() {
        _statusMessage = 'Error checking for updates';
        _isChecking = false;
      });
    }
  }

  Future<void> _applyUpdate() async {
    setState(() {
      _statusMessage = 'Downloading update...';
    });

    try {
      final updateService = UpdateService();
      await updateService.downloadUpdate();
      await updateService.installUpdate();
      
      setState(() {
        _statusMessage = 'Update installed! Restart app to apply.';
      });
    } catch (e) {
      setState(() {
        _statusMessage = 'Error applying update';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        title: Text('DataGuard Updater v$_appVersion'),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.system_update_alt,
                size: 100,
                color: Colors.blue,
              ),
              const SizedBox(height: 32),
              Text(
                _statusMessage,
                style: Theme.of(context).textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              if (_hasUpdate)
                ElevatedButton(
                  onPressed: _applyUpdate,
                  child: const Text('Apply Update'),
                )
              else
                ElevatedButton(
                  onPressed: _isChecking ? null : _checkForUpdates,
                  child: _isChecking
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Check for Updates'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}