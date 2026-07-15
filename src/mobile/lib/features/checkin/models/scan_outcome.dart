/// Normalized scan outcome model for presentation layer.
///
/// [CheckinService.processScan] returns a raw `Map<String, dynamic>`.
/// [ScanOutcome.fromServiceResult] maps that raw map into a typed, presentation-safe
/// object that [ScanResultPanel] and the scanner screen consume without brittle
/// string-matching on raw status literals.
library;

import 'package:flutter/material.dart';
import '../../../core/theme/gate_colors.dart';

/// The four display-level states of a scan attempt.
enum ScanStatus { valid, alreadyUsed, notFound, error }

/// A normalized, presentation-safe representation of a single scan result.
@immutable
class ScanOutcome {
  /// UI-level classification.
  final ScanStatus status;

  /// Short all-caps label shown as the headline (e.g. "HỢP LỆ").
  final String title;

  /// One-line detail visible below the headline (e.g. zone, scan time).
  final String message;

  /// True when the result came from the local offline DB, not from the server.
  final bool isOffline;

  const ScanOutcome({
    required this.status,
    required this.title,
    required this.message,
    required this.isOffline,
  });

  /// Maps the raw [Map] returned by [CheckinService.processScan] into a
  /// typed [ScanOutcome].
  ///
  /// Mapping rules (deterministic, no substring heuristics):
  /// - `VALID` | `CHECKED_IN` | `checked_in` → [ScanStatus.valid]
  /// - `ALREADY_USED` | `ALREADY_CHECKED_IN` → [ScanStatus.alreadyUsed]
  /// - `NOT_FOUND` → [ScanStatus.notFound]
  /// - anything else or missing → [ScanStatus.error]
  factory ScanOutcome.fromServiceResult(Map<String, dynamic> result) {
    final rawStatus = (result['status'] as String? ?? '').toUpperCase().trim();
    final isOffline = result['offline'] == true ||
        (result['message'] as String? ?? '').contains('Offline');

    final status = _mapStatus(rawStatus);
    final title = _titleFor(rawStatus, status);
    final message =
        _sanitizeMessage(rawStatus, result['message'] as String? ?? '', status);

    return ScanOutcome(
      status: status,
      title: title,
      message: message,
      isOffline: isOffline,
    );
  }

  static ScanStatus _mapStatus(String rawStatus) {
    switch (rawStatus) {
      case 'VALID':
      case 'CHECKED_IN':
        return ScanStatus.valid;
      case 'ALREADY_USED':
      case 'ALREADY_CHECKED_IN':
        return ScanStatus.alreadyUsed;
      case 'NOT_FOUND':
        return ScanStatus.notFound;
      default:
        return ScanStatus.error;
    }
  }

  static String _titleFor(String rawStatus, ScanStatus status) {
    switch (rawStatus) {
      case 'AUTH_EXPIRED':
        return 'PHIÊN ĐÃ HẾT HẠN';
      case 'FORBIDDEN':
        return 'KHÔNG CÓ QUYỀN';
      case 'SERVER_ERROR':
        return 'LỖI MÁY CHỦ';
      case 'INVALID_REQUEST':
        return 'KHÔNG THỂ XỬ LÝ';
      case 'DEVICE_ERROR':
        return 'LỖI THIẾT BỊ';
    }

    return switch (status) {
      ScanStatus.valid => 'HỢP LỆ',
      ScanStatus.alreadyUsed => 'VÉ ĐÃ SỬ DỤNG',
      ScanStatus.notFound => 'MÃ VÉ KHÔNG ĐÚNG',
      ScanStatus.error => 'KHÔNG THỂ XỬ LÝ',
    };
  }

  static String _sanitizeMessage(
    String rawStatus,
    String raw,
    ScanStatus status,
  ) {
    // Strip raw exception text — never expose internal errors to staff UI.
    if (raw.isEmpty) {
      switch (rawStatus) {
        case 'AUTH_EXPIRED':
          return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
        case 'FORBIDDEN':
          return 'Tài khoản không có quyền thực hiện check-in này.';
        case 'SERVER_ERROR':
          return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
        case 'INVALID_REQUEST':
          return 'Yêu cầu quét không hợp lệ. Vui lòng thử lại.';
        case 'DEVICE_ERROR':
          return 'Thiết bị gặp lỗi khi lưu kết quả quét.';
      }

      return switch (status) {
        ScanStatus.valid => 'Vé hợp lệ',
        ScanStatus.alreadyUsed => 'Vé này đã được sử dụng',
        ScanStatus.notFound => 'Mã vé không tồn tại',
        ScanStatus.error => 'Không thể xử lý lượt quét này. Vui lòng thử lại.',
      };
    }
    return raw;
  }

  // ── Presentation helpers ──────────────────────────────────────────────────

  /// The [GateScanColor] token set matching this status.
  GateScanColor get scanColor => switch (status) {
        ScanStatus.valid => GateColors.scanValid,
        ScanStatus.alreadyUsed => GateColors.scanUsed,
        ScanStatus.notFound => GateColors.scanInvalid,
        ScanStatus.error => GateColors.scanError,
      };

  /// The icon appropriate for the status.
  IconData get icon => switch (status) {
        ScanStatus.valid => Icons.check_circle_rounded,
        ScanStatus.alreadyUsed => Icons.warning_rounded,
        ScanStatus.notFound => Icons.cancel_rounded,
        ScanStatus.error => Icons.cloud_off_rounded,
      };

  /// Auto-dismiss duration: valid closes faster than errors.
  Duration get dismissAfter => status == ScanStatus.valid
      ? const Duration(milliseconds: 1500)
      : const Duration(milliseconds: 2500);
}
