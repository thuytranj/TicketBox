# Tasks: Mobile Scanner UX Redesign

## Phase 1 — Database & Service Helper

- [x] 1. **Cập nhật `CheckinService`**:
  - Thêm phương thức `Future<int> getPendingLogCount(String concertId)` thực thi câu lệnh:
    `SELECT COUNT(*) FROM offline_checkin_logs WHERE concert_id = ? AND upload_status = 'pending'`.

## Phase 2 — ScanResultPanel Widget

- [x] 2. **Tạo `lib/features/checkin/widgets/scan_result_panel.dart`**:
  - Khai báo class `ScanResultPanel` nhận props:
    - `outcome: ScanOutcome` (presentation model đã normalize từ kết quả trả về của `checkinService.processScan`).
    - `onClose: VoidCallback` (kết thúc hiển thị panel và mở khóa camera).
  - Tự động thiết lập một `Timer` đếm ngược tự đóng:
    - Nếu trạng thái là `ScanStatus.valid`: tự đóng sau `1.5 giây`.
    - Nếu trạng thái là `ScanStatus.alreadyUsed`, `ScanStatus.notFound`, hoặc `ScanStatus.error`: tự đóng sau `2.5 giây`.
  - Hỗ trợ tap vào panel (`GestureDetector`) để đóng ngay lập tức (`onClose` trigger và hủy Timer).
  - Sử dụng các tokens màu sắc từ `GateColors` và font từ `GateTypography` để paint giao diện tương phản cao cho 4 status tương ứng.
  - Sử dụng các container và icons lớn để nhân viên dễ dàng nhận diện từ khoảng cách xa.

## Phase 3 — ScannerScreen Redesign

- [x] 3. **Cập nhật State & Lifecycle của `ScannerScreen`**:
  - Quản lý trạng thái kết nối mạng (`_isOnline`) bằng cách lắng nghe stream `Connectivity().onConnectivityChanged`.
  - Quản lý số lượng pending sync (`_pendingCount`) bằng cách refresh khi màn hình khởi tạo, sau khi panel đóng, và sau các lần sync/manual refresh.
  - Thêm flag `_isSyncing` hiển thị trạng thái xoay nút sync thủ công trên AppBar.
  - Thêm property `ScanOutcome? _currentOutcome` lưu kết quả quét hiện tại để truyền cho `ScanResultPanel`.

- [x] 4. **Xây dựng Camera Scan Frame & Laser Line Overlay**:
  - Trong stack body của `ScannerScreen`, vẽ một lớp overlay định vị camera ở giữa màn hình (kích thước 250x250).
  - Thêm laser animation quét dọc chạy lên xuống liên tục bên trong khung ngắm sử dụng `AnimationController`.

- [x] 5. **Tích hợp `ScanResultPanel`**:
  - Khi `_currentOutcome != null`, hiển thị `ScanResultPanel` đặt ở phía dưới cùng (`Positioned(bottom: 24, left: 16, right: 16)`).
  - Khi panel đóng (`onClose`), gán `_currentOutcome = null` và đồng thời cho phép tiếp tục quét mã QR mới (`_isProcessing = false`).

- [x] 6. **Cải tiến AppBar & Trạng thái Sync**:
  - Sử dụng `GateScaffold` với `title: 'Quét vé - {concert.title}'`.
  - Truyền `showNetworkStatus: true`, `isOnline: _isOnline`, `pendingCount: _pendingCount` vào `GateScaffold`.
  - Thêm nút manual sync trong actions AppBar: nếu `_isSyncing` là true hiển thị spinner xoay nhỏ, ngược lại hiển thị nút sync icon.
  - Nút bật/tắt flash nếu cần thiết (không bắt buộc, tùy hỗ trợ).

## Phase 4 — Widget Tests

- [x] 7. **Tạo `test/features/checkin/scan_result_panel_test.dart`**:
  - Viết widget tests kiểm tra `ScanResultPanel` độc lập:
    - Case 1: Hiển thị đúng text và icon trạng thái VALID (HỢP LỆ) trên nền xanh.
    - Case 2: Hiển thị đúng text và icon trạng thái ALREADY_USED (ĐÃ SỬ DỤNG) trên nền cam.
    - Case 3: Hiển thị đúng text và icon trạng thái NOT_FOUND (KHÔNG TỒN TẠI) trên nền đỏ.
    - Case 4: Hiển thị đúng text và icon trạng thái ERROR trên nền xám.
    - Case 5: Tự động gọi `onClose` sau 1.5 giây cho trạng thái VALID.
    - Case 6: Tự động gọi `onClose` sau 2.5 giây cho trạng thái lỗi.
    - Case 7: Tap vào panel đóng ngay lập tức.

- [x] 8. **Tạo `test/features/checkin/scanner_screen_test.dart`**:
  - Viết widget tests kiểm tra `ScannerScreen` sử dụng fake `CheckinService` và fake scanner preview.
  - Đảm bảo hiển thị đúng AppBar với thông số pendingCount.
  - Test luồng nhấn nút manual sync chạy đồng bộ và hiển thị loading indicator.

## Phase 5 — Quality

- [x] 9. **Kiểm tra linter và chạy tests**:
  - Cập nhật docs/tests để scanner contract không còn lệch với implementation shipped.
  - Chạy `flutter analyze` và `flutter test` khi môi trường CI/local cho phép.
