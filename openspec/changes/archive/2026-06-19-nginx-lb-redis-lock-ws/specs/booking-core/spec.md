## MODIFIED Requirements

### Requirement: Tự động khôi phục tồn kho cho đơn hàng hết hạn
Hệ thống SHALL giải phóng chỗ giữ tạm và khôi phục số lượng vé tồn kho trên Redis nếu đơn hàng đặt vé không hoàn tất thanh toán trong thời hạn 10 phút. Để tránh chạy trùng lặp khi khởi chạy nhiều worker instances, hệ thống phải sử dụng khóa phân tán Redis Lock trước khi quét và cập nhật trạng thái đơn hàng.

#### Scenario: Hủy đơn hàng và hồi kho khi hết hạn thanh toán
- **WHEN** Đơn hàng ở trạng thái `pending` đạt quá 12 phút mà không có webhook thanh toán thành công, và cronjob giành được khóa phân tán `lock:order-expiration` trên Redis
- **THEN** Hệ thống đổi trạng thái đơn hàng thành `expired` trong database, chạy Lua script để cộng lại tồn kho vé và trừ số lượng vé đã giữ của user trên Redis, sau đó giải phóng khóa phân tán

#### Scenario: Bỏ qua xử lý hủy đơn hàng khi không giành được khóa phân tán
- **WHEN** Cronjob quét đơn hàng hết hạn kích hoạt ở một instance nhưng một instance khác đang giữ khóa `lock:order-expiration` trên Redis
- **THEN** Hệ thống lập tức dừng thực thi luồng xử lý và ghi log bỏ qua để bảo vệ dữ liệu khỏi xung đột tranh chấp (race condition)
