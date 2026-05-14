import 'package:flutter/material.dart';
import 'package:shorebird_code_push/shorebird_code_push.dart';

class UpdateBanner extends StatefulWidget {
  final Widget child;

  const UpdateBanner({
    super.key,
    required this.child,
  });

  @override
  State<UpdateBanner> createState() => _UpdateBannerState();
}

class _UpdateBannerState extends State<UpdateBanner> {
  @override
  void initState() {
    super.initState();
    _checkForUpdates();
  }

  Future<void> _checkForUpdates() async {
    final updateService = UpdateService();
    final result = await updateService.checkForUpdate();

    if (result.hasUpdate && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('A new update is available!'),
          action: SnackBarAction(
            label: 'Update',
            onPressed: () => _applyUpdate(),
          ),
          duration: const Duration(seconds: 10),
        ),
      );
    }
  }

  Future<void> _applyUpdate() async {
    final updateService = UpdateService();
    await updateService.downloadUpdate();
    await updateService.installUpdate();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<CodePushStatus>(
      stream: UpdateService().statusStream,
      builder: (context, snapshot) {
        if (snapshot.data == CodePushStatus.updateAvailable) {
          return widget.child;
        }
        return widget.child;
      },
    );
  }
}