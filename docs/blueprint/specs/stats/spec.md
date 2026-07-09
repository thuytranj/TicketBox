# Đặc tả: Thống kê và Báo cáo (Statistics & Reporting)

## Mô tả
Tính năng cung cấp trang tổng quan (Dashboard) số liệu thống kê thời gian thực dành riêng cho Ban tổ chức và Quản trị viên hệ thống. Các số liệu bao gồm:
- **Thống kê tổng quan nền tảng:** Tổng số đơn hàng, tổng doanh thu thực tế (chỉ tính các đơn hàng đã thanh toán `paid`), giá trị đơn hàng trung bình (AOV), tỷ lệ bán vé (fill rate) và tỷ lệ soát vé vào cổng (check-in rate).
- **Thống kê chi tiết theo từng Concert:** Doanh thu cụ thể của sự kiện, số lượng vé đã bán trên từng hạng vé, số lượng khách hàng đã soát vé thành công (phân tách rõ rệt giữa vé thường và khách mời VIP).

## Luồng chính
1. **Yêu cầu dữ liệu:** Ban tổ chức hoặc Admin truy cập Dashboard, gửi yêu cầu thông qua API `GET /statistics/overview` hoặc `GET /statistics/concerts/:concertId`.
2. **Xác thực và Phân quyền:** Hệ thống kiểm tra JWT token, xác thực quyền của người dùng (chỉ cho phép vai trò `organizer` hoặc `admin`).
3. **Truy xuất dữ liệu qua Cache (Redis):**
   - Hệ thống kiểm tra xem khóa cache tương ứng (`stats:overview` hoặc `stats:concert:{concertId}:*`) có tồn tại trên Redis hay không.
   - Nếu có (Cache Hit): Trả về dữ liệu thống kê ngay lập tức từ bộ nhớ đệm.
   - Nếu không (Cache Miss):
     - Truy vấn trực tiếp vào PostgreSQL để tính toán tổng doanh thu, số lượng vé và lượt check-in.
     - Lưu kết quả tính toán vào Redis Cache với TTL (Time-To-Live) mặc định.
     - Trả kết quả về cho client.
4. **Đồng bộ và Hủy Cache (Invalidation):**
   - Khi có đơn hàng mới được thanh toán thành công, hoặc trạng thái concert thay đổi (ví dụ: cron job tự động chuyển sang `completed`), hệ thống thực hiện xóa các khóa cache liên quan trên Redis để dữ liệu được làm mới ở lần truy vấn kế tiếp.

## Kịch bản lỗi
1. **Redis Cache gặp sự cố (Timeout/Mất kết nối):**
   - Hệ thống SHALL tự động bỏ qua tầng cache (Bypass) và truy vấn trực tiếp từ PostgreSQL để đảm bảo Dashboard vẫn hoạt động bình thường (Graceful Degradation).
2. **ID Concert không tồn tại hoặc dữ liệu không hợp lệ:**
   - Hệ thống SHALL kiểm tra tính hợp lệ của UUID. Nếu không tồn tại, trả về lỗi `404 Not Found` kèm thông điệp phù hợp.
3. **Người dùng không đủ thẩm quyền (Ví dụ: Khán giả gọi API):**
   - Hệ thống SHALL từ chối yêu cầu và trả về mã lỗi `403 Forbidden`.

## Ràng buộc
- **Tính nhất quán dữ liệu:** Tỷ lệ check-in của vé bán SHALL được tính toán dựa trên số vé soát thực tế chia cho số vé đã bán (không tính gộp khách mời VIP vào mẫu số và tử số của vé bán), đảm bảo tỷ lệ check-in tối đa luôn $\le 100\%$.
- **Hiệu năng truy vấn:** Hệ thống SHALL sử dụng chỉ mục (Index) trên các cột thường xuyên lọc như `o.status`, `cl.status`, `tt.concert_id` để tăng tốc độ tính toán aggregation trên bảng lớn.
- **Bảo mật:** Tất cả các endpoint thống kê MUST yêu cầu xác thực HTTPS và kiểm tra quyền hạn chặt chẽ ở lớp Gateway/Middleware.

## Tiêu chí chấp nhận
- API trả về đúng cấu trúc JSON chứa đầy đủ thông tin doanh thu, số vé, tỷ lệ lấp đầy, và tỷ lệ check-in.
- Tỷ lệ lấp đầy (fill rate) và tỷ lệ soát vé (check-in rate) được làm tròn chính xác đến 2 chữ số thập phân.
- Đảm bảo khi chạy Seed dữ liệu hoặc vận hành thực tế, tỷ lệ check-in hiển thị trên giao diện không bao giờ vượt quá 100%.
- Các khóa cache Redis của concert và của tổng quan hệ thống được xóa sạch hoàn toàn khi có sự kiện chuyển trạng thái sang `completed`.
