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
Hệ thống sử dụng cấu trúc phân tách biến môi trường để đảm bảo tính bảo mật và độc lập:
1. **Root `.env`**: Chỉ chứa cấu hình ánh xạ cổng và thông tin khởi tạo database cho Docker Compose. Tạo từ file mẫu tại thư mục gốc dự án:
   ```bash
   # Đứng tại thư mục gốc của dự án
   cp .env.example .env
   ```
2. **Backend `.env`**: Chứa cấu hình cổng chạy local, thông tin kết nối DB, JWT secrets, SMTP, Cloudinary và các API keys dịch vụ bên ngoài (NestJS). Tạo từ file mẫu tại `src/backend`:
   ```bash
   # Đứng tại thư mục src/backend
   cp .env.example .env
   ```
   *Hãy mở tệp `src/backend/.env` vừa tạo và điền các khóa bảo mật thích hợp (JWT_SECRET, GEMINI_API_KEY, SMTP_USER, v.v.) trước khi khởi chạy.*

### Bước 3: Khởi chạy cơ sở hạ tầng (PostgreSQL, Redis, RabbitMQ)
Chạy lệnh sau tại thư mục gốc của dự án để khởi chạy các container hạ tầng:
```bash
# Đứng tại thư mục gốc của dự án
docker compose up -d postgres redis rabbitmq
```
Kiểm tra trạng thái các container bằng lệnh:
```bash
docker compose ps
```
Đảm bảo 3 container `ticketbox-postgres`, `ticketbox-redis`, và `ticketbox-rabbitmq` đều đang ở trạng thái `running`.

---

## 3. Khởi chạy Ứng dụng & Quy trình Lập trình (Developer Workflow)

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

### Bước 3: Lựa chọn Quy trình Khởi chạy (Workflow)

Hệ thống được thiết kế theo kiến trúc **Multi-instance Modular Monolith**. Khi phát triển ứng dụng, lập trình viên có thể lựa chọn một trong hai quy trình làm việc sau:

#### Workflow A: Chạy trực tiếp trên Host (Khuyên dùng khi viết code & debug hàng ngày)
*Workflow này giúp ứng dụng khởi chạy cực kỳ nhanh, hot-reload tức thời khi sửa code và dễ dàng sử dụng các công cụ debugger đặt breakpoint trong IDE (Cursor/VS Code).*

1. **Khởi động hạ tầng** (nếu chưa chạy ở Bước 3 phần trên):
   ```bash
   # Đứng tại thư mục gốc dự án
   docker compose up -d postgres redis rabbitmq
   ```
2. **Chạy ứng dụng backend**:
   ```bash
   # Đứng tại thư mục src/backend
   npm run start:dev
   ```
   *Lúc này ứng dụng chạy ở chế độ All-in-one (`INSTANCE_ROLE=all`), tự động mở cổng HTTP 3000 và chạy toàn bộ consumers/cronjobs chung một tiến trình trên host.*

#### Workflow B: Chạy hoàn toàn trên Docker Compose (Kiểm thử tích hợp, Cân bằng tải & Cận Production)
*Workflow này mô phỏng chính xác môi trường triển khai thực tế bằng cách chạy nhiều bản sao API phía sau Nginx Load Balancer, đồng thời chia tách cụ thể các vai trò Booking Worker và Background Worker thành các container độc lập.*

1. **Khởi động toàn bộ dịch vụ (chạy mặc định 1 API instance)**:
   ```bash
   # Đứng tại thư mục gốc dự án
   docker compose up --build -d
   ```
   *Hệ thống sẽ khởi chạy Postgres, Redis, RabbitMQ cùng với 1 instance `ticketbox-api` (expose cổng 3000 nội bộ), `ticketbox-booking-worker`, `ticketbox-background-worker`, và cổng tiếp nhận duy nhất `nginx-lb` ánh xạ ra cổng `3000` của máy host.*

2. **Khởi chạy hoặc mở rộng nhiều API instances (Cân bằng tải)**:
   Nếu muốn test tải hoặc kiểm tra tính đồng bộ của Socket.io Redis Adapter trên nhiều instances chạy song song, bạn có thể scale số lượng API:
   ```bash
   # Tăng số lượng API instances lên 3 bản sao
   docker compose up --scale ticketbox-api=3 -d
   ```
   *Nginx Load Balancer sẽ tự động phân phối các request HTTP và kết nối WebSockets (đã đồng bộ qua Redis) đều sang 3 instances API.*

3. **Theo dõi logs của từng cụm thực thể**:
   * Xem log Nginx Load Balancer: `docker compose logs -f nginx-lb`
   * Xem log tất cả API instances: `docker compose logs -f ticketbox-api`
   * Xem log Booking Worker: `docker compose logs -f ticketbox-booking-worker`
   * Xem log Background Worker: `docker compose logs -f ticketbox-background-worker`

4. **Dừng toàn bộ hệ thống**:
   ```bash
   # Đứng tại thư mục gốc dự án
   docker compose down
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
