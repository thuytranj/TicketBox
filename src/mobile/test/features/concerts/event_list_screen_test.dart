import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:ticketbox_mobile/core/theme/gate_app_theme.dart';
import 'package:ticketbox_mobile/features/auth/providers/auth_provider.dart';
import 'package:ticketbox_mobile/features/concerts/models/concert.dart';
import 'package:ticketbox_mobile/features/concerts/providers/concert_provider.dart';
import 'package:ticketbox_mobile/features/concerts/screens/event_list_screen.dart';
import 'package:ticketbox_mobile/features/concerts/widgets/event_card.dart';
import 'package:ticketbox_mobile/shared/widgets/gate_button.dart';
import 'package:ticketbox_mobile/shared/widgets/gate_empty_state.dart';
import 'package:ticketbox_mobile/shared/widgets/gate_error_state.dart';
import 'package:ticketbox_mobile/shared/widgets/gate_loading_state.dart';

// ── Mock Providers ─────────────────────────────────────────────────────────────

class _MockConcertProvider extends ChangeNotifier implements ConcertProvider {
  @override
  ConcertState state;
  @override
  List<Concert> concerts;
  @override
  String errorMessage;
  @override
  Concert? selectedConcert;

  bool fetchCalled = false;
  bool selectCalled = false;

  _MockConcertProvider({
    this.state = ConcertState.loaded,
    this.concerts = const [],
    this.errorMessage = '',
    this.selectedConcert,
  });

  @override
  Future<void> fetchConcerts() async {
    fetchCalled = true;
  }

  @override
  void selectConcert(Concert concert) {
    selectCalled = true;
    selectedConcert = concert;
    notifyListeners();
  }

  @override
  void clearSelection() {
    selectedConcert = null;
    notifyListeners();
  }
}

class _MockAuthProvider extends ChangeNotifier implements AuthProvider {
  @override
  AuthState state = AuthState.authenticated;
  @override
  String errorMessage = '';
  @override
  bool get isOfflineDegraded => false;
  @override
  get user => null;

  @override
  Future<bool> login(String email, String password) async => true;
  @override
  Future<void> logout() async {}
  @override
  Future<void> checkAuthStatus() async {}
}

// ── Helper ─────────────────────────────────────────────────────────────────────

Widget _wrap({
  required _MockConcertProvider concertMock,
  _MockAuthProvider? authMock,
}) =>
    MaterialApp(
      theme: GateAppTheme.dark(),
      home: MultiProvider(
        providers: [
          ChangeNotifierProvider<ConcertProvider>.value(value: concertMock),
          ChangeNotifierProvider<AuthProvider>.value(
              value: authMock ?? _MockAuthProvider()),
        ],
        child: const EventListScreen(),
      ),
    );

// Sample concerts for testing
final _concertA = Concert(
  id: 'c1',
  title: 'Rock Night 2026',
  location: 'Hà Nội Arena',
);
final _concertB = Concert(
  id: 'c2',
  title: 'Jazz Evening',
  location: 'TP.HCM Convention Center',
);

// ── Tests ──────────────────────────────────────────────────────────────────────

void main() {
  group('EventListScreen', () {
    // ── Loading state ─────────────────────────────────────────────────────────

    testWidgets('shows GateLoadingState when ConcertState.loading',
        (tester) async {
      final mock = _MockConcertProvider(state: ConcertState.loading);
      await tester.pumpWidget(_wrap(concertMock: mock));

      expect(find.byType(GateLoadingState), findsOneWidget);
      expect(find.text('Đang tải danh sách sự kiện...'), findsOneWidget);
    });

    testWidgets('shows GateLoadingState when ConcertState.initial',
        (tester) async {
      final mock = _MockConcertProvider(state: ConcertState.initial);
      await tester.pumpWidget(_wrap(concertMock: mock));

      expect(find.byType(GateLoadingState), findsOneWidget);
    });

    // ── Error state ───────────────────────────────────────────────────────────

    testWidgets('shows GateErrorState when ConcertState.error', (tester) async {
      final mock = _MockConcertProvider(
        state: ConcertState.error,
        errorMessage: 'SocketException: Network unreachable',
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      expect(find.byType(GateErrorState), findsOneWidget);
    });

    testWidgets('error state shows retry button that calls fetchConcerts',
        (tester) async {
      final mock = _MockConcertProvider(
        state: ConcertState.error,
        errorMessage: 'Unknown error',
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      expect(find.text('Thử lại'), findsOneWidget);
      await tester.tap(find.text('Thử lại'));
      await tester.pump();

      expect(mock.fetchCalled, isTrue);
    });

    // ── Empty state ───────────────────────────────────────────────────────────

    testWidgets('shows GateEmptyState when concerts list is empty',
        (tester) async {
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: [],
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      expect(find.byType(GateEmptyState), findsOneWidget);
      expect(find.byIcon(Icons.event_busy_outlined), findsOneWidget);
      expect(
        find.text('Hiện không có sự kiện đang mở để soát vé.'),
        findsOneWidget,
      );
    });

    // ── Loaded state ──────────────────────────────────────────────────────────

    testWidgets('shows EventCard for each concert', (tester) async {
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: [_concertA, _concertB],
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      expect(find.byType(EventCard), findsNWidgets(2));
      expect(find.text('Rock Night 2026'), findsOneWidget);
      expect(find.text('Jazz Evening'), findsOneWidget);
    });

    testWidgets('renders concert location text', (tester) async {
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: [_concertA],
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      expect(find.text('Hà Nội Arena'), findsOneWidget);
    });

    // ── Selection ─────────────────────────────────────────────────────────────

    testWidgets('tapping EventCard calls selectConcert', (tester) async {
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: [_concertA],
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      await tester.tap(find.byType(EventCard).first);
      await tester.pump();

      expect(mock.selectCalled, isTrue);
    });

    testWidgets('selected EventCard shows check icon', (tester) async {
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: [_concertA],
        selectedConcert: _concertA,
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
    });

    testWidgets('unselected EventCard does not show check icon', (tester) async {
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: [_concertA],
        selectedConcert: null,
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      expect(find.byIcon(Icons.check_circle_rounded), findsNothing);
    });

    // ── CTA state ─────────────────────────────────────────────────────────────

    testWidgets('CTA button is disabled when no concert selected', (tester) async {
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: [_concertA],
        selectedConcert: null,
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      final cta = tester.widget<GateButton>(find.byKey(const Key('confirm_cta')));
      expect(cta.onPressed, isNull);
    });

    testWidgets('CTA button is enabled when concert is selected', (tester) async {
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: [_concertA],
        selectedConcert: _concertA,
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      final cta = tester.widget<GateButton>(find.byKey(const Key('confirm_cta')));
      expect(cta.onPressed, isNotNull);
    });

    testWidgets('CTA label shows "Chọn một sự kiện" when no selection',
        (tester) async {
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: [_concertA],
        selectedConcert: null,
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      expect(
        find.text('Chọn một sự kiện để tiếp tục'),
        findsOneWidget,
      );
    });

    testWidgets('CTA label shows concert title when selected', (tester) async {
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: [_concertA],
        selectedConcert: _concertA,
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      expect(
        find.text('Xác nhận: Rock Night 2026'),
        findsOneWidget,
      );
    });

    // ── Logout ────────────────────────────────────────────────────────────────

    testWidgets('logout button is rendered', (tester) async {
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: [],
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      expect(find.byKey(const Key('logout_button')), findsOneWidget);
    });
  });
}
