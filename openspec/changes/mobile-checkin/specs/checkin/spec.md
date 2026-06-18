## ADDED Requirements

### Requirement: Xác thực vé ngoại tuyến bằng mã hóa đối xứng HMAC-SHA256
Hệ thống SHALL tạo chữ ký băm HMAC-SHA256 cho mỗi vé khi phát hành sử dụng Shared Secret Key của concert. Ứng dụng soát vé di động SHALL tải Shared Secret Key tương ứng về máy khi trực tuyến, và khi ngoại tuyến, ứng dụng SHALL sử dụng Shared Secret Key này để tự băm đối chiếu và xác minh tính chính chủ cùng tính toàn vẹn của vé từ mã QR ngoại tuyến mà không cần kết nối mạng.

#### Scenario: Xác thực ngoại tuyến thành công
- **WHEN** Nhân viên soát vé quét mã QR chứa thông tin vé đi kèm chữ ký băm HMAC-SHA256 hợp lệ được tạo từ Shared Secret Key tương ứng của concert
- **THEN** Thiết bị sử dụng Shared Secret Key băm đối chiếu thành công và hiển thị thông tin vé hợp lệ

#### Scenario: Xác thực ngoại tuyến thất bại do chữ ký băm không hợp lệ
- **WHEN** Nhân viên soát vé quét mã QR chứa thông tin vé có chữ ký băm không khớp hoặc dữ liệu vé đã bị can thiệp, chỉnh sửa
- **THEN** Thiết bị thông báo lỗi chữ ký không hợp lệ và từ chối check-in

#### Scenario: Xác thực ngoại tuyến thất bại do quét trùng cục bộ trên thiết bị
- **WHEN** Nhân viên soát vé quét mã QR chứa thông tin vé hợp lệ nhưng vé đó đã tồn tại bản ghi check-in trong cơ sở dữ liệu local của thiết bị
- **THEN** Thiết bị cảnh báo vé đã quét trùng trên thiết bị này và từ chối check-in

## MODIFIED Requirements

### Requirement: Đồng bộ hóa dữ liệu soát vé ngoại tuyến
Hệ thống SHALL cho phép đồng bộ các lượt quét vé ngoại tuyến từ thiết bị di động khi phát hiện kết nối mạng được phục hồi và xử lý các lượt quét trùng lặp bằng cách so sánh timestamp soát vé (client timestamp). Lượt soát vé nào có timestamp sớm nhất ("First Timestamp Wins") SHALL được ghi nhận là hợp lệ, còn các lượt soát vé muộn hơn SHALL bị đánh dấu là trùng lặp/bị từ chối.

#### Scenario: Đồng bộ hóa lượt soát vé ngoại tuyến không bị trùng
- **WHEN** Thiết bị soát vé kết nối lại internet và tải lên log soát vé ngoại tuyến cho một vé chưa từng được check-in trên hệ thống
- **THEN** Hệ thống cập nhật trạng thái vé thành `checked_in` trong database chính, ghi log check-in ngoại tuyến với client timestamp và xác nhận đồng bộ thành công

#### Scenario: Đồng bộ hóa xử lý xung đột soát trùng theo quy tắc First Timestamp Wins (Log ngoại tuyến thắng)
- **WHEN** Log soát vé ngoại tuyến từ Thiết bị A có client timestamp là `T1` được tải lên để đồng bộ cho một vé đã được check-in trực tuyến trước đó từ Thiết bị B có timestamp là `T2`, trong đó `T1 < T2`
- **THEN** Hệ thống cập nhật trạng thái vé theo log ngoại tuyến của Thiết bị A, đánh dấu log trực tuyến của Thiết bị B là trùng lặp và ghi nhận cảnh báo để xử lý

#### Scenario: Đồng bộ hóa xử lý xung đột soát trùng theo quy tắc First Timestamp Wins (Log trực tuyến thắng)
- **WHEN** Log soát vé ngoại tuyến từ Thiết bị A có client timestamp là `T2` được tải lên để đồng bộ cho một vé đã được check-in trực tuyến trước đó từ Thiết bị B có timestamp là `T1`, trong đó `T1 < T2`
- **THEN** Hệ thống giữ nguyên trạng thái check-in từ Thiết bị B, đánh dấu log ngoại tuyến của Thiết bị A là trùng lặp và ghi nhận cảnh báo
