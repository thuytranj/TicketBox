## ADDED Requirements

### Requirement: Đăng ký tài khoản (Register)
**Mô tả:**
Hệ thống cho phép khách truy cập (Guest) đăng ký tài khoản mới bằng cách cung cấp email, mật khẩu và họ tên. Tài khoản mới tạo sẽ ở trạng thái nháp (`pending`). Một mã OTP gồm 6 chữ số ngẫu nhiên được sinh ra, lưu trữ trên Redis và một sự kiện gửi email chứa mã OTP được xuất bản lên RabbitMQ.

**Luồng chính:**
1. Khách truy cập gửi yêu cầu đăng ký (`POST /auth/register`) với email, mật khẩu và họ tên.
2. NestJS thực hiện validate dữ liệu đầu vào.
3. AuthService kiểm tra xem email đã tồn tại trong PostgreSQL chưa.
4. Kiểm tra rate limit gửi OTP trong Redis (nếu tồn tại key `otp_limit:<email>`, báo lỗi).
5. Thực hiện băm (hash) mật khẩu bằng bcrypt với salt rounds = 10.
6. Sinh UUID v7 và lưu bản ghi người dùng mới với vai trò mặc định là `audience` và trạng thái `pending` vào PostgreSQL.
7. Sinh mã OTP gồm 6 chữ số ngẫu nhiên, lưu vào Redis key `otp:<email>` với TTL là 300 giây (5 phút).
8. Thiết lập khóa rate limit `otp_limit:<email>` trên Redis với TTL là 60 giây.
9. Đẩy tác vụ gửi email chứa OTP vào hàng đợi RabbitMQ (`notification.email.otp`).
10. Trả về thông tin người dùng được tạo (không chứa thông tin mật khẩu) và HTTP status code 201 Created.

**Kịch bản lỗi:**
- Email đã tồn tại trong hệ thống: Trả về HTTP 409 Conflict.
- Dữ liệu đầu vào không hợp lệ (email sai định dạng, mật khẩu ngắn hơn 6 ký tự, họ tên trống): Trả về HTTP 400 Bad Request kèm chi tiết lỗi validation.
- Gửi yêu cầu quá nhanh khi chưa hết 60 giây rate limit: Trả về HTTP 429 Too Many Requests.
- Lỗi hệ thống hoặc kết nối cơ sở dữ liệu: Trả về HTTP 500 Internal Server Error.

**Ràng buộc:**
- Email đăng ký phải là duy nhất trên toàn hệ thống.
- Mật khẩu phải dài tối thiểu 6 ký tự.
- Mã OTP phải là chuỗi số gồm đúng 6 chữ số.
- Giới hạn tần suất yêu cầu gửi OTP (Rate limiting) là 60 giây giữa các lần gửi cho cùng một email.

**Tiêu chí chấp nhận:**
- Tạo tài khoản thành công ở trạng thái `pending` trong cơ sở dữ liệu.
- Mã OTP được lưu trữ chính xác trên Redis với thời hạn 5 phút.
- Tác vụ gửi email được đẩy thành công vào RabbitMQ queue `notification.email.otp`.

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
**Mô tả:**
Người dùng cung cấp địa chỉ email và mã OTP để xác thực và kích hoạt tài khoản của họ từ trạng thái nháp (`pending`) sang trạng thái hoạt động (`active`).

**Luồng chính:**
1. Khách gửi yêu cầu xác thực (`POST /auth/verify-otp`) chứa email và mã OTP.
2. Tìm kiếm tài khoản người dùng theo email trong PostgreSQL.
3. Kiểm tra trạng thái tài khoản. Nếu đã ở trạng thái `active`, trả về thông báo thành công.
4. Truy vấn mã OTP tương ứng trong Redis bằng key `otp:<email>`.
5. So khớp mã OTP gửi lên với giá trị lưu trên Redis.
6. Nếu khớp, cập nhật trạng thái người dùng trong PostgreSQL từ `pending` thành `active`.
7. Xóa mã OTP và khóa rate limit liên quan khỏi Redis.
8. Trả về thông báo kích hoạt thành công và HTTP status code 200 OK.

