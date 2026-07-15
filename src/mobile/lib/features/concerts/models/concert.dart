enum ConcertGateState {
  open,
  upcoming,
  completed,
  cancelled,
  unavailable,
}

class Concert {
  final String id;
  final String title;
  final String location;
  final String? posterUrl;
  final String? description;
  final DateTime? startTime;
  final DateTime? endTime;
  final String? status;

  Concert({
    required this.id,
    required this.title,
    required this.location,
    this.posterUrl,
    this.description,
    this.startTime,
    this.endTime,
    this.status,
  });

  factory Concert.fromJson(Map<String, dynamic> json) {
    return Concert(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      location: json['location'] ?? '',
      posterUrl: json['posterUrl'] ?? json['poster_url'],
      description: json['description'] as String?,
      startTime: _parseDateTime(json['startTime'] ?? json['start_time']),
      endTime: _parseDateTime(json['endTime'] ?? json['end_time']),
      status: json['status'] as String?,
    );
  }

  ConcertGateState get gateState {
    final now = DateTime.now();
    final localStart = startTime?.toLocal();
    final localEnd = endTime?.toLocal();
    final normalizedStatus = status?.toLowerCase().trim();

    if (normalizedStatus == 'cancelled') {
      return ConcertGateState.cancelled;
    }

    if (normalizedStatus == 'completed' ||
        (localEnd != null && localEnd.isBefore(now))) {
      return ConcertGateState.completed;
    }

    if (normalizedStatus == 'draft') {
      return ConcertGateState.unavailable;
    }

    if (localStart != null) {
      // Gate staff can start check-in from 00:00 on the concert day, even if
      // the scheduled show time is later in that same day.
      if (_isSameLocalDay(localStart, now)) {
        return ConcertGateState.open;
      }

      if (now.isBefore(localStart)) {
        return ConcertGateState.upcoming;
      }
    }

    if (normalizedStatus == null || normalizedStatus.isEmpty) {
      return ConcertGateState.open;
    }

    if (normalizedStatus == 'active') {
      return ConcertGateState.open;
    }

    return ConcertGateState.unavailable;
  }

  bool get isGateOpen => gateState == ConcertGateState.open;

  String get gateEyebrowLabel {
    return switch (gateState) {
      ConcertGateState.open => 'SỰ KIỆN ĐANG MỞ',
      ConcertGateState.upcoming => 'CHECK-IN CHƯA MỞ',
      ConcertGateState.completed => 'SỰ KIỆN ĐÃ KẾT THÚC',
      ConcertGateState.cancelled => 'SỰ KIỆN ĐÃ HỦY',
      ConcertGateState.unavailable => 'CHƯA SẴN SÀNG CHECK-IN',
    };
  }

  String get gateBlockedMessage {
    return switch (gateState) {
      ConcertGateState.open => 'Sự kiện đã sẵn sàng để check-in.',
      ConcertGateState.upcoming =>
        'Sự kiện chưa tới thời gian mở check-in.',
      ConcertGateState.completed =>
        'Sự kiện này đã kết thúc, không thể vào màn check-in.',
      ConcertGateState.cancelled =>
        'Sự kiện đã bị hủy, không thể check-in.',
      ConcertGateState.unavailable =>
        'Sự kiện chưa sẵn sàng để check-in.',
    };
  }

  String get gateStatusLine {
    return switch (gateState) {
      ConcertGateState.open => 'Trạng thái: Sẵn sàng check-in',
      ConcertGateState.upcoming => 'Trạng thái: Check-in chưa mở',
      ConcertGateState.completed => 'Trạng thái: Check-in đã đóng',
      ConcertGateState.cancelled => 'Trạng thái: Sự kiện đã hủy',
      ConcertGateState.unavailable =>
        'Trạng thái: Chưa thể mở check-in cho sự kiện này',
    };
  }

  static DateTime? _parseDateTime(dynamic value) {
    if (value is! String || value.isEmpty) return null;
    return DateTime.tryParse(value);
  }

  static bool _isSameLocalDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }
}
