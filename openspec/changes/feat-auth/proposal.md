## Why

Để bảo vệ các tài nguyên và API của TicketBox, hệ thống cần cơ chế xác thực và phân quyền (RBAC) giúp xác định danh tính và vai trò người dùng (khán giả, ban tổ chức, nhân viên soát vé). Việc này làm nền tảng cho việc quản lý các đơn đặt vé, thống kê sự kiện, soát vé trực tuyến và ngoại tuyến một cách an toàn.

## What Changes

- Bổ sung bảng `users` trong cơ sở dữ liệu với khóa chính dạng UUID v7 và cột `status` (`pending`, `active`).
- Cung cấp các API đăng ký tài khoản nháp (`POST /auth/register`), đăng nhập (`POST /auth/login`), làm mới token (`POST /auth/refresh`), đăng xuất (`POST /auth/logout`), xác thực OTP (`POST /auth/verify-otp`) và xem thông tin cá nhân (`GET /auth/me`).
- Gửi mã OTP xác thực qua email bất đồng bộ thông qua message broker RabbitMQ và SMTP mock (Mailtrap).
- Lưu trữ và đối khớp mã OTP tạm thời trên bộ nhớ đệm Redis kèm thời hạn sống (TTL 5 phút) và rate limit gửi OTP (60 giây).
- Triển khai Access Token (hạn ngắn) kết hợp Refresh Token (hạn dài, được lưu và xoay vòng trên Redis).
- Triển khai JWT-based authentication và RolesGuard để kiểm soát truy cập phân quyền dựa trên vai trò (audience, organizer, gate_staff) cho toàn bộ API endpoints.
- Cập nhật thư viện bảo mật và cấu hình môi trường bảo mật (`JWT_SECRET`, `JWT_REFRESH_SECRET`).

## Capabilities

### New Capabilities

### Modified Capabilities
- `auth`: Cập nhật chi tiết các kịch bản đăng ký (pending), xác thực OTP kích hoạt tài khoản, đăng nhập, làm mới token, đăng xuất và chặn truy cập trái phép bằng RolesGuard.

## Impact

- **Database:** Bảng `users` mới được liên kết làm khóa ngoại cho các bảng `bookings`, `checkin_logs` và `notification_logs`. Bổ sung cột trạng thái tài khoản.
- **Cache:** Sử dụng Redis để quản lý vòng đời Refresh Token và lưu trữ tạm thời mã OTP xác thực cùng khóa Rate Limiter gửi OTP.
- **RabbitMQ:** Sử dụng RabbitMQ để đẩy task gửi email chứa mã OTP bất đồng bộ tới Worker xử lý gửi mail.
- **API:** Thêm controller và service mới cho module `/auth` hỗ trợ các cơ chế xác thực OTP và quản lý phiên.
- **Dependencies:** Cài đặt các thư viện `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt` và các file `@types` liên quan.
