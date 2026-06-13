# Đặc tả: Quản lý thông tin concert và bộ nhớ đệm

## Mô tả
Hệ thống cho phép ban tổ chức tạo concert mới và quản lý thông tin, đồng thời tối ưu hóa truy vấn bằng Cache-aside trên Redis.

## Luồng chính
1. **Tạo concert mới**:
   - Ban tổ chức gửi yêu cầu POST đến `/concerts` kèm payload chứa thông tin buổi diễn và cấu hình loại vé ban đầu.
   - Hệ thống xác thực token và vai trò `organizer` của người dùng.
   - Hệ thống lưu thông tin concert mới và các loại vé liên kết vào PostgreSQL, trả về kết quả thành công.
2. **Cấu hình loại vé riêng biệt**:
   - Ban tổ chức gửi yêu cầu POST đến `/concerts/:concertId/ticket-types` hoặc PATCH đến `/ticket-types/:id`.
   - Hệ thống xác thực quyền organizer.
   - Hệ thống thực hiện thêm mới hoặc cập nhật thông tin loại vé trong database, sau đó xóa cache Redis của concert tương ứng để đảm bảo dữ liệu đồng bộ.
3. **Cập nhật concert**:
   - Ban tổ chức gửi yêu cầu PATCH đến `/concerts/:id` kèm payload cập nhật.
   - Hệ thống xác thực và kiểm tra quyền của organizer.
   - Hệ thống cập nhật PostgreSQL, xóa khóa cache Redis `cache:concerts:{id}` và `cache:concerts:{id}:stagemap`, và trả về kết quả thành công.
4. **Lấy chi tiết concert**:
   - Người dùng gửi yêu cầu GET đến `/concerts/:id`.
   - Hệ thống kiểm tra khóa `cache:concerts:{id}` trên Redis.
   - Nếu tồn tại (Cache Hit), trả về dữ liệu (gồm concert và các loại vé liên quan, không bao gồm cột `svg_stage_map`) ngay lập tức.
   - Nếu không tồn tại (Cache Miss), truy vấn từ PostgreSQL (loại trừ cột `svg_stage_map`, nạp kèm các loại vé), lưu dạng JSON vào Redis với khóa `cache:concerts:{id}` (TTL 600s), và trả về kết quả.
5. **Lấy sơ đồ sân khấu (SVG)**:
   - Người dùng gửi yêu cầu GET đến `/concerts/:id/stagemap`.
   - Hệ thống kiểm tra khóa `cache:concerts:{id}:stagemap` trên Redis.
   - Nếu tồn tại (Cache Hit), trả về chuỗi SVG ngay lập tức.
   - Nếu không tồn tại (Cache Miss), truy vấn cột `svg_stage_map` từ PostgreSQL, lưu vào Redis với khóa `cache:concerts:{id}:stagemap` (TTL 1800s), và trả về kết quả.
6. **Liệt kê danh sách concert**:
   - Người dùng gửi yêu cầu GET đến `/concerts` kèm theo các query parameters tùy chọn (`search`, `location`, `tag`).
   - Hệ thống lọc và tìm kiếm dữ liệu tương ứng trong PostgreSQL và trả về kết quả.
7. **Xóa concert**:
   - Ban tổ chức gửi yêu cầu DELETE đến `/concerts/:id`.
   - Hệ thống kiểm tra xem có đơn đặt vé nào cho concert này chưa.
   - Nếu chưa có, thực hiện xóa vật lý concert và xóa cả hai khóa cache Redis liên quan.
   - Nếu đã có, từ chối và trả về mã lỗi 400.