**Kịch bản lỗi:**
- Email không tồn tại: Trả về HTTP 401 Unauthorized.
- Mã OTP sai cấu trúc hoặc không trùng khớp với Redis: Trả về HTTP 401 Unauthorized.
- OTP đã hết hạn hoặc không tồn tại trên Redis: Trả về HTTP 401 Unauthorized.

**Ràng buộc:**
- Mã OTP chỉ có giá trị sử dụng một lần duy nhất. Phải bị xóa ngay lập tức khỏi Redis sau khi xác thực thành công.
- Chỉ kích hoạt được khi tài khoản đang ở trạng thái `pending`.

**Tiêu chí chấp nhận:**
- Trạng thái người dùng chuyển thành `active` trong PostgreSQL.
- Mã OTP bị xóa khỏi Redis và không thể tái sử dụng.
- API trả về HTTP 200 OK.

#### Scenario: Xác thực OTP thành công kích hoạt tài khoản
- **WHEN** Người dùng gửi yêu cầu xác thực OTP chính xác và còn hạn sử dụng cho tài khoản `pending`
- **THEN** Hệ thống cập nhật trạng thái tài khoản thành `active` trong PostgreSQL, xóa OTP trên Redis và trả về HTTP 200 OK

#### Scenario: Xác thực OTP thất bại do sai mã hoặc hết hạn
- **WHEN** Người dùng gửi yêu cầu xác thực với mã OTP sai hoặc mã OTP đã quá hạn 5 phút (không tồn tại trên Redis)
- **THEN** Hệ thống từ chối kích hoạt và trả về HTTP 401 Unauthorized


### Requirement: Yêu cầu gửi lại mã OTP (Resend OTP)
**Mô tả:**
Cho phép người dùng yêu cầu hệ thống gửi lại mã OTP kích hoạt mới trong trường hợp chưa nhận được email hoặc mã OTP cũ đã hết hạn.

**Luồng chính:**
1. Khách gửi yêu cầu gửi lại OTP (`POST /auth/resend-otp`) chứa email.
2. Tìm kiếm tài khoản trong PostgreSQL và kiểm tra xem tài khoản có ở trạng thái `pending` hay không.
3. Kiểm tra khóa rate limit `otp_limit:<email>` trên Redis. Nếu khóa còn tồn tại, từ chối gửi.
4. Sinh mã OTP gồm 6 chữ số mới.
5. Lưu mã OTP mới vào Redis key `otp:<email>` với TTL 300 giây (5 phút).
6. Thiết lập khóa rate limit `otp_limit:<email>` mới với TTL 60 giây.
7. Đẩy tác vụ gửi email OTP mới vào hàng đợi RabbitMQ `notification.email.otp`.
8. Trả về thông báo thành công và HTTP status code 200 OK.

**Kịch bản lỗi:**
- Không tìm thấy tài khoản người dùng: Trả về HTTP 404 Not Found.
- Tài khoản đã ở trạng thái `active`: Trả về HTTP 400 Bad Request.
- Gửi yêu cầu quá nhanh khi chưa hết 60 giây rate limit: Trả về HTTP 429 Too Many Requests.

**Ràng buộc:**
- Chỉ áp dụng cho tài khoản đang ở trạng thái `pending`.
- Áp dụng giới hạn tần suất 60 giây giữa các lần yêu cầu gửi lại.

**Tiêu chí chấp nhận:**
- Mã OTP mới được lưu thành công trên Redis, ghi đè lên mã OTP cũ.
- Tác vụ gửi email mới được đẩy thành công vào RabbitMQ.
- API trả về HTTP 200 OK.

#### Scenario: Gửi lại mã OTP thành công
- **WHEN** Người dùng gửi yêu cầu gửi lại OTP cho tài khoản `pending` sau khi đã quá 60s kể từ lần gửi trước
- **THEN** Hệ thống sinh mã OTP mới, cập nhật trên Redis, đẩy task gửi mail vào RabbitMQ và trả về HTTP 200 OK

#### Scenario: Gửi lại mã OTP thất bại do spam liên tục
- **WHEN** Người dùng gửi yêu cầu gửi lại OTP khi chưa quá 60s kể từ lần gửi trước (Redis vẫn tồn tại key `otp_limit:<email>`)
- **THEN** Hệ thống chặn yêu cầu và trả về HTTP 429 Too Many Requests


