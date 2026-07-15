# api-rate-limiting Specification

## Purpose
TBD - created by archiving change implement-two-tiered-rate-limiting. Update Purpose after archive.
## Requirements
### Requirement: Giới hạn tần suất IP toàn cầu tại Nginx Gateway
Nginx API Gateway PHẢI giới hạn các yêu cầu gửi đến dựa trên địa chỉ IP của client để ngăn ngừa tấn công DDoS và spam request.
- Hạn mức PHẢI là 50 yêu cầu trên mỗi giây cho mỗi địa chỉ IP.
- Vùng đệm burst tối đa 30 yêu cầu PHẢI được chấp thuận.
- Việc từ chối các yêu cầu vượt ngưỡng giới hạn PHẢI được thực hiện ngay lập tức (nodelay).
- Các yêu cầu vượt quá giới hạn PHẢI bị từ chối với Mã trạng thái HTTP `429 Too Many Requests`.
- Phản hồi PHẢI chứa header `X-RateLimit-Source: gateway`.
- Thân phản hồi PHẢI là một JSON payload dạng: `{"statusCode":429,"message":"Too many requests. Please slow down."}`.

#### Scenario: Tốc độ yêu cầu trong ngưỡng giới hạn tại gateway
- **WHEN** client gửi 40 yêu cầu trong vòng 1 giây từ một địa chỉ IP duy nhất
- **THEN** Nginx chuyển tiếp (proxy-pass) thành công toàn bộ 40 yêu cầu này sang máy chủ ứng dụng NestJS

#### Scenario: Tốc độ yêu cầu vượt ngưỡng giới hạn và vùng đệm burst tại gateway
- **WHEN** client gửi 90 yêu cầu trong vòng 1 giây từ một địa chỉ IP duy nhất
- **THEN** Nginx từ chối các yêu cầu vượt quá hạn mức 50 req/s + 30 burst bằng mã lỗi HTTP 429, trả về header `X-RateLimit-Source: gateway` và trả về payload lỗi định dạng JSON

### Requirement: Rate Limiting theo User ID cho Booking (Đặt vé)
Ứng dụng NestJS PHẢI giới hạn tần suất tạo đơn đặt vé của mỗi người dùng sử dụng bộ lưu trữ Redis chia sẻ để ngăn chặn hành vi đầu cơ vé và spam giao dịch.
- Hạn mức PHẢI là 10 yêu cầu trong vòng 1 phút cho mỗi User ID đã xác thực.
- Bộ giới hạn tần suất PHẢI sử dụng Redis làm tầng lưu trữ tập trung.
- Khi vượt quá giới hạn, yêu cầu PHẢI bị từ chối với Mã trạng thái HTTP `429 Too Many Requests`.
- Phản hồi PHẢI chứa header `X-RateLimit-Source: app-user`.

#### Scenario: Các yêu cầu đặt vé của người dùng nằm trong hạn mức
- **WHEN** một người dùng đã xác thực gửi 8 yêu cầu `POST /bookings` trong vòng 1 phút
- **THEN** hệ thống xử lý các yêu cầu đặt vé này và tiến hành giữ chỗ vé bất đồng bộ thành công

#### Scenario: Các yêu cầu đặt vé của người dùng vượt quá hạn mức
- **WHEN** một người dùng đã xác thực gửi 11 yêu cầu `POST /bookings` trong vòng 1 phút
- **THEN** yêu cầu thứ 11 sẽ bị từ chối với mã lỗi HTTP 429, trả về header `X-RateLimit-Source: app-user` và đơn đặt vé không được khởi tạo

### Requirement: Rate Limiting theo User ID cho Payment (Thanh toán)
Ứng dụng NestJS PHẢI giới hạn tần suất khởi tạo thanh toán của mỗi người dùng sử dụng bộ lưu trữ Redis chia sẻ để tránh hành vi gửi lặp yêu cầu thanh toán.
- Hạn mức PHẢI là 3 yêu cầu trong vòng 1 phút cho mỗi User ID đã xác thực đối với các endpoint thanh toán (`POST /payments/momo` và `POST /payments/vnpay`).
- Bộ giới hạn tần suất PHẢI sử dụng Redis làm tầng lưu trữ tập trung.
- Khi vượt quá giới hạn, yêu cầu PHẢI bị từ chối với Mã trạng thái HTTP `429 Too Many Requests`.
- Phản hồi PHẢI chứa header `X-RateLimit-Source: app-user`.

#### Scenario: Các yêu cầu thanh toán của người dùng vượt quá hạn mức
- **WHEN** một người dùng đã xác thực gửi 4 yêu cầu `POST /payments/momo` trong vòng 1 phút
- **THEN** yêu cầu thứ 4 sẽ bị từ chối với mã lỗi HTTP 429 và trả về header `X-RateLimit-Source: app-user`

### Requirement: Phòng chống vắt kiệt CPU khi xác thực thất bại liên tục (Failed Authentication IP Block)
Ứng dụng NestJS PHẢI chặn truy cập theo địa chỉ IP của client nếu IP đó liên tục gửi các yêu cầu xác thực không hợp lệ (token giả, token sai chữ ký, hết hạn) để bảo vệ tài nguyên CPU của máy chủ khỏi các tác vụ giải mã chữ ký mật mã.
- Hệ thống PHẢI đếm số lần xác thực thất bại của mỗi địa chỉ IP (sử dụng Redis key `auth_fail_count:<ip>`).
- Nếu số lần thất bại đạt >= 5 lần trong vòng 60 giây, hệ thống PHẢI khóa IP đó tạm thời trong 15 phút (900 giây, sử dụng Redis key `auth_blocked:<ip>`).
- Mọi yêu cầu tiếp theo từ một IP đang bị khóa đi vào các endpoint yêu cầu xác thực PHẢI bị chặn ngay lập tức mà không chạy giải mã/xác thực mật mã JWT.
- Khi bị chặn, yêu cầu PHẢI bị từ chối với Mã trạng thái HTTP `429 Too Many Requests`.
- Phản hồi PHẢI chứa header `X-RateLimit-Source: failed-auth-ip`.

#### Scenario: Khóa địa chỉ IP của kẻ tấn công gửi token giả liên tiếp
- **WHEN** client gửi 5 yêu cầu liên tiếp mang token giả (`Authorization: Bearer fake_token_xyz`) từ địa chỉ IP `1.2.3.4` trong vòng 10 giây
- **THEN** hệ thống từ chối cả 5 yêu cầu này với mã lỗi HTTP 401 do xác thực thất bại, đồng thời ghi nhận khóa IP `1.2.3.4` trong 15 phút sau yêu cầu thứ 5
- **AND WHEN** client gửi yêu cầu thứ 6 từ IP `1.2.3.4` ngay sau đó
- **THEN** hệ thống từ chối yêu cầu thứ 6 này bằng mã lỗi HTTP 429 và trả về header `X-RateLimit-Source: failed-auth-ip` mà không chạy xác thực JWT signature.

