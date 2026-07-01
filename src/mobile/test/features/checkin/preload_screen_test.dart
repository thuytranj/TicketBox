import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:ticketbox_mobile/core/theme/gate_app_theme.dart';
import 'package:ticketbox_mobile/features/checkin/models/preload_step.dart';
import 'package:ticketbox_mobile/features/checkin/providers/checkin_provider.dart';
import 'package:ticketbox_mobile/features/checkin/screens/preload_screen.dart';
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
  @override
  int ticketCount;
  @override
  int vipCount;

  bool preloadCalled = false;

  _MockCheckinProvider({
    this.state = PreloadState.initial,
    this.currentStep = PreloadStep.initial,
    this.errorMessage = '',
    this.ticketCount = 0,
    this.vipCount = 0,
  });

  @override
  Future<void> preloadData(String concertId) async {
    preloadCalled = true;
  }

  @override
  void reset() {}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Tests ────────────────────────────────────────────────────────────────────

void main() {
  group('PreloadScreen Widget Tests', () {
    testWidgets('renders concert information card correctly', (tester) async {
      final mock = _MockCheckinProvider();
      await tester.pumpWidget(_wrap(mock, _testConcert));

      expect(find.text('Blackpink World Tour'), findsOneWidget);
      expect(find.text('Sân vận động Mỹ Đình'), findsOneWidget);
      expect(find.byIcon(Icons.confirmation_number_outlined), findsOneWidget);
    });

    testWidgets('connecting step shows active status during connecting', (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.loading,
        currentStep: PreloadStep.connecting,
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      // Active state shows rotating sync icon
      expect(find.byIcon(Icons.sync_rounded), findsOneWidget);
      
      // Other steps are pending (circle icon)
      expect(find.byIcon(Icons.radio_button_unchecked_rounded), findsNWidgets(2));
    });

    testWidgets('downloading step shows active and connecting step shows success', (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.loading,
        currentStep: PreloadStep.downloading,
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      // Connecting step shows check icon (success)
      expect(find.byIcon(Icons.check_circle_outline_rounded), findsOneWidget);
      
      // Downloading shows sync icon
      expect(find.byIcon(Icons.sync_rounded), findsOneWidget);
      
      // Saving shows radio unchecked icon
      expect(find.byIcon(Icons.radio_button_unchecked_rounded), findsOneWidget);
    });

    testWidgets('saving step shows active and other steps show success', (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.loading,
        currentStep: PreloadStep.saving,
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      // Connecting and Downloading show check icon
      expect(find.byIcon(Icons.check_circle_outline_rounded), findsNWidgets(2));
      
      // Saving shows sync icon
      expect(find.byIcon(Icons.sync_rounded), findsOneWidget);
      
      // No unchecked icons
      expect(find.byIcon(Icons.radio_button_unchecked_rounded), findsNothing);
    });

    testWidgets('completed step shows all success icons, renders database offline summary card', (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.loaded,
        currentStep: PreloadStep.completed,
        ticketCount: 1420,
        vipCount: 120,
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      // All 3 steps show check icon
      expect(find.byIcon(Icons.check_circle_outline_rounded), findsNWidgets(3));
      
      // Badge "SẴN SÀNG"
      expect(find.text('SẴN SÀNG'), findsOneWidget);
      
      // Summary values
      expect(find.text('1420'), findsOneWidget);
      expect(find.text('120'), findsOneWidget);
      
      // Confirm CTA button
      final btn = tester.widget<GateButton>(find.byKey(const Key('preload_action_btn')));
      expect(btn.label, 'Vào màn hình quét vé');
      expect(btn.onPressed, isNotNull);
    });

    testWidgets('error state displays failure step, error message details and Thử lại button', (tester) async {
      final mock = _MockCheckinProvider(
        state: PreloadState.error,
        currentStep: PreloadStep.downloading, // Failed during download
        errorMessage: 'DioException: connection timeout',
      );
      await tester.pumpWidget(_wrap(mock, _testConcert));

      // Connecting step succeeds
      expect(find.byIcon(Icons.check_circle_outline_rounded), findsOneWidget);
      
      // Downloading step fails (error icon)
      expect(find.byIcon(Icons.error_outline_rounded), findsOneWidget);
      
      // Saving step remains pending
      expect(find.byIcon(Icons.radio_button_unchecked_rounded), findsOneWidget);

      // Sanitized network error message displays
      expect(
        find.text('Không thể kết nối máy chủ. Vui lòng kiểm tra Wi-Fi hoặc 4G.'),
        findsOneWidget,
      );

      // Thử lại button
      final btn = tester.widget<GateButton>(find.byKey(const Key('preload_action_btn')));
      expect(btn.label, 'Thử lại');
      expect(btn.onPressed, isNotNull);

      // Triggering button calls preloadData
      await tester.tap(find.byKey(const Key('preload_action_btn')));
      await tester.pump();
      expect(mock.preloadCalled, isTrue);
    });
  });
}
