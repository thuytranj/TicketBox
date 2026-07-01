import 'package:flutter/material.dart';
import '../../core/theme/gate_colors.dart';
import '../../core/theme/gate_spacing.dart';

/// Variants for [GateButton].
enum GateButtonVariant { primary, secondary, tertiary }

/// A standardized button for the Gate App with three visual variants.
///
/// - [primary] — main CTA, full-width capable, 56dp height, filled.
/// - [secondary] — supporting action, 48dp height, outlined.
/// - [tertiary] — low-emphasis text-only action.
///
/// The button respects [isLoading] and disables interaction while showing a
/// compact spinner. Pass `onPressed: null` to render the disabled state.
class GateButton extends StatelessWidget {
  const GateButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.isLoading = false,
    this.variant = GateButtonVariant.primary,
    this.fullWidth = false,
  });

  /// Button label text.
  final String label;

  /// Callback — set to `null` to disable.
  final VoidCallback? onPressed;

  /// Optional leading icon.
  final IconData? icon;

  /// Shows a spinner and disables the button when true.
  final bool isLoading;

  /// Visual style variant.
  final GateButtonVariant variant;

  /// Expands button to fill available width.
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    final effectiveCallback = isLoading ? null : onPressed;
    final child = _buildChild();

    Widget button;
    switch (variant) {
      case GateButtonVariant.primary:
        button = FilledButton(
          onPressed: effectiveCallback,
          style: FilledButton.styleFrom(
            minimumSize: Size(fullWidth ? double.infinity : 200, 56),
          ),
          child: child,
        );
      case GateButtonVariant.secondary:
        button = OutlinedButton(
          onPressed: effectiveCallback,
          style: OutlinedButton.styleFrom(
            minimumSize: Size(fullWidth ? double.infinity : 120, 48),
          ),
          child: child,
        );
      case GateButtonVariant.tertiary:
        button = TextButton(
          onPressed: effectiveCallback,
          child: child,
        );
    }

    if (fullWidth) {
      return SizedBox(width: double.infinity, child: button);
    }
    return button;
  }

  Widget _buildChild() {
    if (isLoading) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator.adaptive(
              strokeWidth: 2,
              valueColor:
                  const AlwaysStoppedAnimation<Color>(GateColors.onPrimary),
            ),
          ),
          GateSpacing.horizontal(GateSpacing.sm),
          Text(label),
        ],
      );
    }

    if (icon != null) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18),
          GateSpacing.horizontal(GateSpacing.xs),
          Text(label),
        ],
      );
    }

    return Text(label);
  }
}
