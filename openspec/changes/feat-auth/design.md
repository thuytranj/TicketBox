## Context

Hệ thống TicketBox hiện tại đang chạy dưới dạng một Modular Monolith viết bằng NestJS, kết nối tới cơ sở dữ liệu PostgreSQL, cache Redis và message broker RabbitMQ. Hệ thống chưa có cơ chế xác thực người dùng và phân quyền (RBAC). Để chuẩn bị cho các module nghiệp vụ tiếp theo như Booking, Check-in, Stats, cần xây dựng một hệ thống xác thực tập trung sử dụng JSON Web Token (JWT) và bảo vệ API theo từng vai trò (Audience, Organizer, Gate Staff). Đồng thời, bổ sung cơ chế xác thực email bằng mã OTP được gửi bất đồng bộ qua RabbitMQ trước khi kích hoạt tài khoản.

## Goals / Non-Goals

**Goals:**
- Triển khai thành công các API đăng ký (`POST /auth/register`), đăng nhập (`POST /auth/login`), làm mới token (`POST /auth/refresh`), đăng xuất (`POST /auth/logout`), xác thực OTP (`POST /auth/verify-otp`) và truy vấn thông tin cá nhân (`GET /auth/me`).
- Thiết lập bảng cơ sở dữ liệu `users` lưu trữ thông tin tài khoản người dùng, sử dụng UUID v7 làm khóa chính và thêm cột `status` (`pending`, `active`).
- Mã hóa mật khẩu người dùng trước khi lưu trữ bằng thuật toán băm an toàn (`bcrypt`).
- Sinh mã OTP 6 số ngẫu nhiên lưu trữ tạm thời trên Redis (TTL 5 phút) để xác thực người dùng.
- Đẩy tác vụ gửi email chứa OTP bất đồng bộ qua message broker RabbitMQ tới Worker xử lý gửi mail SMTP (Mailtrap mock).
- Ngăn chặn spam gửi OTP bằng rate limit 60 giây được kiểm soát qua Redis key `otp_limit:<email>`.
- Phát hành cặp Access Token (hạn ngắn, ví dụ 15 phút) và Refresh Token (hạn dài, ví dụ 7 ngày) sau khi đăng nhập thành công.
- Lưu trữ Refresh Token đang hoạt động trên Redis để quản lý vòng đời và hỗ trợ tính năng thu hồi token (Revocation) khi người dùng đăng xuất.
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

### 4. Lưu trạng thái đăng ký tạm `pending` trong PostgreSQL thay vì Redis
- **Giải pháp (Phương án A):** Khi gọi đăng ký, tài khoản được lưu ngay vào PostgreSQL ở trạng thái `pending` và chỉ đổi thành `active` khi verify OTP thành công.
- **Lý do:** Tận dụng ràng buộc `UNIQUE` đối với trường `email` trực tiếp ở tầng PostgreSQL nhằm ngăn chặn triệt để tình trạng hai tài khoản đăng ký trùng email dưới mức tải cao (race condition). Tránh việc quản lý serialize/deserialize và đảm bảo tính nhất quán dữ liệu nhạy cảm trên bộ nhớ tạm Redis.

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
  * **201 Created:**
    ```json
    {
      "id": "018f63bb-92d5-7123-8cbf-32fbb477db1a",
      "email": "audience@ticketbox.vn",
      "fullName": "Nguyen Van A",
      "role": "audience",
      "status": "pending",
      "createdAt": "2026-06-09T22:00:00.000Z"
    }
    ```
  * **400 Bad Request:** Lỗi validation định dạng email hoặc mật khẩu quá ngắn.
  * **409 Conflict:** Email đã được đăng ký trước đó.

### 2. Xác thực OTP kích hoạt tài khoản (`POST /auth/verify-otp`)
- **Request Body (JSON):**
  ```json
  {
    "email": "audience@ticketbox.vn",
    "otp": "184659"
  }
  ```
- **Responses:**
  * **200 OK:**
    ```json
    {
      "message": "Account activated successfully"
    }
    ```
  * **400 Bad Request:** Dữ liệu đầu vào thiếu hoặc sai định dạng.
  * **401 Unauthorized:** Mã OTP sai hoặc đã hết hạn trên Redis.

### 3. Đăng nhập hệ thống (`POST /auth/login`)
- **Request Body (JSON):**
  ```json
  {
    "email": "audience@ticketbox.vn",
    "password": "strongpassword"
  }
  ```
- **Responses:**
  * **200 OK:**
    ```json
    {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
    ```
  * **401 Unauthorized:** Sai email hoặc mật khẩu.
  * **403 Forbidden:** Tài khoản chưa kích hoạt (`status` là `pending`).

### 4. Làm mới Access Token (`POST /auth/refresh`)
- **Request Body (JSON):**
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Responses:**
  * **200 OK:**
    ```json
    {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
    ```
  * **401 Unauthorized:** Refresh Token không hợp lệ, hết hạn, hoặc đã bị thu hồi khỏi Redis.

### 5. Đăng xuất hệ thống (`POST /auth/logout`)
- **Request Body (JSON):**
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Responses:**
  * **200 OK:** Không trả về body dữ liệu (Đã xóa Refresh Token trên Redis).
  * **401 Unauthorized:** Token không hợp lệ.

---

## Risks / Trade-offs

- **[Risk] Spam yêu cầu gửi OTP làm nghẽn hàng đợi hoặc tốn chi phí gửi email:**
  * *Mitigation:* Thiết lập Redis key `otp_limit:<email>` thời hạn 60 giây làm rate limiter. Người dùng chỉ được yêu cầu gửi lại OTP sau khi khóa này hết hạn.
- **[Risk] Bảng users phát sinh tài khoản rác ở trạng thái `pending` không bao giờ verify:**
  * *Mitigation:* Xây dựng một Cron Job chạy định kỳ hàng ngày quét các tài khoản ở trạng thái `pending` được tạo quá 24h để thực hiện xóa bỏ khỏi Database.
- **[Risk] Mất dữ liệu Refresh Token/OTP khi Redis bị restart đột ngột:**
  * *Mitigation:* Người dùng sẽ phải đăng nhập lại hoặc yêu cầu gửi lại mã OTP mới. Đây là hành vi chấp nhận được đối với dữ liệu tạm thời. Redis cần bật cơ chế bền vững (AOF/RDB).
- **[Risk] Thất bại khi cài đặt thư viện bcrypt native trên một số hệ điều hành (do yêu cầu node-gyp compile):**
  * *Mitigation:* Chuẩn bị phương án đổi sang `bcryptjs` (không yêu cầu biên dịch C++).
- **[Risk] Trùng lặp email đăng ký dưới tải cao:**
  * *Mitigation:* Thêm ràng buộc `UNIQUE` cho trường `email` ở mức database nhằm chặn hoàn toàn race condition tạo tài khoản trùng email.
