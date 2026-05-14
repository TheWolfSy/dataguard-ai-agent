import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/common/dg_card.dart';
import '../../widgets/common/dg_badge.dart';
import '../../providers/theme_provider.dart';
import '../../providers/update_provider.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(28),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 600),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Settings',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: DGColors.textDark,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Manage your application preferences and updates.',
              style: TextStyle(
                fontSize: 11,
                color: DGColors.textMutedDark.withAlpha(179),
              ),
            ),
            const SizedBox(height: 24),
            _buildSection(
              title: 'PREFERENCES',
              child: Column(
                children: [
                  _buildThemeToggle(context),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _buildSection(
              title: 'UPDATES',
              child: Column(
                children: [
                  _buildUpdateSection(context),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _buildDangerSection(context),
          ],
        ),
      ),
    );
  }

  Widget _buildSection({required String title, required Widget child}) {
    return DGCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 10,
                fontFamily: 'monospace',
                fontWeight: FontWeight.w700,
                color: DGColors.textMutedDark,
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }

  Widget _buildThemeToggle(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();

    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Theme Mode',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: DGColors.textDark,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'Switch between dark and light theme.',
                style: TextStyle(
                  fontSize: 10,
                  color: DGColors.textMutedDark.withAlpha(179),
                ),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: DGColors.surfaceDark.withAlpha(102),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: DGColors.borderBlue),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildThemeButton(
                icon: Icons.dark_mode,
                label: 'DARK',
                isSelected: themeProvider.isDark,
                onTap: () => themeProvider.setDark(true),
              ),
              const SizedBox(width: 4),
              _buildThemeButton(
                icon: Icons.light_mode,
                label: 'LIGHT',
                isSelected: !themeProvider.isDark,
                onTap: () => themeProvider.setDark(false),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildThemeButton({
    required IconData icon,
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? DGColors.surfaceDark : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: isSelected
              ? Border.all(color: DGColors.borderBlue.withAlpha(77))
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: isSelected ? DGColors.textDark : DGColors.textMutedDark),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: isSelected ? DGColors.textDark : DGColors.textMutedDark,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildUpdateSection(BuildContext context) {
    final updateProvider = context.watch<UpdateProvider>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'App Updates',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: DGColors.textDark,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    updateProvider.statusMessage,
                    style: TextStyle(
                      fontSize: 10,
                      color: DGColors.textMutedDark.withAlpha(179),
                    ),
                  ),
                ],
              ),
            ),
            if (updateProvider.isChecking)
              const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            else
              InkWell(
                onTap: () => updateProvider.checkForUpdate(),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: DGColors.accent.withAlpha(25),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: DGColors.accent.withAlpha(64)),
                  ),
                  child: const Icon(Icons.refresh, size: 16, color: DGColors.accent),
                ),
              ),
          ],
        ),
        if (updateProvider.hasUpdate) ...[
          const SizedBox(height: 12),
          Row(
            children: [
              const DGBadge(label: 'UPDATE AVAILABLE', variant: DGBadgeVariant.warning),
              const Spacer(),
              ElevatedButton.icon(
                onPressed: updateProvider.isDownloading
                    ? null
                    : () => updateProvider.downloadUpdate(),
                icon: const Icon(Icons.download, size: 14),
                label: Text(updateProvider.isDownloading ? 'DOWNLOADING...' : 'UPDATE NOW'),
              ),
            ],
          ),
        ],
        if (updateProvider.currentPatch != null) ...[
          const SizedBox(height: 8),
          Text(
            'Patch: ${updateProvider.currentPatch}',
            style: const TextStyle(
              fontSize: 9,
              fontFamily: 'monospace',
              color: DGColors.textMutedDark,
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildDangerSection(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: DGColors.critical.withAlpha(25),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: DGColors.critical.withAlpha(64)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning_amber_rounded, size: 20, color: DGColors.warning),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ADVANCED SETTINGS',
                  style: TextStyle(
                    fontSize: 10,
                    fontFamily: 'monospace',
                    fontWeight: FontWeight.w700,
                    color: DGColors.warning,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Modifying advanced settings may affect application behavior. Proceed with caution.',
                  style: TextStyle(
                    fontSize: 10,
                    color: DGColors.warning.withAlpha(179),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
