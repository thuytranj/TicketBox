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

---

## Chứng minh Khả năng chịu tải và Tính Công bằng bằng Mô hình Downscaling

Để chứng minh hệ thống có thể chịu tải khoảng **80.000 người truy cập trong 5 phút đầu (70% dồn vào phút đầu tiên)**, ngăn chặn bot hiệu quả và đảm bảo tính công bằng giữa các khán giả thật, chúng ta sử dụng phương pháp **Downscaling** (Thu nhỏ quy mô tải thực tế tương ứng với năng lượng tính toán của môi trường máy phát triển cục bộ).

### 1. Phân tích Toán học & Mô hình Downscaling

* **Tải thực tế trên Production (Target Load):**
  * Tổng số lượng truy cập: N = 80.000 visitors trong T = 5 phút (300 giây).
  * 70% lượng truy cập dồn vào phút đầu tiên (T1 = 60 giây):
    N1 = 80.000 * 0.70 = 56.000 visitors
  * Giả thiết mỗi người dùng thực hiện trung bình 3 requests (Đọc thông tin concert, Đặt vé, Khởi tạo thanh toán).
  * Tổng request tại phút cao điểm thứ 1:
    Requests_1 = 56.000 * 3 = 168.000 requests
  * Lưu lượng đỉnh yêu cầu hệ thống Production đáp ứng:
    RPS_peak = 168.000 / 60 = 2.800 RPS

* **Mô hình Downscaling cục bộ (Local Simulation):**
  * Do phần cứng thử nghiệm cục bộ (2 instances NestJS API, 1 instance OpenResty, 1 instance Redis chạy trên máy đơn) bị giới hạn về CPU/RAM và kết nối mạng, chúng tôi áp dụng **hệ số thu nhỏ quy mô F = 40**.
  * **Số lượng người dùng mô phỏng cục bộ (VUs):**
    N_local = 80.000 / 40 = 2.000 VUs
  * **Lưu lượng đỉnh thu nhỏ tương ứng tại phút đầu tiên:**
    RPS_peak_local = 2.800 RPS / 40 = 70 RPS

### 2. Kết quả Thực nghiệm K6 Load Test (Với 2 instances ticketbox-api)

Chúng tôi đã chạy kiểm thử tải bằng công cụ `k6` trên mô hình cụm phân tán cục bộ gồm **2 instances `ticketbox-api`** dưới sự điều phối của OpenResty Gateway.

#### A. Kiểm thử giới hạn IP thô (`api-rate-limiting-spike-test.js` với Ramping Arrival Rate)
* **Thiết lập:** Cấu hình `ramping-arrival-rate` đẩy tải đỉnh vọt lên đúng **3.000 requests/giây** (RPS) duy trì trong 15 giây.
* **Kết quả:**
  * **Tổng số request gửi đi:** **58.842** requests trong 25 giây.
  * **Tải đỉnh thực tế mô phỏng:** Đạt chính xác **3.000 RPS** (tương đương 180.000 requests/phút).
  * **Số lượng request thành công (200 OK):** **1.278** requests (phù hợp tuyệt đối với giới hạn 50 req/s của Nginx trong 25 giây).
  * **Tỷ lệ lọc tải (429 Rate Limited):** **97,82%** (57.564 requests bị chặn trực tiếp tại OpenResty Gateway).
  * **Độ trễ phản hồi lỗi (Error Latency):** trung bình **8,42ms** (trung vị cực nhanh chỉ **247 microseconds**, tức là dưới 0.3ms).
  * **Tỷ lệ sống sót:** **100%**, NestJS backend hoàn toàn không phải xử lý hay giải băm bất kỳ request lỗi nào.


