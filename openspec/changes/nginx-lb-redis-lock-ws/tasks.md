## 1. Cấu hình Nginx & Docker Compose (Dockerization & Routing)

- [x] 1.1 Tạo file cấu hình `nginx.conf` tại thư mục gốc hỗ trợ load balancing và WebSockets
- [x] 1.2 Cập nhật file `docker-compose.yml` để tích hợp dịch vụ `nginx-lb` ánh xạ cổng 3000
- [x] 1.3 Điều chỉnh dịch vụ `ticketbox-api` trong `docker-compose.yml` (bỏ container_name, bỏ port 3000 mapping và đổi thành expose)
- [x] 1.4 Phân tách dịch vụ `ticketbox-worker` thành `ticketbox-booking-worker` (chạy role `worker:booking`) và `ticketbox-background-worker` (chạy role `worker:background`)

## 2. Tích hợp Socket.io Redis Adapter & Redis Emitter (WebSockets Cluster Scaling)

- [x] 2.1 Thêm các dependencies `@socket.io/redis-adapter`, `@socket.io/redis-emitter` và `ioredis` vào `src/backend/package.json`
- [x] 2.2 Tạo file Custom WebSocket Adapter `src/common/adapters/redis-io.adapter.ts` kế thừa từ `IoAdapter` của NestJS để thiết lập Pub/Sub qua Redis
- [x] 2.3 Đăng ký custom adapter này vào file khởi tạo hệ thống `src/backend/src/main.ts` khi chạy với vai trò API
- [x] 2.4 Đảm bảo module `NotificationModule` cấu hình đúng các biến môi trường kết nối Redis cho adapter
- [x] 2.5 Refactor `NotificationGateway` để kết nối clients vào Room định danh `user:${userId}` và sử dụng `redis-emitter` thay cho Map cục bộ trong RAM


## 3. Khoá phân tán cho Cronjob (Distributed Cron Safety)

- [x] 3.1 Cập nhật `OrderExpirationCron` (`src/backend/src/booking/cron/order-expiration.cron.ts`) để inject `RedisService`
- [x] 3.2 Tích hợp luồng acquire lock `lock:order-expiration` với TTL 60s trước khi thực thi xử lý quét đơn hàng
- [x] 3.3 Đảm bảo giải phóng lock hoặc tự giải phóng bằng TTL khi kết thúc/bị lỗi xử lý

## 4. Kiểm thử & Kiểm tra tích hợp (Verification & Testing)

- [x] 4.1 Khởi chạy môi trường local bằng lệnh `docker compose up --scale ticketbox-api=2 -d` để xác nhận Nginx phân phối request đều đến cả 2 instances
- [x] 4.2 Kiểm thử gửi thông báo real-time qua websocket khi client kết nối tới các api instance khác nhau
- [x] 4.3 Giả lập chạy đồng thời 2 cronjobs quét đơn hàng hết hạn ở các instances khác nhau và kiểm tra xem chỉ 1 instance giành được lock thực thi
