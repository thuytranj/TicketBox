import 'package:flutter/material.dart';
import 'gate_colors.dart';
import 'gate_elevation.dart';
import 'gate_radii.dart';
import 'gate_spacing.dart';
import 'gate_typography.dart';

/// Builds the [ThemeData] for the TicketBox Gate App.
///
/// ## Usage
/// ```dart
/// MaterialApp(
///   theme: GateAppTheme.dark(),
///   themeMode: ThemeMode.dark,
/// )
/// ```
///
/// ## Conventions
/// 1. **Never hard-code colors or sizes in widgets.** Use tokens from
///    [GateColors], [GateSpacing], [GateRadii], [GateElevation], and
///    [GateTypography] instead.
/// 2. **Adding new widgets?** Check if a shared widget in
///    `lib/shared/widgets/` already covers your use-case before reaching for
///    a raw Flutter widget.
/// 3. **Semantic colors only.** Use `GateColors.scanValid.primary` for a
///    "valid" green — never `Colors.green`.
abstract final class GateAppTheme {
  /// Returns the single dark [ThemeData] for the Gate App.
  ///
  /// The app always runs in dark mode ([ThemeMode.dark]); no light theme is
  /// provided because the display environment (outdoor, night events) demands
  /// controlled contrast.
  static ThemeData dark() {
    final colorScheme = ColorScheme(
      brightness: Brightness.dark,
      primary: GateColors.primary,
      onPrimary: GateColors.onPrimary,
      primaryContainer: GateColors.primaryVariant,
      onPrimaryContainer: GateColors.onPrimary,
      secondary: GateColors.syncPending,
      onSecondary: GateColors.onPrimary,
      secondaryContainer: GateColors.surface,
      onSecondaryContainer: GateColors.onSurface,
      tertiary: GateColors.networkOnline,
      onTertiary: GateColors.background,
      tertiaryContainer: GateColors.surfaceHigh,
      onTertiaryContainer: GateColors.onSurface,
      error: GateColors.scanInvalid.primary,
      onError: GateColors.onPrimary,
      errorContainer: GateColors.scanInvalid.container,
      onErrorContainer: GateColors.scanInvalid.onContainer,
      surface: GateColors.surface,
      onSurface: GateColors.onSurface,
      onSurfaceVariant: GateColors.onSurfaceSub,
      outline: GateColors.border,
      outlineVariant: GateColors.border,
      shadow: Colors.black,
      scrim: Colors.black87,
      inverseSurface: GateColors.onBackground,
      onInverseSurface: GateColors.background,
      inversePrimary: GateColors.primaryVariant,
      surfaceTint: GateColors.primary,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: GateColors.background,

      // ── Typography ──────────────────────────────────────────────────────────
      textTheme: GateTypography.textTheme,

      // ── AppBar ──────────────────────────────────────────────────────────────
      appBarTheme: AppBarTheme(
        backgroundColor: GateColors.surface,
        foregroundColor: GateColors.onSurface,
        elevation: GateElevation.none,
        centerTitle: false,
        titleTextStyle: GateTypography.heading2,
        iconTheme: const IconThemeData(color: GateColors.onSurface),
        actionsIconTheme: const IconThemeData(color: GateColors.onSurface),
      ),

      // ── Cards ───────────────────────────────────────────────────────────────
      cardTheme: CardThemeData(
        color: GateColors.surface,
        elevation: GateElevation.card,
        shape: RoundedRectangleBorder(borderRadius: GateRadii.md),
        margin: EdgeInsets.zero,
      ),

      // ── Buttons ─────────────────────────────────────────────────────────────
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: GateColors.primary,
          foregroundColor: GateColors.onPrimary,
          minimumSize: const Size(200, 56),
          shape: RoundedRectangleBorder(borderRadius: GateRadii.xl),
          textStyle: GateTypography.label.copyWith(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
          padding: EdgeInsets.symmetric(
            horizontal: GateSpacing.lg,
            vertical: GateSpacing.md,
          ),
        ),
      ),

      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: GateColors.primary,
          foregroundColor: GateColors.onPrimary,
          minimumSize: const Size(200, 56),
          elevation: GateElevation.raised,
          shape: RoundedRectangleBorder(borderRadius: GateRadii.xl),
          textStyle: GateTypography.label.copyWith(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
          padding: EdgeInsets.symmetric(
            horizontal: GateSpacing.lg,
            vertical: GateSpacing.md,
          ),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: GateColors.primary,
          minimumSize: const Size(120, 48),
          side: const BorderSide(color: GateColors.border, width: 1.5),
          shape: RoundedRectangleBorder(borderRadius: GateRadii.md),
          textStyle: GateTypography.label.copyWith(
            fontSize: 15,
            fontWeight: FontWeight.w500,
          ),
          padding: EdgeInsets.symmetric(
            horizontal: GateSpacing.md,
            vertical: GateSpacing.sm,
          ),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: GateColors.primary,
          minimumSize: const Size(48, 44),
          textStyle: GateTypography.label.copyWith(
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),

      // ── Input / Form ────────────────────────────────────────────────────────
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: GateColors.surfaceHigh,
        contentPadding: EdgeInsets.symmetric(
          horizontal: GateSpacing.md,
          vertical: GateSpacing.md,
        ),
        border: OutlineInputBorder(
          borderRadius: GateRadii.md,
          borderSide: const BorderSide(color: GateColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: GateRadii.md,
          borderSide: const BorderSide(color: GateColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: GateRadii.md,
          borderSide: const BorderSide(color: GateColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: GateRadii.md,
          borderSide:
              BorderSide(color: GateColors.scanInvalid.primary, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: GateRadii.md,
          borderSide:
              BorderSide(color: GateColors.scanInvalid.primary, width: 2),
        ),
        labelStyle: GateTypography.bodyMedium,
        hintStyle:
            GateTypography.bodyMedium.copyWith(color: GateColors.onSurfaceSub),
        errorStyle: GateTypography.caption
            .copyWith(color: GateColors.scanInvalid.primary),
      ),

      // ── Divider ─────────────────────────────────────────────────────────────
      dividerTheme: const DividerThemeData(
        color: GateColors.border,
        thickness: 1,
        space: 1,
      ),

      // ── ListTile ────────────────────────────────────────────────────────────
      listTileTheme: ListTileThemeData(
        tileColor: GateColors.surface,
        selectedTileColor: GateColors.surfaceHigh,
        contentPadding: EdgeInsets.symmetric(
          horizontal: GateSpacing.md,
          vertical: GateSpacing.sm,
        ),
        minVerticalPadding: GateSpacing.sm,
        titleTextStyle: GateTypography.bodyLarge,
        subtitleTextStyle: GateTypography.bodyMedium,
      ),

      // ── Bottom Sheet ────────────────────────────────────────────────────────
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: GateColors.surface,
        modalBackgroundColor: GateColors.surface,
        elevation: GateElevation.overlay,
        shape: const RoundedRectangleBorder(borderRadius: GateRadii.topLg),
        showDragHandle: true,
        dragHandleColor: GateColors.border,
      ),

      // ── Dialog ──────────────────────────────────────────────────────────────
      dialogTheme: DialogThemeData(
        backgroundColor: GateColors.surfaceHigh,
        elevation: GateElevation.modal,
        shape: RoundedRectangleBorder(borderRadius: GateRadii.lg),
        titleTextStyle: GateTypography.heading2,
        contentTextStyle: GateTypography.bodyMedium,
      ),

      // ── SnackBar ────────────────────────────────────────────────────────────
      snackBarTheme: SnackBarThemeData(
        backgroundColor: GateColors.surfaceHigh,
        contentTextStyle:
            GateTypography.bodyMedium.copyWith(color: GateColors.onSurface),
        shape: RoundedRectangleBorder(borderRadius: GateRadii.sm),
        behavior: SnackBarBehavior.floating,
        elevation: GateElevation.overlay,
        actionTextColor: GateColors.primary,
      ),

      // ── Icon ────────────────────────────────────────────────────────────────
      iconTheme: const IconThemeData(
        color: GateColors.onSurface,
        size: 24,
      ),

      // ── Progress Indicator ──────────────────────────────────────────────────
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: GateColors.primary,
        linearTrackColor: GateColors.border,
        circularTrackColor: GateColors.border,
      ),

      // ── FloatingActionButton ────────────────────────────────────────────────
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: GateColors.primary,
        foregroundColor: GateColors.onPrimary,
        elevation: GateElevation.raised,
        shape: RoundedRectangleBorder(borderRadius: GateRadii.xl),
      ),
    );
  }
}
