import 'package:flutter/material.dart';
import '../../../core/theme/gate_colors.dart';
import '../../../core/theme/gate_radii.dart';
import '../../../core/theme/gate_spacing.dart';
import '../../../core/theme/gate_typography.dart';

/// A compact card that displays a single dashboard metric for the check-in
/// readiness screen.
///
/// Shows an [icon] + [label] header above a large [value] text. Use
/// [accentColor] to tint the icon and value for visual differentiation.
///
/// ```dart
/// DashboardStatCard(
///   label: 'Vé còn lại',
///   value: '342',
///   icon: Icons.local_activity_outlined,
///   accentColor: GateColors.primary,
/// )
/// ```
class DashboardStatCard extends StatelessWidget {
  const DashboardStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.accentColor = GateColors.primary,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: GateSpacing.xs,
          vertical: GateSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: GateColors.surface,
          borderRadius: GateRadii.md,
          border: Border.all(color: GateColors.border, width: 1),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.max,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: accentColor, size: 20),
            GateSpacing.vertical(GateSpacing.xs),
            Text(
              label,
              style: GateTypography.caption.copyWith(
                color: GateColors.onSurfaceSub,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            GateSpacing.vertical(GateSpacing.xs),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                value,
                style: GateTypography.heading1.copyWith(
                  color: accentColor,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
