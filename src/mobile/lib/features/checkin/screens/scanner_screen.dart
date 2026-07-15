import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/gate_colors.dart';
import '../../../core/theme/gate_radii.dart';
import '../../../core/theme/gate_spacing.dart';
import '../../../core/theme/gate_typography.dart';
import '../../../shared/widgets/widgets.dart';
import '../../concerts/models/concert.dart';
import '../models/scan_outcome.dart';
import '../models/scan_throttle.dart';
import '../services/checkin_service.dart';
import '../widgets/scan_result_panel.dart';

typedef ScannerPreviewBuilder = Widget Function(
  BuildContext context,
  MobileScannerController controller,
  void Function(BarcodeCapture capture) onDetect,
);

/// Gate staff QR-scanning screen.
///
/// Lifecycle contract:
/// 1. Camera is active and accepting scans when [_isProcessing] is false and
///    [_currentOutcome] is null.
/// 2. On barcode detect: [_isProcessing] = true immediately; duplicate / cooldown
///    barcodes are dropped here, before any async work.
/// 3. After [CheckinService.processScan] resolves: result is wrapped in
///    [ScanOutcome] and stored in [_currentOutcome], which shows [ScanResultPanel].
/// 4. When the panel is dismissed (auto or manual): [_onPanelClosed] resets both
///    [_isProcessing] and [_currentOutcome] → camera accepts next scan.
///
/// The scanner lock ([_isProcessing]) is ONLY released in [_onPanelClosed] —
/// never in the scan handler itself — so there is no window in which a second
/// scan can be processed while a result is still visible.
class ScannerScreen extends StatefulWidget {
  const ScannerScreen({
    super.key,
    required this.concert,
    this.checkinServiceOverride,
    this.connectivityStream,
    this.scannerPreviewBuilder,
  });

  final Concert concert;
  final CheckinService? checkinServiceOverride;
  final Stream<List<ConnectivityResult>>? connectivityStream;
  final ScannerPreviewBuilder? scannerPreviewBuilder;

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen>
    with SingleTickerProviderStateMixin {
  static const double _scanFrameSize = 250;

  // ── Scanner controller ────────────────────────────────────────────────────

  late final MobileScannerController _scannerController;
  late final AnimationController _laserController;

  // ── Processing lock ───────────────────────────────────────────────────────

  /// True while a scan is being processed OR while the result panel is visible.
  /// The camera still physically runs, but [onDetect] drops all events until
  /// this is false again.
  bool _isProcessing = false;

  /// Drops the same QR payload for a short cooldown window after acceptance so
  /// the camera does not re-process the same attendee while the device is still
  /// pointed at the badge.
  final ScanThrottle _scanThrottle = ScanThrottle();

  /// The result of the latest scan, or null when no panel should be shown.
  ScanOutcome? _currentOutcome;

  // ── Network / sync state ──────────────────────────────────────────────────

  bool _isOnline = true;
  bool _isSyncing = false;
  int _pendingCount = 0;

  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;

  CheckinService get _checkinService =>
      widget.checkinServiceOverride ?? context.read<CheckinService>();

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _scannerController = MobileScannerController(
      detectionSpeed: DetectionSpeed.normal,
    );
    _laserController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
    _listenConnectivity();
    _updatePendingCount();
  }

  void _listenConnectivity() {
    final connectivityStream =
        widget.connectivityStream ?? Connectivity().onConnectivityChanged;
    _connectivitySub = connectivityStream.listen((results) {
      final online = results.any((r) => r != ConnectivityResult.none);
      if (mounted) setState(() => _isOnline = online);
      // Background sync will be handled by CheckinService's own listener;
      // we only update the UI badge here.
      if (online) _updatePendingCount();
    });
  }

  Future<void> _updatePendingCount() async {
    if (!mounted) return;
    final count = await _checkinService.getPendingLogCount(widget.concert.id);
    if (mounted) setState(() => _pendingCount = count);
  }

  @override
  void deactivate() {
    // Stop the camera stream when navigating away (e.g. back button).
    _scannerController.stop();
    super.deactivate();
  }

  @override
  void dispose() {
    _connectivitySub?.cancel();
    _laserController.dispose();
    _scannerController.dispose();
    super.dispose();
  }

  // ── Scan detection ────────────────────────────────────────────────────────

  void _onDetect(BarcodeCapture capture) {
    if (_isProcessing) return;
    final code = capture.barcodes.firstOrNull?.rawValue;
    if (code == null || code.isEmpty) return;
    if (!_scanThrottle.shouldAccept(code, DateTime.now())) return;

    setState(() {
      _isProcessing = true;
    });

    _processScan(code);
  }

  Future<void> _processScan(String code) async {
    try {
      final result =
          await _checkinService.processScan(widget.concert.id, code);
      if (!mounted) return;
      setState(() {
        _currentOutcome = ScanOutcome.fromServiceResult(result);
      });
    } catch (e) {
      if (!mounted) return;
      // Map uncaught exceptions (e.g. DB failure) to the ERROR outcome.
      setState(() {
        _currentOutcome = ScanOutcome.fromServiceResult({
          'status': 'DEVICE_ERROR',
          'message': 'Thiết bị gặp lỗi khi lưu kết quả quét.',
        });
      });
    }
    // NOTE: _isProcessing is NOT reset here; it is reset in _onPanelClosed.
  }

