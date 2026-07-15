# Đặc tả: Cốt lõi đặt vé (Booking Core & Inventory)

## Mô tả
Tính năng Đặt vé (Booking Core) là trái tim của hệ thống TicketBox, giải quyết bài toán tải trọng đột biến (spiky traffic) và tranh chấp vé (concurrent seat booking) khi mở bán. Hệ thống sử dụng mô hình Async Processing kết hợp Redis Lua Script để đảm bảo tính nhất quán dữ liệu, chống bán vượt quá số lượng (overselling) và tuân thủ giới hạn mua của từng tài khoản.

Các chức năng chính:
1. **Giữ chỗ thời gian thực (Atomic Reservation):** Sử dụng Redis Lua script thực hiện đồng thời kiểm tra tồn kho, kiểm tra giới hạn user và trừ vé.
2. **Xử lý bất đồng bộ (Async DB Write):** Gửi nhiệm vụ tạo đơn hàng vào RabbitMQ (`booking_tasks`) thay vì ghi trực tiếp vào PostgreSQL để giảm tải database.
3. **Quản lý Idempotency:** Ngăn chặn trừ tiền/tạo đơn trùng lặp khi người dùng gửi yêu cầu liên tục (chống double-click/mất kết nối).
4. **Tự động hủy đơn hết hạn (TTL & DLX):** Sử dụng RabbitMQ Delay Queue và Dead Letter Exchange kết hợp Cronjob dự phòng để thu hồi vé nếu người dùng không thanh toán trong 10 phút.

---

## Luồng chính

### 1. Luồng đặt vé (Create Booking)
- **Endpoint:** `POST /bookings`
- **Header:** `Idempotency-Key: <uuid>` (Tùy chọn nhưng khuyến cáo đối với client)
- **Quy trình xử lý:**
  1. Xác thực thông tin: Truy xuất giá vé và kiểm tra xem hạng vé có tồn tại và thuộc về concert được yêu cầu hay không.
  2. Thực thi **Redis Lua Script** (`reserve-ticket.lua`) cho từng hạng vé trong giỏ hàng. Script này đảm bảo tính nguyên tử (atomic) khi:
     - Kiểm tra `inventory:{concertId}:{ticketTypeId}` (Tồn kho vé thực tế).
     - Kiểm tra `concert:{concertId}:user:{userId}:bought:{ticketTypeId}` (Số lượng vé user đã mua).
  3. Trả về mã lỗi từ Redis nếu:
     - `-1`: Hết vé (Insufficient stock) -> Báo lỗi `400 Bad Request`.
     - `-2`: Vượt quá giới hạn người dùng (Exceeds user limit) -> Báo lỗi `400 Bad Request`.
  4. Nếu kịch bản giữ vé thành công (`0`):
     - Khởi tạo trước mã đơn hàng `orderId` theo chuẩn UUID v7.
     - Đẩy message tạo đơn hàng (gồm userId, items, totalAmount) vào RabbitMQ queue `booking_tasks`. Các worker ngầm (Consumer) sẽ đọc và lưu vào bảng `orders`, `tickets` trong database.
     - Đẩy tiếp một message hẹn giờ vào RabbitMQ queue `booking_delay_queue` với cấu hình Message TTL là 10 phút (tương ứng với thời gian hết hạn thanh toán).
  5. Hệ thống trả về trạng thái `202 Accepted` ngay cho client kèm `orderId` và trạng thái đơn hàng là `pending`.

### 2. Xử lý Idempotency (Chống trùng lặp)
- Khi request có truyền `Idempotency-Key`:
  1. Hệ thống kiểm tra trong Redis xem khóa `idempotency:{key}` đã tồn tại hay chưa.
  2. Nếu khóa đang tồn tại và ở trạng thái đang xử lý -> Cản request lại và trả về lỗi `409 Conflict`.
  3. Nếu khóa có kết quả xử lý lưu sẵn (thành công) -> Bỏ qua toàn bộ luồng chạy và trả về nguyên trạng thái (ví dụ `orderId`) từ cache Redis, tránh việc tạo đơn hàng mới.

### 3. Hủy đơn và thu hồi vé (Order Expiration & Inventory Release)
Đảm bảo những vé đã "giữ chỗ" nhưng khán giả không thanh toán sẽ được đưa lại lên kệ.
- **Cơ chế chính (RabbitMQ DLX):**
  1. Message chờ trong `booking_delay_queue` sau khi hết thời gian sống (TTL = 10 phút) sẽ tự động bị đẩy qua `booking_dlx` exchange và đi vào hàng đợi `booking_expired_tasks`.
  2. Consumer chuyên biệt đọc message này, và kiểm tra trạng thái đơn hàng tương ứng trong DB.
  3. Nếu đơn hàng đó vẫn chưa thanh toán (`status = pending`) -> Cập nhật trạng thái trong DB thành `expired`.
  4. Thực thi **Redis Lua Script** (`release-ticket.lua`) để cộng lại lượng tồn kho và trừ đi số vé user đã mua ở giới hạn mua.
