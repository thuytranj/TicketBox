import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:ticketbox_mobile/core/theme/gate_app_theme.dart';
import 'package:ticketbox_mobile/features/checkin/models/preload_step.dart';
import 'package:ticketbox_mobile/features/checkin/providers/checkin_provider.dart';
import 'package:ticketbox_mobile/features/checkin/screens/preload_screen.dart';
import 'package:ticketbox_mobile/features/checkin/widgets/dashboard_stat_card.dart';
import 'package:ticketbox_mobile/features/concerts/models/concert.dart';
import 'package:ticketbox_mobile/shared/widgets/gate_button.dart';

// ── Mock CheckinProvider ──────────────────────────────────────────────────────

class _MockCheckinProvider extends ChangeNotifier implements CheckinProvider {
  @override
  PreloadState state;
  @override
  PreloadStep currentStep;
  @override
  String errorMessage;

  // Raw totals (backwards compat)
  @override
  int ticketCount;
  @override
  int vipCount;

  // Dashboard metrics
  @override
  int totalEntries;
  @override
  int checkedInCount;
  @override
  int ticketRemaining;
  @override
  int vipRemaining;

  bool preloadCalled = false;

  _MockCheckinProvider({
    this.state = PreloadState.initial,
    this.currentStep = PreloadStep.initial,
    this.errorMessage = '',
    this.ticketCount = 0,
    this.vipCount = 0,
    this.totalEntries = 0,
    this.checkedInCount = 0,
    this.ticketRemaining = 0,
    this.vipRemaining = 0,
  });

  @override
  Future<void> preloadData(String concertId) async {
    preloadCalled = true;
  }

