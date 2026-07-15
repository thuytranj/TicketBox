# Payment Specification

## Purpose
Đặc tả luồng thanh toán, xử lý webhook từ cổng thanh toán (MoMo, VNPAY), và các cơ chế bảo vệ hệ thống như chống trừ tiền 2 lần (Idempotency) và Circuit Breaker khi cổng thanh toán không ổn định nhằm đảm bảo tính toàn vẹn dữ liệu và độ khả dụng cao.

## Requirements

### Requirement: Khởi tạo thanh toán và Chống trừ tiền hai lần (Idempotency)
**Mô tả:**
Hệ thống cho phép khán giả khởi tạo thanh toán qua các cổng VNPAY hoặc MoMo. Để chống tình trạng trừ tiền hai lần khi khán giả bấm "Mua vé" nhiều lần liên tục hoặc do mạng ngắt quãng, hệ thống áp dụng cơ chế Idempotency Key kết hợp với Rate Limiting.

**Luồng chính:**
1. Khán giả gửi yêu cầu POST đến `/api/v1/payments/momo` hoặc `/api/v1/payments/vnpay` kèm theo thông tin đơn hàng (`orderId`), `Idempotency-Key` trên header, và token xác thực JWT hợp lệ.
2. Hệ thống kiểm tra Rate Limit (tối đa 3 requests / 1 phút / user).
3. Hệ thống chặn các request trùng lặp thông qua `IdempotencyInterceptor` sử dụng `Idempotency-Key`.
4. Hệ thống kiểm tra đơn hàng (thuộc về user và đang ở trạng thái `PENDING`).
5. Tạo bản ghi Payment với trạng thái `PENDING`.
6. Gọi sang cổng thanh toán tương ứng (qua Circuit Breaker) để tạo URL thanh toán.
7. Cập nhật `payUrl` vào bản ghi Payment và trả về cho client kèm mã 200 OK.

**Kịch bản lỗi:**
- Đơn hàng không tồn tại hoặc không thuộc về người dùng: Trả về HTTP 404 Not Found.
- Đơn hàng không ở trạng thái `PENDING`: Trả về HTTP 400 Bad Request.
- Vượt quá giới hạn gọi API: Trả về lỗi HTTP 429 Too Many Requests (Rate Limit).
- Trùng `Idempotency-Key`: Hệ thống trả về kết quả đã được cache của request thành công trước đó mà không tạo thêm phiên thanh toán mới.
- Cổng thanh toán lỗi: Trả về lỗi 503 hoặc 500 do Circuit Breaker phát hiện lỗi từ gateway.

**Ràng buộc:**
- Rate Limit: 3 requests / 60 giây / user (sử dụng Redis sliding window).
- Header `Idempotency-Key` bắt buộc để tránh trùng lặp thao tác khởi tạo.

**Tiêu chí chấp nhận:**
- Cùng một `Idempotency-Key` không thể tạo ra 2 giao dịch thanh toán khác nhau.
- Chỉ đơn hàng `PENDING` mới được tiếp tục xử lý.

#### Scenario: Khán giả khởi tạo thanh toán thành công
- **WHEN** Khán giả gửi yêu cầu khởi tạo thanh toán hợp lệ với `Idempotency-Key` mới
- **THEN** Hệ thống lưu bản ghi Payment trạng thái `PENDING`, gọi cổng thanh toán thành công và trả về `payUrl`

#### Scenario: Khán giả gửi yêu cầu khởi tạo thanh toán trùng lặp (Idempotent)
- **WHEN** Khán giả gửi yêu cầu khởi tạo thanh toán với cùng `Idempotency-Key` đã sử dụng thành công ngay trước đó
- **THEN** Hệ thống không gọi lại cổng thanh toán mà trả về kết quả đã cache của request ban đầu

### Requirement: Xử lý Webhook thanh toán và Đảm bảo Idempotent
**Mô tả:**
Hệ thống tiếp nhận thông báo kết quả giao dịch (IPN/Webhook) từ MoMo và VNPAY, xác thực chữ ký để chống giả mạo, và cập nhật trạng thái đơn hàng an toàn (idempotent), đảm bảo không xử lý lặp lại tác vụ xuất vé nếu cổng thanh toán gửi webhook nhiều lần.

**Luồng chính:**
1. Cổng thanh toán gọi API Webhook (ví dụ `ALL /api/v1/payments/momo/webhook`) kèm dữ liệu giao dịch.
2. Hệ thống xác thực chữ ký (HMAC SHA256) của payload.
3. Đối soát tính toàn vẹn: với VNPAY, kiểm tra `amount` so với database (sai số cho phép <= 1).
4. Xử lý giao dịch thành công (resultCode = 0 đối với MoMo hoặc '00' đối với VNPAY):
   - Hệ thống lưu khóa Idempotency trên Redis `payment:webhook:{orderId}` (TTL 24 giờ) bằng lệnh `SET NX` để chốt quyền xử lý.
   - Cập nhật Payment record thành `SUCCESS`, lưu mã giao dịch `transactionId` và phản hồi gốc.
   - Cập nhật Order status thành `PAID`.
   - Gửi sự kiện vào RabbitMQ (`payment_success` queue) để Worker kích hoạt xuất vé offline/email.
5. Xử lý giao dịch thất bại:
   - Cập nhật Payment record thành `FAILED`.
6. Phản hồi lại cho cổng thanh toán định dạng phù hợp (ví dụ JSON `{ RspCode, Message }` cho VNPAY, hoặc `{ message }` cho MoMo) với mã HTTP 200 OK.

