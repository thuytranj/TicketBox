import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';
import '../../auth/providers/auth_provider.dart';
import '../../concerts/models/concert.dart';
import '../models/preload_step.dart';
import '../providers/checkin_provider.dart';
import '../services/checkin_service.dart';
import 'scanner_screen.dart';

class PreloadScreen extends StatefulWidget {
  final Concert concert;
  const PreloadScreen({super.key, required this.concert});

  @override
  State<PreloadScreen> createState() => _PreloadScreenState();
}

class _PreloadScreenState extends State<PreloadScreen> with SingleTickerProviderStateMixin {
  late AnimationController _syncIconController;

  CheckinProvider? _checkinProvider;
  bool _didPersistPreparedConcertSnapshot = false;

  @override
  void initState() {
    super.initState();
    _syncIconController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CheckinProvider>().preloadData(widget.concert.id);
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final newProvider = Provider.of<CheckinProvider>(context, listen: false);
    if (_checkinProvider != newProvider) {
      _checkinProvider?.removeListener(_onProviderChanged);
      _checkinProvider = newProvider;
      _checkinProvider?.addListener(_onProviderChanged);
    }
  }

  void _onProviderChanged() {
    if (!mounted || _checkinProvider == null) return;
    final state = _checkinProvider!.state;
    if (state == PreloadState.loading) {
      _didPersistPreparedConcertSnapshot = false;
      if (!_syncIconController.isAnimating) {
        _syncIconController.repeat();
      }
    } else {
      _syncIconController.stop();
    }

    if (state == PreloadState.loaded && !_didPersistPreparedConcertSnapshot) {
      _didPersistPreparedConcertSnapshot = true;
      unawaited(_persistPreparedConcertSnapshot());
    }
  }

  Future<void> _persistPreparedConcertSnapshot() async {
    final authProvider = Provider.of<AuthProvider?>(context, listen: false);
    final checkinService = Provider.of<CheckinService?>(context, listen: false);
    final userId = authProvider?.user?.id;

    if (checkinService == null || userId == null || userId.isEmpty) {
      return;
    }

    try {
      await checkinService.savePreparedConcertSnapshot(
        userId: userId,
        id: widget.concert.id,
        title: widget.concert.title,
        location: widget.concert.location,
        posterUrl: widget.concert.posterUrl,
        description: widget.concert.description,
        startTime: widget.concert.startTime?.toIso8601String(),
        endTime: widget.concert.endTime?.toIso8601String(),
        status: widget.concert.status,
      );
    } catch (_) {
      // Snapshot persistence should not block entry into the scanner.
    }
  }

  @override
  void dispose() {
    _checkinProvider?.removeListener(_onProviderChanged);
    _syncIconController.dispose();
    super.dispose();
  }

  String _sanitizeErrorMessage(String raw) {
    final lower = raw.toLowerCase();
    if (lower.contains('socketexception') ||
        lower.contains('network') ||
        lower.contains('connection refused') ||
        lower.contains('dioexception') ||
        lower.contains('handshake')) {
      return 'Không thể kết nối máy chủ. Vui lòng kiểm tra Wi-Fi hoặc 4G.';
    }
    if (lower.contains('401') || lower.contains('unauthorized')) {
      return 'Phiên làm việc hết hạn. Vui lòng đăng xuất và đăng nhập lại.';
    }
    if (lower.contains('404') || lower.contains('not found')) {
      return 'Không tìm thấy dữ liệu sự kiện trên máy chủ.';
    }
    return 'Lỗi tải dữ liệu: $raw';
  }

  // ── Step State Resolvers ───────────────────────────────────────────────────

  /// Trả về trạng thái của từng bước: 'pending' (chờ), 'active' (đang chạy),
  /// 'success' (thành công), 'error' (thất bại).
  String _getStepStatus(PreloadStep targetStep, CheckinProvider provider) {
    final currentStep = provider.currentStep;
    final isError = provider.state == PreloadState.error;

    if (isError && currentStep == targetStep) {
      return 'error';
    }

    if (currentStep == PreloadStep.completed) {
      return 'success';
    }

    if (currentStep.index > targetStep.index) {
      return 'success';
    }

    if (currentStep == targetStep && provider.state == PreloadState.loading) {
      return 'active';
    }

    return 'pending';
  }

  // ── UI Widget Builders ─────────────────────────────────────────────────────

