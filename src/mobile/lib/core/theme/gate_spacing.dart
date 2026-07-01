import 'package:flutter/material.dart';

/// Gate App spacing constants — 8-point grid.
///
/// Always use these instead of raw [double] literals for padding/gap.
abstract final class GateSpacing {
  /// 4dp — tight gaps between icon and text.
  static const double xs = 4.0;

  /// 8dp — small gaps, compact padding.
  static const double sm = 8.0;

  /// 16dp — standard page / card padding.
  static const double md = 16.0;

  /// 24dp — section gaps, generous card padding.
  static const double lg = 24.0;

  /// 32dp — large separation between sections.
  static const double xl = 32.0;

  /// 48dp — bottom safe-area padding, special spacing.
  static const double xxl = 48.0;

  // ── Convenience builders ────────────────────────────────────────────────────

  /// A [SizedBox] with the given [height] (vertical spacer).
  static SizedBox vertical(double height) => SizedBox(height: height);

  /// A [SizedBox] with the given [width] (horizontal spacer).
  static SizedBox horizontal(double width) => SizedBox(width: width);

  /// Symmetric vertical + horizontal [EdgeInsets] shorthand.
  static EdgeInsets all(double value) => EdgeInsets.all(value);

  /// Horizontal-only [EdgeInsets].
  static EdgeInsets h(double value) =>
      EdgeInsets.symmetric(horizontal: value);

  /// Vertical-only [EdgeInsets].
  static EdgeInsets v(double value) =>
      EdgeInsets.symmetric(vertical: value);
}
