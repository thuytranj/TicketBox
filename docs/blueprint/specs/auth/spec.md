# Đặc tả: Xác thực và Phân quyền Người dùng (Authentication & Authorization)

## Mô tả
Hệ thống Xác thực và Phân quyền (Authentication & Authorization) quản lý toàn bộ vòng đời tài khoản người dùng, cơ chế bảo vệ tài nguyên API, và kiểm soát phiên làm việc (Session). Tính năng này bao gồm:
- **Đăng ký và Kích hoạt tài khoản:** Đăng ký tài khoản, gửi OTP kích hoạt qua Email sử dụng hàng đợi RabbitMQ, lưu trữ OTP trên Redis, xác thực OTP để chuyển trạng thái tài khoản.
- **Xác thực Đăng nhập & Đăng xuất:** Kiểm tra mật khẩu băm, cấp phát cặp JWT Access Token và Refresh Token, lưu trữ và thu hồi phiên.
- **Làm mới Token bất đồng bộ:** Thực hiện cơ chế xoay vòng Refresh Token (Refresh Token Rotation - RTR) kết hợp cơ chế phát hiện tái sử dụng Token cũ (Token Reuse Detection) để vô hiệu hóa phiên bị xâm nhập.
- **Khôi phục mật khẩu:** Quy trình 3 bước (Yêu cầu OTP -> Xác thực OTP nhận Reset Token -> Đặt mật khẩu mới bằng Reset Token).
- **Phân quyền dựa trên vai trò (RBAC - Role-Based Access Control):** Phân chia tài nguyên API theo vai trò (`admin`, `organizer`, `audience`, `gate_staff`).

---

## Luồng chính

### 1. Đăng ký tài khoản (Register)
- **Đầu vào (Payload `POST /auth/register`):**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123",
    "fullName": "Nguyen Van A"
  }
  ```
- **Các bước xử lý:**
  1. Validate định dạng email, độ dài mật khẩu ($\ge 6$ ký tự), và họ tên không được để trống.
  2. Truy vấn PostgreSQL kiểm tra xem email đã tồn tại chưa.
  3. Kiểm tra rate limit gửi OTP trong Redis: Nếu tồn tại key `otp_limit:<email>`, chặn yêu cầu và báo lỗi.
  4. Thực hiện băm (hash) mật khẩu bằng thuật toán `bcrypt` với `salt rounds = 10`.
  5. Tạo bản ghi User mới trong PostgreSQL (UUID v7, `role = 'audience'`, `status = 'pending'`).
  6. Sinh mã OTP ngẫu nhiên gồm 6 chữ số (từ `100000` đến `999999`).
  7. Lưu mã OTP vào Redis với key `otp:<email>` (TTL 300 giây).
  8. Thiết lập khóa rate limit gửi OTP trong Redis với key `otp_limit:<email>` (TTL 60 giây).
  9. Đẩy một thông điệp tác vụ gửi email vào hàng đợi RabbitMQ `notification.email.otp` qua Exchange `notification.exchange` với cấu trúc:
     ```json
     {
       "email": "user@example.com",
       "type": "activation_otp",
       "otp": "123456"
     }
     ```
  10. Trả về thông tin tài khoản vừa tạo (không bao gồm trường `passwordHash`) và mã HTTP `201 Created`.

### 2. Xác thực OTP kích hoạt tài khoản (Verify OTP)
- **Đầu vào (`POST /auth/verify-otp`):**
  ```json
  {
    "email": "user@example.com",
    "otp": "123456"
  }
  ```
- **Các bước xử lý:**
  1. Tìm kiếm người dùng theo email trong PostgreSQL. Nếu trạng thái người dùng đã là `active`, trả về thành công ngay lập tức.
  2. Nếu trạng thái là `pending`, hệ thống đọc mã OTP lưu trong Redis key `otp:<email>`.
  3. So khớp mã OTP người dùng gửi lên với mã OTP lấy từ Redis.
  4. Nếu khớp:
     - Cập nhật trạng thái người dùng từ `pending` sang `active` trong PostgreSQL.
     - Xóa các khóa `otp:<email>` và `otp_limit:<email>` khỏi Redis.
     - Phản hồi mã HTTP `200 OK` kèm thông báo kích hoạt thành công.

### 3. Yêu cầu gửi lại mã OTP kích hoạt (Resend OTP)
- **Đầu vào (`POST /auth/resend-otp`):**
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Các bước xử lý:**
  1. Kiểm tra tài khoản trong PostgreSQL: email phải tồn tại và tài khoản phải ở trạng thái `pending`.
  2. Kiểm tra khóa rate limit `otp_limit:<email>` trên Redis. Nếu tồn tại, từ chối yêu cầu.
  3. Sinh mã OTP 6 chữ số mới, ghi đè vào Redis key `otp:<email>` (TTL 300 giây).
  4. Cấu hình lại rate limit key `otp_limit:<email>` (TTL 60 giây).
  5. Đẩy tác vụ gửi email mới vào RabbitMQ và trả về HTTP `200 OK`.

### 4. Đăng nhập hệ thống (Login)
- **Đầu vào (`POST /auth/login`):**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123"
  }
  ```
