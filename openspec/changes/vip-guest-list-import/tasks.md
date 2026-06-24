## 1. Thiết lập Database & Entities

- [x] 1.1 Khởi tạo thực thể `VipGuest` (thiết lập composite unique index `(concertId, email)`) và thực thể `VipGuestImport` (thiết lập composite index `(concertId, createdAt DESC)`) trong thư mục `src/backend/src/concert/entities/`
- [x] 1.2 Cập nhật thực thể `Concert` để thiết lập mối quan hệ một-nhiều với `VipGuest` và `VipGuestImport`
- [x] 1.3 Tạo và thực thi migration TypeORM để tạo các bảng mới và cập nhật các chỉ mục bổ sung trong cơ sở dữ liệu PostgreSQL
- [x] 1.4 Đăng ký các thực thể mới trong cấu hình TypeORM / `ConcertModule`
- [x] 1.5 Bổ sung chỉ mục `@Index` cho các cột `userId` và `concertId` của thực thể `Order` và cột `orderId` của thực thể `Payment`

## 2. Cấu hình RabbitMQ

- [x] 2.1 Đăng ký hàng đợi `vip_guest.import` trong phần cấu hình RabbitMQ của `ConcertModule` / cài đặt ứng dụng
- [x] 2.2 Thiết lập các cấu hình liên quan đến DLX (Dead Letter Exchange) để tăng tính tin cậy xử lý

## 3. APIs Import CSV & Controller

- [x] 3.1 Xây dựng endpoint `POST /concerts/:id/guests/import` trong `ConcertController` sử dụng `FileInterceptor` để nhận file CSV và tải lên Supabase Storage
- [x] 3.2 Viết logic kiểm tra sự tồn tại của concert, khởi tạo bản ghi `VipGuestImport` ở trạng thái `processing`, gửi message chứa thông tin (mã job, mã concert, URL file Supabase Storage) lên RabbitMQ và trả về phản hồi HTTP 202
- [x] 3.3 Tạo DTO phục vụ validate định dạng dòng dữ liệu (validate `full_name`, `email`, `phone`, `affiliate_company`)
- [x] 3.4 Viết endpoint `GET /concerts/:id/guests/imports/:jobId` để lấy trạng thái xử lý và danh sách log lỗi của Job import

## 4. Background Worker Consumer

- [x] 4.1 Tạo service consumer cho hàng đợi `vip_guest.import` ở phía worker
- [x] 4.2 Tải tệp từ Supabase Storage và triển khai cơ chế phân tích luồng dữ liệu (stream-based parsing) sử dụng thư viện `csv-parser`
- [x] 4.3 Thực hiện validate dữ liệu trên từng dòng bằng `class-validator` với DTO đã tạo
- [x] 4.4 Thực hiện gom các dòng hợp lệ, kiểm tra trùng lặp email, thực hiện chèn dữ liệu theo cụm (Chunked Bulk Insert) sử dụng QueryBuilder bọc trong Database Transaction để tối ưu I/O Postgres
- [x] 4.5 Sinh mã hash QR code an toàn bằng chữ ký HMAC-SHA256 kết hợp payload `guestId:concertId` và `SERVER_SECRET`. Cài đặt thư viện `qrcode` và viết hàm tạo ảnh QR dạng Buffer từ mã hash này.
- [x] 4.6 Đẩy tác vụ gửi email thư mời đính kèm mã QR dạng CID (Content-ID) Attachment sang exchange notification cho từng khách mời được import thành công, đồng thời cấu hình prefetch = 1 và khống chế tốc độ tiêu thụ (Rate Limiting Consumer) để tránh bị khóa tài khoản SMTP do nghi ngờ spam
- [x] 4.7 Cập nhật trạng thái Job, số dòng đã nhập (`imported_rows`), tổng số dòng (`total_rows`), lưu log lỗi (`error_logs`) vào database, và thực hiện dọn dẹp file trên Supabase Storage

