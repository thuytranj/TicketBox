## Why

Cho phép ban tổ chức tải lên danh sách khách mời VIP qua file CSV một cách bất đồng bộ. Điều này giúp đảm bảo luồng API chính không bị nghẽn (non-blocking), tránh lỗi timeout khi file lớn, có cơ chế bỏ qua lỗi/trùng lặp và tự động tạo mã QR bảo mật cùng gửi email thông báo mà không ảnh hưởng tới tiến trình đặt vé của người dùng thông thường.

## What Changes

- Thêm API `POST /concerts/:id/guests/import` để tiếp nhận file CSV, tải lên Supabase Storage và khởi tạo job xử lý bất đồng bộ.
- Triển khai xử lý nền bất đồng bộ thông qua RabbitMQ với job `vip_guest.import`.
- Sử dụng luồng stream (`csv-parser`) để phân tích cú pháp file CSV được tải từ Supabase Storage và thư viện `class-validator` để kiểm tra định dạng từng dòng dữ liệu.
- Tối ưu hóa việc lưu trữ cơ sở dữ liệu bằng cách gom các dòng hợp lệ và thực hiện chèn theo cụm (Chunked Bulk Insert) kết hợp Transaction.
- Thiết kế chỉ mục tối ưu cho các bảng mới (composite indexes) và bổ sung chỉ mục khóa ngoại cho các thực thể hiện tại (`Order`, `Payment`) để tránh quét tuần tự (Seq Scan) khi quy mô dữ liệu lớn.
- Lưu trạng thái job và ghi nhận chi tiết nhật ký lỗi định dạng vào cơ sở dữ liệu.
- Sinh mã QR VIP bảo mật được ký bằng HMAC-SHA256 sử dụng `SERVER_SECRET` và đẩy tin nhắn gửi email đính kèm mã QR sang hàng đợi thông báo với cơ chế khống chế tốc độ (Rate Limiting) tại Worker để tránh bị đánh dấu spam.

## Capabilities

### New Capabilities

<!-- Không có -->

### Modified Capabilities

- `guest-list`: Cải tiến yêu cầu nhập danh sách khách mời VIP sử dụng hàng đợi RabbitMQ, xử lý stream từng dòng và ghi nhận nhật ký lỗi chi tiết.

## Impact

- **Database**:
  - Thêm bảng `vip_guests` kèm composite unique index `(concert_id, email)`.
  - Thêm bảng `vip_guest_imports` kèm composite index `(concert_id, created_at DESC)`.
  - Bổ sung chỉ mục (`@Index`) cho các trường khóa ngoại hiện tại: `userId` và `concertId` trong bảng `orders`, `orderId` trong bảng `payments` để tối ưu hóa hiệu năng truy vấn.
- **Queue/Broker**: Cấu hình thêm queue `vip_guest.import` và consumer xử lý ngầm.
- **Worker**: Bổ sung tác vụ worker đọc CSV, lưu DB, sinh mã QR và dispatch email.
- **API**: Thêm endpoint tải file CSV.
