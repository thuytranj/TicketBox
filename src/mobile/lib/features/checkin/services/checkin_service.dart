import 'dart:convert';
import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../../../data/database_helper.dart';
import '../models/checkin_entry.dart';
import '../models/preload_step.dart';

class CheckinService {
  static const _deviceIdKey = 'deviceId';
  static const _preparedConcertKey = 'preparedConcert';

  final DioClient _dioClient;
  final FlutterSecureStorage _storage;
  final DatabaseHelper _dbHelper = DatabaseHelper.instance;
  final _uuid = const Uuid();

  StreamSubscription? _connectivitySubscription;

  /// Service-level mutex: prevents concurrent sync submissions.
  ///
  /// Both the background connectivity listener and any manual-sync call share
  /// this flag. The first caller acquires the lock; subsequent callers return
  /// immediately and do nothing.
  bool _isSyncing = false;

  CheckinService(
    this._dioClient,
    this._storage, {
    bool enableBackgroundSync = true,
  }) {
    if (enableBackgroundSync) {
      _startInAppBackgroundSync();
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  void _startInAppBackgroundSync() {
    _connectivitySubscription =
        Connectivity().onConnectivityChanged.listen((List<ConnectivityResult> results) async {
      final isConnected = results.any((r) => r != ConnectivityResult.none);
      if (isConnected) {
        try {
          // Background sync: errors are logged but not rethrown so the
          // connectivity stream continues to function.
          await syncAllOfflineLogs();
        } catch (e) {
          debugPrint('[CheckinService] background sync error: $e');
        }
      }
    });
  }

  void dispose() {
    _connectivitySubscription?.cancel();
  }

  // ── Device ID ─────────────────────────────────────────────────────────────

  Future<String> _getDeviceId() async {
    final stored = await _storage.read(key: _deviceIdKey);
    if (stored != null && stored.isNotEmpty) return stored;
    final generated = 'gate_scanner_${_uuid.v4()}';
    await _storage.write(key: _deviceIdKey, value: generated);
    return generated;
  }

  // ── Prepared concert snapshot ─────────────────────────────────────────────

  Future<void> savePreparedConcertSnapshot({
    required String userId,
    required String id,
    required String title,
    required String location,
    String? posterUrl,
  }) async {
    final payload = jsonEncode({
      'userId': userId,
      'id': id,
      'title': title,
      'location': location,
      'posterUrl': posterUrl,
    });
    await _storage.write(key: _preparedConcertKey, value: payload);
  }

  Future<Map<String, dynamic>?> getPreparedConcertSnapshot({
    required String userId,
  }) async {
    final raw = await _storage.read(key: _preparedConcertKey);
    if (raw == null || raw.isEmpty) return null;

    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        final snapshotUserId = decoded['userId'] as String?;
        if (snapshotUserId == userId) {
          return decoded;
        }
        return null;
      }
    } catch (_) {
      await _storage.delete(key: _preparedConcertKey);
    }

    return null;
  }

  Future<void> clearPreparedConcertSnapshot() async {
    await _storage.delete(key: _preparedConcertKey);
  }

  Future<bool> hasOfflineEntries(String concertId) async {
    final db = await _dbHelper.database;
    final result = await db.rawQuery(
      'SELECT COUNT(*) FROM checkin_entries WHERE concert_id = ?',
      [concertId],
    );
    return (Sqflite.firstIntValue(result) ?? 0) > 0;
  }

  // ── Preload ───────────────────────────────────────────────────────────────

