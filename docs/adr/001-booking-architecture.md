# ADR 001 - Kiến trúc hệ thống Booking Core

**Status**: Accepted  
**Date**: 2026-06-17  
**Authors**: TicketBox Team

---

## Context

Hệ thống TicketBox cần xử lý luồng đặt vé với các yêu cầu khắt khe:

1. **High Concurrency**: Khi mở bán vé cho các concert lớn, có thể có hàng chục nghìn người dùng đồng thời gửi yêu cầu đặt vé trong cùng một thời điểm.
2. **Data Integrity**: Không được phép xảy ra tình trạng "Overbooking" (bán lố số lượng vé) hay vượt quá giới hạn mua vé cho mỗi user.
3. **Double Charge Protection**: Cùng một giao dịch không được tạo ra hai đơn hàng giống hệt nhau, dù client gửi lại request nhiều lần do lỗi mạng.
4. **Order Lifecycle Management**: Các đơn hàng chưa được thanh toán sau 10 phút phải được tự động hủy và hoàn lại tồn kho vé.
5. **API Protection**: API đặt vé phải được bảo vệ khỏi các cuộc tấn công spam/DDoS.

---

## Decisions

### Decision 1: Redis Lua Script cho kiểm tra và trừ tồn kho

**Phương án đã xem xét:**
- **A) Pessimistic Locking (Database-level lock)**: Dùng `SELECT ... FOR UPDATE` để khoá hàng trong DB.
- **B) Optimistic Locking (Version column)**: Dùng trường `version` để phát hiện xung đột và retry.
- **C) Redis Lua Script**: Thực hiện kiểm tra và trừ kho atomically trên Redis.

**Quyết định: Chọn phương án C - Redis Lua Script**

**Lý do:**
- Lua Script trên Redis đảm bảo tính **Atomic** tuyệt đối (Redis là single-threaded), không có race condition.
- Redis hoạt động **in-memory** nên hiệu năng cao hơn DB lock hàng chục lần, phù hợp với bài toán high-throughput.
- Pessimistic Locking tạo ra database bottleneck khi có nhiều concurrent requests, gây deadlock tiềm ẩn.
- Optimistic Locking đòi hỏi retry logic phức tạp và vẫn gây tải lên DB khi xung đột nhiều.

**Hệ quả:**
- Cần warm-up dữ liệu tồn kho vé lên Redis khi concert được publish.
- Cần cơ chế đồng bộ nếu Redis gặp sự cố (Redis Persistence + Backup Cronjob).

---

### Decision 2: RabbitMQ Message Broker cho lưu đơn hàng bất đồng bộ

**Phương án đã xem xét:**
- **A) Synchronous DB Insert**: Lưu đơn hàng vào DB ngay trong request handler.
- **B) RabbitMQ async queue**: Đẩy tác vụ vào queue và trả 202 Accepted ngay lập tức.

**Quyết định: Chọn phương án B - RabbitMQ async queue**

**Lý do:**
- Tách biệt API layer (nhận request) và Database layer (lưu dữ liệu), giảm tải đột biến cho DB.
- Client nhận phản hồi ngay lập tức (202 Accepted), UX tốt hơn.
- RabbitMQ đã được cấu hình sẵn trong dự án (`RabbitMQModule`, `RabbitMQService`).
- Phù hợp với pattern đang dùng cho Notification module.

**Hệ quả:**
- Trạng thái đơn hàng ban đầu là `pending`, client cần polling hoặc WebSocket để biết trạng thái.

---

### Decision 3: RabbitMQ DLX kết hợp Cronjob để xử lý đơn hàng hết hạn

**Phương án đã xem xét:**
- **A) Cronjob đơn thuần**: Chạy mỗi phút để quét DB tìm đơn hàng quá 10 phút.
- **B) RabbitMQ DLX (Dead Letter Exchange)**: Đẩy message với TTL = 10 phút, khi hết hạn tự chuyển sang DLX consumer.
- **C) Kết hợp cả DLX (Primary) + Cronjob (Backup)**: Dùng cả hai.

**Quyết định: Chọn phương án C - DLX (Primary) + Cronjob (Backup)**

**Lý do:**
- **DLX** xử lý chính xác theo từng đơn hàng (event-driven), không cần polling DB liên tục, hoàn toàn bất đồng bộ.
- **Cronjob** làm safety net, đảm bảo không có đơn hàng nào bị bỏ sót nếu DLX message bị drop hoặc consumer gặp sự cố.
- Cơ chế kép (Defense in Depth) đảm bảo độ tin cậy cao cho vòng đời đơn hàng.

**Hệ quả:**
- Cần cấu hình queue DLX bổ sung (`booking_delay_queue` + `booking_dlx` exchange).
- Cronjob quét với buffer 12 phút (thay vì 10 phút) để nhường DLX chạy trước, tránh trùng lặp.

---

### Decision 4: Idempotency Guard với Redis

**Phương án đã xem xét:**
- **A) Database unique constraint**: Dùng `UNIQUE` constraint trên cột `idempotency_key` trong bảng `orders`.
- **B) Redis distributed lock**: Lưu `Idempotency-Key` trong Redis với TTL.

**Quyết định: Chọn phương án B - Redis distributed lock**

**Lý do:**
- Redis cho phép check-and-set cực nhanh, phù hợp với lớp bảo vệ đầu tiên trước khi request chạm tới DB.
- Database constraint là lớp bảo vệ thứ hai (fallback), giảm tải cho DB khi có request trùng lặp liên tục.
- Redis TTL tự động dọn dẹp cache sau một khoảng thời gian nhất định.

---

### Decision 5: Rate Limiting với @nestjs/throttler

**Phương án đã xem xét:**
- **A) API Gateway rate limiting**: Cấu hình tại tầng gateway (Nginx, Kong).
- **B) Application-level rate limiting**: Dùng `@nestjs/throttler` tích hợp trong NestJS.

**Quyết định: Chọn phương án B - @nestjs/throttler**

**Lý do:**
- Dự án chưa có API Gateway, việc thêm tầng này sẽ tăng độ phức tạp hạ tầng không cần thiết trong giai đoạn hiện tại.
- `@nestjs/throttler` cung cấp cấu hình linh hoạt theo từng endpoint, tích hợp trơn tru với NestJS ecosystem.
- Dễ nâng cấp lên Redis-backed throttler (để scale horizontal) mà không cần thay đổi code.

---

## Consequences

- Kiến trúc đảm bảo **Zero Overbooking** và **No Double Charge** trong điều kiện concurrent cao.
- Hệ thống có độ sẵn sàng cao (High Availability) nhờ cơ chế backup Cronjob.
- Mỗi quyết định thiết kế đều ưu tiên **performance** và **reliability** hơn **simplicity** vì đây là business-critical feature.
