import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ticketbox_mobile/features/auth/providers/auth_provider.dart';
import 'package:ticketbox_mobile/features/auth/models/user.dart';
import 'package:ticketbox_mobile/features/auth/services/auth_service.dart';

// ── Stub AuthService ──────────────────────────────────────────────────────────

/// A configurable stub for [AuthService] that lets each test control the
/// behaviour of [getStoredToken], [getMe], and [refresh] without touching
/// network or secure storage.
class _StubAuthService implements AuthService {
  final String? storedToken;
  User? verifiedUser;
  final Future<User> Function()? getMeResult;
  final Future<void> Function()? refreshResult;

  bool logoutCalled = false;
  bool saveVerifiedUserCalled = false;

  _StubAuthService({
    this.storedToken,
    this.verifiedUser,
    this.getMeResult,
    this.refreshResult,
  });

  @override
  Future<String?> getStoredToken() async => storedToken;

  @override
  Future<User?> getLastVerifiedUser() async => verifiedUser;

  @override
  Future<User> getMe() async {
    if (getMeResult != null) return getMeResult!();
    throw UnimplementedError('getMe not configured');
  }

  @override
  Future<void> refresh() async {
    if (refreshResult != null) return refreshResult!();
    throw UnimplementedError('refresh not configured');
  }

  @override
  Future<void> logout() async {
    logoutCalled = true;
    verifiedUser = null;
  }

  @override
  Future<Map<String, dynamic>> login(String email, String password) async {
    throw UnimplementedError('not needed in these tests');
  }

  @override
  Future<void> saveVerifiedUser(User user) async {
    saveVerifiedUserCalled = true;
    verifiedUser = user;
  }

  @override
  Future<void> clearVerifiedUserSnapshot() async {
    verifiedUser = null;
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

User _gateStaffUser() => User(id: '1', email: 'staff@example.com', role: 'gate_staff');
User _noRoleUser()    => User(id: '2', email: 'guest@example.com', role: 'viewer');

DioException _networkError() => DioException(
      requestOptions: RequestOptions(path: '/auth/me'),
      type: DioExceptionType.connectionError,
    );

DioException _unauthorizedError() => DioException(
      requestOptions: RequestOptions(path: '/auth/me'),
      type: DioExceptionType.badResponse,
      response: Response(
        statusCode: 401,
        requestOptions: RequestOptions(path: '/auth/me'),
      ),
    );

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  group('AuthProvider.checkAuthStatus', () {
    // ── No stored token ─────────────────────────────────────────────────────
    test('no stored token → unauthenticated immediately, no API call', () async {
      int getMeCalls = 0;
      final service = _StubAuthService(
        storedToken: null,
        getMeResult: () async {
          getMeCalls++;
          return _gateStaffUser();
        },
      );
      final provider = AuthProvider(service);
      await provider.checkAuthStatus();

      expect(provider.state, AuthState.unauthenticated);
      expect(getMeCalls, 0); // getMe must NOT be called
      expect(service.logoutCalled, false);
    });

    // ── Valid session, online ────────────────────────────────────────────────
    test('stored token + valid role + network OK → authenticated', () async {
      final service = _StubAuthService(
        storedToken: 'valid-token',
        getMeResult: () async => _gateStaffUser(),
      );
      final provider = AuthProvider(service);
      await provider.checkAuthStatus();

      expect(provider.state, AuthState.authenticated);
      expect(provider.user?.role, 'gate_staff');
      expect(service.saveVerifiedUserCalled, true);
    });

    // ── Valid session, offline ───────────────────────────────────────────────
    test('stored token + network error + cached verified user → authenticated (degraded offline mode)', () async {
      final service = _StubAuthService(
        storedToken: 'valid-token',
        verifiedUser: _gateStaffUser(),
        getMeResult: () async => throw _networkError(),
        refreshResult: () async => throw _networkError(),
      );
      final provider = AuthProvider(service);
      await provider.checkAuthStatus();

      // Must NOT route to login just because network is down.
      expect(provider.state, AuthState.authenticated);
      expect(provider.user?.role, 'gate_staff');
      expect(provider.isOfflineDegraded, true);
      // logout must NOT be called.
      expect(service.logoutCalled, false);
    });

    test('stored token + network error + no cached verified user → unauthenticated', () async {
      final service = _StubAuthService(
        storedToken: 'valid-token',
        verifiedUser: null,
        getMeResult: () async => throw _networkError(),
      );
      final provider = AuthProvider(service);
      await provider.checkAuthStatus();

      expect(provider.state, AuthState.unauthenticated);
      expect(provider.user, isNull);
      expect(provider.isOfflineDegraded, false);
      expect(service.logoutCalled, false);
    });

    // ── Auth error (401) → try refresh ──────────────────────────────────────
    test('stored token + 401 + successful refresh → authenticated', () async {
      bool refreshCalled = false;
      final service = _StubAuthService(
        storedToken: 'expired-token',
        getMeResult: () async {
          if (!refreshCalled) throw _unauthorizedError();
          return _gateStaffUser();
        },
        refreshResult: () async {
          refreshCalled = true;
        },
      );
      final provider = AuthProvider(service);
      await provider.checkAuthStatus();

      expect(provider.state, AuthState.authenticated);
      expect(refreshCalled, true);
      expect(service.saveVerifiedUserCalled, true);
    });

    // ── Auth error → refresh also fails ────────────────────────────────────
    test('stored token + 401 + refresh fails → unauthenticated + logout', () async {
      final service = _StubAuthService(
        storedToken: 'bad-token',
        getMeResult: () async => throw _unauthorizedError(),
        refreshResult: () async => throw _unauthorizedError(),
      );
      final provider = AuthProvider(service);
      await provider.checkAuthStatus();

      expect(provider.state, AuthState.unauthenticated);
      expect(service.logoutCalled, true);
    });

    // ── Invalid role ─────────────────────────────────────────────────────────
    test('stored token + invalid role → unauthenticated + logout', () async {
      final service = _StubAuthService(
        storedToken: 'valid-token',
        getMeResult: () async => _noRoleUser(),
      );
      final provider = AuthProvider(service);
      await provider.checkAuthStatus();

      expect(provider.state, AuthState.unauthenticated);
      expect(service.logoutCalled, true);
    });

    // ── Refresh network failure (offline during refresh) ─────────────────────
    test('stored token + auth error + network down during refresh + cached verified user → authenticated (degraded)', () async {
      final service = _StubAuthService(
        storedToken: 'maybe-expired',
        verifiedUser: _gateStaffUser(),
        getMeResult: () async => throw _unauthorizedError(),
        refreshResult: () async => throw _networkError(),
      );
      final provider = AuthProvider(service);
      await provider.checkAuthStatus();

      // Network died during refresh — still allow offline mode.
      expect(provider.state, AuthState.authenticated);
      expect(provider.isOfflineDegraded, true);
      expect(service.logoutCalled, false);
    });

    test('stored token + auth error + network down during refresh + no cached verified user → unauthenticated', () async {
      final service = _StubAuthService(
        storedToken: 'maybe-expired',
        verifiedUser: null,
        getMeResult: () async => throw _unauthorizedError(),
        refreshResult: () async => throw _networkError(),
      );
      final provider = AuthProvider(service);
      await provider.checkAuthStatus();

      expect(provider.state, AuthState.unauthenticated);
      expect(provider.isOfflineDegraded, false);
      expect(service.logoutCalled, false);
    });
  });
}