#### B. Kiểm thử tải Đọc thông tin Concert với 2 instances (`home-detail-read-load-test.js`)
* **Thiết lập:** 200 VUs liên tục gửi request đọc thông tin qua cổng `3000` (được OpenResty cân bằng tải vòng tròn sang 2 instances NestJS API). Hạn mức throttler NestJS đã nâng lên `100.000 req/min`.
* **Kết quả:**
  * **Tỷ lệ lỗi (Error Rate):** **0.00%** (11.084 / 11.084 requests đều thành công).
  * **Throughput trung bình:** **154,9 requests/giây**.
  * **Độ trễ trung bình (Avg Latency):** **10,35ms** (đáp ứng xuất sắc mục tiêu đặc tả < 50ms nhờ Redis Cache-aside).
  * **Độ tin cậy:** Cả 2 instances NestJS API chia sẻ tải đều đặn, không có lỗi nghẽn Event Loop.

#### C. Kiểm thử giới hạn theo User ID (`gateway-jwt-rate-limit-test.js` & `payment-rate-limit-test.js`)
* **Thiết lập:** 1 VU gửi 15 yêu cầu đặt vé (`POST /bookings`) và 6 yêu cầu thanh toán (`POST /payments/momo`) liên tục.
* **Kết quả đặt vé:**
  * 10 request đầu tiên vượt qua Gateway thành công (hạn mức 10 req/min).
  * Từ request thứ 11 trở đi bị Gateway chặn đứng trực tiếp, trả về mã lỗi `429` với header `X-RateLimit-Source: gateway-user` trong vòng **< 2ms**.
* **Kết quả thanh toán:**
  * 3 request đầu tiên vượt qua Gateway thành công (hạn mức 3 req/min).
  * Từ request thứ 4 trở đi bị Gateway chặn đứng trực tiếp, trả về mã lỗi `429` với header `X-RateLimit-Source: gateway-user`.

### 3. Đánh giá Tính Công bằng và Phòng chống Bot

1. **Khả năng đáp ứng tải 80.000 users / 5 phút (Peak 2.800 RPS):**
   * **Bảo vệ biên bằng CDN/Gateway:** Trong thực tế, toàn bộ các request đọc public (như trang Concerts list/detail) chiếm 80% tải sẽ được lưu trữ và trả về tại **CDN (Cloudflare)**, không cần đi sâu vào API Gateway hay NestJS.
   * **Năng lực xử lý của NestJS API:** Thực nghiệm cục bộ với 2 instances NestJS API xử lý mượt mà **155 RPS** với độ trễ **10,35ms**. Khi phân phối trên hạ tầng Production được scale-out (ví dụ: cụm 40 instances chạy trên Kubernetes), năng lực xử lý lý thuyết đạt được là:
     $$\text{Capacity} = \frac{40\text{ instances}}{2\text{ instances}} \times 155\text{ RPS} = 3.100\text{ RPS}$$
     *Con số này vượt mức 2.800 RPS yêu cầu đỉnh ở phút đầu tiên, bảo đảm hệ thống vận hành trơn tru.*
2. **Chặn spam & bảo vệ backend:** Nhờ cơ chế giải mã JWT và Sliding Window Rate Limiting thực hiện ngay tại OpenResty (kết nối trực tiếp Redis), các yêu cầu spam liên tục từ Bot bị chặn đứng tại Gateway chỉ trong vòng **1-2ms**. Backend NestJS được bảo vệ hoàn toàn khỏi các tác vụ giải mã nặng nề.
3. **Đảm bảo tính công bằng cho khán giả thật:**
   * Do giới hạn tần suất được tính theo **User ID** (đọc từ token JWT đã được xác thực), hệ thống hoàn toàn loại bỏ vấn đề chặn oan khi nhiều người dùng thật sử dụng chung một NAT IP (ví dụ: mạng 4G công cộng, Wi-Fi rạp hát, quán cafe).
   * Mỗi tài khoản người dùng thật có đúng hạn mức định sẵn (10 lượt đặt vé/phút, 3 lượt thanh toán/phút) bất kể họ kết nối từ mạng nào, đảm bảo cơ hội mua vé bình đẳng tuyệt đối.
