# Design: Mobile Release Blockers

## 1. Scanner Lifecycle & ScanResultPanel

### 1.1 Vấn đề hiện tại

`ScannerScreen` hiện tại dùng `showModalBottomSheet` để hiển thị kết quả quét. Bottom sheet:
- Chặn toàn bộ camera stream trong khi hiển thị
- Dùng `backgroundColor: Colors.white` — vỡ dark theme
- Không tự đóng — staff phải bấm nút thủ công sau mỗi vé
- Không có `MobileScannerController` → camera không dispose/pause được

### 1.2 Lifecycle mới

```
[Camera idle] ──onDetect──► [_isProcessing = true] ──async──► [API / LocalDB]
                                                                      │
                                                              [ScanResult resolved]
                                                                      │
                                                          [setState: _currentResult = result]
                                                                      │
                                                        [ScanResultPanel hiển thị ở bottom]
                                                                      │
                                                    ┌────────── auto-dismiss timer ──────────┐
                                                    │ VALID: 1.5s    │ OTHER: 2.5s           │
                                                    │ OR tap panel (instant dismiss)          │
                                                    └─────────────────────────────────────────┘
                                                                      │
                                                          [onClose callback fires]
                                                                      │
                                                    [setState: _currentResult = null]
                                                    [_isProcessing = false]
                                                                      │
                                                              [Camera idle] ◄──┘
```

**Cooldown rule:** Ngoài processing lock, mobile giữ một cooldown 3 giây cho cùng một `barcodeValue` sau khi mã đó vừa được accept, để tránh camera quét lại cùng một attendee khi máy vẫn đang chĩa vào badge.

### 1.3 `MobileScannerController` lifecycle

```dart
class _ScannerScreenState extends State<ScannerScreen> {
  late final MobileScannerController _scannerController;

  @override
  void initState() {
    super.initState();
    _scannerController = MobileScannerController(
      detectionSpeed: DetectionSpeed.normal,
    );
  }

  @override
  void deactivate() {
    _scannerController.stop();
    super.deactivate();
  }

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
  }
}
```

Controller được truyền vào `MobileScanner(controller: _scannerController)`. Khi panel hiển thị, controller không cần stop — `_isProcessing` flag đủ để bỏ qua các barcode detect tiếp theo.

### 1.4 `ScanResultPanel` widget spec

**File:** `lib/features/checkin/widgets/scan_result_panel.dart`

**Props:**
```dart
class ScanResultPanel extends StatefulWidget {
  final Map<String, dynamic> result;  // từ checkinService.processScan
  final VoidCallback onClose;
}
```

**Auto-dismiss logic (internal Timer):**
- `result['status'] == 'VALID' || result['status'] == 'CHECKED_IN'` → `1500ms`
- Tất cả trường hợp khác (`ALREADY_USED`, `NOT_FOUND`, `ERROR`, offline) → `2500ms`
- `GestureDetector.onTap` → cancel timer + gọi `onClose` ngay lập tức

**Visual mapping:**

| `result['status']` | Background token | Icon | Title |
|--------------------|-----------------|------|-------|
| `VALID` / `CHECKED_IN` | `GateColors.scanValid.container` | `Icons.check_circle_rounded`, `scanValid.primary` | **HỢP LỆ** |
| `ALREADY_USED` | `GateColors.scanUsed.container` | `Icons.warning_rounded`, `scanUsed.primary` | **VÉ ĐÃ SỬ DỤNG** |
| `NOT_FOUND` | `GateColors.scanInvalid.container` | `Icons.cancel_rounded`, `scanInvalid.primary` | **MÃ VÉ KHÔNG ĐÚNG** |
| `ERROR` / khác | `GateColors.scanError.container` | `Icons.cloud_off_rounded`, `scanError.primary` | **LỖI ĐỒNG BỘ** |

**Layout:**
```
┌─────────────────────────────────────────┐
│  [Icon 56dp]  [Title 24dp bold]         │
│               [Message 15dp sub]        │
│               [(Online) / (Offline)]    │
└─────────────────────────────────────────┘
```

Dùng `GateColors`, `GateTypography`, `GateRadii.lg` — không có raw literal nào.

### 1.5 `ScannerScreen` refactor

- Thay `Scaffold` + raw `AppBar` bằng `GateScaffold(title: 'Quét vé - {concert.title}', showNetworkStatus: true, isOnline: _isOnline, pendingCount: _pendingCount)`
- `Stack` body: `MobileScanner` full-screen + `Positioned(bottom: 24)` cho `ScanResultPanel` khi `_currentResult != null`
- AppBar actions: nút sync với loading state (`_isSyncing`)
- Connectivity stream: lắng nghe `Connectivity().onConnectivityChanged` → update `_isOnline`
- Pending count: gọi `checkinService.getPendingLogCount(concertId)` sau mỗi sync và mỗi offline scan
- Xoá toàn bộ `Colors.*` literals, `TextStyle(fontSize:...)` raw, `SizedBox(height:...)` literals

