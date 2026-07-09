import '../../../core/network/dio_client.dart';
import '../models/concert.dart';

class ConcertService {
  final DioClient _dioClient;
  static const int _pageSize = 100;

  ConcertService(this._dioClient);

  Future<List<Concert>> getConcerts() async {
    final concerts = <Concert>[];
    var page = 1;

    while (true) {
      final data = await _dioClient.get(
        '/concerts',
        queryParameters: {
          'page': page,
          'limit': _pageSize,
        },
      );

      final pageConcerts = _parseConcertPage(data);
      concerts.addAll(pageConcerts);

      final totalPages = _readTotalPages(data);
      final shouldContinue =
          totalPages != null && totalPages > page && pageConcerts.isNotEmpty;
      if (!shouldContinue) {
        break;
      }

      page++;
    }

    return concerts;
  }

  List<Concert> _parseConcertPage(dynamic data) {
    List<dynamic> concertsJson;
    if (data is List) {
      concertsJson = data;
    } else if (data is Map<String, dynamic> && data['concerts'] != null) {
      concertsJson = data['concerts'] as List<dynamic>;
    } else {
      concertsJson = const [];
    }

    return concertsJson
        .whereType<Map<String, dynamic>>()
        .map(Concert.fromJson)
        .toList();
  }

  int? _readTotalPages(dynamic data) {
    if (data is! Map<String, dynamic>) return null;
    final meta = data['meta'];
    if (meta is! Map<String, dynamic>) return null;
    final totalPages = meta['totalPages'];
    if (totalPages is int) return totalPages;
    return int.tryParse(totalPages?.toString() ?? '');
  }
}
