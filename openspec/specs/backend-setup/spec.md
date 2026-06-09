# backend-setup Specification

## Purpose
TBD - created by archiving change setup-backend. Update Purpose after archive.
## Requirements
### Requirement: Khởi chạy ứng dụng NestJS thành công
Hệ thống SHALL cung cấp một khung ứng dụng NestJS TypeScript hoạt động bình thường, có khả năng khởi động và nhận yêu cầu HTTP.

#### Scenario: Khởi động ứng dụng NestJS thành công
- **WHEN** Chạy lệnh `npm run start:dev` trong thư mục `src/backend`
- **THEN** Hệ thống khởi chạy không gặp lỗi và hiển thị log sẵn sàng nhận kết nối tại port cấu hình

### Requirement: Cung cấp đầy đủ hạ tầng local qua Docker Compose
Hệ thống SHALL thiết lập tệp cấu hình Docker Compose để khởi chạy đầy đủ các dịch vụ cơ sở hạ tầng bổ trợ (PostgreSQL, Redis, RabbitMQ) cho môi trường phát triển local.

#### Scenario: Khởi chạy các dịch vụ phụ trợ Docker thành công
- **WHEN** Thực hiện lệnh `docker compose up -d` tại thư mục gốc của dự án
- **THEN** Các dịch vụ PostgreSQL (5432), Redis (6379), và RabbitMQ (5672, 15672) được khởi chạy thành công và lắng nghe kết nối

### Requirement: Tự động kết nối cơ sở dữ liệu và hàng đợi khi khởi động
Hệ thống SHALL tự động thiết lập và kiểm tra kết nối từ ứng dụng NestJS tới PostgreSQL (thông qua TypeORM), Redis client, và RabbitMQ khi ứng dụng khởi chạy.

#### Scenario: Kết nối thành công tới các dịch vụ cơ sở hạ tầng
- **WHEN** Ứng dụng NestJS được khởi động thành công trong khi các container Docker đang chạy
- **THEN** Các module TypeORM, Redis client, và RabbitMQ Client kết nối thành công mà không ném lỗi kết nối

