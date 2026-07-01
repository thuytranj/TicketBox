/// Gate App elevation constants.
///
/// Material 3 dark themes express depth via surface tint rather than
/// drop shadows. Use these values with [Material.elevation] or
/// [ElevatedButton.styleFrom(elevation: ...)].
abstract final class GateElevation {
  /// Flat — no elevation (default surfaces, backgrounds).
  static const double none = 0.0;

  /// Standard card elevation.
  static const double card = 1.0;

  /// Raised / selected card.
  static const double raised = 2.0;

  /// Bottom sheets, persistent panels.
  static const double overlay = 3.0;

  /// Dialogs, modals.
  static const double modal = 6.0;
}
