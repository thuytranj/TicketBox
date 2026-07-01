# Tasks: Mobile Release Blockers

> **Status: IMPLEMENTED** — Session 2026-06-30

## Group 1 — Scanner Lifecycle & UI Result Panel

### 1.1 Tạo `ScanOutcome` model
**File:** `lib/features/checkin/models/scan_outcome.dart` [NEW] ✅
- [x] `enum ScanStatus { valid, alreadyUsed, notFound, error }`
- [x] `class ScanOutcome` với field: `status`, `title`, `message`, `isOffline`
- [x] `ScanOutcome.fromServiceResult()` — no substring heuristics
- [x] Presentation helpers: `scanColor`, `icon`, `dismissAfter`

### 1.2 Tạo `ScanResultPanel` widget
**File:** `lib/features/checkin/widgets/scan_result_panel.dart` [NEW] ✅
- [x] Nhận `outcome: ScanOutcome` và `onClose: VoidCallback`
- [x] Auto-dismiss timer: 1500ms (VALID) / 2500ms (khác)
- [x] `dispose` cancel timer
- [x] `GestureDetector.onTap` dismiss ngay lập tức
- [x] One-shot guard: `_dismissed` flag ngăn double-call
- [x] Layout hoàn toàn dùng `GateColors`, `GateTypography`, `GateRadii`, `GateSpacing`
- [x] `_ModeBadge` hiển thị Online/Offline Fallback

### 1.3-1.5 Refactor `ScannerScreen`
**File:** `lib/features/checkin/screens/scanner_screen.dart` [REWRITTEN] ✅
- [x] `MobileScannerController` với `initState`/`deactivate`/`dispose` đúng lifecycle
- [x] `_isProcessing` lock chỉ mở lại trong `_onPanelClosed` — không phải trong scan handler
- [x] Không còn `showModalBottomSheet` trong scan flow
- [x] `ScanResultPanel` inline trong `Stack`
- [x] `GateScaffold(showNetworkStatus: true)` thay `Scaffold`+`AppBar`
- [x] Connectivity stream → `_isOnline` badge + pending count
- [x] `_manualSync` với loading state, SnackBar dùng token colors
- [x] Không còn `Colors.white`, `Colors.green`, `Colors.red`, `Colors.black87`, `Colors.black54`
- [x] Mounted safety trên tất cả async interactions

### 1.6 Thêm `getPendingLogCount` vào `CheckinService`
**File:** `lib/features/checkin/services/checkin_service.dart` [MODIFIED] ✅
- [x] `Future<int> getPendingLogCount(String concertId)`

---

## Group 2 — Auth Restore — Offline-Safe

### 2.1 Thêm `getStoredToken()` vào `AuthService`
**File:** `lib/features/auth/services/auth_service.dart` [MODIFIED] ✅
- [x] `Future<String?> getStoredToken()` — đọc token không gọi API

### 2.2-2.3 Refactor `AuthProvider.checkAuthStatus()`
**File:** `lib/features/auth/providers/auth_provider.dart` [REWRITTEN] ✅
- [x] Fast-path: `getStoredToken() == null` → unauthenticated ngay, không gọi API
- [x] `_isNetworkError()` helper phân biệt DioException connection types
- [x] Network error + token exists → `AuthState.authenticated` (degraded offline)
- [x] 401/403 → try refresh; nếu refresh cũng network down → degraded offline
- [x] 401/403 → try refresh; nếu refresh fail auth → logout + unauthenticated
- [x] Invalid role → logout + unauthenticated
- [x] Không gọi `logout()` khi network error

---

## Group 3 — Sync Concurrency & Preload Merge Integrity

### 3.1-3.2 Concurrent sync guard + error propagation
**File:** `lib/features/checkin/services/checkin_service.dart` [REWRITTEN] ✅
- [x] `bool _isSyncing = false` mutex field
- [x] `syncAllOfflineLogs()` guards với `if (_isSyncing) return`
- [x] `try/finally` đảm bảo flag luôn reset kể cả khi throw
- [x] Background sync: catch + `debugPrint`, không crash stream
- [x] Manual sync path: exceptions propagate lên caller (UI hiển thị)
- [x] Không còn `catch (_) {}` silent swallow