  @override
  void reset() {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

Widget _wrap(_MockCheckinProvider mock, Concert concert) => MaterialApp(
      theme: GateAppTheme.dark(),
      home: ChangeNotifierProvider<CheckinProvider>.value(
        value: mock,
        child: PreloadScreen(concert: concert),
      ),
    );

final _testConcert = Concert(
  id: 'c-test-123',
  title: 'Blackpink World Tour',
  location: 'Sân vận động Mỹ Đình',
);

final _upcomingConcert = Concert(
  id: 'c-upcoming-456',
  title: 'Future Show',
  location: 'Nhà thi đấu Phú Thọ',
  startTime: DateTime.now().add(const Duration(days: 1)),
  endTime: DateTime.now().add(const Duration(days: 1, hours: 3)),
  status: 'active',
);

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  group('PreloadScreen — commercial dashboard', () {
    // ── Concert identity ────────────────────────────────────────────────────

    testWidgets('renders concert title and location', (tester) async {
      final mock = _MockCheckinProvider();
      await tester.pumpWidget(_wrap(mock, _testConcert));

      expect(find.text('Blackpink World Tour'), findsOneWidget);
      expect(find.text('Sân vận động Mỹ Đình'), findsOneWidget);
    });

    testWidgets('renders eyebrow label SỰ KIỆN ĐANG MỞ', (tester) async {
      final mock = _MockCheckinProvider();
      await tester.pumpWidget(_wrap(mock, _testConcert));

      expect(find.text('SỰ KIỆN ĐANG MỞ'), findsOneWidget);
    });

    testWidgets('renders blocked eyebrow label for upcoming concert',
        (tester) async {
      final mock = _MockCheckinProvider();
      await tester.pumpWidget(_wrap(mock, _upcomingConcert));

      expect(find.text('CHECK-IN CHƯA MỞ'), findsOneWidget);
    });

    // ── No dev-facing step log ──────────────────────────────────────────────

    testWidgets('does not show dev step log labels', (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.loading,
        currentStep: PreloadStep.connecting,
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      expect(find.text('Kết nối máy chủ'), findsNothing);
      expect(find.text('Tải dữ liệu danh sách vé'), findsNothing);
      expect(find.text('Thiết lập lưu trữ offline'), findsNothing);
      expect(find.text('TIẾN TRÌNH ĐỒNG BỘ'), findsNothing);
    });

    testWidgets('does not show step radio/check icons from old UI',
        (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.loading,
        currentStep: PreloadStep.downloading,
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      expect(find.byIcon(Icons.radio_button_unchecked_rounded), findsNothing);
    });

    // ── Status line — loading ───────────────────────────────────────────────

    testWidgets('shows loading status text while preloading', (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.loading,
        currentStep: PreloadStep.downloading,
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      expect(
        find.text('Đang chuẩn bị dữ liệu check-in...'),
        findsOneWidget,
      );
    });

    testWidgets('loading state shows spinner button', (tester) async {
      final mock = _MockCheckinProvider(state: PreloadState.loading);
      await tester.pumpWidget(_wrap(mock, _testConcert));

      final btn = tester.widget<GateButton>(
        find.byKey(const Key('preload_action_btn')),
      );
      expect(btn.isLoading, isTrue);
      expect(btn.onPressed, isNull);
    });

    // ── Dashboard grid — loaded ─────────────────────────────────────────────

    testWidgets('shows 3 dashboard stat cards when loaded', (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.loaded,
        currentStep: PreloadStep.completed,
        totalEntries: 1540,
        checkedInCount: 423,
        ticketRemaining: 980,
        vipRemaining: 137,
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      expect(find.byType(DashboardStatCard), findsNWidgets(3));
    });

    testWidgets('dashboard shows correct scanned/total ratio', (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.loaded,
        currentStep: PreloadStep.completed,
        totalEntries: 1540,
        checkedInCount: 423,
        ticketRemaining: 980,
        vipRemaining: 137,
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      expect(find.text('423 / 1540'), findsOneWidget);
    });

    testWidgets('dashboard shows ticket remaining and vip remaining',
        (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.loaded,
        currentStep: PreloadStep.completed,
        totalEntries: 500,
        checkedInCount: 100,
        ticketRemaining: 342,
        vipRemaining: 58,
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      expect(find.text('342'), findsOneWidget);
      expect(find.text('58'), findsOneWidget);
    });

    testWidgets('dashboard not rendered while loading', (tester) async {
      final mock = _MockCheckinProvider(state: PreloadState.loading);
      await tester.pumpWidget(_wrap(mock, _testConcert));

      expect(find.byType(DashboardStatCard), findsNothing);
    });

    // ── Start scan button — loaded ──────────────────────────────────────────

    testWidgets('shows BẮT ĐẦU QUÉT MÃ QR button when loaded', (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.loaded,
        currentStep: PreloadStep.completed,
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      final btn = tester.widget<GateButton>(
        find.byKey(const Key('start_scan_btn')),
      );
      expect(btn.label, 'BẮT ĐẦU QUÉT MÃ QR');
      expect(btn.onPressed, isNotNull);
    });

    testWidgets('upcoming concert disables scanner entry', (tester) async {
      final mock = _MockCheckinProvider();
      await tester.pumpWidget(_wrap(mock, _upcomingConcert));

      final btn = tester.widget<GateButton>(
        find.byKey(const Key('preload_action_btn')),
      );
      expect(btn.onPressed, isNull);
      expect(btn.label, 'Check-in chưa mở');
      expect(
        find.text('Sự kiện chưa tới thời gian mở check-in.'),
        findsOneWidget,
      );
      expect(mock.preloadCalled, isFalse);
    });

    testWidgets('no confirm_cta key present anywhere in tree', (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.loaded,
        currentStep: PreloadStep.completed,
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      expect(find.byKey(const Key('confirm_cta')), findsNothing);
    });

    // ── Error state ─────────────────────────────────────────────────────────

    testWidgets('error state shows user-facing sanitized message', (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.error,
        currentStep: PreloadStep.downloading,
        errorMessage: 'DioException: connection timeout',
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      expect(
        find.text('Không thể kết nối máy chủ. Vui lòng kiểm tra Wi-Fi hoặc 4G.'),
        findsOneWidget,
      );
    });

    testWidgets('error state does not show raw exception text', (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.error,
        errorMessage: 'DioException: connection timeout',
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      expect(find.text('DioException: connection timeout'), findsNothing);
      expect(find.textContaining('Exception'), findsNothing);
    });

    testWidgets('error state shows Thử lại button', (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.error,
        errorMessage: 'Unknown error',
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      final btn = tester.widget<GateButton>(
        find.byKey(const Key('preload_action_btn')),
      );
      expect(btn.label, 'Thử lại');
      expect(btn.onPressed, isNotNull);
    });

    testWidgets('Thử lại button triggers preloadData', (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.error,
        errorMessage: 'Unknown error',
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      await tester.tap(find.byKey(const Key('preload_action_btn')));
      await tester.pump();

      expect(mock.preloadCalled, isTrue);
    });

    testWidgets('error state shows status line Chưa sẵn sàng', (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.error,
        errorMessage: 'Network error',
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      expect(find.text('Trạng thái: Chưa sẵn sàng'), findsOneWidget);
    });

    testWidgets('error state does not show dashboard grid', (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.error,
        errorMessage: 'Network error',
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      expect(find.byType(DashboardStatCard), findsNothing);
    });
  });
}
