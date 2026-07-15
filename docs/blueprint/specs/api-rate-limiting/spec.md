# Đặc tả: Giới hạn Tần suất API (API Rate Limiting & Abuse Prevention)

## Mô tả
Hệ thống triển khai cơ chế giới hạn tần suất (Rate Limiting) nhiều lớp và phòng chống lạm dụng nhằm bảo vệ máy chủ khỏi tấn công từ chối dịch vụ (DDoS), ngăn chặn đầu cơ vé (ticket scalping), ngăn spam giao dịch và bảo vệ tài nguyên hệ thống.

Hệ thống được bảo vệ qua các lớp chính:
1. **Lớp Gateway thô (OpenResty Gateway IP Rate Limit):** Giới hạn toàn cục theo IP (50 req/s, burst 30) cho các endpoint công cộng để chặn spam thô.
2. **Lớp Gateway định danh cho Đặt vé (OpenResty Gateway Booking Rate Limit):** Đối với API đặt vé (`POST /api/v1/bookings`), Gateway tự giải mã JWT và giới hạn tần suất theo `userId` (10 req/min) qua Redis dùng chung để tránh NAT IP blocking cho khán giả thật và lọc tải sớm trước khi chạm tới NestJS.
3. **Lớp Gateway định danh cho Thanh toán (OpenResty Gateway Payment Rate Limit):** Đối với API khởi tạo thanh toán (`POST /api/v1/payments/momo` và `POST /api/v1/payments/vnpay`), Gateway tự giải mã JWT và giới hạn tần suất theo `userId` (3 req/min) qua Redis để lọc tải sớm.
4. **Lớp Phòng vệ CPU (Failed Authentication IP Block - NestJS):** Tự động phát hiện và khóa tạm thời các IP liên tục gửi token xác thực sai để tránh làm cạn kiệt tài nguyên xử lý mã hóa của CPU.

## Luồng chính
1. **Kiểm tra tại Gateway (API Gateway):**
   - **Với endpoint thông thường:** OpenResty kiểm tra số lượng yêu cầu của IP hiện tại trong bộ nhớ dùng chung. Nếu vượt hạn mức (50 req/s + 30 burst), từ chối trực tiếp (HTTP 429).
   - **Với endpoint đặt vé (`POST /api/v1/bookings`):** OpenResty giải mã chữ ký JWT bằng `JWT_SECRET`, trích xuất `userId`, kiểm tra số lượng yêu cầu trong vòng 1 phút qua Redis (`rate_limit:<userId>:/api/v1/bookings`). Nếu vượt hạn mức (10 req/min), từ chối trực tiếp (HTTP 429) và không chuyển tiếp tới NestJS.
   - **Với endpoint thanh toán (`POST /api/v1/payments/momo` và `/vnpay`):** OpenResty giải mã JWT, trích xuất `userId`, kiểm tra tần suất qua Redis (`rate_limit:<userId>:/api/v1/payments/*`). Nếu vượt hạn mức (3 req/min), từ chối trực tiếp (HTTP 429).
2. **Kiểm tra Khóa IP do Xác thực thất bại:**
   - Khi yêu cầu đến NestJS, trước khi tiến hành giải mã chữ ký số JWT, Guard/Middleware kiểm tra địa chỉ IP client trên Redis (`auth_blocked:<ip>`).
   - Nếu IP đang bị khóa: Hệ thống từ chối ngay lập tức bằng mã lỗi `429` (Bỏ qua bước xác thực JWT).
   - Nếu IP không bị khóa: Tiến hành xác thực JWT như bình thường.
3. **Ghi nhận Lỗi Xác thực (nếu có):**
   - Nếu xác thực JWT thất bại (token giả, sai chữ ký, hết hạn): Hệ thống tăng bộ đếm lỗi trên Redis (`auth_fail_count:<ip>`, TTL 60 giây).
   - Nếu bộ đếm đạt >= 5 lần: Thiết lập khóa IP trên Redis (`auth_blocked:<ip>`, TTL 15 phút).

## Kịch bản lỗi
1. **Yêu cầu vượt hạn mức toàn cục tại Gateway:**
   - **WHEN:** Client gửi hơn 80 yêu cầu/giây từ một IP đến Gateway cho các API công cộng.
   - **THEN:** OpenResty chặn các yêu cầu vượt ngưỡng, trả về HTTP status `429 Too Many Requests`, header `X-RateLimit-Source: gateway`.
2. **Người dùng spam đặt vé hoặc thanh toán:**
   - **WHEN:** Một tài khoản gửi 11 yêu cầu `POST /api/v1/bookings` trong vòng 1 phút.
   - **THEN:** OpenResty Gateway từ chối yêu cầu thứ 11 trực tiếp, trả về HTTP status `429`, header `X-RateLimit-Source: gateway-user` và không chuyển tiếp yêu cầu đến NestJS.
   - **WHEN:** Một tài khoản gửi 4 yêu cầu `POST /api/v1/payments/momo` trong vòng 1 phút.
   - **THEN:** OpenResty Gateway từ chối yêu cầu thứ 4 trực tiếp, trả về HTTP status `429`, header `X-RateLimit-Source: gateway-user` và không chuyển tiếp yêu cầu đến NestJS.
3. **Tấn công vét cạn CPU bằng token giả:**
   - **WHEN:** Một IP gửi liên tiếp 5 yêu cầu mang token giả trong 10 giây.
   - **THEN:** Hệ thống ghi nhận 5 lần thất bại, khóa IP này trong 15 phút. Toàn bộ các yêu cầu thứ 6 trở đi từ IP này trong thời gian khóa sẽ bị chặn ngay lập tức với HTTP status `429` và header `X-RateLimit-Source: failed-auth-ip` mà không chạy giải mã chữ ký JWT.
4. **Hệ thống Redis gặp sự cố (Timeout/Mất kết nối):**
   - **THEN:** Các bộ giới hạn tần suất cấp Gateway và ứng dụng SHALL tự động chuyển sang chế độ fail-open để tránh gây gián đoạn dịch vụ của người dùng thường.

## Ràng buộc
- **Giới hạn IP Gateway:** Hạn mức MUST là 50 yêu cầu/giây trên mỗi IP, vùng đệm burst tối đa 30 yêu cầu (sử dụng cấu hình `nodelay`).
- **Giới hạn Đặt vé (Booking):** Hạn mức SHALL là 10 yêu cầu/phút trên mỗi User ID tại OpenResty Gateway.
- **Giới hạn Thanh toán (Payment):** Hạn mức SHALL là 3 yêu cầu/phút trên mỗi User ID tại OpenResty Gateway.
- **Tránh vắt kiệt CPU:** Bộ lọc khóa IP xác thực thất bại MUST thực hiện kiểm tra trước khi ứng dụng thực hiện bất kỳ phép toán giải mã chữ ký mật mã JWT nào.

## Tiêu chí chấp nhận
- Người dùng hoạt động bình thường không gặp lỗi 429 khi gửi yêu cầu trong hạn mức.
- API phản hồi mã lỗi `429 Too Many Requests` đi kèm header `X-RateLimit-Source` tương ứng chỉ rõ nguồn chặn (`gateway`, `gateway-user`, hoặc `failed-auth-ip`).
- Trạng thái khóa IP do xác thực thất bại tự động giải phóng sau đúng 15 phút (900 giây).
- Dữ liệu lượt đếm và trạng thái rate limit được lưu trữ tập trung trên Redis dùng chung để hỗ trợ scale đa phiên bản (multi-instance) ứng dụng.