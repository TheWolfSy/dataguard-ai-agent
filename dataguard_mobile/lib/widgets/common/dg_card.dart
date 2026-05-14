import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

class DGCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double? height;
  final double? width;
  final bool hoverable;
  final VoidCallback? onTap;

  const DGCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.height,
    this.width,
    this.hoverable = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final card = Container(
      height: height,
      width: width,
      margin: margin,
      padding: padding ?? const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark ? DGColors.surfaceCard : DGColors.surfaceLightCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isDark ? DGColors.borderBlue : DGColors.borderLightBlue,
        ),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withAlpha(80)
                : Colors.black.withAlpha(13),
            blurRadius: 32,
            offset: const Offset(0, 8),
          ),
          if (isDark)
            const BoxShadow(
              color: DGColors.glassHighlight,
              blurRadius: 0,
              offset: Offset(0, 1),
            ),
        ],
      ),
      child: child,
    );

    if (onTap != null) {
      return GestureDetector(
        onTap: onTap,
        child: card,
      );
    }
    return card;
  }
}

class DGStatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? iconColor;

  const DGStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return DGCard(
      padding: const EdgeInsets.all(22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: iconColor ?? DGColors.blue),
              const SizedBox(width: 8),
              Text(
                label.toUpperCase(),
                style: const TextStyle(
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: DGColors.textMutedDark,
                  letterSpacing: 0.08,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: const TextStyle(
              fontSize: 36,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.03,
              color: DGColors.textDark,
              height: 1,
            ),
          ),
        ],
      ),
    );
  }
}
