# Tasks: Mobile Preload & Sync UX

## Phase 1 — Database & Provider Extensions

- [x] 1. **Cập nhật `CheckinService`**:
  - Thêm phương thức `Future<int> getTicketCount(String concertId)` thực hiện câu truy vấn `SELECT COUNT(*) FROM checkin_entries WHERE concert_id = ? AND entry_type = 'ticket'`.
  - Thêm phương thức `Future<int> getVipCount(String concertId)` thực hiện câu truy vấn `SELECT COUNT(*) FROM checkin_entries WHERE concert_id = ? AND entry_type = 'vip_guest'`.
  - Cập nhật `preloadCheckinData` để chấp nhận callback `onStepChanged` và kích hoạt báo cáo trạng thái `downloading` và `saving`.
  
- [x] 2. **Cập nhật `CheckinProvider`**:
  - Khai báo enum `PreloadStep { initial, connecting, downloading, saving, completed }`.
  - Thêm các fields: `PreloadStep _currentStep`, `int _ticketCount`, `int _vipCount`.
  - Thêm getters tương ứng: `currentStep`, `ticketCount`, `vipCount`.
  - Trong phương thức `preloadData(String concertId)`:
    - Cập nhật logic để cập nhật step `connecting` -> `downloading` -> `saving` -> `completed` / `error`.
    - Gọi API và SQLite xong thì query số lượng vé thường & VIP để gán vào `_ticketCount` và `_vipCount`.
    - Bảo toàn trạng thái step lỗi để UI hiển thị chính xác step bị fail.
  - Bổ sung phương thức `reset()`.

## Phase 2 — PreloadScreen UI Redesign

- [x] 3. **Migrate `PreloadScreen` sang `GateScaffold`**:
  - Sử dụng `GateScaffold` thay thế Scaffold cũ.
  - Cấu hình title: 'Đồng bộ Check-in'.

- [x] 4. **Xây dựng Event Card widget trong PreloadScreen**:
  - Dựng card hiển thị thông tin concert bằng `GateCard`.

- [x] 5. **Xây dựng Progress Indicators cho từng Step**:
  - Dựng list 3 step: Kết nối máy chủ, Tải danh sách vé, Thiết lập lưu trữ offline.
  - Sử dụng `AnimationController` xoay icon sync cho step đang hoạt động.
  - Đánh dấu thành công bằng icon check xanh (`GateColors.networkOnline`), lỗi bằng icon cảnh báo đỏ (`GateColors.scanInvalid.primary`), chờ bằng radio button rỗng.

- [x] 6. **Xây dựng Offline Summary Card**:
  - Hiển thị card thống kê chi tiết khi thành công: tổng số vé thường (`ticketCount`), VIP guests (`vipCount`), badge "SẴN SÀNG" xanh lá cây và thông tin thiết bị sẵn sàng offline.

- [x] 7. **Xây dựng Bottom Action Bar cho PreloadScreen**:
  - Đưa `GateButton` vào `bottomBar` của `GateScaffold`.
  - Trạng thái loading: text "Đang tải dữ liệu...", disabled.
  - Trạng thái error: text "Thử Lại", trigger preloadData.
  - Trạng thái success: text "Vào màn hình Quét vé", navigation pushReplacement tới `ScannerScreen`.

## Phase 3 — Widget Tests & Quality

- [x] 8. **Tạo `test/features/checkin/preload_screen_test.dart`**:
  - Widget tests kiểm thử 6 test cases bao gồm:
    - Hiển thị thông tin concert chính xác.
    - Cập nhật đúng biểu tượng & màu sắc khi đang ở các step connecting, downloading, saving.
    - Hiển thị đầy đủ database summary card & badge "SẴN SÀNG" khi đồng bộ thành công.
    - Hiển thị giải thích lỗi thân thiện & nút "Thử lại" kích hoạt preloadData khi xảy ra lỗi.

- [x] 9. **Kiểm tra Quality**:
  - Chạy `flutter analyze` cho dự án: 0 lỗi biên dịch, 0 lints.
  - Chạy `flutter test`: 82/82 tests pass thành công (bao gồm 6 tests mới của PreloadScreen).
