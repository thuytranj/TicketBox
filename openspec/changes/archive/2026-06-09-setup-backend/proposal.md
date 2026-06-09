## Why

Hiện tại thư mục `src/backend` chưa có mã nguồn. Đợt thay đổi này cần thiết lập nền tảng dự án Backend bằng NestJS (TypeScript), cấu hình Docker Compose cho các dịch vụ phụ trợ (PostgreSQL, Redis, RabbitMQ), và thiết lập các kết nối cơ bản để chuẩn bị cho việc phát triển các mô-đun nghiệp vụ tiếp theo của TicketBox.

## What Changes

- Khởi tạo khung dự án NestJS TypeScript tại thư mục `src/backend`.
- Thiết lập tệp `docker-compose.yml` ở thư mục gốc để chạy các dịch vụ local: PostgreSQL (port 5432), Redis (port 6379), RabbitMQ (port 5672, management 15672).
- Cấu hình Module Cấu hình (`ConfigModule` đọc `.env`) và cài đặt các phụ thuộc cơ bản (TypeORM, pg, amqplib, ioredis).
- Thiết lập cấu trúc thư mục modular monolith cơ bản.

## Capabilities

### New Capabilities

- `backend-setup`: Cấu trúc khung Backend NestJS, môi trường Docker Compose và cấu hình kết nối Database/Redis/RabbitMQ cơ bản.

### Modified Capabilities

<!-- Không có đặc tả nào bị thay đổi yêu cầu nghiệp vụ -->
