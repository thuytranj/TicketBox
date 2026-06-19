## 1. Cấu hình và Cài đặt thư viện

- [x] 1.1 Cài đặt các thư viện `@nestjs/websockets`, `@nestjs/platform-socket.io` và `@types/socket.io` vào backend.
- [x] 1.2 Đăng ký WebSocket adapter trong file bootstrap của ứng dụng nếu cần thiết.

## 2. Xây dựng WebSocket Gateway và Xác thực

- [x] 2.1 Tạo `NotificationGateway` trong `src/backend/src/notification/notification.gateway.ts` kế thừa từ `OnGatewayConnection` và `OnGatewayDisconnect`.
- [x] 2.2 Thực hiện xác thực kết nối bằng JWT Token thông qua handshake query/header; từ chối kết nối nếu token không hợp lệ hoặc hết hạn.
- [x] 2.3 Quản lý danh sách kết nối Socket ID theo `userId` (sử dụng Map) để đảm bảo có thể gửi đích danh tới từng người dùng. Dọn dẹp danh sách khi socket ngắt kết nối.

## 3. Tái cấu trúc và Bổ sung Service

- [x] 3.1 Tạo `NotificationService` trong `src/backend/src/notification/notification.service.ts` quản lý việc lưu và truy vấn bảng `notification_logs`.
- [x] 3.2 Viết hàm `createNotification(userId: string, data: any)` thực hiện lưu vào PostgreSQL và đẩy sự kiện `notification_received` qua `NotificationGateway` nếu user đang online.
- [x] 3.3 Viết các hàm nghiệp vụ: `getUserNotifications(userId: string, page: number, limit: number)` (phân trang), `markAsRead(userId: string, id: number)` và `markAllAsRead(userId: string)`.
- [x] 3.4 Khai báo và export `NotificationService` cùng `NotificationGateway` trong `NotificationModule`.
- [x] 3.5 Cập nhật `AIConsumer` thay vì dùng trực tiếp repository thì gọi qua `NotificationService.createNotification`.

## 4. Xây dựng REST API Endpoints

- [x] 4.1 Tạo `NotificationController` trong `src/backend/src/notification/notification.controller.ts` được bảo vệ bởi `JwtAuthGuard`.
- [x] 4.2 Thiết lập route `GET /notifications` để trả về danh sách thông báo phân trang của user hiện tại.
- [x] 4.3 Thiết lập route `PATCH /notifications/:id/read` để đánh dấu một thông báo cụ thể là đã đọc.
- [x] 4.4 Thiết lập route `PATCH /notifications/read-all` để đánh dấu tất cả thông báo của user là đã đọc.

## 5. Kiểm thử và Xác minh

- [x] 5.1 Tạo các unit test kiểm thử các API mới trong `NotificationController` và logic nghiệp vụ của `NotificationService`.
- [x] 5.2 Kiểm tra kết nối WebSocket thực tế: giả lập kết nối bằng client Socket.io, xác thực bằng JWT hợp lệ và kiểm tra xem có nhận được thông tin push real-time khi có thông báo mới (ví dụ khi chạy AI Bio hoàn thành).

## 6. Tự động dọn dẹp dữ liệu thông báo

- [ ] 6.1 Triển khai Cron Job (`@Cron`) chạy định kỳ lúc 2:00 AM hàng ngày để xóa các thông báo `in_app` đã đọc quá 30 ngày (`status = 'read'` và `read_at < thirtyDaysAgo`) sử dụng cơ chế Batching (chia nhỏ thành các lô 5,000 bản ghi, giãn cách thời gian để tránh lock bảng).
- [ ] 6.2 Tạo database migration để thêm Partial Index trên trường `read_at` với điều kiện `status = 'read'`.
- [ ] 6.3 Tích hợp cơ chế khóa phân tán (Redis Lock) để đảm bảo an toàn khi chạy đa instance.


