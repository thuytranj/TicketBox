## Why

Hiện tại, hệ thống thông báo in-app (như thông báo khi AI tạo tiểu sử nghệ sĩ thành công/thất bại) chỉ được ghi trực tiếp vào cơ sở dữ liệu (`notification_logs`). Chưa có cơ chế thời gian thực (real-time) để đẩy thông báo tới client đang hoạt động, đồng thời cũng chưa có các API endpoints để client lấy danh sách và quản lý trạng thái đã đọc của các thông báo. Điều này làm giảm trải nghiệm của người dùng khi phải tải lại trang thủ công để theo dõi tiến trình.

## What Changes

- Tích hợp thư viện Socket.io vào NestJS thông qua các gói `@nestjs/websockets` và `@nestjs/platform-socket.io`.
- Xây dựng một `NotificationGateway` để quản lý các kết nối Socket của người dùng, thực hiện xác thực kết nối bằng JWT.
- Cung cấp các API RESTful phục vụ việc quản lý thông tin thông báo:
  - `GET /notifications`: Lấy danh sách thông báo in-app phân trang của người dùng hiện tại.
  - `PATCH /notifications/:id/read`: Đánh dấu một thông báo cụ thể là đã đọc.
  - `PATCH /notifications/read-all`: Đánh dấu tất cả thông báo in-app chưa đọc của người dùng là đã đọc.
- Cấu hình real-time push: Khi một in-app notification mới được ghi vào database (ở bất kỳ consumer hay service nào), hệ thống sẽ đồng thời gửi sự kiện Socket (`notification_received`) tới client đang kết nối của người dùng đó.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `notification`: Bổ sung cơ chế truyền tải thông báo thời gian thực (WebSocket) và cung cấp các REST API endpoints quản lý trạng thái thông báo (`GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`).

## Impact

- **Backend dependencies**: Thêm `@nestjs/websockets`, `@nestjs/platform-socket.io` và `@types/socket.io` (nếu cần).
- **Backend API**: Thêm route `/notifications` với các phương thức GET và PATCH.
- **WebSocket port/gateway**: Mở cổng Socket.io tích hợp cùng cổng chạy HTTP hoặc cổng riêng biệt được cấu hình qua ENV.
- **Authentication**: JWT auth guard được áp dụng cho cả REST API và WebSocket connection handshake.