  /// Downloads the latest check-in data from the server and merges it safely
  /// into the local SQLite database.
  ///
  /// ### Merge strategy (replaces the old DELETE-all-then-INSERT):
  ///
  /// 1. Fetch server data.
  /// 2. Validate: reject an empty payload to avoid wiping a valid offline cache.
  /// 3. Inside a single transaction:
  ///    a. Collect IDs of entries that are locally `checked_in` — these must
  ///       never be reset to "available" by a stale server payload.
  ///    b. Delete local rows that are not `checked_in`. The backend payload is
  ///       treated as the authoritative snapshot of currently valid entries for
  ///       the concert, so stale local cache rows must be pruned here.
  ///    c. Insert/replace all server entries, but skip inserting any entry
  ///       whose ID is already `checked_in` locally (prevents re-opening a
  ///       ticket that was just scanned offline and whose sync ACK may not have
  ///       reached the server yet).
  ///    d. For those locally checked_in entries that the server also returned,
  ///       update only non-status metadata (zone_id, entry_type, updated_at).
  /// 4. Re-apply any pending offline scan map on top (existing behaviour).
  Future<void> preloadCheckinData(
    String concertId, {
    void Function(PreloadStep)? onStepChanged,
  }) async {
    onStepChanged?.call(PreloadStep.connecting);

    final data = await _dioClient
        .get('/checkin/data', queryParameters: {'concertId': concertId});

    final ticketsJson = data['tickets'] as List<dynamic>? ?? [];
    final vipGuestsJson = data['vipGuests'] as List<dynamic>? ?? [];
    final allEntries = [...ticketsJson, ...vipGuestsJson];

    // Guard: never wipe the local cache if the server returned nothing.
    if (allEntries.isEmpty) {
      throw Exception(
        'Server returned empty checkin data for concert $concertId. '
        'Preload aborted to protect offline cache.',
      );
    }

    onStepChanged?.call(PreloadStep.downloading);

    final now = DateTime.now().toIso8601String();
    final db = await _dbHelper.database;

    onStepChanged?.call(PreloadStep.saving);

    await db.transaction((txn) async {
      // ── Step A: find locally checked_in IDs ──────────────────────────
      final localCheckedInRows = await txn.query(
        'checkin_entries',
        columns: ['id'],
        where: 'concert_id = ? AND checkin_status = ?',
        whereArgs: [concertId, 'checked_in'],
      );
      final localCheckedInIds =
          localCheckedInRows.map((r) => r['id'] as String).toSet();

      // ── Step B: build pending offline scan map (existing behaviour) ───
      final pendingOfflineScans = await _getPendingOfflineScanMap(txn, concertId);

      // ── Step C: clear non-checked-in cache rows for this concert ──────
      await txn.delete(
        'checkin_entries',
        where: 'concert_id = ? AND checkin_status != ?',
        whereArgs: [concertId, 'checked_in'],
      );

      // ── Step D: insert/update from server payload ─────────────────────
      final batch = txn.batch();

      for (final raw in ticketsJson) {
        _batchUpsertEntry(
          batch: batch,
          raw: raw,
          entryType: 'ticket',
          concertId: concertId,
          now: now,
          localCheckedInIds: localCheckedInIds,
          pendingOfflineScans: pendingOfflineScans,
        );
      }

      for (final raw in vipGuestsJson) {
        _batchUpsertEntry(
          batch: batch,
          raw: raw,
          entryType: 'vip_guest',
          concertId: concertId,
          now: now,
          localCheckedInIds: localCheckedInIds,
          pendingOfflineScans: pendingOfflineScans,
        );
      }

      await batch.commit(noResult: true);
    });
  }

