import 'package:flutter/material.dart';
import '../models/preload_step.dart';
import '../services/checkin_service.dart';

enum PreloadState { initial, loading, loaded, error }

class CheckinProvider with ChangeNotifier {
  final CheckinService _checkinService;

  PreloadState _state = PreloadState.initial;
  PreloadStep _currentStep = PreloadStep.initial;
  String _errorMessage = '';

  // ── Ticket counts (raw totals, kept for backwards compatibility) ────────────
  int _ticketCount = 0;
  int _vipCount = 0;

  // ── Dashboard metrics (live from local DB after preload) ────────────────────
  int _totalEntries = 0;
  int _checkedInCount = 0;
  int _ticketRemaining = 0;
  int _vipRemaining = 0;

  CheckinProvider(this._checkinService);

  PreloadState get state => _state;
  PreloadStep get currentStep => _currentStep;
  String get errorMessage => _errorMessage;

  /// Total standard tickets in local DB (unchanged from before).
  int get ticketCount => _ticketCount;

  /// Total VIP guests in local DB (unchanged from before).
  int get vipCount => _vipCount;

  /// Sum of all entries in local DB (tickets + VIP guests).
  int get totalEntries => _totalEntries;

  /// Number of entries already scanned (any type).
  int get checkedInCount => _checkedInCount;

  /// Standard tickets not yet scanned.
  int get ticketRemaining => _ticketRemaining;

  /// VIP guests not yet scanned.
  int get vipRemaining => _vipRemaining;

  Future<void> preloadData(String concertId) async {
    _state = PreloadState.loading;
    _currentStep = PreloadStep.connecting;
    _errorMessage = '';
    _ticketCount = 0;
    _vipCount = 0;
    _totalEntries = 0;
    _checkedInCount = 0;
    _ticketRemaining = 0;
    _vipRemaining = 0;
    notifyListeners();
    try {
      await _checkinService.preloadCheckinData(
        concertId,
        onStepChanged: (step) {
          _currentStep = step;
          notifyListeners();
        },
      );

      // Raw totals (kept for backwards compatibility)
      _ticketCount = await _checkinService.getTicketCount(concertId);
      _vipCount = await _checkinService.getVipCount(concertId);

      // Dashboard metrics
      _checkedInCount = await _checkinService.getTotalCheckedIn(concertId);
      _ticketRemaining = await _checkinService.getTicketRemaining(concertId);
      _vipRemaining = await _checkinService.getVipRemaining(concertId);
      _totalEntries = _ticketCount + _vipCount;

      _currentStep = PreloadStep.completed;
      _state = PreloadState.loaded;
    } catch (e) {
      _errorMessage = e.toString();
      // Keep _currentStep as the one that failed so the state is inspectable.
      _state = PreloadState.error;
    }
    notifyListeners();
  }

  void reset() {
    _state = PreloadState.initial;
    _currentStep = PreloadStep.initial;
    _ticketCount = 0;
    _vipCount = 0;
    _totalEntries = 0;
    _checkedInCount = 0;
    _ticketRemaining = 0;
    _vipRemaining = 0;
    _errorMessage = '';
    notifyListeners();
  }
}
