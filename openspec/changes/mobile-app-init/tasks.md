# Tasks: Mobile App Implementation

- [x] 1. **Khởi tạo project Flutter**: Chạy `flutter create ticketbox_mobile`, dọn code mặc định, cấu hình `API_BASE_URL`, cấu trúc thư mục `core`, `features`, `data`, `services`.
- [x] 2. **Tích hợp Auth backend**: Kết nối `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`, lưu token và chặn người dùng không có role `gate_staff` hoặc `organizer`.
- [x] 3. **Xây dựng UI cơ bản**: Tạo `LoginScreen`, `EventListScreen`, `ScannerScreen` và state xử lý loading/error theo response envelope của backend.
- [x] 4. **Tải danh sách sự kiện**: Kết nối `GET /concerts`, parse danh sách tại `body.data.concerts`, gom đủ các trang `active` concerts, và cho phép chọn concert trước khi preload dữ liệu check-in.
- [x] 5. **Thiết kế Local DB**: Tạo 2 bảng `checkin_entries` và `offline_checkin_logs`, hỗ trợ lưu `tickets`, `vipGuests`, và hàng đợi upload offline.
- [x] 6. **Preload dữ liệu check-in**: Gọi `GET /checkin/data?concertId=...`, map `tickets` + `vipGuests` vào local DB, lưu `zoneId` nếu có và bỏ giả định cần verify HMAC trong app.
- [x] 7. **Tích hợp Camera quét QR**: Cài `mobile_scanner`, lấy raw QR string và dùng trực tiếp làm `qrCodeHash` để tra cứu local hoặc gửi lên backend.
- [x] 8. **Tích hợp Online Scan**: Khi có mạng, gọi `POST /checkin/scan`, parse payload tại `body.data.data`, cập nhật local status và hiển thị kết quả hợp lệ/trùng/không tồn tại bằng machine-readable duplicate code.
- [x] 9. **Tích hợp Offline Fallback + Sync**: Khi mất mạng, update local entry sang `checked_in`, tạo log `pending`; sau đó worker gửi `POST /checkin/sync` theo `concertId + offlineLogs` và khi nhận `202` thì đánh dấu log là `uploaded` thay vì coi là kết quả đối soát cuối cùng.