## Kịch bản lỗi
- **Dữ liệu đầu vào không hợp lệ khi tạo/cập nhật**: Ví dụ: `end_time` nhỏ hơn hoặc bằng `start_time`, thiếu các trường bắt buộc (`title`, `description`, `location`, `start_time`, `end_time`), giá vé âm (`price < 0`), số lượng vé nhỏ hơn hoặc bằng 0. Trả về lỗi 400 Bad Request kèm chi tiết lỗi.
- **Trùng tên loại vé**: Khi tạo loại vé mới trùng tên (ví dụ: tạo 2 loại vé cùng tên "VIP") trên một concert, hệ thống trả về lỗi 400 Bad Request.
- **Không tìm thấy concert hoặc loại vé**: Yêu cầu GET `/concerts/:id`, GET `/concerts/:id/stagemap`, PATCH `/concerts/:id`, DELETE `/concerts/:id` với ID không tồn tại trả về lỗi 404 Not Found.
- **Không có quyền truy cập**: Yêu cầu ghi từ người dùng không phải organizer hoặc không đăng nhập sẽ trả về lỗi 401 Unauthorized hoặc 403 Forbidden.
- **Xóa concert/loại vé đã có bookings**: Ban tổ chức yêu cầu DELETE `/concerts/:id` hoặc DELETE `/ticket-types/:id` nhưng đã phát sinh đơn đặt hàng (bookings), hệ thống trả về lỗi 400 Bad Request kèm thông điệp báo lỗi.
- **Lỗi kết nối Redis**: Khi Redis bị timeout hoặc gặp sự cố kết nối, hệ thống vẫn hoạt động bình thường bằng cách truy vấn trực tiếp PostgreSQL (cơ chế fallback, không ảnh hưởng đến trải nghiệm người dùng).

## Ràng buộc
- **Giới hạn hiệu năng**: Thời gian phản hồi của API chi tiết concert và sơ đồ sân khấu trong trường hợp Cache Hit phải dưới 50ms.
- **Bảo mật**: Chỉ các tài khoản có vai trò `organizer` mới được thực hiện các thao tác ghi dữ liệu (POST, PATCH, DELETE).
- **Tính nhất quán**: Dữ liệu cache trong Redis phải được xóa ngay lập tức khi có thao tác cập nhật, hủy hoặc xóa concert/loại vé để tránh trả về thông tin cũ cho khán giả.

## Tiêu chí chấp nhận
- API `POST /concerts` tạo thành công concert mới trong database kèm các loại vé (nếu có) và trả về mã trạng thái 201.
- API `POST /concerts/:concertId/ticket-types` tạo thành công loại vé mới, không trùng tên trên concert đó và xóa cache concert thành công.
- API `PATCH /ticket-types/:id` cập nhật thành công thông tin loại vé và xóa cache concert liên quan.
- API `DELETE /ticket-types/:id` xóa thành công loại vé khỏi PostgreSQL và xóa cache concert nếu chưa có bookings. Trả về lỗi 400 nếu đã có bookings.
- API `DELETE /concerts/:id` xóa thành công bản ghi khỏi PostgreSQL và Redis nếu chưa có đơn đặt vé. Trả về lỗi 400 nếu đã có đơn đặt vé.
- API `GET /concerts` trả về danh sách các concert thỏa mãn bộ lọc (`search`, `location`, `tag`) từ PostgreSQL.
- Yêu cầu GET `concerts/:id` đầu tiên ghi nhận cache miss (truy vấn DB loại trừ `svg_stage_map` và lưu cache), các yêu cầu tiếp theo ghi nhận cache hit (trả về trực tiếp từ Redis dưới khóa `cache:concerts:{id}`).
- Yêu cầu GET `concerts/:id/stagemap` đầu tiên ghi nhận cache miss (truy vấn DB cột `svg_stage_map` và lưu cache), các yêu cầu tiếp theo ghi nhận cache hit (trả về trực tiếp từ Redis dưới khóa `cache:concerts:{id}:stagemap`).

## MODIFIED Requirements

### Requirement: Quản lý thông tin concert và bộ nhớ đệm
Hệ thống SHALL cho phép ban tổ chức tạo concert mới và quản lý thông tin, đồng thời tối ưu hóa truy vấn bằng Cache-aside trên Redis.

#### Scenario: Ban tổ chức tạo concert mới thành công
- **WHEN** Ban tổ chức gửi yêu cầu POST đến `/concerts` với thông tin hợp lệ (`title`, `description`, `location`, `start_time`, `end_time`, và tùy chọn danh sách `ticket_types`) và tài khoản có vai trò `organizer`
- **THEN** Hệ thống lưu thông tin concert mới và các loại vé liên kết vào PostgreSQL, trả về thông tin chi tiết với mã trạng thái 201

