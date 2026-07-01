import 'package:flutter/material.dart';

/// Gate App border-radius token system.
///
/// Use these instead of raw [BorderRadius] or [Radius] literals.
abstract final class GateRadii {
  // ── Raw double values ───────────────────────────────────────────────────────
  // Useful when BorderRadius isn't accepted (e.g. ClipRRect, ShapeBorder).

  static const double noneValue = 0.0;
  static const double smValue = 6.0;
  static const double mdValue = 12.0;
  static const double lgValue = 16.0;
  static const double xlValue = 24.0;
  static const double fullValue = 999.0;

  // ── BorderRadius constants ──────────────────────────────────────────────────

  /// 0dp — sharp corners (dividers, full-bleed images).
  static const BorderRadius none = BorderRadius.zero;

  /// 6dp — chips, tags, compact badges.
  static const BorderRadius sm = BorderRadius.all(Radius.circular(smValue));

  /// 12dp — cards, input fields.
  static const BorderRadius md = BorderRadius.all(Radius.circular(mdValue));

  /// 16dp — bottom sheets, dialogs.
  static const BorderRadius lg = BorderRadius.all(Radius.circular(lgValue));

  /// 24dp — FAB-style primary buttons.
  static const BorderRadius xl = BorderRadius.all(Radius.circular(xlValue));

  /// 999dp — pill shapes (status chips, round icon buttons).
  static const BorderRadius full = BorderRadius.all(Radius.circular(fullValue));

  /// Top-only rounded for bottom sheets.
  static const BorderRadius topLg = BorderRadius.vertical(
    top: Radius.circular(lgValue),
  );
}
