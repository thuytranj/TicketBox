## ADDED Requirements

### Requirement: API Đăng nhập cho role gate_staff
Hệ thống SHALL cung cấp một API endpoint đăng nhập dành riêng cho vai trò `gate_staff` (ví dụ: `POST /auth/gate-login`). 
- Request payload MUST chứa: `username`, `password`, và `device_id`.
- Response payload khi thành công MUST trả về mã trạng thái 200 OK hoặc 201 Created cùng JSON chứa: `access_token`, `expires_in`, `role` (phải là "gate_staff"), danh sách `assigned_concerts`, và đối tượng `shared_secret_keys`.

#### Scenario: Đăng nhập thành công với tài khoản gate_staff hợp lệ
- **WHEN** Nhân viên gọi API `POST /auth/gate-login` với credentials hợp lệ:
  ```json
  {
    "username": "gate_staff_01",
    "password": "correct_password",
    "device_id": "device-uuid-123"
  }
  ```
- **THEN** Hệ thống trả về trạng thái 200 OK hoặc 201 Created kèm payload:
  ```json
  {
    "access_token": "valid_jwt_token_string",
    "expires_in": 86400,
    "role": "gate_staff",
    "assigned_concerts": ["concert-id-101"],
    "shared_secret_keys": {
      "concert-id-101": "shared_key_hex_value"
    }
  }
  ```

#### Scenario: Đăng nhập thất bại do thông tin tài khoản không chính xác
- **WHEN** Nhân viên gọi API `POST /auth/gate-login` với username hoặc password không chính xác
- **THEN** Hệ thống từ chối yêu cầu và trả về mã trạng thái 401 Unauthorized

### Requirement: Xác thực phân quyền vai trò gate_staff
Hệ thống SHALL đảm bảo chỉ người dùng có vai trò `gate_staff` mới được phép truy cập các API nghiệp vụ soát vé và đồng bộ hóa. Các tài khoản có vai trò khác hoặc token không hợp lệ SHALL bị từ chối truy cập.

#### Scenario: Từ chối truy cập API soát vé đối với tài khoản không có role gate_staff
- **WHEN** Người dùng sử dụng JWT token có role khác (ví dụ: `customer`, `admin`) gọi các API dành riêng cho gate_staff (như API đồng bộ `/api/checkin/sync`)
- **THEN** Hệ thống chặn yêu cầu và trả về mã trạng thái 403 Forbidden

### Requirement: Lưu trữ JWT Access Token và Shared Secret Keys local bảo mật
Ứng dụng di động soát vé SHALL lưu trữ JWT Access Token và các Shared Secret Key nhận được từ API đăng nhập trong bộ nhớ lưu trữ được mã hóa an toàn ở cấp độ hệ điều hành (chẳng hạn như EncryptedSharedPreferences trên Android và Keychain trên iOS) để chống rò rỉ mã token và khóa đối xứng khi thiết bị hoạt động ở chế độ ngoại tuyến.

#### Scenario: Lưu token và khóa đối xứng vào bộ nhớ mã hóa sau đăng nhập thành công
- **WHEN** Ứng dụng di động nhận được JWT Access Token và các Shared Secret Key từ API đăng nhập thành công
- **THEN** Ứng dụng SHALL ghi token và các khóa đối xứng vào Secure Storage của hệ điều hành và kiểm tra việc ghi dữ liệu hoàn tất thành công

#### Scenario: Truy xuất JWT Access Token và Shared Secret Key từ Secure Storage để xác thực local
- **WHEN** Ứng dụng di động thực hiện các tác vụ soát vé hoặc băm đối chiếu ngoại tuyến
- **THEN** Ứng dụng SHALL đọc JWT token và Shared Secret Key tương ứng từ Secure Storage để xác thực quyền hạn và tính toán mã băm vé
