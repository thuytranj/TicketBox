# Design: Mobile App Offline Check-in Architecture

## Architecture Overview
Ứng dụng sẽ đi theo kiến trúc **Offline-First**, chia thành các layer chính:
1. **UI Layer**: Giao diện quét mã QR nhanh (dùng `mobile_scanner`).
2. **Data Layer (Local)**: Sử dụng `sqflite` hoặc `isar` do hiệu năng đọc/ghi cao và dễ dàng lưu trữ số lượng vé lớn.
3. **Crypto Layer**: Thư viện `pointycastle` hoặc `encrypt` sẽ đảm nhận vai trò verify chữ ký số của vé ngoại tuyến dựa trên Public Key được cấp từ Server.
4. **Sync Layer**: Chạy ngầm (`workmanager`) kết hợp phát hiện mạng (`connectivity_plus`) để gửi các chunk data lên hàng đợi RabbitMQ (thông qua API Proxy hoặc trực tiếp qua giao thức AMQP).

## Data Models
**Ticket Entity (Local DB)**
- `ticket_id`: String (Primary Key)
- `event_id`: String
- `guest_name`: String
- `ticket_type`: String
- `is_checked_in`: Boolean (default: false)
- `check_in_time`: DateTime (nullable)
- `sync_status`: String (pending / synced)
- `qr_code_hash`: String (lưu lại mã hash để đồng bộ lên server)
- `signature`: String

## Verification Flow (Offline)
1. Camera quét mã QR.
2. Tách chuỗi dữ liệu trong QR (ví dụ định dạng được mã hoá hoặc chuỗi JSON kèm signature).
3. Sử dụng Public Key (được nhúng sẵn hoặc tải về khi đăng nhập thành công) để xác thực (Verify Signature).
4. Nếu hợp lệ: Cập nhật `is_checked_in = true` và `check_in_time = DateTime.now()` vào Local DB.
5. Hiển thị UI thành công.
6. Thêm bản ghi check-in vào hàng đợi đồng bộ nội bộ (`sync_status = pending`).

## Background Sync Flow
1. OS kích hoạt Worker định kỳ (WorkManager) hoặc khi có sự kiện kết nối Internet.
2. Worker kiểm tra các vé đã check-in nhưng chưa đồng bộ (`sync_status == pending`).
3. Đóng gói dữ liệu thành JSON theo chuẩn API Batch:
   ```json
   {
     "concertId": "<id>",
     "offlineLogs": [
       { "qrCodeHash": "...", "deviceId": "...", "scanTime": "..." }
     ]
   }
   ```
4. Gửi HTTP POST lên API `/checkin` của server (Server sẽ xử lý đối soát và đẩy vào RabbitMQ).
5. Đánh dấu `sync_status = synced` trong Local DB khi nhận response HTTP 200 OK thành công từ Server.
