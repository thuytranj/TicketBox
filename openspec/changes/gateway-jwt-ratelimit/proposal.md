## Why

Cơ chế rate limit hiện tại của hệ thống đang dựa trên IP ở tầng Nginx Gateway (50r/s) và dựa trên User ID ở tầng NestJS Application (10r/m cho booking). Khi xảy ra đợt tải đột biến (80.000 người truy cập trong 5 phút đầu, 70% tập trung ở phút đầu tiên):
1. Khán giả thật sử dụng chung IP NAT (như mạng di động 4G/5G hoặc Wi-Fi công cộng) sẽ chia sẻ chung hạn mức IP tại Nginx và bị chặn oan (HTTP 429), gây mất công bằng nghiêm trọng.
2. Botnet sử dụng Proxy Pool (nhiều IP khác nhau) có thể dễ dàng lọt qua Nginx IP Limit và dội lượng tải cực lớn vào NestJS, gây nghẽn Event Loop và sập ứng dụng trước khi NestJS kịp xử lý rate limit theo User ID.

Do đó, chúng ta cần nâng cấp Nginx Gateway lên OpenResty để giải mã JWT và thực hiện rate limit theo User ID/JWT ngay tại cổng vào (Gateway), giải phóng CPU cho NestJS và loại bỏ lỗ hổng chặn oan NAT IP.

## What Changes

- Nâng cấp Docker container Load Balancer từ Nginx tiêu chuẩn sang **OpenResty** có hỗ trợ Lua engine.
- Tích hợp module giải mã JWT (`lua-resty-jwt`) và kết nối Redis (`resty.redis`) vào OpenResty.
- Triển khai Lua script cấu hình tại OpenResty để:
  - Tự động bỏ qua xác thực đối với các API static/public (được cache hoàn toàn tại CDN).
  - Đối với API đặt vé (`POST /api/v1/bookings`), trích xuất token JWT từ header `Authorization`, giải mã xác thực chữ ký bằng `JWT_SECRET`.
  - Kết nối Redis và thực hiện giới hạn tần suất (Rate Limiting) theo `userId` (10 requests/phút). Nếu vượt ngưỡng, trả về HTTP 429 kèm header `X-RateLimit-Source: gateway-user` trực tiếp từ OpenResty mà không chuyển tiếp tới NestJS.
- Đồng bộ cấu hình môi trường giữa Nginx/OpenResty và NestJS để cùng sử dụng chung `JWT_SECRET`.

## Capabilities

### New Capabilities
*(Không có)*

### Modified Capabilities
- `api-rate-limiting`: Di chuyển cơ chế rate limit theo User ID cho luồng Đặt vé (Booking) từ NestJS Application level lên Nginx Gateway (OpenResty) sử dụng Lua script để lọc tải sớm.

## Impact

- **Load Balancer (Nginx/OpenResty)**: Thay đổi docker base image và tệp cấu hình, bổ sung các Lua scripts.
- **NestJS Backend**: Không cần chạy `RedisRateLimitGuard` cho API đặt vé nữa (hoặc giữ lại làm lớp phòng thủ thứ hai) vì Gateway đã lọc toàn bộ.
- **Environment Variables**: Cần chia sẻ biến môi trường `JWT_SECRET` cho container OpenResty.
