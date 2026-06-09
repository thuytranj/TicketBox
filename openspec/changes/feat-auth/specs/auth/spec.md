## ADDED Requirements

### Requirement: Đăng ký tài khoản
Hệ thống SHALL cho phép người dùng đăng ký tài khoản mới bằng cách cung cấp email, mật khẩu và họ tên. Hệ thống SHALL mã hóa mật khẩu trước khi lưu trữ và đặt vai trò mặc định của người dùng đăng ký mới là `audience`.

#### Scenario: Đăng ký tài khoản thành công
- **WHEN** Người dùng gửi yêu cầu đăng ký với `email` chưa tồn tại, `password` có độ dài >= 6 ký tự và `fullName` hợp lệ
- **THEN** Hệ thống lưu người dùng mới vào database với mật khẩu đã mã hóa, role mặc định là `audience`, và trả về thông tin tài khoản (không bao gồm password) với HTTP 201 Created

#### Scenario: Đăng ký tài khoản thất bại do email đã tồn tại
- **WHEN** Người dùng gửi yêu cầu đăng ký với `email` đã có tài khoản tồn tại trong hệ thống
- **THEN** Hệ thống từ chối đăng ký và trả về HTTP 409 Conflict

#### Scenario: Đăng ký tài khoản thất bại do dữ liệu không hợp lệ
- **WHEN** Người dùng gửi yêu cầu đăng ký thiếu `fullName`, hoặc `email` sai định dạng, hoặc `password` ít hơn 6 ký tự
- **THEN** Hệ thống trả về HTTP 400 Bad Request kèm chi tiết lỗi validation

### Requirement: Đăng nhập hệ thống
Hệ thống SHALL xác thực người dùng bằng email và mật khẩu. Nếu thông tin chính xác, hệ thống SHALL sinh ra cặp Access Token (hạn ngắn) và Refresh Token (hạn dài, lưu trên Redis).

#### Scenario: Đăng nhập thành công
- **WHEN** Người dùng gửi yêu cầu đăng nhập với `email` và `password` chính xác
- **THEN** Hệ thống lưu Refresh Token lên Redis với TTL tương ứng và trả về cặp token (`accessToken`, `refreshToken`) kèm trạng thái HTTP 200 OK

#### Scenario: Đăng nhập thất bại do sai thông tin
- **WHEN** Người dùng gửi yêu cầu đăng nhập với `email` không tồn tại hoặc `password` không trùng khớp
- **THEN** Hệ thống trả về HTTP 401 Unauthorized

### Requirement: Lấy thông tin cá nhân
Hệ thống SHALL cho phép người dùng đã đăng nhập truy vấn thông tin cá nhân hiện tại của họ bằng JWT Access Token.

#### Scenario: Lấy thông tin cá nhân thành công
- **WHEN** Người dùng gửi yêu cầu GET tới `/auth/me` kèm theo JWT Access Token hợp lệ trong Header `Authorization: Bearer <token>`
- **THEN** Hệ thống giải mã token thành công và trả về thông tin `{ userId, email, role }` của người dùng đó kèm trạng thái HTTP 200 OK

#### Scenario: Truy cập thất bại do không có hoặc token không hợp lệ
- **WHEN** Người dùng gửi yêu cầu GET tới `/auth/me` nhưng không truyền token hoặc truyền token không hợp lệ/hết hạn
- **THEN** Hệ thống từ chối truy cập và trả về HTTP 401 Unauthorized

### Requirement: Làm mới Access Token
Hệ thống SHALL cho phép người dùng sử dụng Refresh Token hợp lệ còn thời hạn để đổi lấy Access Token mới và Refresh Token mới (Token Rotation).

#### Scenario: Làm mới token thành công
- **WHEN** Người dùng gửi yêu cầu POST tới `/auth/refresh` với `refreshToken` khớp với giá trị lưu trên Redis của user đó và token chưa hết hạn
- **THEN** Hệ thống kiểm tra hợp lệ, thu hồi Refresh Token cũ trên Redis, lưu Refresh Token mới và trả về cặp token mới kèm trạng thái HTTP 200 OK

#### Scenario: Làm mới token thất bại do token không hợp lệ hoặc đã bị thu hồi
- **WHEN** Người dùng gửi yêu cầu POST tới `/auth/refresh` với `refreshToken` sai cấu trúc, hoặc đã hết hạn, hoặc không khớp với giá trị trên Redis
- **THEN** Hệ thống từ chối yêu cầu và trả về HTTP 401 Unauthorized

### Requirement: Đăng xuất hệ thống
Hệ thống SHALL cho phép người dùng đăng xuất bằng cách vô hiệu hóa và xóa bỏ Refresh Token tương ứng của họ khỏi Redis.

#### Scenario: Đăng xuất thành công
- **WHEN** Người dùng gửi yêu cầu POST tới `/auth/logout` kèm theo `refreshToken` hợp lệ
- **THEN** Hệ thống xóa khóa Refresh Token tương ứng của người dùng khỏi Redis và trả về trạng thái HTTP 200 OK
