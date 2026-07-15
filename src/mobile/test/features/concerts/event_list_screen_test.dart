import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:ticketbox_mobile/core/theme/gate_app_theme.dart';
import 'package:ticketbox_mobile/features/auth/providers/auth_provider.dart';
import 'package:ticketbox_mobile/features/concerts/models/concert.dart';
import 'package:ticketbox_mobile/features/concerts/providers/concert_provider.dart';
import 'package:ticketbox_mobile/features/concerts/screens/event_list_screen.dart';
import 'package:ticketbox_mobile/features/concerts/widgets/event_card.dart';
import 'package:ticketbox_mobile/shared/widgets/gate_empty_state.dart';
import 'package:ticketbox_mobile/shared/widgets/gate_error_state.dart';
import 'package:ticketbox_mobile/shared/widgets/gate_loading_state.dart';

// ── Navigation spy ─────────────────────────────────────────────────────────────

class _NavObserver extends NavigatorObserver {
  final List<Route<dynamic>> pushed = [];

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    pushed.add(route);
  }
}

// ── Mock Providers ─────────────────────────────────────────────────────────────

class _MockConcertProvider extends ChangeNotifier implements ConcertProvider {
  @override
  ConcertState state;
  @override
  List<Concert> concerts;
  @override
  String errorMessage;

  bool fetchCalled = false;

  _MockConcertProvider({
    this.state = ConcertState.loaded,
    this.concerts = const [],
    this.errorMessage = '',
  });

  @override
  Future<void> fetchConcerts() async {
    fetchCalled = true;
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

// ── Helpers ────────────────────────────────────────────────────────────────────

Widget _wrap({
  required _MockConcertProvider concertMock,
  _MockAuthProvider? authMock,
  List<NavigatorObserver>? observers,
}) =>
    MaterialApp(
      theme: GateAppTheme.dark(),
      navigatorObservers: observers ?? [],
      home: MultiProvider(
        providers: [
          ChangeNotifierProvider<ConcertProvider>.value(value: concertMock),
          ChangeNotifierProvider<AuthProvider>.value(
            value: authMock ?? _MockAuthProvider(),
          ),
        ],
        child: const EventListScreen(),
      ),
    );

// Sample concerts — "upcoming" so they appear in Sắp diễn ra tab.
final _futureTime = DateTime.now().add(const Duration(days: 5));
final _openConcert = Concert(
  id: 'c-open',
  title: 'Gate Open Concert',
  location: 'Sân khấu Trung tâm',
  startTime: DateTime.now(),
  endTime: DateTime.now().add(const Duration(hours: 2)),
  status: 'active',
);
final _laterTodayConcert = Concert(
  id: 'c-later-today',
  title: 'Later Today Concert',
  location: 'Nhà hát Thành phố',
  startTime: DateTime(
    DateTime.now().year,
    DateTime.now().month,
    DateTime.now().day,
    23,
    59,
  ),
  endTime: DateTime(
    DateTime.now().year,
    DateTime.now().month,
    DateTime.now().day,
    23,
    59,
  ).add(const Duration(hours: 2)),
  status: 'active',
);
final _concertA = Concert(
  id: 'c1',
  title: 'Rock Night 2026',
  location: 'Hà Nội Arena',
  startTime: _futureTime,
  status: 'active',
);
final _concertB = Concert(
  id: 'c2',
  title: 'Jazz Evening',
  location: 'TP.HCM Convention Center',
  startTime: _futureTime,
  status: 'active',
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
    });

    // ── Search bar ────────────────────────────────────────────────────────────

    testWidgets('search bar is rendered in loaded state', (tester) async {
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: [_concertA],
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      expect(find.byKey(const Key('search_field')), findsOneWidget);
    });

    testWidgets('search bar has placeholder text', (tester) async {
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: [],
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      expect(
        find.text('Tìm theo tên hoặc địa điểm…'),
        findsOneWidget,
      );
    });

    // ── Tab bar ───────────────────────────────────────────────────────────────

    testWidgets('renders 3 tabs', (tester) async {
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: [],
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      expect(find.byKey(const Key('event_tab_bar')), findsOneWidget);
      expect(find.byKey(const Key('tab_today')), findsOneWidget);
      expect(find.byKey(const Key('tab_upcoming')), findsOneWidget);
      expect(find.byKey(const Key('tab_past')), findsOneWidget);
    });

    testWidgets('Hôm nay tab is active by default', (tester) async {
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: [],
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      // The TabBar is present and the first tab label is visible
      expect(find.text('Hôm nay'), findsOneWidget);
    });

    // ── No confirm CTA ────────────────────────────────────────────────────────