- **Các bước xử lý:**
  1. Truy vấn thông tin người dùng từ PostgreSQL.
  2. So sánh mật khẩu gửi lên với mật khẩu băm lưu trong cơ sở dữ liệu bằng `bcrypt.compare()`.
  3. Kiểm tra trạng thái tài khoản: Nếu trạng thái không phải là `active` (đang ở trạng thái `pending` hoặc `blocked`), từ chối đăng nhập.
  4. Tạo JWT Access Token (TTL 15 phút) sử dụng thuật toán HS256 với payload:
     ```json
     {
       "id": "user-uuid-v7-value",
       "email": "user@example.com",
       "role": "audience"
     }
     ```
  5. Tạo JWT Refresh Token (TTL 7 ngày) với payload:
     ```json
     {
       "id": "user-uuid-v7-value"
     }
     ```
  6. **Bảo mật lưu trữ:** Băm Refresh Token vừa tạo bằng thuật toán SHA-256:
     $$\text{hash} = \text{crypto.createHash('sha256').update(refreshToken).digest('hex')}$$
  7. Lưu mã băm (hash) này vào Redis key `refresh_token:<userId>` với TTL 7 ngày (604,800 giây).
  8. Trả về payload chứa cặp tokens và mã HTTP `200 OK`:
     ```json
     {
       "accessToken": "eyJhbGciOi...",
       "refreshToken": "eyJhbGciOi..."
     }
     ```

### 5. Làm mới Access Token (Refresh Token Rotation - RTR)
- **Đầu vào (`POST /auth/refresh`):**
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```
- **Các bước xử lý:**
  1. Giải mã và xác thực chữ ký số của `refreshToken` bằng JWT Service.
  2. Lấy `userId` từ payload của token.
  3. Truy vấn PostgreSQL kiểm tra tài khoản người dùng hoạt động (`active`).
  4. Lấy mã băm Refresh Token hiện tại đang hoạt động trên Redis từ key `refresh_token:<userId>`.
  5. Tính toán mã băm SHA-256 của `refreshToken` do client gửi lên và so sánh với giá trị đọc từ Redis:
     - **Trường hợp Khớp (Hợp lệ):**
       - Sinh cặp Access Token mới (TTL 15 phút) và Refresh Token mới (TTL 7 ngày).
       - Băm Refresh Token mới bằng SHA-256 rồi ghi đè vào Redis key `refresh_token:<userId>` với TTL 7 ngày (Rơ-le xoay vòng token).
       - Trả về cặp token mới kèm HTTP `200 OK`.
     - **Trường hợp Không Khớp / Không Tìm Thấy (Nghi ngờ Tấn công tái sử dụng Token - Token Reuse):**
       - Lập tức thu hồi phiên đăng nhập bằng cách xóa key `refresh_token:<userId>` khỏi Redis.
       - Trả về lỗi `401 Unauthorized` buộc tất cả các thiết bị đang đăng nhập bằng tài khoản này phải đăng nhập lại từ đầu.

### 6. Đăng xuất hệ thống (Logout)
- **Đầu vào (`POST /auth/logout`):**
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```
- **Các bước xử lý:**
  1. Giải mã `refreshToken` lấy `userId`.
  2. Băm `refreshToken` bằng SHA-256 và so khớp với giá trị lưu trong Redis key `refresh_token:<userId>`.
  3. Nếu khớp, xóa key `refresh_token:<userId>` khỏi Redis để chấm dứt hoàn toàn phiên làm việc.
  4. Phản hồi HTTP `200 OK`.

