# Tasks: Mobile Polish & QA

## Phase 1 — Copywriting & Polish Audit

- [x] 1. **Chuẩn hóa chữ hoa / thường trên Buttons**:
  - Đã rà soát tất cả các nhãn buttons trong app và đổi sang Sentence case: "Đăng nhập", "Thử lại", "Tiếp tục", "Vào màn hình quét vé", "Xác nhận: ...".
  - Sửa đổi đồng bộ trong `login_screen.dart`, `event_list_screen.dart`, `preload_screen.dart`, và các shared widgets (`gate_button.dart`, `gate_error_state.dart`).

- [x] 2. **Rà soát Tap Target Accessibility**:
  - Đã kiểm tra và đảm bảo tất cả các button (như các IconButton đăng xuất trên AppBar) có diện tích bấm tối thiểu 48x48dp. Tất cả các interactive elements đạt chuẩn Material Design.

## Phase 2 — README.md Update

- [x] 3. **Viết lại `src/mobile/README.md`**:
  - Đã viết lại toàn bộ cẩm nang phát triển `src/mobile/README.md` gồm các phần:
    - Tổng quan dự án Gate App soát vé offline-first.
    - Hướng dẫn setup backend và ADB reverse tcp port forwarding.
    - Hướng dẫn truyền biến môi trường `--dart-define=API_BASE_URL=...` khi khởi chạy app.
    - Sơ đồ & mô tả kiến trúc Offline-First (SQLite database caching + Connectivity auto-background sync).
    - Hướng dẫn chi tiết cách áp dụng các design tokens từ `GateAppTheme` (Colors, Spacing, Radii, Typography).
    - Lệnh chạy kiểm thử tự động.

## Phase 3 — QA & Verification

- [x] 4. **Chạy phân tích tĩnh**:
  - Đã chạy `flutter analyze` cho dự án: 0 lỗi biên dịch, 0 lints.

- [x] 5. **Chạy toàn bộ Suite Tests**:
  - Đã cập nhật các file tests tương ứng để khớp các asserts mới và chạy `flutter test` thành công: 82/82 tests pass 100%.
