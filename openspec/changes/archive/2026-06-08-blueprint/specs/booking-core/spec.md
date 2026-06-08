## ADDED Requirements

### Requirement: Đặt vé qua API chịu tải cao
Hệ thống SHALL kiểm tra tồn kho và giới hạn đặt vé của người dùng thông qua Redis Lua Script trước khi gửi nhiệm vụ tạo đơn hàng bất đồng bộ vào RabbitMQ.

#### Scenario: Đặt vé thành công khi còn tồn kho và chưa quá giới hạn mua
- **WHEN** Người dùng gửi yêu cầu đặt 2 vé loại SVIP (giới hạn tối đa là 2 vé/tài khoản) và tồn kho hiện tại trên Redis là 10 vé
- **THEN** Redis Lua script trừ tồn kho thành công, trả về mã thành công, NestJS đẩy tin nhắn vào RabbitMQ và trả về trạng thái HTTP 202 Accepted cho client

#### Scenario: Đặt vé thất bại do hết vé
- **WHEN** Người dùng gửi yêu cầu đặt 3 vé loại SVIP nhưng tồn kho trên Redis chỉ còn 2 vé
- **THEN** Redis Lua script không trừ tồn kho, trả về mã lỗi và NestJS trả về mã lỗi HTTP 400 Bad Request ngay lập tức cho client

#### Scenario: Đặt vé thất bại do vượt quá giới hạn của tài khoản
- **WHEN** Người dùng trước đó đã mua thành công 1 vé loại SVIP và nay gửi yêu cầu mua thêm 2 vé SVIP (trong khi giới hạn tối đa là 2 vé/tài khoản)
- **THEN** Redis Lua script kiểm tra thấy tổng số lượng yêu cầu mới và cũ là 3 (lớn hơn 2), không trừ tồn kho, trả về mã lỗi và NestJS trả về mã lỗi HTTP 400 Bad Request cho client

### Requirement: Idempotency cho luồng đặt vé và thanh toán
Hệ thống SHALL sử dụng trường `Idempotency-Key` trong HTTP Header để đảm bảo một giao dịch đặt vé hoặc thanh toán chỉ được thực hiện tối đa một lần.

#### Scenario: Yêu cầu bị trùng lặp khi đang xử lý
- **WHEN** Khách hàng nhấn nút đặt vé 2 lần liên tiếp và gửi cùng một `Idempotency-Key` trong khoảng thời gian rất ngắn
- **THEN** Hệ thống chặn yêu cầu thứ hai trên Redis và trả về mã lỗi HTTP 409 Conflict

#### Scenario: Yêu cầu bị trùng lặp sau khi đã xử lý xong
- **WHEN** Khách hàng gửi yêu cầu thanh toán với `Idempotency-Key` đã được xử lý thành công trước đó
- **THEN** Hệ thống trả về kết quả đã được lưu sẵn trong cache Redis từ lần giao dịch đầu tiên mà không tạo thêm giao dịch mới trong database

### Requirement: Tự động khôi phục tồn kho cho đơn hàng hết hạn
Hệ thống SHALL giải phóng chỗ giữ tạm và khôi phục số lượng vé tồn kho trên Redis nếu đơn hàng đặt vé không hoàn tất thanh toán trong thời hạn 10 phút.

#### Scenario: Hủy đơn hàng và hồi kho khi hết hạn thanh toán
- **WHEN** Đơn hàng ở trạng thái `pending` đạt quá 10 phút mà không có webhook thanh toán thành công từ VNPAY/MoMo
- **THEN** Hệ thống đổi trạng thái đơn hàng thành `expired` trong database, chạy Lua script để cộng lại tồn kho vé và trừ số lượng vé đã giữ của user trên Redis
