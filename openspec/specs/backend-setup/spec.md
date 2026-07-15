# backend-setup Specification

## Purpose
TBD - created by archiving change setup-backend. Update Purpose after archive.
## Requirements
### Requirement: Khởi chạy ứng dụng NestJS thành công
Hệ thống SHALL cung cấp một khung ứng dụng NestJS TypeScript hoạt động bình thường, có khả năng khởi động theo các vai trò khác nhau thông qua biến môi trường `INSTANCE_ROLE` (`all`, `api`, `worker`, `worker:booking`, `worker:background`).

#### Scenario: Khởi động ứng dụng NestJS thành công với vai trò API
- **WHEN** Khởi động ứng dụng với biến môi trường `INSTANCE_ROLE=api`
- **THEN** Hệ thống khởi chạy thành công, mở cổng HTTP nhận kết nối và KHÔNG khởi tạo các RabbitMQ consumers hay chạy Cronjobs của toàn bộ các module

#### Scenario: Khởi động ứng dụng NestJS thành công với vai trò Booking Worker
- **WHEN** Khởi động ứng dụng với biến môi trường `INSTANCE_ROLE=worker:booking`
- **THEN** Hệ thống khởi chạy thành công dưới dạng Standalone Context, chỉ khởi chạy các RabbitMQ consumers và Cronjobs liên quan đến Booking, đồng thời KHÔNG khởi chạy các consumers hay cronjobs liên quan đến AI/Notification

#### Scenario: Khởi động ứng dụng NestJS thành công với vai trò Background Worker
- **WHEN** Khởi động ứng dụng với biến môi trường `INSTANCE_ROLE=worker:background`
- **THEN** Hệ thống khởi chạy thành công dưới dạng Standalone Context, chỉ khởi chạy các RabbitMQ consumers và Cronjobs liên quan đến AI/Notification, đồng thời KHÔNG khởi chạy các consumers hay cronjobs liên quan đến Booking

#### Scenario: Khởi động ứng dụng NestJS thành công với vai trò Worker chung
- **WHEN** Khởi động ứng dụng với biến môi trường `INSTANCE_ROLE=worker`
- **THEN** Hệ thống khởi chạy thành công dưới dạng Standalone Context, khởi động tất cả các RabbitMQ consumers và Cronjobs của toàn bộ các module

#### Scenario: Khởi động ứng dụng NestJS thành công với vai trò All-in-one
- **WHEN** Khởi động ứng dụng với biến môi trường `INSTANCE_ROLE=all` hoặc không khai báo
- **THEN** Hệ thống khởi chạy thành công, mở cổng HTTP và đồng thời khởi chạy tất cả các RabbitMQ consumers cùng Cronjobs

### Requirement: Cung cấp đầy đủ hạ tầng local qua Docker Compose
Hệ thống SHALL thiết lập tệp cấu hình Docker Compose để khởi chạy đầy đủ các dịch vụ cơ sở hạ tầng bổ trợ (PostgreSQL, Redis, RabbitMQ), các container instance của ứng dụng chạy đa tiến trình (`ticketbox-api` scale N bản sao, `ticketbox-booking-worker`, `ticketbox-background-worker`) và cổng định tuyến Nginx làm cổng tiếp nhận duy nhất cho môi trường phát triển local.

#### Scenario: Khởi chạy các dịch vụ phụ trợ Docker thành công
- **WHEN** Thực hiện lệnh `docker compose up -d` tại thư mục gốc của dự án
- **THEN** Các dịch vụ PostgreSQL (5432), Redis (6379), RabbitMQ (5672, 15672), Nginx Load Balancer (3000), cùng các container API và các workers chuyên biệt (`ticketbox-booking-worker`, `ticketbox-background-worker`) được khởi chạy thành công và hoạt động ổn định

### Requirement: Tự động kết nối cơ sở dữ liệu và hàng đợi khi khởi động
Hệ thống SHALL tự động thiết lập và kiểm tra kết nối từ ứng dụng NestJS tới PostgreSQL (thông qua TypeORM), Redis client, và RabbitMQ khi ứng dụng khởi chạy.

#### Scenario: Kết nối thành công tới các dịch vụ cơ sở hạ tầng
- **WHEN** Ứng dụng NestJS được khởi động thành công trong khi các container Docker đang chạy
- **THEN** Các module TypeORM, Redis client, và RabbitMQ Client kết nối thành công mà không ném lỗi kết nối

