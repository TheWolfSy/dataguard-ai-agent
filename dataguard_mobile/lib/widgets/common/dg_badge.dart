import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

enum DGBadgeVariant { error, warning, success, info, default_ }

class DGBadge extends StatelessWidget {
  final String label;
  final DGBadgeVariant variant;

  const DGBadge({
    super.key,
    required this.label,
    this.variant = DGBadgeVariant.default_,
  });

  @override
  Widget build(BuildContext context) {
    final colors = _getColors();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(
        color: colors.bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: colors.border),
        boxShadow: [
          BoxShadow(
            color: colors.border.withAlpha(26),
            blurRadius: 8,
          ),
        ],
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          fontSize: 10,
          fontFamily: 'monospace',
          fontWeight: FontWeight.w700,
          letterSpacing: 0.06,
          color: colors.text,
        ),
      ),
    );
  }

  _BadgeColors _getColors() {
    switch (variant) {
      case DGBadgeVariant.error:
        return _BadgeColors(
          bg: const Color(0x2EEF4444),
          text: DGColors.badgeError,
          border: const Color(0x59EF4444),
        );
      case DGBadgeVariant.warning:
        return _BadgeColors(
          bg: const Color(0x26FBBF24),
          text: DGColors.badgeWarning,
          border: const Color(0x52FBBF24),
        );
      case DGBadgeVariant.success:
        return _BadgeColors(
          bg: const Color(0x2634D399),
          text: DGColors.badgeSuccess,
          border: const Color(0x5234D399),
        );
      case DGBadgeVariant.info:
        return _BadgeColors(
          bg: const Color(0x2660A5FA),
          text: DGColors.badgeInfo,
          border: const Color(0x5260A5FA),
        );
      case DGBadgeVariant.default_:
        return _BadgeColors(
          bg: const Color(0x1F94A3B8),
          text: DGColors.textMutedDark,
          border: const Color(0x4094A3B8),
        );
    }
  }
}

class _BadgeColors {
  final Color bg;
  final Color text;
  final Color border;
  _BadgeColors({required this.bg, required this.text, required this.border});
}
