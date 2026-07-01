import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'gate_colors.dart';

/// Gate App typography token system using the Inter font family.
///
/// All styles are defined as [TextStyle] constants.
/// Use [GateTypography.textTheme] to wire into [ThemeData].
abstract final class GateTypography {
  // ── Scale ───────────────────────────────────────────────────────────────────

  /// Used for large scan result labels: "HỢP LỆ", "ĐÃ DÙNG", etc.
  static TextStyle get scanResult => GoogleFonts.inter(
        fontSize: 48,
        fontWeight: FontWeight.w700,
        height: 56 / 48,
        color: GateColors.onBackground,
      );

  /// Page / event title, prominent headings.
  static TextStyle get heading1 => GoogleFonts.inter(
        fontSize: 24,
        fontWeight: FontWeight.w600,
        height: 32 / 24,
        color: GateColors.onBackground,
      );

  /// Section headings, AppBar title.
  static TextStyle get heading2 => GoogleFonts.inter(
        fontSize: 20,
        fontWeight: FontWeight.w600,
        height: 28 / 20,
        color: GateColors.onBackground,
      );

  /// Primary body text — minimum size for readable field text.
  static TextStyle get bodyLarge => GoogleFonts.inter(
        fontSize: 17,
        fontWeight: FontWeight.w400,
        height: 24 / 17,
        color: GateColors.onBackground,
      );

  /// Secondary body, subtitles.
  static TextStyle get bodyMedium => GoogleFonts.inter(
        fontSize: 15,
        fontWeight: FontWeight.w400,
        height: 22 / 15,
        color: GateColors.onSurface,
      );

  /// Labels, chips, badges.
  static TextStyle get label => GoogleFonts.inter(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        height: 18 / 13,
        color: GateColors.onSurface,
      );

  /// Metadata, timestamps, captions.
  static TextStyle get caption => GoogleFonts.inter(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        height: 16 / 12,
        color: GateColors.onSurfaceSub,
      );

  /// Scan counter ("247 đã quét") — tabular nums so digits don't shift layout.
  static TextStyle get counter => GoogleFonts.inter(
        fontSize: 36,
        fontWeight: FontWeight.w700,
        height: 44 / 36,
        color: GateColors.onBackground,
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  // ── TextTheme for MaterialApp ────────────────────────────────────────────────

  /// Wire into [ThemeData.textTheme].
  static TextTheme get textTheme => TextTheme(
        displayLarge: scanResult,
        headlineLarge: heading1,
        headlineMedium: heading2,
        bodyLarge: bodyLarge,
        bodyMedium: bodyMedium,
        labelLarge: label,
        bodySmall: caption,
      );
}
