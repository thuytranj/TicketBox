# 🎫 Hệ Thống Bán Vé & Soát Vé Sự Kiện TicketBox

Hệ thống số hóa quy trình bán vé concert quy mô lớn (Ticket Sales) và soát vé tại hiện trường sự kiện (Gate Check-in). Dự án được thiết kế với kiến trúc chịu tải tốt, hỗ trợ phương thức thanh toán ví điện tử và cơ chế soát vé **Offline-First** đột phá giúp cổng soát vé vận hành liên tục ngay cả khi mất kết nối mạng.

---

## 🏗 Kiến Trúc Tổng Quan (Project Architecture)

Repository này chứa toàn bộ mã nguồn của hệ thống bao gồm:

*   **`src/backend`**: Dịch vụ API Server được xây dựng bằng **NestJS** (TypeScript) theo kiến trúc **Modular Monolith**. Sử dụng PostgreSQL làm cơ sở dữ liệu chính, Redis để cache/quản lý inventory thời gian thực, và RabbitMQ để xử lý hàng đợi đặt vé/thông báo bất đồng bộ.
*   **`src/frontend`**: Ứng dụng Web dành cho Khán giả (mua vé) và Ban tổ chức (quản trị, quản lý sự kiện), phát triển bằng **React.js + Vite + TypeScript**.
*   **`src/mobile`**: Ứng dụng di động dành riêng cho Nhân sự soát vé (Gate Staff) tại hiện trường sự kiện, phát triển bằng **Flutter**. Hỗ trợ chế độ offline-first lưu trữ vé cục bộ trên SQLite, đồng bộ ngầm thời gian thực qua Web Sockets & Connectivity Stream.

---

## 🛠 Yêu Cầu Tiên Quyết (Prerequisites)

Trước khi bắt đầu cài đặt, hãy chắc chắn máy tính của bạn đã cài đặt sẵn các công cụ sau với phiên bản tương ứng:

*   **Docker & Docker Compose**: Để chạy nhanh PostgreSQL, Redis, RabbitMQ mà không cần cài đặt trực tiếp lên hệ điều hành.
*   **Node.js**: Phiên bản `>= 18.x` (Khuyên dùng bản LTS `v20.x`).
*   **NPM**: Phiên bản `>= 9.x`.
*   **Flutter SDK**: Phiên bản `>= 3.x` và **Dart SDK** đi kèm.
*   **Android Studio** / **Xcode**: Thiết lập Emulator/Simulator hoặc cấu hình chạy trên thiết bị di động thật để debug ứng dụng Mobile.

---

## ⚙️ Cấu Hình Môi Trường (Environment Variables)

### 1. Cấu hình Docker Infrastructure (File `.env` ở thư mục gốc)
Tạo file `.env` tại thư mục gốc của dự án để Docker Compose cấu hình các cổng kết nối:

```env
# Database Configuration (PostgreSQL)
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=ticketboxsecurepwd
DB_DATABASE=ticketbox

# Cache Configuration (Redis)
REDIS_PORT=6379

# Message Broker Configuration (RabbitMQ)
RABBITMQ_PORT=5672
RABBITMQ_MANAGEMENT_PORT=15672
```

### 2. Cấu hình NestJS Backend (File `.env` trong `src/backend/.env`)
Sao chép `.env.example` trong thư mục `src/backend` thành `.env` và điền cấu hình kết nối cục bộ:

```env
# Server
PORT=3000
NODE_ENV=development

# Database (Kết nối tới Container Postgres)
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=ticketboxsecurepwd
DB_DATABASE=ticketbox

# Redis (Kết nối tới Container Redis)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# RabbitMQ (Kết nối tới Container RabbitMQ)
RABBITMQ_URL=amqp://guest:guest@127.0.0.1:5672

# Security
JWT_SECRET=super_secret_jwt_key_for_ticketbox_api_validation
JWT_EXPIRES_IN=7d

# Payment Gateways (MoMo Sandbox)
MOMO_PARTNER_CODE=MOMO
MOMO_ACCESS_KEY=F8BBA842ECF85
MOMO_SECRET_KEY=K951B6PE1waDMi640xX08PD3vg6EkVlz
MOMO_REDIRECT_URL=http://localhost:5173/payment/callback/momo
MOMO_IPN_URL=http://localhost:3000/api/v1/payments/momo/webhook

# Payment Gateways (VNPAY Sandbox)
VNPAY_TMN_CODE=VNPAY_SANDBOX_CODE
VNPAY_HASH_SECRET=VNPAY_SANDBOX_SECRET
VNPAY_RETURN_URL=http://localhost:5173/payment/callback/vnpay
VNPAY_IPN_URL=http://localhost:3000/api/v1/payments/vnpay/webhook
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy (Step-by-Step)

### Bước 1: Clone dự án và khởi chạy Cơ sở hạ tầng
1. Mở Terminal và di chuyển vào dự án:
   ```bash
   git clone <URL_REPOS_CỦA_BẠN> ticketbox
   cd ticketbox
   ```
2. Khởi tạo file `.env` gốc và chạy hạ tầng bằng Docker Compose:
   ```bash
   cp .env.example .env
   docker compose up -d postgres redis rabbitmq
   ```
   *Kiểm tra trạng thái các container bằng lệnh `docker compose ps` để đảm bảo cả 3 dịch vụ đều ở trạng thái `running`.*

### Bước 2: Thiết lập và chạy Backend NestJS
1. Mở một tab Terminal mới, di chuyển vào thư mục backend và cài đặt thư viện:
   ```bash
   cd src/backend
   npm install
   ```
2. Cấu hình biến môi trường cục bộ cho Backend:
   ```bash
   cp .env.example .env
   ```
3. Tạo cấu trúc bảng cơ sở dữ liệu (Database Migrations):
   ```bash
   npm run migration:run
   ```
4. Nạp dữ liệu mẫu (Seed Data) chứa thông tin các buổi diễn hòa nhạc, hạng vé và tài khoản thử nghiệm:
   ```bash
   npm run db:seed:direct
   ```
5. Khởi chạy Backend ở chế độ phát triển (All-in-one):
   ```bash
   npm run start:dev
   ```
   *Lúc này REST API sẽ chạy cục bộ tại địa chỉ: `http://localhost:3000/api/v1`*

### Bước 3: Thiết lập và chạy Frontend React
1. Mở một tab Terminal mới, di chuyển vào thư mục frontend và cài đặt thư viện:
   ```bash
   cd src/frontend
   npm install
   ```
2. Khởi chạy frontend Client:
   ```bash
   npm run dev
   ```
   *Ứng dụng Web sẽ khởi chạy tại cổng mặc định: `http://localhost:5173`*

### Bước 4: Khởi chạy Ứng dụng Di động Flutter
1. Mở một tab Terminal mới, di chuyển vào thư mục mobile:
   ```bash
   cd src/mobile
   ```
2. Tải các package Flutter phụ thuộc:
   ```bash
   flutter pub get
   ```
3. Khởi chạy ứng dụng trên thiết bị di động (Emulator hoặc thiết bị thật) kèm biến cấu hình Endpoint Backend:
   *   **Chạy trên iOS Simulator hoặc Android Emulator thông dụng:**
       ```bash
       flutter run --dart-define=API_BASE_URL=http://localhost:3000/api/v1
       ```
   *   **Chạy trên thiết bị Android thật (kết nối dây cáp usb):**
       Để thiết bị thật gọi được API chạy local trên máy tính, bạn cần thực hiện chuyển tiếp cổng (port forwarding):
       ```bash
       adb reverse tcp:3000 tcp:3000
       flutter run --dart-define=API_BASE_URL=http://localhost:3000/api/v1
       ```

---

## 🔌 Danh Sách Cổng Kết Nối (Ports Mapping)

| Dịch vụ / Ứng dụng | Cổng mặc định (Port) | Địa chỉ truy cập cục bộ | Mô tả |
| :--- | :--- | :--- | :--- |
| **Backend API** | `3000` | `http://localhost:3000/api/v1` | Điểm tiếp nhận request REST API từ Frontend & Mobile. |
| **Frontend Web App** | `5173` | `http://localhost:5173` | Giao diện mua vé của khách hàng và bảng điều khiển quản trị. |
| **PostgreSQL Database** | `5432` | `localhost:5432` | Lưu trữ dữ liệu quan hệ chính của toàn bộ hệ thống. |
| **Redis Cache** | `6379` | `localhost:6379` | Cache dữ liệu hòa nhạc, đếm vé thời gian thực. |
| **RabbitMQ Server** | `5672` | `localhost:5672` | Broker truyền nhận thông báo đặt vé và email bất đồng bộ. |
| **RabbitMQ Admin UI** | `15672` | `http://localhost:15672` | Trang quản trị RabbitMQ (Đăng nhập: `guest` / `guest`). |

