## 1. Cấu hình môi trường và Scripts khởi chạy

- [x] 1.1 Bổ dung biến môi trường `INSTANCE_ROLE` vào file `src/backend/.env.example` và `.env`
- [x] 1.2 Cập nhật file `src/backend/package.json` để bổ sung các lệnh khởi chạy tương ứng với từng vai trò cụ thể: `start:api`, `start:worker:booking`, `start:worker:background`
- [x] 1.3 Phân tách các cấu hình biến môi trường (tạo `src/backend/.env` cho NestJS và rút gọn root `.env` chỉ chứa cổng và credentials cho hạ tầng)

## 2. Điều chỉnh mã nguồn khởi động Backend

- [x] 2.1 Cập nhật `src/backend/src/main.ts` để đọc biến `INSTANCE_ROLE` và khởi chạy standalone application context (`NestFactory.createApplicationContext`) nếu vai trò bắt đầu bằng `worker:` hoặc bằng `worker`
- [x] 2.2 Cập nhật `src/backend/src/app.module.ts` để ưu tiên nạp file `.env` từ thư mục chạy lệnh (`process.cwd()`) trước tiên

## 3. Chặn đăng ký Consumers và thực thi Cronjobs trong các Instance chuyên biệt

- [x] 3.1 Cập nhật `AIConsumer` (`src/backend/src/ai/ai.consumer.ts`) để chỉ kích hoạt tiêu thụ tin nhắn khi `INSTANCE_ROLE` thuộc nhóm Background (`['all', 'worker', 'worker:background']`)
- [x] 3.2 Cập nhật `BookingConsumer` (`src/backend/src/booking/booking.consumer.ts`) để chỉ kích hoạt tiêu thụ tin nhắn khi `INSTANCE_ROLE` thuộc nhóm Booking (`['all', 'worker', 'worker:booking']`)
- [x] 3.3 Cập nhật `BookingDlxConsumer` (`src/backend/src/booking/booking-dlx.consumer.ts`) để chỉ kích hoạt tiêu thụ tin nhắn khi `INSTANCE_ROLE` thuộc nhóm Booking (`['all', 'worker', 'worker:booking']`)
- [x] 3.4 Cập nhật `NotificationConsumer` (`src/backend/src/notification/notification.consumer.ts`) để chỉ kích hoạt tiêu thụ tin nhắn khi `INSTANCE_ROLE` thuộc nhóm Background (`['all', 'worker', 'worker:background']`)
- [x] 3.5 Cập nhật `OrderExpirationCron` (`src/backend/src/booking/cron/order-expiration.cron.ts`) để dừng thực hiện cron job kiểm tra hủy đơn hàng nếu `INSTANCE_ROLE` không thuộc nhóm Booking (`['all', 'worker', 'worker:booking']`)
- [x] 3.6 Cập nhật `NotificationCleanupService` (`src/backend/src/notification/notification-cleanup.service.ts`) để dừng thực hiện cron job dọn dẹp nếu `INSTANCE_ROLE` không thuộc nhóm Background (`['all', 'worker', 'worker:background']`)

## 4. Dockerization và Docker Compose

- [x] 4.1 Tạo file `src/backend/Dockerfile` phục vụ việc build ứng dụng local NestJS
- [x] 4.2 Cập nhật file `docker-compose.yml` ở thư mục gốc dự án để thêm hai services `ticketbox-api` (role `api`) và `ticketbox-worker` (role `worker` để chạy toàn bộ consumers ở local) tích hợp đầy đủ cấu hình phát triển (volumes mount, ports, depends_on)