## 5. Kiểm thử & Xác minh

- [x] 5.1 Viết các unit tests kiểm tra cơ chế parser CSV, logic validate dòng và các endpoint controller
- [x] 5.2 Kiểm thử thủ công luồng tích hợp: upload file CSV chứa cả dòng hợp lệ và không hợp lệ, kiểm tra trạng thái Job/danh sách lỗi, xác nhận bản ghi DB và email gửi đi giả lập (mock email)

## 6. Chuyển đổi sang Resend SDK (REST API)

- [x] 6.1 Cài đặt thư viện `resend` trong `package.json`
- [x] 6.2 Thay thế việc sử dụng `nodemailer` bằng `Resend` SDK trong `EmailService`
- [x] 6.3 Cập nhật cấu hình gửi email sử dụng `RESEND_API_KEY` và `MAIL_FROM` từ biến môi trường
- [x] 6.4 Chuyển đổi cấu trúc đính kèm QR code dạng inline CID sử dụng trường `id` trong attachment của Resend
- [x] 6.5 Viết lại unit tests trong `email.service.spec.ts` sử dụng mock Resend SDK thay cho mock `nodemailer`
- [x] 6.6 Chạy kiểm thử tự động (`npm run test`) để xác minh việc gửi OTP, reset password, và VIP invitation email qua Resend hoạt động chính xác

## 7. Cơ chế Xử lý Lỗi (ON CONFLICT & Retry & DLQ)

- [x] 7.1 Cấu hình cột `error_logs` của thực thể `VipGuestImport` lưu mảng JSON lỗi rút gọn (số dòng, email, lý do) phục vụ hiển thị
- [x] 7.2 Tích hợp mệnh đề `.orIgnore()` (`ON CONFLICT DO NOTHING`) vào QueryBuilder bulk insert của worker để tự động bỏ qua dòng trùng lặp
- [x] 7.3 Cấu hình cơ chế Retry (tối đa 3 lần) và DLQ cho hàng đợi thông báo gửi thư ở phần thiết lập RabbitMQ
- [x] 7.4 Xóa bỏ phần hiển thị signature hash (chuỗi 64 ký tự) trong template HTML của `sendVipInvitationEmail` ở `EmailService`
- [x] 7.5 Cập nhật lại unit tests của `EmailService` trong `email.service.spec.ts` để loại bỏ kỳ vọng chuỗi hash signature hiển thị trong HTML
- [x] 7.6 Kiểm thử tích hợp toàn bộ luồng: tải lên CSV có dòng lỗi, hiển thị dòng lỗi trên giao diện, sửa file gốc và tải lên lại (đảm bảo chỉ chèn dòng mới sửa)

## 8. Cải tiến Bảo mật, Validation & API Danh sách VIP

- [x] 8.1 Thêm cấu hình `@Exclude()` cho cột `fileUrl` trong thực thể `VipGuestImport` sử dụng `class-transformer` để ẩn khỏi API response
- [x] 8.2 Cập nhật validator của trường `phone` trong `VipGuestRowDto` sử dụng `@IsPhoneNumber('VN')` để kiểm tra chuẩn SĐT Việt Nam
- [x] 8.3 Xây dựng API `GET /concerts/:id/guests` hỗ trợ phân trang (Pagination DTO) và tìm kiếm (Search query) để tra cứu danh sách VIP guest
- [x] 8.4 Đăng ký và phân quyền cho API mới chỉ dành cho vai trò `ORGANIZER` hoặc `ADMIN`
- [x] 8.5 Bổ sung unit tests cho DTO validation số điện thoại di động và controller / service của API lấy danh sách VIP guest
- [x] 8.6 Kiểm thử e2e tích hợp luồng: tải danh sách VIP từ API phân trang, kiểm tra chức năng tìm kiếm và xác nhận tính đúng đắn của dữ liệu trả về



