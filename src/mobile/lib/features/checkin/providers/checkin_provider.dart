import 'package:flutter/material.dart';
import '../models/preload_step.dart';
import '../services/checkin_service.dart';

enum PreloadState { initial, loading, loaded, error }

class CheckinProvider with ChangeNotifier {
  final CheckinService _checkinService;
  
  PreloadState _state = PreloadState.initial;
  PreloadStep _currentStep = PreloadStep.initial;
  String _errorMessage = '';
  int _ticketCount = 0;
  int _vipCount = 0;

  CheckinProvider(this._checkinService);

  PreloadState get state => _state;
  PreloadStep get currentStep => _currentStep;
  String get errorMessage => _errorMessage;
  int get ticketCount => _ticketCount;
  int get vipCount => _vipCount;

  Future<void> preloadData(String concertId) async {
    _state = PreloadState.loading;
    _currentStep = PreloadStep.connecting;
    _errorMessage = '';
    _ticketCount = 0;
    _vipCount = 0;
    notifyListeners();
    try {
      await _checkinService.preloadCheckinData(
        concertId,
        onStepChanged: (step) {
          _currentStep = step;
          notifyListeners();
        },
      );
      _ticketCount = await _checkinService.getTicketCount(concertId);
      _vipCount = await _checkinService.getVipCount(concertId);
      _currentStep = PreloadStep.completed;
      _state = PreloadState.loaded;
    } catch (e) {
      _errorMessage = e.toString();
      // Keep _currentStep as the one that failed so UI can highlight it
      _state = PreloadState.error;
    }
    notifyListeners();
  }
  
  void reset() {
    _state = PreloadState.initial;
    _currentStep = PreloadStep.initial;
    _ticketCount = 0;
    _vipCount = 0;
    _errorMessage = '';
    notifyListeners();
  }
}
