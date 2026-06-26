## Bối cảnh (Context)

Hệ thống cần bảo vệ các tác vụ ghi nhạy cảm (`POST /bookings` và `POST /payments/*`) khỏi các hành vi gửi thư rác đồng thời và lạm dụng API trong các sự kiện mở bán vé. Lớp rate limiter hiện tại của ứng dụng chỉ hoạt động toàn cục, lưu trong bộ nhớ (in-memory) và dựa trên địa chỉ IP. Chúng tôi sẽ triển khai thiết kế rate limiting 2 lớp được trình bày chi tiết trong `docs/design.md`.

## Mục tiêu / Không thuộc mục tiêu (Goals / Non-Goals)

**Mục tiêu:**
- Triển khai rate limiting dựa trên IP ở phạm vi toàn cầu tại tầng Nginx Gateway (Lớp 1).
- Triển khai rate limiting dựa trên User ID ở tầng ứng dụng NestJS sử dụng thuật toán Sliding Window Counter lưu trữ trên Redis thông qua Lua Script (Lớp 2).
- Cấu hình các hạn mức rate limit chi tiết cho việc tạo đơn đặt vé (10 yêu cầu/phút mỗi người dùng) và khởi tạo thanh toán (3 yêu cầu/phút mỗi người dùng).
- Đảm bảo các header (`X-RateLimit-Source`) được cấu hình chính xác để Client nhận biết được lớp chặn tương ứng (`gateway`, `app-user`, hoặc `failed-auth-ip`).
- **Bổ sung:** Triển khai cơ chế bảo vệ chống vắt kiệt CPU (CPU Exhaustion Protection) tại `JwtAuthGuard` để chống tấn công spam hàng loạt JWT token giả từ một IP address (Lớp 2.5).

**Không thuộc mục tiêu:**
- Áp dụng rate limit lên các yêu cầu GET (ví dụ: `GET /concerts`), do các route này đã được cache hoặc tải nhẹ.
- Tích hợp các dịch vụ gateway bên thứ ba (như Cloudflare, Kong) trong giai đoạn này.

## Quyết định kỹ thuật (Decisions)

### Quyết định 1: Rate Limiting ở Lớp 1 (Gateway) thông qua Nginx
Chúng tôi sẽ sử dụng module native `ngx_http_limit_req_module` của Nginx cấu hình trong file `nginx.conf`.
- **Các giải pháp thay thế đã cân nhắc**: Sử dụng Kong API Gateway hoặc chạy một reverse proxy ở tầng ứng dụng.
- **Lý do lựa chọn**: Nginx đã được triển khai làm reverse proxy trong môi trường docker-compose hiện tại. Sử dụng module native viết bằng C giúp tối ưu hiệu năng tối đa, tiêu tốn rất ít tài nguyên và chặn các đợt lưu lượng lớn trước khi chúng chạm tới NestJS.

### Quyết định 2: Rate Limiting ở Lớp 2 (Application) thông qua Custom Redis Sliding Window Guard
Thay vì sử dụng module mặc định `@nestjs/throttler` lưu trong bộ nhớ, chúng tôi sẽ viết một Guard NestJS custom (`RedisRateLimitGuard`) sử dụng `RedisService` hiện có để chạy một file Lua script thực hiện thuật toán Sliding Window.
- **Các giải pháp thay thế đã cân nhắc**:
  - Sử dụng `@nestjs/throttler` kết hợp thư viện `nestjs-throttler-storage-redis`. (Không chọn vì muốn kiểm soát chính xác hành vi sliding window dùng cấu trúc `ZSET` của Redis qua Lua script như tài liệu mô tả, đồng thời giảm thiểu tối đa cài đặt package bên thứ ba).
- **Lý do lựa chọn**: Việc tạo custom Guard giúp dễ dàng giải mã và trích xuất `userId` từ token JWT trong ngữ cảnh `Request`, chạy tập lệnh Lua nguyên tử (atomic) trên Redis, thêm header phản hồi tương ứng (`X-RateLimit-Source`), và trả về định dạng JSON lỗi thống nhất.
- **Cơ chế chịu lỗi (Fail-Open)**: Guard sẽ bọc lệnh gọi Redis trong khối `try-catch`. Nếu Redis gặp sự cố hoặc mất kết nối, hệ thống sẽ ghi log lỗi và tự động cho phép request đi tiếp (`return true`) để tránh làm sập luồng nghiệp vụ chính của người dùng (mua vé).

