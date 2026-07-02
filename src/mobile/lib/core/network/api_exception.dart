class ApiException implements Exception {
  final String message;
  final int statusCode;
  final bool isNetworkError;
  final Map<String, dynamic>? responseData;

  ApiException(
    this.message,
    this.statusCode, {
    this.isNetworkError = false,
    this.responseData,
  });

  String? get errorCode {
    final data = responseData;
    if (data == null) return null;

    final value = data['code'] ?? data['status'] ?? data['error'];
    return value is String ? value : null;
  }

  @override
  String toString() => message;
}
