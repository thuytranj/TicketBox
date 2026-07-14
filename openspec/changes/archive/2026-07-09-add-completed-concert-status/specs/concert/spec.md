## MODIFIED Requirements

### Requirement: Quản lý thông tin Concert (Concert Management)
Hệ thống SHALL cho phép ban tổ chức tạo concert mới, cập nhật thông tin concert (bao gồm xử lý dọn dẹp ảnh poster cũ trên Cloudinary), hủy concert hoặc xóa concert nếu chưa có bookings nào phát sinh. ConcertStatus bao gồm các trạng thái: `draft`, `active`, `cancelled`, và `completed`.

**Luồng chính:**
1. **Tạo concert:**
   - Ban tổ chức gửi yêu cầu POST đến `/concerts` với các thông tin chi tiết (`title`, `description`, `location`, `posterUrl`, `posterPublicId`, `start_time`, `end_time`, và tùy chọn danh sách `ticket_types`).
   - Hệ thống lưu thông tin concert mới (lưu cả `posterPublicId`) và các loại vé liên kết vào PostgreSQL. Trạng thái mặc định là `draft`.
   - Trả về thông tin chi tiết với mã trạng thái 201 Created.
2. **Cập nhật concert:**
   - Ban tổ chức gửi yêu cầu PATCH đến `/concerts/:id` với thông tin cần cập nhật.
   - Nếu `posterUrl` / `posterPublicId` thay đổi, hệ thống gọi Cloudinary API để xóa ảnh cũ thông qua `posterPublicId` cũ nhằm tránh rác dữ liệu.
   - Cập nhật thông tin trong PostgreSQL.
   - Xóa bộ nhớ đệm Redis của concert đó (khóa `cache:concerts:{id}`, `cache:concerts:{id}:stagemap`, `cache:concerts:{id}:ticket-types`).
   - Xóa toàn bộ khóa danh sách mặc định `cache:concerts:list:default:*`.
   - Trả về thông tin cập nhật với mã trạng thái 200 OK.
3. **Hủy concert:**
   - Ban tổ chức gửi yêu cầu PATCH đến `/concerts/:id` với payload `status: "cancelled"`.
   - Hệ thống cập nhật trạng thái concert thành `cancelled` trong PostgreSQL.
   - Xóa bộ nhớ đệm Redis của concert đó và xóa toàn bộ khóa danh sách mặc định `cache:concerts:list:default:*`.
   - Trả về thông tin cập nhật với mã trạng thái 200 OK.
4. **Xóa concert:**
   - Ban tổ chức gửi yêu cầu DELETE đến `/concerts/:id`.
   - Hệ thống kiểm tra xem concert đã phát sinh đơn đặt vé (bookings) nào chưa.
   - Nếu chưa có bookings, gọi Cloudinary API xóa poster trên Cloudinary bằng `posterPublicId` (nếu có).
   - Thực hiện xóa vật lý concert khỏi PostgreSQL (các loại vé liên quan cũng tự động xóa do ràng buộc dữ liệu).
   - Xóa các khóa cache liên quan (`cache:concerts:{id}`, `cache:concerts:{id}:stagemap`, `cache:concerts:{id}:ticket-types`).
   - Xóa toàn bộ khóa danh sách mặc định `cache:concerts:list:default:*`.
   - Trả về mã trạng thái 200/204 thành công.

**Kịch bản lỗi:**
- Dữ liệu tạo hoặc cập nhật concert không hợp lệ (ví dụ: thiếu tiêu đề, thời gian bắt đầu sau thời gian kết thúc): Trả về HTTP 400 Bad Request.
- Người dùng không có vai trò `organizer`: Trả về HTTP 403 Forbidden.
- Xóa concert đã có ít nhất một đơn đặt vé (bookings): Trả về HTTP 400 Bad Request kèm thông điệp báo lỗi.
- Concert không tồn tại: Trả về HTTP 404 Not Found.

**Ràng buộc:**
- Chỉ tài khoản có vai trò `organizer` mới được thực hiện các thao tác quản lý này.
- Khi cập nhật poster mới hoặc xóa concert, tệp poster cũ tương ứng trên Cloudinary phải được dọn dẹp bằng API xóa của Cloudinary.
- Không cho phép xóa concert khi đã có đơn đặt vé.
- Sau khi cập nhật, hủy hoặc xóa, toàn bộ cache Redis liên quan đến concert đó và cache danh sách concert mặc định phải bị vô hiệu hóa lập tức.

