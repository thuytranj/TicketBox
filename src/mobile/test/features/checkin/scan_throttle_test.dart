import 'package:flutter_test/flutter_test.dart';
import 'package:ticketbox_mobile/features/checkin/models/scan_throttle.dart';

void main() {
  group('ScanThrottle', () {
    test('accepts first scan', () {
      final throttle = ScanThrottle();
      final accepted = throttle.shouldAccept(
        'qr-001',
        DateTime(2026, 6, 30, 10, 0, 0),
      );

      expect(accepted, isTrue);
    });

    test('rejects same code within cooldown window', () {
      final throttle = ScanThrottle();
      final firstScanAt = DateTime(2026, 6, 30, 10, 0, 0);

      expect(throttle.shouldAccept('qr-001', firstScanAt), isTrue);
      expect(
        throttle.shouldAccept(
          'qr-001',
          firstScanAt.add(const Duration(seconds: 2)),
        ),
        isFalse,
      );
    });

    test('accepts same code again after cooldown expires', () {
      final throttle = ScanThrottle();
      final firstScanAt = DateTime(2026, 6, 30, 10, 0, 0);

      expect(throttle.shouldAccept('qr-001', firstScanAt), isTrue);
      expect(
        throttle.shouldAccept(
          'qr-001',
          firstScanAt.add(const Duration(seconds: 4)),
        ),
        isTrue,
      );
    });

    test('accepts different code immediately', () {
      final throttle = ScanThrottle();
      final firstScanAt = DateTime(2026, 6, 30, 10, 0, 0);

      expect(throttle.shouldAccept('qr-001', firstScanAt), isTrue);
      expect(
        throttle.shouldAccept(
          'qr-002',
          firstScanAt.add(const Duration(milliseconds: 200)),
        ),
        isTrue,
      );
    });
  });
}
