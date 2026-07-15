## Context

Dự án TicketBox yêu cầu xây dựng hệ thống backend chịu tải cao, an toàn và có khả năng mở rộng tốt. Thư mục `src/backend` hiện tại hoàn toàn trống rỗng. Việc thiết lập ban đầu bao gồm cài đặt khung NestJS, cấu hình Docker Compose cho các dịch vụ cơ sở hạ tầng (PostgreSQL, Redis, RabbitMQ) và cài đặt kết nối cơ bản là nền tảng tối quan trọng trước khi đi vào xây dựng các tính năng nghiệp vụ.

## Goals / Non-Goals

**Goals:**
- Khởi tạo thành công dự án NestJS (với TypeScript) trong thư mục `src/backend`.
- Thiết lập tệp `docker-compose.yml` chạy PostgreSQL, Redis và RabbitMQ ở môi trường local.
- Cấu hình kết nối cơ sở dữ liệu sử dụng TypeORM kết nối PostgreSQL.
- Cấu hình kết nối hàng đợi RabbitMQ sử dụng giao thức AMQP.
- Cấu hình kết nối Redis phục vụ caching và rate limiting.
- Thiết lập cấu trúc thư mục modular monolith khoa học, phân chia rõ ràng các module nghiệp vụ: Auth, Concert, Booking, Payment, Check-in, Notification, Common.

**Non-Goals:**
- Chưa triển khai bất kỳ API nghiệp vụ nào (chưa code logic đặt vé, soát vé hay tạo tài khoản).
- Chưa cấu hình deploy lên Cloud hay CI/CD production.

## Decisions

### 1. Phương thức khởi tạo dự án
- **Quyết định:** Sử dụng `@nestjs/cli` phiên bản mới nhất để khởi tạo khung dự án mẫu bằng lệnh `npx -y @nestjs/cli new . --directory . --package-manager npm` để giữ cấu hình NestJS tiêu chuẩn và tự động cài đặt các dependencies mặc định.

### 2. Cấu hình môi trường qua .env
- **Quyết định:** Sử dụng `@nestjs/config` (dựa trên thư viện `dotenv`) để quản lý các biến cấu hình (Database credentials, Redis host, RabbitMQ URL, JWT secret).
- **Lý do:** Đây là giải pháp tiêu chuẩn của NestJS giúp dễ dàng chuyển đổi cấu hình giữa môi trường local, staging và production mà không cần thay đổi mã nguồn.

### 3. Thiết kế cấu trúc thư mục (Modular Monolith)
- **Quyết định:** Phân chia các thư mục con theo cấu trúc dự án NestJS tiêu chuẩn với thư mục nguồn đặt tại `src/backend/src/`:
  ```
  src/backend/
  ├── package.json
  ├── tsconfig.json
  ├── nest-cli.json
  └── src/                  # Thư mục mã nguồn NestJS tiêu chuẩn
      ├── app.module.ts
      ├── main.ts
      ├── common/           # Các cấu hình dùng chung (filters, guards, interceptors, utils)
      └── modules/
          ├── auth/         # Module xác thực & phân quyền
          ├── concerts/     # Module quản lý concert
          ├── bookings/     # Module đặt vé (Engine)
          ├── payments/     # Module thanh toán (Circuit Breaker & Webhook)
          ├── checkin/      # Module soát vé (Online & Offline sync)
          └── notification/ # Module thông báo (Email & In-app workers)
  ```
- **Lý do:** Giúp hệ thống module hóa rõ ràng, dễ dàng bảo trì và cô lập lỗi, đồng thời tạo tiền đề nếu sau này muốn tách thành các Microservices độc lập.

### 4. Cấu hình TypeORM CLI & Seeder độc lập cho Terminal
- **Quyết định:** Thiết lập một `DataSource` và cấu hình hợp nhất tại `src/db/ormconfig.ts` tự nạp cấu hình `.env` thông qua thư viện `dotenv`. Cài đặt thư viện `typeorm-extension` phục vụ seeding dữ liệu mẫu và thêm các script tương ứng vào `package.json`.
- **Lý do:** Giúp chạy các lệnh CLI quản trị database (như sinh/chạy migrations, khởi tạo DB seed) trực tiếp từ Terminal một cách dễ dàng và nhanh chóng mà không phụ thuộc vào chu kỳ khởi chạy của ứng dụng NestJS, đồng thời đồng nhất cấu hình ORM cho cả CLI và ứng dụng chính.

## Risks / Trade-offs

| Rủi ro | Chiến lược giảm thiểu |
|:---|:---|
| **Xung đột phiên bản cổng dịch vụ** | Sử dụng các port tiêu chuẩn nhưng có cấu hình custom trong `.env` và `docker-compose.yml` để tránh trùng với các phần mềm chạy ngầm trên máy local của lập trình viên. |
| **Lỗi khởi động Docker do thiếu tài nguyên** | Cấu hình giới hạn RAM/CPU hợp lý cho các container trong tệp `docker-compose.yml` để đảm bảo hệ thống chạy mượt trên các máy phát triển cá nhân. |
