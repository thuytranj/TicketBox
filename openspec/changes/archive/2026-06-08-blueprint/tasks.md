## 1. Setup & Database Schema Setup

- [ ] 1.1 Khởi tạo khung dự án NestJS và cấu hình các module cơ bản (PostgreSQL, Redis, RabbitMQ)
- [ ] 1.2 Viết migration thiết lập các bảng cơ sở dữ liệu với khóa chính dạng UUID v7 (`users`, `concerts`, `ticket_types`, `bookings`, `tickets`, `checkin_logs`, `vip_guests`) và bảng `notification_logs` (BIGSERIAL PK)
- [ ] 1.3 Cấu hình thực thể TypeORM/Prisma trong dự án kết nối cơ sở dữ liệu PostgreSQL

## 2. Authentication & Authorization (RBAC)

- [ ] 2.1 Cài đặt thư viện passport-jwt và triển khai Authentication Guard cho JWT
- [ ] 2.2 Triển khai Roles Guard cho phép phân quyền người dùng theo vai trò (Khán giả, Ban tổ chức, Nhân sự soát vé)
- [ ] 2.3 Bảo vệ các endpoint API nhạy cảm của trang Admin và API Soát vé bằng Roles Guard

## 3. High-Concurrency Booking Engine

- [ ] 3.1 Thiết lập kết nối Redis Client trong NestJS và tải trước Lua Script đặt vé nguyên tử (Atomic Inventory Decrement & Per-User Limit Check)
- [ ] 3.2 Tích hợp RabbitMQ Client, định nghĩa queue và exchange cho tác vụ tạo đơn đặt vé
- [ ] 3.3 Triển khai Booking Controller nhận yêu cầu, chạy Lua Script trên Redis và đẩy tin nhắn vào RabbitMQ nếu Lua Script trả về thành công
- [ ] 3.4 Triển khai RabbitMQ Worker tiêu thụ tin nhắn, tạo bản ghi `bookings` và `tickets` trong PostgreSQL bất đồng bộ
- [ ] 3.5 Triển khai Cron Job khôi phục tồn kho trên Redis đối với các đơn hàng `pending` đã quá hạn `expires_at` (10 phút mặc định hoặc 2 giờ gia hạn)

## 4. Protection & Resiliency Mechanisms

- [ ] 4.1 Tích hợp `nestjs-throttler` cấu hình Rate Limiter sử dụng Redis làm storage (Token Bucket) cho các endpoint API đặt vé
- [ ] 4.2 Thiết lập Idempotency Middleware/Guard lưu trữ `Idempotency-Key` vào Redis với TTL 24 giờ để chặn các yêu cầu thanh toán trùng lặp
- [ ] 4.3 Tích hợp thư viện `opossum` thiết lập hai Circuit Breakers độc lập (`vnpayCircuitBreaker` và `momoCircuitBreaker`) bọc các cuộc gọi cổng thanh toán tương ứng
- [ ] 4.3a Xây dựng API `GET /payments/methods` kiểm tra trạng thái Circuit Breaker để phản hồi danh sách cổng thanh toán khả dụng cho Frontend
- [ ] 4.3b Triển khai cơ chế Graceful Degradation trong API `/payments`: tự động gợi ý chuyển cổng (nếu có cổng khả dụng) hoặc kích hoạt chế độ Pay Later (gia hạn `expires_at` thêm 2 giờ và trả về HTTP 202) khi toàn bộ cổng trực tuyến sập
- [ ] 4.4 Thiết lập chiến lược Cache-aside với Redis cho các API lấy danh sách và chi tiết concert, tự động invalidate cache khi admin thay đổi thông tin

## 5. Soát vé Trực tuyến & Ngoại tuyến (Check-in)

- [ ] 5.1 Xây dựng API soát vé trực tuyến: kiểm tra trạng thái vé trong PostgreSQL, cập nhật `checked_in` và ghi log
- [ ] 5.2 Xây dựng API tải dữ liệu soát vé (danh sách QR hash và trạng thái) để phục vụ SQLite offline trên mobile app
- [ ] 5.3 Xây dựng API đồng bộ hóa dữ liệu check-in ngoại tuyến: nhận mảng log check-in từ mobile app, đối soát trùng lặp và cập nhật database chính

## 6. VIP Guest List Import from CSV

- [ ] 6.1 Xây dựng luồng nhận tệp CSV chứa danh sách khách mời VIP, sử dụng hàng đợi xử lý ngầm (Background Job)
- [ ] 6.2 Thực hiện validate dữ liệu CSV dòng-dòng, bỏ qua các dòng lỗi/thiếu thông tin và lưu các khách mời hợp lệ vào bảng `vip_guests`

## 7. AI Artist Bio Integration

- [ ] 7.1 Tích hợp thư viện đọc văn bản từ file PDF (như `pdf-parse`)
- [ ] 7.2 Viết service kết nối với Google Gemini Pro API gửi văn bản đã trích xuất kèm prompt tóm tắt để tạo tiểu sử nghệ sĩ ngắn gọn và lưu lại

## 8. Notification System

- [ ] 8.1 Thiết lập RabbitMQ Topic Exchange (`notification.exchange`) với hai queue: `notification.inapp.queue` và `notification.email.queue`, cả hai bind pattern `notification.#`
- [ ] 8.2 Triển khai service sinh QR Code ký số (HMAC-SHA256 với SERVER_SECRET) và tạo ảnh QR PNG bằng thư viện `qrcode`
- [ ] 8.3 Triển khai In-app Notification Worker: tiêu thụ message từ `notification.inapp.queue`, tạo bản ghi trong bảng `notification_logs` (channel=in_app)
- [ ] 8.4 Triển khai Email Notification Worker: tiêu thụ message từ `notification.email.queue`, sinh QR PNG, nhúng inline (CID attachment) và gửi email qua Nodemailer + Mailtrap SMTP
- [ ] 8.5 Tích hợp publish notification message vào luồng Payment Webhook Handler khi booking được xác nhận thanh toán thành công
- [ ] 8.6 Triển khai Concert Reminder Cron Job (`@Cron('*/5 * * * *')`) quét concert có start_time trong khoảng 24 giờ tới và chưa gửi reminder, publish message và cập nhật `reminder_sent = true`
- [ ] 8.7 Xây dựng API lấy danh sách in-app notification và API đánh dấu thông báo đã đọc (cập nhật `read_at`)

## 9. Testing & Verification

- [ ] 9.1 Viết unit tests kiểm tra tính đúng đắn của Redis Lua Script (hết vé, vượt giới hạn mua, mua thành công)
- [ ] 9.2 Viết integration tests cho luồng đặt vé bất đồng bộ từ lúc gửi API đến lúc lưu database qua RabbitMQ
- [ ] 9.3 Viết integration tests cho luồng notification: xác nhận booking → message vào exchange → In-app Worker lưu DB + Email Worker gửi email
- [ ] 9.4 Thực hiện kiểm thử tải (Load Testing) giả lập 1,000+ requests/giây đồng thời vào API đặt vé để đảm bảo không bị quá tải DB và không over-selling

