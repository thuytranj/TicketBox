import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/gate_colors.dart';
import '../../../core/theme/gate_spacing.dart';
import '../../../core/theme/gate_typography.dart';
import '../../../shared/widgets/gate_button.dart';
import '../../../shared/widgets/gate_card.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  // ── Business logic (unchanged) ─────────────────────────────────────────────

  Future<void> _login() async {
    if (_formKey.currentState!.validate()) {
      final authProvider = context.read<AuthProvider>();
      await authProvider.login(
        _emailController.text.trim(),
        _passwordController.text,
      );
      // Navigation is handled by main.dart Consumer on AuthState.authenticated.
      // No navigation logic here.
    }
  }

  // ── Error message sanitizer ────────────────────────────────────────────────

  String _sanitizeErrorMessage(String raw) {
    final lower = raw.toLowerCase();
    if (lower.contains('socketexception') ||
        lower.contains('network') ||
        lower.contains('connection refused') ||
        lower.contains('dioexception') ||
        lower.contains('dioerror') ||
        lower.contains('handshake')) {
      return 'Không thể kết nối. Kiểm tra mạng và thử lại.';
    }
    if (lower.contains('401') ||
        lower.contains('unauthorized') ||
        lower.contains('invalid credentials') ||
        lower.contains('incorrect')) {
      return 'Email hoặc mật khẩu không đúng.';
    }
    if (lower.contains('gate_staff') ||
        lower.contains('quyền') ||
        lower.contains('permission') ||
        lower.contains('organizer')) {
      return 'Tài khoản không có quyền truy cập Gate Staff.';
    }
    if (lower.contains('not found') || lower.contains('404')) {
      return 'Tài khoản không tồn tại. Kiểm tra lại email.';
    }
    return 'Đăng nhập thất bại. Vui lòng thử lại.';
  }

  // ── UI Builders ────────────────────────────────────────────────────────────

  Widget _buildBrandHeader() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: GateColors.primary.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Icon(
            Icons.confirmation_number_outlined,
            size: 36,
            color: GateColors.primary,
          ),
        ),
        GateSpacing.vertical(GateSpacing.md),
        Text(
          'TicketBox',
          style: GateTypography.heading1.copyWith(
            letterSpacing: -0.5,
          ),
        ),
        GateSpacing.vertical(GateSpacing.xs),
        Text(
          'Gate Staff Portal',
          style: GateTypography.bodyMedium.copyWith(
            color: GateColors.onSurfaceSub,
          ),
        ),
      ],
    );
  }

  Widget _buildErrorZone(AuthProvider authProvider) {
    if (authProvider.state != AuthState.error) return const SizedBox.shrink();

    final message = _sanitizeErrorMessage(authProvider.errorMessage);

    return Container(
      decoration: BoxDecoration(
        color: GateColors.scanInvalid.container,
        borderRadius: BorderRadius.circular(8),
        border: Border(
          left: BorderSide(
            color: GateColors.scanInvalid.primary,
            width: 3,
          ),
        ),
      ),
      padding: EdgeInsets.symmetric(
        horizontal: GateSpacing.md,
        vertical: GateSpacing.sm + 2,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.only(top: 2),
            child: Icon(
              Icons.warning_amber_rounded,
              color: GateColors.scanInvalid.primary,
              size: 18,
            ),
          ),
          GateSpacing.horizontal(GateSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: GateTypography.bodyMedium.copyWith(
                color: GateColors.onSurface,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFormCard(AuthProvider authProvider) {
    final isLoading = authProvider.state == AuthState.loading;

    return GateCard(
      elevated: true,
      padding: EdgeInsets.all(GateSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Email ──────────────────────────────────────────────────────────
          TextFormField(
            key: const Key('email_field'),
            controller: _emailController,
            focusNode: _emailFocus,
            enabled: !isLoading,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            autocorrect: false,
            onFieldSubmitted: (_) {
              FocusScope.of(context).requestFocus(_passwordFocus);
            },
            decoration: const InputDecoration(
              labelText: 'Email',
              hintText: 'staff@example.com',
              prefixIcon: Icon(Icons.email_outlined),
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Vui lòng nhập email';
              }
              if (!value.contains('@')) {
                return 'Email không hợp lệ';
              }
              return null;
            },
          ),

          GateSpacing.vertical(GateSpacing.md),

          // ── Password ───────────────────────────────────────────────────────
          TextFormField(
            key: const Key('password_field'),
            controller: _passwordController,
            focusNode: _passwordFocus,
            enabled: !isLoading,
            obscureText: _obscurePassword,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => isLoading ? null : _login(),
            decoration: InputDecoration(
              labelText: 'Mật khẩu',
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                key: const Key('toggle_password'),
                icon: Icon(
                  _obscurePassword
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  color: GateColors.onSurfaceSub,
                ),
                tooltip: _obscurePassword ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
                onPressed: () {
                  setState(() => _obscurePassword = !_obscurePassword);
                },
              ),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Vui lòng nhập mật khẩu';
              }
              return null;
            },
          ),

          GateSpacing.vertical(GateSpacing.md),

          // ── Error zone ─────────────────────────────────────────────────────
          _buildErrorZone(authProvider),

          GateSpacing.vertical(GateSpacing.lg),

          // ── Submit button ──────────────────────────────────────────────────
          GateButton(
            key: const Key('login_button'),
            label: 'Đăng nhập',
            onPressed: isLoading ? null : _login,
            isLoading: isLoading,
            fullWidth: true,
          ),
        ],
      ),
    );
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: GateColors.background,
      body: SafeArea(
        child: GestureDetector(
          // Dismiss keyboard on tap outside form
          onTap: () => FocusScope.of(context).unfocus(),
          behavior: HitTestBehavior.opaque,
          child: SingleChildScrollView(
            physics: const ClampingScrollPhysics(),
            padding: EdgeInsets.symmetric(horizontal: GateSpacing.md),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Top spacer — adapts to keyboard presence
                  GateSpacing.vertical(GateSpacing.xxl),

                  // Brand header
                  _buildBrandHeader(),

                  GateSpacing.vertical(GateSpacing.xl),

                  // Form card
                  _buildFormCard(authProvider),

                  GateSpacing.vertical(GateSpacing.xl),

                  // Footer
                  Text(
                    'TicketBox Gate · v1.0.0',
                    style: GateTypography.caption,
                  ),

                  GateSpacing.vertical(GateSpacing.lg),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
