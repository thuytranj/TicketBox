## Context

Hệ thống TicketBox hiện tại đang chạy dưới dạng một Modular Monolith viết bằng NestJS, kết nối tới cơ sở dữ liệu PostgreSQL, cache Redis và message broker RabbitMQ. Hệ thống chưa có cơ chế xác thực người dùng và phân quyền (RBAC). Để chuẩn bị cho các module nghiệp vụ tiếp theo như Booking, Check-in, Stats, cần xây dựng một hệ thống xác thực tập trung sử dụng JSON Web Token (JWT) và bảo vệ API theo từng vai trò (Audience, Organizer, Gate Staff). Đồng thời, bổ sung cơ chế xác thực email bằng mã OTP được gửi bất đồng bộ qua RabbitMQ trước khi kích hoạt tài khoản, hỗ trợ gửi lại mã OTP, quên và đặt lại mật khẩu an toàn.

## Goals / Non-Goals

**Goals:**
- Triển khai thành công các API:
  - Đăng ký tài khoản nháp (`POST /auth/register`)
  - Xác thực OTP kích hoạt tài khoản (`POST /auth/verify-otp`)
  - Gửi lại OTP kích hoạt (`POST /auth/resend-otp`)
  - Yêu cầu khôi phục mật khẩu (`POST /auth/forgot-password`)
  - Cài đặt lại mật khẩu bằng OTP (`POST /auth/reset-password`)
  - Đăng nhập hệ thống (`POST /auth/login`)
  - Làm mới token (`POST /auth/refresh`)
  - Đăng xuất (`POST /auth/logout`)
  - Xem thông tin cá nhân (`GET /auth/me`)
- Thiết lập bảng cơ sở dữ liệu `users` lưu trữ thông tin tài khoản người dùng, sử dụng UUID v7 làm khóa chính và thêm cột `status` (`pending`, `active`).
- Mã hóa mật khẩu người dùng trước khi lưu trữ bằng thuật toán băm an toàn (`bcrypt`).
- Sinh mã OTP 6 số ngẫu nhiên lưu trữ tạm thời trên Redis (TTL 5 phút) để xác thực người dùng (cả luồng kích hoạt và reset mật khẩu).
- Đẩy tác vụ gửi email chứa OTP bất đồng bộ qua message broker RabbitMQ tới Worker xử lý gửi mail SMTP (Mailtrap mock).
- Ngăn chặn spam gửi OTP bằng rate limit 60 giây được kiểm soát qua Redis key `otp_limit:<email>` và `reset_otp_limit:<email>`.
- Phát hành cặp Access Token (hạn ngắn, ví dụ 15 phút) và Refresh Token (hạn dài, ví dụ 7 ngày) sau khi đăng nhập thành công.
- Lưu trữ Refresh Token đang hoạt động trên Redis để quản lý vòng đời và hỗ trợ tính năng thu hồi token (Revocation) khi người dùng đăng xuất hoặc khi thực hiện đổi mật khẩu thành công.
- Áp dụng cơ chế xoay vòng Refresh Token (Refresh Token Rotation) để gia tăng tính bảo mật.
- Triển khai các Guards (`JwtAuthGuard`, `RolesGuard`) và decorator `@Roles(...)` để phân quyền cho các endpoint khác.

**Non-Goals:**
- Tích hợp các nhà cung cấp định danh bên thứ ba (OAuth2, Google, Facebook login) trong phạm vi của thay đổi này.
- Phát triển giao diện người dùng (Frontend Web/Mobile) cho luồng đăng nhập/đăng ký/nhập OTP.

## Decisions

### 1. Sinh UUID v7 tại Tầng Ứng dụng (NestJS) thay vì Database (PostgreSQL)
- **Giải pháp:** Sử dụng mô-đun `crypto` native của Node.js để sinh UUID v7 trước khi lưu thực thể vào database (thực hiện qua `@BeforeInsert` hook trong TypeORM).
- **Lý do:** Tránh việc phụ thuộc vào các phiên bản cụ thể của PostgreSQL chưa hỗ trợ native UUID v7, hoặc tránh viết các hàm PL/pgSQL phức tạp trong migration. Giúp schema hoạt động độc lập và dễ viết unit test.

### 2. Sử dụng thư viện `bcrypt` native
- **Giải pháp:** Sử dụng thư viện `bcrypt` để băm mật khẩu với `salt` gồm 10 rounds.
- **Lý do:** Bcrypt native hoạt động với hiệu suất tối đa. Nếu môi trường chạy docker/local gặp trục trặc về biên dịch binary, sẽ fallback sang `bcryptjs` (Pure JavaScript).

