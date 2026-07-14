import 'package:flutter/material.dart';
import '../models/concert.dart';
import '../services/concert_service.dart';

enum ConcertState { initial, loading, loaded, error }

class ConcertProvider with ChangeNotifier {
  final ConcertService _concertService;

  ConcertState _state = ConcertState.initial;
  List<Concert> _concerts = [];
  String _errorMessage = '';

  ConcertProvider(this._concertService);

  ConcertState get state => _state;
  List<Concert> get concerts => _concerts;
  String get errorMessage => _errorMessage;

  Future<void> fetchConcerts() async {
    _state = ConcertState.loading;
    notifyListeners();
    try {
      _concerts = await _concertService.getAllConcerts();
      _state = ConcertState.loaded;
    } catch (e) {
      _errorMessage = e.toString();
      _state = ConcertState.error;
    }
    notifyListeners();
  }
}