### Requirement: Yêu cầu khôi phục mật khẩu (Forgot Password)
**Mô tả:**
Cho phép người dùng đã kích hoạt tài khoản yêu cầu khôi phục mật khẩu bằng cách gửi mã OTP reset qua email.

**Luồng chính:**
1. Khách gửi yêu cầu khôi phục mật khẩu (`POST /auth/forgot-password`) chứa email.
2. Kiểm tra tài khoản tồn tại và phải đang ở trạng thái `active` trong PostgreSQL.
3. Kiểm tra khóa rate limit `reset_otp_limit:<email>` trên Redis. Nếu khóa còn tồn tại, từ chối gửi.
4. Sinh mã OTP khôi phục mật khẩu gồm 6 chữ số ngẫu nhiên.
5. Lưu mã OTP vào Redis key `reset_otp:<email>` với TTL 300 giây (5 phút).
6. Thiết lập khóa rate limit `reset_otp_limit:<email>` trên Redis với TTL 60 giây.
7. Đẩy tác vụ gửi email chứa OTP khôi phục mật khẩu vào RabbitMQ.
8. Trả về thông báo thành công và HTTP status code 200 OK.

**Kịch bản lỗi:**
- Email không tồn tại hoặc tài khoản chưa kích hoạt (`pending`): Trả về HTTP 404 Not Found.
- Gửi yêu cầu quá nhanh khi chưa hết 60 giây rate limit: Trả về HTTP 429 Too Many Requests.

**Ràng buộc:**
- Chỉ áp dụng đối với tài khoản ở trạng thái `active`.
- Sử dụng namespace riêng biệt `reset_otp:<email>` trên Redis để tránh xung đột với OTP kích hoạt tài khoản.
- Áp dụng giới hạn tần suất 60 giây giữa các lần yêu cầu.

**Tiêu chí chấp nhận:**
- Mã OTP reset được lưu trữ đúng trên Redis với TTL 5 phút.
- Tác vụ gửi mail được đẩy thành công vào RabbitMQ.
- API trả về HTTP 200 OK.

#### Scenario: Yêu cầu khôi phục mật khẩu thành công
- **WHEN** Người dùng gửi yêu cầu khôi phục mật khẩu cho email đã kích hoạt (`status='active'`) và chưa bị giới hạn rate limit
- **THEN** Hệ thống sinh mã OTP khôi phục mật khẩu, lưu vào Redis, gửi mail qua RabbitMQ và trả về HTTP 200 OK

#### Scenario: Yêu cầu khôi phục mật khẩu thất bại do tài khoản không tồn tại hoặc chưa active
- **WHEN** Người dùng gửi yêu cầu khôi phục mật khẩu cho một email chưa từng đăng ký hoặc đang ở trạng thái `pending`
- **THEN** Hệ thống từ chối yêu cầu và trả về HTTP 404 Not Found


### Requirement: Xác thực OTP khôi phục mật khẩu (Verify Reset OTP)
**Mô tả:**
Cho phép người dùng xác thực mã OTP reset mật khẩu nhận được qua email. Nếu mã hợp lệ, hệ thống sẽ sinh ra một Reset Token tạm thời lưu trên Redis (TTL 5 phút) để làm bằng chứng cho bước đổi mật khẩu tiếp theo.

**Luồng chính:**
1. Khách gửi yêu cầu xác thực OTP reset mật khẩu (`POST /auth/verify-reset-otp`) chứa email và mã OTP.
2. Tìm kiếm mã OTP reset tương ứng trong Redis key `reset_otp:<email>`.
3. So khớp mã OTP gửi lên với giá trị trong Redis.
4. Nếu khớp, sinh ra một Reset Token ngẫu nhiên (UUID hoặc chuỗi hex ngẫu nhiên).
5. Lưu Reset Token vào Redis key `reset_token:<email>` với TTL 300 giây (5 phút).
6. Xóa mã OTP reset mật khẩu (`reset_otp:<email>`) khỏi Redis.
7. Trả về Reset Token và HTTP status code 200 OK.

**Kịch bản lỗi:**
- Email không tồn tại: Trả về HTTP 404 Not Found.
- Mã OTP reset sai hoặc đã hết hạn: Trả về HTTP 401 Unauthorized.

**Ràng buộc:**
- Mã OTP reset chỉ được sử dụng một lần duy nhất để đổi lấy Reset Token.
- Reset Token trên Redis có thời hạn sử dụng tối đa là 5 phút (300 giây).

