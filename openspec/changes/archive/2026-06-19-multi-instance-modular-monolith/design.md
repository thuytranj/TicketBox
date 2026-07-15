## Context

Hiện tại, toàn bộ hệ thống TicketBox Backend (gồm các HTTP API endpoints, các RabbitMQ Consumers xử lý bất đồng bộ cho AI/Booking/Notification, và các Cronjobs dọn dẹp) đều khởi chạy chung trong một tiến trình duy nhất. Điều này gây khó khăn khi scale ứng dụng trên production và dễ làm ảnh hưởng chéo về hiệu năng giữa tác vụ HTTP đồng bộ và các tác vụ nền tảng bất đồng bộ nặng.
Để giải quyết vấn đề này, chúng ta sẽ chuyển đổi hệ thống sang kiến trúc **Multi-instance Modular Monolith**. Mã nguồn vẫn được quản lý tập trung (Monolith), nhưng khi chạy thực tế (Production/Staging/Local compose), chúng ta có thể cấu hình thông qua biến môi trường để mỗi instance đảm nhận một vai trò chuyên biệt (API hoặc Worker).

## Goals / Non-Goals

**Goals:**
- Phân tách vai trò chạy thực tế của ứng dụng NestJS qua biến môi trường `INSTANCE_ROLE` (`api`, `worker`, `worker:booking`, `worker:background`, `all`).
- Cô lập hoàn toàn luồng đặt vé quan trọng (Critical Booking Path) khỏi các tác vụ nền nặng và chậm (gọi Gemini AI API, SMTP email).
- Khởi chạy worker instance gọn nhẹ dưới dạng Standalone Application, không cần lắng nghe cổng HTTP lớn của API.
- Tự động hóa cấu hình và chạy thử kiến trúc multi-instance ở môi trường phát triển local thông qua Docker Compose mà vẫn tối ưu lượng RAM sử dụng.

**Non-Goals:**
- Tách rời mã nguồn thành các Repository microservices riêng biệt.
- Tái cấu trúc cơ sở dữ liệu (Database) thành các DB riêng cho từng module.
- Thay đổi cấu trúc nghiệp vụ của các module Booking, Notification hay AI.

## Decisions

### Decision 1: Xác định vai trò instance chi tiết qua biến `INSTANCE_ROLE`
Sử dụng biến môi trường `INSTANCE_ROLE` với các giá trị:
- `api`: Chỉ khởi tạo HTTP Server nhận các request. Vô hiệu hóa việc đăng ký các RabbitMQ consumer lắng nghe queue và vô hiệu hóa chạy logic cron.
- `worker:booking`: Chỉ chạy các consumers (`BookingConsumer`, `BookingDlxConsumer`) và cronjobs (`OrderExpirationCron`) liên quan đến module đặt vé.
- `worker:background`: Chỉ chạy các consumers (`AIConsumer`, `NotificationConsumer`) và cronjobs (`NotificationCleanupService`) liên quan đến AI và Email/SMS.
- `worker`: Chạy tất cả các consumers và cronjobs (tương đương hợp nhất cả booking và background workers).
- `all` (Mặc định): Chạy đồng thời tất cả các vai trò (như kiến trúc cũ), đảm bảo tương thích ngược khi phát triển local không qua Docker.

### Decision 2: Phân nhóm khởi chạy Consumers và Cronjobs động
- **Nhóm Booking (Critical Path)**:
  - Các thành phần: `BookingConsumer`, `BookingDlxConsumer`, `OrderExpirationCron`.
  - Chỉ được kích hoạt khi `INSTANCE_ROLE` thuộc danh sách: `['all', 'worker', 'worker:booking']`.
- **Nhóm Background (Auxiliary Path)**:
  - Các thành phần: `AIConsumer`, `NotificationConsumer`, `NotificationCleanupService`.
  - Chỉ được kích hoạt khi `INSTANCE_ROLE` thuộc danh sách: `['all', 'worker', 'worker:background']`.

Tại hàm `onModuleInit()` của mỗi Consumer class và tại đầu mỗi hàm Cron, hệ thống sẽ kiểm tra danh sách cho phép tương ứng. Nếu vai trò hiện tại không khớp, log thông báo bỏ qua và return ngay lập tức.