- **Cơ chế dự phòng (Cronjob Fallback):**
  1. Định kỳ 15 phút, hệ thống chạy lệnh `expireStaleOrders()` để truy vấn các đơn hàng `pending` đã tạo vượt quá 12 phút (10 phút hết hạn + 2 phút buffer).
  2. Tương tự như Consumer, tiến hành cập nhật DB thành `expired` và thu hồi số vé trên Redis.
  3. Sử dụng khóa phân tán Redis (Redlock) để tránh tình trạng nhiều backend instance cùng chạy lệnh thu hồi vé gây xung đột.

---

## Kịch bản lỗi

1. **Lỗi hết vé dưới tải cao (Overselling Prevention):**
   - **WHEN:** Hàng ngàn request gửi cùng lúc, tồn kho trên Redis chỉ còn 2, user A mua 2, user B mua 1.
   - **THEN:** Lua Script của Redis xử lý thuần tự, request của user A tới trước trừ tồn kho về 0, request của user B tới sau nhận mã `-1`. Hệ thống từ chối yêu cầu của B và trả về `400 Bad Request`.
2. **Lỗi vượt giới hạn người dùng:**
   - **WHEN:** User có giới hạn mua tối đa 2 vé/SVIP. Đã mua 1 vé thành công, gửi yêu cầu mua thêm 2 vé.
   - **THEN:** Lua script tính tổng số vé đã mua (1) + số vé đang yêu cầu (2) = 3 (lớn hơn 2). Trả về mã `-2`. Hệ thống từ chối và báo `400 Bad Request`.
3. **Lỗi gián đoạn khi thực thi giữ chỗ nhiều hạng vé:**
   - **WHEN:** Người dùng mua 2 loại vé (ví dụ VIP và GA). Mã loại VIP giữ thành công nhưng khi giữ GA thì hết vé (bị lỗi `-1`).
   - **THEN:** Hệ thống kích hoạt quy trình *Rollback Reservations*, gọi script `release-ticket.lua` để nhả kho lại đối với loại vé VIP đã lỡ trừ trước đó. Cuối cùng, trả về `400 Bad Request` cho user, không tạo đơn hàng.
4. **Lỗi RabbitMQ không khả dụng:**
   - **WHEN:** Không thể đẩy message yêu cầu vào RabbitMQ queue `booking_tasks`.
   - **THEN:** Code bắt exception, lập tức nhả các vé đã giữ trên Redis, và phản hồi lỗi `500 Internal Server Error`, yêu cầu user thử lại, không để vé bị giữ trong im lặng.
5. **Cronjob dọn rác đơn hàng bị chồng chéo:**
   - **WHEN:** Instance backend 1 đang chạy cronjob thu hồi vé, Instance 2 cũng đến chu kỳ kích hoạt.
   - **THEN:** Instance 2 không giành được Distributed Lock (Redlock) trên Redis -> Lập tức hủy bỏ việc chạy cronjob, ghi log bảo vệ để tránh race condition.

---

## Ràng buộc
- **Atomic Operations:** Bắt buộc sử dụng Redis Lua Script để tương tác với keys `inventory` và `user:bought`. Tuyệt đối không dùng mô hình query `GET` sau đó `SET` trong code NestJS để bảo đảm tính thread-safe.
- **Thống nhất thời gian cấu hình:** Thời gian quy định giữ vé (10 phút) phải được thiết lập đồng bộ giữa Message TTL trên RabbitMQ Delay Queue, tham số `ORDER_EXPIRY_MS` trong Backend và giao diện bộ đếm giờ (Timer) trên client.
- **Data Persistence:** RabbitMQ phải cấu hình queue với `durable: true` và message với `persistent: true`. Điều này để đảm bảo rằng các yêu cầu đặt vé chưa kịp xử lý và các message chờ thời gian timeout không bị mất nếu RabbitMQ server có khởi động lại.

---

## Tiêu chí chấp nhận
- Khả năng chịu tải: Dưới áp lực 1000 requests/s ngay thời điểm mở bán, hệ thống không bao giờ gặp tình trạng bán vé vượt quá tồn kho (overselling) hoặc tài khoản mua vượt quá mức giới hạn per-user.
- Tồn kho hiển thị chính xác: Các keys tồn kho `inventory:{concertId}:{ticketTypeId}` trên Redis được tính toán chính xác và đồng bộ thời gian thực cho luồng mua vé.
- Tự động hoàn lại chỗ: Sau đúng 10 phút tính từ thời gian request được Accepted, nếu webhook thanh toán không được ghi nhận, chỗ sẽ tự động bị huỷ bỏ, xuất hiện lại trên hệ thống (cộng dồn tồn kho Redis) và người dùng khác có thể mua ngay lập tức.
- Yêu cầu trùng lặp bị từ chối: Bất kỳ client nào gọi lại endpoint tạo đơn hàng cùng `Idempotency-Key` trong khoảng thời gian request cũ chưa Timeout sẽ bị chặn lại hoặc trả về kết quả đã lấy được trước đó.
