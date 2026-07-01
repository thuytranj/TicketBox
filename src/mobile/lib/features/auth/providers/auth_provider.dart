import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../core/network/api_exception.dart';
import '../models/user.dart';
import '../services/auth_service.dart';

enum AuthState { initial, loading, authenticated, unauthenticated, error }

class AuthProvider with ChangeNotifier {
  final AuthService _authService;

  User? _user;
  AuthState _state = AuthState.initial;
  String _errorMessage = '';
  bool _isOfflineDegraded = false;

  AuthProvider(this._authService);

  User? get user => _user;
  AuthState get state => _state;
  String get errorMessage => _errorMessage;
  bool get isOfflineDegraded => _isOfflineDegraded;

  // ── Auth status check (cold-start + token refresh) ────────────────────────

  /// Validates the persisted session and decides whether to allow the user
  /// into the app or redirect to the login screen.
  ///
  /// Decision tree:
  /// 1. No stored access token → never logged in → [AuthState.unauthenticated]
  /// 2. Token exists → call [AuthService.getMe]:
  ///    a. Success, valid role → [AuthState.authenticated]
  ///    b. Success, invalid role → logout + [AuthState.unauthenticated]
  ///    c. Network/timeout error → token still valid on server; enter degraded
  ///       offline mode: [AuthState.authenticated] (user stays in app).
  ///    d. Auth error (401/403) → session truly invalid; attempt token refresh
  ///       once; if refresh also fails → logout + [AuthState.unauthenticated]
  Future<void> checkAuthStatus() async {
    _setState(AuthState.loading);
    _isOfflineDegraded = false;

    // ── Step 1: short-circuit if no token has ever been stored ───────────
    final storedToken = await _authService.getStoredToken();
    if (storedToken == null) {
      _user = null;
      _setState(AuthState.unauthenticated);
      return;
    }

    // ── Step 2: try to validate with server ──────────────────────────────
    try {
      _user = await _authService.getMe();
      if (_isValidRole(_user?.role)) {
        await _authService.saveVerifiedUser(_user!);
        _setState(AuthState.authenticated);
      } else {
        await _authService.logout();
        _user = null;
        _errorMessage = 'Bạn không có quyền truy cập';
        _isOfflineDegraded = false;
        _setState(AuthState.unauthenticated);
      }
      return;
    } catch (firstError) {
      if (_isNetworkError(firstError)) {
        await _restoreOfflineVerifiedUserOrFail();
        return;
      }

      // ── Auth error (4xx): try token refresh once ─────────────────────
      try {
        await _authService.refresh();
        _user = await _authService.getMe();
        if (_isValidRole(_user?.role)) {
          await _authService.saveVerifiedUser(_user!);
          _isOfflineDegraded = false;
          _setState(AuthState.authenticated);
        } else {
          await _authService.logout();
          _user = null;
          _errorMessage = 'Bạn không có quyền truy cập';
          _isOfflineDegraded = false;
          _setState(AuthState.unauthenticated);
        }
      } catch (refreshError) {
        if (_isNetworkError(refreshError)) {
          await _restoreOfflineVerifiedUserOrFail();
        } else {
          // Refresh token invalid / expired → force re-login.
          await _authService.logout();
          _user = null;
          _isOfflineDegraded = false;
          _setState(AuthState.unauthenticated);
        }
      }
    }
  }

  // ── Login / logout ────────────────────────────────────────────────────────

  Future<bool> login(String email, String password) async {
    _setState(AuthState.loading);
    _errorMessage = '';
    try {
      await _authService.login(email, password);
      _user = await _authService.getMe();

      if (_isValidRole(_user?.role)) {
        await _authService.saveVerifiedUser(_user!);
        _isOfflineDegraded = false;
        _setState(AuthState.authenticated);
        return true;
      } else {
        await _authService.logout();
        _errorMessage = 'Tài khoản không có quyền gate_staff hoặc organizer';
        _isOfflineDegraded = false;
        _setState(AuthState.error);
        return false;
      }
    } catch (e) {
      _errorMessage = e.toString();
      _isOfflineDegraded = false;
      _setState(AuthState.error);
      return false;
    }
  }

  Future<void> logout() async {
    _setState(AuthState.loading);
    await _authService.logout();
    _user = null;
    _isOfflineDegraded = false;
    _setState(AuthState.unauthenticated);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  void _setState(AuthState state) {
    _state = state;
    notifyListeners();
  }

  static bool _isValidRole(String? role) =>
      role == 'gate_staff' || role == 'organizer';

  Future<void> _restoreOfflineVerifiedUserOrFail() async {
    final cachedUser = await _authService.getLastVerifiedUser();

    if (_isValidRole(cachedUser?.role)) {
      _user = cachedUser;
      _isOfflineDegraded = true;
      _setState(AuthState.authenticated);
      return;
    }

    _user = null;
    _isOfflineDegraded = false;
    _errorMessage =
        'Không thể khôi phục phiên ngoại tuyến. Kết nối mạng để xác thực lại.';
    _setState(AuthState.unauthenticated);
  }

  /// Returns true only for errors that are caused by connectivity problems —
  /// i.e., the server was never reached and the token may still be valid.
  ///
  /// Returns false for HTTP 4xx/5xx responses (the server was reachable and
  /// explicitly rejected the request).
  static bool _isNetworkError(Object e) {
    if (e is ApiException) {
      return e.isNetworkError;
    }
    if (e is DioException) {
      return e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout ||
          e.type == DioExceptionType.connectionError;
    }
    // ApiException with no statusCode means no HTTP response was received.
    if (e is Exception) {
      final msg = e.toString().toLowerCase();
      return msg.contains('socketexception') ||
          msg.contains('connection refused') ||
          msg.contains('network is unreachable');
    }
    return false;
  }
}
