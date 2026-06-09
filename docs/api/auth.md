# Auth API Specification

Tài liệu đặc tả chi tiết các API endpoints thuộc module Xác thực & Phân quyền (Authentication & Authorization) của TicketBox.

## Tổng quan

- **Base URL:** `http://localhost:3000` (môi trường Local Development)
- **Định dạng dữ liệu:** `application/json` cho tất cả các Request và Response.
- **Cơ chế xác thực:** Sử dụng JWT (JSON Web Tokens). Access Token được truyền qua HTTP Header `Authorization: Bearer <token>`.

### Danh sách API Endpoints

| HTTP Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/auth/register` | Public | Đăng ký tài khoản nháp mới (`pending`) |
| **POST** | `/auth/verify-otp` | Public | Xác thực OTP để kích hoạt tài khoản sang `active` |
| **POST** | `/auth/resend-otp` | Public | Yêu cầu gửi lại mã OTP kích hoạt tài khoản |
| **POST** | `/auth/forgot-password` | Public | Yêu cầu khôi phục mật khẩu (gửi OTP reset) |
| **POST** | `/auth/reset-password` | Public | Đặt lại mật khẩu mới bằng OTP |
| **POST** | `/auth/login` | Public | Đăng nhập và nhận cặp Access & Refresh Tokens |
| **POST** | `/auth/refresh` | Public | Làm mới Access Token sử dụng Refresh Token |
| **POST** | `/auth/logout` | Public | Đăng xuất, hủy bỏ Refresh Token trên Redis |
| **GET** | `/auth/me` | Bearer Token | Lấy thông tin cá nhân của người dùng hiện tại |

---

## Chi tiết API Endpoints

### 1. Đăng ký tài khoản (`POST /auth/register`)

Đăng ký tài khoản mới. Tài khoản khi tạo ban đầu sẽ ở trạng thái nháp `pending` và hệ thống sẽ tự động gửi mã OTP 6 chữ số về email để xác thực.

- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "fullName": "Nguyen Van A"
  }
  ```
  - `email` (string, required): Địa chỉ email duy nhất, đúng định dạng.
  - `password` (string, required): Mật khẩu dài tối thiểu 6 ký tự.
  - `fullName` (string, required): Họ và tên đầy đủ, không để trống.

- **Responses:**
  - **201 Created:** Tài khoản nháp được tạo thành công.
    ```json
    {
      "id": "019ead55-0ef1-738d-8616-b6f877b269c8",
      "email": "user@example.com",
      "fullName": "Nguyen Van A",
      "role": "audience",
      "status": "pending",
      "createdAt": "2026-06-09T10:01:33.296Z"
    }
    ```
  - **400 Bad Request:** Dữ liệu đầu vào không hợp lệ.
    ```json
    {
      "message": [
        "email must be an email",
        "password must be longer than or equal to 6 characters"
      ],
      "error": "Bad Request",
      "statusCode": 400
    }
    ```
  - **409 Conflict:** Email đã được đăng ký trong hệ thống.
    ```json
    {
      "message": "Email already registered",
      "error": "Conflict",
      "statusCode": 409
    }
    ```
  - **429 Too Many Requests:** Spam gửi OTP khi yêu cầu đăng ký lại liên tục trong vòng 60 giây.
    ```json
    {
      "message": "Please wait 60 seconds before requesting a new OTP",
      "error": "Too Many Requests",
      "statusCode": 429
    }
    ```

---

### 2. Xác thực OTP kích hoạt tài khoản (`POST /auth/verify-otp`)

Xác thực mã OTP gửi về email để chuyển trạng thái tài khoản từ `pending` sang `active`.

- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "otp": "116476"
  }
  ```
  - `email` (string, required): Địa chỉ email đã đăng ký.
  - `otp` (string, required): Mã OTP gồm đúng 6 chữ số.

- **Responses:**
  - **200 OK:** Kích hoạt tài khoản thành công.
    ```json
    {
      "message": "Account activated successfully"
    }
    ```
  - **401 Unauthorized:** Mã OTP bị sai hoặc đã hết hạn (quá 5 phút).
    ```json
    {
      "message": "Invalid OTP",
      "error": "Unauthorized",
      "statusCode": 401
    }
    ```

---

### 3. Gửi lại OTP kích hoạt (`POST /auth/resend-otp`)

Gửi lại mã OTP mới đến email nếu người dùng chưa nhận được hoặc mã cũ đã hết hạn. Endpoint này áp dụng rate limit 60 giây.

- **Request Body:**
  ```json
  {
    "email": "user@example.com"
  }
  ```

- **Responses:**
  - **200 OK:** Gửi lại OTP thành công.
    ```json
    {
      "message": "OTP resent successfully"
    }
    ```
  - **400 Bad Request:** Tài khoản đã được kích hoạt từ trước.
    ```json
    {
      "message": "Account is already active",
      "error": "Bad Request",
      "statusCode": 400
    }
    ```
  - **404 Not Found:** Không tìm thấy tài khoản tương ứng với email.
    ```json
    {
      "message": "User not found",
      "error": "Not Found",
      "statusCode": 404
    }
    ```
  - **429 Too Many Requests:** Gửi yêu cầu quá nhanh khi chưa hết 60 giây rate limit kể từ lần gửi OTP gần nhất.
    ```json
    {
      "statusCode": 429,
      "message": "Please wait 60 seconds before requesting a new OTP"
    }
    ```

---

### 4. Yêu cầu khôi phục mật khẩu (`POST /auth/forgot-password`)

Gửi yêu cầu reset mật khẩu. Hệ thống sẽ sinh mã OTP reset gửi đến email của tài khoản đang ở trạng thái `active`. Áp dụng rate limit 60 giây.

- **Request Body:**
  ```json
  {
    "email": "user@example.com"
  }
  ```

- **Responses:**
  - **200 OK:** OTP khôi phục mật khẩu gửi thành công.
    ```json
    {
      "message": "Reset password OTP sent successfully"
    }
    ```
  - **404 Not Found:** Email không tồn tại hoặc tài khoản đang ở trạng thái `pending`.
    ```json
    {
      "message": "Email not found or account is not active",
      "error": "Not Found",
      "statusCode": 404
    }
    ```
  - **429 Too Many Requests:** Gửi yêu cầu quá nhanh khi chưa hết 60 giây rate limit.
    ```json
    {
      "message": "Please wait 60 seconds before requesting a new reset OTP",
      "error": "Too Many Requests",
      "statusCode": 429
    }
    ```

---

### 5. Cài đặt lại mật khẩu bằng OTP (`POST /auth/reset-password`)

Đặt lại mật khẩu mới cho người dùng bằng mã OTP đã nhận được. Sau khi reset thành công, tất cả Refresh Token của tài khoản này trên Redis sẽ bị xóa để buộc đăng xuất trên mọi thiết bị.

- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "otp": "615697",
    "newPassword": "newsecurepassword123"
  }
  ```
  - `email` (string, required): Địa chỉ email.
  - `otp` (string, required): Mã OTP reset gồm 6 chữ số.
  - `newPassword` (string, required): Mật khẩu mới dài tối thiểu 6 ký tự.

- **Responses:**
  - **200 OK:** Cập nhật mật khẩu thành công.
    ```json
    {
      "message": "Password has been reset successfully"
    }
    ```
  - **401 Unauthorized:** Mã OTP reset sai hoặc đã hết hạn.
    ```json
    {
      "message": "Invalid OTP",
      "error": "Unauthorized",
      "statusCode": 401
    }
    ```
  - **404 Not Found:** Email không tồn tại.
    ```json
    {
      "message": "User not found",
      "error": "Not Found",
      "statusCode": 404
    }
    ```

---

### 6. Đăng nhập hệ thống (`POST /auth/login`)

Xác thực email và mật khẩu, cấp cặp Access Token (hạn 15 phút) và Refresh Token (hạn 7 ngày). Chỉ cho phép các tài khoản đã ở trạng thái `active` đăng nhập.

- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "newsecurepassword123"
  }
  ```

- **Responses:**
  - **200 OK:** Đăng nhập thành công.
    ```json
    {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
    ```
  - **401 Unauthorized:** Thông tin email hoặc mật khẩu không chính xác.
    ```json
    {
      "message": "Invalid email or password",
      "error": "Unauthorized",
      "statusCode": 401
    }
    ```
  - **403 Forbidden:** Tài khoản chưa được xác thực kích hoạt (`pending`).
    ```json
    {
      "message": "Please verify your email address first",
      "error": "Forbidden",
      "statusCode": 403
    }
    ```

---

### 7. Làm mới Access Token (`POST /auth/refresh`)

Sử dụng Refresh Token hợp lệ chưa hết hạn để lấy cặp Access Token & Refresh Token mới (Refresh Token Rotation - RTR). Nếu phát hiện hành vi sử dụng lại token cũ (Token Reuse), phiên đăng nhập hiện tại trên Redis sẽ bị xóa bỏ hoàn toàn (Revocation).

- **Request Body:**
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

- **Responses:**
  - **200 OK:** Làm mới token thành công.
    ```json
    {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
    ```
  - **401 Unauthorized:** Refresh Token hết hạn, không hợp lệ, hoặc đã bị thu hồi/phát hiện reuse.
    ```json
    {
      "message": "Token reuse detected. Session revoked.",
      "error": "Unauthorized",
      "statusCode": 401
    }
    ```

---

### 8. Đăng xuất hệ thống (`POST /auth/logout`)

Đăng xuất và hủy phiên làm việc hiện tại bằng cách xóa Refresh Token của người dùng khỏi Redis.

- **Request Body:**
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

- **Responses:**
  - **200 OK:** Đăng xuất thành công.
    ```json
    {
      "message": "Logged out successfully"
    }
    ```
  - **401 Unauthorized:** Token không hợp lệ.
    ```json
    {
      "message": "Invalid refresh token hash",
      "error": "Unauthorized",
      "statusCode": 401
    }
    ```

---

### 9. Xem thông tin cá nhân (`GET /auth/me`)

Lấy thông tin cá nhân của tài khoản đang đăng nhập sử dụng Access Token trong Header.

- **Headers:**
  - `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

- **Responses:**
  - **200 OK:** Trả về thông tin cơ bản của token người dùng.
    ```json
    {
      "userId": "019ead55-0ef1-738d-8616-b6f877b269c8",
      "email": "user@example.com",
      "role": "audience"
    }
    ```
  - **401 Unauthorized:** Token không tồn tại, sai cấu trúc hoặc đã hết hạn.
    ```json
    {
      "message": "Unauthorized",
      "statusCode": 401
    }
    ```
