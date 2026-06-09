## ADDED Requirements

### Requirement: Đăng ký tài khoản (Register)
**Mô tả:** Hệ thống cho phép người dùng đăng ký tài khoản mới bằng cách cung cấp email, mật khẩu và họ tên. Tài khoản mới tạo ở trạng thái nháp (`pending`). Một mã OTP gồm 6 chữ số ngẫu nhiên được sinh ra, lưu vào Redis với TTL 5 phút, và một tác vụ gửi email chứa OTP được đẩy vào hàng đợi RabbitMQ.

**Luồng chính:**
1. Khách gửi yêu cầu đăng ký (`POST /auth/register`).
2. NestJS validate dữ liệu đầu vào.
3. AuthService kiểm tra email trong PostgreSQL.
4. Hash mật khẩu bằng bcrypt, sinh UUID v7 cho ID người dùng.
5. Lưu bản ghi người dùng với trạng thái `role='audience'` và `status='pending'` vào PostgreSQL.
6. Sinh mã OTP 6 chữ số ngẫu nhiên, lưu vào Redis dạng `otp:<email>` (TTL 300s).
7. Đẩy message chứa thông tin email và mã OTP vào hàng đợi RabbitMQ (`notification.email.otp`).
8. Trả về thông tin người dùng (không kèm mật khẩu) với HTTP 201 Created.

**Ràng buộc:**
- Mật khẩu tối thiểu 6 ký tự.
- Email đăng ký phải là duy nhất.
- Mã OTP chỉ có giá trị trong vòng 5 phút (300 giây).
- Giới hạn tần suất yêu cầu gửi OTP (Rate limiting) là 60 giây giữa các lần gửi.

**Tiêu chí chấp nhận:**
- Tạo tài khoản thành công ở trạng thái `pending`.
- Mã OTP được lưu trữ đúng trên Redis và sự kiện gửi mail được đẩy thành công vào RabbitMQ.

#### Scenario: Đăng ký tài khoản nháp thành công
- **WHEN** Người dùng gửi yêu cầu đăng ký với `email` chưa tồn tại, `password` có độ dài >= 6 ký tự và `fullName` hợp lệ
- **THEN** Hệ thống lưu người dùng mới với trạng thái `pending`, sinh OTP lưu trên Redis và trả về HTTP 201 Created

#### Scenario: Đăng ký tài khoản thất bại do email đã tồn tại
- **WHEN** Người dùng gửi yêu cầu đăng ký với `email` đã có tài khoản tồn tại trong hệ thống
- **THEN** Hệ thống từ chối đăng ký và trả về HTTP 409 Conflict

#### Scenario: Đăng ký tài khoản thất bại do dữ liệu không hợp lệ
- **WHEN** Người dùng gửi yêu cầu đăng ký thiếu `fullName`, hoặc `email` sai định dạng, hoặc `password` ít hơn 6 ký tự
- **THEN** Hệ thống trả về HTTP 400 Bad Request kèm chi tiết lỗi validation


### Requirement: Xác thực OTP kích hoạt tài khoản (Verify OTP)
**Mô tả:** Người dùng cung cấp địa chỉ email và mã OTP để xác thực và kích hoạt tài khoản từ trạng thái `pending` sang trạng thái `active`.

**Luồng chính:**
1. Khách gửi yêu cầu xác thực (`POST /auth/verify-otp`).
2. Tìm kiếm mã OTP tương ứng trong Redis bằng key `otp:<email>`.
3. So sánh mã OTP gửi lên với giá trị lưu trên Redis.
4. Nếu khớp, cập nhật trạng thái người dùng trong PostgreSQL từ `pending` thành `active`.
5. Xóa mã OTP khỏi Redis.
6. Trả về thông báo thành công với HTTP 200 OK.

**Kịch bản lỗi:**
- Gửi OTP sai cấu trúc hoặc không trùng khớp.
- OTP đã hết hạn (không còn tồn tại trên Redis).
- Tài khoản đã ở trạng thái `active` từ trước.

**Ràng buộc:**
- OTP phải bị xóa ngay lập tức khỏi Redis sau khi xác thực thành công.
- Chỉ kích hoạt được khi tài khoản ở trạng thái `pending`.

