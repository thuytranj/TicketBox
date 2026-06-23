## 1. Thiết lập Database & Entities

- [ ] 1.1 Khởi tạo thực thể `VipGuest` (thiết lập composite unique index `(concertId, email)`) và thực thể `VipGuestImport` (thiết lập composite index `(concertId, createdAt DESC)`) trong thư mục `src/backend/src/concert/entities/`
- [ ] 1.2 Cập nhật thực thể `Concert` để thiết lập mối quan hệ một-nhiều với `VipGuest` và `VipGuestImport`
- [ ] 1.3 Tạo và thực thi migration TypeORM để tạo các bảng mới và cập nhật các chỉ mục bổ sung trong cơ sở dữ liệu PostgreSQL
- [ ] 1.4 Đăng ký các thực thể mới trong cấu hình TypeORM / `ConcertModule`
- [ ] 1.5 Bổ sung chỉ mục `@Index` cho các cột `userId` và `concertId` của thực thể `Order` và cột `orderId` của thực thể `Payment`

## 2. Cấu hình RabbitMQ

- [ ] 2.1 Đăng ký hàng đợi `vip_guest.import` trong phần cấu hình RabbitMQ của `ConcertModule` / cài đặt ứng dụng
- [ ] 2.2 Thiết lập các cấu hình liên quan đến DLX (Dead Letter Exchange) để tăng tính tin cậy xử lý

## 3. APIs Import CSV & Controller

- [ ] 3.1 Xây dựng endpoint `POST /concerts/:id/guests/import` trong `ConcertController` sử dụng `FileInterceptor` để nhận file CSV và tải lên Supabase Storage
- [ ] 3.2 Viết logic kiểm tra sự tồn tại của concert, khởi tạo bản ghi `VipGuestImport` ở trạng thái `processing`, gửi message chứa thông tin (mã job, mã concert, URL file Supabase Storage) lên RabbitMQ và trả về phản hồi HTTP 202
- [ ] 3.3 Tạo DTO phục vụ validate định dạng dòng dữ liệu (validate `full_name`, `email`, `phone`, `affiliate_company`)
- [ ] 3.4 Viết endpoint `GET /concerts/:id/guests/imports/:jobId` để lấy trạng thái xử lý và danh sách log lỗi của Job import

## 4. Background Worker Consumer

- [ ] 4.1 Tạo service consumer cho hàng đợi `vip_guest.import` ở phía worker
- [ ] 4.2 Tải tệp từ Supabase Storage và triển khai cơ chế phân tích luồng dữ liệu (stream-based parsing) sử dụng thư viện `csv-parser`
- [ ] 4.3 Thực hiện validate dữ liệu trên từng dòng bằng `class-validator` với DTO đã tạo
- [ ] 4.4 Thực hiện gom các dòng hợp lệ, kiểm tra trùng lặp email, thực hiện chèn dữ liệu theo cụm (Chunked Bulk Insert) sử dụng QueryBuilder bọc trong Database Transaction để tối ưu I/O Postgres
- [ ] 4.5 Sinh mã hash QR code an toàn bằng chữ ký HMAC-SHA256 kết hợp payload `guestId:concertId` và `SERVER_SECRET`
- [ ] 4.6 Đẩy tác vụ gửi email thư mời kèm mã QR sang exchange notification cho từng khách mời được import thành công, đồng thời cấu hình prefetch = 1 và khống chế tốc độ tiêu thụ (Rate Limiting Consumer) để tránh bị khóa tài khoản SMTP do nghi ngờ spam
- [ ] 4.7 Cập nhật trạng thái Job, số dòng đã nhập (`imported_rows`), tổng số dòng (`total_rows`), lưu log lỗi (`error_logs`) vào database, và thực hiện dọn dẹp file trên Supabase Storage

## 5. Kiểm thử & Xác minh

- [ ] 5.1 Viết các unit tests kiểm tra cơ chế parser CSV, logic validate dòng và các endpoint controller
- [ ] 5.2 Kiểm thử thủ công luồng tích hợp: upload file CSV chứa cả dòng hợp lệ và không hợp lệ, kiểm tra trạng thái Job/danh sách lỗi, xác nhận bản ghi DB và email gửi đi giả lập (mock email)