**Tiêu chí chấp nhận:**
- Trả về Reset Token khi verify OTP thành công.
- Khóa `reset_otp:<email>` bị xóa khỏi Redis.
- Reset Token được lưu trữ đúng trên Redis với TTL 5 phút.

#### Scenario: Xác thực OTP reset mật khẩu thành công
- **WHEN** Người dùng gửi đúng mã OTP reset hợp lệ còn hạn và email chính xác
- **THEN** Hệ thống sinh Reset Token lưu vào Redis, xóa OTP trên Redis và trả về Reset Token kèm HTTP 200 OK

#### Scenario: Xác thực OTP reset mật khẩu thất bại do OTP sai hoặc hết hạn
- **WHEN** Người dùng gửi yêu cầu xác thực nhưng nhập sai OTP hoặc OTP đã hết hạn (không tồn tại key `reset_otp:<email>`)
- **THEN** Hệ thống từ chối xác thực và trả về HTTP 401 Unauthorized


### Requirement: Đặt mật khẩu mới bằng Reset Token (Reset Password)
**Mô tả:**
Cho phép người dùng đặt mật khẩu mới bằng cách cung cấp địa chỉ email, Reset Token hợp lệ thu được từ bước trước và mật khẩu mới.

**Luồng chính:**
1. Khách gửi yêu cầu đặt lại mật khẩu (`POST /auth/reset-password`) chứa email, Reset Token (`resetToken`) và mật khẩu mới (`newPassword`).
2. Tìm kiếm Reset Token tương ứng trong Redis key `reset_token:<email>`.
3. So khớp Reset Token gửi lên với giá trị lưu trên Redis.
4. Nếu khớp, băm (hash) mật khẩu mới bằng bcrypt với salt rounds = 10.
5. Cập nhật mật khẩu băm mới cho người dùng trong PostgreSQL.
6. Xóa Reset Token (`reset_token:<email>`) và khóa rate limit (`reset_otp_limit:<email>`) khỏi Redis.
7. Thu hồi toàn bộ phiên đăng nhập (Refresh Tokens) của người dùng bằng cách xóa key `refresh_token:<userId>` trên Redis (buộc đăng xuất trên mọi thiết bị).
8. Trả về thông báo thành công và HTTP status code 200 OK.

**Kịch bản lỗi:**
- Email không tồn tại: Trả về HTTP 404 Not Found.
- Reset Token sai hoặc đã hết hạn: Trả về HTTP 401 Unauthorized.
- Mật khẩu mới không hợp lệ (ví dụ ngắn hơn 6 ký tự): Trả về HTTP 400 Bad Request.

**Ràng buộc:**
- Mật khẩu mới phải dài tối thiểu 6 ký tự.
- Reset Token chỉ được sử dụng một lần duy nhất để đổi mật khẩu. Phải bị xóa ngay sau khi đổi mật khẩu thành công.
- Bắt buộc thu hồi tất cả các Refresh Token đang hoạt động của người dùng trên Redis ngay sau khi đổi mật khẩu thành công.

**Tiêu chí chấp nhận:**
- Mật khẩu mới được băm và lưu thành công vào PostgreSQL.
- Khóa `reset_token:<email>` và Refresh Token của người dùng bị xóa hoàn toàn khỏi Redis.
- API trả về HTTP 200 OK.

#### Scenario: Đặt lại mật khẩu thành công bằng Reset Token
- **WHEN** Người dùng gửi đúng Reset Token hợp lệ còn hạn, email chính xác và mật khẩu mới hợp lệ
- **THEN** Hệ thống cập nhật mật khẩu mới trong PostgreSQL, xóa Reset Token trên Redis, thu hồi toàn bộ session đăng nhập và trả về HTTP 200 OK

#### Scenario: Đặt lại mật khẩu thất bại do Reset Token sai hoặc hết hạn
- **WHEN** Người dùng gửi yêu cầu đặt lại mật khẩu với Reset Token sai hoặc đã quá hạn 5 phút (không tồn tại key `reset_token:<email>`)
- **THEN** Hệ thống từ chối cập nhật mật khẩu và trả về HTTP 401 Unauthorized


