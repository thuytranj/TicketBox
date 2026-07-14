# Đặc tả: Thống kê và Báo cáo (Statistics & Reporting)

## Mô tả
Tính năng Thống kê và Báo cáo (Statistics) cung cấp trang tổng quan (Dashboard) số liệu thời gian thực dành riêng cho Ban tổ chức (`organizer`). Tính năng này phục vụ cho việc theo dõi tiến độ bán vé, doanh thu, và tình hình soát vé tại cổng. Để đối phó với việc dữ liệu lớn và truy vấn tổng hợp (aggregation) nặng trên PostgreSQL, module sử dụng mô hình **Cache-aside** qua Redis với TTL ngắn và cơ chế Fail-open.

Các chức năng chính:
1. **Thống kê tổng quan nền tảng (Overview):** Cung cấp bức tranh toàn cảnh về hệ thống bao gồm: số lượng concert theo trạng thái, số lượng đơn hàng theo trạng thái, tổng doanh thu (chỉ tính đơn `paid`), giá trị trung bình đơn hàng (AOV), tỷ lệ lấp đầy (fill rate) và tỷ lệ soát vé (check-in rate).
2. **Thống kê chi tiết theo Concert:** Phân tích sâu vào một sự kiện cụ thể, bao gồm doanh thu tổng, phân bổ theo từng hạng vé (số lượng phát hành, bán ra, tồn kho, doanh thu từng hạng) và số lượng khách hàng đã soát vé (phân tách rõ giữa khách mua vé và khách mời VIP).
3. **Biểu đồ doanh thu theo thời gian (Time-Series Revenue):** Cung cấp dữ liệu dạng chuỗi thời gian (ngày, tuần, tháng) cho biểu đồ doanh thu, hỗ trợ cả mức độ toàn hệ thống và mức độ từng concert riêng biệt.

---

## Luồng chính

### 1. Truy vấn Dữ liệu Thống kê (Overview & Concert Detail)
- **Endpoints:**
  - `GET /statistics/overview`
  - `GET /statistics/concerts/:id`
- **Quy trình xử lý:**
  1. **Xác thực:** Middleware/Guard kiểm tra JWT và xác thực người dùng phải có vai trò `ORGANIZER`.
  2. **Đọc Cache (Redis):**
     - Hệ thống kiểm tra khóa `stats:overview` hoặc `stats:concert:{concertId}` trên Redis.
     - Nếu có (Cache Hit): Trả về ngay dữ liệu JSON cho client.
     - Nếu lỗi đọc Redis (Timeout/Down): Hệ thống sẽ ghi log cảnh báo và **tiếp tục** (Fail-open) nhảy sang bước truy vấn database thay vì báo lỗi.
  3. **Truy vấn Database (Nếu Cache Miss hoặc Redis lỗi):**
     - Thực thi các câu lệnh `SUM`, `COUNT`, `GROUP BY` trên bảng `orders` (điều kiện `status = PAID`), `ticket_types`, `checkin_logs` (điều kiện `status = VALID`).
     - Xử lý các phép chia tính tỷ lệ (fill rate, checkin rate) và làm tròn 2 chữ số thập phân (`Math.round(val * 100) / 100` hoặc `*10000 / 100`).
  4. **Ghi Cache (Redis):**
     - Kết quả tính toán được tuần tự hóa (JSON.stringify) và lưu ngược lại vào Redis với TTL là **30 giây** (`CACHE_TTL_SECONDS = 30`).
  5. **Phản hồi:** Trả dữ liệu về cho client.

### 2. Truy vấn Biểu đồ Doanh thu (Time Series)
- **Endpoints:**
  - `GET /statistics/revenue?period={day|week|month}&from={date}&to={date}`
  - `GET /statistics/concerts/:id/revenue?period={day|week|month}`
