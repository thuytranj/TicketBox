## ADDED Requirements

### Requirement: Phân quyền dựa trên vai trò (RBAC)
Hệ thống SHALL kiểm tra JWT token và vai trò của người dùng để quyết định quyền truy cập vào các API endpoints tương ứng.

#### Scenario: Ban tổ chức truy cập trang quản trị thành công
- **WHEN** Người dùng có role là `ban tổ chức` thực hiện yêu cầu POST `/concerts` để tạo concert mới
- **THEN** Hệ thống xác thực token hợp lệ và cho phép thực hiện thao tác tạo concert

#### Scenario: Khán giả không được phép truy cập trang quản trị
- **WHEN** Người dùng có role là `khán giả` thực hiện yêu cầu POST `/concerts` để tạo concert mới
- **THEN** Hệ thống từ chối yêu cầu và trả về lỗi HTTP 403 Forbidden

#### Scenario: Nhân viên soát vé chỉ truy cập được API soát vé
- **WHEN** Người dùng có role là `soát vé` thực hiện yêu cầu POST `/checkin/scan`
- **THEN** Hệ thống cho phép thực hiện quét vé và xác nhận thành công