### 3. Lưu trữ và Xoay vòng Refresh Token trên Redis
- **Giải pháp:** Khi đăng nhập thành công, hệ thống sinh ra Access Token và Refresh Token. Refresh Token được hash bằng SHA-256 rồi lưu vào Redis theo key `refresh_token:<userId>` với TTL tương ứng (ví dụ: 7 ngày). Khi Client gọi API `/auth/refresh`, Server kiểm tra token gửi lên với token lưu trong Redis. Nếu khớp, Server sinh ra một cặp Access Token và Refresh Token mới, ghi đè token mới lên Redis (Token Rotation) và thu hồi token cũ.
- **Lý do:** Redis cung cấp truy cập in-memory siêu nhanh và cơ chế tự động dọn dẹp key hết hạn bằng TTL. Cơ chế xoay vòng giúp phát hiện nhanh các trường hợp token bị đánh cắp (nếu cùng một token cũ được dùng lại, hệ thống sẽ phát hiện và có thể thu hồi toàn bộ session của user).

### 4. Phân biệt namespace lưu trữ mã OTP trên Redis
- **Giải pháp:** Sử dụng các tiền tố key khác nhau để lưu giữ mã OTP cho từng tính năng:
  * OTP Đăng ký: `otp:<email>` (TTL 5m) và khóa chặn spam `otp_limit:<email>` (TTL 60s).
  * OTP Khôi phục mật khẩu: `reset_otp:<email>` (TTL 5m) và khóa chặn spam `reset_otp_limit:<email>` (TTL 60s).
- **Lý do:** Đảm bảo tính cô lập của dữ liệu, ngăn ngừa trường hợp người dùng dùng nhầm mã OTP đăng ký cho mục đích đổi mật khẩu hoặc ngược lại.

### 5. Thu hồi phiên đăng nhập khi đặt lại mật khẩu thành công
- **Giải pháp:** Khi gọi API `/auth/reset-password` thành công, ngoài việc cập nhật mật khẩu mới trong database, hệ thống sẽ xóa sạch key `refresh_token:<userId>` trên Redis.
- **Lý do:** Đảm bảo đăng xuất tài khoản khỏi tất cả các thiết bị khác ngay lập tức, gia tăng tính bảo mật khi người dùng có nghi ngờ tài khoản bị lộ và thực hiện khôi phục mật khẩu.

### 6. Tích hợp trực tiếp Email Consumer vào Monolith thông qua NotificationModule
- **Giải pháp:** Xây dựng `NotificationModule` chứa `EmailService` (dùng `nodemailer` kết nối SMTP) và `NotificationConsumer` (lắng nghe và xử lý message từ RabbitMQ queue `notification.email.otp` phi tuần tự). Module này được import trực tiếp vào `AppModule`.
- **Lý do:** Đảm bảo hệ thống tinh gọn, dễ deploy và vận hành ở giai đoạn Modular Monolith hiện tại, đồng thời xử lý gửi mail hoàn toàn bất đồng bộ thông qua Message Broker để không chặn tiến trình xử lý request HTTP chính.

### 7. Xác thực reset mật khẩu 2 bước sử dụng Stateful Reset Token trên Redis
- **Giải pháp:** Tách biệt việc verify OTP reset và việc cập nhật mật khẩu mới thành 2 API. Sau khi verify OTP thành công, Server sinh một chuỗi token ngẫu nhiên bảo mật (Reset Token) lưu vào Redis key `reset_token:<email>` với TTL 5 phút. Ở bước reset password tiếp theo, client gửi Reset Token lên để xác thực. Sau khi đổi mật khẩu thành công, Server xóa ngay Reset Token khỏi Redis để đảm bảo chỉ dùng 1 lần (Single-use).
- **Lý do:** Tăng cường tính bảo mật, tránh replay attack và phù hợp hơn với luồng giao diện người dùng (User Interface).

### 8. Thống nhất định dạng dữ liệu trả về (Unified Response & Error Envelope)
- **Giải pháp:**
  - Áp dụng `TransformInterceptor` toàn cục cho tất cả API trả về thành công: đóng gói dữ liệu gốc vào thuộc tính `data`, đi kèm trạng thái `success: true`, `statusCode`, `message` (lấy từ thuộc tính `message` của response nếu có) và `timestamp`.
  - Áp dụng `GlobalExceptionFilter` toàn cục cho tất cả các Exception: đóng gói lỗi vào thuộc tính `errors` (mảng các lỗi chi tiết, ví dụ validation errors), đi kèm `success: false`, `statusCode`, `message`, `timestamp` và `path` yêu cầu.
  - Hỗ trợ loại trừ đóng gói thành công bằng cách sử dụng decorator tùy biến (như `@BypassInterceptor()`) đối với các API trả về file raw hoặc stream trong tương lai.
