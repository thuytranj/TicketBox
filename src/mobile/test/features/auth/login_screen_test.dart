import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:ticketbox_mobile/core/theme/gate_app_theme.dart';
import 'package:ticketbox_mobile/features/auth/providers/auth_provider.dart';
import 'package:ticketbox_mobile/features/auth/screens/login_screen.dart';
import 'package:ticketbox_mobile/shared/widgets/gate_button.dart';

// ── Mock AuthProvider ──────────────────────────────────────────────────────────

class _MockAuthProvider extends ChangeNotifier implements AuthProvider {
  @override
  AuthState state;
  @override
  String errorMessage;
  @override
  bool get isOfflineDegraded => false;
  @override
  get user => null;

  bool loginCalled = false;

  _MockAuthProvider({
    this.state = AuthState.unauthenticated,
    this.errorMessage = '',
  });

  @override
  Future<bool> login(String email, String password) async {
    loginCalled = true;
    return state == AuthState.authenticated;
  }

  @override
  Future<void> logout() async {}

  @override
  Future<void> checkAuthStatus() async {}

  void setState_(AuthState s) {
    state = s;
    notifyListeners();
  }
}

// ── Helper ─────────────────────────────────────────────────────────────────────

Widget _wrap(_MockAuthProvider mock) => MaterialApp(
      theme: GateAppTheme.dark(),
      home: ChangeNotifierProvider<AuthProvider>.value(
        value: mock,
        child: const LoginScreen(),
      ),
    );

// ── Tests ──────────────────────────────────────────────────────────────────────

