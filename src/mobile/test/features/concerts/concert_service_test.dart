import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ticketbox_mobile/core/network/dio_client.dart';
import 'package:ticketbox_mobile/features/concerts/services/concert_service.dart';

class _FakeStorage extends FlutterSecureStorage {
  const _FakeStorage();
}

class _StubDioClient extends DioClient {
  _StubDioClient(this.responses) : super(const _FakeStorage());

  final List<dynamic> responses;
  final List<Map<String, dynamic>?> seenQueries = [];

  @override
  Future<dynamic> get(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    seenQueries.add(queryParameters);
    if (responses.isEmpty) {
      throw StateError('No stubbed response left for $path');
    }
    return responses.removeAt(0);
  }
}

void main() {
  group('ConcertService.getConcerts', () {
    test('parses a single paginated response page', () async {
      final dioClient = _StubDioClient([
        {
          'concerts': [
            {'id': 'c1', 'title': 'Rock Night', 'location': 'Ha Noi'},
          ],
          'meta': {'totalPages': 1},
        },
      ]);

      final service = ConcertService(dioClient);
      final concerts = await service.getConcerts();

      expect(concerts, hasLength(1));
      expect(concerts.first.id, 'c1');
      expect(concerts.first.title, 'Rock Night');
      expect(
        dioClient.seenQueries,
        equals([
          {'page': 1, 'limit': 100},
        ]),
      );
    });

    test('fetches all pages when backend paginates /concerts', () async {
      final dioClient = _StubDioClient([
        {
          'concerts': [
            {'id': 'c1', 'title': 'Rock Night', 'location': 'Ha Noi'},
            {'id': 'c2', 'title': 'Jazz Evening', 'location': 'HCM'},
          ],
          'meta': {'totalPages': 2},
        },
        {
          'concerts': [
            {'id': 'c3', 'title': 'Symphony Live', 'location': 'Da Nang'},
          ],
          'meta': {'totalPages': 2},
        },
      ]);

      final service = ConcertService(dioClient);
      final concerts = await service.getConcerts();

      expect(concerts.map((c) => c.id).toList(), ['c1', 'c2', 'c3']);
      expect(
        dioClient.seenQueries,
        equals([
          {'page': 1, 'limit': 100},
          {'page': 2, 'limit': 100},
        ]),
      );
    });
  });

  group('ConcertService.getAllConcerts', () {
    test('merges active and completed concerts', () async {
      // Two parallel calls: active page + completed page
      final dioClient = _StubDioClient([
        // active fetch — page 1 (only page)
        {
          'concerts': [
            {'id': 'a1', 'title': 'Active One', 'location': 'Ha Noi'},
            {'id': 'a2', 'title': 'Active Two', 'location': 'HCM'},
          ],
          'meta': {'totalPages': 1},
        },
        // completed fetch — page 1 (only page)
        {
          'concerts': [
            {'id': 'p1', 'title': 'Past One', 'location': 'Da Nang', 'status': 'completed'},
          ],
          'meta': {'totalPages': 1},
        },
      ]);

      final service = ConcertService(dioClient);
      final concerts = await service.getAllConcerts();

      final ids = concerts.map((c) => c.id).toSet();
      expect(ids, containsAll(['a1', 'a2', 'p1']));
      expect(concerts.length, 3);
    });

    test('deduplicates concerts that appear in both active and completed',
        () async {
      // Simulate a concert that appears in both lists (e.g. backend overlap)
      final dioClient = _StubDioClient([
        {
          'concerts': [
            {'id': 'shared', 'title': 'Shared Concert', 'location': 'Ha Noi'},
            {'id': 'a1', 'title': 'Active Only', 'location': 'HCM'},
          ],
          'meta': {'totalPages': 1},
        },
        {
          'concerts': [
            {'id': 'shared', 'title': 'Shared Concert', 'location': 'Ha Noi'},
            {'id': 'p1', 'title': 'Past Only', 'location': 'Da Nang'},
          ],
          'meta': {'totalPages': 1},
        },
      ]);

      final service = ConcertService(dioClient);
      final concerts = await service.getAllConcerts();

      // 'shared' appears once, not twice
      final ids = concerts.map((c) => c.id).toList();
      expect(ids.where((id) => id == 'shared').length, 1);
      expect(concerts.length, 3); // shared + a1 + p1
    });

    test('sends status=active and status=completed query params', () async {
      final dioClient = _StubDioClient([
        {'concerts': [], 'meta': {'totalPages': 1}},
        {'concerts': [], 'meta': {'totalPages': 1}},
      ]);

      final service = ConcertService(dioClient);
      await service.getAllConcerts();

      final statuses =
          dioClient.seenQueries.map((q) => q?['status']).toSet();
      expect(statuses, containsAll(['active', 'completed']));
    });

    test('returns active concerts even if completed fetch fails', () async {
      // First call succeeds (active), second throws (completed)
      int callCount = 0;
      final errorClient = _ErrorAfterFirstDioClient(
        successResponse: {
          'concerts': [
            {'id': 'a1', 'title': 'Active', 'location': 'Ha Noi'},
          ],
          'meta': {'totalPages': 1},
        },
      );

      final service = ConcertService(errorClient);
      final concerts = await service.getAllConcerts();

      // Should still get the active concerts
      expect(concerts.map((c) => c.id), contains('a1'));
    });
  });
}

/// DioClient that succeeds on first call, fails on second (simulates completed fetch error).
class _ErrorAfterFirstDioClient extends DioClient {
  _ErrorAfterFirstDioClient({required this.successResponse})
      : super(const _FakeStorage());

  final dynamic successResponse;
  int _calls = 0;

  @override
  Future<dynamic> get(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    _calls++;
    if (_calls == 1) return successResponse;
    throw StateError('Simulated completed fetch failure');
  }
}
