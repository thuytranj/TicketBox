import 'package:flutter/material.dart';
import '../../core/theme/gate_colors.dart';
import '../../core/theme/gate_spacing.dart';
import '../../core/theme/gate_typography.dart';

/// A centered loading indicator with an optional descriptive message.
///
/// Drop this widget as the sole child of a [Center] or as a full-screen body:
/// ```dart
/// body: const GateLoadingState(message: 'Đang tải dữ liệu...')
/// ```
class GateLoadingState extends StatelessWidget {
  const GateLoadingState({super.key, this.message});

  /// Optional caption displayed below the spinner.
  final String? message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(
            color: GateColors.primary,
            strokeWidth: 3,
          ),
          if (message != null) ...[
            GateSpacing.vertical(GateSpacing.md),
            Text(
              message!,
              style: GateTypography.bodyMedium,
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }
}