### 3.3 `_manualSync` trong `ScannerScreen`
**File:** `lib/features/checkin/screens/scanner_screen.dart` [REWRITTEN] ✅
- [x] `_isSyncing` state riêng cho UI
- [x] SnackBar dùng `GateColors.networkOnline` / `GateColors.scanInvalid.primary`

### 3.4 Safe UPSERT preload strategy
**File:** `lib/features/checkin/services/checkin_service.dart` [REWRITTEN] ✅
- [x] Validate: server payload rỗng → throw trước khi xóa DB
- [x] Query `localCheckedInIds` trước transaction
- [x] DELETE chỉ `checkin_status != 'checked_in'` entries
- [x] INSERT OR REPLACE entries không thuộc `localCheckedInIds`
- [x] UPDATE metadata-only cho entries trong `localCheckedInIds`
- [x] Pending offline scans vẫn được merge đúng

---

## Group 4 — Event Selection Invalidation

### 4.1 Invalidate stale selection
**File:** `lib/features/concerts/providers/concert_provider.dart` [MODIFIED] ✅
- [x] Sau khi `_concerts = newList`: check `_selectedConcert` còn tồn tại không
- [x] Nếu không còn → `_selectedConcert = null`
- [x] Chỉ 2 `notifyListeners()` (loading + loaded), không thêm

---

## Group 5 — Tests & Docs

### 5.1 Widget tests cho `ScanResultPanel`
**File:** `test/features/checkin/scan_result_panel_test.dart` [NEW] ✅
- [x] VALID state: title, icon, Online badge
- [x] ALREADY_USED state: title, warning icon
- [x] NOT_FOUND state: title, cancel icon
- [x] ERROR state: title, cloud_off icon
- [x] Offline badge khi `isOffline: true`
- [x] Tap dismiss → onClose called
- [x] VALID auto-dismiss 1500ms
- [x] NOT_FOUND auto-dismiss 2500ms (không sớm hơn)
- [x] One-shot guard: tap + timer → onClose called exactly once

### 5.2 Unit tests cho `ScanOutcome`
**File:** `test/features/checkin/scan_result_panel_test.dart` [NEW] ✅
- [x] Mỗi status mapped đúng
- [x] Empty message → sanitized fallback
- [x] Offline detection từ `offline: true` và message "Offline"
- [x] `dismissAfter` đúng cho valid vs non-valid

### 5.3 Auth restore tests
**File:** `test/features/auth/auth_provider_test.dart` [NEW] ✅
- [x] No stored token → unauthenticated, getMe không gọi
- [x] Valid token + OK → authenticated
- [x] Valid token + network error → authenticated (degraded)
- [x] Valid token + 401 + refresh OK → authenticated
- [x] Valid token + 401 + refresh fail → unauthenticated + logout
- [x] Valid token + invalid role → unauthenticated + logout
- [x] Auth error + network down during refresh → degraded

### 5.4 Concert selection tests
**File:** `test/features/concerts/concert_provider_test.dart` [NEW] ✅
- [x] Selection cleared khi concert bị xóa khỏi server
- [x] Selection giữ nguyên khi concert vẫn còn
- [x] No selection baseline
- [x] 2 notify calls, không hơn

### 5.5 Checkin service logic tests
**File:** `test/features/checkin/checkin_service_test.dart` [NEW] ✅
- [x] Sync guard: single sync runs, concurrent call dropped, flag resets
- [x] Flag resets khi throw
- [x] Subsequent sync allowed after previous completes
- [x] Preload merge: `localCheckedInIds` không bị overwrite
- [x] Empty payload → validation guard
- [x] Pending offline scans preserved as checked_in

### 5.6 README update
**File:** `src/mobile/README.md` [MODIFIED] ✅
- [x] Xóa false claim "82 tests covering all logic"
- [x] Thêm bảng test coverage thực tế
- [x] Ghi rõ known gap: `sqflite_common_ffi` chưa có trong dev_dependencies

### 5.7 widget_test.dart
**File:** `test/widget_test.dart` [REPLACED] ✅
- [x] Xóa placeholder test vô nghĩa, thay bằng smoke test nhỏ cho `ScanOutcome`

---

## Verification Status

| Check | Result |
|-------|--------|
| `flutter analyze` | ⏳ Running |
| `flutter test` | ⏳ Running |
| Manual: no modal sheet | ✅ (code review) |
| Manual: scanner lock only released in _onPanelClosed | ✅ (code review) |
| Manual: no Colors.* in scanner flow | ✅ (code review) |