  /// Adds either an INSERT OR a metadata-only UPDATE to [batch], depending on
  /// whether the entry is already locally `checked_in`.
  void _batchUpsertEntry({
    required Batch batch,
    required Map<String, dynamic> raw,
    required String entryType,
    required String concertId,
    required String now,
    required Set<String> localCheckedInIds,
    required Map<String, String> pendingOfflineScans,
  }) {
    final id = raw['id'] as String;
    final qrCodeHash = raw['qrCodeHash'] as String? ?? '';
    final pendingScanTime = pendingOfflineScans[qrCodeHash];

    if (localCheckedInIds.contains(id)) {
      // Entry is locally checked_in — update only non-status metadata.
      // Do NOT overwrite checkin_status or checked_in_at so we never re-open
      // a ticket that was just scanned offline.
      batch.update(
        'checkin_entries',
        {
          'zone_id': raw['zoneId'],
          'entry_type': entryType,
          'updated_at': now,
        },
        where: 'id = ? AND concert_id = ?',
        whereArgs: [id, concertId],
      );
    } else {
      // Safe to insert/replace — not locally checked_in.
      final entry = CheckinEntry(
        id: id,
        concertId: concertId,
        entryType: entryType,
        qrCodeHash: qrCodeHash,
        checkinStatus:
            pendingScanTime != null ? 'checked_in' : (raw['checkinStatus'] as String? ?? 'not_checked_in'),
        zoneId: raw['zoneId'] as String?,
        checkedInAt: pendingScanTime,
        updatedAt: now,
      );
      batch.insert(
        'checkin_entries',
        entry.toJson(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
  }

  // ── Pending offline scan helpers ──────────────────────────────────────────

  Future<Map<String, String>> _getPendingOfflineScanMap(
    Transaction txn,
    String concertId,
  ) async {
    final pendingLogs = await txn.query(
      'offline_checkin_logs',
      columns: ['qr_code_hash', 'scan_time'],
      where: 'concert_id = ? AND upload_status = ?',
      whereArgs: [concertId, 'pending'],
      orderBy: 'scan_time DESC',
    );

    final map = <String, String>{};
    for (final log in pendingLogs) {
      final hash = log['qr_code_hash'] as String?;
      final time = log['scan_time'] as String?;
      if (hash == null || time == null) continue;
      map.putIfAbsent(hash, () => time);
    }
    return map;
  }

  // ── Scan ──────────────────────────────────────────────────────────────────

  Map<String, dynamic> _mapDbEntry(Map<String, Object?> entry) {
    return {
      'id': entry['id'],
      'concertId': entry['concert_id'],
      'entryType': entry['entry_type'],
      'qrCodeHash': entry['qr_code_hash'],
      'checkinStatus': entry['checkin_status'],
      'zoneId': entry['zone_id'],
      'checkedInAt': entry['checked_in_at'],
      'updatedAt': entry['updated_at'],
    };
  }

  Future<Map<String, dynamic>?> _getLocalEntrySnapshot(
    String concertId,
    String qrCodeHash,
  ) async {
    final db = await _dbHelper.database;
    final results = await db.query(
      'checkin_entries',
      where: 'concert_id = ? AND qr_code_hash = ?',
      whereArgs: [concertId, qrCodeHash],
      limit: 1,
    );

    if (results.isEmpty) return null;
    return _mapDbEntry(results.first);
  }

  Future<Map<String, dynamic>?> _markEntryCheckedIn(
    String concertId,
    String qrCodeHash, {
    String? checkedInAt,
    bool preserveExistingTimestamp = false,
  }) async {
    final db = await _dbHelper.database;
    final existingEntry = await _getLocalEntrySnapshot(concertId, qrCodeHash);
    final now = DateTime.now().toIso8601String();
    final existingCheckedInAt = existingEntry?['checkedInAt'] as String?;
    final effectiveCheckedInAt = preserveExistingTimestamp
        ? existingCheckedInAt ?? checkedInAt
        : checkedInAt ?? existingCheckedInAt ?? now;

    final values = <String, Object?>{
      'checkin_status': 'checked_in',
      'updated_at': now,
    };
    if (effectiveCheckedInAt != null) {
      values['checked_in_at'] = effectiveCheckedInAt;
    }

    await db.update(
      'checkin_entries',
      values,
      where: 'concert_id = ? AND qr_code_hash = ?',
      whereArgs: [concertId, qrCodeHash],
    );

    return _getLocalEntrySnapshot(concertId, qrCodeHash);
  }

  bool _isDuplicateCheckinError(ApiException exception) {
    final code = exception.errorCode?.toUpperCase().trim();
    return code == 'ALREADY_USED' || code == 'DUPLICATE CHECK-IN';
  }

  String? _entryTypeLabel(String? rawType) {
    switch (rawType) {
      case 'ticket':
      case 'regular_ticket':
        return 'Vé thường';
      case 'vip_guest':
        return 'Khách VIP';
      default:
        return null;
    }
  }

  String? _formatCheckinTime(String? rawTime) {
    if (rawTime == null || rawTime.isEmpty) return null;

    try {
      final parsed = DateTime.parse(rawTime).toLocal();
      final hh = parsed.hour.toString().padLeft(2, '0');
      final mm = parsed.minute.toString().padLeft(2, '0');
      return '$hh:$mm';
    } catch (_) {
      return null;
    }
  }

  List<String> _buildEntrySummaryParts({
    Map<String, dynamic>? localEntry,
    Map<String, dynamic>? remoteTicket,
  }) {
    final parts = <String>[];
    final type = _entryTypeLabel(
      (localEntry?['entryType'] ??
              remoteTicket?['entryType'] ??
              remoteTicket?['type'])
          ?.toString(),
    );
    final zone = (localEntry?['zoneId'] ?? remoteTicket?['zoneId'])?.toString();

    if (type != null) {
      parts.add(type);
    }
    if (zone != null && zone.isNotEmpty) {
      parts.add(zone);
    }

    return parts;
  }

  String _buildValidMessage({
    Map<String, dynamic>? localEntry,
    Map<String, dynamic>? remoteTicket,
  }) {
    final parts = _buildEntrySummaryParts(
      localEntry: localEntry,
      remoteTicket: remoteTicket,
    );
    if (parts.isEmpty) {
      return 'Vé hợp lệ';
    }
    return parts.join(' | ');
  }

  String _buildAlreadyUsedMessage({
    Map<String, dynamic>? localEntry,
    Map<String, dynamic>? remoteTicket,
  }) {
    final parts = _buildEntrySummaryParts(
      localEntry: localEntry,
      remoteTicket: remoteTicket,
    );
    final checkedInAt = _formatCheckinTime(
      (localEntry?['checkedInAt'] ?? remoteTicket?['checkedInAt'])?.toString(),
    );

    if (checkedInAt != null) {
      parts.add('Đã check-in lúc $checkedInAt');
    }

    if (parts.isEmpty) {
      return 'Vé này đã được sử dụng';
    }
    return parts.join(' | ');
  }

  Future<Map<String, dynamic>> processScan(
    String concertId,
    String qrCodeHash,
  ) async {
    final now = DateTime.now().toIso8601String();
    final deviceId = await _getDeviceId();

    try {
      final response = await _dioClient.post('/checkin/scan', data: {
        'concertId': concertId,
        'qrCodeHash': qrCodeHash,
        'deviceId': deviceId,
        'scanTime': now,
      });

      final scanResult = response['data'] ?? {};
      final status =
          scanResult['status'] ?? scanResult['checkinStatus'] ?? 'VALID';

      Map<String, dynamic>? localEntry;
      if (status == 'VALID' || status == 'CHECKED_IN' || status == 'checked_in') {
        localEntry = await _markEntryCheckedIn(
          concertId,
          qrCodeHash,
          checkedInAt: now,
        );
      }

      return {
        'success': true,
        'status': status,
        'message': _buildValidMessage(
          localEntry: localEntry,
          remoteTicket: scanResult is Map<String, dynamic> ? scanResult : null,
        ),
        'ticket': localEntry ?? scanResult,
      };
    } on ApiException catch (e) {
      if (e.statusCode == 404) {
        return {
          'success': false,
          'status': 'NOT_FOUND',
          'message': 'Không tồn tại vé này (Online)',
        };
      }
      if (e.statusCode == 400 && _isDuplicateCheckinError(e)) {
        final localEntry = await _markEntryCheckedIn(
          concertId,
          qrCodeHash,
          preserveExistingTimestamp: true,
        );
        return {
          'success': false,
          'status': 'ALREADY_USED',
          'message': _buildAlreadyUsedMessage(localEntry: localEntry),
          'ticket': localEntry,
        };
      }

      if (e.isNetworkError) {
        return _offlineFallbackScan(concertId, qrCodeHash, deviceId: deviceId);
      }

      rethrow;
    } catch (_) {
      rethrow;
    }
  }

  Future<Map<String, dynamic>> _offlineFallbackScan(
    String concertId,
    String qrCodeHash, {
    required String deviceId,
  }) async {
    final now = DateTime.now().toIso8601String();
    final db = await _dbHelper.database;

    final results = await db.query(
      'checkin_entries',
      where: 'concert_id = ? AND qr_code_hash = ?',
      whereArgs: [concertId, qrCodeHash],
    );

    if (results.isEmpty) {
      return {
        'success': false,
        'status': 'NOT_FOUND',
        'message': 'Không tồn tại vé này (Offline)',
        'offline': true,
      };
    }

    final entry = results.first;
    final status = entry['checkin_status'] as String;

    final mappedTicket = {
      'id': entry['id'],
      'concertId': entry['concert_id'],
      'entryType': entry['entry_type'],
      'qrCodeHash': entry['qr_code_hash'],
      'checkinStatus': entry['checkin_status'],
      'zoneId': entry['zone_id'],
      'checkedInAt': entry['checked_in_at'],
      'updatedAt': entry['updated_at'],
    };

    if (status == 'checked_in' || status == 'CHECKED_IN') {
      return {
        'success': false,
        'status': 'ALREADY_USED',
        'message': _buildAlreadyUsedMessage(localEntry: mappedTicket),
        'ticket': mappedTicket,
        'offline': true,
      };
    }

    await db.transaction((txn) async {
      await txn.update(
        'checkin_entries',
        {'checkin_status': 'checked_in', 'checked_in_at': now, 'updated_at': now},
        where: 'id = ?',
        whereArgs: [entry['id']],
      );
      await txn.insert('offline_checkin_logs', {
        'id': _uuid.v4(),
        'concert_id': concertId,
        'qr_code_hash': qrCodeHash,
        'device_id': deviceId,
        'scan_time': now,
        'upload_status': 'pending',
        'server_ack_at': null,
      });
    });

    mappedTicket['checkinStatus'] = 'checked_in';
    mappedTicket['checkedInAt'] = now;

    return {
      'success': true,
      'status': 'VALID',
      'message': _buildValidMessage(localEntry: mappedTicket),
      'ticket': mappedTicket,
      'offline': true,
    };
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  /// Syncs all pending offline logs for every concert that has pending entries.
  ///
  /// Protected by [_isSyncing] mutex. Background callers catch and log errors;
  /// manual callers (UI sync button) let errors propagate so the UI can surface
  /// them.
  Future<void> syncAllOfflineLogs() async {
    if (!_beginSync()) return;
    try {
      final token = await _storage.read(key: 'accessToken');
      if (token == null) return;

      final db = await _dbHelper.database;
      final concerts = await db.query(
        'offline_checkin_logs',
        columns: ['concert_id'],
        where: 'upload_status = ?',
        whereArgs: ['pending'],
        distinct: true,
      );

      for (final row in concerts) {
        final cid = row['concert_id'] as String;
        await _syncOfflineLogsUnlocked(cid);
      }
    } finally {
      _endSync();
    }
  }

  /// Syncs pending offline logs for a specific [concertId].
  ///
  /// Throws on network or server error — callers decide whether to swallow or
  /// surface the exception.
  Future<void> syncOfflineLogs(String concertId) async {
    if (!_beginSync(throwIfBusy: true)) return;
    try {
      await _syncOfflineLogsUnlocked(concertId);
    } finally {
      _endSync();
    }
  }

  Future<void> _syncOfflineLogsUnlocked(String concertId) async {
    final db = await _dbHelper.database;
    final logs = await db.query(
      'offline_checkin_logs',
      where: 'concert_id = ? AND upload_status = ?',
      whereArgs: [concertId, 'pending'],
    );

    if (logs.isEmpty) return;

    final payload = logs
        .map((log) => {
              'qrCodeHash': log['qr_code_hash'],
              'deviceId': log['device_id'],
              'scanTime': log['scan_time'],
            })
        .toList();

    await _dioClient.post('/checkin/sync', data: {
      'concertId': concertId,
      'offlineLogs': payload,
    });

    // Mark uploaded only after a confirmed server response.
    final now = DateTime.now().toIso8601String();
    await db.transaction((txn) async {
      for (final log in logs) {
        await txn.update(
          'offline_checkin_logs',
          {'upload_status': 'uploaded', 'server_ack_at': now},
          where: 'id = ?',
          whereArgs: [log['id']],
        );
      }
    });
  }

  bool _beginSync({bool throwIfBusy = false}) {
    if (_isSyncing) {
      if (throwIfBusy) {
        throw const SyncInProgressException();
      }
      return false;
    }
    _isSyncing = true;
    return true;
  }

  void _endSync() {
    _isSyncing = false;
  }

  // ── Pending count ─────────────────────────────────────────────────────────

  /// Returns the number of offline scan logs awaiting upload for [concertId].
  Future<int> getPendingLogCount(String concertId) async {
    final db = await _dbHelper.database;
    final result = await db.rawQuery(
      'SELECT COUNT(*) FROM offline_checkin_logs '
      'WHERE concert_id = ? AND upload_status = ?',
      [concertId, 'pending'],
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  // ── Counts ────────────────────────────────────────────────────────────────

  Future<int> getTicketCount(String concertId) async {
    final db = await _dbHelper.database;
    final result = await db.rawQuery(
      "SELECT COUNT(*) as count FROM checkin_entries "
      "WHERE concert_id = ? AND entry_type = 'ticket'",
      [concertId],
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  Future<int> getVipCount(String concertId) async {
    final db = await _dbHelper.database;
    final result = await db.rawQuery(
      "SELECT COUNT(*) as count FROM checkin_entries "
      "WHERE concert_id = ? AND entry_type = 'vip_guest'",
      [concertId],
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }
}

class SyncInProgressException implements Exception {
  const SyncInProgressException([
    this.message = 'Đồng bộ đang chạy. Vui lòng đợi hoàn tất.',
  ]);

  final String message;

  @override
  String toString() => message;
}
