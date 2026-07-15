import 'package:flutter/material.dart';
import '../../core/theme/gate_colors.dart';
import '../../core/theme/gate_radii.dart';
import '../../core/theme/gate_spacing.dart';

/// A surface card used throughout the Gate App.
///
/// Supports optional tap handling with ripple effect and two elevation levels.
///
/// ```dart
/// GateCard(
///   onTap: () => doSomething(),
///   child: Text('Content'),
/// )
/// ```
class GateCard extends StatelessWidget {
  const GateCard({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
    this.elevated = false,
  });

  /// Card content.
  final Widget child;

  /// Inner padding — defaults to [GateSpacing.md] on all sides.
  final EdgeInsets? padding;

  /// If non-null, card becomes tappable with an InkWell ripple.
  final VoidCallback? onTap;

  /// When true, uses [GateColors.surfaceHigh] instead of [GateColors.surface].
  final bool elevated;

  @override
  Widget build(BuildContext context) {
    final bgColor = elevated ? GateColors.surfaceHigh : GateColors.surface;
    final effectivePadding =
        padding ?? EdgeInsets.all(GateSpacing.md);

    return Material(
      color: bgColor,
      borderRadius: GateRadii.md,
      child: InkWell(
        onTap: onTap,
        borderRadius: GateRadii.md,
        child: Padding(
          padding: effectivePadding,
          child: child,
        ),
      ),
    );
  }
}
