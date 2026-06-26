# Tasks: Mobile App Implementation

- [ ] 1. **Khởi tạo project Flutter**: Chạy `flutter create ticketbox_mobile`, dọn dẹp code mặc định, cấu hình các thư mục kiến trúc cơ bản (screens, models, services, core).
- [ ] 2. **Xây dựng UI Cơ bản**: Tạo Màn hình Đăng nhập (LoginScreen) và Màn hình Chọn sự kiện (EventListScreen).
- [ ] 3. **Tích hợp Local DB**: Cài đặt thư viện Database (`sqflite` hoặc `isar`), tạo schema cho entity `Ticket` và viết các hàm CRUD (lưu danh sách vé tải về, cập nhật trạng thái `is_checked_in`, truy vấn vé chưa đồng bộ).
- [ ] 4. **Tích hợp module Crypto**: Cài đặt thư viện giải mã chữ ký số, viết module `CryptoService` để nạp Public Key và hàm verify chữ ký lấy từ mã QR.
- [ ] 5. **Tích hợp Camera quét QR**: Cài đặt và cấu hình thư viện `mobile_scanner`, thiết kế giao diện Màn hình quét (ScannerScreen).
- [ ] 6. **Kết nối Logic Offline Check-in**: Ghép nối Camera, Crypto và DB. Khi quét chuỗi QR -> Gọi hàm giải mã -> Nếu thành công gọi update DB -> Hiện Popup Trạng thái Xanh/Đỏ tương ứng.
- [ ] 7. **Tích hợp Background Sync**: Cài đặt `workmanager` và `connectivity_plus`, viết hàm Background Worker chạy ngầm để quét các vé có `sync_status == pending`.
- [ ] 8. **Tích hợp Đồng bộ API Checkin**: Hoàn thiện Worker để đóng gói các vé và gửi HTTP POST lên API Check-in với body JSON chứa `concertId` và danh sách `offlineLogs` (`qrCodeHash`, `deviceId`, `scanTime`). Cập nhật DB khi thành công.
