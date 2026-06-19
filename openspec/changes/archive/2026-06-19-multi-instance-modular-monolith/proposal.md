## Why

Hiện tại, ứng dụng TicketBox chạy dưới dạng một Monolith duy nhất đảm nhận cả việc xử lý request HTTP (API) và xử lý các tác vụ nền (RabbitMQ consumers, Cronjobs). Khi có tải lớn (ví dụ: đợt bán vé lớn), các tác vụ nền nặng (như AI processing, Notification gửi email) có thể chiếm dụng tài nguyên CPU/Memory của instance, làm chậm hoặc sập API HTTP chính, ảnh hưởng trực tiếp đến trải nghiệm đặt vé của khách hàng.

Để bảo vệ luồng đặt vé quan trọng (Critical Booking Path), chúng ta cần tách biệt tải xử lý của API, các tiến trình lưu/hủy vé Booking (yêu cầu độ nhạy và tin cậy cực cao) và các tiến trình nền phụ trợ (AI, Email - vốn chậm và không ổn định do phụ thuộc bên thứ ba).

## What Changes

- **Hỗ trợ biến môi trường INSTANCE_ROLE động**: Định nghĩa các vai trò chạy thực tế bao gồm:
  - `all` (mặc định): Chạy toàn bộ (API + tất cả Workers).
  - `api`: Chỉ chạy cổng HTTP API, tắt tất cả các consumers và cronjobs.
  - `worker`: Chạy tất cả các consumers và cronjobs (thuận tiện cho local dev).
  - `worker:booking` (Critical Worker): Chỉ chạy consumers và cronjobs liên quan đến module Booking (lưu đơn hàng, xử lý hủy giữ chỗ quá hạn).
  - `worker:background` (Heavy Worker): Chỉ chạy các consumers và cronjobs liên quan đến AI và Notification (gửi mail, sinh bio).
- **Chặn khởi tạo Consumers và Cronjobs động**:
  - `AIConsumer` và `NotificationConsumer` sẽ chỉ chạy ở các vai trò `all`, `worker`, `worker:background`.
  - `BookingConsumer` và `BookingDlxConsumer` sẽ chỉ chạy ở các vai trò `all`, `worker`, `worker:booking`.
  - Các Cronjobs dọn dẹp hệ thống/hủy đơn hàng tương tự sẽ được kiểm tra vai trò thích hợp trước khi thực thi.
- **Cấu hình Docker Compose local**: Thiết lập chạy song song cổng `ticketbox-api` và thực thể `ticketbox-worker` (chạy chung tất cả workers ở local để tiết kiệm RAM) kết nối tới các dịch vụ Postgres, Redis, RabbitMQ. Đồng thời đảm bảo cấu hình dễ dàng mở rộng thành 3 container riêng biệt (`api`, `worker-booking`, `worker-background`) ở môi trường Production.
- **Thêm các scripts khởi chạy trong package.json**: Bổ sung các lệnh khởi chạy chuyên biệt cho từng instance để tiện phát triển (`start:api`, `start:worker:booking`, `start:worker:background`, v.v.).

## Capabilities

### New Capabilities

*(Không có)*

### Modified Capabilities

- `backend-setup`: Cập nhật yêu cầu khởi chạy ứng dụng hỗ trợ các vai trò khác nhau (`api`, `worker`, `worker:booking`, `worker:background`, `all`) và cấu hình Docker Compose chạy nhiều thực thể (multi-instance) đồng thời.

## Impact

- **Môi trường cấu hình**: Cần bổ sung biến môi trường `INSTANCE_ROLE` vào `.env` và `.env.example`.
- **Mã nguồn Backend**:
  - `src/backend/src/main.ts`: Kiểm tra `INSTANCE_ROLE` để quyết định có khởi tạo HTTP server lắng nghe cổng hay không, hoặc cấu hình cổng đặc thù cho API/Worker.
  - Các file Consumer và Cron: `src/backend/src/ai/ai.consumer.ts`, `src/backend/src/booking/booking.consumer.ts`, `src/backend/src/booking/booking-dlx.consumer.ts`, `src/backend/src/notification/notification.consumer.ts`, `src/backend/src/booking/cron/order-expiration.cron.ts`, `src/backend/src/notification/notification-cleanup.service.ts` sẽ được cập nhật để kiểm tra `INSTANCE_ROLE` trước khi đăng ký lắng nghe/thực thi.
- **Docker Compose**: File `docker-compose.yml` sẽ được thiết lập thêm các service chạy container ứng dụng, kết nối tới DB, Redis và RabbitMQ.
