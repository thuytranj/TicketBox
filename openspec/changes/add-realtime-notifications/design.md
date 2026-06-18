## Context

Hiện tại, các thông báo In-app được ghi trực tiếp vào cơ sở dữ liệu (`notification_logs`) nhưng không được đẩy trực tiếp tới client theo thời gian thực. Client cũng chưa có REST API để lấy danh sách thông báo hoặc cập nhật trạng thái đã đọc.

Thiết kế này giới thiệu việc sử dụng NestJS WebSockets kết hợp Socket.io để cung cấp khả năng push real-time và xây dựng Controller để quản lý thông báo thông qua các API RESTful thông thường.

## Goals / Non-Goals

**Goals:**
- Tích hợp WebSocket Gateway (sử dụng Socket.io) vào backend để đẩy thông báo real-time.
- Xác thực kết nối WebSocket bằng JWT Token của người dùng.
- Xây dựng API `/notifications` với các phương thức GET (phân trang), PATCH (đánh dấu đã đọc).
- Cấu hình phát sự kiện WebSocket `notification_received` mỗi khi lưu thành công thông báo In-app mới.

**Non-Goals:**
- Tối ưu hóa tải kết nối cho hàng triệu người dùng đồng thời (hệ thống clustering/Redis adapter cho Socket.io tạm thời nằm ngoài phạm vi này).
- Thiết kế hệ thống thông báo cho các kênh khác như Push Notification (Firebase/APNS), SMS hay Zalo OA.

## Decisions

### 1. Sử dụng Socket.io Gateway tích hợp trong NestJS
- **Lựa chọn**: Sử dụng các thư viện chính thức của NestJS `@nestjs/websockets` và `@nestjs/platform-socket.io`.
- **Lý do**: NestJS cung cấp cơ chế đóng gói Gateway rất tự nhiên, dễ dàng tích hợp Dependency Injection (ví dụ: inject `JwtService` để xác thực, `NotificationGateway` vào các service khác để push sự kiện).
- **Giải pháp thay thế**: Sử dụng thư viện `ws` thuần (không có socket.io). Tuy nhiên, Socket.io cung cấp các tính năng tự động reconnect, heartbeat/ping-pong và quản lý room tốt hơn.

### 2. Xác thực WebSockets qua Handshake Query/Headers
- **Lựa chọn**: Client truyền JWT token qua handshake query parameter `token` hoặc `Authorization` header khi khởi tạo kết nối WebSocket. Gateway sẽ giải mã và gán thông tin user vào socket instance.
- **Lý do**: Đây là cơ chế bảo mật tiêu chuẩn giúp ngăn chặn các kết nối nặc danh trước khi thiết lập kênh truyền thông tin nhạy cảm.

### 3. Tái cấu trúc logic lưu thông báo qua NotificationService
- **Lựa chọn**: Tạo `NotificationService` mới để bọc Repository của `NotificationLog`. Các consumer (như `AIConsumer`) thay vì gọi trực tiếp Repository sẽ gọi qua `NotificationService.create(...)`.
- **Lý do**: Đảm bảo tính đóng gói (encapsulation). Mỗi khi tạo thông báo mới, `NotificationService` sẽ vừa lưu DB vừa gọi `NotificationGateway` để push real-time trong một hàm duy nhất.

## Risks / Trade-offs

- **[Risk] Kết nối WebSocket bị đứt quãng** → **[Mitigation]** Socket.io tự động reconnect ở client. Khi kết nối lại, client nên gọi API `GET /notifications` để kéo các thông báo bị lỡ trong thời gian ngắt kết nối.
- **[Risk] Lỗi rò rỉ bộ nhớ (Memory Leak) do map client connection** → **[Mitigation]** Sử dụng `Map<string, string[]>` để lưu danh sách socket ID theo `userId`. Khi client ngắt kết nối (`disconnect`), bắt buộc phải dọn dẹp các socket ID đó khỏi Map.
