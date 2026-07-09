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

  static DateTime? _parseDateTime(dynamic value) {
    if (value is! String || value.isEmpty) return null;
    return DateTime.tryParse(value);
  }
}