**Tiêu chí chấp nhận:**
- Trạng thái người dùng chuyển thành `active` trong PostgreSQL và không thể dùng lại mã OTP cũ đó nữa.

#### Scenario: Xác thực OTP thành công kích hoạt tài khoản
- **WHEN** Người dùng gửi yêu cầu xác thực OTP chính xác và còn hạn sử dụng cho tài khoản `pending`
- **THEN** Hệ thống cập nhật trạng thái tài khoản thành `active` trong PostgreSQL, xóa OTP trên Redis và trả về HTTP 200 OK

#### Scenario: Xác thực OTP thất bại do sai mã hoặc hết hạn
- **WHEN** Người dùng gửi yêu cầu xác thực với mã OTP sai hoặc mã OTP đã quá hạn 5 phút (không tồn tại trên Redis)
- **THEN** Hệ thống từ chối kích hoạt và trả về HTTP 401 Unauthorized


### Requirement: Đăng nhập hệ thống (Login)
**Mô tả:** Xác thực người dùng bằng email và mật khẩu. Hệ thống chỉ cho phép các tài khoản đã được kích hoạt (`status='active'`) đăng nhập. Nếu thông tin chính xác, sinh ra cặp Access Token (hạn ngắn) và Refresh Token (hạn dài, lưu trên Redis).

**Kịch bản lỗi:**
- Sai mật khẩu hoặc email không tồn tại.
- Tài khoản chưa được xác thực kích hoạt (`status='pending'`).

#### Scenario: Đăng nhập thành công với tài khoản active
- **WHEN** Người dùng gửi yêu cầu đăng nhập với `email` và `password` chính xác và tài khoản ở trạng thái `active`
- **THEN** Hệ thống lưu Refresh Token lên Redis với TTL tương ứng và trả về cặp token (`accessToken`, `refreshToken`) kèm trạng thái HTTP 200 OK

#### Scenario: Đăng nhập thất bại do tài khoản chưa kích hoạt
- **WHEN** Người dùng gửi yêu cầu đăng nhập với tài khoản có `status='pending'` kể cả khi nhập đúng mật khẩu
- **THEN** Hệ thống từ chối đăng nhập và trả về HTTP 403 Forbidden kèm thông báo yêu cầu xác thực OTP trước

#### Scenario: Đăng nhập thất bại do sai thông tin
- **WHEN** Người dùng gửi yêu cầu đăng nhập với `email` không tồn tại hoặc `password` không trùng khớp
- **THEN** Hệ thống trả về HTTP 401 Unauthorized


### Requirement: Làm mới Access Token
**Mô tả:** Cho phép người dùng đổi Refresh Token lấy Access Token và Refresh Token mới (Token Rotation).

#### Scenario: Làm mới token thành công
- **WHEN** Người dùng gửi yêu cầu POST tới `/auth/refresh` với `refreshToken` khớp với giá trị lưu trên Redis của user đó và token chưa hết hạn
- **THEN** Hệ thống kiểm tra hợp lệ, thu hồi Refresh Token cũ trên Redis, lưu Refresh Token mới và trả về cặp token mới kèm trạng thái HTTP 200 OK

#### Scenario: Làm mới token thất bại do token không hợp lệ hoặc đã bị thu hồi
- **WHEN** Người dùng gửi yêu cầu POST tới `/auth/refresh` với `refreshToken` sai cấu trúc, hoặc đã hết hạn, hoặc không khớp với giá trị trên Redis
- **THEN** Hệ thống từ chối yêu cầu và trả về HTTP 401 Unauthorized


### Requirement: Đăng xuất hệ thống
**Mô tả:** Xóa và vô hiệu hóa Refresh Token tương ứng của người dùng khỏi Redis.

#### Scenario: Đăng xuất thành công
- **WHEN** Người dùng gửi yêu cầu POST tới `/auth/logout` kèm theo `refreshToken` hợp lệ
- **THEN** Hệ thống xóa khóa Refresh Token tương ứng của người dùng khỏi Redis và trả về trạng thái HTTP 200 OK