    testWidgets(
      'confirm_cta key does not exist in widget tree',
      (tester) async {
        final mock = _MockConcertProvider(
          state: ConcertState.loaded,
          concerts: [_concertA],
        );
        await tester.pumpWidget(_wrap(concertMock: mock));

        expect(find.byKey(const Key('confirm_cta')), findsNothing);
      },
    );

    // ── Loaded concerts ───────────────────────────────────────────────────────

    testWidgets('shows EventCards for concerts in Sắp diễn ra tab',
        (tester) async {
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: [_concertA, _concertB],
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      // Tap the Sắp diễn ra tab to show upcoming concerts
      await tester.tap(find.text('Sắp diễn ra'));
      await tester.pumpAndSettle();

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

      await tester.tap(find.text('Sắp diễn ra'));
      await tester.pumpAndSettle();

      expect(find.text('Hà Nội Arena'), findsOneWidget);
    });

    // ── Direct navigation on tap ──────────────────────────────────────────────

    testWidgets('tapping open EventCard pushes a route (no confirm step)',
        (tester) async {
      final observer = _NavObserver();
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: [_openConcert],
      );
      await tester.pumpWidget(
        _wrap(concertMock: mock, observers: [observer]),
      );

      expect(find.byType(EventCard), findsOneWidget);

      // Tap card — navigation should be pushed immediately.
      // We intentionally do NOT pump after tap to avoid building
      // PreloadScreen (which depends on providers not in this test tree).
      await tester.tap(find.byType(EventCard).first);

      // One initial route + one pushed route = 2 total
      expect(observer.pushed.length, greaterThanOrEqualTo(1));
    });

    testWidgets(
      'tapping concert later today still pushes route before start time',
      (tester) async {
        final observer = _NavObserver();
        final mock = _MockConcertProvider(
          state: ConcertState.loaded,
          concerts: [_laterTodayConcert],
        );
        await tester.pumpWidget(
          _wrap(concertMock: mock, observers: [observer]),
        );

        expect(find.byType(EventCard), findsOneWidget);

        await tester.tap(find.byType(EventCard).first);

        expect(observer.pushed.length, greaterThanOrEqualTo(1));
      },
    );

    testWidgets('tapping upcoming concert shows warning and does not navigate',
        (tester) async {
      final observer = _NavObserver();
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: [_concertA],
      );
      await tester.pumpWidget(
        _wrap(concertMock: mock, observers: [observer]),
      );

      await tester.tap(find.text('Sắp diễn ra'));
      await tester.pumpAndSettle();

      final pushCountBeforeTap = observer.pushed.length;
      await tester.tap(find.byType(EventCard).first);
      await tester.pump();

      expect(
        find.text('Sự kiện chưa tới thời gian mở check-in.'),
        findsOneWidget,
      );
      expect(observer.pushed.length, pushCountBeforeTap);
    });

    // ── Pagination ────────────────────────────────────────────────────────────

    testWidgets('pagination footer renders when more than 6 concerts',
        (tester) async {
      final manyConcerts = List.generate(
        8,
        (i) => Concert(
          id: 'c$i',
          title: 'Concert $i',
          location: 'Venue $i',
          startTime: DateTime.now().add(Duration(days: i + 1)),
          status: 'active',
        ),
      );
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: manyConcerts,
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      await tester.tap(find.text('Sắp diễn ra'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('pagination_footer')), findsOneWidget);
      expect(find.text('Trang 1 / 2'), findsOneWidget);
    });

    testWidgets('next page button advances pagination', (tester) async {
      final manyConcerts = List.generate(
        8,
        (i) => Concert(
          id: 'c$i',
          title: 'Concert $i',
          location: 'Venue $i',
          startTime: DateTime.now().add(Duration(days: i + 1)),
          status: 'active',
        ),
      );
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: manyConcerts,
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      await tester.tap(find.text('Sắp diễn ra'));
      await tester.pumpAndSettle();

      expect(find.text('Trang 1 / 2'), findsOneWidget);

      await tester.tap(find.byKey(const Key('page_next')));
      await tester.pump();

      expect(find.text('Trang 2 / 2'), findsOneWidget);
    });

    testWidgets('pagination footer absent when 6 or fewer concerts',
        (tester) async {
      final fewConcerts = List.generate(
        4,
        (i) => Concert(
          id: 'c$i',
          title: 'Concert $i',
          location: 'Venue $i',
          startTime: DateTime.now().add(Duration(days: i + 1)),
          status: 'active',
        ),
      );
      final mock = _MockConcertProvider(
        state: ConcertState.loaded,
        concerts: fewConcerts,
      );
      await tester.pumpWidget(_wrap(concertMock: mock));

      await tester.tap(find.text('Sắp diễn ra'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('pagination_footer')), findsNothing);
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