### Requirement: Đăng nhập hệ thống (Login)
**Mô tả:**
Xác thực người dùng bằng email và mật khẩu. Hệ thống chỉ cho phép đăng nhập đối với các tài khoản đã kích hoạt (`status='active'`). Nếu thông tin chính xác, sinh cặp Access Token (hạn ngắn) và Refresh Token (hạn dài, được hash và lưu trên Redis).

**Luồng chính:**
1. Người dùng gửi yêu cầu đăng nhập (`POST /auth/login`) chứa email và mật khẩu.
2. Tìm kiếm thông tin người dùng theo email trong PostgreSQL.
3. So khớp mật khẩu gửi lên với mật khẩu băm trong database sử dụng bcrypt.
4. Kiểm tra trạng thái tài khoản. Nếu trạng thái là `pending`, từ chối đăng nhập.
5. Nếu thông tin hợp lệ, sinh cặp Access Token (TTL 15 phút, chứa thông tin userId, email, role) và Refresh Token (TTL 7 ngày, chứa userId).
6. Băm Refresh Token bằng SHA-256 rồi lưu vào Redis key `refresh_token:<userId>` với TTL 7 ngày (604800 giây).
7. Trả về cặp tokens (`accessToken`, `refreshToken`) và HTTP status code 200 OK.

**Kịch bản lỗi:**
- Email không tồn tại hoặc mật khẩu không chính xác: Trả về HTTP 401 Unauthorized.
- Tài khoản chưa kích hoạt (`pending`): Trả về HTTP 403 Forbidden kèm yêu cầu xác thực OTP trước.

**Ràng buộc:**
- Chỉ cho phép tài khoản có trạng thái `active` đăng nhập.
- Refresh Token lưu trên Redis phải được hash bảo mật.

**Tiêu chí chấp nhận:**
- Trả về cặp token hợp lệ khi đăng nhập thành công.
- Hash của Refresh Token được lưu trữ đúng trên Redis với TTL 7 ngày.

#### Scenario: Đăng nhập thành công với tài khoản active
- **WHEN** Người dùng gửi yêu cầu đăng nhập với `email` và `password` chính xác và tài khoản ở trạng thái `active`
- **THEN** Hệ thống lưu Refresh Token lên Redis với TTL tương ứng và trả về cặp token (`accessToken`, `refreshToken`) kèm trạng thái HTTP 200 OK

#### Scenario: Đăng nhập thất bại do tài khoản chưa kích hoạt
- **WHEN** Người dùng gửi yêu cầu đăng nhập với tài khoản có `status='pending'` kể cả khi nhập đúng mật khẩu
- **THEN** Hệ thống từ chối đăng nhập và trả về HTTP 403 Forbidden kèm thông báo yêu cầu xác thực OTP trước


### Requirement: Làm mới Access Token (Refresh)
**Mô tả:**
Cho phép client gửi Refresh Token hợp lệ để lấy cặp Access Token và Refresh Token mới (Refresh Token Rotation - RTR) mà không cần người dùng nhập lại mật khẩu.

**Luồng chính:**
1. Client gửi yêu cầu làm mới token (`POST /auth/refresh`) chứa `refreshToken`.
2. Kiểm tra tính hợp lệ của Refresh Token bằng JwtService.
3. Truy vấn thông tin người dùng trong PostgreSQL dựa trên `userId` lấy từ payload của token.
4. Kiểm tra trạng thái tài khoản. Nếu không phải `active`, từ chối.
5. Truy vấn hash Refresh Token đang hoạt động trong Redis key `refresh_token:<userId>`.
6. So khớp hash của Refresh Token gửi lên với hash lưu trên Redis.
7. Nếu không khớp hoặc không tìm thấy (Token Reuse): Hệ thống nghi ngờ có sự xâm nhập, lập tức thu hồi toàn bộ session đăng nhập bằng cách xóa key `refresh_token:<userId>` khỏi Redis và trả về lỗi.
8. Nếu khớp: Sinh cặp Access Token và Refresh Token mới.
9. Băm Refresh Token mới bằng SHA-256 và ghi đè vào Redis key `refresh_token:<userId>` (Token Rotation).
10. Trả về cặp tokens mới và HTTP status code 200 OK.