---

## 2. Auth Restore — Degraded Offline Mode

### 2.1 Vấn đề hiện tại

Trong `AuthProvider.checkAuthStatus()`:
```dart
try {
  final user = await _authService.getCurrentUser(); // gọi GET /auth/me
  if (user.role != 'gate_staff') { ... logout ... }
  state = AuthState.authenticated;
} catch (e) {
  await _authService.logout(); // ← xoá cả token khi network down!
  state = AuthState.unauthenticated;
  errorMessage = e.toString();
}
```

Khi mạng down, `getCurrentUser()` throw `SocketException`. Code catch tất cả errors giống nhau → xoá token → đá user về login.

### 2.2 Auth restore strategy

**Decision tree:**

```
checkAuthStatus() {
  token = await authService.getStoredToken()
  
  if (token == null) → state = unauthenticated  // chưa login bao giờ
  
  try {
    user = await authService.getCurrentUser()   // GET /auth/me
    if (user.role != 'gate_staff') {
      await authService.logout()
      state = unauthenticated (permission denied)
    } else {
      state = authenticated
    }
  } catch (e) {
    if (e.isNetworkError) {
      // Mạng down, token vẫn còn — cho phép offline mode
      state = authenticated  (degraded)
      // KHÔNG xoá token
      // User model = null → UI hiển thị limited info
    } else {
      // 401, 403, parse error → session thực sự invalid
      await authService.logout()
      state = unauthenticated
    }
  }
}
```

**Network error detection:**
```dart
bool _isNetworkError(Object e) {
  if (e is ApiException) return e.isNetworkError;
  if (e is DioException) {
    return e.type == DioExceptionType.connectionTimeout ||
           e.type == DioExceptionType.receiveTimeout ||
           e.type == DioExceptionType.connectionError;
  }
  return false;
}
```

**Degraded mode behavior:**
- `AuthState.authenticated` vẫn được set → app không redirect về login
- Mobile khôi phục `cachedUser` đã từng được xác thực hợp lệ để vẫn giữ role/user context khi offline
- Khi mạng phục hồi và user navigate, app re-call `checkAuthStatus` để verify lại

**`AuthService.getStoredToken()`:** Method mới, đọc token từ `flutter_secure_storage` mà không gọi API. Dùng để phân biệt "chưa login bao giờ" vs "login rồi nhưng network down".

---

## 3. Sync Concurrency Guard & Preload Merge Integrity

### 3.1 Concurrent sync guard

**Vấn đề:** `_startInAppBackgroundSync` trong `CheckinService` subscribe connectivity stream. Khi network flapping (offline→online→offline→online nhanh), nhiều `syncAllOfflineLogs` calls chạy đồng thời.

**Fix — mutex flag:**
```dart
bool _isSyncing = false;

Future<void> syncAllOfflineLogs(String concertId) async {
  if (_isSyncing) return;  // guard
  _isSyncing = true;
  try {
    await _syncOfflineLogs(concertId);
  } catch (e) {
    debugPrint('[CheckinService] sync error: $e'); // không swallow
    rethrow; // caller (manual sync) có thể handle
  } finally {
    _isSyncing = false; // luôn reset dù crash
  }
}
```

**Background sync error handling:**
```dart
// Trong _startInAppBackgroundSync
_connectivitySubscription = Connectivity().onConnectivityChanged.listen((result) async {
  final isOnline = result != ConnectivityResult.none;
  if (isOnline && concertId != null) {
    try {
      await syncAllOfflineLogs(concertId!);
    } catch (e) {
      debugPrint('[BackgroundSync] failed: $e'); // log but don't crash
    }
  }
});
```

**Manual sync error propagation:**
`_manualSync()` trong `ScannerScreen` phải handle error và hiển thị SnackBar dùng `GateColors` token thay vì `Colors.red/green`.

### 3.2 Preload UPSERT strategy

**Vấn đề:** Delete-all-then-insert không bám đúng semantics snapshot của backend và có thể làm local cache lệch với danh sách entry currently-valid trên server.

**Strategy mới — Safe UPSERT:**

```
preloadCheckinData(concertId) {
  1. Fetch data từ API
  2. Validate: data không được rỗng (throw nếu không có entry nào)
  3. Transaction {
       // Bước A: Xoá entries CHƯA checked_in của concert này
       DELETE FROM checkin_entries
         WHERE concert_id = ? AND checkin_status != 'checked_in'
       
       // Bước B: Insert/Update từ server data
       batch INSERT OR REPLACE INTO checkin_entries (...)
       
       // Bước C: Update entries ĐÃ checked_in offline bằng server data mới
       // (preserve checkin_status = 'checked_in', chỉ update metadata)
       FOR EACH entry IN serverData WHERE entry.id IN localCheckedInIds:
         UPDATE checkin_entries SET zone_id = ?, entry_type = ?, updated_at = ?
           WHERE id = ? AND checkin_status = 'checked_in'
     }
}
```

