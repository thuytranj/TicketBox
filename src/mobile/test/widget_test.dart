import 'package:flutter_test/flutter_test.dart';
import 'package:ticketbox_mobile/features/checkin/models/scan_outcome.dart';

void main() {
  group('ScanOutcome smoke test', () {
    test('maps unknown service statuses to sanitized error outcome', () {
      final outcome = ScanOutcome.fromServiceResult({
        'status': 'UNEXPECTED_BACKEND_STATUS',
        'message': '',
      });

      expect(outcome.status, ScanStatus.error);
      expect(outcome.title, 'LỖI ĐỒNG BỘ');
      expect(outcome.message, 'Có lỗi xảy ra. Thử lại.');
    });
  });
}