### 7. Quên và Đặt lại mật khẩu (Forgot & Reset Password)
- **Bước 7.1: Yêu cầu mã OTP khôi phục mật khẩu (`POST /auth/forgot-password`):**
  - Người dùng gửi email -> Kiểm tra tài khoản tồn tại và có `status = 'active'` -> Sinh OTP 6 chữ số -> Lưu vào Redis key `reset_otp:<email>` (TTL 5 phút) -> Đặt rate limit `reset_otp_limit:<email>` (TTL 60 giây) -> Đẩy task gửi email vào RabbitMQ -> Trả về HTTP `200 OK`.
- **Bước 7.2: Xác thực mã OTP khôi phục (`POST /auth/verify-reset-otp`):**
  - Khách gửi email và mã OTP -> So khớp với Redis key `reset_otp:<email>` -> Nếu khớp: Sinh Reset Token ngẫu nhiên (UUID), lưu vào Redis key `reset_token:<email>` (TTL 5 phút), xóa key `reset_otp:<email>` -> Trả về `resetToken` cho client kèm HTTP `200 OK`.
- **Bước 7.3: Đặt mật khẩu mới bằng Reset Token (`POST /auth/reset-password`):**
  - Đầu vào gồm email, `resetToken` và `newPassword` -> So khớp `resetToken` trên Redis key `reset_token:<email>` -> Nếu khớp: Băm `newPassword` bằng `bcrypt` và cập nhật vào PostgreSQL -> Xóa `reset_token:<email>` và `reset_otp_limit:<email>` trên Redis -> Thu hồi tất cả phiên làm việc bằng cách xóa key `refresh_token:<userId>` (đăng xuất toàn bộ các thiết bị) -> Trả về HTTP `200 OK`.

### 8. Phân quyền dựa trên vai trò (RBAC)
- **Xác thực Guard:** `RolesGuard` được khai báo toàn cục hoặc cấp Controller/Method.
- **Quy trình:**
  1. Trích xuất thông tin `role` từ JWT Access Token đã qua giải mã của request.
  2. So sánh vai trò của người dùng với danh sách các vai trò được phép (ví dụ: `@Roles(UserRole.ADMIN, UserRole.ORGANIZER)`).
  3. Nếu khớp, cho phép đi qua tiếp cận handler của API.
  4. Nếu không khớp, chặn yêu cầu và trả về lỗi `403 Forbidden`.

---

## Kịch bản lỗi
1. **Lỗi Trùng lặp hoặc Dữ liệu đầu vào không hợp lệ:**
   - Đăng ký bằng email đã tồn tại -> Trả về lỗi `409 Conflict`.
   - Email sai cấu trúc, mật khẩu ngắn hơn 6 ký tự -> Trả về lỗi `400 Bad Request` kèm mô tả chi tiết trường dữ liệu lỗi.
2. **Yêu cầu gửi OTP quá nhanh (Spam):**
   - Người dùng gửi yêu cầu đăng ký hoặc yêu cầu gửi lại OTP khi chưa hết thời gian rate limit 60 giây (vẫn còn key `otp_limit:<email>` hoặc `reset_otp_limit:<email>` trên Redis) -> Trả về lỗi `429 Too Many Requests`.