- **Lý do:** Đảm bảo tất cả các Client (Web/Mobile) giao tiếp với hệ thống sử dụng một cấu trúc JSON đồng nhất ở lớp ngoài cùng, tăng tính chuyên nghiệp và dễ viết lớp Parser/Mapper dùng chung.

---

## APIs

### 1. Đăng ký tài khoản nháp (`POST /auth/register`)
- **Request Body (JSON):**
  ```json
  {
    "email": "audience@ticketbox.vn",
    "password": "strongpassword",
    "fullName": "Nguyen Van A"
  }
  ```
- **Responses:**
  * **201 Created:** Trả về thông tin user với `status: "pending"`.
    ```json
    {
      "id": "018f4a0c-7b00-7000-8000-000000000001",
      "email": "audience@ticketbox.vn",
      "fullName": "Nguyen Van A",
      "role": "audience",
      "status": "pending"
    }
    ```
  * **409 Conflict:** Email đã tồn tại.

### 2. Xác thực OTP kích hoạt tài khoản (`POST /auth/verify-otp`)
- **Request Body (JSON):**
  ```json
  {
    "email": "audience@ticketbox.vn",
    "otp": "184659"
  }
  ```
- **Responses:**
  * **200 OK:** `{"message": "Account activated successfully"}`
  * **401 Unauthorized:** OTP sai hoặc hết hạn.

### 3. Yêu cầu gửi lại OTP kích hoạt (`POST /auth/resend-otp`)
- **Request Body (JSON):**
  ```json
  { "email": "audience@ticketbox.vn" }
  ```
- **Responses:**
  * **200 OK:** `{"message": "OTP resent successfully"}`
  * **400 Bad Request:** Tài khoản đã kích hoạt.
  * **404 Not Found:** Không tìm thấy tài khoản.
  * **429 Too Many Requests:** Gửi yêu cầu quá nhanh (chưa quá 60s).

### 4. Yêu cầu khôi phục mật khẩu (`POST /auth/forgot-password`)
- **Request Body (JSON):**
  ```json
  { "email": "audience@ticketbox.vn" }
  ```
- **Responses:**
  * **200 OK:** `{"message": "Reset password OTP sent successfully"}`
  * **404 Not Found:** Email không tồn tại hoặc chưa kích hoạt.
  * **429 Too Many Requests:** Gửi yêu cầu quá nhanh.

### 5. Xác thực OTP reset mật khẩu (`POST /auth/verify-reset-otp`)
- **Request Body (JSON):**
  ```json
  {
    "email": "audience@ticketbox.vn",
    "otp": "948102"
  }
  ```
- **Responses:**
  * **200 OK:** Trả về Reset Token tạm thời:
    ```json
    {
      "resetToken": "70be9f8c6d48259d64b18f7739502b4e"
    }
    ```
  * **401 Unauthorized:** Mã OTP reset sai hoặc đã hết hạn.

### 6. Cài đặt lại mật khẩu bằng Reset Token (`POST /auth/reset-password`)
- **Request Body (JSON):**
  ```json
  {
    "email": "audience@ticketbox.vn",
    "resetToken": "70be9f8c6d48259d64b18f7739502b4e",
    "newPassword": "newsecurepassword123"
  }
  ```
- **Responses:**
  * **200 OK:** `{"message": "Password has been reset successfully"}`
  * **401 Unauthorized:** Reset Token không hợp lệ hoặc đã hết hạn.

### 7. Đăng nhập hệ thống (`POST /auth/login`)
- **Request Body (JSON):**
  ```json
  {
    "email": "audience@ticketbox.vn",
    "password": "strongpassword"
  }
  ```
- **Responses:**
  * **200 OK:** Trả về cặp tokens:
    ```json
    {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi..."
    }
    ```
  * **401 Unauthorized:** Sai email hoặc mật khẩu.
  * **403 Forbidden:** Tài khoản chưa kích hoạt (`pending`).

