import 'package:flutter/material.dart';
import '../../core/theme/gate_colors.dart';
import '../../core/theme/gate_spacing.dart';
import '../../core/theme/gate_typography.dart';

/// A centered empty-state placeholder for lists or data screens.
///
/// ```dart
/// GateEmptyState(
///   message: 'Không có sự kiện nào.',
///   icon: Icons.event_busy_outlined,
/// )
/// ```
class GateEmptyState extends StatelessWidget {
  const GateEmptyState({
    super.key,
    required this.message,
    this.icon = Icons.inbox_outlined,
    this.action,
  });

  /// Message displayed below the icon.
  final String message;

  /// Icon to display — defaults to an inbox outline.
  final IconData icon;

  /// Optional action widget (e.g. a [GateButton]) shown below the message.
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: GateSpacing.all(GateSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 64,
              color: GateColors.onSurfaceSub,
            ),
            GateSpacing.vertical(GateSpacing.md),
            Text(
              message,
              style: GateTypography.bodyMedium
                  .copyWith(color: GateColors.onSurfaceSub),
              textAlign: TextAlign.center,
            ),
            if (action != null) ...[
              GateSpacing.vertical(GateSpacing.lg),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}
