import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ticketbox_mobile/core/theme/gate_app_theme.dart';
import 'package:ticketbox_mobile/shared/widgets/widgets.dart';

/// Helper: wraps [widget] in a themed [MaterialApp] for testing.
Widget _wrap(Widget widget) => MaterialApp(
      theme: GateAppTheme.dark(),
      home: Scaffold(body: widget),
    );

void main() {
  // ── GateButton ─────────────────────────────────────────────────────────────
  group('GateButton', () {
    testWidgets('renders label', (tester) async {
      await tester.pumpWidget(
        _wrap(GateButton(label: 'Đăng Nhập', onPressed: () {})),
      );
      expect(find.text('Đăng Nhập'), findsOneWidget);
    });

    testWidgets('shows loading indicator when isLoading=true', (tester) async {
      await tester.pumpWidget(
        _wrap(
          GateButton(label: 'Tải', onPressed: () {}, isLoading: true),
        ),
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('disabled when onPressed is null', (tester) async {
      await tester.pumpWidget(
        _wrap(const GateButton(label: 'Không dùng được', onPressed: null)),
      );
      // FilledButton is disabled when onPressed == null
      final btn = tester.widget<FilledButton>(find.byType(FilledButton));
      expect(btn.onPressed, isNull);
    });

    testWidgets('secondary variant renders OutlinedButton', (tester) async {
      await tester.pumpWidget(
        _wrap(
          GateButton(
            label: 'Thứ hai',
            onPressed: () {},
            variant: GateButtonVariant.secondary,
          ),
        ),
      );
      expect(find.byType(OutlinedButton), findsOneWidget);
    });

    testWidgets('tertiary variant renders TextButton', (tester) async {
      await tester.pumpWidget(
        _wrap(
          GateButton(
            label: 'Thứ ba',
            onPressed: () {},
            variant: GateButtonVariant.tertiary,
          ),
        ),
      );
      expect(find.byType(TextButton), findsOneWidget);
    });

    testWidgets('icon is shown when provided', (tester) async {
      await tester.pumpWidget(
        _wrap(
          GateButton(
            label: 'Có icon',
            onPressed: () {},
            icon: Icons.check,
          ),
        ),
      );
      expect(find.byIcon(Icons.check), findsOneWidget);
    });
  });

  // ── GateCard ───────────────────────────────────────────────────────────────
  group('GateCard', () {
    testWidgets('renders child', (tester) async {
      await tester.pumpWidget(
        _wrap(const GateCard(child: Text('Card content'))),
      );
      expect(find.text('Card content'), findsOneWidget);
    });

    testWidgets('tappable card fires onTap', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        _wrap(
          GateCard(
            onTap: () => tapped = true,
            child: const Text('Tap me'),
          ),
        ),
      );
      await tester.tap(find.byType(GateCard));
      expect(tapped, isTrue);
    });

    testWidgets('non-tappable card has null InkWell onTap', (tester) async {
      await tester.pumpWidget(
        _wrap(const GateCard(child: Text('Static card'))),
      );
      // When onTap is not provided, InkWell.onTap should be null
      final inkWell = tester.widget<InkWell>(find.byType(InkWell));
      expect(inkWell.onTap, isNull);
    });
  });

  // ── GateLoadingState ───────────────────────────────────────────────────────
  group('GateLoadingState', () {
    testWidgets('shows spinner', (tester) async {
      await tester.pumpWidget(_wrap(const GateLoadingState()));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows message when provided', (tester) async {
      await tester.pumpWidget(
        _wrap(const GateLoadingState(message: 'Đang tải...')),
      );
      expect(find.text('Đang tải...'), findsOneWidget);
    });

    testWidgets('no message widget when message is null', (tester) async {
      await tester.pumpWidget(_wrap(const GateLoadingState()));
      expect(find.byType(Text), findsNothing);
    });
  });

  // ── GateErrorState ─────────────────────────────────────────────────────────
  group('GateErrorState', () {
    testWidgets('shows message', (tester) async {
      await tester.pumpWidget(
        _wrap(const GateErrorState(message: 'Mất kết nối mạng')),
      );
      expect(find.text('Mất kết nối mạng'), findsOneWidget);
    });

    testWidgets('shows retry button when onRetry provided', (tester) async {
      var retried = false;
      await tester.pumpWidget(
        _wrap(
          GateErrorState(
            message: 'Lỗi server',
            onRetry: () => retried = true,
          ),
        ),
      );
      expect(find.text('Thử lại'), findsOneWidget);
      await tester.tap(find.text('Thử lại'));
      expect(retried, isTrue);
    });

    testWidgets('no retry button when onRetry is null', (tester) async {
      await tester.pumpWidget(
        _wrap(const GateErrorState(message: 'Lỗi')),
      );
      expect(find.text('Thử lại'), findsNothing);
    });

    testWidgets('network type shows wifi_off icon', (tester) async {
      await tester.pumpWidget(
        _wrap(const GateErrorState(
          message: 'Mạng yếu',
          type: GateErrorType.network,
        )),
      );
      expect(find.byIcon(Icons.wifi_off_rounded), findsOneWidget);
    });

    testWidgets('server type shows cloud_off icon', (tester) async {
      await tester.pumpWidget(
        _wrap(const GateErrorState(
          message: 'Server lỗi',
          type: GateErrorType.server,
        )),
      );
      expect(find.byIcon(Icons.cloud_off_rounded), findsOneWidget);
    });
  });

  // ── GateEmptyState ─────────────────────────────────────────────────────────
  group('GateEmptyState', () {
    testWidgets('shows message and default icon', (tester) async {
      await tester.pumpWidget(
        _wrap(const GateEmptyState(message: 'Không có dữ liệu')),
      );
      expect(find.text('Không có dữ liệu'), findsOneWidget);
      expect(find.byIcon(Icons.inbox_outlined), findsOneWidget);
    });

    testWidgets('shows action widget when provided', (tester) async {
      await tester.pumpWidget(
        _wrap(GateEmptyState(
          message: 'Trống',
          action: GateButton(label: 'Làm mới', onPressed: () {}),
        )),
      );
      expect(find.text('Làm mới'), findsOneWidget);
    });
  });

  // ── StatusChip ─────────────────────────────────────────────────────────────
  group('StatusChip', () {
    testWidgets('valid shows label HỢP LỆ', (tester) async {
      await tester.pumpWidget(
        _wrap(const StatusChip(status: ScanStatus.valid)),
      );
      expect(find.text('HỢP LỆ'), findsOneWidget);
    });

    testWidgets('alreadyUsed shows label ĐÃ DÙNG', (tester) async {
      await tester.pumpWidget(
        _wrap(const StatusChip(status: ScanStatus.alreadyUsed)),
      );
      expect(find.text('ĐÃ DÙNG'), findsOneWidget);
    });

    testWidgets('notFound shows label KHÔNG TỒN TẠI', (tester) async {
      await tester.pumpWidget(
        _wrap(const StatusChip(status: ScanStatus.notFound)),
      );
      expect(find.text('KHÔNG TỒN TẠI'), findsOneWidget);
    });

    testWidgets('showLabel=false hides text', (tester) async {
      await tester.pumpWidget(
        _wrap(const StatusChip(status: ScanStatus.valid, showLabel: false)),
      );
      expect(find.text('HỢP LỆ'), findsNothing);
      // Icon is still present
      expect(find.byIcon(Icons.check_circle_outline_rounded), findsOneWidget);
    });
  });

  // ── NetworkStatusBadge ─────────────────────────────────────────────────────
  group('NetworkStatusBadge', () {
    testWidgets('shows ONLINE when isOnline=true', (tester) async {
      await tester.pumpWidget(
        _wrap(const NetworkStatusBadge(isOnline: true)),
      );
      expect(find.text('ONLINE'), findsOneWidget);
    });

    testWidgets('shows OFFLINE when isOnline=false', (tester) async {
      await tester.pumpWidget(
        _wrap(const NetworkStatusBadge(isOnline: false)),
      );
      expect(find.text('OFFLINE'), findsOneWidget);
    });

    testWidgets('shows pending count when > 0', (tester) async {
      await tester.pumpWidget(
        _wrap(const NetworkStatusBadge(isOnline: true, pendingCount: 7)),
      );
      expect(find.text('7'), findsOneWidget);
    });

    testWidgets('no pending badge when count is null', (tester) async {
      await tester.pumpWidget(
        _wrap(const NetworkStatusBadge(isOnline: true)),
      );
      expect(find.byIcon(Icons.bolt_rounded), findsNothing);
    });

    testWidgets('no pending badge when count is 0', (tester) async {
      await tester.pumpWidget(
        _wrap(const NetworkStatusBadge(isOnline: true, pendingCount: 0)),
      );
      expect(find.byIcon(Icons.bolt_rounded), findsNothing);
    });
  });

  // ── GateScaffold ───────────────────────────────────────────────────────────
  group('GateScaffold', () {
    testWidgets('renders body', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const GateScaffold(body: Text('Body content')),
        ),
      );
      expect(find.text('Body content'), findsOneWidget);
    });

    testWidgets('shows AppBar when title provided', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const GateScaffold(title: 'Quét vé', body: SizedBox()),
        ),
      );
      expect(find.text('Quét vé'), findsOneWidget);
    });

    testWidgets('no AppBar when title is null', (tester) async {
      await tester.pumpWidget(
        _wrap(const GateScaffold(body: SizedBox())),
      );
      expect(find.byType(AppBar), findsNothing);
    });

    testWidgets('shows NetworkStatusBadge when showNetworkStatus=true',
        (tester) async {
      await tester.pumpWidget(
        _wrap(
          const GateScaffold(
            title: 'Scanner',
            body: SizedBox(),
            showNetworkStatus: true,
            isOnline: false,
          ),
        ),
      );
      expect(find.text('OFFLINE'), findsOneWidget);
    });
  });
}
