import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/network/dio_client.dart';
import '../models/user.dart';

class AuthService {
  static const _verifiedUserKey = 'verifiedUser';

  final DioClient _dioClient;
  final FlutterSecureStorage _storage;

  AuthService(this._dioClient, this._storage);

  Future<Map<String, dynamic>> login(String email, String password) async {
    final data = await _dioClient.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    
    final accessToken = data['accessToken'];
    final refreshToken = data['refreshToken'];
    
    if (accessToken != null) {
      await _storage.write(key: 'accessToken', value: accessToken);
    }
    if (refreshToken != null) {
      await _storage.write(key: 'refreshToken', value: refreshToken);
    }
    
    return data;
  }

  Future<User> getMe() async {
    final data = await _dioClient.get('/auth/me');
    return User.fromJson(data);
  }

  /// Reads the stored access token without making any network call.
  ///
  /// Returns null if the user has never logged in or has explicitly logged out.
  /// Used by [AuthProvider] to distinguish "first-time user" from "offline".
  Future<String?> getStoredToken() async {
    return _storage.read(key: 'accessToken');
  }

  Future<void> saveVerifiedUser(User user) async {
    await _storage.write(
      key: _verifiedUserKey,
      value: jsonEncode(user.toJson()),
    );
  }

  Future<User?> getLastVerifiedUser() async {
    final raw = await _storage.read(key: _verifiedUserKey);
    if (raw == null || raw.isEmpty) return null;

    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        return User.fromJson(decoded);
      }
    } catch (_) {
      await clearVerifiedUserSnapshot();
    }

    return null;
  }

  Future<void> clearVerifiedUserSnapshot() async {
    await _storage.delete(key: _verifiedUserKey);
  }

  Future<void> refresh() async {
    final refreshToken = await _storage.read(key: 'refreshToken');
    if (refreshToken == null) throw Exception('No refresh token');
    
    final data = await _dioClient.post('/auth/refresh', data: {
      'refreshToken': refreshToken,
    });
    
    final newAccessToken = data['accessToken'];
    final newRefreshToken = data['refreshToken'];
    
    if (newAccessToken != null) {
      await _storage.write(key: 'accessToken', value: newAccessToken);
    }
    if (newRefreshToken != null) {
      await _storage.write(key: 'refreshToken', value: newRefreshToken);
    }
  }

  Future<void> logout() async {
    final refreshToken = await _storage.read(key: 'refreshToken');

    try {
      if (refreshToken != null && refreshToken.isNotEmpty) {
        await _dioClient.post('/auth/logout', data: {
          'refreshToken': refreshToken,
        });
      }
    } catch (_) {
      // Clear local session even if remote revoke fails.
    } finally {
      await _storage.delete(key: 'accessToken');
      await _storage.delete(key: 'refreshToken');
      await clearVerifiedUserSnapshot();
    }
  }
}