  /// Called by [ScanResultPanel] when it dismisses (auto or manual).
  /// This is the single unlock point for the scanner.
  void _onPanelClosed() {
    if (!mounted) return;
    setState(() {
      _currentOutcome = null;
      _isProcessing = false;
    });
    _updatePendingCount();
  }

  // ── Manual sync ───────────────────────────────────────────────────────────

  Future<void> _manualSync() async {
    if (_isSyncing) return;
    setState(() => _isSyncing = true);
    try {
      await _checkinService.syncOfflineLogs(widget.concert.id);
      if (!mounted) return;
      await _updatePendingCount();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Đã gửi log đồng bộ. Máy chủ sẽ xử lý trong nền.'),
          backgroundColor: GateColors.networkOnline,
        ),
      );
    } on SyncInProgressException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: GateColors.scanUsed.primary,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Lỗi đồng bộ. Thử lại sau.'),
          backgroundColor: GateColors.scanInvalid.primary,
        ),
      );
    } finally {
      if (mounted) setState(() => _isSyncing = false);
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return GateScaffold(
      title: 'Quét vé - ${widget.concert.title}',
      showNetworkStatus: true,
      isOnline: _isOnline,
      pendingCount: _pendingCount,
      actions: [_buildSyncButton()],
      body: Stack(
        children: [
          // ── Layer 1: Camera full-screen ─────────────────────────────────
          _buildScannerPreview(),

          // ── Layer 2: Scan frame overlay ───────────────────────────────
          _buildScanFrameOverlay(),

          // ── Layer 3: Processing overlay (dim while API call is in flight) ─
          if (_isProcessing && _currentOutcome == null)
            const ColoredBox(
              color: Color(0x80000000), // 50% black — no raw Colors.black54
              child: Center(child: CircularProgressIndicator()),
            ),

          // ── Layer 4: Instruction hint ───────────────────────────────────
          if (!_isProcessing)
            Positioned(
              bottom: GateSpacing.xxl,
              left: GateSpacing.md,
              right: GateSpacing.md,
              child: Center(
                child: Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: GateSpacing.lg,
                    vertical: GateSpacing.sm,
                  ),
                  decoration: BoxDecoration(
                    color: GateColors.surface.withValues(alpha: 0.85),
                    borderRadius: GateRadii.full,
                  ),
                  child: Text(
                    'Đưa mã QR vào khung hình',
                    style: GateTypography.label
                        .copyWith(color: GateColors.onSurface),
                  ),
                ),
              ),
            ),

          // ── Layer 5: Scan result panel ──────────────────────────────────
          if (_currentOutcome != null)
            Positioned(
              bottom: GateSpacing.lg,
              left: GateSpacing.md,
              right: GateSpacing.md,
              child: ScanResultPanel(
                outcome: _currentOutcome!,
                onClose: _onPanelClosed,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildScannerPreview() {
    final builder = widget.scannerPreviewBuilder;
    if (builder != null) {
      return builder(context, _scannerController, _onDetect);
    }

    return MobileScanner(
      controller: _scannerController,
      onDetect: _onDetect,
      errorBuilder: (context, error) {
        return const GateErrorState(
          message:
              'Không thể truy cập camera.\nKiểm tra quyền truy cập trong Cài đặt.',
          type: GateErrorType.unknown,
        );
      },
    );
  }

  Widget _buildScanFrameOverlay() {
    final frameColor = _currentOutcome?.scanColor.primary ?? GateColors.primary;

    return IgnorePointer(
      child: Center(
        child: SizedBox(
          key: const Key('scan_frame'),
          width: _scanFrameSize,
          height: _scanFrameSize,
          child: Stack(
            children: [
              Container(
                decoration: BoxDecoration(
                  borderRadius: GateRadii.lg,
                  border: Border.all(
                    color: frameColor.withValues(alpha: 0.95),
                    width: 3,
                  ),
                ),
              ),
              AnimatedBuilder(
                animation: _laserController,
                builder: (context, child) {
                  final travel = _scanFrameSize - 24;
                  return Positioned(
                    top: 12 + (travel * _laserController.value),
                    left: 16,
                    right: 16,
                    child: child!,
                  );
                },
                child: Container(
                  key: const Key('scan_laser'),
                  height: 3,
                  decoration: BoxDecoration(
                    color: frameColor,
                    borderRadius: GateRadii.full,
                    boxShadow: [
                      BoxShadow(
                        color: frameColor.withValues(alpha: 0.45),
                        blurRadius: 12,
                        spreadRadius: 1,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSyncButton() {
    if (_isSyncing) {
      return Padding(
        padding: EdgeInsets.all(GateSpacing.md),
        child: SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: GateColors.primary,
          ),
        ),
      );
    }
    return IconButton(
      key: const Key('sync_button'),
      icon: const Icon(Icons.sync_rounded),
      tooltip: 'Đồng bộ offline logs',
      onPressed: _manualSync,
    );
  }
}
