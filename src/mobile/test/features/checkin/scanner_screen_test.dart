import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ticketbox_mobile/core/network/dio_client.dart';
import 'package:ticketbox_mobile/core/theme/gate_app_theme.dart';
import 'package:ticketbox_mobile/features/checkin/screens/scanner_screen.dart';
import 'package:ticketbox_mobile/features/checkin/services/checkin_service.dart';
import 'package:ticketbox_mobile/features/concerts/models/concert.dart';

class _FakeStorage extends FlutterSecureStorage {
  const _FakeStorage();
}

class _FakeDioClient extends DioClient {
  _FakeDioClient() : super(const _FakeStorage());
}

class _FakeCheckinService extends CheckinService {
  _FakeCheckinService({
    this.pendingCount = 0,
    this.onSync,
  }) : super(
          _FakeDioClient(),
          const _FakeStorage(),
          enableBackgroundSync: false,
        );

  int pendingCount;
  bool syncCalled = false;
  Future<void> Function()? onSync;

  @override
  Future<int> getPendingLogCount(String concertId) async => pendingCount;

  @override
  Future<void> syncOfflineLogs(String concertId) async {
    syncCalled = true;
    if (onSync != null) {
      await onSync!();
    }
  }
}

Widget _wrap({
  required CheckinService service,
}) {
  return MaterialApp(
    theme: GateAppTheme.dark(),
    home: ScannerScreen(
      concert: Concert(
        id: 'concert-1',
        title: 'Rock Night 2026',
        location: 'Ha Noi Arena',
      ),
      checkinServiceOverride: service,
      connectivityStream: Stream<List<ConnectivityResult>>.value(
        const [ConnectivityResult.wifi],
      ),
      scannerPreviewBuilder: (context, controller, onDetect) {
        return const SizedBox.expand(
          child: ColoredBox(
            key: Key('fake_scanner_preview'),
            color: Color(0xFF101010),
          ),
        );
      },
    ),
  );
}

void main() {
  group('ScannerScreen', () {
    testWidgets('shows concert title in app bar and scan frame overlay',
        (tester) async {
      final service = _FakeCheckinService();
      await tester.pumpWidget(_wrap(service: service));
      await tester.pump();

      expect(find.text('Quét vé - Rock Night 2026'), findsOneWidget);
      expect(find.byKey(const Key('fake_scanner_preview')), findsOneWidget);
      expect(find.byKey(const Key('scan_frame')), findsOneWidget);
      expect(find.byKey(const Key('scan_laser')), findsOneWidget);
    });

    testWidgets('shows pending sync count from service', (tester) async {
      final service = _FakeCheckinService(pendingCount: 12);
      await tester.pumpWidget(_wrap(service: service));
      await tester.pump();

      expect(find.text('ONLINE'), findsOneWidget);
      expect(find.text('12'), findsOneWidget);
    });

    testWidgets('manual sync shows enqueue-style success message',
        (tester) async {
      final service = _FakeCheckinService();
      await tester.pumpWidget(_wrap(service: service));
      await tester.pump();

      await tester.tap(find.byKey(const Key('sync_button')));
      await tester.pump();
      await tester.pump();

      expect(service.syncCalled, isTrue);
      expect(
        find.text('Đã gửi log đồng bộ. Máy chủ sẽ xử lý trong nền.'),
        findsOneWidget,
      );
    });

    testWidgets('sync button shows spinner while sync is in flight',
        (tester) async {
      final completer = Completer<void>();
      final service = _FakeCheckinService(
        onSync: () => completer.future,
      );
      await tester.pumpWidget(_wrap(service: service));
      await tester.pump();

      await tester.tap(find.byKey(const Key('sync_button')));
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsWidgets);

      completer.complete();
      await tester.pump();
      await tester.pump();
    });
  });
}
