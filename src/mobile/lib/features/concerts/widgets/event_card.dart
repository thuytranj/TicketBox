import 'package:flutter/material.dart';
import '../../../core/theme/gate_colors.dart';
import '../../../core/theme/gate_radii.dart';
import '../../../core/theme/gate_spacing.dart';
import '../../../core/theme/gate_typography.dart';
import '../models/concert.dart';

/// A compact card representing a single concert / event.
///
/// Tapping the card immediately triggers [onTap]; there is no intermediate
/// selection state. The card keeps a small status chip to let staff quickly
/// identify today's events vs upcoming vs past.
///
/// Designed to be compact so 5–7 cards are visible per screen on a 360dp
/// device without horizontal overflow.
class EventCard extends StatelessWidget {
  const EventCard({
    super.key,
    required this.concert,
    required this.onTap,
  });

  final Concert concert;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '${concert.title}, ${concert.location}',
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOut,
        constraints: const BoxConstraints(minHeight: 72),
        decoration: BoxDecoration(
          color: GateColors.surface,
          borderRadius: GateRadii.md,
          border: Border.all(
            color: GateColors.border,
            width: 1.0,
          ),
        ),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            onTap: onTap,
            borderRadius: GateRadii.md,
            splashColor: GateColors.primary.withValues(alpha: 0.1),
            highlightColor: GateColors.primary.withValues(alpha: 0.05),
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: GateSpacing.md,
                vertical: GateSpacing.sm + GateSpacing.xs,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _buildLeadingIcon(),
                  GateSpacing.horizontal(GateSpacing.sm),
                  Expanded(child: _buildContent()),
                  GateSpacing.horizontal(GateSpacing.xs),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: GateColors.onSurfaceSub,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLeadingIcon() {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: GateColors.background,
        borderRadius: GateRadii.sm,
      ),
      child: const Icon(
        Icons.event_outlined,
        color: GateColors.onSurfaceSub,
        size: 20,
      ),
    );
  }

  Widget _buildContent() {
    final schedule = _formatSchedule(concert.startTime, concert.endTime);
    final statusChip = _buildStatusChip();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Title row with optional status chip
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                concert.title,
                style: GateTypography.bodyLarge.copyWith(
                  fontWeight: FontWeight.w600,
                  color: GateColors.onSurface,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (statusChip != null) ...[
              GateSpacing.horizontal(GateSpacing.xs),
              statusChip,
            ],
          ],
        ),
        GateSpacing.vertical(GateSpacing.xs),
        // Location
        Row(
          children: [
            const Icon(
              Icons.location_on_outlined,
              size: 13,
              color: GateColors.onSurfaceSub,
            ),
            GateSpacing.horizontal(GateSpacing.xs),
            Expanded(
              child: Text(
                concert.location,
                style: GateTypography.caption,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        // Date/time
        if (schedule != null) ...[
          GateSpacing.vertical(2),
          Row(
            children: [
              const Icon(
                Icons.schedule_outlined,
                size: 13,
                color: GateColors.onSurfaceSub,
              ),
              GateSpacing.horizontal(GateSpacing.xs),
              Expanded(
                child: Text(
                  schedule,
                  style: GateTypography.caption,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  /// Returns a compact status chip, or null if status is unclear.
  Widget? _buildStatusChip() {
    final now = DateTime.now();
    final start = concert.startTime?.toLocal();
    final gateState = concert.gateState;

    if (gateState == ConcertGateState.cancelled) {
      return _Chip(
        label: 'Đã hủy',
        color: GateColors.scanInvalid.primary,
        bgColor: GateColors.scanInvalid.container,
      );
    }

    if (gateState == ConcertGateState.completed) {
      return _Chip(
        label: 'Đã diễn ra',
        color: GateColors.onSurfaceSub,
        bgColor: GateColors.border,
      );
    }

    if (start != null && _isSameLocalDay(start, now)) {
      return _Chip(
        label: 'Hôm nay',
        color: GateColors.primary,
        bgColor: GateColors.primary.withValues(alpha: 0.15),
      );
    }

    if (gateState == ConcertGateState.upcoming) {
      return _Chip(
        label: 'Sắp diễn ra',
        color: GateColors.scanUsed.primary,
        bgColor: GateColors.scanUsed.container,
      );
    }

    if (gateState == ConcertGateState.unavailable) {
      return _Chip(
        label: 'Chưa mở',
        color: GateColors.onSurfaceSub,
        bgColor: GateColors.border,
      );
    }

    return null;
  }

  bool _isSameLocalDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  String? _formatSchedule(DateTime? startTime, DateTime? endTime) {
    if (startTime == null) return null;

    String twoDigits(int value) => value.toString().padLeft(2, '0');

    final localStart = startTime.toLocal();
    final date =
        '${twoDigits(localStart.day)}/${twoDigits(localStart.month)}/${localStart.year}';
    final start =
        '${twoDigits(localStart.hour)}:${twoDigits(localStart.minute)}';

    if (endTime == null) {
      return '$date  $start';
    }

    final localEnd = endTime.toLocal();
    final isSameDay = localStart.year == localEnd.year &&
        localStart.month == localEnd.month &&
        localStart.day == localEnd.day;

    if (!isSameDay) {
      return '$date  $start';
    }

    final end = '${twoDigits(localEnd.hour)}:${twoDigits(localEnd.minute)}';
    return '$date  $start–$end';
  }
}

/// Inline compact status chip for event cards.
class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.color,
    required this.bgColor,
  });

  final String label;
  final Color color;
  final Color bgColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: GateRadii.sm,
      ),
      child: Text(
        label,
        style: GateTypography.caption.copyWith(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: 10,
        ),
      ),
    );
  }
}
