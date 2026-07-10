# Đặc tả: Giới hạn Tần suất API (API Rate Limiting & Abuse Prevention)

## Mô tả
Hệ thống triển khai cơ chế giới hạn tần suất (Rate Limiting) nhiều lớp và phòng chống lạm dụng nhằm bảo vệ máy chủ khỏi tấn công từ chối dịch vụ (DDoS), ngăn chặn đầu cơ vé (ticket scalping), ngăn spam giao dịch và bảo vệ CPU máy chủ khỏi các cuộc tấn công vét cạn tài nguyên qua xác thực JWT giả mạo.

Hệ thống được bảo vệ qua 3 lớp chính:
1. **Lớp Gateway (Nginx API Gateway IP Rate Limit):** Giới hạn toàn cục theo IP để chặn spam thô.
2. **Lớp Ứng dụng theo Người dùng (NestJS User-level Rate Limit):** Giới hạn hành vi đặt vé (`POST /bookings`) và thanh toán (`POST /payments/*`) của từng người dùng.
3. **Lớp Phòng vệ CPU (Failed Authentication IP Block):** Tự động phát hiện và khóa tạm thời các IP liên tục gửi token xác thực sai để tránh làm cạn kiệt tài nguyên xử lý mã hóa của CPU.

## Luồng chính
1. **Kiểm tra tại Nginx Gateway:**
   - Yêu cầu đi vào hệ thống qua Nginx. Nginx kiểm tra số lượng yêu cầu của IP hiện tại trong bộ nhớ dùng chung.
   - Nếu trong hạn mức (dưới 50 req/s + 30 burst): Nginx chuyển tiếp (proxy_pass) yêu cầu đến ứng dụng NestJS.
   - Nếu vượt hạn mức: Nginx từ chối trực tiếp và trả về lỗi `429 Too Many Requests`.
2. **Kiểm tra Khóa IP do Xác thực thất bại:**
   - Khi yêu cầu đến NestJS, trước khi tiến hành giải mã chữ ký số JWT, Guard/Middleware kiểm tra địa chỉ IP client trên Redis (`auth_blocked:<ip>`).
   - Nếu IP đang bị khóa: Hệ thống từ chối ngay lập tức bằng mã lỗi `429` (Bỏ qua bước xác thực JWT).
   - Nếu IP không bị khóa: Tiến hành xác thực JWT như bình thường.
3. **Ghi nhận Lỗi Xác thực (nếu có):**
   - Nếu xác thực JWT thất bại (token giả, sai chữ ký, hết hạn): Hệ thống tăng bộ đếm lỗi trên Redis (`auth_fail_count:<ip>`, TTL 60 giây).
   - Nếu bộ đếm đạt $\ge 5$ lần: Thiết lập khóa IP trên Redis (`auth_blocked:<ip>`, TTL 15 phút).
4. **Kiểm tra Giới hạn theo Người dùng (User-level Rate Limit):**
   - Khi người dùng gửi yêu cầu tới các API nhạy cảm (Đặt vé, Thanh toán), hệ thống xác định User ID đã qua xác thực.
   - Hệ thống đối chiếu số lượng yêu cầu của User ID trong vòng 1 phút qua Redis (`ratelimit:user:<userId>`).
   - Nếu trong hạn mức (Đặt vé $\le 10$ req/phút; Thanh toán $\le 3$ req/phút): Xử lý yêu cầu.
   - Nếu vượt hạn mức: Trả về mã lỗi `429`.

## Kịch bản lỗi
1. **Yêu cầu vượt hạn mức toàn cục tại Gateway:**
   - **WHEN:** Client gửi hơn 80 yêu cầu/giây từ một IP đến Nginx.
   - **THEN:** Nginx chặn các yêu cầu vượt ngưỡng, trả về HTTP status `429 Too Many Requests`, header `X-RateLimit-Source: gateway` và JSON payload định dạng quy chuẩn.
2. **Người dùng spam đặt vé hoặc thanh toán:**
   - **WHEN:** Một tài khoản gửi 11 yêu cầu `POST /bookings` hoặc 4 yêu cầu `POST /payments/momo` trong vòng 1 phút.
   - **THEN:** Ứng dụng NestJS từ chối các yêu cầu vượt ngưỡng, trả về HTTP status `429`, header `X-RateLimit-Source: app-user` và không thực hiện tạo giao dịch mới.
3. **Tấn công vét cạn CPU bằng token giả:**
   - **WHEN:** Một IP gửi liên tiếp 5 yêu cầu mang token giả trong 10 giây.
   - **THEN:** Hệ thống ghi nhận 5 lần thất bại, khóa IP này trong 15 phút. Toàn bộ các yêu cầu thứ 6 trở đi từ IP này trong thời gian khóa sẽ bị chặn ngay lập tức với HTTP status `429` và header `X-RateLimit-Source: failed-auth-ip` mà không chạy giải mã chữ ký JWT.
4. **Hệ thống Redis gặp sự cố (Timeout/Mất kết nối):**
   - **THEN:** Các bộ giới hạn tần suất cấp ứng dụng SHALL tự động chuyển sang chế độ fail-open hoặc sử dụng bộ nhớ đệm trong máy (in-memory) tạm thời để tránh gây gián đoạn dịch vụ của người dùng thường.

## Ràng buộc
- **Giới hạn Nginx Gateway:** Hạn mức MUST là 50 yêu cầu/giây trên mỗi IP, vùng đệm burst tối đa 30 yêu cầu (sử dụng cấu hình `nodelay`).
- **Giới hạn Đặt vé (Booking):** Hạn mức SHALL là 10 yêu cầu/phút trên mỗi User ID.
- **Giới hạn Thanh toán (Payment):** Hạn mức SHALL là 3 yêu cầu/phút trên mỗi User ID cho các API `/payments/*`.
- **Tránh vắt kiệt CPU:** Bộ lọc khóa IP xác thực thất bại MUST thực hiện kiểm tra trước khi ứng dụng thực hiện bất kỳ phép toán giải mã chữ ký mật mã JWT nào.

## Tiêu chí chấp nhận
- Người dùng hoạt động bình thường không gặp lỗi 429 khi gửi yêu cầu trong hạn mức.
- API phản hồi mã lỗi `429 Too Many Requests` đi kèm header `X-RateLimit-Source` tương ứng chỉ rõ nguồn chặn (`gateway`, `app-user`, hoặc `failed-auth-ip`).
- Trạng thái khóa IP do xác thực thất bại tự động giải phóng sau đúng 15 phút (900 giây).
- Dữ liệu lượt đếm và trạng thái rate limit được lưu trữ tập trung trên Redis dùng chung để hỗ trợ scale đa phiên bản (multi-instance) ứng dụng.
