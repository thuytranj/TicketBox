import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/gate_colors.dart';
import '../../../core/theme/gate_radii.dart';
import '../../../core/theme/gate_spacing.dart';
import '../../../core/theme/gate_typography.dart';
import '../models/scan_outcome.dart';

/// A non-blocking, floating result card shown at the bottom of [ScannerScreen]
/// after each QR scan attempt.
///
/// The panel:
/// - auto-dismisses after [outcome.dismissAfter] (1.5 s for VALID, 2.5 s otherwise)
/// - allows instant dismiss on tap
/// - calls [onClose] exactly once when dismissed
/// - owns its own [Timer] — no external timer management needed
///
/// The caller is responsible for showing / hiding this widget based on whether
/// a current scan result exists. When [onClose] fires the caller should set the
/// result to null, which removes the widget from the tree and resets the scanner.
///
/// ```dart
/// if (_currentOutcome != null)
///   Positioned(
///     bottom: 24, left: 16, right: 16,
///     child: ScanResultPanel(
///       outcome: _currentOutcome!,
///       onClose: _onPanelClosed,
///     ),
///   ),
/// ```
class ScanResultPanel extends StatefulWidget {
  const ScanResultPanel({
    super.key,
    required this.outcome,
    required this.onClose,
  });

  final ScanOutcome outcome;

  /// Called exactly once when the panel is dismissed (auto or manual).
  final VoidCallback onClose;

  @override
  State<ScanResultPanel> createState() => _ScanResultPanelState();
}

class _ScanResultPanelState extends State<ScanResultPanel> {
  Timer? _timer;
  bool _dismissed = false;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer = Timer(widget.outcome.dismissAfter, _dismiss);
  }

  /// Dismiss exactly once — guards against timer + tap racing.
  void _dismiss() {
    if (_dismissed) return;
    _dismissed = true;
    _timer?.cancel();
    _timer = null;
    widget.onClose();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final outcome = widget.outcome;
    final color = outcome.scanColor;

    return GestureDetector(
      onTap: _dismiss,
      behavior: HitTestBehavior.opaque,
      child: Container(
        decoration: BoxDecoration(
          color: color.container,
          borderRadius: GateRadii.lg,
          border: Border.all(
            color: color.primary.withValues(alpha: 0.5),
            width: 1.5,
          ),
        ),
        padding: EdgeInsets.all(GateSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Status icon ──────────────────────────────────────────────
            Icon(outcome.icon, color: color.primary, size: 56),
            GateSpacing.vertical(GateSpacing.sm),

            // ── Title ────────────────────────────────────────────────────
            Text(
              outcome.title,
              style: GateTypography.heading1.copyWith(color: color.primary),
              textAlign: TextAlign.center,
            ),
            GateSpacing.vertical(GateSpacing.xs),

            // ── Detail message ───────────────────────────────────────────
            Text(
              outcome.message,
              style: GateTypography.bodyMedium
                  .copyWith(color: GateColors.onSurface),
              textAlign: TextAlign.center,
            ),
            GateSpacing.vertical(GateSpacing.xs),

            // ── Scan mode badge ──────────────────────────────────────────
            _ModeBadge(isOffline: outcome.isOffline),
          ],
        ),
      ),
    );
  }
}

/// Small inline badge indicating whether the result came from the server (Online)
/// or the local offline DB (Offline Fallback).
class _ModeBadge extends StatelessWidget {
  const _ModeBadge({required this.isOffline});
  final bool isOffline;

  @override
  Widget build(BuildContext context) {
    final label = isOffline ? 'Offline Fallback' : 'Online';
    final dotColor =
        isOffline ? GateColors.networkOffline : GateColors.networkOnline;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
        ),
        GateSpacing.horizontal(GateSpacing.xs),
        Text(
          label,
          style: GateTypography.caption.copyWith(color: dotColor),
        ),
      ],
    );
  }
}
