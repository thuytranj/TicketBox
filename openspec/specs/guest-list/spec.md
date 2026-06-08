# guest-list Specification

## Purpose
TBD - created by archiving change blueprint. Update Purpose after archive.
## Requirements
### Requirement: Nhập danh sách khách mời VIP từ CSV
Hệ thống SHALL định kỳ đọc và phân tích tệp CSV chứa thông tin khách mời VIP, thực hiện kiểm tra lỗi dữ liệu, loại bỏ trùng lặp và lưu trữ vào database mà không làm ảnh hưởng đến các hoạt động đặt vé khác.

#### Scenario: Nhập thành công tệp CSV hợp lệ
- **WHEN** Hệ thống chạy tiến trình nhập tệp CSV hợp lệ chứa danh sách khách mời VIP
- **THEN** Hệ thống phân tích toàn bộ dòng dữ liệu, tạo bản ghi khách mời VIP mới trong database và sinh mã hash QR code tương ứng cho từng người

#### Scenario: Bỏ qua dòng lỗi và ghi nhận nhật ký lỗi
- **WHEN** Tệp CSV có một vài dòng bị thiếu thông tin bắt buộc (như thiếu Email) hoặc định dạng không đúng
- **THEN** Hệ thống bỏ qua các dòng lỗi đó, tiếp tục import các dòng hợp lệ khác và ghi nhận danh sách các dòng lỗi vào log hệ thống để xử lý sau

