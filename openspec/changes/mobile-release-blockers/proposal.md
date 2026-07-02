# Proposal: Mobile Release Blockers

## What

Fix các vấn đề blocking được phát hiện trong audit hậu-redesign của `src/mobile` Gate App. Đây là những lỗi, risk, và thiếu sót có thể gây ra sự cố vận hành thực tế tại cổng soát vé. Không có feature mới. Mọi thay đổi đều có bằng chứng cụ thể từ audit report.

Năm nhóm vấn đề cần giải quyết:

1. **ScannerScreen** — màn hình chính của app không implement đúng spec đã sign-off: modal bottom sheet chặn camera, raw `Colors.*`, không có network cue, không có processing lifecycle đúng.
2. **Auth restore** — `checkAuthStatus` đá user về login khi mất mạng cold-start, không phân biệt network failure với invalid session.
3. **Sync/Preload integrity** — `syncOfflineLogs` có race condition concurrent calls; `preloadCheckinData` dùng delete-all-then-insert có thể xoá offline cache hợp lệ khi payload server thiếu.
4. **Event selection staleness** — refresh danh sách concert không invalidate selection nếu concert đó không còn trong list mới.
5. **Tests và docs** — `CheckinService` và `ScannerScreen` không có test nào; README claim "82 tests" nhưng scanner flow hoàn toàn không được cover.

## Why

### Blocking issues

| # | Issue | Evidence | Impact |
|---|-------|----------|--------|
| B1 | `showModalBottomSheet(backgroundColor: Colors.white)` trên dark app | `scanner_screen.dart:98-100` | Bottom sheet nền trắng, vỡ toàn bộ dark theme |
| B2 | Không có auto-dismiss — staff phải bấm nút sau mỗi lần quét | `scanner_screen.dart:127-130` | Tốc độ soát vé giảm ~50%, không thể dùng một tay |
| B3 | `checkAuthStatus` throw về `unauthenticated` khi mất mạng cold-start | `auth_provider.dart:42-44` | Staff bị đăng xuất chỉ vì mất sóng trước khi mở app |
| B4 | `syncAllOfflineLogs` gọi từ connectivity stream, không có mutex → concurrent sync | `checkin_service.dart:25-32` | Network flapping → duplicate API calls, có thể double-count log |
| B5 | `preloadCheckinData` delete toàn bộ entries trước khi insert lại | `checkin_service.dart:109-113` | Nếu API trả thiếu data, offline cache bị mất → reject vé hợp lệ |
| B6 | `CheckinService`, `ScannerScreen` zero test coverage | `test/` directory | Bugs trong critical path không có regression protection |

### Vì sao phải fix trước release

Gate App hoạt động ở môi trường áp lực cao (>1000 người/giờ, ánh sáng hỗn hợp, mạng không ổn định). Mỗi bug trên có thể gây:
- Nhân sự reject vé hợp lệ (mất uy tín, conflict với khán giả)
- Staff bị đăng xuất khi mất mạng (phải login lại ở cổng, delay queue)
- Offline scan logs bị gửi trùng (data integrity)

## Non-Goals

- **Không thay đổi backend contract**: API endpoints, request/response schema giữ nguyên.
- **Không thay đổi `mobile_scanner` library**: Chỉ wrap usage, không fork.
- **Không redesign các màn hình đã đạt spec**: `LoginScreen`, `EventListScreen`, `PreloadScreen` đã có tests và pass audit — không đụng đến layout/UX của chúng.
- **Không thêm feature mới**: Flash toggle, zoom slider, barcode overlay, multi-camera không thuộc scope này.
- **Không thêm `Concert.date` hay `User.name` field**: Thuộc backend contract change, defer sang sau.
- **Không migrate offline database schema**: `DatabaseHelper.onUpgrade` là nice-to-have, không blocking.
- **Không mở rộng sang backend/frontend**: Chỉ `src/mobile`.

## Risks

| Risk | Khả năng | Mức độ | Mitigation |
|------|----------|--------|------------|
| Thay chiến lược preload từ delete-all sang UPSERT có thể để lại stale entries của concert cũ | Thấp | Trung bình | Vẫn xoá entries của concert khác (filter by `concert_id`); chỉ tránh xoá entries của chính concert đang preload khi payload thiếu |
| Auth restore degraded mode có thể cho phép session quá hạn tiếp tục hoạt động | Thấp | Cao | Chỉ cho phép degraded mode khi lỗi là network error (`isNetworkError == true`); session xác thực thực sự luôn bị reject |
| `MobileScannerController` dispose sai lifecycle gây crash trên một số device | Trung bình | Cao | Test trên emulator trước; tham chiếu mobile_scanner example code; dispose trong `deactivate()` thay vì chỉ `dispose()` |
| Concurrent sync mutex (flag `_isSyncing`) có thể chặn sync hợp lệ nếu previous sync crash | Thấp | Trung bình | Wrap trong try/finally để đảm bảo flag luôn được reset |

## Definition of Done

**ScannerScreen:**
- [ ] Không còn `showModalBottomSheet` trong scanner flow
- [ ] `ScanResultPanel` widget hiển thị kết quả inline, auto-dismiss 1.5s (VALID) / 2.5s (khác)
- [ ] Camera processing lock đúng: camera dừng nhận input trong khi đang process, unlock sau khi panel dismiss
- [ ] `MobileScannerController` khởi tạo và dispose đúng lifecycle
- [ ] AppBar dùng `GateScaffold(showNetworkStatus: true)`
- [ ] Không còn `Colors.green/red/orange/white` trong `scanner_screen.dart`
- [ ] `flutter analyze` 0 issue trên scanner files

**Auth Restore:**
- [ ] `checkAuthStatus` phân biệt network error vs auth error
- [ ] Khi cold-start offline với valid local session → hiển thị degraded offline mode, không redirect về login
- [ ] Khi cold-start offline không có local session → redirect về login (đúng behavior)

**Sync/Preload Integrity:**
- [ ] `syncAllOfflineLogs` có mutex flag `_isSyncing`, không chạy concurrent
- [ ] Sync errors được log/propagate, không silent fail với `catch (_) {}`
- [ ] `preloadCheckinData` dùng UPSERT strategy: không xoá entries đang `checked_in`
- [ ] Pending offline logs được merge vào preload result đúng (đã có, giữ nguyên)

**Event Selection:**
- [ ] `fetchConcerts` invalidate `selectedConcert` nếu concert id không còn trong list mới

**Tests & Docs:**
- [ ] >= 5 widget tests cho `ScanResultPanel` (4 states + auto-dismiss)
- [ ] >= 3 unit tests cho `CheckinService.processScan` (online success, offline fallback, not found)
- [ ] >= 2 unit tests cho `CheckinService.syncOfflineLogs` (success path, concurrent guard)
- [ ] >= 2 unit tests cho auth restore (network fail path, invalid session path)
- [ ] README test count claim được cập nhật đúng với số test thực tế
- [ ] `flutter test` 100% pass
