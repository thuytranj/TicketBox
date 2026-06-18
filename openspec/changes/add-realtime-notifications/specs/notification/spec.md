## MODIFIED Requirements

### Requirement: In-app Notification với trạng thái đã đọc
Hệ thống SHALL lưu trữ tất cả in-app notification trong bảng `notification_logs`, cho phép khán giả xem danh sách thông báo (phân trang) qua REST API, đánh dấu đã đọc một hoặc tất cả thông báo, và nhận thông báo theo thời gian thực qua WebSockets khi có thông báo mới phát sinh.

#### Scenario: Khán giả xem danh sách thông báo in-app
- **WHEN** Khán giả truy cập danh sách thông báo qua API GET `/notifications` với tham số phân trang
- **THEN** Hệ thống trả về danh sách phân trang các thông báo từ bảng `notification_logs` có `channel=in_app` và `user_id` tương ứng, sắp xếp theo `created_at` giảm dần

#### Scenario: Khán giả đánh dấu thông báo đã đọc
- **WHEN** Khán giả gửi yêu cầu PATCH `/notifications/:id/read` với ID thông báo tương ứng chưa đọc
- **THEN** Hệ thống cập nhật trường `read_at` của bản ghi `notification_logs` tương ứng với timestamp hiện tại và trả về HTTP 200 OK

#### Scenario: Khán giả đánh dấu tất cả thông báo đã đọc
- **WHEN** Khán giả gửi yêu cầu PATCH `/notifications/read-all`
- **THEN** Hệ thống cập nhật trường `read_at` cho tất cả thông báo chưa đọc có `user_id` tương ứng và trả về HTTP 200 OK

#### Scenario: Nhận thông báo thời gian thực qua WebSockets
- **WHEN** Hệ thống ghi một bản ghi thông báo mới vào bảng `notification_logs` và người dùng nhận tương ứng đang duy trì kết nối WebSocket hợp lệ
- **THEN** Hệ thống thực hiện đẩy (emit) sự kiện `notification_received` chứa thông tin chi tiết thông báo đó tới client của người dùng theo thời gian thực
