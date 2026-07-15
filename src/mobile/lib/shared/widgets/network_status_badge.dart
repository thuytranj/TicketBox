import 'package:flutter/material.dart';
import '../../core/theme/gate_colors.dart';
import '../../core/theme/gate_spacing.dart';
import '../../core/theme/gate_typography.dart';

/// A compact inline badge showing network connectivity and pending sync count.
///
/// Always visible in the scanner and event screens so staff know their
/// connectivity mode at a glance.
///
/// ```dart
/// NetworkStatusBadge(isOnline: true, pendingCount: 12)
/// NetworkStatusBadge(isOnline: false)
/// ```
class NetworkStatusBadge extends StatelessWidget {
  const NetworkStatusBadge({
    super.key,
    required this.isOnline,
    this.pendingCount,
  });

  /// Current connectivity state.
  final bool isOnline;

  /// Number of offline scan logs pending sync. Shows ⚡ badge when > 0.
  final int? pendingCount;

  @override
  Widget build(BuildContext context) {
    final dotColor =
        isOnline ? GateColors.networkOnline : GateColors.networkOffline;
    final label = isOnline ? 'ONLINE' : 'OFFLINE';

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _Dot(color: dotColor),
        GateSpacing.horizontal(GateSpacing.xs),
        Text(
          label,
          style: GateTypography.label.copyWith(color: dotColor),
        ),
        if (pendingCount != null && pendingCount! > 0) ...[
          GateSpacing.horizontal(GateSpacing.sm),
          _PendingBadge(count: pendingCount!),
        ],
      ],
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
      ),
    );
  }
}

class _PendingBadge extends StatelessWidget {
  const _PendingBadge({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.bolt_rounded, color: GateColors.syncPending, size: 14),
        GateSpacing.horizontal(2),
        Text(
          '$count',
          style: GateTypography.label.copyWith(color: GateColors.syncPending),
        ),
      ],
    );
  }
}