void main() {
  group('LoginScreen', () {
    // ── Structure ────────────────────────────────────────────────────────────

    testWidgets('renders brand header', (tester) async {
      final mock = _MockAuthProvider();
      await tester.pumpWidget(_wrap(mock));

      expect(find.text('TicketBox'), findsOneWidget);
      expect(find.text('Gate Staff Portal'), findsOneWidget);
    });

    testWidgets('renders email and password fields', (tester) async {
      final mock = _MockAuthProvider();
      await tester.pumpWidget(_wrap(mock));

      expect(find.byKey(const Key('email_field')), findsOneWidget);
      expect(find.byKey(const Key('password_field')), findsOneWidget);
    });

    testWidgets('renders login button', (tester) async {
      final mock = _MockAuthProvider();
      await tester.pumpWidget(_wrap(mock));

      expect(find.byKey(const Key('login_button')), findsOneWidget);
      expect(find.text('Đăng nhập'), findsOneWidget);
    });

    testWidgets('no AppBar rendered', (tester) async {
      final mock = _MockAuthProvider();
      await tester.pumpWidget(_wrap(mock));

      expect(find.byType(AppBar), findsNothing);
    });

    // ── Loading state ─────────────────────────────────────────────────────────

    testWidgets('button shows loading spinner when state is loading',
        (tester) async {
      final mock = _MockAuthProvider(state: AuthState.loading);
      await tester.pumpWidget(_wrap(mock));

      final btn = tester.widget<GateButton>(find.byKey(const Key('login_button')));
      expect(btn.isLoading, isTrue);
    });

    testWidgets('button is disabled when loading', (tester) async {
      final mock = _MockAuthProvider(state: AuthState.loading);
      await tester.pumpWidget(_wrap(mock));

      final btn = tester.widget<GateButton>(find.byKey(const Key('login_button')));
      expect(btn.onPressed, isNull);
    });

    testWidgets('email field is disabled when loading', (tester) async {
      final mock = _MockAuthProvider(state: AuthState.loading);
      await tester.pumpWidget(_wrap(mock));

      final field = tester.widget<TextFormField>(
          find.byKey(const Key('email_field')));
      expect(field.enabled, isFalse);
    });

    // ── Error state ───────────────────────────────────────────────────────────

    testWidgets('error zone is hidden when state is not error', (tester) async {
      final mock = _MockAuthProvider(state: AuthState.unauthenticated);
      await tester.pumpWidget(_wrap(mock));

      // Warning icon should not be visible
      expect(find.byIcon(Icons.warning_amber_rounded), findsNothing);
    });

    testWidgets('error zone shows sanitized network error', (tester) async {
      final mock = _MockAuthProvider(
        state: AuthState.error,
        errorMessage: 'DioException: SocketException',
      );
      await tester.pumpWidget(_wrap(mock));

      expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
      expect(
        find.text('Không thể kết nối. Kiểm tra mạng và thử lại.'),
        findsOneWidget,
      );
    });

    testWidgets('error zone shows sanitized credential error', (tester) async {
      final mock = _MockAuthProvider(
        state: AuthState.error,
        errorMessage: '401 Unauthorized',
      );
      await tester.pumpWidget(_wrap(mock));

      expect(
        find.text('Email hoặc mật khẩu không đúng.'),
        findsOneWidget,
      );
    });

    testWidgets('error zone shows sanitized permission error', (tester) async {
      final mock = _MockAuthProvider(
        state: AuthState.error,
        errorMessage: 'Tài khoản không có quyền gate_staff',
      );
      await tester.pumpWidget(_wrap(mock));

      expect(
        find.text('Tài khoản không có quyền truy cập Gate Staff.'),
        findsOneWidget,
      );
    });

    testWidgets('error zone shows default message for unknown errors',
        (tester) async {
      final mock = _MockAuthProvider(
        state: AuthState.error,
        errorMessage: 'Some unknown internal error',
      );
      await tester.pumpWidget(_wrap(mock));

      expect(
        find.text('Đăng nhập thất bại. Vui lòng thử lại.'),
        findsOneWidget,
      );
    });

    // ── Form validation ───────────────────────────────────────────────────────

    testWidgets('shows email validation error when field is empty',
        (tester) async {
      final mock = _MockAuthProvider();
      await tester.pumpWidget(_wrap(mock));

      await tester.tap(find.byKey(const Key('login_button')));
      await tester.pump();

      expect(find.text('Vui lòng nhập email'), findsOneWidget);
    });

    testWidgets('shows password validation error when field is empty',
        (tester) async {
      final mock = _MockAuthProvider();
      await tester.pumpWidget(_wrap(mock));

      await tester.enterText(
          find.byKey(const Key('email_field')), 'test@example.com');
      await tester.tap(find.byKey(const Key('login_button')));
      await tester.pump();

      expect(find.text('Vui lòng nhập mật khẩu'), findsOneWidget);
    });

    testWidgets('shows email format error for invalid email', (tester) async {
      final mock = _MockAuthProvider();
      await tester.pumpWidget(_wrap(mock));

      await tester.enterText(
          find.byKey(const Key('email_field')), 'notanemail');
      await tester.tap(find.byKey(const Key('login_button')));
      await tester.pump();

      expect(find.text('Email không hợp lệ'), findsOneWidget);
    });

    // ── Password toggle ───────────────────────────────────────────────────────

    testWidgets('password field starts as obscured', (tester) async {
      final mock = _MockAuthProvider();
      await tester.pumpWidget(_wrap(mock));

      // When obscured, the EditableText renders as obscure characters
      final editableText = tester.widget<EditableText>(
        find.descendant(
          of: find.byKey(const Key('password_field')),
          matching: find.byType(EditableText),
        ),
      );
      expect(editableText.obscureText, isTrue);
    });

    testWidgets('toggling password visibility changes obscureText',
        (tester) async {
      final mock = _MockAuthProvider();
      await tester.pumpWidget(_wrap(mock));

      EditableText getEditableText() => tester.widget<EditableText>(
            find.descendant(
              of: find.byKey(const Key('password_field')),
              matching: find.byType(EditableText),
            ),
          );

      // Initially obscured
      expect(getEditableText().obscureText, isTrue);
      // Visibility icon should show "show" icon
      expect(find.byIcon(Icons.visibility_outlined), findsOneWidget);

      // Tap toggle
      await tester.tap(find.byKey(const Key('toggle_password')));
      await tester.pump();

      expect(getEditableText().obscureText, isFalse);
      // Icon switches to visibility_off
      expect(find.byIcon(Icons.visibility_off_outlined), findsOneWidget);

      // Tap again to re-hide
      await tester.tap(find.byKey(const Key('toggle_password')));
      await tester.pump();

      expect(getEditableText().obscureText, isTrue);
    });

    // ── Login trigger ──────────────────────────────────────────────────────────

    testWidgets('login method is called with valid credentials', (tester) async {
      final mock = _MockAuthProvider();
      await tester.pumpWidget(_wrap(mock));

      await tester.enterText(
          find.byKey(const Key('email_field')), 'staff@ticket.com');
      await tester.enterText(
          find.byKey(const Key('password_field')), 'secret123');

      await tester.tap(find.byKey(const Key('login_button')));
      await tester.pump();

      expect(mock.loginCalled, isTrue);
    });
  });
}
