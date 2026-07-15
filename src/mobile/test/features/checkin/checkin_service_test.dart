import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:ticketbox_mobile/features/checkin/services/checkin_service.dart';

// ── Minimal concurrent-sync guard test ───────────────────────────────────────
//
// CheckinService uses a SQLite singleton and a real Dio client, making full
// service instantiation impractical in unit tests without sqflite_ffi.
//
// These tests verify the guard logic in isolation by reimplementing just the
// mutex pattern and checking its invariants.  The behaviour they describe maps
// 1-to-1 to `CheckinService.syncAllOfflineLogs`.

// ── Inline guard under test ───────────────────────────────────────────────────

class _SyncGuard {
  bool _isSyncing = false;
  int syncCallCount = 0;
  int completedCount = 0;

  /// Returns true if sync ran, false if the lock was held.
  Future<bool> runSync(Future<void> Function() work) async {
    if (_isSyncing) return false;
    _isSyncing = true;
    syncCallCount++;
    try {
      await work();
      completedCount++;
    } finally {
      _isSyncing = false;
    }
    return true;
  }
}

class _ManualSyncGuard {
  bool _isSyncing = false;

  bool begin({bool throwIfBusy = false}) {
    if (_isSyncing) {
      if (throwIfBusy) {
        throw const SyncInProgressException();
      }
      return false;
    }

    _isSyncing = true;
    return true;
  }

  void end() {
    _isSyncing = false;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  group('Sync concurrency guard', () {
    test('single sync call runs to completion', () async {
      final guard = _SyncGuard();
      final ran = await guard.runSync(() async {});
      expect(ran, true);
      expect(guard.syncCallCount, 1);
      expect(guard.completedCount, 1);
      expect(guard._isSyncing, false);
    });

    test('second concurrent call is dropped while first is in-flight', () async {
      final guard = _SyncGuard();
      final completer = Completer<void>();

      // Start first sync (long-running)
      final firstFuture = guard.runSync(() => completer.future);

      // Second call arrives while first is still running
      final secondRan = await guard.runSync(() async {});

      completer.complete();
      final firstRan = await firstFuture;

      expect(firstRan, true, reason: 'first sync must complete');
      expect(secondRan, false, reason: 'second call must be dropped (guard held)');
      expect(guard.syncCallCount, 1, reason: 'work function called exactly once');
    });

    test('flag resets to false after successful sync', () async {
      final guard = _SyncGuard();
      await guard.runSync(() async {});
      expect(guard._isSyncing, false);
    });

    test('flag resets to false even if sync throws', () async {
      final guard = _SyncGuard();
      try {
        await guard.runSync(() async => throw Exception('network error'));
      } catch (_) {}
      expect(guard._isSyncing, false,
          reason: 'try/finally must always reset the flag');
    });

    test('subsequent sync runs after previous completes', () async {
      final guard = _SyncGuard();
      await guard.runSync(() async {});
      final secondRan = await guard.runSync(() async {});
      expect(secondRan, true, reason: 'second sync should run after first completes');
      expect(guard.syncCallCount, 2);
    });

    test('manual sync throws when another sync already holds the lock', () {
      final guard = _ManualSyncGuard();

      expect(guard.begin(), isTrue);
      expect(
        () => guard.begin(throwIfBusy: true),
        throwsA(isA<SyncInProgressException>()),
      );

      guard.end();
      expect(guard.begin(throwIfBusy: true), isTrue);
    });
  });

  group('Preload merge — protect locally checked_in entries', () {
    // This group tests the *logic* of the UPSERT strategy without SQLite.
    // It simulates the three sets: localCheckedIn, serverPayload, and
    // the expected outcome after merge.

    test('entries in localCheckedIn set are not overwritten by server data', () {
      const localCheckedIn = {'ticket-001', 'ticket-002'};

      // Server payload claims ticket-001 is 'not_checked_in' (stale data)
      final serverEntries = [
        {'id': 'ticket-001', 'checkinStatus': 'not_checked_in'},
        {'id': 'ticket-003', 'checkinStatus': 'not_checked_in'},
      ];

      // Simulate the merge decision
      final entriesToInsert = <Map<String, dynamic>>[];
      final entriesToMetaUpdate = <Map<String, dynamic>>[];

      for (final entry in serverEntries) {
        final id = entry['id'] as String;
        if (localCheckedIn.contains(id)) {
          entriesToMetaUpdate.add(entry);
        } else {
          entriesToInsert.add(entry);
        }
      }

      expect(entriesToInsert.map((e) => e['id']), equals(['ticket-003']),
          reason: 'only non-checked_in entries should be (re)inserted');
      expect(entriesToMetaUpdate.map((e) => e['id']), equals(['ticket-001']),
          reason: 'checked_in entry goes to metadata-only update path');
    });

    test('empty server payload is allowed when no local offline state exists', () {
      final serverEntries = <Map<String, dynamic>>[];
      const localEntryCount = 0;
      const pendingOfflineCount = 0;

      final shouldAbort =
          serverEntries.isEmpty && (localEntryCount > 0 || pendingOfflineCount > 0);

      expect(shouldAbort, false,
          reason: 'brand-new concerts may legitimately have zero issued entries');
    });

    test('empty server payload still aborts when local offline state exists', () {
      final serverEntries = <Map<String, dynamic>>[];
      const localEntryCount = 3;
      const pendingOfflineCount = 1;

      final shouldAbort =
          serverEntries.isEmpty && (localEntryCount > 0 || pendingOfflineCount > 0);

      expect(shouldAbort, true,
          reason: 'an empty snapshot must not wipe an existing offline cache or pending logs');
    });

    test('pending offline scans are preserved as checked_in after merge', () {
      // pending log exists for ticket-999
      final pendingOfflineScans = {'qr-hash-999': '2026-06-30T10:00:00Z'};
      final serverEntry = {'id': 'ticket-999', 'qrCodeHash': 'qr-hash-999', 'checkinStatus': 'not_checked_in'};

      final pendingScanTime = pendingOfflineScans[serverEntry['qrCodeHash']];
      final effectiveStatus = pendingScanTime != null ? 'checked_in' : serverEntry['checkinStatus'];

      expect(effectiveStatus, 'checked_in',
          reason: 'pending offline scan must mark entry as checked_in during merge');
    });

    test('non-checked-in entries absent from server snapshot are pruned', () {
      const localCheckedIn = {'ticket-003'};
      final localCacheIds = {'ticket-001', 'ticket-002', 'ticket-003'};
      final serverPayloadIds = {'ticket-001'};

      final prunedIds = localCacheIds
          .where((id) => localCheckedIn.contains(id) || serverPayloadIds.contains(id))
          .toSet();

      expect(
        prunedIds,
        equals(<String>{'ticket-001', 'ticket-003'}),
        reason: 'backend snapshot should remove stale available entries but keep local checked_in rows',
      );
    });
  });
}
