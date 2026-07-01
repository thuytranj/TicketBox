import 'package:flutter/material.dart';
import '../../core/theme/gate_colors.dart';
import '../../core/theme/gate_spacing.dart';
import '../../core/theme/gate_typography.dart';
import 'gate_button.dart';

/// Categorizes the type of error for [GateErrorState].
enum GateErrorType { network, server, unknown }

/// A full-area error state with a typed icon, message, and optional retry.
///
/// ```dart
/// GateErrorState(
///   message: 'Không thể tải dữ liệu. Kiểm tra kết nối mạng.',
///   type: GateErrorType.network,
///   onRetry: () => provider.fetchData(),
/// )
/// ```
class GateErrorState extends StatelessWidget {
  const GateErrorState({
    super.key,
    required this.message,
    this.onRetry,
    this.type = GateErrorType.unknown,
  });

  /// Human-readable error description.
  final String message;

  /// If non-null, a "Thử lại" button is shown.
  final VoidCallback? onRetry;

  /// Controls the displayed icon.
  final GateErrorType type;

  @override
  Widget build(BuildContext context) {
    final icon = switch (type) {
      GateErrorType.network => Icons.wifi_off_rounded,
      GateErrorType.server => Icons.cloud_off_rounded,
      GateErrorType.unknown => Icons.error_outline_rounded,
    };

    return Center(
      child: Padding(
        padding: GateSpacing.all(GateSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 48,
              color: GateColors.scanInvalid.primary,
            ),
            GateSpacing.vertical(GateSpacing.md),
            Text(
              message,
              style: GateTypography.bodyLarge,
              textAlign: TextAlign.center,
            ),
            if (onRetry != null) ...[
              GateSpacing.vertical(GateSpacing.lg),
              GateButton(
                label: 'Thử lại',
                onPressed: onRetry,
                icon: Icons.refresh_rounded,
                variant: GateButtonVariant.secondary,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
