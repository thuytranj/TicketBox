## Context

Hệ thống TicketBox Backend đã hỗ trợ kiến trúc Multi-instance Modular Monolith. Tuy nhiên, việc khởi chạy local vẫn sử dụng một API instance đơn lẻ và một Worker gộp chung. Bản thiết kế này hướng tới việc thiết lập môi trường chạy đa instances thực tế:
- Tải của khách truy cập được phân phối đều qua **Nginx Load Balancer**.
- Các workers được chia thành **Booking Worker** và **Background Worker** riêng biệt.
- Sử dụng **Socket.io Redis Adapter** để đồng bộ và chuyển tiếp tin nhắn thời gian thực giữa các API instances phân tán.
- Áp dụng **Redis Lock** cho cronjob huỷ đơn hàng quá hạn để đảm bảo an toàn tranh chấp dữ liệu.

## Goals / Non-Goals

**Goals:**
- Tích hợp thành công Nginx làm Load Balancer nhận HTTP và WebSocket traffic tại port `3000` của host và phân phối tới các bản sao của `ticketbox-api`.
- Tách rời hoàn toàn dịch vụ worker trong `docker-compose.yml` thành 2 container độc lập chạy 2 vai trò `worker:booking` và `worker:background`.
- Tích hợp `@socket.io/redis-adapter` vào NestJS WebSockets Gateway sử dụng Redis hiện có.
- Triển khai cơ chế khóa phân tán Redis Lock cho `OrderExpirationCron` để ngăn chặn chạy song song.

**Non-Goals:**
- Thay đổi cấu trúc cơ sở dữ liệu hoặc tách repo.
- Thay đổi logic nghiệp vụ đặt vé hoặc xử lý email.

## Decisions

### Decision 1: Cân bằng tải qua Nginx với Dynamic Resolving
- **Lựa chọn**: Sử dụng Nginx Docker Image chính thức làm reverse proxy.
- **Chi tiết**: 
  - Khai báo upstream trỏ tới `ticketbox-api:3000`.
  - Sử dụng chỉ thị `resolver 127.0.0.11 valid=5s` trong `nginx.conf` để phân giải động IP của các container khi số lượng API instances thay đổi hoặc bị khởi động lại.
  - Hỗ trợ đầy đủ các tiêu đề HTTP nâng cấp (`Upgrade: websocket`) để duy trì kết nối WebSocket của Socket.io.

### Decision 2: Chia tách các Workers chuyên biệt trong Compose
- **Lựa chọn**: Khai báo 2 dịch vụ độc lập trong `docker-compose.yml`:
  - `ticketbox-booking-worker` chạy `INSTANCE_ROLE=worker:booking`.
  - `ticketbox-background-worker` chạy `INSTANCE_ROLE=worker:background`.
- **Lý do**: Kiểm thử khả năng chịu lỗi và cô lập tài nguyên độc lập giữa luồng đặt vé và các tác vụ nặng (AI, Email).

### Decision 3: Đồng bộ Socket.io qua Redis Adapter & Redis Emitter
- **Lựa chọn**: Sử dụng `@socket.io/redis-adapter` kết hợp `@socket.io/redis-emitter` và thư viện kết nối Redis tương ứng (`ioredis`).
- **Chi tiết**:
  - Tại file khởi chạy hoặc adapter tùy chỉnh của NestJS WebSocket (`src/common/adapters/redis-io.adapter.ts`), khởi tạo 2 kết nối Redis mới (một cho xuất bản `pubClient` và một cho đăng ký `subClient`). Đăng ký adapter này vào Socket.io server thông qua NestJS `app.useWebSocketAdapter()`.
  - Thay thế Map cục bộ `userSockets` trong `NotificationGateway` bằng cơ chế **Room-based Routing**. Khi Client kết nối, tự động tham gia vào phòng định danh `user:${userId}`.
  - Tích hợp thêm **Redis Emitter** trong `NotificationGateway`. Do các tiến trình Worker chạy dưới dạng standalone NestJS context và không khởi tạo WebSocket server, việc gửi sự kiện real-time sẽ được thực hiện thông qua `Emitter` xuất bản tin nhắn trực tiếp lên kênh Redis của Socket.io.
  - Nhờ đó, khi bất kỳ instance nào (API hoặc Worker) phát ra một sự kiện (qua `emitter.to("user:" + userId).emit()`), Redis adapter trên các API instances sẽ tự động nhận diện và gửi đến client nếu nó đang kết nối tới instance đó.


### Decision 4: Cơ chế Khóa phân tán (Redis Lock) cho OrderExpirationCron
- **Lựa chọn**: Sử dụng phương thức `RedisService.acquireLock` hiện có trong mã nguồn (đang áp dụng thành công tại `NotificationCleanupService`).
- **Chi tiết**:
  - Đăng ký khóa với key `lock:order-expiration` và thời gian tồn tại (TTL) là 60 giây.
  - Khi cron job chạy mỗi 5 phút, nó sẽ cố gắng lấy khóa. Nếu không thành công (có một instance khác đang chạy), nó sẽ dừng lại ngay lập tức.

## Risks / Trade-offs

- **[Risk] Phân rã handshake trong Socket.io**: Nếu Client kết nối sử dụng HTTP Long-Polling trước khi nâng cấp lên WebSocket, các request HTTP của cùng một phiên kết nối có thể bị định tuyến sang các API instances khác nhau, dẫn tới lỗi `Session ID unknown`.
  - *Mitigation*: Khuyến nghị cấu hình client kết nối bằng giao thức `websocket` trực tiếp (tắt polling: `transports: ['websocket']`), hoặc cấu hình Nginx sử dụng cơ chế session sticky (ip_hash) nếu bắt buộc phải dùng polling.
- **[Risk] Quá tải kết nối Redis**: Mỗi API instance chạy Socket.io Redis Adapter sẽ sinh thêm ít nhất 2 kết nối tới Redis Server.
  - *Mitigation*: Với môi trường local, số lượng API instances nhỏ ($N \le 5$), lượng kết nối tăng thêm không đáng kể và hoàn toàn nằm trong khả năng xử lý của Redis container.
- **[Risk] Giữ khóa quá lâu nếu Cron bị đơ**: Nếu luồng xử lý `expireStaleOrders` bị treo và khóa vẫn giữ nguyên, có thể chặn lần chạy tiếp theo.
  - *Mitigation*: Cài đặt timeout hợp lý cho query DB và đặt TTL của lock vừa phải (60 giây là tối ưu vì cron chạy cách nhau 5 phút).
