class Concert {
  final String id;
  final String title;
  final String location;
  final String? posterUrl;

  Concert({
    required this.id,
    required this.title,
    required this.location,
    this.posterUrl,
  });

  factory Concert.fromJson(Map<String, dynamic> json) {
    return Concert(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      location: json['location'] ?? '',
      posterUrl: json['posterUrl'] ?? json['poster_url'],
    );
  }
}