### Decision 3: Khởi chạy Standalone Context cho Worker
Trong `main.ts`, nếu `INSTANCE_ROLE` bắt đầu bằng `worker`:
- Sử dụng `NestFactory.createApplicationContext(AppModule)` để khởi động.
- Tránh chạy các cấu hình global liên quan đến HTTP như `ValidationPipe`, Interceptors, Filters và không gọi `app.listen()`.
- Điều này tiết kiệm tài nguyên hệ thống tối đa và không expose cổng HTTP không cần thiết trên container worker.

### Decision 4: Cấu hình Docker Compose Multi-instance local
- Bổ sung `src/backend/Dockerfile` sử dụng base image `node:18-alpine` hỗ trợ cài đặt và chạy ứng dụng trong container.
- Cấu hình `docker-compose.yml` định nghĩa các dịch vụ:
  - `ticketbox-api`: chạy ở chế độ `api`, map cổng `3000:3000`.
  - `ticketbox-worker`: chạy ở chế độ `worker` (hợp nhất tất cả worker để tiết kiệm RAM ở môi trường local).
- Ở môi trường Staging/Production thực tế (như Kubernetes hoặc ECS), DevOps có thể triển khai thành 3 cụm riêng biệt: `api`, `worker:booking` và `worker:background` chỉ bằng cách cấu hình biến môi trường trên container tương ứng mà không cần chỉnh sửa code.
- Sử dụng volume mapping `./src/backend:/app` cùng với loại trừ `/app/node_modules` để đồng bộ source code thời gian thực từ máy host vào container, giúp NestJS CLI watch mode phát hiện thay đổi và restart app tự động.

### Decision 5: Phân tách cấu hình biến môi trường (Root .env vs src/backend/.env)
- **Tách file .env**: Tách cấu hình môi trường ra hai phạm vi rõ rệt:
  - **Root .env**: Chỉ chứa các biến phục vụ Docker Compose (cấu hình port mapping cho host và thông tin khởi tạo DB).
  - **src/backend/.env**: Chứa toàn bộ cấu hình nghiệp vụ của NestJS (cổng HTTP, JWT secret, SMTP, Cloudinary, Gemini API key) và cấu hình kết nối cục bộ khi chạy trực tiếp trên host.
- **Environment Overriding**: Trong `docker-compose.yml`, sử dụng chỉ thị `env_file: - ./src/backend/.env` để nạp các tham số nghiệp vụ vào container, và sử dụng `environment:` để ghi đè (override) các địa chỉ kết nối cụ thể (như `DB_HOST=postgres`) sang địa chỉ trong mạng nội bộ Docker.
- **Thứ tự ưu tiên trong code**: Cập nhật `app.module.ts` để ưu tiên tìm file `.env` cục bộ tại thư mục chạy lệnh (`process.cwd()`) trước các thư mục fallback bên ngoài.

## Risks / Trade-offs

- **[Risk] Lỗi kết nối giữa host và Docker do phân giải DNS**
  - *Mitigation*: Khi chạy ứng dụng trực tiếp trên máy host, kết nối tới Postgres/Redis/RabbitMQ qua `localhost`. Khi chạy trong Docker Compose, phải kết nối qua tên dịch vụ (`postgres`, `redis`, `rabbitmq`). Chúng ta nạp toàn bộ cấu hình từ `src/backend/.env` cục bộ cho container qua `env_file`, sau đó dùng khối `environment` trong `docker-compose.yml` để override đè các địa chỉ IP/HOST tương ứng.
- **[Risk] Cronjob bị kích hoạt trùng lặp nếu cấu hình role `all` hoặc `worker` trên nhiều thực thể chạy song song**
  - *Mitigation*: Trong môi trường container hóa (Docker Compose), đặt explicit `INSTANCE_ROLE=api` cho API container và `INSTANCE_ROLE=worker` cho Worker container. Chỉ dùng `INSTANCE_ROLE=all` cho môi trường phát triển nhanh trực tiếp trên máy host.
