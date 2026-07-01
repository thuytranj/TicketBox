import 'package:flutter/material.dart';
import '../../core/theme/gate_colors.dart';
import '../../core/theme/gate_spacing.dart';
import '../../core/theme/gate_typography.dart';
import 'network_status_badge.dart';

/// Standard page scaffold for Gate App screens.
///
/// Wraps [Scaffold] with consistent AppBar defaults, safe area, and optional
/// network status display. Use this instead of bare [Scaffold] in every screen.
///
/// ```dart
/// GateScaffold(
///   title: 'Quét vé',
///   showNetworkStatus: true,
///   isOnline: true,
///   pendingCount: 5,
///   body: MyScreenBody(),
/// )
/// ```
class GateScaffold extends StatelessWidget {
  const GateScaffold({
    super.key,
    required this.body,
    this.title,
    this.actions,
    this.bottomBar,
    this.floatingActionButton,
    this.showNetworkStatus = false,
    this.isOnline = true,
    this.pendingCount,
    this.resizeToAvoidBottomInset = true,
  });

  /// Page body — wrapped in [SafeArea].
  final Widget body;

  /// AppBar title text. If null, no AppBar is shown.
  final String? title;

  /// AppBar trailing actions.
  final List<Widget>? actions;

  /// Optional bottom navigation bar or action bar.
  final Widget? bottomBar;

  /// Floating action button.
  final Widget? floatingActionButton;

  /// When true, shows a [NetworkStatusBadge] in the AppBar subtitle area.
  final bool showNetworkStatus;

  /// Connectivity state forwarded to [NetworkStatusBadge].
  final bool isOnline;

  /// Pending sync count forwarded to [NetworkStatusBadge].
  final int? pendingCount;

  final bool resizeToAvoidBottomInset;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GateColors.background,
      resizeToAvoidBottomInset: resizeToAvoidBottomInset,
      appBar: title != null ? _buildAppBar() : null,
      body: SafeArea(child: body),
      bottomNavigationBar: bottomBar,
      floatingActionButton: floatingActionButton,
    );
  }

  PreferredSizeWidget _buildAppBar() {
    if (showNetworkStatus) {
      return AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title!, style: GateTypography.heading2),
            GateSpacing.vertical(2),
            NetworkStatusBadge(
              isOnline: isOnline,
              pendingCount: pendingCount,
            ),
          ],
        ),
        actions: actions,
        toolbarHeight: 64,
      );
    }

    return AppBar(
      title: Text(title!, style: GateTypography.heading2),
      actions: actions,
    );
  }
}
