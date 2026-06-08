# concert Specification

## Purpose
TBD - created by archiving change blueprint. Update Purpose after archive.
## Requirements
### Requirement: Quản lý thông tin concert và bộ nhớ đệm
Hệ thống SHALL cho phép ban tổ chức tạo concert mới và quản lý thông tin, đồng thời tối ưu hóa truy vấn bằng Cache-aside trên Redis.

#### Scenario: Truy cập thông tin concert thành công từ cache
- **WHEN** Khán giả gửi yêu cầu truy vấn thông tin chi tiết của một concert
- **THEN** Hệ thống kiểm tra cache trên Redis, nếu tồn tại trả về ngay lập tức, ngược lại đọc từ PostgreSQL, lưu vào Redis và trả về kết quả

