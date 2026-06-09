## Context

Hệ thống TicketBox hiện tại đang chạy dưới dạng một Modular Monolith viết bằng NestJS, kết nối tới cơ sở dữ liệu PostgreSQL, cache Redis và message broker RabbitMQ. Hệ thống chưa có cơ chế xác thực người dùng và phân quyền (RBAC). Để chuẩn bị cho các module nghiệp vụ tiếp theo như Booking, Check-in, Stats, cần xây dựng một hệ thống xác thực tập trung sử dụng JSON Web Token (JWT) và bảo vệ API theo từng vai trò (Audience, Organizer, Gate Staff).

## Goals / Non-Goals

**Goals:**
- Triển khai thành công các API đăng ký (`POST /auth/register`), đăng nhập (`POST /auth/login`), làm mới token (`POST /auth/refresh`), đăng xuất (`POST /auth/logout`) và truy vấn thông tin cá nhân (`GET /auth/me`).
- Thiết lập bảng cơ sở dữ liệu `users` lưu trữ thông tin tài khoản người dùng, sử dụng UUID v7 làm khóa chính.
- Mã hóa mật khẩu người dùng trước khi lưu trữ bằng thuật toán băm an toàn (`bcrypt`).
- Phát hành cặp Access Token (hạn ngắn, ví dụ 15 phút) và Refresh Token (hạn dài, ví dụ 7 ngày) sau khi đăng nhập thành công.
- Lưu trữ Refresh Token đang hoạt động trên Redis để quản lý vòng đời và hỗ trợ tính năng thu hồi token (Revocation) khi người dùng đăng xuất.
- Áp dụng cơ chế xoay vòng Refresh Token (Refresh Token Rotation) để gia tăng tính bảo mật.
- Triển khai các Guards (`JwtAuthGuard`, `RolesGuard`) và decorator `@Roles(...)` để phân quyền cho các endpoint khác.

**Non-Goals:**
- Tích hợp các nhà cung cấp định danh bên thứ ba (OAuth2, Google, Facebook login) trong phạm vi của thay đổi này.
- Phát triển giao diện người dùng (Frontend Web/Mobile) cho luồng đăng nhập/đăng ký.

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

---

## APIs

### 1. Đăng nhập hệ thống (`POST /auth/login`)
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

### 2. Làm mới Access Token (`POST /auth/refresh`)
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

### 3. Đăng xuất hệ thống (`POST /auth/logout`)
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

- **[Risk] Mất dữ liệu Refresh Token khi Redis bị restart đột ngột:**
  * *Mitigation:* Người dùng sẽ phải đăng nhập lại để nhận token mới. Đây là hành vi chấp nhận được đối với dữ liệu tạm thời như session/token. Để giảm thiểu rủi ro này, Redis trong môi trường Production cần bật cơ chế ghi bền vững (AOF/RDB).
- **[Risk] Thất bại khi cài đặt thư viện bcrypt native trên một số hệ điều hành (do yêu cầu node-gyp compile):**
  * *Mitigation:* Chuẩn bị phương án đổi sang `bcryptjs` (không yêu cầu biên dịch C++).
- **[Risk] Trùng lặp email đăng ký dưới tải cao:**
  * *Mitigation:* Thêm ràng buộc `UNIQUE` cho trường `email` ở mức database nhằm chặn hoàn toàn race condition tạo tài khoản trùng email.