### 8. Làm mới Access Token (`POST /auth/refresh`)
- **Request Body (JSON):**
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```
- **Responses:**
  * **200 OK:** Trả về cặp tokens mới:
    ```json
    {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi..."
    }
    ```
  * **401 Unauthorized:** Refresh Token hết hạn, không hợp lệ hoặc đã bị thu hồi/tái sử dụng.

### 9. Đăng xuất hệ thống (`POST /auth/logout`)
- **Request Body (JSON):**
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```
- **Responses:**
  * **200 OK:** `{"message": "Logged out successfully"}`
  * **401 Unauthorized:** Refresh token không hợp lệ hoặc không khớp.

### 10. Xem thông tin cá nhân (`GET /auth/me`)
- **Headers:** `Authorization: Bearer <accessToken>`
- **Responses:**
  * **200 OK:**
    ```json
    {
      "id": "018f4a0c-7b00-7000-8000-000000000001",
      "email": "audience@ticketbox.vn",
      "fullName": "Nguyen Van A",
      "role": "audience",
      "status": "active"
    }
    ```
  * **401 Unauthorized:** Không có Access Token hoặc token không hợp lệ/hết hạn.

---

## Risks / Trade-offs

- **[Risk] Spam yêu cầu gửi OTP làm nghẽn hàng đợi hoặc tốn chi phí gửi email:**
  * *Mitigation:* Thiết lập Redis key `otp_limit:<email>` và `reset_otp_limit:<email>` thời hạn 60 giây làm rate limiter. Người dùng chỉ được yêu cầu gửi lại OTP sau khi khóa này hết hạn.
- **[Risk] Bảng users phát sinh tài khoản rác ở trạng thái `pending` không bao giờ verify:**
  * *Mitigation:* Xây dựng một Cron Job chạy định kỳ hàng ngày quét các tài khoản ở trạng thái `pending` được tạo quá 24h để thực hiện xóa bỏ khỏi Database.
- **[Risk] Mất dữ liệu Refresh Token/OTP khi Redis bị restart đột ngột:**
  * *Mitigation:* Người dùng sẽ phải đăng nhập lại hoặc yêu cầu gửi lại mã OTP mới. Đây là hành vi chấp nhận được đối với dữ liệu tạm thời. Redis cần bật cơ chế bền vững (AOF/RDB).

---

## Email Notification System Design

### 1. SMTP Transporter & Configuration
Hệ thống kết nối tới SMTP Server (Mailtrap/Gmail/Amazon SES) thông qua các biến cấu hình môi trường sau:
- `SMTP_HOST`: Địa chỉ máy chủ SMTP.
- `SMTP_PORT`: Cổng kết nối (ví dụ: 2525 cho Mailtrap, 587 cho TLS).
- `SMTP_USER`: Tài khoản xác thực.
- `SMTP_PASSWORD`: Mật khẩu xác thực.
- `SMTP_FROM_EMAIL`: Địa chỉ email người gửi (ví dụ: `no-reply@ticketbox.vn`).

### 2. Master HTML Email Template Builder
Sử dụng chung một Master HTML Email Template thiết kế dạng Card hiện đại (bo góc `16px`, viền Slate mờ, đổ bóng nhẹ) tương thích tốt trên mọi mail client. Hỗ trợ cấu hình động qua `EmailTemplateOptions`:
- `title` (string): Tiêu đề hiển thị trên header.
- `description` (string): Lời mở đầu nội dung email.
- `headerBgColor` (string): Màu nền header tùy biến theo loại email:
  - **Xác thực OTP/Kích hoạt tài khoản:** Navy Đậm (`#0f172a`).
  - **Khôi phục mật khẩu:** Nâu Đỏ Cảnh báo (`#311005`).
- `contentHtml` (string): HTML tùy biến (như dashed border box màu xanh/vàng nhạt chứa mã OTP thô có `letter-spacing` rộng dễ đọc).
- `footerText` (string): Lời lưu ý nhỏ hiển thị ở chân email.

### 3. RabbitMQ Message Consumer Flow
- `NotificationConsumer` sử dụng phương thức `consume()` của `RabbitMQService` để lắng nghe queue `notification.email.otp` (durable: true).
- Khi nhận message:
  1. Trích xuất `email` và `otp` từ JSON payload.
  2. Tạo mã HTML động qua Master Template Builder.
  3. Sử dụng `nodemailer` để thực hiện gửi mail qua SMTP.
  4. Sau khi gửi thành công, gọi `channel.ack(msg)` để xác nhận hoàn tất.
  5. Trường hợp lỗi (sai thông tin SMTP, lỗi mạng tạm thời): ghi log lỗi chi tiết và gọi `channel.nack(msg, false, false)` để hủy bỏ tin nhắn và tránh vòng lặp vô hạn.

