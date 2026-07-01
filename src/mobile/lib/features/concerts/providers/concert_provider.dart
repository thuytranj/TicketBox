import 'package:flutter/material.dart';
import '../models/concert.dart';
import '../services/concert_service.dart';

enum ConcertState { initial, loading, loaded, error }

class ConcertProvider with ChangeNotifier {
  final ConcertService _concertService;
  
  ConcertState _state = ConcertState.initial;
  List<Concert> _concerts = [];
  String _errorMessage = '';
  Concert? _selectedConcert;

  ConcertProvider(this._concertService);

  ConcertState get state => _state;
  List<Concert> get concerts => _concerts;
  String get errorMessage => _errorMessage;
  Concert? get selectedConcert => _selectedConcert;

  Future<void> fetchConcerts() async {
    _state = ConcertState.loading;
    notifyListeners();
    try {
      _concerts = await _concertService.getConcerts();

      // Invalidate stale selection: if the previously selected concert is no
      // longer in the refreshed list, clear it so the UI CTA stays disabled.
      if (_selectedConcert != null) {
        final stillExists = _concerts.any((c) => c.id == _selectedConcert!.id);
        if (!stillExists) {
          _selectedConcert = null;
        }
      }

      _state = ConcertState.loaded;
    } catch (e) {
      _errorMessage = e.toString();
      _state = ConcertState.error;
    }
    notifyListeners();
  }

  void selectConcert(Concert concert) {
    _selectedConcert = concert;
    notifyListeners();
  }
  
  void clearSelection() {
    _selectedConcert = null;
    notifyListeners();
  }
}
