## Why

Cho phép ban tổ chức tải lên danh sách khách mời VIP qua file CSV một cách bất đồng bộ. Điều này giúp đảm bảo luồng API chính không bị nghẽn (non-blocking), tránh lỗi timeout khi file lớn, có cơ chế bỏ qua lỗi/trùng lặp và tự động tạo mã QR bảo mật cùng gửi email thông báo qua Resend SDK (REST API) mà không ảnh hưởng tới tiến trình đặt vé của người dùng thông thường.

## What Changes

- Thêm API `POST /concerts/:id/guests/import` để tiếp nhận file CSV, tải lên Supabase Storage và khởi tạo job xử lý bất đồng bộ.
- Triển khai xử lý nền bất đồng bộ thông qua RabbitMQ với job `vip_guest.import`.
- Sử dụng luồng stream (`csv-parser`) để phân tích cú pháp file CSV được tải từ Supabase Storage và thư viện `class-validator` để kiểm tra định dạng từng dòng dữ liệu.
- Tối ưu hóa việc lưu trữ cơ sở dữ liệu bằng cách gom các dòng hợp lệ và thực hiện chèn theo cụm (Chunked Bulk Insert) kết hợp Transaction. Sử dụng cơ chế chèn tránh trùng lặp (`ON CONFLICT (concert_id, email) DO NOTHING`) để cho phép ban tổ chức chỉnh sửa file CSV gốc và tải lên lại toàn bộ tệp, hệ thống sẽ tự động bỏ qua các dòng đã chèn thành công trước đó.
- Thiết kế chỉ mục tối ưu cho các bảng mới (composite indexes) và bổ sung chỉ mục khóa ngoại cho các thực thể hiện tại (`Order`, `Payment`) để tránh quét tuần tự (Seq Scan) khi quy mô dữ liệu lớn.
- Lưu trạng thái job và ghi nhận tóm tắt danh sách lỗi (số dòng, email/định danh, lý do lỗi) vào cơ sở dữ liệu phục vụ hiển thị trên trang quản trị.
- Sinh mã QR VIP bảo mật được ký bằng HMAC-SHA256 sử dụng `SERVER_SECRET` và gửi email thông qua SDK Resend (REST API). Bố cục email chỉ hiển thị hình ảnh QR Code nhúng CID, loại bỏ chuỗi ký tự mã hash 64 ký tự (signature) để tăng tính thẩm mỹ và chuyên nghiệp.
- Cấu hình cơ chế **Tự động Retry (Max 3 lần với exponential backoff)** và chuyển tiếp vào **DLQ (Dead Letter Queue)** trong RabbitMQ đối với tác vụ gửi email gặp lỗi tạm thời (như Resend API nghẽn) để đảm bảo không thất thoát thư mời.

## Capabilities

### New Capabilities

<!-- Không có -->

### Modified Capabilities

- `guest-list`: Cải tiến yêu cầu nhập danh sách khách mời VIP sử dụng hàng đợi RabbitMQ, xử lý stream từng dòng, ghi nhận nhật ký lỗi rút gọn để hiển thị trên UI, gửi thư bằng Resend SDK với cơ chế Retry/DLQ và tối ưu hóa hiển thị email (loại bỏ signature hash).

## Impact

- **Database**:
  - Thêm bảng `vip_guests` kèm composite unique index `(concert_id, email)`.
  - Thêm bảng `vip_guest_imports` kèm composite index `(concert_id, created_at DESC)`.
  - Bổ sung chỉ mục (`@Index`) cho các trường khóa ngoại hiện tại: `userId` và `concertId` trong bảng `orders`, `orderId` trong bảng `payments` để tối ưu hóa hiệu năng truy vấn.
- **Queue/Broker**: Cấu hình thêm queue `vip_guest.import` và consumer xử lý ngầm. Định nghĩa thêm binding retry và DLQ cho queue thông báo email.
- **Worker**: Bổ sung tác vụ worker đọc CSV, lưu DB (với `ON CONFLICT DO NOTHING`), sinh mã QR và gửi email qua Resend SDK với cơ chế retry.
- **API**: Thêm endpoint tải file CSV để import và endpoint kiểm tra trạng thái Job.
- **Dependencies**: Bổ sung thư viện `resend` cho NestJS backend.
