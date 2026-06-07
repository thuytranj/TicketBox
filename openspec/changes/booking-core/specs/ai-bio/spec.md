## ADDED Requirements

### Requirement: Tự động trích xuất và tóm tắt tiểu sử nghệ sĩ bằng AI
Hệ thống SHALL trích xuất nội dung văn bản từ tệp PDF hồ sơ nghệ sĩ được tải lên, làm sạch dữ liệu và gửi yêu cầu sang mô hình AI để nhận văn bản tóm tắt tiểu sử hiển thị trên trang chi tiết concert.

#### Scenario: Tải lên PDF và tạo tóm tắt thành công
- **WHEN** Ban tổ chức tải lên tệp PDF press kit hợp lệ của nghệ sĩ cho một concert
- **THEN** Hệ thống phân tích văn bản PDF, gọi API Google Gemini AI với prompt tóm tắt và lưu trữ văn bản kết quả vào trường giới thiệu nghệ sĩ của concert đó
