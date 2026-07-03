# checkin Specification

## Purpose
TBD - created by archiving change blueprint. Update Purpose after archive.
## Requirements
### Requirement: Soát vé trực tuyến chống quét trùng
Hệ thống SHALL xác thực trạng thái vé khi quét mã QR trực tiếp trên hệ thống và đánh dấu là đã kiểm tra để ngăn chặn quét vé nhiều lần.

#### Scenario: Soát vé trực tuyến thành công lần đầu
- **WHEN** Nhân viên soát vé quét mã QR của một vé chưa được check-in và gửi yêu cầu trực tuyến lên API
- **THEN** Hệ thống cập nhật trạng thái vé thành `checked_in` trong database, ghi log check-in và trả về thông báo vé hợp lệ

#### Scenario: Soát vé trực tuyến thất bại do quét trùng
- **WHEN** Nhân viên soát vé quét mã QR của một vé đã có trạng thái `checked_in` trong database
- **THEN** Hệ thống từ chối check-in và trả về thông báo lỗi vé đã được sử dụng trước đó

### Requirement: Đồng bộ hóa dữ liệu soát vé ngoại tuyến
Hệ thống SHALL cho phép đồng bộ các lượt quét vé ngoại tuyến từ thiết bị di động khi phát hiện kết nối mạng được phục hồi và kiểm tra tính hợp lệ một lần nữa ở database chính.

#### Scenario: Đồng bộ hóa lượt soát vé ngoại tuyến không bị trùng
- **WHEN** Thiết bị soát vé kết nối lại internet và tải lên log soát vé ngoại tuyến cho một vé chưa từng được check-in trên hệ thống
- **THEN** Hệ thống cập nhật trạng thái vé thành `checked_in` trong database chính, ghi log check-in ngoại tuyến và xác nhận đồng bộ thành công

#### Scenario: Phát hiện vé bị quét trùng khi đồng bộ ngoại tuyến
- **WHEN** Thiết bị soát vé ngoại tuyến tải lên log check-in cho một vé đã được check-in trên một thiết bị khác trực tuyến trước đó
- **THEN** Hệ thống đánh dấu log check-in này là bị trùng lặp, ghi nhận cảnh báo gian lận và thông báo cho nhân viên quản trị

