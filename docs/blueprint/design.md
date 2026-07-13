# TicketBox — Technical Design

## Mục lục

- [Kiến trúc tổng thể](#kiến-trúc-tổng-thể)
- [C4 Diagram](#c4-diagram)
  - [Level 1 — System Context](#level-1--system-context)
  - [Level 2 — Container Diagram](#level-2--container-diagram)
- [High-Level Architecture Diagram](#high-level-architecture-diagram)
- [Thiết kế cơ sở dữ liệu](#thiết-kế-cơ-sở-dữ-liệu)
  - [Lựa chọn Database Engine](#lựa-chọn-database-engine)
  - [Lựa chọn Primary Key Strategy](#lựa-chọn-primary-key-strategy)
  - [Entity-Relationship Diagram (ERD)](#entity-relationship-diagram-erd)
- [Thiết kế kiểm soát truy cập](#thiết-kế-kiểm-soát-truy-cập)
  - [Mô hình phân quyền: Role-Based Access Control (RBAC)](#mô-hình-phân-quyền-role-based-access-control-rbac)
  - [Nhóm người dùng và quyền truy cập](#nhóm-người-dùng-và-quyền-truy-cập)
  - [Cách kiểm tra quyền tại từng điểm truy cập](#cách-kiểm-tra-quyền-tại-từng-điểm-truy-cập)
- [Thiết kế các cơ chế bảo vệ hệ thống](#thiết-kế-các-cơ-chế-bảo-vệ-hệ-thống)
  - [Kiểm soát tải đột biến (Rate Limiting)](#kiểm-soát-tải-đột-biến-rate-limiting)
  - [Xử lý cổng thanh toán không ổn định (Circuit Breaker)](#xử-lý-cổng-thanh-toán-không-ổn-định-circuit-breaker)
  - [Chống trừ tiền hai lần (Idempotency Key)](#chống-trừ-tiền-hai-lần-idempotency-key)
  - [Caching (Cache-aside với Redis)](#caching-cache-aside-với-redis)
- [Chiến lược xử lý High Concurrency](#chiến-lược-xử-lý-high-concurrency)
- [Soát vé Ngoại tuyến (Offline Check-in)](#soát-vé-ngoại-tuyến-offline-check-in)
- [Hệ thống Thông báo (Notification Architecture)](#hệ-thống-thông-báo-notification-architecture)
- [Nhập danh sách khách mời VIP từ CSV (VIP Guest List Import)](#nhập-danh-sách-khách-mời-vip-từ-csv-vip-guest-list-import)
- [Tích hợp AI Artist Bio (AI Artist Bio Integration)](#tích-hợp-ai-artist-bio-ai-artist-bio-integration)
- [Các quyết định kỹ thuật quan trọng (ADR)](#các-quyết-định-kỹ-thuật-quan-trọng-adr)
  - [ADR-01: Chọn Message Broker — RabbitMQ vs Kafka vs BullMQ](#adr-01-chọn-message-broker--rabbitmq-vs-kafka-vs-bullmq)
  - [ADR-02: Chọn Rate Limiter Storage — Redis vs In-Memory](#adr-02-chọn-rate-limiter-storage--redis-vs-in-memory)
  - [ADR-03: Chọn ORM — TypeORM vs Prisma vs Knex](#adr-03-chọn-orm--typeorm-vs-prisma-vs-knex)
  - [ADR-04: Notification — In-app (DB) + Email (Mock SMTP) vs Push Notification (FCM)](#adr-04-notification--in-app-db--email-mock-smtp-vs-push-notification-fcm)
- [Risks / Trade-offs](#risks--trade-offs)

---

## Kiến trúc tổng thể

### Các phương án cân nhắc

| #   | Phương án                     | Mô tả                                                                                                                                                                                  |
| --- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **Microservices**             | Mỗi domain (Booking, Payment, Concert, Check-in, Notification) là một service độc lập, giao tiếp qua message broker hoặc gRPC. Mỗi service có database riêng.                          |
| B   | **Modular Monolith (NestJS)** | Một ứng dụng NestJS duy nhất, phân chia thành các module độc lập theo domain. Các module giao tiếp qua dependency injection trong cùng process. Chia sẻ chung một database PostgreSQL. |
| C   | **Monolith truyền thống**     | Một ứng dụng không phân chia module rõ ràng, tất cả logic nằm trong cùng các controller/service chung.                                                                                 |

### Đánh giá

| Tiêu chí                         | Microservices                                                      | Modular Monolith                              | Monolith truyền thống               |
| -------------------------------- | ------------------------------------------------------------------ | --------------------------------------------- | ----------------------------------- |
| Độ phức tạp triển khai           | ❌ Rất cao (nhiều service, service discovery, distributed tracing) | ✅ Thấp (1 container NestJS)                  | ✅ Rất thấp                         |
| Khả năng scale độc lập           | ✅ Scale từng service riêng                                        | ⚠️ Scale cả app, nhưng có thể tách module sau | ❌ Scale cả khối                    |
| Phù hợp quy mô đồ án             | ❌ Quá nặng cho team nhỏ / đồ án                                   | ✅ Phù hợp                                    | ✅ Phù hợp nhưng khó mở rộng        |
| Tách biệt domain                 | ✅ Tách biệt hoàn toàn                                             | ✅ Tách biệt logic qua NestJS Module          | ❌ Không tách biệt                  |
| Dễ chuyển sang Microservices sau | —                                                                  | ✅ Module boundary rõ ràng, dễ tách           | ❌ Phải refactor toàn bộ            |
| Transaction xuyên module         | ❌ Cần Saga pattern phức tạp                                       | ✅ Dùng DB transaction thông thường           | ✅ Dùng DB transaction thông thường |

### Chốt giải pháp: Phương án B — Multi-instance Modular Monolith (NestJS)

**Lý do:**

- Đồ án do team nhỏ thực hiện, Microservices gây quá tải về hạ tầng và vận hành (service mesh, distributed tracing, Saga pattern). Chi phí không xứng đáng với lợi ích.
- Modular Monolith giữ được **ranh giới module rõ ràng** (mỗi NestJS Module là một domain context) giống Microservices về mặt kiến trúc logic.
- **Kiến trúc Multi-instance**: Toàn bộ hệ thống chạy chung một codebase duy nhất, nhưng khi triển khai (Docker Compose / Production) sẽ được chia tách thành các thực thể chuyên biệt thông qua cấu hình biến môi trường `INSTANCE_ROLE` (`api`, `worker:booking`, `worker:background`, `worker`, `all`). Điều này giúp cô lập hoàn toàn tải xử lý và đảm bảo hiệu năng tối đa cho luồng đặt vé chính (Critical Booking Path) mà không tăng độ phức tạp trong quản lý mã nguồn.
- Các tác vụ nặng (booking, notification, AI) đã được tách ra xử lý bất đồng bộ qua các cụm RabbitMQ Worker chuyên biệt, tránh việc nghẽn cổ chai tại tiến trình phục vụ HTTP API.
- Nếu sau này cần scale, có thể tách module thành service độc lập hoàn toàn mà không phải viết lại mã nguồn từ đầu.

**Kiến trúc bao gồm:**

- **NestJS Application** được đóng gói và cấu hình chạy theo các vai trò:
  - **API Instance** (`INSTANCE_ROLE=api`): Chuyên xử lý các HTTP API request đồng bộ, vô hiệu hóa các background consumers và crons. Có thể scale ngang thành nhiều bản sao ($N$ instances) phía sau Nginx Load Balancer để chia sẻ tải.
  - **Booking Worker** (`INSTANCE_ROLE=worker:booking`): Chỉ tiêu thụ hàng đợi `booking_queue`, `booking_dlx_queue` và chạy cron hủy đơn hàng quá hạn nhằm bảo vệ luồng xác nhận đơn hàng trọng yếu.
  - **Background Worker** (`INSTANCE_ROLE=worker:background`): Tiêu thụ hàng đợi AI (`ai.generate_bio`), email/sms (`notification_queue`) và chạy cron dọn dẹp định kỳ.
- **PostgreSQL** làm persistent storage chính.
- **Redis** làm cache layer + atomic inventory operations + rate limiting.
- **RabbitMQ** làm message broker cho xử lý bất đồng bộ.
- **Resend** (Email Service API) cho gửi email và **Supabase Storage** cho lưu trữ file tạm khi import VIP.

---

## C4 Diagram

### Level 1 — System Context

```mermaid
flowchart TD
    classDef actor fill:#e8eaf6,stroke:#1a237e,stroke-width:2px,color:#1a237e;
    classDef system fill:#e0f2f1,stroke:#004d40,stroke-width:2px,color:#004d40;
    classDef external fill:#eceff1,stroke:#37474f,stroke-width:2px,color:#37474f;

    KhanGia["Khán giả<br/>(Web Browser)"]:::actor -->|"Xem concert, Đặt vé, Thanh toán,<br/>Xem thông báo"| TicketBox["Hệ thống TicketBox<br/>(NestJS Backend API)"]:::system
    BanToChuc["Ban tổ chức<br/>(Admin Portal)"]:::actor -->|"Tạo - Quản lý concert, <br/>Upload PDF nghệ sĩ,<br/>Cấu hình loại vé,<br/>Theo dõi doanh thu và lượng bán"| TicketBox
    NhanVienSoatVe["Nhân viên Soát vé<br/>(Mobile App)"]:::actor -->|"Quét QR Code<br/>(Online / Offline)"| TicketBox

    TicketBox -->|"Tạo giao dịch thanh toán,<br/>Nhận webhook callback"| VNPAY["VNPAY<br/>(Mock/Sandbox)"]:::external
    TicketBox -->|"Tạo giao dịch thanh toán,<br/>Nhận webhook callback"| MoMo["MoMo<br/>(Mock/Sandbox)"]:::external
    TicketBox -->|"Gửi văn bản,<br/>Nhận tóm tắt tiểu sử"| GeminiAI["Google Gemini API"]:::external
    TicketBox -->|"Gửi email qua API"| Resend["Resend<br/>(Email Service API)"]:::external
    TicketBox -->|"Upload ảnh poster concert,<br/>Nhận CDN URL"| Cloudinary["Cloudinary<br/>(Cloud Image Storage / CDN)"]:::external
    TicketBox -->|"Tạm lưu file CSV khách mời VIP,<br/>Tải file để xử lý"| Supabase["Supabase Storage<br/>(Object Storage)"]:::external
    BanToChuc -.->|"Cung cấp tệp CSV<br/>danh sách khách mời VIP"| TicketBox
```

### Level 2 — Container Diagram

```mermaid
flowchart TD
    classDef actor fill:#e8eaf6,stroke:#1a237e,stroke-width:2px,color:#1a237e;
    classDef client fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#4a148c;
    classDef gateway fill:#eceff1,stroke:#37474f,stroke-width:2px,color:#37474f;
    classDef app fill:#e0f2f1,stroke:#004d40,stroke-width:2px,color:#004d40;
    classDef db fill:#fff8e1,stroke:#ff6f00,stroke-width:2px,color:#824a00;
    classDef mq fill:#fbe9e7,stroke:#bf360c,stroke-width:2px,color:#bf360c;
    classDef external fill:#fce4ec,stroke:#880e4f,stroke-width:2px,color:#880e4f;

    %% Actors (Tác nhân hệ thống)
    KhanGia["Khán giả<br/>(Person)"]:::actor
    BanToChuc["Ban tổ chức<br/>(Person)"]:::actor
    NhanVienSoatVe["Nhân viên soát vé<br/>(Person)"]:::actor

    subgraph TicketBoxSystem["Hệ thống TicketBox (System Boundary)"]
        %% Clients
        WebApp["Web Application<br/>(React)"]:::client
        MobileApp["Mobile Check-in App<br/>(Flutter)"]:::client

        %% Gateway
        OpenResty["OpenResty<br/>(API Gateway / Reverse Proxy / Load Balancer)"]:::gateway

        %% API Instances
        NestJSAPI["NestJS API Instance<br/>(HTTP Server)"]:::app

        %% Worker Instances
        BookingWorker["Booking Worker<br/>(Queue Consumer - Cron)"]:::app
        BackgroundWorker["Background Worker<br/>(AI - Notification)"]:::app

        %% Databases - Broker
        Postgres[("PostgreSQL Database<br/>(Primary Storage — UUID v7)")]:::db
        Redis[("Redis Cache / Store<br/>(Cache + Atomic Ops + Rate Limit)")]:::db
        RabbitMQ{{"RabbitMQ Message Broker<br/>(Booking Queue + Notif Exchange)"}}:::mq
    end

    %% External Systems (Hệ thống bên ngoài)
    VNPAY["VNPAY<br/>(Payment Gateway)"]:::external
    MoMo["MoMo<br/>(Payment Gateway)"]:::external
    GeminiAPI["Google Gemini API<br/>(AI Service)"]:::external
    Resend["Resend API<br/>(Email Service)"]:::external
    Cloudinary["Cloudinary<br/>(Cloud Image Storage / CDN)"]:::external
    Supabase["Supabase Storage<br/>(Object Storage)"]:::external

    %% Kết nối từ Tác nhân tới Client
    KhanGia -->|"Xem concert, Đặt vé, Thanh toán"| WebApp
    BanToChuc -->|"Quản lý concert, Xem thống kê"| WebApp
    NhanVienSoatVe -->|"Quét mã QR để soát vé"| MobileApp

    %% Kết nối từ Client tới Gateway/Backend
    WebApp -->|"Gửi API requests (HTTPS)"| OpenResty
    MobileApp -->|"Gửi API requests - Đồng bộ (HTTPS)"| OpenResty
    OpenResty -->|"Chuyển tiếp requests (Round-Robin)"| NestJSAPI
    OpenResty -->|"Xác thực JWT & Kiểm tra Rate Limit (Lua)"| Redis

    %% Kết nối từ API Instance tới các Container dữ liệu - hàng đợi
    NestJSAPI -->|"Đọc/Ghi dữ liệu (TypeORM)"| Postgres
    NestJSAPI -->|"Đọc/Ghi Cache, Lock, Idempotency"| Redis
    NestJSAPI -->|"Publish message tasks"| RabbitMQ

    %% Kết nối từ Booking Worker tới các dữ liệu - hàng đợi
    BookingWorker -->|"Đọc/Ghi dữ liệu (TypeORM)"| Postgres
    BookingWorker -->|"Hồi kho / Đọc ghi cache"| Redis
    BookingWorker -->|"Consume booking queues"| RabbitMQ

    %% Kết nối từ Background Worker tới các dữ liệu - hàng đợi
    BackgroundWorker -->|"Đọc/Ghi dữ liệu (TypeORM)"| Postgres
    BackgroundWorker -->|"Đọc/Ghi dữ liệu, Lock, PubSub"| Redis
    BackgroundWorker -->|"Consume AI/Notification/Payment/Check-in/VIP queues"| RabbitMQ

    %% Kết nối tới các Hệ thống bên ngoài từ API
    NestJSAPI -->|"Tạo giao dịch - Nhận webhook"| VNPAY
    NestJSAPI -->|"Tạo giao dịch - Nhận webhook"| MoMo
    NestJSAPI -->|"Upload ảnh poster, Nhận CDN URL"| Cloudinary
    NestJSAPI -->|"Upload file CSV khách mời VIP"| Supabase

    %% Kết nối tới các Hệ thống bên ngoài từ Background Worker
    BackgroundWorker -->|"Gửi văn bản cần tóm tắt"| GeminiAPI
    BackgroundWorker -->|"Gửi email xác nhận / nhắc nhở"| Resend
    BackgroundWorker -->|"Tải & Xóa file CSV khách mời"| Supabase
    Resend -.->|"Gửi email thông báo tới"| KhanGia
```

---

### High-Level Architecture Diagram

Sơ đồ dưới đây mô tả luồng dữ liệu chính của hệ thống, bao gồm booking, payment, notification, AI sinh bio, import CSV khách mời VIP, và luồng soát vé offline dưới sự điều phối của OpenResty Gateway:

```mermaid
flowchart TD
    classDef client fill:#e8eaf6,stroke:#1a237e,stroke-width:2px,color:#1a237e;
    classDef gateway fill:#eceff1,stroke:#37474f,stroke-width:2px,color:#37474f;
    classDef api fill:#e0f7fa,stroke:#006064,stroke-width:2px,color:#006064;
    classDef booking fill:#e0f2f1,stroke:#004d40,stroke-width:2px,color:#004d40;
    classDef payment fill:#fffde7,stroke:#fbc02d,stroke-width:2px,color:#7f6000;
    classDef notification fill:#fce4ec,stroke:#880e4f,stroke-width:2px,color:#880e4f;
    classDef db fill:#fff8e1,stroke:#ff6f00,stroke-width:2px,color:#824a00;
    classDef offline fill:#eceff1,stroke:#37474f,stroke-width:2px,color:#37474f;
    classDef async fill:#ede7f6,stroke:#4527a0,stroke-width:2px,color:#4527a0;
    classDef external fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#2e7d32;

    subgraph ClientLayer["Lớp Client"]
        Web["Web App"]:::client
        Mobile["Mobile Check-in App"]:::client
    end

    subgraph GatewayLayer["Lớp Gateway (OpenResty)"]
        OpenResty["OpenResty API Gateway"]:::gateway
        RateLimit["Rate Limiter (Lua + Redis)<br/>- 10 req/min (bookings)<br/>- 3 req/min (payments)<br/>- 50 req/s IP global"]:::gateway
    end

    subgraph APILayer["Lớp API (NestJS)"]
        API["REST API Controllers"]:::api
        IdempotencyGuard["Idempotency Guard<br/>(Redis Lock)"]:::api
    end

    subgraph BookingEngine["Booking Engine"]
        LuaScript["Redis Lua Script<br/>(Atomic Inventory Check<br/>+ Per-User Limit)"]:::booking
        BookingQueue{{"RabbitMQ<br/>booking.queue"}}:::booking
        BookingWorker["Booking Worker<br/>(Create DB records)"]:::booking
        ExpiryScheduler["Expiry Scheduler<br/>(Hủy đơn pending trên 10 phút)"]:::booking
    end

    subgraph PaymentLayer["Payment Layer"]
        PaymentService["Payment Service"]:::payment
        CircuitBreaker["Circuit Breaker<br/>(opossum)"]:::payment
        PaymentGateway["VNPAY / MoMo<br/>(Mock)"]:::payment
        WebhookHandler["Webhook Handler<br/>(Idempotent)"]:::payment
    end

    subgraph NotificationEngine["Notification Engine"]
        NotifExchange{{"RabbitMQ<br/>notification.exchange<br/>(Topic Exchange)"}}:::notification
        InAppWorker["In-app Worker<br/>(Lưu notification_logs)"]:::notification
        EmailWorker["Email Worker<br/>(QR ký số + Resend API)"]:::notification
        ReminderCron["Concert Reminder<br/>Cron Job (mỗi 5 phút)"]:::notification
    end

    subgraph AsyncJobs["Async Jobs"]
        AIBioQueue{{"RabbitMQ<br/>ai.generate_bio"}}:::async
        AIBioWorker["AI Worker<br/>(Sinh draft bio)"]:::async
        CSVImportQueue{{"RabbitMQ<br/>vip_guest.import"}}:::async
        CSVImportWorker["VIP Import Worker<br/>(Validate CSV + Bulk Insert)"]:::async
    end

    subgraph ExternalServices["External Services"]
        GeminiAPI["Google Gemini API"]:::external
    end

    subgraph DataLayer["Lớp Dữ liệu & Dịch vụ"]
        Redis[("Redis")]:::db
        Postgres[("PostgreSQL")]:::db
        Resend["Resend API"]:::db
        Supabase[("Supabase Storage")]:::db
    end

    subgraph OfflineCheckin["Soát vé Offline"]
        SQLite[("SQLite cục bộ<br/>trên thiết bị")]:::offline
        QRScanner["QR Scanner<br/>(Verify HMAC offline)"]:::offline
        SyncQueue["Offline Sync Queue"]:::offline
    end

    Web -->|"POST /bookings hoặc POST /payments"| OpenResty
    OpenResty --> RateLimit
    RateLimit -->|"Allowed"| API
    RateLimit -.->|"Redis check"| Redis
    
    API --> IdempotencyGuard --> LuaScript
    LuaScript -->|"Thành công"| BookingQueue
    LuaScript -->|"Thất bại: hết vé / vượt limit"| API
    BookingQueue --> BookingWorker --> Postgres

    API -->|"POST /payments"| PaymentService --> CircuitBreaker --> PaymentGateway
    PaymentGateway -->|"Webhook callback"| WebhookHandler
    WebhookHandler -->|"Update booking=paid"| Postgres
    WebhookHandler -->|"Publish"| NotifExchange
    API -->|"Tạm lưu file CSV"| Supabase
    API -->|"Publish ai.generate_bio"| AIBioQueue
    API -->|"Publish vip_guest.import"| CSVImportQueue

    NotifExchange --> InAppWorker --> Postgres
    NotifExchange --> EmailWorker --> Resend
    ReminderCron -->|"Publish"| NotifExchange

    AIBioQueue --> AIBioWorker --> GeminiAPI
    AIBioWorker --> Postgres

    CSVImportQueue --> CSVImportWorker --> Postgres
    CSVImportWorker --> Supabase
    CSVImportWorker --> NotifExchange

    ExpiryScheduler -->|"Hồi kho Redis + Cancel DB"| Redis
    ExpiryScheduler --> Postgres

    Mobile -->|"GET /checkin/data"| OpenResty
    OpenResty -->|"Chuyển tiếp"| API
    API -->|"Trả về danh sách vé"| Mobile
    Mobile -->|"Lưu vào"| SQLite
    Mobile --> QRScanner --> SQLite
    QRScanner -->|"Check-in offline"| SyncQueue
    SyncQueue -->|"POST /checkin/sync (khi có mạng)"| OpenResty --> API --> Postgres
```

---

## Thiết kế cơ sở dữ liệu

### Lựa chọn Database Engine

#### Các phương án cân nhắc

| #   | Phương án      | Mô tả                                                                                                                                     |
| --- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **PostgreSQL** | RDBMS mã nguồn mở mạnh nhất, hỗ trợ ACID transaction đầy đủ, kiểu dữ liệu phong phú (UUID native, JSONB, Array), extension ecosystem lớn. |
| B   | **MongoDB**    | NoSQL document store, schema linh hoạt, horizontal scaling tốt qua sharding.                                                              |
| C   | **MySQL**      | RDBMS phổ biến, đơn giản, hiệu năng đọc tốt, community lớn.                                                                               |

#### Đánh giá

| Tiêu chí                                                     | PostgreSQL                        | MongoDB                                              | MySQL                           |
| ------------------------------------------------------------ | --------------------------------- | ---------------------------------------------------- | ------------------------------- |
| ACID Transaction                                             | ✅ Đầy đủ                         | ⚠️ Có nhưng hạn chế (multi-doc transaction chậm hơn) | ✅ Đầy đủ (InnoDB)              |
| Hỗ trợ UUID native                                           | ✅ Kiểu `uuid`, gen_random_uuid() | ⚠️ Lưu dạng string/binary                            | ❌ Không có kiểu native         |
| Quan hệ phức tạp (FK, JOIN)                                  | ✅ Mạnh                           | ❌ Không có FK, JOIN kém                             | ✅ Tốt                          |
| JSONB cho dữ liệu linh hoạt                                  | ✅ Có, indexed                    | ✅ Native document                                   | ❌ JSON có nhưng index yếu      |
| Tích hợp NestJS (TypeORM/Prisma)                             | ✅ First-class support            | ✅ Mongoose / Prisma                                 | ✅ TypeORM                      |
| Phù hợp bài toán booking (quan hệ chặt chẽ, consistency cao) | ✅ Rất phù hợp                    | ❌ Không phù hợp (eventual consistency)              | ⚠️ Phù hợp nhưng kém PostgreSQL |

#### Chốt giải pháp: PostgreSQL

**Lý do:** Hệ thống bán vé yêu cầu **strong consistency** (không over-selling) và có **quan hệ phức tạp** giữa users → bookings → tickets → checkin_logs. PostgreSQL cung cấp ACID transaction đầy đủ, hỗ trợ UUID native, và tích hợp tốt với NestJS qua TypeORM/Prisma. MongoDB không phù hợp vì bài toán này đòi hỏi referential integrity chặt chẽ.

---

### Lựa chọn Primary Key Strategy

#### Các phương án cân nhắc

| #   | Phương án     | Mô tả                                                                                                     |
| --- | ------------- | --------------------------------------------------------------------------------------------------------- |
| A   | **UUID v4**   | Random UUID, 128-bit, globally unique. Không chứa thông tin thời gian.                                    |
| B   | **UUID v7**   | Time-ordered UUID (RFC 9562), 128-bit. Các bit đầu tiên chứa Unix timestamp (ms), phần còn lại là random. |
| C   | **BIGSERIAL** | Auto-increment integer (8 bytes). Tuần tự, nhỏ gọn, nhưng lộ thông tin về số lượng bản ghi.               |

#### Đánh giá

| Tiêu chí                               | UUID v4                                      | UUID v7                                            | BIGSERIAL               |
| -------------------------------------- | -------------------------------------------- | -------------------------------------------------- | ----------------------- |
| Globally unique (không cần DB để sinh) | ✅                                           | ✅                                                 | ❌ Cần DB sequence      |
| B-Tree index performance               | ❌ Random → page fragmentation cao, ghi chậm | ✅ Time-ordered → sequential insert, ít page split | ✅ Tuần tự, tối ưu nhất |
| Kích thước                             | 16 bytes                                     | 16 bytes                                           | 8 bytes                 |
| Sắp xếp theo thời gian tạo             | ❌ Không                                     | ✅ Có (timestamp embedded)                         | ✅ Có (auto-increment)  |
| Bảo mật (không lộ số lượng)            | ✅                                           | ✅                                                 | ❌ Lộ tổng số bản ghi   |
| Dùng làm ID trong distributed system   | ✅                                           | ✅                                                 | ❌ Conflict khi merge   |

#### Chốt giải pháp: UUID v7 cho bảng nghiệp vụ, BIGSERIAL cho bảng log

**Lý do:**

- **UUID v7** kết hợp ưu điểm của cả UUID v4 (globally unique, không lộ info) và BIGSERIAL (time-ordered, B-Tree friendly). So với UUID v4, UUID v7 giảm đáng kể random I/O và page split khi ghi vào PostgreSQL — hiệu năng ghi có thể tăng 2-3x trong workload insert-heavy.
- **BIGSERIAL** chỉ dùng cho bảng `notification_logs` — bảng log có volume ghi rất cao nhưng không cần globally unique ID. BIGSERIAL tiết kiệm 8 bytes/row và ghi nhanh nhất.

---

### Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS {
        uuid_v7 id PK
        varchar email UK
        varchar password_hash
        varchar full_name
        varchar role
        varchar status
        timestamp created_at
    }
    CONCERTS {
        uuid_v7 id PK
        varchar title
        text description
        varchar location
        varchar poster_url
        varchar poster_public_id
        text biography
        varchar_arr tags
        text svg_stage_map
        timestamp start_time
        timestamp end_time
        varchar status
        boolean reminder_sent
        timestamp created_at
    }
    CONCERT_AI_BIOS {
        uuid_v7 concert_id PK, FK
        text raw_text
        text draft_bio
        varchar status
        text error
        timestamp updated_at
    }
    TICKET_TYPES {
        uuid_v7 id PK
        uuid_v7 concert_id FK
        varchar name
        decimal price
        integer total_quantity
        integer available_quantity
        integer max_per_user
        timestamp sale_start_time
        timestamp sale_end_time
    }
    VIP_GUEST_IMPORTS {
        uuid_v7 id PK
        uuid_v7 concert_id FK
        varchar status
        integer total_rows
        integer imported_rows
        jsonb error_logs
        varchar file_url
        timestamp created_at
        timestamp updated_at
    }
    ORDERS {
        uuid_v7 id PK
        uuid_v7 user_id FK
        uuid_v7 concert_id FK
        varchar status
        decimal total_amount
        varchar idempotency_key UK
        timestamp created_at
    }
    PAYMENTS {
        uuid_v7 id PK
        uuid_v7 order_id FK
        varchar gateway
        varchar transaction_id UK
        decimal amount
        varchar status
        jsonb raw_response
        varchar pay_url
        timestamp created_at
    }
    TICKETS {
        uuid_v7 id PK
        uuid_v7 order_id FK
        uuid_v7 ticket_type_id FK
        varchar qr_code_hash
        varchar status
        varchar checkin_status
        timestamp checked_in_at
    }
    CHECKIN_LOGS {
        uuid_v7 id PK
        uuid_v7 ticket_id FK
        uuid_v7 vip_guest_id FK
        uuid_v7 checked_by FK
        timestamp scan_time
        boolean is_offline
        varchar device_id
        varchar status
    }
    VIP_GUESTS {
        uuid_v7 id PK
        uuid_v7 concert_id FK
        varchar full_name
        varchar email
        varchar phone
        varchar affiliate_company
        varchar qr_code_hash
        varchar status
        varchar checkin_status
        timestamp checked_in_at
        timestamp created_at
        timestamp updated_at
    }
    NOTIFICATION_LOGS {
        bigserial id PK
        uuid_v7 user_id FK
        varchar type
        varchar title
        text body
        varchar channel
        varchar status
        uuid_v7 reference_id
        timestamp read_at
        timestamp sent_at
        timestamp created_at
    }

    CONCERTS ||--o{ TICKET_TYPES : "has many"
    CONCERTS ||--o{ VIP_GUEST_IMPORTS : "has many"
    USERS ||--o{ ORDERS : "places"
    ORDERS ||--o{ PAYMENTS : "has many"
    ORDERS ||--o{ TICKETS : "contains"
    TICKET_TYPES ||--o{ TICKETS : "instantiates"
    TICKETS ||--o{ CHECKIN_LOGS : "logs"
    VIP_GUESTS ||--o{ CHECKIN_LOGS : "logs"
    USERS ||--o{ CHECKIN_LOGS : "verifies"
    CONCERTS ||--o{ VIP_GUESTS : "has many"
    USERS ||--o{ NOTIFICATION_LOGS : "receives"
    CONCERTS ||--o| CONCERT_AI_BIOS : "has AI bio draft"
```

### Đặc tả chi tiết các bảng cơ sở dữ liệu

Dưới đây là đặc tả chi tiết của từng bảng trong cơ sở dữ liệu bao gồm các cột, kiểu dữ liệu, ràng buộc (constraints), mô tả chi tiết, cùng với các quy tắc nghiệp vụ (Business Rules) và các chỉ mục (Indexes) đi kèm.

---

#### 1. Bảng `USERS` (Thông tin người dùng)

##### Đặc tả chi tiết (Table Specification)

| Column            | Type           | Constraints                                                                                 | Description                                                                      |
| :---------------- | :------------- | :------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------- |
| **id**            | `uuid`         | `PRIMARY KEY`                                                                               | Khóa chính, ID duy nhất của người dùng dạng UUID v7                              |
| **email**         | `varchar(255)` | `UNIQUE`, `NOT NULL`                                                                        | Địa chỉ email người dùng, dùng làm thông tin đăng nhập chính                     |
| **password_hash** | `varchar(255)` | `NOT NULL`                                                                                  | Mật khẩu người dùng đã được băm (hash) bằng bcrypt                               |
| **full_name**     | `varchar(255)` | `NOT NULL`                                                                                  | Họ và tên của người dùng                                                         |
| **role**          | `varchar(50)`  | `NOT NULL`, `DEFAULT 'audience'`, `CHECK (role IN ('audience', 'organizer', 'gate_staff'))` | Vai trò của người dùng trong hệ thống (Khán giả, Ban tổ chức, Nhân viên soát vé) |
| **status**        | `varchar(50)`  | `NOT NULL`, `DEFAULT 'pending'`, `CHECK (status IN ('pending', 'active'))`                  | Trạng thái hoạt động của tài khoản (Chờ kích hoạt, Đang hoạt động)               |
| **created_at**    | `timestamp`    | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                                                     | Thời điểm tạo tài khoản người dùng                                               |

##### Business Rules

- Địa chỉ `email` phải duy nhất trên toàn hệ thống và tuân thủ định dạng email chuẩn.
- `role` bắt buộc phải là một trong các giá trị định sẵn: `audience` (mặc định khi đăng ký), `organizer` (tài khoản quản lý của ban tổ chức), `gate_staff` (nhân viên dùng mobile app quét vé).
- `status` bắt buộc phải là `pending` (mặc định ban đầu chờ kích hoạt) hoặc `active` (đã xác thực mã OTP thành công).
- Một email chỉ được đăng ký tối đa một tài khoản (Unique constraint).
- Tài khoản ở trạng thái `pending` sẽ bị chặn đăng nhập và yêu cầu xác thực OTP qua email để chuyển thành `active` trước khi sử dụng các dịch vụ.

##### Indexes

| Index Name       | Columns | Type                   | Purpose                                                 |
| :--------------- | :------ | :--------------------- | :------------------------------------------------------ |
| `pk_users`       | `id`    | `PRIMARY KEY (B-Tree)` | Tự động tạo cho khóa chính                              |
| `uq_users_email` | `email` | `UNIQUE (B-Tree)`      | Đảm bảo email duy nhất và tối ưu hóa truy vấn đăng nhập |

---

#### 2. Bảng `CONCERTS` (Thông tin buổi biểu diễn)

##### Đặc tả chi tiết (Table Specification)

| Column               | Type            | Constraints                                                                                      | Description                                                                                                  |
| :------------------- | :-------------- | :----------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| **id**               | `uuid`          | `PRIMARY KEY`                                                                                    | Khóa chính dạng UUID v7                                                                                      |
| **title**            | `varchar(255)`  | `NOT NULL`                                                                                       | Tên của concert                                                                                              |
| **description**      | `text`          | `NOT NULL`                                                                                       | Mô tả chi tiết nội dung buổi biểu diễn                                                                       |
| **location**         | `varchar(255)`  | `NOT NULL`                                                                                       | Địa điểm tổ chức concert                                                                                     |
| **poster_url**       | `varchar(500)`  | `NULL`                                                                                           | Đường dẫn CDN ảnh poster của concert lưu trữ trên Cloudinary                                                 |
| **poster_public_id** | `varchar(255)`  | `NULL`                                                                                           | Mã định danh duy nhất (Public ID) của ảnh poster trên Cloudinary phục vụ dọn dẹp                             |
| **biography**        | `text`          | `NULL`                                                                                           | Tiểu sử nghệ sĩ của concert (sau khi đã phê duyệt)                                                           |
| **tags**             | `varchar(50)[]` | `NOT NULL`, `DEFAULT '{}'`                                                                       | Danh sách tag (mảng chuỗi) hỗ trợ phân loại và tìm kiếm                                                      |
| **svg_stage_map**    | `text`          | `NULL`                                                                                           | Bản đồ sơ đồ ghế ngồi/sân khấu dạng chuỗi SVG để hiển thị trên client và cache ở Redis                       |
| **start_time**       | `timestamp`     | `NOT NULL`                                                                                       | Thời gian bắt đầu buổi diễn                                                                                  |
| **end_time**         | `timestamp`     | `NOT NULL`                                                                                       | Thời gian kết thúc dự kiến                                                                                   |
| **status**           | `varchar(50)`   | `NOT NULL`, `DEFAULT 'draft'`, `CHECK (status IN ('draft', 'active', 'cancelled', 'completed'))` | Trạng thái buổi diễn: nháp (`draft`), đang mở bán (`active`), bị hủy (`cancelled`), đã diễn ra (`completed`) |
| **reminder_sent**    | `boolean`       | `NOT NULL`, `DEFAULT FALSE`                                                                      | Đánh dấu đã gửi email nhắc nhở trước sự kiện hay chưa                                                        |
| **created_at**       | `timestamp`     | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                                                          | Thời điểm tạo bản ghi concert                                                                                |

##### Business Rules

- Thời gian kết thúc `end_time` bắt buộc phải lớn hơn thời gian bắt đầu `start_time`.
- Trạng thái `status` mặc định là `draft` khi khởi tạo. Chỉ những concert có trạng thái `active` mới được phép xuất hiện trên trang chủ cho người dùng tìm kiếm và đặt vé.
- `tags` là mảng các chuỗi không được chứa ký tự đặc biệt nguy hiểm và dùng để filter nhanh.

##### Indexes

| Index Name                       | Columns              | Type                   | Purpose                                                                              |
| :------------------------------- | :------------------- | :--------------------- | :----------------------------------------------------------------------------------- |
| `pk_concerts`                    | `id`                 | `PRIMARY KEY (B-Tree)` | Tự động tạo cho khóa chính                                                           |
| `idx_concerts_status_start_time` | `status, start_time` | `B-Tree`               | Tìm kiếm nhanh các concert đang active và sắp diễn ra, phục vụ cron job gửi nhắc nhở |
| `idx_concerts_tags`              | `tags`               | `GIN`                  | Tối ưu hóa truy vấn tìm kiếm concert theo các phần tử trong mảng tag                 |

---

#### 3. Bảng `TICKET_TYPES` (Cấu hình loại vé)

##### Đặc tả chi tiết (Table Specification)

| Column                 | Type             | Constraints                                                                            | Description                                                                                                        |
| :--------------------- | :--------------- | :------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| **id**                 | `uuid`           | `PRIMARY KEY`                                                                          | Khóa chính dạng UUID v7                                                                                            |
| **concert_id**         | `uuid`           | `FOREIGN KEY REFERENCES CONCERTS(id) ON DELETE CASCADE`                                | Khóa ngoại trỏ đến concert tương ứng                                                                               |
| **name**               | `varchar(255)`   | `NOT NULL`                                                                             | Tên loại vé (ví dụ: Standard Zone A, Platinum, VIP...)                                                             |
| **price**              | `decimal(12, 2)` | `NOT NULL`, `CHECK (price >= 0)`                                                       | Giá vé                                                                                                             |
| **total_quantity**     | `integer`        | `NOT NULL`, `CHECK (total_quantity > 0)`                                               | Tổng số lượng vé phát hành cho loại này                                                                            |
| **available_quantity** | `integer`        | `NOT NULL`, `CHECK (available_quantity >= 0 AND available_quantity <= total_quantity)` | Số lượng vé còn lại trong kho có thể bán                                                                           |
| **max_per_user**       | `integer`        | `NOT NULL`, `DEFAULT 4`, `CHECK (max_per_user > 0)`                                    | Giới hạn số lượng vé tối đa của loại này một người dùng được đặt mua                                               |
| **sale_start_time**    | `timestamp`      | `NULL`                                                                                 | Thời điểm bắt đầu bán vé. Nếu để trống, vé được mở bán ngay khi concert được kích hoạt (active)                    |
| **sale_end_time**      | `timestamp`      | `NULL`                                                                                 | Thời điểm kết thúc bán vé. Phải lớn hơn `sale_start_time`. Nếu để trống, mặc định bán cho đến khi concert kết thúc |

##### Business Rules

- Tên loại vé `name` phải là duy nhất trong phạm vi một buổi biểu diễn cụ thể (ví dụ: một concert không thể có hai loại vé cùng tên "VIP", được đảm bảo bởi composite unique constraint `uq_concert_ticket_type_name`).
- Tên loại vé có thể được đặt tùy ý dưới dạng text (`varchar(255)`) thay vì bị giới hạn cứng ở mức database/DTO như trước, giúp tăng sự linh hoạt cho ban tổ chức.
- `available_quantity` ban đầu phải bằng `total_quantity` và giảm dần khi có người đặt vé. Không bao giờ được phép nhỏ hơn 0.
- Số vé tối đa một người được đặt (`max_per_user`) dùng để ngăn chặn đầu cơ vé.
- Có ràng buộc kiểm tra ở mức database (`CHECK (sale_end_time IS NULL OR sale_start_time IS NULL OR sale_end_time > sale_start_time)`) để đảm bảo tính hợp lệ của thời gian bán vé.
- Tại thời điểm khách hàng đặt mua vé, hệ thống kiểm tra thời gian hiện tại (`now`):
  - `now` phải lớn hơn hoặc bằng `sale_start_time` (nếu đã cấu hình).
  - `now` phải nhỏ hơn hoặc bằng `sale_end_time` (nếu đã cấu hình).
  - `sale_start_time` bắt buộc phải diễn ra trước khi concert kết thúc (`sale_start_time < concert.end_time`).

##### Indexes

| Index Name                    | Columns            | Type                   | Purpose                                                      |
| :---------------------------- | :----------------- | :--------------------- | :----------------------------------------------------------- |
| `pk_ticket_types`             | `id`               | `PRIMARY KEY (B-Tree)` | Tự động tạo cho khóa chính                                   |
| `idx_ticket_types_concert_id` | `concert_id`       | `B-Tree`               | Lấy nhanh toàn bộ loại vé của một concert                    |
| `uq_concert_ticket_type_name` | `concert_id, name` | `UNIQUE (B-Tree)`      | Đảm bảo tính duy nhất của tên loại vé trong cùng một concert |

---

#### 4. Bảng `ORDERS` (Đơn đặt vé)

##### Đặc tả chi tiết (Table Specification)

| Column              | Type             | Constraints                                                                                      | Description                                                                                                                                       |
| :------------------ | :--------------- | :----------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| **id**              | `uuid`           | `PRIMARY KEY`                                                                                    | Khóa chính dạng UUID v7                                                                                                                           |
| **user_id**         | `uuid`           | `FOREIGN KEY REFERENCES USERS(id) ON DELETE RESTRICT`                                            | Khóa ngoại trỏ đến người mua vé                                                                                                                   |
| **concert_id**      | `uuid`           | `FOREIGN KEY REFERENCES CONCERTS(id) ON DELETE RESTRICT`                                         | Khóa ngoại trỏ đến concert được đặt vé                                                                                                            |
| **status**          | `varchar(50)`    | `NOT NULL`, `DEFAULT 'pending'`, `CHECK (status IN ('pending', 'paid', 'expired', 'cancelled'))` | Trạng thái của đơn hàng: chờ thanh toán (`pending`), đã thanh toán (`paid`), quá hạn hủy tự động (`expired`), bị hủy bởi người dùng (`cancelled`) |
| **total_amount**    | `decimal(12, 2)` | `NOT NULL`, `CHECK (total_amount >= 0)`                                                          | Tổng số tiền của đơn hàng                                                                                                                         |
| **idempotency_key** | `varchar(255)`   | `UNIQUE`, `NULL`                                                                                 | Chuỗi mã định danh do client gửi lên nhằm chống trùng lặp đơn hàng (có thể trống)                                                                 |
| **created_at**      | `timestamp`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                                                          | Thời điểm tạo đơn đặt vé                                                                                                                          |

##### Business Rules

- Khi khởi tạo, đơn hàng bắt buộc ở trạng thái `pending`.
- Đơn hàng sẽ hết hạn thanh toán sau 10 phút kể từ lúc tạo (`created_at`). Khi xảy ra sự cố sập toàn bộ cổng thanh toán trực tuyến (cả hai Circuit Breaker đều `OPEN`), hệ thống sẽ chặn không cho phép tạo đơn hàng mới (`POST /bookings` trả về lỗi bảo trì luồng mua vé). Các đơn đặt hàng đang ở trạng thái `pending` trước đó vẫn giữ nguyên thời hạn thanh toán là 10 phút.
- Nếu hết thời gian 10 phút kể từ lúc tạo mà đơn hàng chưa sang `paid`, RabbitMQ Dead Letter Exchange (DLX) hoặc cron job quét sẽ chuyển trạng thái đơn hàng sang `expired` và thực hiện hoàn trả số vé đã giữ về lại kho Redis (compensation).
- Ràng buộc khóa ngoại không cho phép xóa Concert (`ON DELETE RESTRICT`) hoặc User (`ON DELETE RESTRICT`) khi đã phát sinh đơn hàng.

##### Indexes

| Index Name                  | Columns           | Type                   | Purpose                                                    |
| :-------------------------- | :---------------- | :--------------------- | :--------------------------------------------------------- |
| `pk_orders`                 | `id`              | `PRIMARY KEY (B-Tree)` | Tự động tạo cho khóa chính                                 |
| `idx_orders_user_id`        | `user_id`         | `B-Tree`               | Truy vấn nhanh lịch sử mua vé của người dùng               |
| `idx_orders_concert_id`     | `concert_id`      | `B-Tree`               | Truy vấn nhanh các đơn hàng của một concert cụ thể         |
| `uq_orders_idempotency_key` | `idempotency_key` | `UNIQUE (B-Tree)`      | Lớp bảo vệ chống trùng lặp giao dịch đặt vé ở mức Database |

---

#### 5. Bảng `PAYMENTS` (Giao dịch thanh toán)

##### Đặc tả chi tiết (Table Specification)

| Column             | Type             | Constraints                                                                           | Description                                                                      |
| :----------------- | :--------------- | :------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------- |
| **id**             | `uuid`           | `PRIMARY KEY`                                                                         | Khóa chính dạng UUID v7                                                          |
| **order_id**       | `uuid`           | `FOREIGN KEY REFERENCES ORDERS(id) ON DELETE RESTRICT`                                | Khóa ngoại liên kết tới đơn đặt vé tương ứng                                     |
| **gateway**        | `varchar(20)`    | `NOT NULL`                                                                            | Cổng thanh toán sử dụng (vnpay hoặc momo)                                        |
| **transaction_id** | `varchar(255)`   | `UNIQUE`, `NULL`                                                                      | Mã giao dịch duy nhất do cổng thanh toán trả về (có thể trống khi khởi tạo)      |
| **amount**         | `decimal(12, 2)` | `NOT NULL`, `CHECK (amount >= 0)`                                                     | Số tiền thực tế giao dịch thanh toán                                             |
| **status**         | `varchar(20)`    | `NOT NULL`, `DEFAULT 'pending'`, `CHECK (status IN ('pending', 'success', 'failed'))` | Trạng thái giao dịch thanh toán                                                  |
| **pay_url**        | `text`           | `NULL`                                                                                | URL thanh toán do cổng thanh toán trả về để chuyển hướng người dùng              |
| **raw_response**   | `jsonb`          | `NULL`                                                                                | Dữ liệu phản hồi nguyên bản (raw response) từ cổng thanh toán lưu dưới dạng JSON |
| **created_at**     | `timestamp`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                                               | Thời điểm tạo bản ghi thanh toán                                                 |

##### Business Rules

- Một đơn đặt vé (`order_id`) có thể có nhiều bản ghi thanh toán nếu các lần thanh toán trước bị thất bại (`failed`), nhưng tối đa chỉ được có duy nhất một giao dịch ở trạng thái thành công (`success`).
- `transaction_id` là giá trị duy nhất trên toàn hệ thống và hoạt động như một khóa chống trùng lặp (Idempotency Key) cho các cuộc gọi webhook từ phía cổng thanh toán. Webhook chỉ xử lý cập nhật trạng thái đơn đặt vé thành `paid` nếu giao dịch thanh toán chưa từng được ghi nhận thành công trước đó.

##### Indexes

| Index Name              | Columns          | Type                   | Purpose                                                                            |
| :---------------------- | :--------------- | :--------------------- | :--------------------------------------------------------------------------------- |
| `pk_payments`           | `id`             | `PRIMARY KEY (B-Tree)` | Tự động tạo cho khóa chính                                                         |
| `idx_payments_order_id` | `order_id`       | `B-Tree`               | Truy cập lịch sử các lần thanh toán của một đơn hàng                               |
| `uq_payments_txn_id`    | `transaction_id` | `UNIQUE (B-Tree)`      | Đảm bảo tính duy nhất của mã giao dịch cổng thanh toán và xử lý webhook idempotent |

---

#### 6. Bảng `TICKETS` (Thông tin vé đã xuất)

##### Đặc tả chi tiết (Table Specification)

| Column             | Type           | Constraints                                                                                          | Description                                                         |
| :----------------- | :------------- | :--------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------ |
| **id**             | `uuid`         | `PRIMARY KEY`                                                                                        | Khóa chính dạng UUID v7                                             |
| **order_id**       | `uuid`         | `FOREIGN KEY REFERENCES ORDERS(id) ON DELETE CASCADE`                                                | Khóa ngoại liên kết tới đơn hàng chứa vé này                        |
| **ticket_type_id** | `uuid`         | `FOREIGN KEY REFERENCES TICKET_TYPES(id) ON DELETE RESTRICT`                                         | Khóa ngoại liên kết tới cấu hình loại vé                            |
| **qr_code_hash**   | `varchar(500)` | `UNIQUE`, `NULL`                                                                                     | Chuỗi băm SHA-256 chứa thông tin vé đã ký số (HMAC) dùng in QR Code |
| **status**         | `varchar(50)`  | `NOT NULL`, `DEFAULT 'reserved'`, `CHECK (status IN ('reserved', 'active', 'used'))`                 | Trạng thái hoạt động của vé (giữ chỗ, active, đã dùng)              |
| **checkin_status** | `varchar(50)`  | `NOT NULL`, `DEFAULT 'not_checked_in'`, `CHECK (checkin_status IN ('not_checked_in', 'checked_in'))` | Trạng thái soát vé vào cửa (Chưa soát vé, Đã soát vé)               |
| **checked_in_at**  | `timestamp`    | `NULL`                                                                                               | Thời điểm soát vé thành công                                        |

##### Business Rules

- Vé chỉ được tự động tạo bởi Booking Worker sau khi đơn đặt vé `ORDERS` tương ứng được cập nhật trạng thái `paid`.
- `qr_code_hash` là duy nhất trên toàn hệ thống. Đây là chuỗi băm của thông tin vé kèm theo chữ ký HMAC của server để ngăn chặn việc làm giả vé và không lộ thông tin nhạy cảm.
- Một vé chỉ được check-in tối đa 1 lần. Khi quét thành công, `checkin_status` chuyển sang `checked_in` và ghi lại `checked_in_at`. Mọi lượt quét sau đó trên mã QR này đều sẽ bị báo lỗi trùng lặp.

##### Indexes

| Index Name                | Columns          | Type                   | Purpose                                                                        |
| :------------------------ | :--------------- | :--------------------- | :----------------------------------------------------------------------------- |
| `pk_tickets`              | `id`             | `PRIMARY KEY (B-Tree)` | Tự động tạo cho khóa chính                                                     |
| `idx_tickets_order_id`    | `order_id`       | `B-Tree`               | Lấy danh sách tất cả các vé thuộc một đơn đặt vé cụ thể                        |
| `idx_tickets_type_id`     | `ticket_type_id` | `B-Tree`               | Truy vấn các vé theo loại vé để kiểm tra hoặc thống kê                         |
| `uq_tickets_qr_code_hash` | `qr_code_hash`   | `UNIQUE (B-Tree)`      | Phục vụ đối soát nhanh thông tin khi nhân viên soát vé quét mã QR tại cổng vào |

---

#### 7. Bảng `CHECKIN_LOGS` (Nhật ký soát vé)

##### Đặc tả chi tiết (Table Specification)

| Column           | Type           | Constraints                                                                       | Description                                                             |
| :--------------- | :------------- | :-------------------------------------------------------------------------------- | :---------------------------------------------------------------------- |
| **id**           | `uuid`         | `PRIMARY KEY`                                                                     | Khóa chính dạng UUID v7                                                 |
| **ticket_id**    | `uuid`         | `NULL`, `FOREIGN KEY REFERENCES TICKETS(id) ON DELETE SET NULL`                   | Khóa ngoại liên kết tới vé thông thường được quét                       |
| **vip_guest_id** | `uuid`         | `NULL`, `FOREIGN KEY REFERENCES VIP_GUESTS(id) ON DELETE SET NULL`                | Khóa ngoại liên kết tới khách VIP được quét                             |
| **checked_by**   | `uuid`         | `FOREIGN KEY REFERENCES USERS(id) ON DELETE RESTRICT`                             | Khóa ngoại liên kết đến tài khoản nhân viên thực hiện quét mã           |
| **scan_time**    | `timestamp`    | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                                           | Thời điểm thực hiện quét mã                                             |
| **is_offline**   | `boolean`      | `NOT NULL`, `DEFAULT FALSE`                                                       | Đánh dấu lượt quét này được ghi nhận offline tại app và đồng bộ lên sau |
| **device_id**    | `varchar(255)` | `NOT NULL`                                                                        | Định danh thiết bị phần cứng (điện thoại quét) dùng soát vé             |
| **status**       | `varchar(50)`  | `NOT NULL`, `DEFAULT 'valid'`, `CHECK (status IN ('valid', 'invalidated_fraud'))` | Trạng thái nhật ký soát vé (hợp lệ hoặc bị vô hiệu do gian lận)         |

##### Business Rules

- Để hỗ trợ audit đồng nhất cho cả khách VIP và vé thông thường, bảng này thiết kế hai khóa ngoại nullable: `ticket_id` và `vip_guest_id`. Bắt buộc phải có đúng một trong hai trường này có giá trị (CHECK constraint: `CHECK ((ticket_id IS NOT NULL AND vip_guest_id IS NULL) OR (ticket_id IS NULL AND vip_guest_id IS NOT NULL))`).
- Bản ghi log check-in là dữ liệu lịch sử mang tính chất audit trail, sau khi insert thành công không được phép cập nhật (`UPDATE`) hoặc xóa (`DELETE`).
- Tài khoản thực hiện soát vé `checked_by` phải có vai trò `gate_staff` hoặc `organizer`.

##### Indexes

| Index Name                      | Columns        | Type                   | Purpose                                                                              |
| :------------------------------ | :------------- | :--------------------- | :----------------------------------------------------------------------------------- |
| `pk_checkin_logs`               | `id`           | `PRIMARY KEY (B-Tree)` | Tự động tạo cho khóa chính                                                           |
| `idx_checkin_logs_ticket_id`    | `ticket_id`    | `B-Tree`               | Phục vụ tra cứu lịch sử quét của một vé (hỗ trợ điều tra khi có sự cố quét trùng mã) |
| `idx_checkin_logs_vip_guest_id` | `vip_guest_id` | `B-Tree`               | Tra cứu lịch sử check-in của khách mời VIP                                           |
| `idx_checkin_logs_scan_time`    | `scan_time`    | `B-Tree`               | Thống kê số lượng vé được soát theo thời gian thực tại sự kiện                       |

---

#### 8. Bảng `VIP_GUESTS` (Khách mời VIP)

##### Đặc tả chi tiết (Table Specification)

| Column                | Type           | Constraints                                                                                          | Description                                                 |
| :-------------------- | :------------- | :--------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| **id**                | `uuid`         | `PRIMARY KEY`                                                                                        | Khóa chính dạng UUID v7                                     |
| **concert_id**        | `uuid`         | `FOREIGN KEY REFERENCES CONCERTS(id) ON DELETE CASCADE`                                              | Khóa ngoại trỏ đến concert khách VIP được mời tham dự       |
| **full_name**         | `varchar(255)` | `NOT NULL`                                                                                           | Họ và tên khách mời VIP                                     |
| **email**             | `varchar(255)` | `NOT NULL`                                                                                           | Địa chỉ email nhận thư mời và mã QR check-in                |
| **phone**             | `varchar(20)`  | `NULL`                                                                                               | Số điện thoại khách mời VIP                                 |
| **affiliate_company** | `varchar(255)` | `NULL`                                                                                               | Tên tổ chức/doanh nghiệp hoặc đơn vị công tác của khách mời |
| **qr_code_hash**      | `varchar(255)` | `UNIQUE`, `NOT NULL`                                                                                 | Chuỗi băm mã QR gửi riêng cho khách mời để check-in         |
| **status**            | `varchar(50)`  | `NOT NULL`, `DEFAULT 'active'`, `CHECK (status IN ('reserved', 'active', 'used'))`                  | Trạng thái của khách VIP                                     |
| **checkin_status**    | `varchar(50)`  | `NOT NULL`, `DEFAULT 'not_checked_in'`, `CHECK (checkin_status IN ('not_checked_in', 'checked_in'))` | Trạng thái check-in của khách VIP                           |
| **checked_in_at**     | `timestamp`    | `NULL`                                                                                               | Thời điểm khách VIP check-in thành công                     |
| **created_at**        | `timestamp`    | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                                                              | Thời điểm tạo bản ghi khách VIP                              |
| **updated_at**        | `timestamp`    | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                                                              | Thời điểm cập nhật bản ghi khách VIP gần nhất                |

##### Business Rules

- Khách VIP được Ban tổ chức (`organizer`) quản lý bằng cách import tệp CSV danh sách khách mời.
- Khách VIP mặc định ở trạng thái `active` khi được tạo từ import CSV.
- `qr_code_hash` của khách VIP là duy nhất trên toàn hệ thống và hoạt động độc lập với bảng vé thông thường.
- Tương tự như vé, mỗi khách VIP chỉ được phép check-in một lần duy nhất.

##### Indexes

| Index Name                   | Columns        | Type                   | Purpose                                                                          |
| :--------------------------- | :------------- | :--------------------- | :------------------------------------------------------------------------------- |
| `pk_vip_guests`              | `id`           | `PRIMARY KEY (B-Tree)` | Tự động tạo cho khóa chính                                                       |
| `uq_vip_guests_concert_email` | `concert_id, email` | `UNIQUE (B-Tree)`      | Đảm bảo không import trùng email của cùng một concert                            |
| `uq_vip_guests_qr_code_hash` | `qr_code_hash` | `UNIQUE (B-Tree)`      | Quét check-in nhanh đối với khách VIP bằng mã QR                                 |
| `idx_vip_guests_concert_id`  | `concert_id`   | `B-Tree`               | Lấy toàn bộ danh sách khách VIP của một concert phục vụ đồng bộ dữ liệu check-in |

---

#### 9. Bảng `NOTIFICATION_LOGS` (Nhật ký thông báo)

##### Đặc tả chi tiết (Table Specification)

| Column           | Type           | Constraints                                                                                                  | Description                                                                                                                               |
| :--------------- | :------------- | :----------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| **id**           | `bigint`       | `PRIMARY KEY`                                                                                                | Khóa chính tự tăng dạng `bigserial` để tối ưu dung lượng lưu trữ cho dữ liệu log lớn                                                      |
| **user_id**      | `uuid`         | `FOREIGN KEY REFERENCES USERS(id) ON DELETE CASCADE`                                                         | Khóa ngoại trỏ đến người nhận thông báo                                                                                                   |
| **type**         | `varchar(50)`  | `NOT NULL`, `CHECK (type IN ('booking_confirmed', 'concert_reminder', 'ai_bio_completed', 'ai_bio_failed'))` | Loại thông báo: đặt vé (`booking_confirmed`), nhắc concert (`concert_reminder`), xong bio (`ai_bio_completed`), lỗi bio (`ai_bio_failed`) |
| **title**        | `varchar(255)` | `NOT NULL`                                                                                                   | Tiêu đề thông báo                                                                                                                         |
| **body**         | `text`         | `NOT NULL`                                                                                                   | Nội dung chi tiết của thông báo                                                                                                           |
| **channel**      | `varchar(50)`  | `NOT NULL`, `CHECK (channel IN ('in_app', 'email'))`                                                         | Kênh gửi thông báo (thông báo trong ứng dụng hoặc email)                                                                                  |
| **status**       | `varchar(50)`  | `NOT NULL`, `DEFAULT 'unread'`, `CHECK (status IN ('unread', 'read'))`                                       | Trạng thái thông báo trong ứng dụng / email                                                                                               |
| **reference_id** | `uuid`         | `NULL`                                                                                                       | Khóa ngoại tham chiếu động (nullable) đến ID của đơn hàng hoặc concert liên quan                                                          |
| **read_at**      | `timestamp`    | `NULL`                                                                                                       | Thời điểm người dùng đọc thông báo (chỉ có ý nghĩa khi `channel` là `in_app`)                                                             |
| **sent_at**      | `timestamp`    | `NULL`                                                                                                       | Thời điểm thực tế gửi thông báo thành công                                                                                                |
| **created_at**   | `timestamp`    | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                                                                      | Thời điểm tạo bản ghi log thông báo                                                                                                       |

##### Business Rules

- `status` mặc định là `unread`; chỉ chuyển sang `read` khi người dùng mở thông báo in-app.
- `read_at` chỉ được phép cập nhật khi thông báo được gửi qua kênh `in_app`. Đối với kênh `email`, trường này luôn là `NULL`.
- Bảng này sử dụng kiểu khóa chính tự tăng `bigserial` thay vì UUID v7 nhằm tiết kiệm 8 bytes cho mỗi hàng ghi, do bảng này lưu lịch sử log với volume cực lớn.

##### Indexes

| Index Name                              | Columns            | Type                   | Purpose                                                                                                |
| :-------------------------------------- | :----------------- | :--------------------- | :----------------------------------------------------------------------------------------------------- |
| `pk_notification_logs`                  | `id`               | `PRIMARY KEY (B-Tree)` | Tự động tạo cho khóa chính                                                                             |
| `idx_notification_logs_user_channel_created` | `user_id, channel, created_at` | `B-Tree`               | Truy vấn nhanh thông báo theo người dùng và kênh gửi                                                    |
| `idx_notification_logs_cleanup`          | `read_at`          | `B-Tree`               | Hỗ trợ job dọn dẹp thông báo đã đọc                                                                     |

---

#### 10. Bảng `CONCERT_AI_BIOS` (Tiến trình sinh và bản nháp tiểu sử AI)

##### Đặc tả chi tiết (Table Specification)

| Column         | Type          | Constraints                                                                                   | Description                                                       |
| :------------- | :------------ | :-------------------------------------------------------------------------------------------- | :---------------------------------------------------------------- |
| **concert_id** | `uuid`        | `PRIMARY KEY`, `FOREIGN KEY REFERENCES CONCERTS(id) ON DELETE CASCADE`                        | Khóa chính và khóa ngoại tham chiếu đến concert                   |
| **raw_text**   | `text`        | `NOT NULL`                                                                                    | Nội dung văn bản thô trích xuất từ file PDF press kit của nghệ sĩ |
| **draft_bio**  | `text`        | `NULL`                                                                                        | Bản nháp tóm tắt tiểu sử của nghệ sĩ do Google Gemini AI sinh ra  |
| **status**     | `varchar(50)` | `NOT NULL`, `DEFAULT 'processing'`, `CHECK (status IN ('processing', 'completed', 'failed'))` | Trạng thái của tác vụ xử lý AI                                    |
| **error**      | `text`        | `NULL`                                                                                        | Chi tiết thông báo lỗi nếu tác vụ AI gặp lỗi và dừng hẳn          |
| **updated_at** | `timestamp`   | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                                                       | Thời điểm cập nhật trạng thái gần nhất                            |

##### Business Rules

- Ban tổ chức upload file PDF lên, hệ thống trích xuất text lưu vào `raw_text` và khởi tạo trạng thái `processing`.
- Worker sinh xong tiểu sử cập nhật `draft_bio` và đặt trạng thái `completed`. Nếu lỗi (sau 3 lần retry), đặt trạng thái `failed` và cập nhật thông tin lỗi vào `error`.
- Khi Ban tổ chức thực hiện phê duyệt, nội dung trong `draft_bio` (hoặc đã chỉnh sửa) được cập nhật sang trường `biography` của bảng `CONCERTS`.
- Xóa cascade bản ghi `concert_ai_bios` tương ứng khi xóa concert.

##### Indexes

| Index Name           | Columns      | Type                   | Purpose                    |
| :------------------- | :----------- | :--------------------- | :------------------------- |
| `pk_concert_ai_bios` | `concert_id` | `PRIMARY KEY (B-Tree)` | Tự động tạo cho khóa chính |

---

#### 11. Bảng `VIP_GUEST_IMPORTS` (Tiến trình import danh sách khách VIP)

##### Đặc tả chi tiết (Table Specification)

| Column            | Type            | Constraints                                                                                           | Description                                             |
| :---------------- | :-------------- | :---------------------------------------------------------------------------------------------------- | :------------------------------------------------------ |
| **id**            | `uuid`          | `PRIMARY KEY`                                                                                         | Khóa chính dạng UUID v7                                 |
| **concert_id**    | `uuid`          | `FOREIGN KEY REFERENCES CONCERTS(id) ON DELETE CASCADE`                                               | Khóa ngoại liên kết tới concert được import khách VIP   |
| **status**        | `varchar(50)`   | `NOT NULL`, `DEFAULT 'pending'`, `CHECK (status IN ('pending', 'processing', 'completed', 'failed'))` | Trạng thái của tác vụ import file CSV                   |
| **total_rows**    | `integer`       | `NOT NULL`, `DEFAULT 0`                                                                               | Tổng số dòng hợp lệ đọc được từ file CSV                |
| **imported_rows** | `integer`       | `NOT NULL`, `DEFAULT 0`                                                                               | Số dòng khách mời VIP đã import thành công vào database |
| **error_logs**    | `jsonb`         | `NULL`                                                                                                | Danh sách các lỗi trích xuất chi tiết theo dạng JSON    |
| **file_url**      | `varchar(1000)` | `NULL`                                                                                                | Đường dẫn URL tải file tạm trên Supabase Storage        |
| **created_at**    | `timestamp`     | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                                                               | Thời điểm bắt đầu tạo tác vụ import                     |
| **updated_at**    | `timestamp`     | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                                                               | Thời điểm cập nhật trạng thái gần nhất                  |

##### Business Rules

- Ban tổ chức tải file CSV lên thông qua API Admin, hệ thống upload tạm lên Supabase Storage và lưu bản ghi `vip_guest_imports` với trạng thái `pending`.
- Tác vụ import được xử lý bất đồng bộ thông qua RabbitMQ Worker:
  - Tải file từ Supabase về, parse từng hàng để validate (họ tên, email, phone...).
  - Insert khách mời hợp lệ vào bảng `VIP_GUESTS` và cập nhật `imported_rows`.
  - Nếu gặp lỗi ở hàng nào (ví dụ email không đúng định dạng, trùng lặp email với khách VIP khác), ghi nhận chi tiết lỗi vào `error_logs`.
  - Sau khi xử lý xong (hoặc thất bại), xóa tệp tạm trên Supabase Storage.
- Xóa cascade bản ghi `vip_guest_imports` tương ứng khi xóa concert.

##### Indexes

| Index Name                              | Columns                  | Type                   | Purpose                                                 |
| :-------------------------------------- | :----------------------- | :--------------------- | :------------------------------------------------------ |
| `pk_vip_guest_imports`                  | `id`                     | `PRIMARY KEY (B-Tree)` | Tự động tạo cho khóa chính                              |
| `idx_vip_guest_imports_concert_created` | `concert_id, created_at` | `B-Tree`               | Truy vấn nhanh lịch sử import khách VIP của một concert |

---

## Thiết kế kiểm soát truy cập

### Mô hình phân quyền: Role-Based Access Control (RBAC)

#### Các phương án cân nhắc

| #   | Phương án                              | Mô tả                                                                                                                                                            |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **Session-based Authentication**       | Server lưu session trong memory/Redis, client gửi session cookie mỗi request.                                                                                    |
| B   | **JWT (JSON Web Token) + RBAC Guards** | Server phát JWT chứa user info + role khi đăng nhập. Client gửi JWT trong header `Authorization: Bearer`. Server verify JWT mỗi request mà không cần tra cứu DB. |
| C   | **OAuth2 / OpenID Connect**            | Delegate authentication cho Identity Provider bên ngoài (Google, Auth0).                                                                                         |

#### Đánh giá

| Tiêu chí                                  | Session-based                  | JWT + RBAC                         | OAuth2                          |
| ----------------------------------------- | ------------------------------ | ---------------------------------- | ------------------------------- |
| Stateless (không cần server-side storage) | ❌ Cần Redis/memory            | ✅ Token tự chứa thông tin         | ✅ Token từ IdP                 |
| Phù hợp Mobile App (soát vé)              | ❌ Cookie khó dùng trên mobile | ✅ Header-based, dễ dùng           | ⚠️ Phức tạp cấu hình            |
| Revoke token tức thì                      | ✅ Xóa session                 | ❌ Phải dùng blacklist             | ⚠️ Phụ thuộc IdP                |
| Độ phức tạp triển khai                    | ✅ Đơn giản                    | ✅ Đơn giản (passport-jwt)         | ❌ Cần IdP, cấu hình OAuth flow |
| Tích hợp NestJS                           | ✅ express-session             | ✅ @nestjs/passport + passport-jwt | ⚠️ Phức tạp hơn                 |

#### Chốt giải pháp: JWT + RBAC Guards (Phương án B)

**Lý do:** JWT stateless phù hợp với kiến trúc có Mobile App (soát vé offline cần token không phụ thuộc server session). NestJS có sẵn `@nestjs/passport` + `passport-jwt` tích hợp rất tốt. Việc không revoke tức thì được chấp nhận vì JWT có `expiresIn` ngắn (ví dụ 1 giờ) và đồ án không yêu cầu logout tức thì trên tất cả thiết bị.

### Nhóm người dùng và quyền truy cập

Hệ thống định nghĩa 3 vai trò chính (`audience`, `organizer`, `gate_staff`) được phân cấp rõ ràng về chức năng và phạm vi dữ liệu được phép thao tác.

#### 1. Ma trận vai trò và quyền hạn (Role-Permission Matrix)

Để đảm bảo tính nhất quán trên toàn hệ thống, ma trận dưới đây phân loại quyền truy cập theo từng nhóm tính năng chính:

| Nhóm tính năng | Hành động chi tiết | Khán giả (`audience`) | Ban tổ chức (`organizer`) | Nhân viên soát vé (`gate_staff`) |
| :--- | :--- | :---: | :---: | :---: |
| **Đăng nhập & Xác thực** | Đăng nhập hệ thống, gia hạn JWT token | ✅ | ✅ | ✅ |
| | Cập nhật thông tin cá nhân của bản thân | `S` | `S` | `S` |
| **Quản lý Concert** | Xem danh sách concert, chi tiết concert | ✅ | ✅ | ✅ |
| | Tạo mới, cập nhật, xóa Concert | ❌ | ✅ | ❌ |
| | Tạo tiểu sử nghệ sĩ bằng AI | ❌ | ✅ | ❌ |
| **Quản lý Vé & Đặt vé** | Xem danh sách loại vé của concert | ✅ | ✅ | ✅ |
| | Cập nhật số lượng, giá vé, tạo loại vé mới | ❌ | ✅ | ❌ |
| | Đặt vé (Booking), chọn ghế | ✅ | ❌ | ❌ |
| | Thanh toán hóa đơn (MOMO/VNPAY) | `S` | ❌ | ❌ |
| | Xem thông tin chi tiết hóa đơn, vé của mình | `S` | ❌ | ❌ |
| **Khách mời VIP** | Import danh sách VIP từ file CSV | ❌ | ✅ | ❌ |
| | Tra cứu, tìm kiếm, phân trang danh sách khách VIP | ❌ | ✅ | ❌ |
| **Soát vé (Check-in)** | Đồng bộ/Tải dữ liệu soát vé (Offline sync) | ❌ | ✅ | ✅ |
| | Quét mã QR Ticket / QR VIP để soát vé (Online/Offline) | ❌ | ✅ | ✅ |
| | Upload dữ liệu quét check-in offline lên hệ thống | ❌ | ✅ | ✅ |
| **Báo cáo & Thống kê** | Xem dashboard doanh thu, tỉ lệ check-in, số lượng vé | ❌ | ✅ | ❌ |

> **Ghi chú ký hiệu:**
> *   `✅`: Cho phép toàn quyền (Allow).
> *   `❌`: Không cho phép (Deny).
> *   `S` (Self-only): Chỉ cho phép nếu tài nguyên thuộc sở hữu của chính người dùng yêu cầu (ví dụ: Booking có `userId` trùng khớp với `userId` của token).

---

### Cơ chế thực thi phân quyền (Authorization Enforcement)

Phân quyền được thực thi chặt chẽ ở cả 3 lớp: **Backend API (Endpoints)**, **Frontend Web App (UI)**, và **Mobile Scan App (App)**.

```mermaid
flowchart TD
    classDef req fill:#e8eaf6,stroke:#1a237e,stroke-width:2px,color:#1a237e;
    classDef guard fill:#e0f7fa,stroke:#006064,stroke-width:2px,color:#006064;
    classDef err fill:#ffebee,stroke:#c62828,stroke-width:2px,color:#c62828;
    classDef controller fill:#e0f2f1,stroke:#004d40,stroke-width:2px,color:#004d40;
    classDef decision fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#4a148c;
    classDef db fill:#fff8e1,stroke:#ff6f00,stroke-width:2px,color:#824a00;

    Request([Request]):::req --> AuthGuard["AuthGuard<br/>(Xác thực - Giải mã JWT)"]:::guard
    AuthGuard -->|"JWT hợp lệ"| RolesGuard["RolesGuard<br/>(Kiểm tra vai trò - Role)"]:::guard
    AuthGuard -->|"JWT không hợp lệ / Hết hạn"| 401["HTTP 401 Unauthorized"]:::err

    RolesGuard -->|"Vai trò trùng khớp"| Controller["Controller Layer"]:::controller
    RolesGuard -->|"Vai trò không hợp lệ"| 403["HTTP 403 Forbidden"]:::err

    Controller --> Ownership{"Kiểm tra sở hữu?<br/>(Ownership Check)"}:::decision
    Ownership -->|"Khớp userId / resource.userId"| DB[("Truy cập dữ liệu (DB / Service)")]:::db
    Ownership -->|"Không khớp"| 403_2["HTTP 403 Forbidden"]:::err
```

#### 1. Thực thi tại Backend API (Endpoints enforcement)

Lớp Backend API là chốt chặn quan trọng nhất, đảm bảo dữ liệu không bị truy cập trái phép qua các công cụ gọi API trực tiếp (Postman, curl).

*   **Xác thực tập trung (AuthGuard):**
    *   Tất cả các API được bảo vệ (trừ xem concert) đều phải qua `AuthGuard` chạy global hoặc per-route.
    *   Giải mã JWT chứa payload dạng `{ userId, email, role }`. Nếu token hết hạn hoặc sai chữ ký, trả về ngay lập tức mã lỗi `HTTP 401 Unauthorized`.
*   **Phân quyền theo vai trò (RolesGuard):**
    *   Sử dụng Decorator tự định nghĩa `@Roles(UserRole.ORGANIZER, UserRole.GATE_STAFF)` trên các controller endpoint.
    *   `RolesGuard` đọc metadata và so sánh trực tiếp thuộc tính `role` trong payload JWT của Request với danh sách các vai trò được phép truy cập endpoint.
    *   Nếu vai trò người dùng không nằm trong danh sách được định nghĩa, API trả về ngay lập tức `HTTP 403 Forbidden`.
*   **Kiểm tra quyền sở hữu tài nguyên (Ownership Check):**
    *   Đối với vai trò `audience`, phân quyền vai trò là chưa đủ vì một khán giả có thể gọi API xem đơn hàng của khán giả khác.
    *   Tại tầng Logic Service, hệ thống kiểm tra điều kiện sở hữu: `request.user.userId === booking.userId` hoặc `request.user.userId === ticket.ownerId`. Chỉ khi điều kiện này được thỏa mãn, truy vấn DB mới được thực thi; ngược lại, hệ thống ném ra ngoại lệ `ForbiddenException` (`HTTP 403`).

#### 2. Thực thi tại Giao diện Web (Frontend UI enforcement)

Đảm bảo trải nghiệm sử dụng mượt mà, định hướng đúng chức năng cho từng nhóm đối tượng và che giấu các chức năng quản trị khỏi người dùng thường.

*   **Bảo vệ định tuyến (Route Guarding / Middleware):**
    *   Khi người dùng đăng nhập, JWT được giải mã (decode) và lưu trữ thông tin vai trò (`role`) vào State/Context.
    *   Đối với các trang quản trị `/admin/*` hoặc `/organizer/*`, Router Guard hoặc Middleware (ví dụ Next.js Middleware) sẽ kiểm tra vai trò của người dùng. Nếu vai trò không phải `organizer`, hệ thống chặn chuyển trang và chuyển hướng (redirect) người dùng về trang chủ `/` hoặc trang thông báo lỗi `403 Access Denied`.
*   **Ẩn/Hiện thành phần giao diện (Conditional UI Rendering):**
    *   Hệ thống kiểm tra vai trò của tài khoản đang đăng nhập để hiển thị động các nút điều hướng.
    *   *Ví dụ:* Chỉ hiển thị tab "Quản lý Concert", "Xem báo cáo thống kê", hoặc nút "Import danh sách khách VIP" đối với người dùng có vai trò là `organizer`. Người dùng có vai trò `audience` hoàn toàn không nhìn thấy các nút thao tác này trên màn hình.
*   **Xử lý Token hết hạn & Hết phiên:**
    *   Nếu backend trả về mã `HTTP 401` hoặc `403` khi gọi API, frontend sẽ tự động xóa token khỏi LocalStorage/Cookie, xóa trạng thái đăng nhập trong ứng dụng, và đẩy người dùng về trang Login.

#### 3. Thực thi tại Ứng dụng di động (Mobile App enforcement)

Ứng dụng di động được thiết kế riêng biệt phục vụ nhân viên soát vé tại sự kiện (online/offline).

*   **Giới hạn quyền đăng nhập (Login Restrictions):**
    *   Ngay khi đăng nhập thành công từ Mobile App, ứng dụng phân tích claim `role` trong JWT.
    *   Nếu vai trò là `audience`, ứng dụng lập tiếp từ chối và hiển thị thông báo lỗi: *"Tài khoản của bạn không có quyền đăng nhập vào ứng dụng soát vé. Vui lòng liên hệ ban tổ chức."* và thực hiện logout tự động.
*   **Ràng buộc chức năng soát vé:**
    *   Chức năng quét QR soát vé và đồng bộ check-in offline (`GET /checkin/data`, `POST /checkin/sync`) chỉ mở khóa và hoạt động khi token trong máy có vai trò là `gate_staff` hoặc `organizer`.
    *   Các cơ chế lưu trữ cục bộ dữ liệu soát vé (Local DB) được mã hóa để ngăn chặn tình trạng gate staff truy cập hoặc chỉnh sửa file trực tiếp trên thiết bị di động.

---

## Thiết kế các cơ chế bảo vệ hệ thống

### Kiểm soát tải đột biến (Rate Limiting)

#### Các phương án cân nhắc

| #   | Phương án                                                | Mô tả                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **Single-Layer Rate Limiting (chỉ tại Application)**     | Toàn bộ logic rate limiting (theo IP và User ID) được xử lý tại tầng ứng dụng NestJS bằng Token Bucket trên Redis. Mọi request đều đi qua Nginx (chỉ proxy), vào NestJS, parse JWT, rồi mới kiểm tra giới hạn.                                                    |
| B   | **Two-Tiered Rate Limiting (API Gateway + Application)** | Chia rate limiting thành 2 lớp phòng thủ: Lớp 1 tại API Gateway (OpenResty) chặn theo IP bằng Token Bucket in-memory để phòng thủ diện rộng (DDoS, Bot). Lớp 2 tại API Gateway chặn theo User ID bằng Sliding Window Log trên Redis (chống đầu cơ vé).             |
| C   | **Thay Nginx bằng Kong API Gateway**                     | Sử dụng Kong (API Gateway chuyên dụng) thay thế Nginx, tận dụng plugin rate-limiting có sẵn hỗ trợ nhiều tiêu chí (IP, Consumer, Header). Kong cần thêm PostgreSQL/Cassandra riêng để lưu cấu hình hoặc chạy DB-less mode.                                        |

#### Đánh giá

| Tiêu chí                             | Single-Layer (NestJS only)                                                                              | Two-Tiered (OpenResty + NestJS)                                                                          | Kong API Gateway                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Bảo vệ hạ tầng trước DDoS            | ❌ Yếu — request vẫn phải vào NestJS, parse header, kết nối Redis mới bị chặn. Nguy cơ nghẽn Event Loop | ✅ Mạnh — Nginx chặn ngay tại rìa hệ thống (Edge), xử lý bằng C native, không tiêu tốn tài nguyên NestJS | ✅ Mạnh — Kong xử lý tại Gateway, tương tự Nginx                           |
| Chống gian lận đặt vé (theo User ID) | ⚠️ Có nhưng lẫn lộn cùng lớp với IP check                                                               | ✅ Tách biệt rõ ràng — Lớp 2 khóa cứng theo User ID trên Redis qua Lua, bất kể user đổi IP (VPN/Proxy)     | ✅ Có plugin hỗ trợ, nhưng cần cấu hình JWT plugin kèm theo                |
| Độ phức tạp hạ tầng                  | ✅ Đơn giản — chỉ cần NestJS + Redis                                                                    | ✅ Thấp — OpenResty đã có sẵn trong kiến trúc, chỉ thêm các file script Lua                              | ❌ Cao — cần thêm container Kong + DB riêng (PostgreSQL/Cassandra), ~150MB |
| Phù hợp quy mô đồ án (team nhỏ)      | ✅ Rất phù hợp                                                                                          | ✅ Phù hợp — không tăng độ phức tạp vận hành                                                             | ❌ Over-engineering cho Modular Monolith                                   |
| Khả năng mở rộng sau này             | ⚠️ Hạn chế — mọi thứ gói trong NestJS                                                                   | ✅ Tốt — nếu cần chuyển sang Kong sau, chỉ thay OpenResty                                                | ✅ Rất tốt — plugin ecosystem phong phú                                    |

#### Chốt giải pháp: Phương án B — Two-Tiered Rate Limiting (OpenResty + NestJS)

**Lý do:**

- **Nginx/OpenResty đã có sẵn** trong kiến trúc Container Diagram với vai trò Reverse Proxy — chỉ cần bổ sung cấu hình `limit_req` và các file kịch bản Lua, không thêm container hay dependency mới.
- **Tách biệt trách nhiệm rõ ràng:** Lớp 1 (OpenResty) chỉ lo chặn IP bất hợp pháp bằng native C module (`ngx_http_limit_req_module`) với tốc độ nano-giây, không tiêu tốn tài nguyên NestJS. Lớp 2 (OpenResty qua Lua script) lo bảo vệ nghiệp vụ theo User ID bằng cách trực tiếp giải mã token JWT và đối soát Sliding Window Log trên Redis trước khi chuyển tiếp request vào NestJS Application.
- **Kong là over-engineering** cho Modular Monolith: chỉ có 1 NestJS app phía sau, không cần hệ sinh thái plugin phức tạp. Nếu sau này chuyển sang Microservices, có thể nâng cấp từ OpenResty lên Kong mà không cần tái cấu trúc.

#### Kiến trúc 2 lớp Rate Limiting

```mermaid
flowchart TD
    classDef internet fill:#ffebee,stroke:#c62828,stroke-width:2px,color:#c62828;
    classDef gateway fill:#eceff1,stroke:#37474f,stroke-width:2px,color:#37474f;
    classDef app fill:#e0f2f1,stroke:#004d40,stroke-width:2px,color:#004d40;
    classDef db fill:#fff8e1,stroke:#ff6f00,stroke-width:2px,color:#824a00;
    classDef reject fill:#fce4ec,stroke:#880e4f,stroke-width:2px,color:#880e4f;

    Internet["Internet Traffic"]:::internet
    Internet --> OpenResty

    subgraph OpenRestyGateway["OpenResty API Gateway"]
        subgraph Layer1["Lớp 1: IP protection"]
            IPLimit["limit_req module<br/>(50 req/s, burst 30)<br/>Token Bucket (In-memory)"]:::gateway
        end
        
        subgraph Layer2["Lớp 2: Identity protection"]
            DecodeJWT["Decode JWT & Verify signature<br/>(lấy User ID)"]:::gateway
            SlidingWindow["Lua Script + Redis Sorted Set<br/>(Sliding Window Log)<br/>- 10 req/min (POST /bookings)<br/>- 3 req/min (POST /payments)"]:::db
        end
    end

    IPLimit -->|"IP hợp lệ"| DecodeJWT
    IPLimit -->|"IP vượt ngưỡng"| Reject1["HTTP 429<br/>X-RateLimit-Source: gateway"]:::reject
    
    DecodeJWT --> SlidingWindow
    SlidingWindow -->|"User ID chưa vượt ngưỡng"| NestJS["NestJS Application<br/>(Business Logic / Workers)"]:::app
    SlidingWindow -->|"User ID vượt ngưỡng"| Reject2["HTTP 429<br/>X-RateLimit-Source: gateway-user"]:::reject
```

#### Lớp 1 — API Gateway (Nginx `limit_req`)

**Mục đích:** Phòng thủ diện rộng (Global Protection). Chặn các cuộc tấn công DDoS, bot cào dữ liệu, hoặc người dùng nhấn F5 liên tục trước khi request chạm tới NestJS Application.

**Thuật toán:** Token Bucket (Leaky Bucket variant) — module native `ngx_http_limit_req_module`, xử lý hoàn toàn trong shared memory của Nginx, không cần Redis.

**Cấu hình Nginx:**

```nginx
# Khai báo zone: 10MB shared memory, 50 req/s per IP
limit_req_zone $binary_remote_addr zone=global:10m rate=50r/s;

server {
    location / {
        # burst=30: cho phép burst tối đa 30 request trước khi reject
        # nodelay: xử lý burst ngay lập tức, không queue chờ
        limit_req zone=global burst=30 nodelay;
        limit_req_status 429;

        # Trả về JSON thay vì HTML mặc định của Nginx
        error_page 429 = @rate_limit_exceeded;

        proxy_pass http://nestjs_app;
    }

    location @rate_limit_exceeded {
        default_type application/json;
        add_header X-RateLimit-Source "gateway" always;
        return 429 '{"statusCode":429,"message":"Too many requests. Please slow down."}';
    }
}
```

| Tham số   | Giá trị      | Ý nghĩa                                                              |
| --------- | ------------ | -------------------------------------------------------------------- |
| `rate`    | `50r/s`      | Tối đa 50 request/giây cho mỗi IP address                            |
| `burst`   | `30`         | Cho phép burst thêm 30 request vượt ngưỡng (phù hợp người dùng thật) |
| `nodelay` | —            | Xử lý burst ngay, không delay/queue                                  |
| `zone`    | `global:10m` | 10MB shared memory (~160,000 IP addresses đồng thời)                 |

#### Tầng bảo vệ bổ sung: Global IP-based Throttler (@nestjs/throttler)

Bên cạnh Nginx ở cổng vào, tại chính ứng dụng NestJS cũng áp dụng một bộ lọc giới hạn tần suất yêu cầu IP-based toàn cục thông qua `ThrottlerGuard` để chống spam API cơ bản:

- **Cấu hình:** Mặc định áp dụng cho tất cả các API công khai hoặc không nhạy cảm (như xem thông tin concert, login/register...). Giới hạn có thể tùy biến qua biến môi trường `THROTTLER_LIMIT` (ví dụ: mặc định `100000` ở local để tránh chặn nhầm trong phát triển/kiểm thử tải).
- **Cơ chế bỏ qua (Skip):** Các endpoint nhạy cảm (như `/bookings`, `/payments/momo`, `/payments/vnpay`) đã được bảo vệ bởi lớp rate limit chuyên sâu tại Gateway sẽ sử dụng decorator `@SkipThrottle()` để bỏ qua bộ lọc IP này, tránh cản trở người dùng thật khi thao tác thanh toán hoặc đặt vé nhanh.

#### Lớp 2 — Gateway-level Identity Rate Limiting (Redis Sliding Window Log qua Lua)

**Mục đích:** Bảo vệ nghiệp vụ chuyên sâu (Business Logic Protection). Ngăn chặn một tài khoản (User ID) lách luật bằng cách mở nhiều tab, dùng VPN đổi IP, hoặc viết script gửi đồng thời hàng loạt request đặt vé. Việc giải mã JWT và đối soát rate limit được thực hiện ngay tại **OpenResty API Gateway** (sử dụng thư viện `lua-resty-jwt` và `resty.redis`) giúp lọc bỏ các request spam sớm trước khi chúng chạm tới NestJS.

**Thuật toán:** Sliding Window Log trên Redis — sử dụng Lua Script trực tiếp thực thi tại Gateway tương tác với Redis thông qua Sorted Set (`ZSET`) để lưu trữ log thời gian của từng request và đếm chính xác số request trong cửa sổ thời gian trượt, triệt tiêu hiện tượng burst tại ranh giới window mà Fixed Window mắc phải.

**Chỉ áp dụng cho các endpoint nhạy cảm:**

| Endpoint                                     | Window | Max Requests | Áp dụng theo | Lý lý                                |
| -------------------------------------------- | ------ | ------------ | ------------ | ------------------------------------ |
| `POST /bookings` (đặt vé)                    | 1 phút | 10           | User ID      | Chống script spam đặt chỗ hàng loạt  |
| `POST /payments/momo` / `vnpay` (thanh toán) | 1 phút | 3            | User ID      | Chống gửi request thanh toán lặp lại |

> **Lưu ý:** Endpoint đọc dữ liệu (`GET /concerts`) **không cần** rate limit ở Lớp 2 vì đã được bảo vệ bởi Nginx (Lớp 1) và CDN Cache.

**Redis Lua Script — Sliding Window Log:**

```lua
-- KEYS[1] = rate_limit:{user_id}:{endpoint}
-- ARGV[1] = window_size (kích thước cửa sổ, milliseconds, ví dụ: 60000 = 1 phút)
-- ARGV[2] = max_requests (số request tối đa trong window)
-- ARGV[3] = unique_id (mã định danh duy nhất của request để tránh trùng lặp ZSET member)

local key = KEYS[1]
local window = tonumber(ARGV[1])
local max_req = tonumber(ARGV[2])
local unique_id = ARGV[3]

-- 1. Lấy thời gian đồng nhất từ Redis Server (giây + microgiây)
local redis_time = redis.call('time')
local now = (tonumber(redis_time[1]) * 1000) + math.floor(tonumber(redis_time[2]) / 1000)

-- 2. Xóa các bản ghi cũ nằm ngoài cửa sổ thời gian trượt
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

-- 3. Đếm số request hiện tại trong cửa sổ trượt
local current = redis.call('ZCARD', key)

if current >= max_req then
    return 0  -- VƯỢT NGƯỠNG → chặn
end

-- 4. Ghi nhận request mới (score = timestamp, member = timestamp:unique_id)
redis.call('ZADD', key, now, now .. ':' .. unique_id)

-- 5. Đặt TTL tự động dọn dẹp key khi hết window
redis.call('PEXPIRE', key, window)

return 1  -- CHO PHÉP
```

**Key Pattern trên Redis:**

| Key Pattern                       | Kiểu dữ liệu | Mô tả                                                                                                                                                                                                                  |
| :-------------------------------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rate_limit:{tracker}:{endpoint}` | Sorted Set   | Đếm số lượng request trượt trong cửa sổ thời gian. `tracker` mặc định là User ID (hoặc fallback IP address), `endpoint` là đường dẫn API (ví dụ: `rate_limit:u-123:/bookings` hoặc `rate_limit:u-123:/payments/momo`). |

**Hành vi khi vượt ngưỡng:** Trả về `HTTP 429 Too Many Requests` kèm header `X-RateLimit-Source: gateway-user` để client phân biệt với lỗi 429 từ Nginx Gateway IP-based rate limit (`gateway`).

**Thiết kế chịu lỗi & Đồng bộ đa thực thể (Gateway Resilience):**

- **Đồng bộ thời gian:** Sử dụng `redis.call('time')` của Redis Server để tính timestamp hiện tại thay vì dùng thời gian hệ thống của các instance Gateway khác nhau, giúp loại bỏ hoàn toàn ảnh hưởng của lỗi lệch múi giờ (Clock Drift).
- **Cơ chế dự phòng (Fail-Open):** Lua script tại OpenResty bọc lệnh kết nối và truy vấn Redis trong các khối kiểm tra an toàn. Nếu Redis bị gián đoạn hoặc gặp sự cố kết nối, Gateway sẽ ghi nhận lỗi cảnh báo vào error log và tự động áp dụng cơ chế **Fail-Open** (cho phép request đi tiếp tới NestJS) để tránh gây gián đoạn dịch vụ của người dùng thật.
- **Trust Proxy:** Cấu hình `trust proxy` trong NestJS `main.ts` và thiết lập các trường Header thích hợp (`X-Real-IP`, `X-Forwarded-For`) tại Nginx để NestJS backend nhận dạng đúng địa chỉ IP của Client khi nằm sau Gateway.

#### Phòng chống vắt kiệt CPU (Failed Authentication IP-based Rate Limiter)

**Mục đích:** Bảo vệ tài nguyên tính toán (CPU) của NestJS trước các cuộc tấn công DDoS hoặc brute-force xoay vòng token giả. Việc xác thực chữ ký số JWT bằng mật mã học (cryptography) tiêu tốn rất nhiều CPU. Nếu kẻ tấn công gửi hàng triệu request mang token giả (chuỗi ngẫu nhiên hoặc token sai signature), NestJS vẫn phải giải mã chữ ký cho mỗi request, dẫn đến CPU của server bị vắt kiệt và gây nghẽn tiến trình Node.js (đơn luồng).

**Cơ chế hoạt động:**

1. Khi request đi vào `JwtAuthGuard` (áp dụng cho tất cả các endpoint cần xác thực JWT), hệ thống sẽ lấy địa chỉ IP của client (nhờ vào `trust proxy`).
2. Kiểm tra IP xem có bị block tạm thời trong Redis hay không thông qua key `auth_blocked:<ip>`.
   - Nếu **Có**: Từ chối request ngay lập tức với mã lỗi `HTTP 429 Too Many Requests` và header `X-RateLimit-Source: failed-auth-ip`. Lớp này hoàn toàn không thực hiện giải mã hay xác thực chữ ký JWT, giúp bảo vệ CPU tối đa.
   - Nếu **Không**: Cho phép tiếp tục thực hiện giải mã và xác thực chữ ký JWT.
3. Nếu xác thực JWT **thành công**: Cho phép request đi tiếp đến lớp rate limit theo User ID (`RedisRateLimitGuard`).
4. Nếu xác thực JWT **thất bại** (throws 401 Unauthorized do token fake/sai signature):
   - Bắt exception thất bại này và ghi nhận đếm lỗi vào Redis: tăng giá trị key `auth_fail_count:<ip>` thêm 1 đơn vị, đặt TTL cho key này là 60 giây.
   - Nếu số lần xác thực sai của IP đó đạt ngưỡng **5 lần** trong vòng 60 giây, tiến hành tạo key block `auth_blocked:<ip>` trong Redis với giá trị là `1` và thời gian hết hạn TTL là 900 giây (15 phút). Đồng thời xóa key đếm lỗi `auth_fail_count:<ip>`.
   - Ném ra lỗi `401 Unauthorized` ban đầu cho client.

**Redis Key Schema cho Bảo vệ CPU:**

| Key Pattern            | Kiểu dữ liệu     | TTL                | Mô tả                                       |
| :--------------------- | :--------------- | :----------------- | :------------------------------------------ |
| `auth_fail_count:<ip>` | String (Counter) | 60 giây            | Đếm số lần xác thực JWT thất bại của một IP |
| `auth_blocked:<ip>`    | String           | 900 giây (15 phút) | Đánh dấu IP bị khóa, chặn mọi xác thực JWT  |

**Ưu điểm vượt trội:**

- **Không block nhầm người dùng hợp lệ:** Dù nhiều người dùng hợp lệ dùng chung một mạng NAT (cùng IP public), họ gửi token hợp lệ nên không phát sinh lỗi 401. Chỉ những IP thực sự gửi token giả liên tục mới bị block.
- **Tối ưu hiệu năng:** Chi phí đọc ghi key string đơn giản trên Redis cực kỳ rẻ và nhanh so với chi phí tính toán mật mã giải mã chữ ký JWT trên Node.js.

---

### Xử lý cổng thanh toán không ổn định (Circuit Breaker)

#### Các phương án cân nhắc

| #   | Phương án                                | Mô tả                                                                                                                              |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A   | **Retry đơn giản (Exponential Backoff)** | Khi gọi payment API lỗi, tự động retry với khoảng cách tăng dần (1s → 2s → 4s).                                                    |
| B   | **Circuit Breaker Pattern**              | Theo dõi tỷ lệ lỗi. Khi vượt ngưỡng → cắt mạch (Open), ngừng gọi API lỗi, chuyển sang fallback. Sau timeout → thử lại (Half-Open). |
| C   | **Bulkhead Pattern**                     | Giới hạn số concurrent connections tới payment gateway, tránh một gateway lỗi kéo sập toàn hệ thống.                               |

#### Đánh giá

| Tiêu chí               | Retry                               | Circuit Breaker             | Bulkhead                  |
| ---------------------- | ----------------------------------- | --------------------------- | ------------------------- |
| Ngăn cascade failure   | ❌ Retry liên tục có thể làm tệ hơn | ✅ Cắt mạch ngay            | ⚠️ Giới hạn nhưng vẫn gọi |
| Phát hiện lỗi hệ thống | ❌ Không                            | ✅ Tracking tỷ lệ lỗi       | ❌ Không                  |
| Tự phục hồi            | ❌ Phải retry thủ công              | ✅ Half-Open → auto-recover | ❌ Không                  |
| Thư viện NestJS        | ✅ axios-retry                      | ✅ opossum                  | ⚠️ Cần tự viết            |

#### Chốt giải pháp: Circuit Breaker kết hợp Graceful Degradation (Dynamic Switch & Read-Only Failover)

**Lý do:**

- **Tách biệt bảo vệ:** Hệ thống sử dụng hai Circuit Breaker độc lập (`vnpayCircuitBreaker` và `momoCircuitBreaker` sử dụng thư viện `opossum`) cho từng cổng thanh toán trực tuyến. Điều này tránh việc sự cố của cổng này ảnh hưởng đến cổng khác.
- **Graceful Degradation (Read-Only Failover):**
  - _Dynamic Switch:_ Khi một cổng thanh toán bị sập (Circuit Breaker chuyển sang trạng thái `OPEN`), hệ thống và giao diện hiển thị trạng thái `OPEN` để người dùng chủ động chọn cổng thanh toán còn lại.
  - _Read-Only Failover:_ Khi cả hai cổng thanh toán đều sập, các nút thanh toán trên Frontend bị vô hiệu hóa hoàn toàn, hiển thị thông báo bảo trì. Tuy nhiên, các API đọc thông tin sự kiện (`GET /concerts/:id` và `GET /stagemap`) vẫn mở bình thường từ Redis Cache để khán giả vẫn xem được chi tiết sự kiện và sơ đồ ghế.

**Cấu hình Circuit Breaker cho từng cổng (`vnpayCircuitBreaker`, `momoCircuitBreaker`):**

| Tham số                    | Giá trị | Ý nghĩa                                       |
| -------------------------- | ------- | --------------------------------------------- |
| `timeout`                  | 8 giây  | Gateway không phản hồi trong 8s → coi là lỗi  |
| `errorThresholdPercentage` | 50%     | Cắt mạch khi >50% request lỗi                 |
| `resetTimeout`             | 30 giây | Thời gian chờ trước khi chuyển sang Half-Open |
| `rollingCountTimeout`      | 30 giây | Cửa sổ thống kê lỗi                           |
| `volumeThreshold`          | 5       | Số request tối thiểu trước khi tính tỷ lệ     |

**Cấu hình Retry (bên trong mỗi Gateway Client trước khi qua Circuit Breaker):**

| Tham số          | Giá trị        | Ý nghĩa                                                                 |
| ---------------- | -------------- | ----------------------------------------------------------------------- |
| `maxRetries`     | 2              | Tối đa retry 2 lần trước khi tính là failure                            |
| `retryDelay`     | 1s → 2s        | Exponential Backoff — tránh đánh dồn gateway khi đang quá tải           |
| `retryCondition` | 5xx, ETIMEDOUT | Chỉ retry khi lỗi server hoặc timeout, không retry với 4xx (lỗi client) |

**State Machine của Circuit Breaker:**

```mermaid
stateDiagram-v2
    [*] --> Closed
    Closed --> Open : lỗi > 50% (rolling window)
    Open --> HalfOpen : 30s timeout
    HalfOpen --> Closed : probe thành công (request OK)
    HalfOpen --> Open : probe thất bại (request error)
```

**Cơ chế Failover & Fallback:**

1. **Endpoint kiểm tra trạng thái cổng (`GET /payments/circuit-breaker/status`):**
   - API này trả về trạng thái của cả hai Circuit Breakers (ví dụ: `{"momo": "CLOSED", "vnpay": "OPEN"}`).
   - Frontend sẽ tự động kiểm tra kết quả này: nếu cổng nào ở trạng thái `OPEN`, Frontend sẽ disable tùy chọn đó, hiển thị nhãn `(Maintenance)` và gợi ý người dùng chọn phương thức còn lại.
   - Nếu cả hai cổng đều `OPEN`, Frontend hiển thị thông báo cổng thanh toán đang bảo trì toàn diện.

2. **Luồng xử lý Booking API (`POST /bookings`):**
   - API đặt vé tập trung vào xử lý giữ chỗ trong Redis và đẩy hàng đợi vào RabbitMQ, hoàn toàn độc lập với cổng thanh toán để đảm bảo tốc độ cao nhất (không kiểm tra Circuit Breaker ở bước này).

3. **Luồng xử lý Thanh toán (`POST /payments/momo` và `POST /payments/vnpay`):**
   - Khi nhận yêu cầu thanh toán qua cổng tương ứng (ví dụ MoMo):
     - Hệ thống gọi qua Circuit Breaker tương ứng (`momoBreaker`).
     - Nếu mạch `CLOSED` hoặc `HALF-OPEN`: Thực hiện gửi request khởi tạo thanh toán tới MoMo Sandbox.
     - Nếu mạch `OPEN`: Opossum sẽ ngắt mạch ngay lập tức, kích hoạt fallback ném ra lỗi `503 Service Unavailable` gợi ý người dùng đổi sang cổng thanh toán còn lại (VNPAY) hoặc thử lại sau.

#### Luồng xử lý thanh toán thông minh (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor K as Khán giả
    participant API as NestJS Booking/Payment Service
    participant CB_VN as VNPAY Circuit Breaker
    participant CB_MO as MoMo Circuit Breaker
    participant GW as Cổng thanh toán (VNPAY/MoMo)

    alt Yêu cầu đặt vé mới (POST /bookings)
        K->>API: POST /bookings (concertId, ticketTypeId, quantity)
        API->>API: Thực hiện kiểm tra tồn kho & giữ vé trên Redis
        API->>API: Lưu Order và đẩy job vào RabbitMQ
        API-->>K: Trả về HTTP 202 Accepted (kèm orderId)
    else Yêu cầu thanh toán (POST /payments/vnpay)
        K->>API: POST /payments/vnpay (orderId)
        API->>CB_VN: Thực hiện gọi VNPAY qua Circuit Breaker
        alt Gọi VNPAY thành công (CB = CLOSED/HALF-OPEN)
            CB_VN->>GW: Gọi API tạo giao dịch
            GW-->>API: Trả về link thanh toán (payUrl)
            API-->>K: HTTP 200 (Trả về payUrl)
        else Gọi VNPAY thất bại (CB = OPEN hoặc lỗi)
            CB_VN-->>API: Trả về lỗi ServiceUnavailableException (503)
            API-->>K: HTTP 503 (Cổng VNPAY bảo trì, gợi ý chọn MoMo)
        end
    end
```

**Hành vi khi sập toàn bộ cổng:** Khi cả hai Circuit Breaker đều `OPEN`, hệ thống kích hoạt chế độ bảo trì luồng mua vé. Mọi yêu cầu tạo đơn hàng mới (`POST /bookings`) và yêu cầu thanh toán (`POST /payments`) đều bị chặn với lỗi `HTTP 503 Service Unavailable`. Các API đọc thông tin như `GET /concerts/:id` và `GET /stagemap` vẫn hoạt động bình thường qua Redis Cache để khán giả xem thông tin sự kiện và sơ đồ ghế.

---

### Chống trừ tiền hai lần (Idempotency Key)

#### Các phương án cân nhắc

| #   | Phương án                        | Mô tả                                                                                                    |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| A   | **Database Unique Constraint**   | Lưu `idempotency_key` làm cột UNIQUE trong bảng bookings. DB tự chặn insert trùng.                       |
| B   | **Redis Lock + Cached Response** | Lưu `idempotency_key` trong Redis với TTL. Kiểm tra trước khi xử lý. Nếu đã xử lý → trả cached response. |
| C   | **Middleware + Database**        | Bảng riêng `idempotency_keys` lưu key + response + status. Check trước mỗi request.                      |

#### Đánh giá

| Tiêu chí                     | DB Unique                           | Redis Lock               | Middleware + DB      |
| ---------------------------- | ----------------------------------- | ------------------------ | -------------------- |
| Tốc độ kiểm tra              | ❌ Chậm (disk I/O)                  | ✅ Rất nhanh (in-memory) | ❌ Chậm              |
| Tự động expire               | ❌ Cần cleanup job                  | ✅ Redis TTL tự expire   | ❌ Cần cleanup job   |
| Trả lại cached response      | ❌ Chỉ chặn duplicate               | ✅ Lưu response kèm key  | ✅ Lưu response      |
| Phát hiện request đang xử lý | ❌ Không (chỉ biết khi insert fail) | ✅ SET NX → biết ngay    | ⚠️ Cần status column |

#### Chốt giải pháp: Phương án B — Redis Lock + Cached Response (Cơ chế 2 lớp khóa/cache độc lập)

**Lý do:** Dưới tải cao, kiểm tra trùng lặp phải **nhanh** (microseconds, không phải milliseconds). Redis `SET NX` (Set if Not Exists) cho phép kiểm tra + lock trong 1 thao tác nguyên tử. Hệ thống sử dụng cơ chế hai khóa tách biệt trên Redis để tối ưu hóa việc phân tách khóa lock ngắn hạn và bộ đệm kết quả dài hạn:

- **Khóa Lock (`idempotency:{key}:lock`):** Giá trị mặc định là `'processing'`, có thời gian hết hạn (TTL) ngắn là 30 giây để ngăn các request gửi song song (concurrency control).
- **Bộ đệm Response (`idempotency:{key}`):** Giá trị lưu trữ chuỗi JSON response, có TTL dài 24 giờ (86400 giây) để lưu kết quả đã thực hiện xong.

**Luồng xử lý:**

```mermaid
flowchart TD
    classDef req fill:#e8eaf6,stroke:#1a237e,stroke-width:2px,color:#1a237e;
    classDef redis fill:#fff8e1,stroke:#ff6f00,stroke-width:2px,color:#824a00;
    classDef process fill:#e0f2f1,stroke:#004d40,stroke-width:2px,color:#004d40;
    classDef decision fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#4a148c;
    classDef success fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px,color:#1b5e20;
    classDef conflict fill:#ffebee,stroke:#c62828,stroke-width:2px,color:#b71c1c;

    Req([Request với Idempotency-Key]):::req --> AcquireLock["Gọi Redis: SET idempotency:{key}:lock 'processing' NX EX 30"]:::redis
    AcquireLock -->|"Thành công (Lock acquired)"| GetCache1["Kiểm tra Redis: GET idempotency:{key}"]:::redis

    GetCache1 -->|"Cache hit (Đã xử lý xong trước đó)"| ReturnCached1["Giải phóng lock & Trả cached response (HTTP 200)"]:::success
    GetCache1 -->|"Cache miss"| Process["Xử lý giao dịch - nghiệp vụ"]:::process
    Process --> SaveResp["Lưu response: SET idempotency:{key} '{response}' EX 86400"]:::redis
    SaveResp --> ReleaseLock["Giải phóng lock: DEL idempotency:{key}:lock"]:::redis
    ReleaseLock --> ReturnSuccess["Trả HTTP 200 (kèm kết quả mới)"]:::success

    AcquireLock -->|"Thất bại (Lock exists)"| GetCache2["Kiểm tra Redis: GET idempotency:{key}"]:::redis
    GetCache2 -->|"Cache hit"| ReturnCached2["Trả cached response (HTTP 200)"]:::success
    GetCache2 -->|"Cache miss (Đang xử lý)"| ReturnConflict["Trả HTTP 409 Conflict<br/>(Giao dịch đang được xử lý)"]:::conflict
```

**TTL:**

- Khóa lock: 30 giây (tự giải phóng nếu app bị crash giữa chừng).
- Bộ đệm response: 24 giờ (đủ dài để cover các lần retry từ client).

---

### Caching (Cache-aside với Redis)

#### Các phương án cân nhắc

| #   | Phương án                      | Mô tả                                                                                                   |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| A   | **Cache-aside (Lazy Loading)** | App đọc cache trước. Cache miss → đọc DB → ghi cache. Cache hit → trả về. Invalidate khi data thay đổi. |
| B   | **Write-through**              | Mỗi lần ghi DB, đồng thời ghi cache. Đọc luôn từ cache.                                                 |
| C   | **Write-back (Write-behind)**  | Ghi vào cache trước, DB được cập nhật bất đồng bộ sau.                                                  |

#### Đánh giá

| Tiêu chí                    | Cache-aside                      | Write-through        | Write-back                 |
| --------------------------- | -------------------------------- | -------------------- | -------------------------- |
| Đơn giản triển khai         | ✅ Đơn giản                      | ⚠️ Trung bình        | ❌ Phức tạp (cần queue)    |
| Cache luôn fresh            | ⚠️ Có window stale (TTL)         | ✅ Luôn sync         | ✅ Luôn có trong cache     |
| Tải lên DB khi ghi          | ✅ Ghi thẳng DB                  | ✅ Ghi cả DB + cache | ⚠️ DB có thể lag           |
| Rủi ro mất data             | ✅ Không (DB là source of truth) | ✅ Không             | ❌ Cache crash → mất data  |
| Phù hợp read-heavy workload | ✅ Rất phù hợp                   | ✅ Phù hợp           | ⚠️ Phù hợp write-heavy hơn |

#### Chốt giải pháp: Cache-aside (Phương án A)

**Lý do:** Hệ thống có workload **read-heavy** (xem danh sách concert, chi tiết concert) chiếm >90% traffic. Cache-aside đơn giản, DB luôn là source of truth, và phù hợp nhất cho pattern này. Write-through không cần thiết vì concert info thay đổi không thường xuyên.

**Đối tượng cache và cấu hình:**

| Đối tượng                  | Redis Key Pattern                                       | TTL       | Invalidation Strategy                                 |
| -------------------------- | ------------------------------------------------------- | --------- | ----------------------------------------------------- |
| Danh sách concert mặc định | `cache:concerts:list:default:page:{page}:limit:{limit}` | 10 phút   | Xóa khi admin tạo/sửa/xóa hoặc đổi trạng thái concert |
| Chi tiết concert           | `cache:concerts:{id}`                                   | 10 phút   | Xóa key khi admin sửa concert                         |
| Danh sách loại vé          | `cache:concerts:{id}:ticket-types`                      | 10 phút   | Xóa khi admin thay đổi/sửa cấu hình loại vé           |
| Sơ đồ sân khấu (SVG)       | `cache:concerts:{id}:stagemap`                          | 30 phút   | Xóa khi admin cập nhật sơ đồ sân khấu                 |
| Số vé còn lại              | `inventory:{concert_id}:{ticket_type_id}`               | Không TTL | Luôn chính xác vì Lua Script trừ trực tiếp trên Redis |

**Lưu ý đặc biệt — Số vé còn lại:** Đây không phải cache thông thường. Giá trị tồn kho trên Redis **là source of truth** cho luồng đặt vé (Lua Script trừ trực tiếp), không phải bản sao của DB. Reconciliation Job đối soát Redis ↔ PostgreSQL mỗi 15 phút để xử lý edge case.

**Lưu ý đặc biệt — Sơ đồ sân khấu (SVG Stage Map):**

Trường `svg_stage_map` lưu trữ nội dung SVG sơ đồ sân khấu trực tiếp trong PostgreSQL dưới dạng `TEXT`. Kích thước mỗi SVG có thể dao động từ **50KB đến 500KB+**. Khi có hàng ngàn lượt truy cập xem chi tiết concert cùng lúc (đặc biệt trong thời điểm mở bán vé hot), việc đọc trường TOAST nặng này từ PostgreSQL cho mỗi request sẽ gây quá tải I/O.

**Chiến lược tách key riêng:** SVG stage map được cache trong Redis **tách biệt** khỏi object concert chính, sử dụng key pattern `cache:concerts:{id}:stagemap`. Lý do:

- **Tiết kiệm memory Redis:** API `GET /concerts/:id` (xem thông tin concert) trả về object nhẹ (~2KB) từ `cache:concerts:{id}` mà không kéo theo SVG nặng ~200KB. SVG chỉ được load khi user thực sự xem sơ đồ sân khấu (`GET /concerts/:id/stagemap`).
- **TTL tối ưu hóa riêng:** Sơ đồ sân khấu gần như cố định sau khi được tạo — admin hiếm khi thay đổi. TTL 30 phút (dài hơn 3x so với concert info) giúp giảm ~95% DB reads cho trường nặng nhất.
- **Invalidation đơn giản:** Khi admin cập nhật sơ đồ → `DEL cache:concerts:{id}:stagemap`. Key sẽ tự được populate lại ở lần đọc tiếp theo (lazy loading).

**Lưu ý đặc biệt — Danh sách concert mặc định:**

Để tránh hiện tượng bùng nổ số lượng khóa (Key Explosion) và rủi ro trùng lặp cache do có quá nhiều tổ hợp lọc động khác nhau (từ khóa tìm kiếm, địa điểm, tags), hệ thống chỉ áp dụng Cache-aside cho các truy vấn danh sách concert mặc định (không chứa các bộ lọc động như `search`, `location`, `tag` - chỉ chứa `page` và `limit` để phân trang).

- **Khi có bộ lọc động:** Hệ thống sẽ bỏ qua cache và truy vấn trực tiếp từ PostgreSQL thông qua các trường chỉ mục tối ưu (GIN index cho `tags` và B-Tree cho `location, status`).
- **Quy tắc đặt key:** `cache:concerts:list:default:page:{page}:limit:{limit}`.
- **Invalidation:** Khi có concert mới được tạo, cập nhật hoặc xóa bỏ/hủy bỏ, toàn bộ các key dạng mặc định này sẽ bị xóa bỏ trong Redis để đảm bảo tính nhất quán.

**Lưu ý đặc biệt — Tách biệt API và Hybrid Cache cho Hạng vé (Ticket Types):**

Để tối ưu hóa tính nhất quán về số lượng vé còn lại (`availableQuantity`) và hiệu năng đọc trang chi tiết concert, thông tin chi tiết concert (`GET /concerts/:id`) và danh sách hạng vé (`GET /concerts/:id/ticket-types`) được tách biệt thành 2 API độc lập:

1. **Chi tiết Concert (`GET /concerts/:id`)**: Chỉ trả về thông tin cơ bản của concert (không kèm danh sách hạng vé) từ khóa cache `cache:concerts:{id}` (TTL 10 phút).
2. **Danh sách hạng vé (`GET /concerts/:id/ticket-types`)**: Áp dụng mô hình **Hybrid Caching (Bộ nhớ đệm lai)**:
   - Các thuộc tính tĩnh của hạng vé (tên, giá, số lượng phát hành `totalQuantity`, số vé tối đa mỗi user `maxPerUser`, thời gian bán vé) được cache trong Redis dưới khóa `cache:concerts:{id}:ticket-types` (TTL 10 phút).
   - Riêng thuộc tính động thay đổi liên tục là số lượng vé còn lại (`availableQuantity`) sẽ được truy vấn trực tiếp theo thời gian thực (real-time) từ Redis thông qua lệnh `MGET` trên các khóa `inventory:{concertId}:{ticketTypeId}` (vốn là source of truth cập nhật từ booking transaction).
   - Dữ liệu trả về sẽ tự động ghi đè giá trị `availableQuantity` từ Redis vào trước khi phản hồi cho client.
   - **Ưu điểm:** Đảm bảo hiển thị tồn kho chính xác 100% cho client mà hoàn toàn không cần gọi vào PostgreSQL hay invalidate cache tĩnh của hạng vé mỗi khi có giao dịch mua vé thành công.

```mermaid
flowchart TD
    classDef req fill:#e8eaf6,stroke:#1a237e,stroke-width:2px,color:#1a237e;
    classDef redis fill:#fff8e1,stroke:#ff6f00,stroke-width:2px,color:#824a00;
    classDef db fill:#e0f2f1,stroke:#004d40,stroke-width:2px,color:#004d40;
    classDef decision fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#4a148c;
    classDef success fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px,color:#1b5e20;

    Req(["GET /concerts/:id/stagemap"]):::req --> RedisGet["Redis GET cache:concerts:{id}:stagemap"]:::redis
    RedisGet --> Check{"Cache hit?"}:::decision
    Check -->|"Hit"| ReturnCached["Trả SVG trực tiếp (< 1ms)"]:::success
    Check -->|"Miss"| QueryPG["Query PostgreSQL: SELECT svg_stage_map FROM concerts WHERE id = ..."]:::db
    QueryPG --> SetRedis["Redis SET cache:concerts:{id}:stagemap (TTL 30 phút)"]:::redis
    SetRedis --> ReturnFresh["Trả SVG cho client"]:::success
```

---

## Chiến lược xử lý High Concurrency

### Các phương án cân nhắc

| #   | Phương án                                                           | Mô tả                                                                                                                                                    |
| --- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **PostgreSQL SELECT FOR UPDATE (Pessimistic Locking)**              | Lock row tồn kho trong DB khi đặt vé, giảm `available_quantity`, commit. Các request khác phải chờ lock release.                                         |
| B   | **PostgreSQL Optimistic Locking (Version Column)**                  | Đọc tồn kho + version number, khi ghi kiểm tra version khớp. Nếu không khớp → retry.                                                                     |
| C   | **Redis Lua Script (Atomic In-Memory) + RabbitMQ (Async DB Write)** | Redis xử lý trừ tồn kho + kiểm tra per-user limit nguyên tử trong memory. Giao dịch hợp lệ được đẩy vào RabbitMQ, worker ghi vào PostgreSQL bất đồng bộ. |

### Đánh giá

| Tiêu chí                         | Pessimistic Lock (PG)                             | Optimistic Lock (PG)                                | Redis Lua + RabbitMQ                       |
| -------------------------------- | ------------------------------------------------- | --------------------------------------------------- | ------------------------------------------ |
| Throughput dưới tải 1000 req/s   | ❌ Nghẽn connection pool, row lock contention cao | ⚠️ Retry storm khi contention cao → throughput giảm | ✅ Redis single-threaded xử lý ~100K ops/s |
| Consistency                      | ✅ Strong (DB-level lock)                         | ✅ Strong (version check)                           | ✅ Strong (Lua script atomic)              |
| DB load                          | ❌ Mỗi request = 1 transaction                    | ❌ Mỗi request = 1+ transaction (retry)             | ✅ DB chỉ nhận write từ worker tuần tự     |
| Phức tạp triển khai              | ✅ Đơn giản                                       | ⚠️ Cần retry logic                                  | ⚠️ Cần Redis + RabbitMQ + Lua Script       |
| Kiểm tra per-user limit cùng lúc | ⚠️ Cần thêm query trong cùng transaction          | ⚠️ Phức tạp hơn khi kết hợp                         | ✅ Kiểm tra trong cùng Lua Script          |

### Chốt giải pháp: Phương án C — Redis Lua Script + RabbitMQ

**Lý do:** Với peak load 1,000 booking requests/giây, PostgreSQL sẽ bị nghẽn connection pool nếu mỗi request đều lock row. Redis xử lý single-threaded nên **Lua Script chạy nguyên tử tự nhiên** (không cần lock), throughput đạt ~100K ops/s — dư sức cho bài toán này. RabbitMQ đệm các booking task để worker ghi vào DB tuần tự, PostgreSQL không bao giờ chịu tải đột biến trực tiếp.

### Chi tiết triển khai

#### Quy trình luồng đặt vé (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor K as Khán giả
    participant API as API NestJS
    participant Redis as Redis
    participant MQ as RabbitMQ
    participant W as Worker
    participant DB as PostgreSQL

    K->>API: POST /bookings (concertId, items, IdempotencyKey)
    API->>Redis: EVAL Lua Script (reserve-ticket.lua)
    Note over API, Redis: Kiểm tra tồn kho & giới hạn mua mỗi user

    alt Lua Script -> LỖI (Hết vé hoặc Vượt giới hạn)
        Redis-->>API: Return -1 hoặc -2
        API-->>K: HTTP 400 Bad Request
    else Lua Script -> THÀNH CÔNG (Trừ tồn kho + Tăng user count)
        Redis-->>API: Return 0 (SUCCESS)
        API->>MQ: Publish OrderPayload vào booking_tasks
        API->>MQ: Publish DelayPayload vào booking_delay_queue (TTL 10 phút)
        API-->>K: HTTP 202 Accepted (kèm orderId tạm)
    end

    Note over MQ, W: Xử lý ghi DB bất đồng bộ
    MQ->>W: Consume từ booking_tasks
    W->>DB: BEGIN -> INSERT orders (status=pending) + INSERT tickets -> COMMIT
```

#### Redis Data Structures

| Key Pattern                                               | Kiểu             | Mô tả                             |
| --------------------------------------------------------- | ---------------- | --------------------------------- |
| `inventory:{concertId}:{ticketTypeId}`                    | String (integer) | Số vé còn lại của từng hạng vé    |
| `concert:{concertId}:user:{userId}:bought:{ticketTypeId}` | String (integer) | Số vé hạng đó user đã giữ chỗ/mua |

#### Lua Script — Đặt vé nguyên tử (`reserve-ticket.lua`)

```lua
local stockKey    = KEYS[1]
local userBought  = KEYS[2]
local quantity    = tonumber(ARGV[1])
local maxPerUser  = tonumber(ARGV[2])

-- 1. Khởi tạo tồn kho từ database nếu key chưa tồn tại trên Redis (Cold Start Protection)
local stockExists = redis.call('EXISTS', stockKey)
local currentStock
if stockExists == 0 then
  currentStock = tonumber(ARGV[3])
  redis.call('SET', stockKey, currentStock)
else
  currentStock = tonumber(redis.call('GET', stockKey) or '0')
end

-- 2. Kiểm tra tồn kho
if currentStock < quantity then
  return -1  -- INSUFFICIENT_STOCK
end

-- 3. Lấy số lượng vé user đã mua
local currentBought = tonumber(redis.call('GET', userBought) or '0')

-- 4. Kiểm tra giới hạn mua mỗi tài khoản
if (currentBought + quantity) > maxPerUser then
  return -2  -- EXCEEDS_USER_LIMIT
end

-- 5. Trừ tồn kho + Tăng số lượng đã mua của user (nguyên tử)
redis.call('DECRBY', stockKey, quantity)
redis.call('INCRBY', userBought, quantity)

return 0  -- SUCCESS
```

#### Lua Script — Hồi kho khi đơn hàng hết hạn (`release-ticket.lua`)

```lua
local stockKey   = KEYS[1]
local userBought = KEYS[2]
local quantity   = tonumber(ARGV[1])

-- 1. Trả lại tồn kho
redis.call('INCRBY', stockKey, quantity)

-- 2. Giảm số lượng vé đã mua của user (giới hạn tối thiểu là 0)
local currentBought = tonumber(redis.call('GET', userBought) or '0')
local newBought = math.max(0, currentBought - quantity)
redis.call('SET', userBought, newBought)

return 0  -- SUCCESS
```

#### Cơ chế hủy đơn đặt vé hết hạn (Order Expiration)

Hệ thống sử dụng cơ chế **hai lớp bảo vệ (Dual-Mechanism)** để dọn dẹp và hủy đơn hàng quá hạn thanh toán (10 phút):

1. **Cơ chế chủ đạo: RabbitMQ Dead Letter Exchange (DLX)**:
   - Khi tạo đơn hàng thành công, một tin nhắn chứa metadata được đẩy vào `booking_delay_queue` với cấu hình TTL là 10 phút (`x-message-ttl = 600000ms`).
   - Sau 10 phút, tin nhắn tự động bị hết hạn và đẩy qua Exchange `booking_dlx` chuyển tiếp tới queue `booking_expired_tasks`.
   - Consumer lắng nghe queue này, kiểm tra trạng thái đơn hàng trong PostgreSQL. Nếu vẫn là `pending`, cập nhật trạng thái đơn hàng thành `expired` và thực hiện chạy Lua Script hồi kho trên Redis.

2. **Cơ chế dự phòng: Distributed Cron Job**:
   - NestJS `@Cron('*/5 * * * *')` chạy mỗi 5 phút làm nhiệm vụ backup phòng khi RabbitMQ gặp sự cố không thể định tuyến tin nhắn DLX.
   - Tìm kiếm đơn hàng quá hạn thanh toán quá 12 phút (đã trừ đi 10 phút của DLX và thêm 2 phút đệm): `SELECT * FROM orders WHERE status = 'pending' AND createdAt < (NOW() - 12 minutes)`.
   - **Bảo vệ trong môi trường phân tán (Distributed Lock)**: Tác vụ backup này sử dụng khóa phân tán Redis `{order-expiration}:lock` với TTL 60 giây, đảm bảo chỉ có tối đa một thực thể Booking Worker trong cụm chạy quét xử lý tại một thời điểm, tránh race condition tải DB trùng lặp.

---

## Soát vé Ngoại tuyến (Offline Check-in)

### Thiết kế tổng quan

Sân vận động và nhà thi đấu thường mất sóng khi đông người. Hệ thống soát vé phải hoạt động **hoàn toàn offline** trên thiết bị di động và đồng bộ lại khi có mạng.

### Luồng hoạt động

```mermaid
flowchart TD
    classDef app fill:#e8eaf6,stroke:#1a237e,stroke-width:2px,color:#1a237e;
    classDef api fill:#e0f7fa,stroke:#006064,stroke-width:2px,color:#006064;
    classDef db fill:#fff8e1,stroke:#ff6f00,stroke-width:2px,color:#824a00;
    classDef verify fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#4a148c;
    classDef alert fill:#ffebee,stroke:#c62828,stroke-width:2px,color:#b71c1c;
    classDef success fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px,color:#1b5e20;

    subgraph Phase1["Giai đoạn 1: Trước sự kiện (Có mạng)"]
        A[Mobile App]:::app -->|"GET /checkin/data"| B[API Server]:::api
        B -->|"Trả danh sách vé hợp lệ<br/>(ticket_id, qr_code_hash, status)"| A
        A -->|"Lưu danh sách vé"| SQLite[("SQLite cục bộ")]:::app
    end

    subgraph Phase2["Giai đoạn 2: Tại cổng sự kiện (Mất mạng)"]
        Scan[Quét QR Code]:::app --> Verify{"Xác thực HMAC-SHA256<br/>(dùng SERVER_SECRET)"}:::verify
        Verify -->|"Chữ ký không hợp lệ"| Reject["Từ chối (Vé giả)"]:::alert
        Verify -->|"Chữ ký hợp lệ"| QuerySQL{"Tra cứu SQLite cục bộ"}:::verify
        QuerySQL -->|"Chưa check-in"| MarkChecked["Đánh dấu checked_in<br/>Lưu log vào Offline Queue"]:::app
        MarkChecked --> Approve["VÉ HỢP LỆ"]:::success
        QuerySQL -->|"Đã check-in"| Duplicate["VÉ ĐÃ SỬ DỤNG"]:::alert
    end

    subgraph Phase3["Giai đoạn 3: Khi có mạng trở lại (Background Sync)"]
        App[Mobile App Queue]:::app -->|"POST /checkin/sync"| API[API Server]:::api
        API -->|"Đối soát trạng thái vé"| PG[("PostgreSQL")]:::db
        PG -->|"Chưa check-in trên Server"| SyncSuccess["Cập nhật checked_in - ghi checkin_logs"]:::success
        PG -->|"Đã check-in trên Server từ trước"| SyncAlert["Đánh dấu TRÙNG LẶP - cảnh báo gian lận"]:::alert
    end
```

### QR Code ký số bảo mật (HMAC-SHA256)

#### Các phương án cân nhắc

| #   | Phương án                               | Mô tả                                                                                    |
| --- | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| A   | **Simple Hash (SHA-256 của ticket_id)** | QR chứa ticket_id + SHA-256(ticket_id). App verify bằng cách tính lại hash.              |
| B   | **HMAC-SHA256 với Server Secret**       | QR chứa payload + HMAC-SHA256(payload, SERVER_SECRET). Chỉ ai có secret mới verify được. |
| C   | **RSA Digital Signature (Asymmetric)**  | Server ký bằng private key, app verify bằng public key. Không cần chia sẻ secret.        |

#### Đánh giá

| Tiêu chí                          | Simple Hash               | HMAC-SHA256                   | RSA Signature                   |
| --------------------------------- | ------------------------- | ----------------------------- | ------------------------------- |
| Chống giả mạo                     | ❌ Ai cũng tính được hash | ✅ Cần biết secret            | ✅ Cần private key              |
| Tốc độ verify                     | ✅ Rất nhanh              | ✅ Rất nhanh                  | ⚠️ Chậm hơn (asymmetric crypto) |
| Kích thước signature              | 32 bytes                  | 32 bytes                      | 256+ bytes (RSA-2048)           |
| Cần chia sẻ secret cho mobile app | —                         | ⚠️ Cần embed secret trong app | ✅ Chỉ cần public key           |
| Phức tạp triển khai               | ✅ Đơn giản               | ✅ Đơn giản                   | ⚠️ Cần quản lý key pair         |

#### Chốt giải pháp: HMAC-SHA256 (Phương án B)

**Lý do:** Cân bằng tốt giữa bảo mật và đơn giản. Simple Hash không đủ bảo mật (ai cũng tạo được vé giả). RSA quá nặng cho mobile app quét hàng nghìn vé. HMAC-SHA256 nhanh, gọn (32 bytes), và đủ bảo mật — secret được embed trong mobile app (chấp nhận được vì app chỉ dành cho nhân viên soát vé nội bộ, không phát hành công khai).

**Quy trình sinh QR Code:**

1. Tạo payload: `{ ticket_id, booking_id, ticket_type, issued_at }`
2. Ký: `signature = HMAC-SHA256(JSON.stringify(payload), SERVER_SECRET)`
3. Nội dung QR: `base64url(JSON.stringify({ ...payload, sig: signature }))`
4. Sinh ảnh QR PNG bằng thư viện `qrcode` (npm)
5. Lưu hash vào trường `qr_code_hash` trong bảng `tickets`

---

## Hệ thống Thông báo (Notification Architecture)

### Kiến trúc Message Exchange

#### Các phương án cân nhắc

| #   | Phương án           | Mô tả                                                                                                                                      |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A   | **Direct Exchange** | Publisher gửi message trực tiếp tới queue cụ thể. Cần gửi N message cho N kênh.                                                            |
| B   | **Fanout Exchange** | Publisher gửi 1 message, exchange broadcast tới tất cả queue bind vào nó. Không phân biệt loại event.                                      |
| C   | **Topic Exchange**  | Publisher gửi 1 message với routing key (ví dụ: `notification.booking.confirmed`). Mỗi queue bind theo pattern → chỉ nhận message phù hợp. |

#### Đánh giá

| Tiêu chí                                     | Direct Exchange        | Fanout Exchange     | Topic Exchange                    |
| -------------------------------------------- | ---------------------- | ------------------- | --------------------------------- |
| Publisher biết về receivers                  | ❌ Phải biết mọi queue | ✅ Không cần biết   | ✅ Không cần biết                 |
| Thêm kênh mới mà không sửa publisher         | ❌ Phải sửa publisher  | ✅ Chỉ thêm queue   | ✅ Chỉ thêm queue + bind pattern  |
| Routing theo loại event                      | ❌ Không               | ❌ Broadcast tất cả | ✅ Routing linh hoạt theo pattern |
| Kênh A nhận event X, kênh B chỉ nhận event Y | ❌ Không               | ❌ Không            | ✅ Có (bind pattern khác nhau)    |

#### Chốt giải pháp: Topic Exchange (Phương án C)

**Lý do:** Đáp ứng yêu cầu **"dễ dàng bổ sung kênh mới mà không sửa publisher"**. Topic Exchange cho phép routing linh hoạt — tương lai nếu cần kênh SMS chỉ nhận `notification.booking.*` (không nhận reminder), chỉ cần bind pattern khác. Fanout thì broadcast hết, không linh hoạt bằng.

### Chi tiết triển khai

**Exchange:** `notification.exchange` (type: topic)

**Queues - Bindings:**

| Queue                      | Bind Pattern     | Worker        | Hành động                                   |
| -------------------------- | ---------------- | ------------- | ------------------------------------------- |
| `notification.inapp.queue` | `notification.#` | In-app Worker | INSERT `notification_logs` (channel=in_app) |
| `notification.email.queue` | `notification.#` | Email Worker  | Sinh QR PNG + gửi email qua Resend API      |

**Routing Keys:**

- `notification.booking.confirmed` — khi thanh toán thành công
- `notification.concert.reminder` — khi Cron Job quét concert sắp diễn ra

**Sequence Diagram:**

```mermaid
sequenceDiagram
    autonumber
    participant Webhook as "Payment Webhook Handler"
    participant Cron as "Concert Reminder Cron"
    participant Exchange as "RabbitMQ Topic Exchange"
    participant InApp as "In-app Worker"
    participant Email as "Email Worker"
    participant DB as "PostgreSQL"
    participant Resend as "Resend API"

    Note over Webhook: Booking xác nhận thanh toán thành công
    Webhook->>Exchange: Publish (key: notification.booking.confirmed)

    par In-app Channel
        Exchange->>InApp: Consume
        InApp->>DB: INSERT notification_logs (channel=in_app, status=sent)
    and Email Channel
        Exchange->>Email: Consume
        Email->>Email: Sinh QR Code PNG (HMAC-SHA256)
        Email->>Resend: Gửi email + QR inline (CID)
        Email->>DB: INSERT notification_logs (channel=email, status=sent/failed)
    end

    Note over Cron: Mỗi 5 phút quét concert start_time trong 24h tới
    Cron->>Exchange: Publish (key: notification.concert.reminder)
    Exchange->>InApp: Consume -> lưu DB
    Exchange->>Email: Consume -> gửi email nhắc nhở
```

### Concert Reminder Scheduler

- **Cron:** `@Cron('*/5 * * * *')` — quét mỗi 5 phút.
- **Query:** `SELECT * FROM concerts WHERE start_time BETWEEN NOW() + INTERVAL '23 hours 55 minutes' AND NOW() + INTERVAL '24 hours 5 minutes' AND reminder_sent = false`
- **Hành động:** Lấy danh sách user có vé `paid` → publish message → cập nhật `reminder_sent = true`.
- **Giới hạn:** Chỉ gửi đúng 1 lần. Không gửi lại khi concert đổi giờ (ngoài phạm vi đồ án).

### Email (Resend Service)

- **Thư viện:** SDK `resend` chính thức qua biến môi trường (`RESEND_API_KEY`).
- **Gửi Email:** Thực hiện qua API gửi email của Resend, gửi trực tiếp tới email của khách hàng.
- **E-ticket Email:** Chứa thông tin concert + chi tiết vé + **QR code nhúng inline** dưới dạng ảnh đính kèm (CID attachment).
- **Chuyển production:** Sử dụng domain riêng đã cấu hình DNS trên Resend.

### Bảng `notification_logs` (BIGSERIAL PK)

Dùng **BIGSERIAL** (8 bytes) thay vì UUID v7 (16 bytes) cho bảng log — tiết kiệm 50% dung lượng PK trong bảng có volume ghi cao. Các FK liên kết vẫn dùng UUID v7 để đồng bộ schema chính.

### Đồng bộ WebSockets trong cụm API (WebSocket Cluster Synchronization)

Để hỗ trợ đẩy thông báo in-app thời gian thực khi chạy nhiều API instances phân tán sau Nginx, hệ thống cấu hình `RedisIoAdapter` kế thừa từ `IoAdapter` của NestJS.

- **Thư viện sử dụng**: `@socket.io/redis-adapter` kết hợp driver kết nối Redis client (`ioredis`).
- **Cơ chế Room-based Routing**: Thay vì quản lý kết nối thủ công bằng Map trong bộ nhớ RAM (gây cô lập và bỏ sót kết nối giữa các instance), khi Client kết nối thành công qua WebSocket Gateway, Socket.io sẽ tự động tham gia (join) vào phòng (room) định danh theo User ID: `user:${userId}`.
- **Hỗ trợ Standalone Worker (Redis Emitter)**: Do các tiến trình Worker (Booking Worker, Background Worker) chạy dưới dạng standalone NestJS context và không khởi tạo WebSocket server, hệ thống tích hợp thêm thư viện `@socket.io/redis-emitter`. Thư viện này cho phép Worker xuất bản (publish) sự kiện real-time trực tiếp lên kênh Redis của cụm Socket.io Adapter.
- **Luồng phát sự kiện**:
  - **Tại API Instance**: Gọi `this.server.to("user:" + userId).emit(...)` để đẩy trực tiếp qua adapter.
  - **Tại Worker Instance**: Gọi `this.redisEmitter.to("user:" + userId).emit(...)` để bắn chéo sang cụm API qua Redis.
  - Hệ thống Redis Adapter trên các API instances sẽ tự động nhận diện và chỉ truyền tải xuống client tại máy đang giữ kết nối active của user đó, loại bỏ nguy cơ trùng lặp thông điệp.

---

## Nhập danh sách khách mời VIP từ CSV (VIP Guest List Import)

### Các phương án cân nhắc

| #   | Phương án                                               | Mô tả                                                                                                                                                                               |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **Xử lý đồng bộ (Synchronous)**                         | Đọc file CSV, kiểm tra dữ liệu và lưu vào database trực tiếp trong luồng request của API.                                                                                           |
| B   | **Xử lý bất đồng bộ qua Hàng đợi (Asynchronous Queue)** | API nhận file CSV, lưu tạm và đẩy một job `import_vip_guests` vào RabbitMQ, trả về HTTP 202 Accepted ngay lập tức cho Admin. Một Worker riêng biệt sẽ tiêu thụ và xử lý file ở nền. |

### Đánh giá

| Tiêu chí                  | Xử lý đồng bộ                                                             | Xử lý bất đồng bộ                                                                 |
| ------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Trải nghiệm người dùng    | ❌ Chờ đợi lâu (đặc biệt khi file >1000 dòng), nguy cơ timeout HTTP.      | ✅ Nhận phản hồi "Đã tiếp nhận" tức thì, có thể theo dõi tiến trình ở nền.        |
| Độ ổn định của API thread | ❌ Blocking API thread. Nếu nhiều Admin import cùng lúc có thể gây nghẽn. | ✅ Non-blocking, giải phóng tài nguyên API nhanh chóng.                           |
| Khả năng chịu lỗi         | ❌ Lỗi giữa chừng khó phục hồi, dễ gây trùng lặp nếu import lại.          | ✅ Dễ dàng quản lý transaction và retry từng phần thông qua hàng đợi.             |
| Độ phức tạp triển khai    | ✅ Thấp (chỉ cần viết controller + service thông thường).                 | ⚠️ Trung bình (yêu cầu cấu hình queue, worker và cơ chế theo dõi trạng thái job). |

### Chốt giải pháp: Phương án B — Xử lý bất đồng bộ qua RabbitMQ

**Lý do:**

- Tệp CSV danh sách VIP có thể chứa hàng nghìn dòng. Xử lý đồng bộ sẽ block request thread và dễ bị timeout.
- Tận dụng hạ tầng RabbitMQ sẵn có để xử lý bất đồng bộ mà không cần cài đặt thêm công cụ mới.
- Cách ly tải trọng: Xử lý file nặng không làm ảnh hưởng đến hiệu năng các API đặt vé của khán giả.

### Quy trình xử lý chi tiết

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant API as NestJS API
    participant Supabase as Supabase Storage
    participant DB as Database (PostgreSQL)
    participant RMQ as RabbitMQ
    participant Worker as Background Worker
    participant WS as WebSocket Gateway

    Admin->>API: POST /concerts/:id/guests/import (file .csv)
    API->>Supabase: Upload file CSV
    Supabase-->>API: Trả về file_url
    API->>DB: Tạo Job tracking vip_guest_imports (status="pending")
    API->>RMQ: Publish job "vip_guest.import" (job_id, file_url, concert_id, user_id)
    API-->>Admin: HTTP 202 Accepted (kèm job_id)

    Note over RMQ, Worker: Tiến trình xử lý ngầm (Background Job)
    RMQ->>Worker: Consume job "vip_guest.import"
    Worker->>DB: Cập nhật trạng thái Job (status="processing")

    rect rgba(30, 144, 255, 0.15)
        Note over Worker: Tải và Phân tích tệp CSV
        Worker->>Supabase: Tải nội dung CSV từ file_url
        Supabase-->>Worker: Trả về nội dung CSV text
        Worker->>Worker: Đọc dạng stream & ánh xạ tiêu đề sang DTO
        Worker->>DB: Lấy danh sách email khách VIP hiện có của concert
        DB-->>Worker: Trả về danh sách existingEmails
    end

    rect rgba(218, 165, 32, 0.15)
        Note over Worker: Vòng lặp duyệt và Validate từng dòng dữ liệu (Row Index)
        loop Cho mỗi dòng trong CSV
            alt Thiếu fullName/email hoặc lỗi DTO validation
                Worker->>Worker: Ghi nhận lỗi vào errorLogs (số dòng, email, chi tiết lỗi)
            else Trùng lặp email với dòng trước đó trong chính file CSV
                Worker->>Worker: Ghi nhận lỗi "Duplicate guest email in CSV file" vào errorLogs
            else Trùng lặp email với khách mời đã có trong DB
                Worker->>Worker: Bỏ qua im lặng (Silently Skip) - Không tạo lỗi để dễ phục hồi
            else Dữ liệu hợp lệ & Không trùng
                Worker->>Worker: Sinh chữ ký số HMAC-SHA256 (qrCodeHash) và lưu vào validGuestsToInsert
            end
        end
    end

    rect rgba(50, 205, 50, 0.15)
        Note over Worker: Lưu database & Gửi email
        alt Có khách mời hợp lệ (validGuestsToInsert > 0)
            loop Chèn theo lô (mỗi lô 500 dòng) bọc trong Transaction
                Worker->>DB: INSERT INTO vip_guests ON CONFLICT DO NOTHING
            end
            loop Gửi email thư mời
                Worker->>RMQ: Publish "notification.email.vip" (có cấu hình DLX/DLQ)
            end
        end
    end

    rect rgba(220, 20, 60, 0.15)
        Note over Worker: Hoàn tất / Lỗi hệ thống & Dọn dẹp
        alt Xử lý hoàn thành (hoặc hoàn thành một phần)
            Worker->>DB: Cập nhật Job (status="completed", imported_rows, error_logs)
        else Gặp lỗi hệ thống (DB error, Supabase down, Malformed CSV...)
            Worker->>DB: Cập nhật Job (status="failed", error_logs với row=0)
        end
        Worker->>WS: Gửi sự kiện "vip_import_status" qua WebSockets
        WS-->>Admin: Nhận thông báo real-time tiến trình Import hoàn tất/thất bại
        Worker->>Supabase: Xóa file CSV tạm
        Worker->>RMQ: Acknowledge (Ack) tin nhắn
    end
```

- **Cloud File Sharing (Supabase Storage):** Nhằm tránh lỗi `File not found` trong môi trường đa thực thể (multi-instance) khi container API nhận file khác container Worker xử lý. Tệp CSV được tải lên Supabase Storage và truyền link tải qua RabbitMQ. Worker sẽ dọn dẹp (xóa file trên Supabase Storage) sau khi hoàn tất hoặc lỗi.
- **Row-by-row Validation (Validate từng dòng):** Sử dụng thư viện `csv-parser` để đọc dạng stream từ file tải về. Mỗi dòng được validate qua `class-validator` bằng DTO chuyên dụng. Dòng bị lỗi định dạng sẽ bị bỏ qua và ghi nhận lỗi (chỉ lưu số dòng, email, lý do) vào log của Job, tránh dừng cả tiến trình.
- **Chunked Bulk Insert (Chèn theo lô trong Transaction & ON CONFLICT DO NOTHING):** Thay vì thực hiện hàng nghìn câu lệnh INSERT riêng lẻ gây nghẽn kết nối cơ sở dữ liệu và mạng nội bộ, worker thu thập các bản ghi hợp lệ, chia nhỏ thành các lô (ví dụ 500 bản ghi/lô) và thực thi chèn số lượng lớn (Bulk Insert) bằng TypeORM QueryBuilder trong một Database Transaction duy nhất kết hợp với mệnh đề `.orIgnore()` (`ON CONFLICT (concert_id, email) DO NOTHING`). Các dòng chứa email đã tồn tại sẵn trong cơ sở dữ liệu của concert sẽ được bỏ qua một cách im lặng (silently skipped) và KHÔNG được ghi nhận là lỗi trong `errorLogs` để giúp Admin dễ dàng tải lại toàn bộ tệp gốc sau khi đã sửa các dòng lỗi khác (Simplified Error Recovery).
- **Tạo mã QR VIP:** Mỗi khách mời VIP hợp lệ được sinh một mã QR chứa chữ ký số HMAC-SHA256 sử dụng `SERVER_SECRET` cho việc kiểm tra soát vé offline an toàn. Bố cục email gửi đi được tinh giản, loại bỏ việc hiển thị chuỗi ký tự mã hóa signature hash 64 ký tự thô để tăng tính thẩm mỹ cho thư mời.
- **Rate-limited & Resilient Email Queueing (Gửi email điều tiết tốc độ, hỗ trợ Retry & DLQ):** Tác vụ gửi email thư mời đính kèm QR code được đẩy vào hàng đợi thông báo. Email worker tiêu thụ hàng đợi này được thiết lập `prefetch = 1` kết hợp bộ điều tiết tốc độ (delay 150ms trước mỗi lần gửi) để khống chế tốc độ gửi tối đa 5-10 email/giây, ngăn việc bị khóa tài khoản bởi các SMTP gateway do nghi ngờ spam. Đồng thời, hàng đợi hỗ trợ cơ chế tự động gửi lại (Retry) tối đa 3 lần với exponential backoff khi gặp lỗi tạm thời và chuyển tiếp tin nhắn lỗi hoàn toàn vào Dead Letter Queue (DLQ) để phục vụ đối soát.

---

## Tích hợp AI Artist Bio (AI Artist Bio Integration)

### Các phương án cân nhắc

| #   | Phương án                                         | Mô tả                                                                                                                                                                       |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **Gọi API Google Gemini trực tiếp (Synchronous)** | API nhận file PDF, parse text, gửi thẳng sang Gemini API và chờ nhận kết quả để trả về cho Client.                                                                          |
| B   | **Xử lý bất đồng bộ (Asynchronous Worker)**       | Upload PDF -> Parse text -> Lưu DB -> Đẩy task `generate_bio` vào RabbitMQ. Worker gọi Gemini API và cập nhật kết quả vào DB. Admin nhận thông báo hoặc polling trạng thái. |

### Đánh giá

| Tiêu chí                       | Gọi API trực tiếp                                                                  | Xử lý bất đồng bộ                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Độ trễ phản hồi (Latency)      | ❌ Rất cao (Google Gemini API có thể mất 5 - 15 giây để sinh văn bản).             | ✅ Rất thấp (trả về trạng thái "đang xử lý" ngay lập tức).                            |
| Khả năng chịu lỗi (Resilience) | ❌ Lỗi kết nối hoặc API rate limit từ Gemini sẽ làm hỏng toàn bộ request của user. | ✅ Tự động retry thông qua hàng đợi nếu API ngoài bị lỗi tạm thời hoặc rate limit.    |
| Độ phức tạp triển khai         | ✅ Thấp (chỉ cần gọi API trong controller).                                        | ⚠️ Trung bình (cần quản lý trạng thái xử lý trong DB và cơ chế thông báo cho client). |

### Chốt giải pháp: Phương án B — Xử lý bất đồng bộ qua RabbitMQ

**Lý do:** Google Gemini API là một dịch vụ bên thứ ba có độ trễ lớn và không đảm bảo SLA 100%. Gọi trực tiếp từ API Gateway sẽ chiếm dụng connection và thread của NestJS quá lâu. Xử lý qua hàng đợi RabbitMQ giúp cô lập lỗi mạng, tự động retry khi gặp lỗi rate limit và mang lại trải nghiệm mượt mà cho Admin.

### Quy trình xử lý chi tiết

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin
    participant API as API
    participant DB as DB
    participant MQ as RabbitMQ
    participant W as Worker
    participant Gemini as Gemini API

    Admin->>API: POST /concerts/:id/artist-bio (file .pdf)
    API->>API: Trích xuất text từ PDF (pdf-parse) và làm sạch text
    API->>DB: Khởi tạo dữ liệu concert_ai_bios (status="processing", raw_text)
    API->>MQ: Publish task "ai.generate_bio" (concert_id, userId, raw_text)
    API-->>Admin: HTTP 202 Accepted (Trạng thái: Đang xử lý)

    Note over MQ, W: Worker xử lý ngầm gọi AI
    MQ->>W: Consume task "ai.generate_bio"
    W->>Gemini: Gọi API sinh tóm tắt tiểu sử nghệ sĩ (dưới 300 từ)
    alt API phản hồi thành công
        W->>DB: Cập nhật draft_bio=result, status="completed" ở concert_ai_bios
        W->>DB: Tạo bản ghi thành công trong notification_logs (type="ai_bio_completed")
    else API lỗi (Rate limit, Timeout)
        W->>W: Retry (tối đa 3 lần)
        Note over W: Nếu vẫn lỗi sau 3 lần retry
        W->>DB: Cập nhật status="failed", error="Lỗi..." ở concert_ai_bios
        W->>DB: Tạo bản ghi thất bại trong notification_logs (type="ai_bio_failed")
    end

    Note over Admin, API: Quy trình duyệt của Admin (Draft - Approve)
    Admin->>API: GET /concerts/:id/artist-bio
    API-->>Admin: Trả về trạng thái - draft_bio

    Admin->>API: PUT /concerts/:id/artist-bio/confirm (payload: { biography })
    API->>DB: Cập nhật biography chính thức vào bảng concerts
    API->>API: Xóa cache Redis của concert (cache:concerts:{id})
    API-->>Admin: HTTP 200 OK (Cập nhật thành công)
```

- **Trích xuất văn bản (Text Extraction):** Sử dụng thư viện `pdf-parse` để đọc file PDF buffer và lấy ra phần text thô (raw text). Thực hiện chuẩn hóa text (loại bỏ ký tự đặc biệt thừa, khoảng trắng thừa) trước khi gửi đi để tối ưu token.
- **Tích hợp Google Gemini AI:** Dùng thư viện `@google/generative-ai`. Sử dụng model `gemini-3.5-flash` với system prompt được định nghĩa sẵn để định hình phong cách tóm tắt tiểu sử nghệ sĩ (ngắn gọn, chuyên nghiệp, hấp dẫn cho sự kiện âm nhạc, độ dài dưới 300 từ).
- **Cơ chế Duyệt (Draft & Approve):** Phân tách dữ liệu thô và bản nháp AI sinh ra ở bảng phụ `concert_ai_bios`. Cung cấp endpoint phê duyệt `PUT /concerts/:id/artist-bio/confirm` để người dùng kiểm duyệt, chỉnh sửa hoặc xuất bản chính thức bản nháp vào trường `biography` của concert trong bảng `concerts`.
- **Cơ chế tạo lại (Regenerate):** Cung cấp endpoint `POST /concerts/:id/artist-bio/regenerate` sử dụng trực tiếp `raw_text` đã lưu trong `concert_ai_bios` để sinh lại bio, giúp tiết kiệm thời gian upload file PDF.
- **Cơ chế thông báo (Notification):** Khi worker hoàn thành (thành công hoặc thất bại), worker sẽ tự động tạo một thông báo in-app (chèn vào bảng `notification_logs`) để gửi thông tin cho Admin thực hiện yêu cầu.
- **Cơ chế Retry - Fallback:** Cấu hình RabbitMQ retry logic với exponential backoff để đối phó với lỗi Rate Limit (`429 Too Many Requests`) của Gemini API.

---

## Các quyết định kỹ thuật quan trọng (ADR)

### ADR-01: Chọn Message Broker — RabbitMQ vs Kafka vs BullMQ

| Tiêu chí                                | RabbitMQ                             | Apache Kafka                        | BullMQ (Redis)                    |
| --------------------------------------- | ------------------------------------ | ----------------------------------- | --------------------------------- |
| Mô hình                                 | Message Queue (push-based)           | Event Log (pull-based, append-only) | Job Queue (Redis-based)           |
| Đảm bảo thứ tự                          | ✅ Trong 1 queue                     | ✅ Trong 1 partition                | ✅ Trong 1 queue                  |
| Acknowledgement                         | ✅ Per-message ack                   | ⚠️ Offset-based commit              | ✅ Per-job ack                    |
| Dead Letter Queue                       | ✅ Native support                    | ❌ Phải tự build                    | ✅ Có (failed jobs)               |
| Độ phức tạp hạ tầng                     | ⚠️ Cần RabbitMQ server               | ❌ Cần Kafka + ZooKeeper/KRaft      | ✅ Dùng chung Redis đã có         |
| Routing linh hoạt (Topic/Direct/Fanout) | ✅ Rất mạnh                          | ❌ Chỉ có topic-based               | ❌ Không có exchange concept      |
| Phù hợp bài toán                        | ✅ Task queue + notification routing | ⚠️ Quá nặng cho đồ án               | ⚠️ Thiếu routing cho notification |

**Chốt:** **RabbitMQ**. Cung cấp routing linh hoạt nhất (Topic Exchange cho notification, Direct Queue cho booking). Kafka quá nặng về hạ tầng cho đồ án. BullMQ thiếu exchange/routing concept cần thiết cho notification architecture mở rộng.

---

### ADR-02: Chọn Rate Limiter Storage — Redis vs In-Memory

| Tiêu chí                    | Redis                   | In-Memory (Node.js Map) |
| --------------------------- | ----------------------- | ----------------------- |
| Chia sẻ giữa nhiều instance | ✅ Centralized          | ❌ Per-instance counter |
| Persist qua restart         | ✅ Có (AOF)             | ❌ Mất khi restart      |
| Latency                     | ⚠️ ~0.5ms (network hop) | ✅ ~0.01ms              |
| Phù hợp scale-out           | ✅                      | ❌                      |

**Chốt:** **Redis**. Dù hiện tại chỉ có 1 NestJS instance, Redis đảm bảo tính đúng đắn khi scale-out sau này và đã có sẵn trong stack (dùng chung cho cache + inventory).

---

### ADR-03: Chọn ORM — TypeORM vs Prisma vs Knex

| Tiêu chí                 | TypeORM                     | Prisma                           | Knex                |
| ------------------------ | --------------------------- | -------------------------------- | ------------------- |
| Tích hợp NestJS          | ✅ `@nestjs/typeorm` native | ⚠️ Cần wrapper                   | ❌ Cần tự integrate |
| Migration tool           | ✅ Có                       | ✅ Có (tốt hơn)                  | ✅ Có               |
| Type safety              | ⚠️ Decorator-based, runtime | ✅ Generated types, compile-time | ❌ Yếu              |
| Decorator/Entity pattern | ✅ Class-based Entity       | ❌ Schema file riêng             | ❌ Không có         |
| Raw query khi cần        | ✅ QueryBuilder + raw       | ✅ $queryRaw                     | ✅ Native           |
| Community + Tài liệu     | ✅ Lớn                      | ✅ Lớn, tài liệu tốt             | ⚠️ Trung bình       |

**Chốt:** **TypeORM**. TypeORM có ưu thế tích hợp native với NestJS qua decorator.

---

### ADR-04: Notification — In-app (DB) + Email (Resend Service) vs Push Notification (FCM)

| Tiêu chí             | In-app + Email                  | Push Notification (FCM)               |
| -------------------- | ------------------------------- | ------------------------------------- |
| Cần cấu hình hạ tầng | ✅ Chỉ Resend API (free tier)   | ❌ Firebase project + service account |
| Hoạt động trên Web   | ✅ In-app hiển thị trên web     | ⚠️ Cần Service Worker                 |
| Yêu cầu user consent | ❌ Không                        | ✅ Cần permission popup               |
| Dễ demo/kiểm thử     | ✅ Resend dashboard logs        | ❌ Cần thiết bị thật/emulator         |
| Mở rộng sau          | ✅ Thêm FCM worker vào exchange | —                                     |

**Chốt:** **In-app (DB) + Email (Resend API)**. Bỏ qua FCM để giảm tải cấu hình hạ tầng. Kiến trúc Topic Exchange cho phép thêm FCM worker sau mà không sửa code hiện tại.

---

## Risks / Trade-offs

| #   | Rủi ro                                                                 | Mô tả chi tiết                                                                                                                                                                           | Phương án giảm thiểu                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Mất đồng bộ Redis ↔ PostgreSQL**                                     | Redis restart hoặc lỗi mạng sau Lua Script thành công nhưng trước khi message vào RabbitMQ → tồn kho bị lệch.                                                                            | Reconciliation Job chạy mỗi 15 phút, đối soát bookings (pending/paid) trong PostgreSQL với inventory trên Redis. Redis bật AOF persistence.                                                                                                                                                                                                                                                                                                                            |
| R2  | **RabbitMQ sập → đơn hàng chậm**                                       | Message bị mất hoặc tắc nghẽn trong hàng đợi.                                                                                                                                            | Durable queues + persistent messages. Sử dụng Dead Letter Queue (DLQ) hứng message lỗi.                                                                                                                                                                                                                                                                                                                                                                                |
| R3  | **Đơn hàng "ma" chiếm tồn kho**                                        | Khách giữ chỗ (Redis trừ tồn kho) nhưng không thực hiện thanh toán.                                                                                                                      | Đơn pending tự động hết hạn sau 10 phút. Scheduler quét mỗi phút → hủy đơn + chạy Lua Script hồi kho trên Redis.                                                                                                                                                                                                                                                                                                                                                       |
| R4  | **Email gửi thất bại**                                                 | Resend API timeout hoặc lỗi xác thực API Key.                                                                                                                                            | Email gửi async qua RabbitMQ worker. Failure → `notification_logs.status = failed` để retry sau. Không ảnh hưởng luồng booking/payment.                                                                                                                                                                                                                                                                                                                                |
| R5  | **Cổng thanh toán không ổn định**                                      | VNPAY/MoMo timeout, trả lỗi 5xx, hoặc webhook gọi lặp nhiều lần.                                                                                                                         | Circuit Breaker (opossum) tự động cắt mạch khi lỗi >50%. Idempotency Key trên Redis (TTL 24h) chống xử lý trùng.                                                                                                                                                                                                                                                                                                                                                       |
| R6  | **Soát vé thất bại khi mất kết nối mạng**                              | Nhân viên soát vé không thể kiểm tra vé real-time tại SVĐ do nghẽn sóng.                                                                                                                 | Dữ liệu soát vé được tải sẵn xuống SQLite nội bộ trên Mobile App. Nhân viên soát vé quét và kiểm tra chữ ký HMAC-SHA256 ngoại tuyến. Khi có mạng trở lại, Mobile App sẽ gửi log check-in ngoại tuyến thông qua API `/checkin/sync` để ghi nhận và đối soát trùng lặp ở database chính.                                                                                                                                                                                 |
| R7  | **Tệp CSV VIP bị lỗi hoặc chứa dữ liệu bẩn**                           | File CSV lớn của đối tác có thể chứa dữ liệu sai định dạng hoặc trùng lặp, gây crash luồng import.                                                                                       | Sử dụng Background Job để xử lý bất đồng bộ từng dòng (row-by-row validation). Ghi nhận log dòng lỗi riêng biệt để admin sửa đổi thủ công sau, đảm bảo các dòng hợp lệ vẫn được nhập thành công.                                                                                                                                                                                                                                                                       |
| R8  | **Gemini AI API bị timeout hoặc rate limit**                           | Khi admin tạo bio nghệ sĩ, dịch vụ bên thứ ba bị gián đoạn làm treo hoặc lỗi trang admin.                                                                                                | Đẩy tác vụ gọi AI vào RabbitMQ xử lý bất đồng bộ. Áp dụng cơ chế Circuit Breaker và retry với exponential backoff. Cập nhật trạng thái bio vào DB để admin theo dõi quá trình sinh bio ở giao diện.                                                                                                                                                                                                                                                                    |
| R9  | **Trùng lặp chạy Cronjob khi chạy đa instances (Cronjob Concurrency)** | Nhiều container worker chạy song song cùng kích hoạt các tác vụ định kỳ quét đơn hàng hay dọn dẹp, gây race condition và trùng lặp bản ghi.                                              | Áp dụng khóa phân tán **Redis Distributed Lock** trước khi chạy. Chỉ thực thể giành được khóa mới thực thi xử lý thực tế, các thực thể khác tự động bỏ qua.                                                                                                                                                                                                                                                                                                            |
| R10 | **Thất lạc thông báo WebSocket khi Client kết nối phân tán**           | Client kết nối đến các instance API khác nhau. Khi Worker hoặc một instance khác tạo và gửi thông báo, tin nhắn không truyền được chéo máy cục bộ do lệch bộ nhớ RAM giữa các container. | Tích hợp **Socket.io Redis Adapter** kết hợp **Socket.io Redis Emitter** cho các standalone background workers. Sử dụng cơ chế Room-based routing (mỗi client join room `user:${userId}`) thay vì kiểm tra Map in-memory cục bộ. Khi Worker phát thông báo qua Emitter hoặc API phát thông báo qua Server, sự kiện sẽ được đẩy vào Redis channel chung. Cụm API instances sẽ tự động điều phối để chỉ instance đang kết nối trực tiếp với client đó thực hiện gửi tin. |
