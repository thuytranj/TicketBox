import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ticketbox_mobile/core/theme/gate_app_theme.dart';
import 'package:ticketbox_mobile/features/checkin/models/scan_outcome.dart';
import 'package:ticketbox_mobile/features/checkin/widgets/scan_result_panel.dart';

// ── Test helpers ──────────────────────────────────────────────────────────────

Widget _wrap({required Map<String, dynamic> result, VoidCallback? onClose}) {
  final outcome = ScanOutcome.fromServiceResult(result);
  return MaterialApp(
    theme: GateAppTheme.dark(),
    home: Scaffold(
      body: Stack(
        children: [
          ScanResultPanel(
            outcome: outcome,
            onClose: onClose ?? () {},
          ),
        ],
      ),
    ),
  );
}

// ── ScanOutcome.fromServiceResult unit tests ──────────────────────────────────

void main() {
  group('ScanOutcome.fromServiceResult', () {
    test('VALID status maps to ScanStatus.valid with correct title', () {
      final o = ScanOutcome.fromServiceResult({'status': 'VALID', 'message': 'OK'});
      expect(o.status, ScanStatus.valid);
      expect(o.title, 'HỢP LỆ');
      expect(o.isOffline, false);
    });

    test('CHECKED_IN status maps to ScanStatus.valid', () {
      final o = ScanOutcome.fromServiceResult({'status': 'CHECKED_IN', 'message': 'OK'});
      expect(o.status, ScanStatus.valid);
    });

    test('ALREADY_USED maps to alreadyUsed', () {
      final o = ScanOutcome.fromServiceResult({'status': 'ALREADY_USED', 'message': 'Đã dùng'});
      expect(o.status, ScanStatus.alreadyUsed);
      expect(o.title, 'VÉ ĐÃ SỬ DỤNG');
    });

    test('ALREADY_CHECKED_IN maps to alreadyUsed', () {
      final o = ScanOutcome.fromServiceResult({'status': 'ALREADY_CHECKED_IN', 'message': 'x'});
      expect(o.status, ScanStatus.alreadyUsed);
    });

    test('NOT_FOUND maps to notFound', () {
      final o = ScanOutcome.fromServiceResult({'status': 'NOT_FOUND', 'message': 'x'});
      expect(o.status, ScanStatus.notFound);
      expect(o.title, 'MÃ VÉ KHÔNG ĐÚNG');
    });

    test('Unknown status maps to error', () {
      final o = ScanOutcome.fromServiceResult({'status': 'SOME_RANDOM', 'message': ''});
      expect(o.status, ScanStatus.error);
      expect(o.title, 'LỖI ĐỒNG BỘ');
    });

    test('Empty status maps to error', () {
      final o = ScanOutcome.fromServiceResult({});
      expect(o.status, ScanStatus.error);
    });

    test('offline flag true when offline key is true', () {
      final o = ScanOutcome.fromServiceResult({'status': 'VALID', 'message': 'x', 'offline': true});
      expect(o.isOffline, true);
    });

    test('offline flag detected from message containing "Offline"', () {
      final o = ScanOutcome.fromServiceResult({
        'status': 'VALID',
        'message': 'Hợp lệ (Offline Fallback)',
      });
      expect(o.isOffline, true);
    });

    test('empty message is replaced with sanitized fallback', () {
      final o = ScanOutcome.fromServiceResult({'status': 'VALID', 'message': ''});
      expect(o.message, isNotEmpty);
      expect(o.message, isNot(contains('Exception')));
    });

    test('dismissAfter is 1500ms for valid', () {
      final o = ScanOutcome.fromServiceResult({'status': 'VALID', 'message': 'x'});
      expect(o.dismissAfter.inMilliseconds, 1500);
    });

    test('dismissAfter is 2500ms for non-valid', () {
      for (final s in ['ALREADY_USED', 'NOT_FOUND', 'ERROR']) {
        final o = ScanOutcome.fromServiceResult({'status': s, 'message': 'x'});
        expect(o.dismissAfter.inMilliseconds, 2500, reason: 'status=$s');
      }
    });
  });

  // ── ScanResultPanel widget tests ──────────────────────────────────────────

  group('ScanResultPanel — VALID state', () {
    testWidgets('shows HỢP LỆ title', (tester) async {
      await tester.pumpWidget(_wrap(result: {'status': 'VALID', 'message': 'Vé hợp lệ'}));
      expect(find.text('HỢP LỆ'), findsOneWidget);
    });

    testWidgets('shows check_circle icon', (tester) async {
      await tester.pumpWidget(_wrap(result: {'status': 'VALID', 'message': 'x'}));
      expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
    });

    testWidgets('shows Online badge when not offline', (tester) async {
      await tester.pumpWidget(_wrap(result: {'status': 'VALID', 'message': 'x', 'offline': false}));
      expect(find.text('Online'), findsOneWidget);
    });

    testWidgets('shows Offline Fallback badge when offline', (tester) async {
      await tester.pumpWidget(_wrap(result: {
        'status': 'VALID',
        'message': 'Hợp lệ (Offline Fallback)',
        'offline': true,
      }));
      expect(find.text('Offline Fallback'), findsOneWidget);
    });
  });

  group('ScanResultPanel — ALREADY_USED state', () {
    testWidgets('shows VÉ ĐÃ SỬ DỤNG title', (tester) async {
      await tester.pumpWidget(
          _wrap(result: {'status': 'ALREADY_USED', 'message': 'Đã dùng'}));
      expect(find.text('VÉ ĐÃ SỬ DỤNG'), findsOneWidget);
    });

    testWidgets('shows warning icon', (tester) async {
      await tester.pumpWidget(
          _wrap(result: {'status': 'ALREADY_USED', 'message': 'x'}));
      expect(find.byIcon(Icons.warning_rounded), findsOneWidget);
    });
  });

  group('ScanResultPanel — NOT_FOUND state', () {
    testWidgets('shows MÃ VÉ KHÔNG ĐÚNG title', (tester) async {
      await tester.pumpWidget(
          _wrap(result: {'status': 'NOT_FOUND', 'message': 'Không tồn tại'}));
      expect(find.text('MÃ VÉ KHÔNG ĐÚNG'), findsOneWidget);
    });

    testWidgets('shows cancel icon', (tester) async {
      await tester.pumpWidget(
          _wrap(result: {'status': 'NOT_FOUND', 'message': 'x'}));
      expect(find.byIcon(Icons.cancel_rounded), findsOneWidget);
    });
  });

  group('ScanResultPanel — ERROR state', () {
    testWidgets('shows LỖI ĐỒNG BỘ title for unknown status', (tester) async {
      await tester.pumpWidget(
          _wrap(result: {'status': 'TIMEOUT', 'message': 'x'}));
      expect(find.text('LỖI ĐỒNG BỘ'), findsOneWidget);
    });

    testWidgets('shows cloud_off icon', (tester) async {
      await tester.pumpWidget(
          _wrap(result: {'status': 'ERROR', 'message': 'x'}));
      expect(find.byIcon(Icons.cloud_off_rounded), findsOneWidget);
    });
  });

  group('ScanResultPanel — dismiss behaviour', () {
    testWidgets('tap on panel calls onClose immediately', (tester) async {
      bool closed = false;
      await tester.pumpWidget(_wrap(
        result: {'status': 'VALID', 'message': 'x'},
        onClose: () => closed = true,
      ));
      await tester.tap(find.byType(ScanResultPanel));
      await tester.pump();
      expect(closed, true);
    });

    testWidgets('VALID auto-dismisses after 1500ms', (tester) async {
      bool closed = false;
      await tester.pumpWidget(_wrap(
        result: {'status': 'VALID', 'message': 'x'},
        onClose: () => closed = true,
      ));
      // Not yet dismissed at 1000ms
      await tester.pump(const Duration(milliseconds: 1000));
      expect(closed, false);
      // Dismissed at 1500ms
      await tester.pump(const Duration(milliseconds: 500));
      expect(closed, true);
    });

    testWidgets('NOT_FOUND auto-dismisses after 2500ms (not before)', (tester) async {
      bool closed = false;
      await tester.pumpWidget(_wrap(
        result: {'status': 'NOT_FOUND', 'message': 'x'},
        onClose: () => closed = true,
      ));
      await tester.pump(const Duration(milliseconds: 1500));
      expect(closed, false);
      await tester.pump(const Duration(milliseconds: 1000));
      expect(closed, true);
    });

    testWidgets('onClose is called exactly once even if tapped and timer fires', (tester) async {
      int closeCount = 0;
      await tester.pumpWidget(_wrap(
        result: {'status': 'VALID', 'message': 'x'},
        onClose: () => closeCount++,
      ));
      await tester.tap(find.byType(ScanResultPanel)); // manual dismiss
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 2000)); // timer fires
      expect(closeCount, 1); // guard prevents double-call
    });
  });
}