#### Scenario: Ban tổ chức cập nhật thông tin concert thành công
- **WHEN** Ban tổ chức gửi yêu cầu PATCH đến `/concerts/:id` với thông tin cần cập nhật và tài khoản có vai trò `organizer`
- **THEN** Hệ thống cập nhật thông tin trong PostgreSQL, xóa bộ nhớ đệm Redis của concert đó (các khóa `cache:concerts:{id}` và `cache:concerts:{id}:stagemap`), và trả về thông tin cập nhật

#### Scenario: Ban tổ chức hủy concert thành công
- **WHEN** Ban tổ chức gửi yêu cầu PATCH đến `/concerts/:id` với payload `status: "cancelled"` và tài khoản có vai trò `organizer`
- **THEN** Hệ thống cập nhật trạng thái concert thành `cancelled` trong PostgreSQL, xóa bộ nhớ đệm Redis của concert đó (các khóa `cache:concerts:{id}` và `cache:concerts:{id}:stagemap`), và trả về kết quả thành công

#### Scenario: Ban tổ chức xóa concert chưa có bookings thành công
- **WHEN** Ban tổ chức gửi yêu cầu DELETE đến `/concerts/:id` khi concert này chưa có đơn đặt vé (bookings) nào và tài khoản có vai trò `organizer`
- **THEN** Hệ thống thực hiện xóa vật lý concert khỏi PostgreSQL (các loại vé liên quan cũng tự động xóa), xóa các khóa cache Redis tương ứng, và trả về mã trạng thái 200/204 thành công

#### Scenario: Ban tổ chức xóa concert đã có bookings thất bại
- **WHEN** Ban tổ chức gửi yêu cầu DELETE đến `/concerts/:id` khi concert này đã phát sinh ít nhất một đơn đặt vé (bookings) và tài khoản có vai trò `organizer`
- **THEN** Hệ thống từ chối xóa, không thay đổi database hay cache, và trả về lỗi 400 Bad Request kèm thông điệp báo lỗi

#### Scenario: Ban tổ chức thiết lập loại vé mới cho concert thành công
- **WHEN** Ban tổ chức gửi yêu cầu POST đến `/concerts/:concertId/ticket-types` với thông tin loại vé hợp lệ (tên `name` thuộc GA, SVIP, VIP, CAT1, CAT2, giá `price`, `total_quantity`, `max_per_user`, và tùy chọn `sale_start_time`, `sale_end_time` hợp lệ) không trùng tên đã có, và tài khoản có vai trò `organizer`
- **THEN** Hệ thống tạo bản ghi loại vé mới trong PostgreSQL, gán `available_quantity` bằng `total_quantity`, xóa khóa cache Redis `cache:concerts:{concertId}` liên quan, và trả về mã trạng thái 201

#### Scenario: Ban tổ chức thiết lập loại vé với tên không hợp lệ thất bại
- **WHEN** Ban tổ chức gửi yêu cầu cấu hình loại vé với tên không thuộc tập `GA`, `SVIP`, `VIP`, `CAT1`, `CAT2`, và tài khoản có vai trò `organizer`
- **THEN** Hệ thống từ chối lưu và trả về lỗi 400 Bad Request

#### Scenario: Ban tổ chức cấu hình loại vé với thời gian bán không hợp lệ thất bại
- **WHEN** Ban tổ chức gửi yêu cầu cấu hình loại vé (POST `/concerts/:concertId/ticket-types` hoặc PATCH `/ticket-types/:id`) với `sale_start_time` >= `sale_end_time` hoặc `sale_start_time` >= thời gian kết thúc concert, và tài khoản có vai trò `organizer`
- **THEN** Hệ thống từ chối lưu và trả về lỗi 400 Bad Request