  Widget _buildEventCard() {
    return GateCard(
      elevated: true,
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: GateColors.primary.withValues(alpha: 0.12),
              borderRadius: GateRadii.sm,
            ),
            child: const Icon(
              Icons.confirmation_number_outlined,
              color: GateColors.primary,
              size: 24,
            ),
          ),
          GateSpacing.horizontal(GateSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.concert.title,
                  style: GateTypography.heading2,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                 GateSpacing.vertical(GateSpacing.xs),
                Row(
                  children: [
                    const Icon(
                      Icons.location_on_outlined,
                      size: 14,
                      color: GateColors.onSurfaceSub,
                    ),
                    GateSpacing.horizontal(GateSpacing.xs),
                    Expanded(
                      child: Text(
                        widget.concert.location,
                        style: GateTypography.bodyMedium.copyWith(
                          color: GateColors.onSurfaceSub,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepItem(
    String title,
    String subtitle,
    PreloadStep targetStep,
    CheckinProvider provider,
  ) {
    final status = _getStepStatus(targetStep, provider);

    Widget iconWidget;
    Color titleColor;
    Color subtitleColor;

    switch (status) {
      case 'success':
        iconWidget = const Icon(
          Icons.check_circle_outline_rounded,
          color: GateColors.networkOnline,
          size: 24,
        );
        titleColor = GateColors.onBackground;
        subtitleColor = GateColors.onSurfaceSub;
        break;
      case 'active':
        iconWidget = RotationTransition(
          turns: _syncIconController,
          child: const Icon(
            Icons.sync_rounded,
            color: GateColors.primary,
            size: 24,
          ),
        );
        titleColor = GateColors.primary;
        subtitleColor = GateColors.primary.withValues(alpha: 0.7);
        break;
      case 'error':
        iconWidget = Icon(
          Icons.error_outline_rounded,
          color: GateColors.scanInvalid.primary,
          size: 24,
        );
        titleColor = GateColors.scanInvalid.primary;
        subtitleColor = GateColors.scanInvalid.primary.withValues(alpha: 0.8);
        break;
      case 'pending':
      default:
        iconWidget = const Icon(
          Icons.radio_button_unchecked_rounded,
          color: GateColors.border,
          size: 24,
        );
        titleColor = GateColors.onSurfaceSub;
        subtitleColor = GateColors.onSurfaceSub.withValues(alpha: 0.6);
        break;
    }

    return Padding(
      padding: EdgeInsets.symmetric(vertical: GateSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: iconWidget,
          ),
          GateSpacing.horizontal(GateSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GateTypography.bodyLarge.copyWith(
                    fontWeight: FontWeight.w600,
                    color: titleColor,
                  ),
                ),
                Text(
                  subtitle,
                  style: GateTypography.caption.copyWith(
                    color: subtitleColor,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressCard(CheckinProvider provider) {
    return GateCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'TIẾN TRÌNH ĐỒNG BỘ',
            style: GateTypography.label.copyWith(
              color: GateColors.onSurfaceSub,
              letterSpacing: 1.0,
            ),
          ),
          GateSpacing.vertical(GateSpacing.sm),
          const Divider(),
          GateSpacing.vertical(GateSpacing.sm),
          _buildStepItem(
            'Kết nối máy chủ',
            'Xác thực và kiểm tra trạng thái API',
            PreloadStep.connecting,
            provider,
          ),
          _buildStepItem(
            'Tải dữ liệu danh sách vé',
            'Tải dữ liệu từ cổng soát vé trung tâm',
            PreloadStep.downloading,
            provider,
          ),
          _buildStepItem(
            'Thiết lập lưu trữ offline',
            'Lưu danh sách vé cục bộ an toàn trên máy',
            PreloadStep.saving,
            provider,
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryCard(CheckinProvider provider) {
    if (provider.state != PreloadState.loaded) return const SizedBox.shrink();

    final timeString = DateTime.now().toLocal().toString().substring(11, 16);

    return GateCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'DỮ LIỆU ĐỒNG BỘ CỤC BỘ',
                style: GateTypography.label.copyWith(
                  color: GateColors.onSurfaceSub,
                  letterSpacing: 1.0,
                ),
              ),
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: GateSpacing.sm,
                  vertical: GateSpacing.xs / 2,
                ),
                decoration: BoxDecoration(
                  color: GateColors.networkOnline.withValues(alpha: 0.15),
                  borderRadius: GateRadii.sm,
                  border: Border.all(
                    color: GateColors.networkOnline.withValues(alpha: 0.4),
                  ),
                ),
                child: Text(
                  'SẴN SÀNG',
                  style: GateTypography.caption.copyWith(
                    color: GateColors.networkOnline,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          GateSpacing.vertical(GateSpacing.sm),
          const Divider(),
          GateSpacing.vertical(GateSpacing.md),
          Row(
            children: [
              Expanded(
                child: _buildStatItem(
                  'Vé Thường',
                  '${provider.ticketCount}',
                  Icons.local_activity_outlined,
                ),
              ),
              Container(
                width: 1,
                height: 40,
                color: GateColors.border,
              ),
              Expanded(
                child: _buildStatItem(
                  'Khách VIP',
                  '${provider.vipCount}',
                  Icons.star_outline_rounded,
                ),
              ),
            ],
          ),
          GateSpacing.vertical(GateSpacing.md),
          Center(
            child: Text(
              'Cập nhật offline hoàn tất lúc $timeString. Thiết bị sẽ tự động chuyển sang chế độ offline nếu mất kết nối.',
              textAlign: TextAlign.center,
              style: GateTypography.caption.copyWith(
                color: GateColors.onSurfaceSub,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value, IconData icon) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: GateColors.primary),
            GateSpacing.horizontal(GateSpacing.xs),
            Text(
              label,
              style: GateTypography.bodyMedium.copyWith(
                color: GateColors.onSurfaceSub,
              ),
            ),
          ],
        ),
        GateSpacing.vertical(GateSpacing.xs),
        Text(
          value,
          style: GateTypography.counter.copyWith(
            fontSize: 24,
          ),
        ),
      ],
    );
  }

  Widget _buildErrorExplanation(CheckinProvider provider) {
    if (provider.state != PreloadState.error) return const SizedBox.shrink();

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: GateSpacing.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.info_outline_rounded,
                size: 16,
                color: GateColors.scanInvalid.primary,
              ),
              GateSpacing.horizontal(GateSpacing.xs),
              Text(
                'Lý do thất bại:',
                style: GateTypography.label.copyWith(
                  color: GateColors.scanInvalid.primary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          GateSpacing.vertical(GateSpacing.xs),
          Text(
            _sanitizeErrorMessage(provider.errorMessage),
            style: GateTypography.bodyMedium.copyWith(
              color: GateColors.onSurface,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar(CheckinProvider provider) {
    final state = provider.state;
    final isLoading = state == PreloadState.loading || state == PreloadState.initial;
    final isError = state == PreloadState.error;

    Widget button;

    if (isLoading) {
      button = GateButton(
        key: const Key('preload_action_btn'),
        label: 'Đang tải dữ liệu...',
        onPressed: null,
        isLoading: true,
        fullWidth: true,
      );
    } else if (isError) {
      button = GateButton(
        key: const Key('preload_action_btn'),
        label: 'Thử lại',
        icon: Icons.refresh_rounded,
        onPressed: () => provider.preloadData(widget.concert.id),
        fullWidth: true,
      );
    } else {
      button = GateButton(
        key: const Key('preload_action_btn'),
        label: 'Vào màn hình quét vé',
        icon: Icons.qr_code_scanner_rounded,
        onPressed: () async {
          await _persistPreparedConcertSnapshot();
          if (!mounted) return;
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(
              builder: (_) => ScannerScreen(concert: widget.concert),
            ),
          );
        },
        fullWidth: true,
      );
    }

    return Container(
      decoration: const BoxDecoration(
        color: GateColors.surface,
        border: Border(
          top: BorderSide(color: GateColors.border, width: 1),
        ),
      ),
      padding: EdgeInsets.fromLTRB(
        GateSpacing.md,
        GateSpacing.sm,
        GateSpacing.md,
        GateSpacing.sm + MediaQuery.of(context).padding.bottom,
      ),
      child: button,
    );
  }

  // ── Build Method ───────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final checkinProvider = context.watch<CheckinProvider>();

    return GateScaffold(
      title: 'Đồng bộ check-in',
      bottomBar: _buildBottomBar(checkinProvider),
      body: SingleChildScrollView(
        physics: const ClampingScrollPhysics(),
        padding: EdgeInsets.all(GateSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildEventCard(),
            GateSpacing.vertical(GateSpacing.md),
            _buildProgressCard(checkinProvider),
            GateSpacing.vertical(GateSpacing.md),
            _buildSummaryCard(checkinProvider),
            _buildErrorExplanation(checkinProvider),
          ],
        ),
      ),
    );
  }
}
