import 'package:flutter/material.dart';
import '../../core/theme/gate_colors.dart';
import '../../core/theme/gate_radii.dart';
import '../../core/theme/gate_spacing.dart';
import '../../core/theme/gate_typography.dart';

/// Scan-result status categories.
enum ScanStatus { valid, alreadyUsed, notFound, error }

/// A pill-shaped chip that displays a scan result status.
///
/// Always uses both icon + label — never relies on color alone.
///
/// ```dart
/// StatusChip(status: ScanStatus.valid)
/// StatusChip(status: ScanStatus.alreadyUsed, showLabel: false)
/// ```
class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.status,
    this.showLabel = true,
  });

  final ScanStatus status;

  /// Whether to render the text label. Icon is always visible.
  final bool showLabel;

  @override
  Widget build(BuildContext context) {
    final (color, icon, label) = _resolve(status);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: GateSpacing.sm + GateSpacing.xs,
        vertical: GateSpacing.xs + 2,
      ),
      decoration: BoxDecoration(
        color: color.container,
        borderRadius: GateRadii.full,
        border: Border.all(color: color.primary.withValues(alpha: 0.4), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color.primary, size: 14),
          if (showLabel) ...[
            GateSpacing.horizontal(GateSpacing.xs),
            Text(
              label,
              style: GateTypography.label.copyWith(color: color.primary),
            ),
          ],
        ],
      ),
    );
  }

  static (GateScanColor, IconData, String) _resolve(ScanStatus status) {
    return switch (status) {
      ScanStatus.valid => (
          GateColors.scanValid,
          Icons.check_circle_outline_rounded,
          'HỢP LỆ',
        ),
      ScanStatus.alreadyUsed => (
          GateColors.scanUsed,
          Icons.warning_amber_rounded,
          'ĐÃ DÙNG',
        ),
      ScanStatus.notFound => (
          GateColors.scanInvalid,
          Icons.cancel_outlined,
          'KHÔNG TỒN TẠI',
        ),
      ScanStatus.error => (
          GateColors.scanError,
          Icons.error_outline_rounded,
          'LỖI',
        ),
    };
  }
}
