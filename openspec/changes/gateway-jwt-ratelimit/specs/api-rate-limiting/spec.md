## MODIFIED Requirements

### Requirement: Rate Limiting theo User ID cho Booking (Đặt vé)
Nginx Gateway (OpenResty) PHẢI giải mã JWT và giới hạn tần suất tạo đơn đặt vé của mỗi người dùng sử dụng bộ lưu trữ Redis để lọc tải sớm và ngăn chặn hành vi đầu cơ vé.
- Hạn mức PHẢI là 10 yêu cầu trong vòng 1 phút cho mỗi User ID đã xác thực.
- Bộ giới hạn tần suất PHẢI sử dụng Redis làm tầng lưu trữ tập trung và thực hiện kiểm tra qua Lua script tại Nginx Gateway (OpenResty).
- Khi vượt quá giới hạn, yêu cầu PHẢI bị từ chối trực tiếp tại Gateway với Mã trạng thái HTTP `429 Too Many Requests` mà không chuyển tiếp đến NestJS.
- Phản hồi PHẢI chứa header `X-RateLimit-Source: gateway-user`.

#### Scenario: Các yêu cầu đặt vé của người dùng nằm trong hạn mức
- **WHEN** một người dùng đã xác thực gửi 8 yêu cầu `POST /api/v1/bookings` trong vòng 1 phút
- **THEN** Nginx Gateway giải mã JWT thành công, trừ kho vé qua Redis và chuyển tiếp thành công các yêu cầu này đến NestJS Backend để xử lý bất đồng bộ

#### Scenario: Các yêu cầu đặt vé của người dùng vượt quá hạn mức
- **WHEN** một người dùng đã xác thực gửi 11 yêu cầu `POST /api/v1/bookings` trong vòng 1 phút
- **THEN** yêu cầu thứ 11 sẽ bị từ chối trực tiếp tại Nginx Gateway với mã lỗi HTTP 429, trả về header `X-RateLimit-Source: gateway-user` và yêu cầu không bao giờ chạm tới NestJS Backend
