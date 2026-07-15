class User {
  final String id;
  final String email;
  final String role;

  User({required this.id, required this.email, required this.role});

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'role': role,
      };

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['userId'] ?? json['id'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? '',
    );
  }
}
