# notification Specification

## Purpose
Tính năng này cung cấp giải pháp đẩy thông báo trong ứng dụng (In-app Notification) thời gian thực tới người dùng đang trực tuyến (online) thông qua giao thức WebSockets (Socket.io). Đồng thời, cung cấp hệ thống REST API giúp người dùng quản lý danh sách thông báo (phân trang) và cập nhật trạng thái đã đọc. Hệ thống cũng tích hợp một tiến trình dọn dẹp tự động chạy ngầm (Cron Job) định kỳ hàng ngày để xóa sạch các thông báo cũ đã đọc quá 30 ngày nhằm tối ưu dung lượng lưu trữ của cơ sở dữ liệu.

## Requirements

### Requirement: Xác thực và Kết nối WebSockets (Hỗ trợ Đa thực thể)
Hệ thống SHALL xác thực kết nối WebSockets của người dùng sử dụng JWT Access Token thông qua Nginx Load Balancer và duy trì phòng kết nối theo room `user:${userId}` để hỗ trợ đồng bộ chéo thiết bị và đa instances.

*Luồng chính:*
1. Client thiết lập kết nối WebSocket tới server Socket.io thông qua Nginx Load Balancer.
2. Client đính kèm JWT Access Token thông qua handshake auth object.
3. API Gateway chạy Middleware xác thực token.
   - Nếu token không hợp lệ hoặc thiếu: Server từ chối kết nối và trả về lỗi kết nối xác thực.
   - Nếu token hợp lệ: Gán `userId` từ token payload vào socket instance, cho phép kết nối thành công và đưa socket đó gia nhập vào Room có tên là `user:${userId}`.

#### Scenario: Kết nối thành công với token hợp lệ
- **WHEN** Người dùng gửi yêu cầu kết nối WebSocket đính kèm JWT Token hợp lệ
- **THEN** Hệ thống chấp nhận kết nối, xác thực thành công và đưa socket kết nối gia nhập vào room định danh `user:${userId}`

#### Scenario: Từ chối kết nối khi thiếu hoặc sai token
- **WHEN** Người dùng gửi yêu cầu kết nối WebSocket nhưng thiếu token hoặc token không hợp lệ
- **THEN** Hệ thống từ chối kết nối và trả về lỗi kết nối `connect_error`

#### Scenario: Client bị mất mạng đột ngột (Disconnect)
- **WHEN** Thiết bị client bị mất kết nối mạng đột ngột khiến socket bị đóng
- **THEN** Server tự động phát hiện sự kiện ngắt kết nối qua heartbeat, dọn dẹp kết nối khỏi Room, và client Socket.io tự động thử kết nối lại khi có mạng, sau đó gọi REST API `GET /api/v1/notifications` để đồng bộ lại các thông báo bị bỏ lỡ

---

### Requirement: Sinh thông báo và Đẩy sự kiện Real-time qua Redis Adapter/Emitter
Hệ thống SHALL lưu thông báo vào cơ sở dữ liệu PostgreSQL và tự động đẩy sự kiện thời gian thực tới room `user:${userId}` sử dụng Redis Emitter và Socket.io Redis Adapter để đồng bộ kết nối chéo instances.

*Luồng chính:*
1. Hệ thống phát sinh một sự kiện sinh thông báo.
2. Service nghiệp vụ gọi `NotificationService.createNotification(userId, data)`.
3. Hệ thống lưu bản ghi thông báo vào bảng `notification_logs` trong cơ sở dữ liệu PostgreSQL.
4. Nếu kênh nhận là `in_app` (`channel = 'in_app'`), API hoặc Worker sử dụng Redis Emitter để đẩy sự kiện tới phòng `user:${userId}`.
5. Socket.io Redis Adapter trên các API instances tự động nhận diện và chuyển tiếp tới client nếu online, ngược lại lưu trạng thái `unread` trên DB để đọc sau.

#### Scenario: Đẩy thông báo thời gian thực thành công trên môi trường đa instances
- **WHEN** Một tác vụ nền (Worker) hoặc API instance B tạo thông báo mới cho người dùng đang online kết nối tại API instance A
- **THEN** Server gửi sự kiện `notification_received` chứa thông tin chi tiết thông báo tới room `user:${userId}` của client thông qua cơ chế đồng bộ Redis Adapter trong vòng dưới 1 giây

