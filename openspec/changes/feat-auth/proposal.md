## Why

Để bảo vệ các tài nguyên và API của TicketBox, hệ thống cần cơ chế xác thực và phân quyền (RBAC) giúp xác định danh tính và vai trò người dùng (khán giả, ban tổ chức, nhân viên soát vé). Việc này làm nền tảng cho việc quản lý các đơn đặt vé, thống kê sự kiện, soát vé trực tuyến và ngoại tuyến một cách an toàn.

## What Changes

- Bổ sung bảng `users` trong cơ sở dữ liệu với khóa chính dạng UUID v7.
- Cung cấp các API đăng ký (`POST /auth/register`), đăng nhập (`POST /auth/login`), làm mới token (`POST /auth/refresh`), đăng xuất (`POST /auth/logout`) và xem thông tin cá nhân (`GET /auth/me`).
- Triển khai Access Token (hạn ngắn) kết hợp Refresh Token (hạn dài, được lưu và xoay vòng trên Redis).
- Triển khai JWT-based authentication và RolesGuard để kiểm soát truy cập phân quyền dựa trên vai trò (audience, organizer, gate_staff) cho toàn bộ API endpoints.
- Cập nhật thư viện bảo mật và cấu hình môi trường bảo mật (`JWT_SECRET`, `JWT_REFRESH_SECRET`).

## Capabilities

### New Capabilities

### Modified Capabilities
- `auth`: Cập nhật chi tiết các kịch bản đăng ký, đăng nhập, làm mới token, đăng xuất và chặn truy cập trái phép bằng RolesGuard.

## Impact

- **Database:** Bảng `users` mới được liên kết làm khóa ngoại cho các bảng `bookings`, `checkin_logs` và `notification_logs`.
- **Cache:** Sử dụng Redis để lưu trữ và quản lý trạng thái/vòng đời của các Refresh Token đang hoạt động nhằm hỗ trợ thu hồi token lập tức khi người dùng đăng xuất.
- **API:** Thêm controller và service mới cho module `/auth` hỗ trợ cơ chế cấp mới và làm mới token.
- **Dependencies:** Cài đặt các thư viện `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt` và các file `@types` liên quan.