3. **Mã OTP sai hoặc hết hạn:**
   - Nhập sai mã OTP hoặc OTP đã hết hạn sau 5 phút (Redis key đã bị xóa hoặc tự hủy do TTL) -> Trả về lỗi `401 Unauthorized`.
4. **Tài khoản chưa kích hoạt cố gắng đăng nhập:**
   - Nhập đúng mật khẩu nhưng tài khoản có trạng thái `pending` trong DB -> Trả về lỗi `403 Forbidden` kèm yêu cầu thực hiện kích hoạt OTP trước.
5. **Token hết hạn, sai chữ ký số hoặc bị sửa đổi:**
   - Access Token hết hạn -> Trả về lỗi `401 Unauthorized`.
   - Access Token mang chữ ký giả mạo -> Trả về lỗi `401 Unauthorized`.
6. **Xâm nhập và tái sử dụng Refresh Token cũ (Token Reuse):**
   - Kẻ tấn công đánh cắp được Refresh Token cũ đã sử dụng và thực hiện yêu cầu POST `/auth/refresh` -> Hệ thống so khớp thấy hash không khớp hash hiện tại trên Redis -> Hệ thống lập tức xóa key `refresh_token:<userId>` để thu hồi mọi phiên hoạt động, trả về lỗi `401 Unauthorized` buộc tài khoản phải xác thực lại.
7. **Redis bị sập hoặc mất kết nối:**
   - Ứng dụng SHALL tự động lưu trữ tạm thời Refresh Token / OTP trong bộ nhớ đệm (in-memory cache) của máy chủ với TTL tương ứng để duy trì hoạt động xác thực tối thiểu cho đến khi kết nối Redis được khôi phục.

---

## Ràng buộc
- **Bắt buộc băm mật khẩu:** Mật khẩu người dùng tuyệt đối không được lưu ở dạng văn bản thô. Bắt buộc sử dụng `bcrypt` với 10 vòng lặp salt (salt rounds = 10).
- **Băm Refresh Token trên Redis:** Để tránh việc lộ lọt toàn bộ Refresh Token khi cơ sở dữ liệu Redis bị tấn công, Refresh Token MUST được băm bằng SHA-256 trước khi lưu vào Redis.
- **Xoay vòng Token bắt buộc (RTR):** Cặp Refresh Token cũ MUST bị vô hiệu hóa ngay khi sinh ra Refresh Token mới. Chỉ tồn tại duy nhất một Refresh Token hoạt động tại một thời điểm cho một tài khoản.
- **OTP chỉ dùng một lần (Single Use):** Mã OTP kích hoạt và OTP quên mật khẩu MUST bị xóa khỏi Redis ngay sau khi xác thực thành công.
- **Bảo mật JWT Payload:** Payload của Access Token tuyệt đối không được chứa mật khẩu băm, mã OTP hay các thông tin cá nhân nhạy cảm khác ngoài `id`, `email`, và `role`.

---

## Tiêu chí chấp nhận
- Tạo tài khoản thành công ở trạng thái `pending` và đẩy chính xác tác vụ gửi OTP dạng JSON vào hàng đợi RabbitMQ `notification.email.otp`.
- Trạng thái người dùng chuyển thành `active` sau khi xác thực OTP chính xác.
- Đăng nhập thành công trả về cặp token hợp lệ và ghi nhận mã băm của Refresh Token trên Redis với TTL đúng 7 ngày.
- Cơ chế xoay vòng Refresh Token hoạt động chính xác; phát hiện và xóa sạch session của người dùng trên Redis khi có yêu cầu làm mới bằng token cũ.
- Thực hiện đổi mật khẩu thành công sẽ xóa sạch toàn bộ Refresh Token của người dùng trên Redis, buộc tất cả thiết bị đăng nhập trước đó phải thực hiện xác thực lại.
- Phân quyền RBAC hoạt động chính xác trên toàn bộ hệ thống API; từ chối người dùng không đủ quyền hạn bằng lỗi `403 Forbidden`.