#### Scenario: Lưu thông báo khi người dùng offline
- **WHEN** Hệ thống tạo thông báo mới có kênh nhận là `in_app` nhưng người dùng đang offline
- **THEN** Bản ghi được ghi nhận vào DB với trạng thái `unread` và `readAt = null` mà không phát sinh lỗi

---

### Requirement: Quản lý thông báo qua REST API
Hệ thống SHALL cung cấp các API REST để xem danh sách thông báo phân trang và cập nhật trạng thái đã đọc của người dùng, đảm bảo kiểm tra quyền sở hữu (IDOR prevention) và tính nhất quán của dữ liệu.

*Luồng chính:*
1. Xem danh sách phân trang (`GET /api/v1/notifications`).
2. Đánh dấu một thông báo đã đọc (`PATCH /api/v1/notifications/:id/read`).
3. Đánh dấu tất cả thông báo đã đọc (`PATCH /api/v1/notifications/read-all`).

#### Scenario: Lấy danh sách thông báo thành công
- **WHEN** Người dùng gửi yêu cầu lấy danh sách thông báo thông qua API `GET /api/v1/notifications`
- **THEN** Hệ thống trả về danh sách thông báo phân trang tương ứng với quyền sở hữu của người dùng đó (sắp xếp mới nhất lên đầu)

#### Scenario: Đánh dấu đã đọc thành công
- **WHEN** Người dùng gửi yêu cầu đánh dấu một hoặc tất cả thông báo đã đọc qua API
- **THEN** Hệ thống cập nhật trạng thái các thông báo tương ứng thành `read` và lưu thời gian `readAt` tương ứng trên DB

#### Scenario: Từ chối cập nhật khi thông báo không tồn tại hoặc không thuộc quyền sở hữu
- **WHEN** Người dùng gửi yêu cầu `PATCH /api/v1/notifications/:id/read` với ID không tồn tại hoặc của người dùng khác
- **THEN** Hệ thống kiểm tra quyền sở hữu và trả về mã lỗi `404 Not Found`

---

### Requirement: Tự động dọn dẹp định kỳ (Cron Job + Batching + Khóa phân tán Cluster)
Hệ thống SHALL tự động dọn dẹp các thông báo in-app cũ đã đọc quá 30 ngày định kỳ hàng ngày bằng Cron Job chạy nền, sử dụng khóa phân tán trên Redis với Hash Tags để đảm bảo an toàn tranh chấp dữ liệu và tránh nghẽn luồng DB.

*Luồng chính:*
1. Đúng 2:00 AM hàng ngày, Worker Node (vai trò `worker:background`) kích hoạt Cron Job dọn dẹp dữ liệu.
2. Tiến trình cố gắng giành lấy khóa phân tán (Distributed Lock) `{notification-cleanup}:lock` trên Redis với TTL 60s.
3. Nếu lấy được khóa thành công, thực hiện câu lệnh xóa tối đa 5,000 bản ghi thỏa mãn điều kiện `status = 'read'` và `read_at < 30 ngày trước`, nghỉ cooldown 200ms giữa các lô. Giải phóng khóa khi kết thúc.

#### Scenario: Dọn dẹp thành công khi giành được khóa
- **WHEN** Cron Job dọn dẹp kích hoạt lúc 2:00 AM và giành được khóa `{notification-cleanup}:lock` trên Redis
- **THEN** Tiến trình thực hiện xóa dữ liệu thông báo đã đọc quá 30 ngày theo từng lô và giải phóng khóa khi hoàn tất

#### Scenario: Bỏ qua xử lý khi không giành được khóa phân tán (Xung đột khóa)
- **WHEN** Có nhiều Worker instances cùng kích hoạt Cron Job lúc 2:00 AM và instance hiện tại không giành được khóa `{notification-cleanup}:lock`
- **THEN** Hệ thống lập tức dừng thực thi luồng xử lý và ghi log bỏ qua để bảo vệ dữ liệu khỏi race condition

#### Scenario: Tiếp tục giải phóng khóa khi tiến trình dọn dẹp gặp lỗi
- **WHEN** Tiến trình dọn dẹp đang thực thi gặp lỗi kết nối DB hoặc I/O tạm thời
- **THEN** Hệ thống bắt lỗi, ghi log và giải phóng khóa phân tán `{notification-cleanup}:lock` ở khối `finally` để tránh treo khóa