**Kịch bản lỗi:**
- Refresh Token hết hạn hoặc không hợp lệ: Trả về HTTP 401 Unauthorized.
- Phát hiện tái sử dụng Refresh Token cũ (Token Reuse): Xóa key trong Redis và trả về HTTP 401 Unauthorized.
- Tài khoản người dùng bị khóa hoặc trạng thái không phải `active`: Trả về HTTP 403 Forbidden.

**Ràng buộc:**
- Cơ chế Refresh Token Rotation (RTR) bắt buộc phải được thực thi.
- Nếu phát hiện token cũ được sử dụng lại, toàn bộ session của user phải bị hủy bỏ ngay lập tức.

**Tiêu chí chấp nhận:**
- Trả về cặp token mới hợp lệ.
- Hash của Refresh Token mới được cập nhật trên Redis.

#### Scenario: Làm mới token thành công
- **WHEN** Người dùng gửi yêu cầu POST tới `/auth/refresh` với `refreshToken` khớp với giá trị lưu trên Redis của user đó và token chưa hết hạn
- **THEN** Hệ thống kiểm tra hợp lệ, thu hồi Refresh Token cũ trên Redis, lưu Refresh Token mới và trả về cặp token mới kèm trạng thái HTTP 200 OK


### Requirement: Đăng xuất hệ thống (Logout)
**Mô tả:**
Xóa và vô hiệu hóa Refresh Token tương ứng của người dùng khỏi Redis để kết thúc phiên làm việc.

**Luồng chính:**
1. Người dùng gửi yêu cầu đăng xuất (`POST /auth/logout`) chứa `refreshToken`.
2. Giải mã Refresh Token để lấy `userId`.
3. So khớp hash của Refresh Token gửi lên với hash lưu trong Redis key `refresh_token:<userId>`.
4. Nếu khớp, xóa khóa `refresh_token:<userId>` khỏi Redis.
5. Trả về thông báo đăng xuất thành công và HTTP status code 200 OK.

**Kịch bản lỗi:**
- Refresh Token không hợp lệ hoặc hết hạn: Trả về HTTP 401 Unauthorized.
- Hash không khớp với giá trị lưu trên Redis: Trả về HTTP 401 Unauthorized.

**Ràng buộc:**
- Token sau khi bị xóa khỏi Redis sẽ không thể dùng để refresh được nữa.

**Tiêu chí chấp nhận:**
- Khóa `refresh_token:<userId>` bị xóa hoàn toàn khỏi Redis.
- API trả về HTTP 200 OK.

#### Scenario: Đăng xuất thành công
- **WHEN** Người dùng gửi yêu cầu POST tới `/auth/logout` kèm theo `refreshToken` hợp lệ
- **THEN** Hệ thống xóa khóa Refresh Token tương ứng của người dùng khỏi Redis và trả về trạng thái HTTP 200 OK


### Requirement: Xem thông tin cá nhân (Get Profile)
**Mô tả:**
Cho phép người dùng đã đăng nhập lấy thông tin cá nhân của mình bằng cách gửi Access Token hợp lệ.

**Luồng chính:**
1. Người dùng gửi yêu cầu lấy thông tin cá nhân (`GET /auth/me`) kèm theo Access Token trong Authorization header (Bearer token).
2. Hệ thống đi qua `JwtAuthGuard` để xác thực Access Token.
3. Nếu Access Token hợp lệ, thông tin người dùng được giải mã từ token (userId, email, role) sẽ được đính kèm vào đối tượng request.
4. Trả về thông tin cá nhân của người dùng (không kèm theo mật khẩu) và HTTP status code 200 OK.

**Kịch bản lỗi:**
- Không gửi Access Token hoặc Access Token hết hạn/không hợp lệ: Trả về HTTP 401 Unauthorized.

**Ràng buộc:**
- Endpoint phải được bảo vệ bởi `JwtAuthGuard`.
- Không bao giờ được trả về trường mật khẩu (`passwordHash`).

**Tiêu chí chấp nhận:**
- Trả về thông tin cá nhân chính xác của người dùng đang đăng nhập.
- API trả về HTTP 200 OK.

#### Scenario: Xem thông tin cá nhân thành công
- **WHEN** Người dùng đã đăng nhập gửi yêu cầu `GET /auth/me` kèm theo Access Token hợp lệ
- **THEN** Hệ thống trả về thông tin cá nhân của người dùng (id, email, role) và HTTP 200 OK
