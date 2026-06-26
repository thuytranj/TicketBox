## 1. Thiết lập Lớp 1: Nginx Rate Limiting

- [x] 1.1 Khai báo vùng rate limit của Nginx `limit_req_zone` trong ngữ cảnh http của file `nginx.conf`, theo dõi IP từ xa ở mức 50r/s.
- [x] 1.2 Áp dụng `limit_req zone=global burst=30 nodelay;` vào block location proxy trong `nginx.conf`.
- [x] 1.3 Cấu hình chuyển hướng trang lỗi tùy chỉnh cho mã trạng thái 429 trong Nginx (`error_page 429 = @rate_limit_exceeded;`).
- [x] 1.4 Triển khai block location `@rate_limit_exceeded` trong `nginx.conf` để trả về header tùy chỉnh `X-RateLimit-Source "gateway"` và payload lỗi JSON.

## 2. Thiết lập Lớp 2: NestJS Custom Redis Sliding Window Guard

- [x] 2.1 Tạo tập lệnh Lua script thực hiện thuật toán Sliding Window Rate Limiting (`sliding-window-rate-limit.lua`), sử dụng `redis.call('time')` để lấy thời gian đồng nhất từ Redis Server.
- [x] 2.2 Đăng ký và tải tập lệnh Lua script này trong một service (hoặc trực tiếp bên trong `RedisService`) để có thể gọi thực thi một cách nguyên tử.
- [x] 2.3 Tạo file `RedisRateLimitGuard` trong thư mục chứa các guard dùng chung (`common/guards`).
- [x] 2.4 Triển khai logic trong `RedisRateLimitGuard` để trích xuất `userId` từ request đã xác thực (`req.user.userId`).
- [x] 2.5 Triển khai logic trong guard để gọi Lua script thông qua `RedisService` với định dạng key: `rate_limit:{userId}:{endpointName}`.
- [x] 2.6 Triển khai cơ chế chịu lỗi **Fail-Open** (bọc trong khối try-catch) và xử lý exception tùy chỉnh để trả về mã lỗi HTTP 429, header `X-RateLimit-Source: app-user`, và một thông điệp lỗi JSON tiêu chuẩn khi vượt ngưỡng rate limit.
- [x] 2.7 Định nghĩa một decorator tùy chỉnh `@UseRedisRateLimit(limit, ttl_ms)` hoặc tận dụng các decorator metadata của NestJS để chỉ định hạn mức cụ thể của từng endpoint cho guard.
- [x] 2.8 Cấu hình `app.getHttpAdapter().getInstance().set('trust proxy', true)` trong file `main.ts` để đọc đúng địa chỉ IP Client khi chạy sau proxy Nginx.

## 3. Gắn Decorator lên các Endpoint và Tái cấu trúc Throttler cũ

- [x] 3.1 Áp dụng custom `RedisRateLimitGuard` và cấu hình hạn mức 10 yêu cầu / 60000ms cho endpoint `POST /bookings` trong file `booking.controller.ts`.
- [x] 3.2 Áp dụng custom `RedisRateLimitGuard` và cấu hình hạn mức 3 yêu cầu / 60000ms cho các endpoint khởi tạo thanh toán trong file `payment.controller.ts`.
- [x] 3.3 Gỡ bỏ hoặc vô hiệu hóa decorator cũ `@Throttle` và các import/binding liên quan tới `ThrottlerGuard` mặc định cho các endpoint cụ thể này.

## 4. Xác minh và Kiểm thử

- [x] 4.1 Xác minh cơ chế rate limiting của Nginx dưới tải cao, đảm bảo trả về HTTP status 429 và header `X-RateLimit-Source: gateway`.
- [x] 4.2 Chạy các test case tích hợp (integration) hoặc E2E mô phỏng gửi liên tục 11 yêu cầu đặt vé trong vòng 1 phút từ cùng một tài khoản người dùng, xác minh yêu cầu thứ 11 thất bại với mã lỗi HTTP 429 và header `X-RateLimit-Source: app-user`.
- [x] 4.3 Xác minh các endpoint thanh toán thất bại với mã lỗi HTTP 429 và header chính xác ở yêu cầu thứ 4 trong vòng 1 phút từ cùng một tài khoản.
- [x] 4.4 Thực hiện kiểm thử rủi ro bằng cách tắt tạm thời Redis container và xác minh luồng đăng ký vé vẫn hoạt động bình thường nhờ cơ chế Fail-Open.

## 5. Phòng chống vắt kiệt CPU (Failed Authentication IP Block)

- [ ] 5.1 Cập nhật `JwtAuthGuard` để kiểm tra trạng thái khóa của IP client trước khi chạy xác thực JWT (`auth_blocked:<ip>`).
- [ ] 5.2 Triển khai logic ghi nhận lỗi xác thực trong `JwtAuthGuard`, tăng bộ đếm lỗi `auth_fail_count:<ip>` trong 60 giây khi JWT auth thất bại.
- [ ] 5.3 Nếu bộ đếm lỗi đạt 5 lần, tạo key khóa IP `auth_blocked:<ip>` với TTL 900 giây (15 phút) và reset bộ đếm lỗi.
- [ ] 5.4 Chuyển đổi `BookingController` sử dụng `JwtAuthGuard` thay vì `AuthGuard('jwt')` trực tiếp để được thừa hưởng lớp bảo mật IP block.
- [ ] 5.5 Bổ sung các unit test cho `JwtAuthGuard` nhằm bao phủ kịch bản khóa IP khi gặp lỗi xác thực liên tục, đảm bảo cơ chế hoạt động đúng đắn và an toàn (fail-open hoạt động khi lỗi kết nối Redis).
