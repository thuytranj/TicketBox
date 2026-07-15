import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';
import '../../auth/providers/auth_provider.dart';
import '../../concerts/models/concert.dart';
import '../providers/checkin_provider.dart';
import '../services/checkin_service.dart';
import '../widgets/dashboard_stat_card.dart';
import 'scanner_screen.dart';

class PreloadScreen extends StatefulWidget {
  final Concert concert;
  const PreloadScreen({super.key, required this.concert});

  @override
  State<PreloadScreen> createState() => _PreloadScreenState();
}

class _PreloadScreenState extends State<PreloadScreen> {
  CheckinProvider? _checkinProvider;
  bool _didPersistPreparedConcertSnapshot = false;

  @override
  void initState() {
    super.initState();
    if (widget.concert.isGateOpen) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        context.read<CheckinProvider>().preloadData(widget.concert.id);
      });
    }
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
    super.dispose();
  }

  // ── Error message sanitisation (unchanged) ─────────────────────────────────

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
    return 'Không thể tải dữ liệu. Vui lòng thử lại.';
  }

  // ── UI builders ────────────────────────────────────────────────────────────

  /// Hero header: large concert name + location + optional date.
  Widget _buildHeroHeader() {
    final concert = widget.concert;
    final startLocal = concert.startTime?.toLocal();

    String? dateLabel;
    if (startLocal != null) {
      final d = startLocal.day.toString().padLeft(2, '0');
      final m = startLocal.month.toString().padLeft(2, '0');
      final y = startLocal.year;
      final hh = startLocal.hour.toString().padLeft(2, '0');
      final mm = startLocal.minute.toString().padLeft(2, '0');
      dateLabel = '$d/$m/$y · $hh:$mm';
    }

    return Padding(
      padding: EdgeInsets.fromLTRB(
        GateSpacing.md,
        GateSpacing.lg,
        GateSpacing.md,
        GateSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Eyebrow label
          Text(
            concert.gateEyebrowLabel,
            style: GateTypography.caption.copyWith(
              color: concert.isGateOpen
                  ? GateColors.primary
                  : GateColors.scanUsed.primary,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
            ),
          ),
          GateSpacing.vertical(GateSpacing.xs),
          // Concert title
          Text(
            concert.title,
            style: GateTypography.heading1,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          GateSpacing.vertical(GateSpacing.xs),
          // Location row
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
                  concert.location,
                  style: GateTypography.bodyMedium.copyWith(
                    color: GateColors.onSurfaceSub,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          // Date row (optional)
          if (dateLabel != null) ...[
            GateSpacing.vertical(2),
            Row(
              children: [
                const Icon(
                  Icons.schedule_outlined,
                  size: 14,
                  color: GateColors.onSurfaceSub,
                ),
                GateSpacing.horizontal(GateSpacing.xs),
                Text(
                  dateLabel,
                  style: GateTypography.caption.copyWith(
                    color: GateColors.onSurfaceSub,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  /// One-line connectivity-aware status indicator.
  Widget _buildStatusLine(CheckinProvider provider) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: GateSpacing.md),
      child: StreamBuilder<List<ConnectivityResult>>(
        stream: Connectivity().onConnectivityChanged,
        builder: (context, snapshot) {
          final isOnline = snapshot.hasData
              ? snapshot.data!.any((r) => r != ConnectivityResult.none)
              : true; // assume online until proven otherwise

          return _StatusLine(
            concert: widget.concert,
            providerState: provider.state,
            isOnline: isOnline,
          );
        },
      ),
    );
  }

  /// 3-card dashboard grid — only rendered when data is loaded.
  Widget _buildDashboardGrid(CheckinProvider provider) {
    if (!widget.concert.isGateOpen) {
      return const SizedBox.shrink();
    }

    // Fixed height placeholder keeps button position stable during load.
    const double gridHeight = 110;

    if (provider.state != PreloadState.loaded) {
      return const SizedBox(height: gridHeight);
    }

    final checkedIn = provider.checkedInCount;
    final total = provider.totalEntries;
    final scannedLabel = '$checkedIn / $total';

    return SizedBox(
      height: gridHeight,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: GateSpacing.md),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            DashboardStatCard(
              key: const Key('stat_scanned'),
              label: 'Đã quét',
              value: scannedLabel,
              icon: Icons.qr_code_scanner_rounded,
              accentColor: GateColors.primary,
            ),
            GateSpacing.horizontal(GateSpacing.sm),
            DashboardStatCard(
              key: const Key('stat_ticket_remaining'),
              label: 'Vé còn lại',
              value: '${provider.ticketRemaining}',
              icon: Icons.local_activity_outlined,
              accentColor: GateColors.networkOnline,
            ),
            GateSpacing.horizontal(GateSpacing.sm),
            DashboardStatCard(
              key: const Key('stat_vip_remaining'),
              label: 'VIP chưa vào',
              value: '${provider.vipRemaining}',
              icon: Icons.star_outline_rounded,
              accentColor: GateColors.syncPending,
            ),
          ],
        ),
      ),
    );
  }

  /// Compact error card — only shown in error state.
  Widget _buildErrorCard(CheckinProvider provider) {
    if (provider.state != PreloadState.error) return const SizedBox.shrink();

    return Padding(
      padding: EdgeInsets.fromLTRB(
        GateSpacing.md,
        GateSpacing.md,
        GateSpacing.md,
        0,
      ),
      child: GateCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.warning_amber_rounded,
              color: GateColors.scanInvalid.primary,
              size: 20,
            ),
            GateSpacing.horizontal(GateSpacing.sm),
            Expanded(
              child: Text(
                _sanitizeErrorMessage(provider.errorMessage),
                style: GateTypography.bodyMedium.copyWith(
                  color: GateColors.onSurface,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAvailabilityCard() {
    if (widget.concert.isGateOpen) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: EdgeInsets.fromLTRB(
        GateSpacing.md,
        GateSpacing.md,
        GateSpacing.md,
        0,
      ),
      child: GateCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.info_outline_rounded,
              color: GateColors.scanUsed.primary,
              size: 20,
            ),
            GateSpacing.horizontal(GateSpacing.sm),
            Expanded(
              child: Text(
                widget.concert.gateBlockedMessage,
                style: GateTypography.bodyMedium.copyWith(
                  color: GateColors.onSurface,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Bottom action bar.
  Widget _buildBottomBar(CheckinProvider provider) {
    if (!widget.concert.isGateOpen) {
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
        child: GateButton(
          key: const Key('preload_action_btn'),
          label: widget.concert.gateStatusLine.replaceFirst('Trạng thái: ', ''),
          onPressed: null,
          fullWidth: true,
        ),
      );
    }

    final state = provider.state;
    final isLoading =
        state == PreloadState.loading || state == PreloadState.initial;
    final isError = state == PreloadState.error;

    Widget button;
    if (isLoading) {
      button = GateButton(
        key: const Key('preload_action_btn'),
        label: 'Đang chuẩn bị...',
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
        key: const Key('start_scan_btn'),
        label: 'BẮT ĐẦU QUÉT MÃ QR',
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

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CheckinProvider>();

    return GateScaffold(
      title: 'Check-in',
      bottomBar: _buildBottomBar(provider),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildHeroHeader(),
          GateSpacing.vertical(GateSpacing.sm),
          _buildStatusLine(provider),
          GateSpacing.vertical(GateSpacing.md),
          _buildDashboardGrid(provider),
          _buildAvailabilityCard(),
          _buildErrorCard(provider),
          const Spacer(),
        ],
      ),
    );
  }
}

// ── Status line widget ──────────────────────────────────────────────────────

/// Inline widget that renders one coloured dot + status text.
/// Kept as a separate widget so its [providerState] and [isOnline] inputs are
/// explicit and easy to test.
class _StatusLine extends StatelessWidget {
  const _StatusLine({
    required this.concert,
    required this.providerState,
    required this.isOnline,
  });

  final Concert concert;
  final PreloadState providerState;
  final bool isOnline;

  @override
  Widget build(BuildContext context) {
    final (dotColor, text) = _resolve();

    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: dotColor,
            shape: BoxShape.circle,
          ),
        ),
        GateSpacing.horizontal(GateSpacing.sm),
        Expanded(
          child: Text(
            text,
            style: GateTypography.bodyMedium.copyWith(
              color: GateColors.onSurfaceSub,
            ),
          ),
        ),
      ],
    );
  }

  (Color, String) _resolve() {
    if (!concert.isGateOpen) {
      return switch (concert.gateState) {
        ConcertGateState.upcoming => (
            GateColors.scanUsed.primary,
            concert.gateStatusLine,
          ),
        ConcertGateState.completed => (
            GateColors.scanInvalid.primary,
            concert.gateStatusLine,
          ),
        ConcertGateState.cancelled => (
            GateColors.scanInvalid.primary,
            concert.gateStatusLine,
          ),
        ConcertGateState.unavailable => (
            GateColors.onSurfaceSub,
            concert.gateStatusLine,
          ),
        ConcertGateState.open => (
            GateColors.networkOnline,
            concert.gateStatusLine,
          ),
      };
    }

    switch (providerState) {
      case PreloadState.initial:
      case PreloadState.loading:
        return (
          GateColors.onSurfaceSub,
          'Đang chuẩn bị dữ liệu check-in...',
        );
      case PreloadState.error:
        return (
          GateColors.scanInvalid.primary,
          'Trạng thái: Chưa sẵn sàng',
        );
      case PreloadState.loaded:
        if (isOnline) {
          return (
            GateColors.networkOnline,
            'Trạng thái: Đã đồng bộ (Ngoại tuyến sẵn sàng)',
          );
        }
        return (
          GateColors.networkOffline,
          'Trạng thái: Mất kết nối (Đang chạy chế độ offline)',
        );
    }
  }
}
