# auth Specification

## Purpose
TBD - created by archiving change blueprint. Update Purpose after archive.
## Requirements
### Requirement: Phân quyền dựa trên vai trò (RBAC)
Hệ thống SHALL kiểm tra JWT token và vai trò của người dùng để quyết định quyền truy cập vào các API endpoints tương ứng.

#### Scenario: Đăng nhập thành công và phân quyền chính xác
- **WHEN** Người dùng gửi yêu cầu đăng nhập hợp lệ và truy cập các API tương ứng với vai trò của mình
- **THEN** Hệ thống cấp JWT và cho phép truy cập các API được phân quyền, đồng thời từ chối truy cập bằng HTTP 403 Forbidden nếu sai vai trò

