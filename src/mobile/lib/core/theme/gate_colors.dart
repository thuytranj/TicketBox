import 'package:flutter/material.dart';

/// Gate App color token system.
///
/// Usage: always reference tokens, never use raw Color literals in widgets.
/// Example: `color: GateColors.primary` instead of `color: Color(0xFF7C4DFF)`.
abstract final class GateColors {
  // ── Base Palette ────────────────────────────────────────────────────────────

  /// Scaffold / page background (near-black, reduces glare in dark environments)
  static const Color background = Color(0xFF0D0D0D);

  /// Default card / surface background
  static const Color surface = Color(0xFF1A1A1A);

  /// Elevated card / dialog background
  static const Color surfaceHigh = Color(0xFF242424);

  /// Dividers and subtle borders
  static const Color border = Color(0xFF2E2E2E);

  // ── On-background Text ──────────────────────────────────────────────────────

  /// Primary text on [background]
  static const Color onBackground = Color(0xFFF5F5F5);

  /// Primary text on [surface] / [surfaceHigh]
  static const Color onSurface = Color(0xFFE0E0E0);

  /// Secondary / hint / caption text
  static const Color onSurfaceSub = Color(0xFF9E9E9E);

  // ── Brand / Primary ─────────────────────────────────────────────────────────

  /// Primary interactive accent (purple — distinct from all status colors)
  static const Color primary = Color(0xFF7C4DFF);

  static const Color primaryVariant = Color(0xFF651FFF);

  /// Text / icon on primary-colored background
  static const Color onPrimary = Color(0xFFFFFFFF);

  // ── Network State ───────────────────────────────────────────────────────────

  /// Dot indicator for online state
  static const Color networkOnline = Color(0xFF00C853);

  /// Dot indicator for offline / degraded state (warning, not error)
  static const Color networkOffline = Color(0xFFFF9100);

  /// Badge color for pending sync queue
  static const Color syncPending = Color(0xFFFFB300);

  // ── Scan Status Colors ──────────────────────────────────────────────────────
  // Each status exposes three tokens: primary, container, onContainer.
  // Use these to paint chips, overlays, and banners consistently.

  static const GateScanColor scanValid = GateScanColor(
    primary: Color(0xFF00E676),
    container: Color(0xFF00331A),
    onContainer: Color(0xFFFFFFFF),
  );

  static const GateScanColor scanUsed = GateScanColor(
    primary: Color(0xFFFFB300),
    container: Color(0xFF332500),
    onContainer: Color(0xFFFFFFFF),
  );

  static const GateScanColor scanInvalid = GateScanColor(
    primary: Color(0xFFFF3D00),
    container: Color(0xFF330D00),
    onContainer: Color(0xFFFFFFFF),
  );

  static const GateScanColor scanError = GateScanColor(
    primary: Color(0xFFB0BEC5),
    container: Color(0xFF1A1F22),
    onContainer: Color(0xFFFFFFFF),
  );
}

/// A set of three contextual colors for a single scan-result status.
@immutable
final class GateScanColor {
  /// The vivid accent color — use for icons, borders, text on dark backgrounds.
  final Color primary;

  /// The muted background — use for chip / card / overlay containers.
  final Color container;

  /// Text / icon color guaranteed to contrast against [container].
  final Color onContainer;

  const GateScanColor({
    required this.primary,
    required this.container,
    required this.onContainer,
  });
}