#### Scenario: Ban tổ chức cập nhật thông tin loại vé thành công
- **WHEN** Ban tổ chức gửi yêu cầu PATCH đến `/ticket-types/:id` với thông tin cập nhật hợp lệ (bao gồm cập nhật tên phân hạng chuẩn hoặc thời gian mở bán/kết thúc bán) và tài khoản có vai trò `organizer`
- **THEN** Hệ thống cập nhật bản ghi trong PostgreSQL, xóa khóa cache Redis `cache:concerts:{concertId}` của concert liên quan, và trả về mã trạng thái 200 thành công

#### Scenario: Ban tổ chức xóa loại vé thành công khi chưa có bookings
- **WHEN** Ban tổ chức gửi yêu cầu DELETE đến `/ticket-types/:id` của loại vé chưa phát sinh đơn đặt vé (bookings) nào và tài khoản có vai trò `organizer`
- **THEN** Hệ thống xóa bản ghi loại vé khỏi PostgreSQL, xóa khóa cache Redis `cache:concerts:{concertId}` của concert liên quan, và trả về mã trạng thái 200/204 thành công

#### Scenario: Ban tổ chức xóa loại vé thất bại khi đã có bookings
- **WHEN** Ban tổ chức gửi yêu cầu DELETE đến `/ticket-types/:id` của loại vé đã phát sinh ít nhất một đơn đặt vé (bookings) và tài khoản có vai trò `organizer`
- **THEN** Hệ thống từ chối xóa, không thay đổi database hay cache, và trả về lỗi 400 Bad Request kèm thông điệp báo lỗi

#### Scenario: Khán giả truy cập thông tin concert thành công từ cache (Cache Hit)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts/:id` và khóa `cache:concerts:{id}` đã tồn tại trên Redis
- **THEN** Hệ thống lấy thông tin concert bao gồm cả danh sách các loại vé (không bao gồm sơ đồ sân khấu SVG) từ Redis và trả về kết quả ngay lập tức mà không truy vấn PostgreSQL

#### Scenario: Khán giả truy cập thông tin concert thành công từ database (Cache Miss)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts/:id` và khóa `cache:concerts:{id}` chưa có trên Redis
- **THEN** Hệ thống truy vấn thông tin concert (loại trừ cột `svg_stage_map`) cùng các loại vé liên kết từ PostgreSQL, lưu kết quả dạng JSON vào Redis với khóa `cache:concerts:{id}` và thời gian sống (TTL) là 600 giây, sau đó trả về kết quả cho khán giả

#### Scenario: Khán giả truy cập sơ đồ sân khấu thành công từ cache (Cache Hit)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts/:id/stagemap` và khóa `cache:concerts:{id}:stagemap` đã tồn tại trên Redis
- **THEN** Hệ thống lấy nội dung SVG trực tiếp từ Redis và trả về kết quả ngay lập tức mà không truy vấn PostgreSQL

#### Scenario: Khán giả truy cập sơ đồ sân khấu thành công từ database (Cache Miss)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts/:id/stagemap` và khóa `cache:concerts:{id}:stagemap` chưa có trên Redis
- **THEN** Hệ thống truy vấn cột `svg_stage_map` từ PostgreSQL, lưu kết quả vào Redis với khóa `cache:concerts:{id}:stagemap` và thời gian sống (TTL) là 1800 giây, sau đó trả về kết quả cho khán giả

#### Scenario: Khán giả liệt kê danh sách concert thành công
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts` không kèm theo bộ lọc nào
- **THEN** Hệ thống truy vấn danh sách tất cả concert có trạng thái `active` từ PostgreSQL và trả về kết quả

#### Scenario: Khán giả tìm kiếm concert theo từ khóa thành công
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts?search=Rock`
- **THEN** Hệ thống tìm kiếm các concert có `title` hoặc `description` chứa từ khóa "Rock" (không phân biệt chữ hoa thường) và trả về danh sách kết quả

#### Scenario: Khán giả lọc danh sách concert theo địa điểm và tag thành công
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts?location=Hanoi&tag=music`
- **THEN** Hệ thống lọc các concert có địa điểm là "Hanoi" và danh sách tags chứa tag "music", sau đó trả về kết quả
