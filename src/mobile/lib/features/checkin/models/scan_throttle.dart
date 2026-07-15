class ScanThrottle {
  ScanThrottle({
    this.cooldown = const Duration(seconds: 3),
  });

  final Duration cooldown;

  String? _lastAcceptedCode;
  DateTime? _lastAcceptedAt;

  bool shouldAccept(String code, DateTime now) {
    if (code.isEmpty) return false;

    final lastCode = _lastAcceptedCode;
    final lastAcceptedAt = _lastAcceptedAt;
    final withinCooldown = lastCode == code &&
        lastAcceptedAt != null &&
        now.difference(lastAcceptedAt) < cooldown;

    if (withinCooldown) {
      return false;
    }

    _lastAcceptedCode = code;
    _lastAcceptedAt = now;
    return true;
  }
}