### Quyết định 3: Tập lệnh Lua script sử dụng thời gian của Redis Server
Tập lệnh Lua script sẽ sử dụng kiểu dữ liệu Sorted Set (`ZSET`) của Redis với key định dạng: `rate_limit:{userId}:{endpoint}`.
- **Thuật toán chi tiết**:
  1. Thay vì sử dụng thời gian hệ thống của NestJS API instance (dễ bị lệch giờ giữa các container - Clock Drift), Lua script sẽ lấy thời gian trực tiếp từ Redis Server bằng lệnh `redis.call('time')` (trả về giây và microgiây, sau đó chuyển đổi sang miligiây).
  2. Loại bỏ các bản ghi cũ nằm ngoài cửa sổ thời gian trượt (`now - window_size`).
  3. Lấy số lượng phần tử hiện tại trong `ZSET` (số lượng yêu cầu hiện tại của user).
  4. Nếu số lượng này nhỏ hơn `max_requests`, thêm thời gian hiện tại `now` vào `ZSET` với score là `now`, thiết lập thời gian hết hạn TTL cho key và cho phép đi qua.
  5. Nếu vượt quá giới hạn, từ chối yêu cầu.
- **Lý do lựa chọn**: Triệt tiêu hiện tượng tăng vọt lưu lượng tại ranh giới chu kỳ (boundary burst traffic) mà thuật toán Fixed Window thường gặp phải, đồng thời đồng nhất mốc thời gian trên toàn bộ các API Node trong hệ thống multi-instance.

### Quyết định 4: Thiết lập "trust proxy" cho ứng dụng NestJS
Để hỗ trợ cơ chế fallback rate limit theo IP (dành cho các endpoint không yêu cầu đăng nhập hoặc khi không trích xuất được User ID), NestJS cần lấy đúng địa chỉ IP thực tế của client thay vị nhận diện IP nội bộ của Nginx.
- **Giải pháp**: Gọi `app.getHttpAdapter().getInstance().set('trust proxy', true)` trong file `main.ts` khi khởi tạo ứng dụng NestJS.

### Quyết định 5: Chống vắt kiệt CPU bằng Failed Authentication IP Block (Lớp 2.5)
Để ngăn chặn tấn công từ chối dịch vụ (DoS) bằng cách xoay vòng token giả gây cạn kiệt tài nguyên CPU do NestJS liên tục phải giải mã chữ ký JWT, chúng tôi tích hợp một bộ đếm lỗi xác thực theo IP vào `JwtAuthGuard`.
- **Giải pháp**:
  - Khi request đi qua `JwtAuthGuard`, trước tiên kiểm tra xem IP client có bị chặn tạm thời hay không (key `auth_blocked:<ip>` trên Redis). Nếu bị chặn, trả về lỗi HTTP 429 và header `X-RateLimit-Source: failed-auth-ip` ngay lập tức mà không chạy bất kỳ tác vụ verify mật mã nào.
  - Nếu IP không bị chặn, tiến hành xác thực JWT bình thường.
  - Nếu xác thực JWT thất bại (lỗi signature/expired/fake token), ghi nhận lỗi bằng cách tăng bộ đếm lỗi xác thực của IP đó (`auth_fail_count:<ip>` với TTL 60s).
  - Nếu bộ đếm lỗi đạt >= 5 lần trong vòng 60 giây, lưu key khóa IP `auth_blocked:<ip>` trên Redis với TTL 900 giây (15 phút) và xóa key bộ đếm lỗi.
  - **Fail-Open**: Nếu kết nối Redis bị lỗi, cơ chế check block sẽ bỏ qua (fail-open) và tiếp tục cho phép request đi tới lớp verify JWT bình thường.

## Rủi ro / Đánh đổi (Risks / Trade-offs)

- **Rủi ro**: Lỗi kết nối Redis có thể chặn toàn bộ quá trình đặt vé và thanh toán.
  - **Biện pháp giảm thiểu**: Thiết lập cơ chế dự phòng fail-open bên trong các custom Guard (`RedisRateLimitGuard` và `JwtAuthGuard`).
- **Rủi ro**: Nginx rate limit có thể chặn nhầm người dùng hợp lệ dùng chung một IP công cộng (NAT).
  - **Biện pháp giảm thiểu**: Hạn mức của Nginx được thiết lập tương đối cao (50 req/s, burst 30), đủ lớn để phục vụ các nhóm người dùng bình thường đằng sau NAT.
- **Rủi ro**: Chặn nhầm IP (NAT) khi một người dùng nhập sai mật khẩu hoặc gửi token hết hạn quá 5 lần trong 1 phút, làm ảnh hưởng đến người dùng hợp lệ khác dùng chung IP.
  - **Biện pháp giảm thiểu**: Ngưỡng 5 lần/phút chỉ áp dụng cho lỗi xác thực JWT. Các ứng dụng Client chuẩn (Web/Mobile) được thiết kế để dừng gửi yêu cầu hoặc tự động refresh token khi gặp lỗi auth đầu tiên, do đó rất khó để một client bình thường vượt quá 5 lỗi auth liên tiếp trong 60s. Khóa IP tạm thời trong 15 phút là hợp lý để bảo vệ máy chủ trước các mối đe dọa lớn hơn.
