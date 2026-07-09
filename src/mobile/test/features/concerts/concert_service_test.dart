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
}
