# notification Specification

## Purpose
TBD - created by archiving change blueprint. Update Purpose after archive.
## Requirements
### Requirement: Gửi thông báo xác nhận mua vé thành công
Hệ thống SHALL gửi thông báo xác nhận qua cả hai kênh (in-app notification và email) ngay sau khi đơn hàng đặt vé được xác nhận thanh toán thành công. Email PHẢI chứa e-ticket với mã QR code ký số (HMAC-SHA256) nhúng inline dưới dạng ảnh PNG.

#### Scenario: Gửi thông báo xác nhận thành công qua cả hai kênh
- **WHEN** Hệ thống nhận webhook xác nhận thanh toán thành công từ cổng VNPAY/MoMo và cập nhật booking sang trạng thái `paid`
- **THEN** Hệ thống publish 1 message vào RabbitMQ Topic Exchange với routing key `notification.booking.confirmed`, In-app Worker lưu bản ghi thông báo vào bảng `notification_logs` (channel=in_app, status=sent) và Email Worker sinh QR code ký số, nhúng inline PNG vào email và gửi qua Nodemailer/Mailtrap SMTP

#### Scenario: Email gửi thất bại nhưng không ảnh hưởng luồng chính
- **WHEN** Quá trình gửi email gặp lỗi SMTP (timeout, connection refused)
- **THEN** Hệ thống ghi bản ghi `notification_logs` với status=failed cho kênh email, in-app notification vẫn được gửi bình thường, và luồng đặt vé/thanh toán chính không bị ảnh hưởng

### Requirement: Gửi nhắc nhở concert trước 24 giờ
Hệ thống SHALL tự động gửi thông báo nhắc nhở đến tất cả khán giả có vé đã thanh toán (status=paid) khi concert sắp diễn ra trong vòng 24 giờ tới. Mỗi concert chỉ gửi nhắc nhở đúng 1 lần.

#### Scenario: Cron Job quét và gửi nhắc nhở thành công
- **WHEN** Cron Job chạy định kỳ (mỗi 5 phút) phát hiện concert có `start_time` nằm trong khoảng 24 giờ tới và chưa gửi nhắc nhở (`reminder_sent = false`)
- **THEN** Hệ thống lấy danh sách user có vé trạng thái `paid`, publish message với routing key `notification.concert.reminder`, cả In-app Worker và Email Worker tiêu thụ message để gửi thông báo nhắc nhở, sau đó cập nhật `reminder_sent = true` trong bảng concerts

#### Scenario: Không gửi lại nhắc nhở cho concert đã gửi
- **WHEN** Cron Job quét lại concert đã có `reminder_sent = true`
- **THEN** Hệ thống bỏ qua concert này, không gửi lại nhắc nhở dù start_time vẫn nằm trong khoảng 24 giờ tới

### Requirement: Kiến trúc mở rộng kênh thông báo
Hệ thống SHALL sử dụng kiến trúc RabbitMQ Topic Exchange cho phép bổ sung kênh thông báo mới (ví dụ: SMS, Zalo OA) mà không cần sửa đổi code phía publisher. Mỗi kênh là một queue riêng bind vào exchange.

#### Scenario: Bổ sung kênh thông báo mới mà không sửa publisher
- **WHEN** Cần thêm kênh thông báo SMS vào hệ thống
- **THEN** Chỉ cần tạo thêm 1 queue mới (`notification.sms.queue`) bind vào `notification.exchange` và viết 1 worker tiêu thụ message từ queue đó, code publisher không cần thay đổi

### Requirement: In-app Notification với trạng thái đã đọc
Hệ thống SHALL lưu trữ tất cả in-app notification trong bảng `notification_logs` và cho phép khán giả xem danh sách thông báo, đánh dấu đã đọc.

#### Scenario: Khán giả xem danh sách thông báo in-app
- **WHEN** Khán giả truy cập danh sách thông báo trên ứng dụng
- **THEN** Hệ thống trả về danh sách bản ghi từ bảng `notification_logs` có `channel=in_app` và `user_id` tương ứng, sắp xếp theo `created_at` giảm dần

#### Scenario: Khán giả đánh dấu thông báo đã đọc
- **WHEN** Khán giả mở hoặc bấm vào một thông báo chưa đọc (read_at = null)
- **THEN** Hệ thống cập nhật trường `read_at` của bản ghi `notification_logs` tương ứng với timestamp hiện tại

### Requirement: QR Code ký số bảo mật cho e-ticket
Hệ thống SHALL ký số nội dung QR code bằng HMAC-SHA256 với server secret key để đảm bảo tính toàn vẹn và chống giả mạo vé.

#### Scenario: Sinh QR code có chữ ký số khi thanh toán thành công
- **WHEN** Đơn hàng đặt vé chuyển sang trạng thái `paid`
- **THEN** Hệ thống tạo payload chứa (ticket_id, booking_id, ticket_type, issued_at), tính HMAC-SHA256 signature bằng SERVER_SECRET, mã hóa base64url toàn bộ payload + signature làm nội dung QR, sinh ảnh QR PNG và lưu hash vào trường `qr_code_hash` của bảng tickets