**Preserve offline checked-in state:**
- Entries với `checkin_status = 'checked_in'` LOCAL không bị xoá
- Các row local không còn xuất hiện trong snapshot server sẽ bị prune nếu chúng chưa `checked_in`
- Nếu server trả entry cùng `id` nhưng với `checkin_status = 'not_checked_in'`, local state `checked_in` thắng — tránh "reopen ticket" bug
- `pendingOfflineScans` map (đã có trong code hiện tại) vẫn được merge vào sau transaction

**Validate server payload trước khi xoá:**
```dart
if (allEntries.isEmpty) {
  throw Exception('Server returned empty checkin data for concert $concertId');
}
```

---

## 4. Event Selection Invalidation

### 4.1 Vấn đề

`ConcertProvider.fetchConcerts()` update `_concerts` list nhưng không check xem `_selectedConcert` có còn trong list mới không. Nếu concert bị remove khỏi server giữa chừng, user vẫn có thể bấm "Xác nhận" với concert stale.

### 4.2 Fix

```dart
Future<void> fetchConcerts() async {
  // ... fetch logic ...
  _concerts = newConcerts;
  
  // Invalidate stale selection
  if (_selectedConcert != null) {
    final stillExists = _concerts.any((c) => c.id == _selectedConcert!.id);
    if (!stillExists) {
      _selectedConcert = null;
    }
  }
  notifyListeners();
}
```

Không cần thêm UI feedback đặc biệt — selection bị clear tự nhiên hiển thị button "Chọn một sự kiện để tiếp tục" (disabled state đã có).

---

## 5. Error/Result Normalization cho Scan Outcome

### 5.1 Chuẩn hóa `processScan` return value

`CheckinService.processScan` trả `Map<String, dynamic>` với nhiều key khác nhau. `ScannerScreen` pattern-match trên nhiều điều kiện (`status == 'VALID' || status == 'CHECKED_IN' || result['success'] == true`). Đây là fragile.

**Normalized `ScanOutcome` model:**
```dart
// lib/features/checkin/models/scan_outcome.dart
enum ScanStatus { valid, alreadyUsed, notFound, error }

class ScanOutcome {
  final ScanStatus status;
  final String title;      // HỢP LỆ / VÉ ĐÃ SỬ DỤNG / ...
  final String message;    // Chi tiết: zone, scan time, ...
  final bool isOffline;    // true nếu kết quả từ local DB
  
  const ScanOutcome({
    required this.status,
    required this.title,
    required this.message,
    required this.isOffline,
  });
  
  factory ScanOutcome.fromServiceResult(Map<String, dynamic> result) {
    final rawStatus = result['status'] as String? ?? '';
    final isOffline = result['offline'] == true;
    
    final status = switch (rawStatus) {
      'VALID' || 'CHECKED_IN' => ScanStatus.valid,
      'ALREADY_USED'          => ScanStatus.alreadyUsed,
      'NOT_FOUND'             => ScanStatus.notFound,
      _                       => ScanStatus.error,
    };
    // ... map title/message theo status
  }
}
```

`ScanResultPanel` nhận `ScanOutcome` thay vì raw `Map` — type-safe, dễ test.

`CheckinService.processScan` không cần thay đổi signature (vẫn return `Map`) — chỉ thêm `ScanOutcome.fromServiceResult(result)` tại caller layer (`ScannerScreen`).

---

## 6. Test Architecture

### Unit tests — `CheckinService`

`CheckinService` phụ thuộc vào `DatabaseHelper` (sqflite) và `DioClient`. Cả hai cần được mock.

**Strategy:** Tạo interface/abstract class cho `DatabaseHelper` hoặc dùng `sqflite_common_ffi` cho in-memory DB trong tests. Dùng `MockDioClient` extend `DioClient` override `get/post`.

### Widget tests — `ScanResultPanel`

Widget độc lập không phụ thuộc camera — pump với `ScanOutcome` mock data:
```dart
await tester.pumpWidget(
  _wrap(ScanResultPanel(
    result: {'status': 'VALID', 'message': 'Zone A', 'offline': false},
    onClose: () => closeCalled = true,
  )),
);
```

### Widget tests — `ScannerScreen`

Mock `CheckinProvider` + `ConcertProvider`. Test:
- AppBar hiển thị `NetworkStatusBadge`
- Sync button trigger `_manualSync`
- `_currentResult` state → `ScanResultPanel` visible/invisible