**Kịch bản lỗi:**
- Chữ ký không hợp lệ: Ghi log cảnh báo, trả về lỗi invalid signature.
- Sai lệch số tiền (VNPAY): Trả về `{ RspCode: '04', Message: 'Amount mismatch' }`.
- Đơn hàng không tồn tại (VNPAY): Trả về `{ RspCode: '01', Message: 'Order not found' }`.
- Nhận Webhook trùng lặp (khóa Redis `payment:webhook:{orderId}` đã tồn tại): Bỏ qua xử lý, trả về thành công ngay lập tức để cổng thanh toán dừng gửi lại.

**Ràng buộc:**
- Mọi webhook phải được xác thực chữ ký dựa trên secret key.
- Khóa chống trùng lặp `payment:webhook:{orderId}` có thời gian sống (TTL) là 86400 giây (24 giờ).
- Việc xuất vé nặng (chạy PDF, gửi email) không được làm trực tiếp mà phải đẩy vào Message Broker (RabbitMQ) để webhook API không bị timeout.

**Tiêu chí chấp nhận:**
- Hệ thống không sinh ra vé trùng lặp hoặc gửi event 2 lần nếu nhận webhook của cùng một đơn hàng đã xử lý.
- Luồng xử lý webhook phản hồi về cổng thanh toán trong thời gian cực ngắn (vài chục milliseconds).

#### Scenario: Nhận xác nhận thanh toán thành công hợp lệ
- **WHEN** Cổng thanh toán gửi Webhook thông báo giao dịch thành công kèm chữ ký số hợp lệ và đơn hàng chưa được xử lý
- **THEN** Hệ thống kiểm tra chữ ký số hợp lệ, lưu khóa idempotent thành công, cập nhật trạng thái đơn hàng thành `PAID`, cập nhật trạng thái Payment, và gửi sự kiện xuất vé vào RabbitMQ

#### Scenario: Nhận Webhook thanh toán trùng lặp
- **WHEN** Cổng thanh toán gửi Webhook thông báo thành công cho một đơn hàng đã được xử lý (trên Redis đã có khóa `payment:webhook:{orderId}`)
- **THEN** Hệ thống ghi nhận trùng lặp, bỏ qua các bước xử lý cơ sở dữ liệu và RabbitMQ, trả về phản hồi thành công ngay cho cổng thanh toán

### Requirement: Bảo vệ tích hợp cổng thanh toán với Circuit Breaker
**Mô tả:**
Để giải quyết bài toán "Thanh toán không ổn định", hệ thống ứng dụng mẫu thiết kế Circuit Breaker (opossum) khi gọi ra các API bên ngoài của MoMo/VNPAY. Nếu cổng thanh toán gặp sự cố timeout kéo dài, hệ thống sẽ ngắt mạch (fail-fast), bảo vệ backend không bị treo luồng (thread starvation) dẫn đến làm sập toàn bộ dịch vụ, trong khi đó các tính năng xem concert vẫn hoạt động bình thường (Graceful Degradation).

**Luồng chính:**
1. Yêu cầu gọi sang gateway MoMo/VNPAY được bao bọc bởi Circuit Breaker.
2. Nếu mọi thứ bình thường, request thành công, mạch ở trạng thái `CLOSED`.
3. Nếu tỷ lệ lỗi hoặc timeout vượt quá ngưỡng cài đặt, Circuit Breaker chuyển sang trạng thái ngắt mạch `OPEN`.
4. Khi ở trạng thái `OPEN`, các yêu cầu khởi tạo thanh toán tới gateway bị từ chối ngay lập tức (fail-fast) thay vì chờ đợi timeout dài, trả về lỗi dịch vụ tạm ngưng cho user.
5. Sau thời gian tự phục hồi cấu hình sẵn, Circuit Breaker chuyển qua `HALF-OPEN` để thăm dò.
6. Dựa vào kết quả thăm dò thành công hay thất bại, mạch sẽ đóng lại `CLOSED` hoặc tiếp tục mở `OPEN`.

**Kịch bản lỗi:**
- Gateway chậm phản hồi vượt thời gian timeout: Request bị Circuit Breaker ngắt và đếm 1 lỗi.
- Mạch đang OPEN: Bất cứ yêu cầu thanh toán nào cũng bị từ chối tức thì, bảo vệ backend không tích tụ kết nối.

**Ràng buộc:**
- Mỗi cổng thanh toán phải có một instance Circuit Breaker riêng biệt, lỗi của VNPAY không làm ảnh hưởng đến MoMo.

**Tiêu chí chấp nhận:**
- Khi VNPAY hoặc MoMo bị downtime hoàn toàn, khán giả vẫn có thể truy cập website, xem thông tin concert, kiểm tra vé còn lại mà không gặp tình trạng hệ thống treo cứng.
- Có API nội bộ (`/api/v1/payments/circuit-breaker/status`) để giám sát được trạng thái của từng gateway (OPEN/CLOSED/HALF-OPEN).

#### Scenario: Cổng thanh toán bị sự cố kéo dài (Cascading Failure Protection)
- **WHEN** Gateway MoMo/VNPAY liên tục trả về lỗi hoặc timeout làm vượt ngưỡng lỗi cho phép của cấu hình
- **THEN** Circuit Breaker chuyển sang trạng thái `OPEN`, chặn đứng các yêu cầu tạo thanh toán đến gateway này và phản hồi lỗi fail-fast cho client, giúp tài nguyên backend được bảo toàn cho các chức năng khác
