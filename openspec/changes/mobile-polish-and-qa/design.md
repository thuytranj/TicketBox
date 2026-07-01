# Design: Mobile Polish & QA

## 1. Quality & Design Standards Audit Guidelines

Mục tiêu chính của phase này là tinh chỉnh các chi tiết nhỏ để Gate App đạt mức độ hoàn thiện cao nhất khi hoạt động trong môi trường vận hành cổng soát vé đầy áp lực.

### Vietnamese Copywriting Standard

Thống nhất quy chuẩn viết hoa và thuật ngữ tiếng Việt trong toàn app:
- **Buttons / CTAs:** Chỉ viết hoa chữ cái đầu tiên của từ đầu tiên (Sentence case), ví dụ: "Đăng nhập" thay vì "Đăng Nhập", "Thử lại" thay vì "Thử Lại", "Vào màn hình quét vé" thay vì "Vào màn hình Quét vé".
- **Thông báo lỗi (Sanitized Errors):**
  - Ngắn gọn, không dùng từ ngữ kỹ thuật (raw exception text).
  - Phải chứa hành động gợi ý khắc phục (ví dụ: "Kiểm tra kết nối mạng và thử lại").
- **Nhãn trạng thái (Status labels):**
  - Sử dụng chữ hoa hoàn toàn cho các chip trạng thái để tăng khả năng nhận biết nhanh: `HỢP LỆ`, `ĐÃ DÙNG`, `KHÔNG TỒN TẠI`, `LỖI`.
  - Sử dụng badge `ONLINE` (xanh) và `OFFLINE` (cam) đồng nhất.

### Accessibility (A11y) & Interactive Targets

- **Tap Targets Size**: Đảm bảo tất cả các widget có thể nhấn (IconButton, GestureDetectors, Buttons) đều có kích thước tương tác tối thiểu `48dp x 48dp` (theo khuyến nghị Material Design và iOS Human Interface Guidelines) để tránh nhấn trượt khi staff đang di chuyển hoặc thao tác nhanh bằng một tay.
- **IconButton Hitboxes**: Bọc các `IconButton` nhỏ hoặc thêm padding/visual bounds để hitbox đạt chuẩn.
- **Semantics**: Gắn thẻ `Semantics` label rõ ràng trên các custom widget như `EventCard`, `StatusChip` và `NetworkStatusBadge` để người khiếm thị có thể sử dụng màn hình đọc một cách dễ dàng.

---

## 2. Updated README.md Structure

Tài liệu `src/mobile/README.md` mới sẽ được cấu trúc lại một cách khoa học để làm cẩm nang cho bất kỳ lập trình viên nào gia nhập dự án:

### Sơ đồ cấu trúc README mới

1. **Tổng quan dự án (Project Overview):**
   - Giới thiệu TicketBox Gate App — ứng dụng soát vé offline-first chuyên dụng dành cho nhân viên soát vé (Gate Staff).
2. **Setup môi trường (Getting Started):**
   - Cài đặt Flutter SDK, môi trường Android/iOS.
   - Hướng dẫn ADB reverse port forwarding (`adb reverse tcp:3000 tcp:3000`) để kết nối thiết bị Android thật với localhost backend.
3. **Cấu hình & Cách chạy App:**
   - Hướng dẫn chi tiết cách run app thông qua CLI hoặc IDE (VSCode / Android Studio configuration) bằng cách truyền các biến môi trường:
     `--dart-define=API_BASE_URL=http://127.0.0.1:3000/api/v1`
4. **Kiến trúc Offline-First (Offline-First Architecture):**
   - Sơ đồ luồng hoạt động khi có mạng và mất mạng.
   - Mô tả SQLite Database local helper (`checkin_entries`, `offline_checkin_logs`).
   - Cơ chế tự động đồng bộ hóa trong nền (Connectivity background sync stream) khi thiết bị kết nối mạng trở lại.
5. **Quy tắc sử dụng Design System (Design System Guide):**
   - Giới thiệu hệ thống token từ `GateAppTheme`.
   - Các quy tắc bắt buộc:
     - Không sử dụng màu sắc thô (`Colors.xyz` hoặc `Color(0xFF...)`).
     - Luôn sử dụng `GateColors.primary`, `GateColors.surface`, v.v.
     - Sử dụng `GateSpacing` cho padding và SizedBox, `GateRadii` cho bo góc, và `GateTypography` cho Text Style.
6. **Kiểm thử tự động (Testing):**
   - Cách chạy phân tích tĩnh: `flutter analyze`
   - Cách chạy bộ tests: `flutter test`
