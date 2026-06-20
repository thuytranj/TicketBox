## Why

Hiện tại hệ thống TicketBox Backend đã hỗ trợ phân tách vai trò chạy `api` và `worker` qua biến môi trường. Tuy nhiên, khi chạy thực tế ở local, chúng ta vẫn đang dùng 1 instance api và 1 instance worker gộp chung. Để tiệm cận môi trường Production thực tế và sẵn sàng cho việc kiểm thử tải (load testing), chúng ta cần:
1. Chạy nhiều API instances ($N$ instances) đằng sau một bộ cân bằng tải (Nginx Load Balancer).
2. Phân tách rõ rệt tiến trình của Booking Worker (`worker:booking`) và Background Worker (`worker:background`) để cô lập tài nguyên.
3. Giải quyết bài toán phân tán dữ liệu: các kết nối WebSockets của client phân tán trên các API instances khác nhau và các cronjobs chạy bất đồng bộ trùng lặp có thể gây tranh chấp tài nguyên (race condition).

## What Changes

- **BREAKING**: Thay đổi cách thức truy cập API trực tiếp qua container `ticketbox-api:3000`. Cổng 3000 trên host sẽ được ánh xạ qua bộ cân bằng tải Nginx, Nginx sẽ định tuyến cân bằng tải (Round-Robin) tới các API instances chạy nội bộ.
- **Docker Compose**: Tách dịch vụ `ticketbox-worker` thành hai dịch vụ độc lập chạy song song: `ticketbox-booking-worker` (role `worker:booking`) và `ticketbox-background-worker` (role `worker:background`).
- **Nginx Integration**: Thêm dịch vụ `nginx-lb` sử dụng file cấu hình `nginx.conf` mount từ ngoài vào.
- **WebSockets Scaling**: Tích hợp `@socket.io/redis-adapter` và `@socket.io/redis-emitter` vào `NotificationGateway`. Áp dụng cơ chế Room-based Routing (`user:${userId}`) thay thế cho Map cục bộ trong bộ nhớ RAM, cho phép cả các API instances và các standalone Workers gửi sự kiện real-time chéo instance.
- **Distributed Lock**: Bổ sung cơ chế Redis Lock vào `OrderExpirationCron` để ngăn chặn việc quét trùng lặp đơn hàng hết hạn khi chạy đa instances worker/api.

## Capabilities

### New Capabilities
*(Không có)*

### Modified Capabilities
- `backend-setup`: Cập nhật cấu hình khởi chạy local bằng Docker Compose tích hợp Nginx Load Balancer và chia tách chi tiết Booking/Background Workers.
- `notification`: Cập nhật đặc tả truyền tải thông báo thời gian thực hỗ trợ kiến trúc phân tán đa thực thể thông qua Redis Adapter và Emitter.
- `booking-core`: Cập nhật cơ chế quét hủy đơn hàng hết hạn định kỳ sử dụng khoá phân tán (Distributed Lock) để đảm bảo tính duy nhất (idempotency/concurrency safety).

## Impact

- **Cấu hình Docker**: `docker-compose.yml` (bỏ static ports của api, thêm nginx service, phân tách worker services) và tạo mới file `nginx.conf`.
- **Dependencies**: Cài đặt thêm các gói thư viện `@socket.io/redis-adapter`, `@socket.io/redis-emitter` và `socket.io` tương thích cùng với driver kết nối Redis client (`ioredis`).
- **Notification Module**: `notification.gateway.ts` và `notification.module.ts` để cấu hình Redis Adapter và tích hợp Redis Emitter cho gửi tin nhắn bất đồng bộ.
- **Booking Module**: `order-expiration.cron.ts` tích hợp sử dụng `RedisService` để khóa trước khi quét hủy đơn hàng.