- **Quy trình xử lý:**
  1. Kiểm tra filter thời gian `from` và `to`. Nếu không có, mặc định lấy 30 ngày gần nhất tính đến thời điểm hiện tại.
  2. Tạo khóa cache tương ứng, ví dụ: `stats:revenue:{period}:{from}:{to}` hoặc `stats:concert:{concertId}:revenue:{period}:{from}:{to}`.
  3. Áp dụng quy trình Cache-aside tương tự luồng trên.
  4. Query database sử dụng hàm `DATE_TRUNC(:period, o.created_at)` của PostgreSQL để nhóm dữ liệu doanh thu theo ngày/tuần/tháng và sắp xếp tăng dần theo thời gian.

---

## Kịch bản lỗi

1. **Redis Cache gặp sự cố (Redis Down/Timeout):**
   - **WHEN:** Client gọi API thống kê nhưng server Redis bị sập hoặc quá tải không thể phản hồi.
   - **THEN:** Hệ thống áp dụng cơ chế **Fail-open (Graceful Degradation)**: bỏ qua ngoại lệ đọc cache, tự động fallback sang việc query trực tiếp từ PostgreSQL, trả kết quả thành công cho người dùng và chỉ ghi log lỗi nội bộ để hệ thống cảnh báo.
2. **ID Concert không tồn tại:**
   - **WHEN:** Người dùng truy vấn `GET /statistics/concerts/{id}` với `id` không có trong hệ thống.
   - **THEN:** Hệ thống kiểm tra trước sự tồn tại bằng `concertRepo.findOne`. Trả về lỗi HTTP `404 Not Found` ngay lập tức.
3. **Truy cập trái phép (Unauthorized / Forbidden):**
   - **WHEN:** Người dùng có vai trò `CUSTOMER` (Khán giả) cố tình gọi endpoint `/statistics/overview`.
   - **THEN:** Lớp `RolesGuard` sẽ chặn request, trả về mã lỗi HTTP `403 Forbidden`.
4. **Tham số ID không hợp lệ (Invalid UUID):**
   - **WHEN:** Tham số `:id` trên URL không phải là chuẩn UUID v4/v7.
   - **THEN:** `ParseUUIDPipe` của NestJS chặn lại và trả về `400 Bad Request`.

---

## Ràng buộc
- **Tính toán Doanh thu:** Doanh thu hệ thống hoặc sự kiện MUST chỉ được tính từ các đơn hàng có trạng thái là thanh toán thành công (`PAID`). Không cộng dồn các đơn `pending` hoặc `expired`.
- **Phân tách Khách mời và Khán giả:** Số lượng check-in MUST phân tách rõ lượng check-in từ vé thường (`ticketCheckins`) và từ khách mời VIP (`vipGuestCheckins`). Tỷ lệ soát vé (check-in rate) chỉ được tính trên số lượng vé bán ra, KHÔNG lấy mẫu số từ lượng khách VIP để tránh sai lệch tỷ lệ > 100%.
- **Giới hạn thời gian Cache:** Dữ liệu Dashboard mang tính chất tổng hợp nặng, TTL của Redis MUST được cấu hình ngắn (mặc định 30 giây) để giảm tải đột biến (thundering herd) lên DB nếu có nhiều admin cùng F5 trang, nhưng vẫn đảm bảo độ trễ số liệu ở mức chấp nhận được.
- **Fail-open Caching:** Cơ chế đọc/ghi cache không được phép quăng exception ra ngoài (crash endpoint) mà phải được bọc `try-catch` an toàn.

---

## Tiêu chí chấp nhận
- API trả về đúng cấu trúc JSON, đầy đủ các field: `totalRevenue`, `fillRate`, `checkinRate`, tổng số `active/completed concerts`, tổng số `orders` phân theo trạng thái.
- Các tỷ lệ phần trăm (Fill Rate, Checkin Rate) được làm tròn chính xác 2 chữ số thập phân (ví dụ 95.45%).
- Nếu tắt nóng service Redis (Mô phỏng Redis down), API thống kê vẫn trả về dữ liệu bình thường trơn tru, không gây ra lỗi HTTP 500 cho client.
- Biểu đồ time-series doanh thu trả về mảng dữ liệu có chứa `date`, `revenue`, `orderCount` được sắp xếp đúng theo thứ tự thời gian tuyến tính tăng dần.