---

## 🔑 Tài Khoản Khảo Sát Mẫu (Seed Accounts)

Sau khi chạy lệnh `npm run db:seed:direct` ở phần cấu hình Backend, các tài khoản mặc định dưới đây sẽ tự động được tạo sẵn trong cơ sở dữ liệu để phục vụ kiểm thử tính năng (Tất cả tài khoản đều dùng chung một mật khẩu là: **`123123`**):

| Vai trò (Role) | Email đăng nhập | Mật khẩu | Phạm vi sử dụng |
| :--- | :--- | :--- | :--- |
| **Ban tổ chức (Organizer)** | `organizer@ticketbox.vn` | `123123` | Dùng trên Web: Quản lý sự kiện, xem biểu đồ doanh thu và thống kê soát vé trực quan. |
| **Nhân viên soát vé (Gate Staff)** | `staff@ticketbox.vn` <br> `staff2@ticketbox.vn` | `123123` | **Dành riêng cho ứng dụng di động (Flutter)**: Đăng nhập để đồng bộ vé offline và mở camera quét mã QR. |
| **Khán giả (Audience)** | `audience@ticketbox.vn` <br> `audience1@ticketbox.vn` | `123123` | Dùng trên Web: Thực hiện đặt chỗ, mua vé GA/VIP và tiến hành thanh toán qua cổng demo. |

---

## 🚨 Xử Lý Sự Cố Thường Gặp (Troubleshooting)

### 1. Lỗi Mobile App không gọi được API của Backend
*   **Triệu chứng**: Ứng dụng di động hiển thị lỗi đỏ, hoặc đứng mãi ở màn hình Đang chuẩn bị dữ liệu check-in mà không tải được danh sách vé.
*   **Nguyên nhân**: Trên hệ điều hành Android, địa chỉ `localhost` hay `127.0.0.1` được hiểu là chính bản thân thiết bị Android đó chứ không phải máy tính chạy backend của bạn.
*   **Cách khắc phục**:
    *   **Với Android Emulator/Device**: Đảm bảo thiết bị đã được cắm cáp usb và chạy lệnh chuyển tiếp cổng:
        ```bash
        adb reverse tcp:3000 tcp:3000
        ```
    *   **Giải pháp thay thế**: Thay thế `localhost` bằng địa chỉ IP mạng nội bộ của máy tính của bạn (Ví dụ: `192.168.1.15`):
        ```bash
        flutter run --dart-define=API_BASE_URL=http://192.168.1.15:3000/api/v1
        ```

### 2. Lỗi không kết nối được Redis hoặc RabbitMQ
*   **Triệu chứng**: Khi khởi động backend với `npm run start:dev`, console báo lỗi kết nối liên tục hoặc ứng dụng bị tắt ngay sau khi chạy.
*   **Cách khắc phục**: Đảm bảo các Docker container đang chạy ổn định. Hãy restart lại hạ tầng:
    ```bash
    docker compose down
    docker compose up -d postgres redis rabbitmq
    ```

### 3. Lỗi đồng bộ offline trên Mobile
*   **Triệu chứng**: Khi mất kết nối mạng và soát vé offline, camera quét thành công nhưng dữ liệu chưa được cập nhật lên server ngay khi mạng có trở lại.
*   **Nguyên nhân & Cách kiểm tra**: Cơ chế hoạt động dựa trên Stream lắng nghe kết nối của thư viện `connectivity_plus`. Bạn có thể kiểm tra trực tiếp trạng thái kết nối thông qua dòng trạng thái realtime ở màn hình Check-in Dashboard của điện thoại (hiển thị `Đã đồng bộ` hoặc `Đang chạy chế độ offline`). Trên thanh công cụ AppBar màn hình quét sẽ hiển thị số vé chờ đồng bộ (ví dụ: `⚡ 3 pending`). Bấm trực tiếp vào icon sấm sét để trigger đồng bộ thủ công ngay lập tức.
