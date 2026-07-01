import 'package:flutter/material.dart';
import '../../../core/theme/gate_colors.dart';
import '../../../core/theme/gate_radii.dart';
import '../../../core/theme/gate_spacing.dart';
import '../../../core/theme/gate_typography.dart';
import '../models/concert.dart';

/// A card that represents a single concert / event for selection.
///
/// Visual state changes between [isSelected] = true/false with three
/// simultaneous signals so selection is unambiguous under mixed lighting:
/// - **Border**: 2dp primary (selected) vs 1dp border color (unselected)
/// - **Background**: [GateColors.surfaceHigh] (selected) vs [GateColors.surface]
/// - **Trailing icon**: `check_circle_rounded` primary (selected) vs hidden
/// - **Title color**: [GateColors.primary] (selected) vs [GateColors.onSurface]
class EventCard extends StatelessWidget {
  const EventCard({
    super.key,
    required this.concert,
    required this.isSelected,
    required this.onTap,
  });

  final Concert concert;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: isSelected,
      label: '${concert.title}, ${concert.location}',
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOut,
        constraints: const BoxConstraints(minHeight: 80),
        decoration: BoxDecoration(
          color: isSelected ? GateColors.surfaceHigh : GateColors.surface,
          borderRadius: GateRadii.md,
          border: Border.all(
            color: isSelected ? GateColors.primary : GateColors.border,
            width: isSelected ? 2.0 : 1.0,
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
                vertical: GateSpacing.md,
              ),
              child: Row(
                children: [
                  _buildLeadingIcon(),
                  GateSpacing.horizontal(GateSpacing.md),
                  Expanded(child: _buildContent()),
                  if (isSelected) ...[
                    GateSpacing.horizontal(GateSpacing.sm),
                    _buildCheckIcon(),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLeadingIcon() {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: isSelected
            ? GateColors.primary.withValues(alpha: 0.15)
            : GateColors.background,
        borderRadius: GateRadii.sm,
      ),
      child: Icon(
        Icons.event_outlined,
        color: isSelected ? GateColors.primary : GateColors.onSurfaceSub,
        size: 24,
      ),
    );
  }

  Widget _buildContent() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          concert.title,
          style: GateTypography.heading2.copyWith(
            color: isSelected ? GateColors.primary : GateColors.onSurface,
          ),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        GateSpacing.vertical(GateSpacing.xs),
        Row(
          children: [
            Icon(
              Icons.location_on_outlined,
              size: 14,
              color: GateColors.onSurfaceSub,
            ),
            GateSpacing.horizontal(GateSpacing.xs),
            Expanded(
              child: Text(
                concert.location,
                style: GateTypography.bodyMedium,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildCheckIcon() {
    return Icon(
      Icons.check_circle_rounded,
      color: GateColors.primary,
      size: 24,
    );
  }
}
