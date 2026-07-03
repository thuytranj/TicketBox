## MODIFIED Requirements

### Requirement: Quản lý loại vé (Ticket Type Management)
Hệ thống SHALL cho phép ban tổ chức quản lý cấu hình các loại vé tùy biến liên kết với concert (tự do đặt tên hạng vé mà không giới hạn trong 5 loại cũ), bao gồm giá vé, số lượng tổng và thời gian bán vé.

**Luồng chính:**
1. **Thêm loại vé:**
   - Ban tổ chức gửi yêu cầu POST đến `/concerts/:concertId/ticket-types` với các thông tin (`name`, `price`, `total_quantity`, `max_per_user`, `sale_start_time`, `sale_end_time`).
   - Hệ thống tạo bản ghi loại vé mới trong PostgreSQL, tự động gán `available_quantity` bằng `total_quantity`.
   - Xóa khóa cache Redis `cache:concerts:{concertId}:ticket-types` của concert liên quan.
   - Xóa toàn bộ khóa danh sách mặc định `cache:concerts:list:default:*`.
   - Trả về mã trạng thái 201 Created.
2. **Cập nhật loại vé:**
   - Ban tổ chức gửi yêu cầu PATCH đến `/ticket-types/:id` với thông tin cập nhật.
   - Hệ thống cập nhật bản ghi trong PostgreSQL.
   - Xóa khóa cache Redis `cache:concerts:{concertId}:ticket-types` của concert liên quan.
   - Xóa toàn bộ khóa danh sách mặc định `cache:concerts:list:default:*`.
   - Trả về mã trạng thái 200 OK.
3. **Xóa loại vé:**
   - Ban tổ chức gửi yêu cầu DELETE đến `/ticket-types/:id`.
   - Hệ thống kiểm tra xem loại vé đã có đơn đặt vé nào chưa.
   - Nếu chưa, thực hiện xóa loại vé khỏi PostgreSQL, đồng thời xóa cache cấu hình vé và cache danh sách concert mặc định.
   - Trả về mã trạng thái 200/204 thành công.

**Kịch bản lỗi:**
- Tên loại vé trống hoặc không hợp lệ: Trả về HTTP 400 Bad Request.
- Tên loại vé bị trùng lặp trong cùng một concert: Trả về HTTP 400 Bad Request.
- Thời gian mở bán và kết thúc bán không hợp lệ (ví dụ: `sale_start_time` >= `sale_end_time` hoặc `sale_start_time` >= thời gian kết thúc concert): Trả về HTTP 400 Bad Request.
- Xóa loại vé đã phát sinh đơn đặt vé: Trả về HTTP 400 Bad Request.
- Người dùng không có vai trò `organizer`: Trả về HTTP 403 Forbidden.

**Ràng buộc:**
- Tên loại vé có thể là bất kỳ chuỗi ký tự không trống nào, nhưng bắt buộc phải là duy nhất đối với concert đó.
- Thời gian bán vé (`sale_start_time` và `sale_end_time`) phải hợp lệ logic và nằm trong thời gian diễn ra concert.
- Không được xóa loại vé nếu đã có vé được đặt thành công (bookings > 0).

**Tiêu chí chấp nhận:**
- Cập nhật cơ sở dữ liệu thành công cho các thao tác thêm, sửa, xóa loại vé.
- Các khóa cache liên quan đến loại vé của concert bị xóa sạch khỏi Redis.

#### Scenario: Ban tổ chức thiết lập loại vé mới cho concert thành công
- **WHEN** Ban tổ chức gửi yêu cầu POST đến `/concerts/:concertId/ticket-types` với thông tin loại vé hợp lệ (tên `name` tùy ý ví dụ "Standard Zone A", giá `price`, `total_quantity`, `max_per_user`, và tùy chọn `sale_start_time`, `sale_end_time` hợp lệ) không trùng tên đã có trong concert đó, và tài khoản có vai trò `organizer`
- **THEN** Hệ thống tạo bản ghi loại vé mới trong PostgreSQL, gán `available_quantity` bằng `total_quantity`, xóa khóa cache Redis `cache:concerts:{concertId}:ticket-types` liên quan, xóa toàn bộ khóa danh sách mặc định `cache:concerts:list:default:*`, và trả về mã trạng thái 201

#### Scenario: Ban tổ chức thiết lập loại vé với tên rỗng thất bại
- **WHEN** Ban tổ chức gửi yêu cầu cấu hình loại vé với tên `name` để trống hoặc rỗng, và tài khoản có vai trò `organizer`
- **THEN** Hệ thống từ chối lưu và trả về lỗi 400 Bad Request

#### Scenario: Ban tổ chức thiết lập trùng tên loại vé trong cùng một concert thất bại
- **WHEN** Ban tổ chức gửi yêu cầu tạo loại vé mới có tên `name` trùng lặp với một loại vé đã tồn tại của concert đó, và tài khoản có vai trò `organizer`
- **THEN** Hệ thống từ chối lưu, không tạo bản ghi mới và trả về lỗi 400/409 Bad Request

#### Scenario: Ban tổ chức cấu hình loại vé với thời gian bán không hợp lệ thất bại
- **WHEN** Ban tổ chức gửi yêu cầu cấu hình loại vé (POST `/concerts/:concertId/ticket-types` hoặc PATCH `/ticket-types/:id`) với `sale_start_time` >= `sale_end_time` hoặc `sale_start_time` >= thời gian kết thúc concert, và tài khoản có vai trò `organizer`
- **THEN** Hệ thống từ chối lưu và trả về lỗi 400 Bad Request

#### Scenario: Ban tổ chức cập nhật thông tin loại vé thành công
- **WHEN** Ban tổ chức gửi yêu cầu PATCH đến `/ticket-types/:id` với thông tin cập nhật hợp lệ (ví dụ đổi tên hạng vé thành "Fanzone Left") không trùng lặp trong concert, và tài khoản có vai trò `organizer`
- **THEN** Hệ thống cập nhật bản ghi trong PostgreSQL, xóa khóa cache Redis `cache:concerts:{concertId}:ticket-types` của concert liên quan, xóa toàn bộ khóa danh sách mặc định `cache:concerts:list:default:*`, và trả về mã trạng thái 200 thành công

#### Scenario: Ban tổ chức xóa loại vé thành công khi chưa có bookings
- **WHEN** Ban tổ chức gửi yêu cầu DELETE đến `/ticket-types/:id` của loại vé chưa phát sinh đơn đặt vé (bookings) nào và tài khoản có vai trò `organizer`
- **THEN** Hệ thống xóa bản ghi loại vé khỏi PostgreSQL, xóa khóa cache Redis `cache:concerts:{concertId}:ticket-types` của concert liên quan, xóa toàn bộ khóa danh sách mặc định `cache:concerts:list:default:*`, và trả về mã trạng thái 200/204 thành công

#### Scenario: Ban tổ chức xóa loại vé thất bại khi đã có bookings
- **WHEN** Ban tổ chức gửi yêu cầu DELETE đến `/ticket-types/:id` của loại vé đã phát sinh ít nhất một đơn đặt vé (bookings) và tài khoản có vai trò `organizer`
- **THEN** Hệ thống từ chối xóa, không thay đổi database hay cache, và trả về lỗi 400 Bad Request kèm thông điệp báo lỗi
