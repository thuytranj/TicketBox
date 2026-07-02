class CheckinEntry {
  final String id;
  final String concertId;
  final String entryType;
  final String qrCodeHash;
  final String checkinStatus;
  final String? zoneId;
  final String? checkedInAt;
  final String updatedAt;

  CheckinEntry({
    required this.id,
    required this.concertId,
    required this.entryType,
    required this.qrCodeHash,
    required this.checkinStatus,
    this.zoneId,
    this.checkedInAt,
    required this.updatedAt,
  });

  Map<String, Object?> toJson() => {
        'id': id,
        'concert_id': concertId,
        'entry_type': entryType,
        'qr_code_hash': qrCodeHash,
        'checkin_status': checkinStatus,
        'zone_id': zoneId,
        'checked_in_at': checkedInAt,
        'updated_at': updatedAt,
      };
}
