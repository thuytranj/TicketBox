# TicketBox Backend API — Hướng dẫn Cài đặt & Khởi chạy

Dịch vụ backend của hệ thống bán vé sự kiện TicketBox được xây dựng trên framework **NestJS** theo kiến trúc **Modular Monolith**, kết hợp các dịch vụ lưu trữ và điều phối:
- **PostgreSQL** làm cơ sở dữ liệu quan hệ chính (sử dụng UUID v7).
- **Redis** làm bộ nhớ đệm (Cache-aside) và quản lý số lượng vé khả dụng thời gian thực (real-time inventory).
- **RabbitMQ** làm Message Broker cho xử lý đặt vé và gửi thông báo bất đồng bộ.

---

## 1. Yêu cầu hệ thống

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt các phần mềm sau:
- **Node.js** >= 18.x (khuyên dùng phiên bản LTS mới nhất)
- **NPM** >= 9.x
- **Docker & Docker Compose** (để khởi chạy PostgreSQL, Redis, RabbitMQ)

---

## 2. Các bước cài đặt chi tiết

### Bước 1: Cài đặt các thư viện phụ thuộc (Dependencies)
Truy cập vào thư mục `src/backend` và thực hiện cài đặt:
```bash
cd src/backend
npm install
```

### Bước 2: Thiết lập biến môi trường (`.env`)
Tạo tệp cấu hình `.env` tại thư mục gốc (Root) của toàn bộ dự án `TicketBox` từ tệp `.env.example` mẫu:
```bash
# Đứng tại thư mục src/backend
cp ../../.env.example ../../.env
```
Mở tệp `../../.env` và điền cấu hình cơ sở dữ liệu, ví dụ:
```env
# App Configuration
PORT=3000
NODE_ENV=development

# Database Configuration (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=
DB_DATABASE=ticketbox

# Cache Configuration (Redis)
REDIS_HOST=localhost
REDIS_PORT=6379

# Message Broker Configuration (RabbitMQ)
RABBITMQ_PORT=5672
RABBITMQ_MANAGEMENT_PORT=15672
RABBITMQ_URL=amqp://localhost:5672

# Security Configuration
JWT_SECRET=super_secret_key_for_jwt
JWT_REFRESH_SECRET=super_secret_key_for_refresh_jwt

# Email configuration
SMTP_HOST=
SMTP_PORT=
SMTP_USER=your_mailtrap_user
SMTP_PASSWORD=your_mailtrap_password
SMTP_FROM_EMAIL=
```

### Bước 3: Khởi chạy cơ sở hạ tầng (PostgreSQL, Redis, RabbitMQ)
Chạy lệnh sau tại thư mục chứa tệp `docker-compose.yml` (thư mục gốc của dự án) để khởi chạy các container:
```bash
# Đứng tại thư mục gốc của dự án
docker compose up -d
```
Kiểm tra trạng thái các container bằng lệnh:
```bash
docker compose ps
```
Đảm bảo 3 container `ticketbox-postgres`, `ticketbox-redis`, và `ticketbox-rabbitmq` đều đang ở trạng thái `running`.

---

## 3. Khởi chạy Ứng dụng

### Bước 1: Chạy Database Migrations
Tạo cấu trúc bảng trong cơ sở dữ liệu PostgreSQL thông qua migration của TypeORM:
```bash
# Đứng tại thư mục src/backend
npm run migration:run
```

### Bước 2: Nạp dữ liệu mẫu (Seed Data)
Nạp dữ liệu thử nghiệm ban đầu (bao gồm thông tin các buổi hòa nhạc, danh sách hạng vé chuẩn như GA, SVIP, VIP...) vào database:
```bash
# Đứng tại thư mục src/backend
npm run db:seed
```

### Bước 3: Khởi chạy Server
* **Chế độ phát triển (Development mode với hot-reload):**
  ```bash
  npm run start:dev
  ```
  API Server sẽ khởi chạy tại địa chỉ: `http://localhost:3000`.

* **Chế độ biên dịch và chạy Production (Production mode):**
  ```bash
  npm run build
  npm run start:prod
  ```

---

## 4. Kiểm thử (Testing)

Hệ thống sử dụng **Jest** và **ts-jest** để viết các bài kiểm tra tự động.

* **Chạy toàn bộ các bài kiểm tra (Unit & Integration Tests):**
  ```bash
  npm run test
  ```

* **Chạy riêng các kiểm thử cho module Hòa nhạc (Concerts & Ticket Types):**
  ```bash
  npm run test -- src/concert
  ```

* **Kiểm tra độ bao phủ mã nguồn (Test Coverage):**
  ```bash
  npm run test:cov
  ```

---

## 5. Cấu trúc thư mục chính của Backend

```text
src/backend/src/
├── app.module.ts            # Root module kết nối toàn bộ hệ thống
├── main.ts                  # Entrypoint khởi động NestJS API Server
├── auth/                    # Module xác thực người dùng (JWT, Passport, RBAC)
├── common/                  # Các bộ lọc lỗi, interceptors, và RedisService dùng chung
├── concert/                 # Quản lý Hòa nhạc & Loại vé (Controller, Service, Entities, DTOs)
│   ├── dto/                 # DTOs validate dữ liệu đầu vào cho Concert/TicketType
│   ├── entities/            # ORM Entities định nghĩa bảng Postgres
│   ├── concert.service.ts   # Xử lý logic nghiệp vụ, phân trang, Cache-aside, Hybrid cache
│   └── concert.controller.ts# Định nghĩa các REST API Endpoints
├── data/                    # Cấu hình kết nối ORM, Migrations và Seeding dữ liệu
└── notification/            # Xử lý thông báo qua Email & In-app bất đồng bộ qua RabbitMQ
```
