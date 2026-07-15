class ApiConfig {
  static const _configuredBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const _defaultBaseUrl = 'https://api.ticketboxz.me/api/v1';

  static String get baseUrl {
    if (_configuredBaseUrl.isNotEmpty) {
      return _configuredBaseUrl;
    }

    return _defaultBaseUrl;
  }
}
