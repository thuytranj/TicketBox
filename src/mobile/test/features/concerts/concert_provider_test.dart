import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:ticketbox_mobile/features/concerts/models/concert.dart';
import 'package:ticketbox_mobile/features/concerts/providers/concert_provider.dart';
import 'package:ticketbox_mobile/features/concerts/services/concert_service.dart';
import 'package:ticketbox_mobile/core/network/dio_client.dart';

// ── Stub layer ────────────────────────────────────────────────────────────────
//
// We subclass ConcertService and override getConcerts() so the provider under
// test never touches the network.  The DioClient/storage passed to super() are
// never used because getConcerts is fully overridden.

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
  Future<List<Concert>> getConcerts() async => response;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

Concert _c(String id) => Concert(id: id, title: 'C$id', location: 'Venue');

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  group('ConcertProvider — stale selection invalidation', () {
    test('selected concert cleared when absent from refreshed list', () async {
      final stub = _StubConcertService([_c('A'), _c('B')]);
      final provider = ConcertProvider(stub);

      await provider.fetchConcerts();
      provider.selectConcert(_c('A'));
      expect(provider.selectedConcert?.id, 'A');

      stub.response = [_c('B'), _c('C')]; // A removed
      await provider.fetchConcerts();

      expect(provider.selectedConcert, isNull,
          reason: 'A was removed — selection should be cleared');
    });

    test('selected concert kept when still present in refreshed list', () async {
      final stub = _StubConcertService([_c('A'), _c('B')]);
      final provider = ConcertProvider(stub);

      await provider.fetchConcerts();
      provider.selectConcert(_c('B'));

      stub.response = [_c('B'), _c('C')];
      await provider.fetchConcerts();

      expect(provider.selectedConcert?.id, 'B');
    });

    test('no selection before fetch — selectedConcert stays null', () async {
      final stub = _StubConcertService([_c('A')]);
      final provider = ConcertProvider(stub);
      await provider.fetchConcerts();
      expect(provider.selectedConcert, isNull);
    });

    test('only 2 notifyListeners calls during fetch (loading + loaded)', () async {
      final stub = _StubConcertService([_c('A')]);
      final provider = ConcertProvider(stub);
      provider.selectConcert(_c('OLD'));

      stub.response = [_c('NEW')]; // OLD gone

      int count = 0;
      provider.addListener(() => count++);
      await provider.fetchConcerts();

      // loading notify + loaded notify = 2
      // selection clear is NOT a separate notifyListeners
      expect(count, 2);
      expect(provider.selectedConcert, isNull);
    });
  });
}