**Tiêu chí chấp nhận:**
- Thông tin concert được đồng bộ chính xác trong PostgreSQL.
- Poster cũ bị xóa hoàn toàn khỏi Cloudinary khi thay đổi hoặc xóa concert.
- Cache Redis được xóa sạch để đảm bảo dữ liệu mới nhất được cập nhật cho khán giả.
- Trả về các mã trạng thái HTTP thích hợp (201 cho tạo mới, 200 cho cập nhật/hủy/xóa).

#### Scenario: Ban tổ chức tạo concert mới thành công
- **WHEN** Ban tổ chức gửi yêu cầu POST đến `/concerts` với thông tin hợp lệ (`title`, `description`, `location`, `posterUrl`, `posterPublicId`, `start_time`, `end_time`, và tùy chọn danh sách `ticket_types`) và tài khoản có vai trò `organizer`
- **THEN** Hệ thống lưu thông tin concert mới (lưu cả `posterPublicId`) và các loại vé liên kết vào PostgreSQL, trả về thông tin chi tiết với mã trạng thái 201

#### Scenario: Ban tổ chức cập nhật thông tin concert thành công
- **WHEN** Ban tổ chức gửi yêu cầu PATCH đến `/concerts/:id` với thông tin cần cập nhật (bao gồm cả `posterUrl` / `posterPublicId` nếu đổi ảnh) và tài khoản có vai trò `organizer`
- **THEN** Hệ thống kiểm tra nếu `posterUrl` thay đổi thì gọi Cloudinary API xóa ảnh cũ bằng `posterPublicId` cũ, cập nhật thông tin trong PostgreSQL, xóa bộ nhớ đệm Redis của concert đó (các khóa `cache:concerts:{id}`, `cache:concerts:{id}:stagemap`, `cache:concerts:{id}:ticket-types`), xóa toàn bộ khóa danh sách mặc định `cache:concerts:list:default:*`, và trả về thông tin cập nhật

#### Scenario: Ban tổ chức hủy concert thành công
- **WHEN** Ban tổ chức gửi yêu cầu PATCH đến `/concerts/:id` với payload `status: "cancelled"` và tài khoản có vai trò `organizer`
- **THEN** Hệ thống cập nhật trạng thái concert thành `cancelled` trong PostgreSQL, xóa bộ nhớ đệm Redis của concert đó (các khóa `cache:concerts:{id}`, `cache:concerts:{id}:stagemap`, `cache:concerts:{id}:ticket-types`), xóa toàn bộ khóa danh sách mặc định `cache:concerts:list:default:*`, và trả về kết quả thành công

#### Scenario: Ban tổ chức xóa concert chưa có bookings thành công
- **WHEN** Ban tổ chức gửi yêu cầu DELETE đến `/concerts/:id` khi concert này chưa có đơn đặt vé (bookings) nào và tài khoản có vai trò `organizer`
- **THEN** Hệ thống thực hiện xóa ảnh trên Cloudinary qua `posterPublicId` (nếu có), thực hiện xóa vật lý concert khỏi PostgreSQL (các loại vé liên quan cũng tự động xóa), xóa các khóa cache Redis tương ứng (`cache:concerts:{id}`, `cache:concerts:{id}:stagemap`, `cache:concerts:{id}:ticket-types`), xóa toàn bộ khóa danh sách mặc định `cache:concerts:list:default:*`, và trả về mã trạng thái 200/204 thành công

#### Scenario: Ban tổ chức xóa concert đã có bookings thất bại
- **WHEN** Ban tổ chức gửi yêu cầu DELETE đến `/concerts/:id` khi concert này đã phát sinh ít nhất một đơn đặt vé (bookings) và tài khoản có vai trò `organizer`
- **THEN** Hệ thống từ chối xóa, không thay đổi database hay cache, và trả về lỗi 400 Bad Request kèm thông điệp báo lỗi


## ADDED Requirements

### Requirement: Tự động chuyển đổi trạng thái Concert hoàn thành (Automatic Concert Completion)
Hệ thống SHALL tự động chuyển trạng thái của concert từ `active` sang `completed` sau khi thời gian kết thúc của concert (`end_time`) đã trôi qua.

#### Scenario: Tự động cập nhật trạng thái concert khi kết thúc
- **WHEN** Thời gian hiện tại vượt quá `end_time` của một concert có trạng thái `active`
- **THEN** Hệ thống cập nhật trạng thái của concert đó thành `completed` trong PostgreSQL và xóa bộ nhớ đệm Redis liên quan
