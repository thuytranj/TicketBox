# Proposal: Mobile Polish & QA

## What
Thực hiện một chiến dịch rà soát tổng thể (Polish & QA) đối với ứng dụng di động TicketBox Gate App (`src/mobile`) nhằm tối ưu hóa tính đồng bộ thị giác (visual consistency), đảm bảo khả năng tiếp cận (accessibility), chuẩn hóa ngôn ngữ (Vietnamese copywriting), ổn định hóa bộ test suites, và cập nhật tài liệu phát triển ứng dụng di động (`src/mobile/README.md`) theo chuẩn vận hành offline-first mới.

## Why
Sau các thay đổi thiết kế nền tảng ở các phase trước:
1. **Visual Alignment:** Một số khoảng cách (spacing), kích cỡ chữ, hoặc độ tương phản (contrast) ở các màn hình có thể cần căn chỉnh tinh tế (micro-adjustments) để hoàn toàn tương thích với dark/high-contrast ops-look.
2. **Vietnamese Copywriting Consistency:** Cần kiểm tra lại các thông báo lỗi, nhãn buttons, caption hướng dẫn để đảm bảo ngôn ngữ thuần Việt, rõ ràng, mang văn phong vận hành chuyên nghiệp (tránh dịch máy nửa Anh nửa Việt).
3. **Accessibility (Khả năng tiếp cận):** Đảm bảo các tap targets đạt tối thiểu 48dp, các nhãn Semantics được gán đầy đủ trên các widget tương tác cốt lõi.
4. **README Lỗi thời:** File `README.md` của ứng dụng mobile hiện tại rất sơ sài, chưa cập nhật về cơ chế hoạt động offline-first, kiến trúc SQLite + Connectivity, cách sử dụng hệ thống Design Tokens mới, và cách chạy/test app một cách chuẩn chỉ.

## Scope
**Trong scope:**
- `src/mobile/README.md`: Viết lại toàn bộ với nội dung tài liệu kỹ thuật đầy đủ: Giới thiệu TicketBox Gate App, hướng dẫn setup môi trường phát triển chi tiết, sơ đồ kiến trúc dữ liệu offline-first, hướng dẫn sử dụng Design Tokens System (`GateAppTheme`), và hướng dẫn chạy kiểm thử.
- Visual Audit và sửa đổi nhỏ (nếu cần) tại các file:
  - `lib/features/auth/screens/login_screen.dart`
  - `lib/features/concerts/screens/event_list_screen.dart`
  - `lib/features/checkin/screens/preload_screen.dart`
  - Các shared widgets trong `lib/shared/widgets/`
- Tối ưu hóa copywriting và tap targets.
- Ổn định hóa bộ tests, đảm bảo `flutter analyze` và `flutter test` sạch 100%.

**Ngoài scope (non-goals):**
- Không viết thêm tính năng business logic mới.
- Không thay đổi backend API contracts.
- Không thay đổi schema SQLite database.

## Definition of Done
- [ ] File `src/mobile/README.md` được cập nhật đầy đủ, rõ ràng và chuyên nghiệp.
- [ ] Tất cả copywriting tiếng Việt trên UI thống nhất và không bị dịch lỗi.
- [ ] Tất cả tap targets tương tác chính đạt tối thiểu 48dp (chiều cao/rộng).
- [ ] Bộ test suites chạy pass 100% không bị flaky test.
- [ ] `flutter analyze lib/ test/` trả về kết quả `No issues found!`.
