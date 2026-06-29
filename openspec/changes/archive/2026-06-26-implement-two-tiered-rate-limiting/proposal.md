## Tại sao cần thay đổi (Why)

Cơ chế rate limiting hiện tại của API chỉ triển khai một bộ điều tiết đơn giản, lưu trong bộ nhớ (in-memory throttler) ở tầng NestJS và kiểm soát theo địa chỉ IP. Cách tiếp cận này có các lỗ hổng bảo mật và khả năng mở rộng nghiêm trọng:
1. **Không có lớp bảo vệ tại Gateway (Edge)**: Các cuộc tấn công DDoS hoặc bot tự động có thể đi qua Nginx và trực tiếp chạm tới ứng dụng NestJS, tiêu thụ tài nguyên Event Loop và kết nối cơ sở dữ liệu trước khi bị chặn.
2. **Lỗ hổng đầu cơ vé (VPN/IP Hopping)**: Kẻ đầu cơ vé có thể dễ dàng vượt qua giới hạn rate limit theo IP bằng cách sử dụng proxy xoay vòng hoặc VPN trong khi vẫn giữ nguyên tài khoản đăng nhập.
3. **Không đồng bộ trạng thái phân tán**: Khi ứng dụng mở rộng lên nhiều thực thể (API replicas), mỗi node tự duy trì bộ đếm in-memory riêng, cho phép kẻ tấn công nhân số lượng yêu cầu lên gấp nhiều lần.

Việc triển khai kiến trúc Rate Limiting 2 lớp (Two-Tiered Rate Limiting) sẽ giải quyết triệt để các lỗ hổng này và bảo vệ các dịch vụ cốt lõi như đặt vé (booking) và thanh toán (payment) trong suốt thời gian mở bán vé có lượng truy cập lớn.

## Các thay đổi chính (What Changes)

1. **Lớp 1 (API Gateway - Nginx)**:
   - Cấu hình Nginx sử dụng chỉ thị `limit_req_zone` và `limit_req`.
   - Giới hạn tần suất chung ở mức 50 yêu cầu/giây trên mỗi địa chỉ IP, cho phép một vùng đệm burst tối đa 30 yêu cầu.
   - Phản hồi mã lỗi HTTP 429 kèm JSON payload chuẩn và header `X-RateLimit-Source: gateway` khi vượt quá giới hạn.

2. **Lớp 2 (Tầng ứng dụng - NestJS + Redis)**:
   - Tích hợp Redis làm kho lưu trữ chia sẻ cho NestJS để đồng bộ trạng thái rate limiting trên tất cả API replica.
   - Định nghĩa một custom `RedisRateLimitGuard` để giới hạn tần suất dựa trên ID của người dùng đã đăng nhập (`req.user.userId`) đối với các route yêu cầu xác thực.
   - Áp dụng các cấu hình rate limit nghiệp vụ cụ thể cho các endpoint nhạy cảm:
     - `POST /bookings` (Tạo đơn đặt vé): Giới hạn tối đa 10 yêu cầu / 1 phút trên mỗi User ID.
     - `POST /payments/momo` và `POST /payments/vnpay` (Khởi tạo thanh toán): Giới hạn tối đa 3 yêu cầu / 1 phút trên mỗi User ID.

3. **Lớp 2.5 (Phòng chống vắt kiệt CPU - JwtAuthGuard)**:
   - Triển khai Failed Authentication IP-based Rate Limiter trực tiếp bên trong `JwtAuthGuard`.
   - Nếu một IP address phát sinh >= 5 lỗi xác thực JWT trong vòng 60 giây, IP đó sẽ bị khóa tạm thời trong 15 phút.
   - Các request tiếp theo từ IP bị khóa sẽ bị chặn ngay ở đầu guard (trả về lỗi HTTP 429) mà không chạy bất kỳ tác vụ giải mã/xác thực mật mã JWT nào, giúp bảo vệ tài nguyên CPU tối đa.

## Khả năng (Capabilities)

### Khả năng mới (New Capabilities)
- `api-rate-limiting`: Cơ chế bảo vệ 2 lớp kết hợp giới hạn theo IP tại Nginx Gateway và giới hạn theo User ID trên Redis ở NestJS cho các tác vụ ghi (write operations) nhạy cảm.

### Khả năng sửa đổi (Modified Capabilities)
<!-- Không có -->

## Phạm vi ảnh hưởng (Impact)

- **Cơ sở hạ tầng**: Cấu hình Nginx ([nginx.conf](file:///Users/thuytran/Workspace/TicketBox/nginx.conf)) được cập nhật để khai báo vùng lưu trữ rate limit và chặn lưu lượng vượt quá giới hạn.
- **Ứng dụng Backend**:
  - `app.module.ts`: Đã gỡ bỏ `ThrottlerGuard` toàn cục cũ để tránh xung đột cấu hình Nginx.
  - `JwtAuthGuard`: Được cập nhật logic kiểm tra IP block từ Redis và lưu số lần xác thực sai của client IP để tự động khóa IP khi có dấu hiệu tấn công spam token fake.
  - `RedisRateLimitGuard`: Sử dụng Lua script để quản lý sliding window rate limit theo User ID (hoặc fallback IP).
  - Controllers: Cấu hình `BookingController` và `PaymentController` sử dụng `JwtAuthGuard` và `RedisRateLimitGuard` với hạn mức tương ứng.
