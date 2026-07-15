import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:ticketbox_mobile/features/concerts/models/concert.dart';
import 'package:ticketbox_mobile/features/concerts/providers/concert_provider.dart';
import 'package:ticketbox_mobile/features/concerts/services/concert_service.dart';
import 'package:ticketbox_mobile/core/network/dio_client.dart';

// ── Stub layer ────────────────────────────────────────────────────────────────
//
// We subclass ConcertService and override getAllConcerts() so the provider
// under test never touches the network.

class _FakeStorage extends FlutterSecureStorage {
  const _FakeStorage();
}

class _FakeDioClient extends DioClient {
  _FakeDioClient() : super(const _FakeStorage());
}

class _StubConcertService extends ConcertService {
  List<Concert> response;
  _StubConcertService(this.response) : super(_FakeDioClient());

  @override
  Future<List<Concert>> getAllConcerts() async => response;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

Concert _c(String id) => Concert(id: id, title: 'C$id', location: 'Venue');

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  group('ConcertProvider — fetchConcerts', () {
    test('state transitions: loading → loaded on success', () async {
      final stub = _StubConcertService([_c('A'), _c('B')]);
      final provider = ConcertProvider(stub);

      expect(provider.state, ConcertState.initial);
      final future = provider.fetchConcerts();
      expect(provider.state, ConcertState.loading);
      await future;
      expect(provider.state, ConcertState.loaded);
    });

    test('concerts populated after successful fetch', () async {
      final stub = _StubConcertService([_c('A'), _c('B')]);
      final provider = ConcertProvider(stub);

      await provider.fetchConcerts();

      expect(provider.concerts.map((c) => c.id).toList(), ['A', 'B']);
    });

    test('state transitions: loading → error on failure', () async {
      final stub = _StubConcertService([]);
      final provider = ConcertProvider(stub);

      // Override to throw
      final throwingStub = _ThrowingConcertService();
      final failProvider = ConcertProvider(throwingStub);

      await failProvider.fetchConcerts();

      expect(failProvider.state, ConcertState.error);
      expect(failProvider.errorMessage, isNotEmpty);
    });

    test('only 2 notifyListeners calls during fetch (loading + loaded)',
        () async {
      final stub = _StubConcertService([_c('A')]);
      final provider = ConcertProvider(stub);

      int count = 0;
      provider.addListener(() => count++);
      await provider.fetchConcerts();

      // loading notify + loaded notify = 2
      expect(count, 2);
    });

    test('refreshing replaces concerts list', () async {
      final stub = _StubConcertService([_c('A'), _c('B')]);
      final provider = ConcertProvider(stub);

      await provider.fetchConcerts();
      expect(provider.concerts.length, 2);

      stub.response = [_c('C')];
      await provider.fetchConcerts();
      expect(provider.concerts.length, 1);
      expect(provider.concerts.first.id, 'C');
    });
  });
}

class _ThrowingConcertService extends ConcertService {
  _ThrowingConcertService() : super(_FakeDioClient());

  @override
  Future<List<Concert>> getAllConcerts() async {
    throw Exception('Simulated network error');
  }
}
