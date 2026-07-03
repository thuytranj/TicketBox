# concert Specification

## Purpose
TBD - created by archiving change blueprint. Update Purpose after archive.

## Requirements

### Requirement: Tải lên poster lên Cloudinary (Upload Poster)
**Mô tả:**
Hệ thống cho phép ban tổ chức (organizer) tải hình ảnh poster concert của họ lên Cloudinary thông qua API. Hệ thống nhận tệp tin hình ảnh và truyền trực tiếp qua stream lên Cloudinary để lưu trữ bảo mật.

**Luồng chính:**
1. Ban tổ chức gửi yêu cầu POST đến `/concerts/upload-poster` kèm tệp tin hình ảnh (chấp nhận `.jpg`, `.jpeg`, `.png` hoặc `.webp`, dung lượng tối đa 10MB) và token xác thực hợp lệ có vai trò `organizer`.
2. Hệ thống kiểm tra vai trò người dùng và xác thực token.
3. Hệ thống kiểm tra dung lượng và định dạng tệp tin.
4. Hệ thống truyền trực tiếp dữ liệu tệp tin qua stream lên Cloudinary.
5. Cloudinary xử lý hình ảnh và trả về URL ảnh dạng HTTPS cùng với `publicId` định danh ảnh.
6. Hệ thống trả về `url` và `publicId` cho client với mã trạng thái 201 Created.

**Kịch bản lỗi:**
- Tài khoản không có vai trò `organizer`: Trả về HTTP 403 Forbidden.
- Định dạng tệp tin không hợp lệ hoặc dung lượng vượt quá 10MB: Trả về HTTP 400 Bad Request.
- Lỗi kết nối hoặc xử lý từ Cloudinary: Trả về HTTP 500 Internal Server Error.

**Ràng buộc:**
- Chỉ cho phép các vai trò `organizer` gọi API này.
- Dung lượng file tối đa là 10MB.
- Định dạng file chỉ chấp nhận các đuôi: `.jpg`, `.jpeg`, `.png`, `.webp`.

**Tiêu chí chấp nhận:**
- Trả về `url` ảnh bắt đầu bằng `https://` và `publicId` hợp lệ từ Cloudinary.
- API phản hồi với mã trạng thái 201 Created.

#### Scenario: Ban tổ chức tải lên ảnh poster thành công
- **WHEN** Ban tổ chức gửi yêu cầu POST đến `/concerts/upload-poster` kèm tệp tin hình ảnh hợp lệ (dung lượng <= 10MB, định dạng `.jpg`, `.jpeg`, `.png` hoặc `.webp`) và tài khoản có vai trò `organizer`
- **THEN** Hệ thống truyền trực tiếp dữ liệu tệp tin qua stream lên Cloudinary, lưu trữ và trả về URL ảnh dạng HTTPS cùng với `publicId` với mã trạng thái 201

#### Scenario: Ban tổ chức tải lên ảnh poster không hợp lệ thất bại
- **WHEN** Ban tổ chức gửi yêu cầu tải ảnh poster vượt quá 10MB hoặc định dạng không hợp lệ, hoặc tài khoản không có vai trò `organizer`
- **THEN** Hệ thống từ chối tải lên và trả về lỗi thích hợp (400 Bad Request hoặc 403 Forbidden)


### Requirement: Quản lý thông tin Concert (Concert Management)
**Mô tả:**
Hệ thống cho phép ban tổ chức tạo concert mới, cập nhật thông tin concert (bao gồm xử lý dọn dẹp ảnh poster cũ trên Cloudinary), hủy concert hoặc xóa concert nếu chưa có bookings nào phát sinh.

**Luồng chính:**
1. **Tạo concert:**
   - Ban tổ chức gửi yêu cầu POST đến `/concerts` với các thông tin chi tiết (`title`, `description`, `location`, `posterUrl`, `posterPublicId`, `start_time`, `end_time`, và tùy chọn danh sách `ticket_types`).
   - Hệ thống lưu thông tin concert mới (lưu cả `posterPublicId`) và các loại vé liên kết vào PostgreSQL.
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


### Requirement: Quản lý loại vé (Ticket Type Management)
**Mô tả:**
Ban tổ chức quản lý cấu hình các loại vé phân hạng (GA, SVIP, VIP, CAT1, CAT2) liên kết với concert, bao gồm giá vé, số lượng tổng và thời gian bán vé.

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
- Tên loại vé không thuộc tập giá trị được phép: Trả về HTTP 400 Bad Request.
- Thời gian mở bán và kết thúc bán không hợp lệ (ví dụ: `sale_start_time` >= `sale_end_time` hoặc `sale_start_time` >= thời gian kết thúc concert): Trả về HTTP 400 Bad Request.
- Xóa loại vé đã phát sinh đơn đặt vé: Trả về HTTP 400 Bad Request.
- Người dùng không có vai trò `organizer`: Trả về HTTP 403 Forbidden.

**Ràng buộc:**
- Tên loại vé bắt buộc phải là một trong năm phân hạng chuẩn: `GA`, `SVIP`, `VIP`, `CAT1`, `CAT2`.
- Thời gian bán vé (`sale_start_time` và `sale_end_time`) phải hợp lệ logic và nằm trong thời gian diễn ra concert.
- Không được xóa loại vé nếu đã có vé được đặt thành công (bookings > 0).

**Tiêu chí chấp nhận:**
- Cập nhật cơ sở dữ liệu thành công cho các thao tác thêm, sửa, xóa loại vé.
- Các khóa cache liên quan đến loại vé của concert bị xóa sạch khỏi Redis.

#### Scenario: Ban tổ chức thiết lập loại vé mới cho concert thành công
- **WHEN** Ban tổ chức gửi yêu cầu POST đến `/concerts/:concertId/ticket-types` với thông tin loại vé hợp lệ (tên `name` thuộc GA, SVIP, VIP, CAT1, CAT2, giá `price`, `total_quantity`, `max_per_user`, và tùy chọn `sale_start_time`, `sale_end_time` hợp lệ) không trùng tên đã có, và tài khoản có vai trò `organizer`
- **THEN** Hệ thống tạo bản ghi loại vé mới trong PostgreSQL, gán `available_quantity` bằng `total_quantity`, xóa khóa cache Redis `cache:concerts:{concertId}:ticket-types` liên quan, xóa toàn bộ khóa danh sách mặc định `cache:concerts:list:default:*`, và trả về mã trạng thái 201

#### Scenario: Ban tổ chức thiết lập loại vé với tên không hợp lệ thất bại
- **WHEN** Ban tổ chức gửi yêu cầu cấu hình loại vé với tên không thuộc tập `GA`, `SVIP`, `VIP`, `CAT1`, `CAT2`, và tài khoản có vai trò `organizer`
- **THEN** Hệ thống từ chối lưu và trả về lỗi 400 Bad Request

#### Scenario: Ban tổ chức cấu hình loại vé với thời gian bán không hợp lệ thất bại
- **WHEN** Ban tổ chức gửi yêu cầu cấu hình loại vé (POST `/concerts/:concertId/ticket-types` hoặc PATCH `/ticket-types/:id`) với `sale_start_time` >= `sale_end_time` hoặc `sale_start_time` >= thời gian kết thúc concert, và tài khoản có vai trò `organizer`
- **THEN** Hệ thống từ chối lưu và trả về lỗi 400 Bad Request

#### Scenario: Ban tổ chức cập nhật thông tin loại vé thành công
- **WHEN** Ban tổ chức gửi yêu cầu PATCH đến `/ticket-types/:id` với thông tin cập nhật hợp lệ (bao gồm cập nhật tên phân hạng chuẩn hoặc thời gian mở bán/kết thúc bán) và tài khoản có vai trò `organizer`
- **THEN** Hệ thống cập nhật bản ghi trong PostgreSQL, xóa khóa cache Redis `cache:concerts:{concertId}:ticket-types` của concert liên quan, xóa toàn bộ khóa danh sách mặc định `cache:concerts:list:default:*`, và trả về mã trạng thái 200 thành công

#### Scenario: Ban tổ chức xóa loại vé thành công khi chưa có bookings
- **WHEN** Ban tổ chức gửi yêu cầu DELETE đến `/ticket-types/:id` của loại vé chưa phát sinh đơn đặt vé (bookings) nào và tài khoản có vai trò `organizer`
- **THEN** Hệ thống xóa bản ghi loại vé khỏi PostgreSQL, xóa khóa cache Redis `cache:concerts:{concertId}:ticket-types` của concert liên quan, xóa toàn bộ khóa danh sách mặc định `cache:concerts:list:default:*`, và trả về mã trạng thái 200/204 thành công

#### Scenario: Ban tổ chức xóa loại vé thất bại khi đã có bookings
- **WHEN** Ban tổ chức gửi yêu cầu DELETE đến `/ticket-types/:id` của loại vé đã phát sinh ít nhất một đơn đặt vé (bookings) và tài khoản có vai trò `organizer`
- **THEN** Hệ thống từ chối xóa, không thay đổi database hay cache, và trả về lỗi 400 Bad Request kèm thông điệp báo lỗi


### Requirement: Bộ nhớ đệm danh sách và chi tiết Concert (Concert Caching)
**Mô tả:**
Để tăng tốc truy cập cho khán giả, hệ thống áp dụng cơ chế Cache-aside trên Redis đối với thông tin chi tiết concert và danh sách concert mặc định (không lọc động).

**Luồng chính:**
1. **Truy vấn chi tiết concert:**
   - Khán giả gửi yêu cầu GET đến `/concerts/:id`.
   - Hệ thống kiểm tra trong Redis xem có khóa `cache:concerts:{id}` hay chưa.
   - Nếu có (Cache Hit): Trả về thông tin concert từ cache mà không cần truy vấn PostgreSQL.
   - Nếu không có (Cache Miss): Truy vấn thông tin concert từ PostgreSQL (loại trừ trường `svg_stage_map` và các quan hệ loại vé để giảm dung lượng tải). Lưu thông tin này vào Redis với TTL là 600 giây và trả về kết quả cho khán giả.
2. **Truy vấn danh sách concert mặc định:**
   - Khán giả gửi yêu cầu GET đến `/concerts` chỉ kèm phân trang hoặc không có tham số lọc.
   - Hệ thống kiểm tra xem khóa `cache:concerts:list:default:page:{page}:limit:{limit}` có tồn tại trên Redis không.
   - Nếu có (Cache Hit): Trả về danh sách concert trực tiếp từ Redis.
   - Nếu không có (Cache Miss): Truy vấn danh sách concert đang hoạt động (`active`) từ PostgreSQL, phân trang đầy đủ. Lưu kết quả dạng JSON vào Redis khóa tương ứng với TTL là 600 giây và trả về kết quả cho khán giả.
3. **Bypass cache với bộ lọc động:**
   - Khán giả gửi yêu cầu GET đến `/concerts` kèm theo các tham số tìm kiếm động như `search`, `location`, `tag`.
   - Hệ thống không sử dụng cache, truy vấn trực tiếp từ PostgreSQL và trả về kết quả.

**Kịch bản lỗi:**
- Concert không tồn tại: Trả về HTTP 404 Not Found.

**Ràng buộc:**
- Khóa cache chi tiết `cache:concerts:{id}` có TTL 600 giây.
- Khóa cache danh sách `cache:concerts:list:default:page:{page}:limit:{limit}` có TTL 600 giây.
- Mọi yêu cầu danh sách có tham số lọc động bắt buộc phải bypass cache hoàn toàn để đảm bảo kết quả chính xác theo thời gian thực.

**Tiêu chí chấp nhận:**
- Khi cache hit, không phát sinh bất kỳ câu lệnh SQL nào đến PostgreSQL.
- Khi cache miss, dữ liệu được ghi vào Redis với đúng định dạng và thời gian sống (TTL).

#### Scenario: Khán giả truy cập thông tin concert thành công từ cache (Cache Hit)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts/:id` và khóa `cache:concerts:{id}` đã tồn tại trên Redis
- **THEN** Hệ thống lấy thông tin concert (không bao gồm danh sách các loại vé và sơ đồ sân khấu SVG) từ Redis và trả về kết quả ngay lập tức mà không truy vấn PostgreSQL

#### Scenario: Khán giả truy cập thông tin concert thành công từ database (Cache Miss)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts/:id` and khóa `cache:concerts:{id}` chưa có trên Redis
- **THEN** Hệ thống truy vấn thông tin concert (loại trừ cột `svg_stage_map` và quan hệ loại vé) từ PostgreSQL, lưu kết quả dạng JSON vào Redis với khóa `cache:concerts:{id}` và thời gian sống (TTL) là 600 giây, sau đó trả về kết quả cho khán giả

#### Scenario: Khán giả lấy danh sách concert mặc định thành công từ cache (Cache Hit)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts` chỉ chứa tham số phân trang (`page`, `limit`) hoặc không có tham số, và khóa `cache:concerts:list:default:page:{page}:limit:{limit}` đã tồn tại trên Redis
- **THEN** Hệ thống lấy danh sách concert từ Redis và trả về kết quả ngay lập tức mà không truy vấn PostgreSQL

#### Scenario: Khán giả lấy danh sách concert mặc định thành công từ database (Cache Miss)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts` chỉ chứa tham số phân trang hoặc không có tham số, và khóa `cache:concerts:list:default:page:{page}:limit:{limit}` chưa có trên Redis
- **THEN** Hệ thống truy vấn danh sách các concert có trạng thái `active` từ PostgreSQL kèm phân trang, lưu kết quả dạng JSON vào Redis với khóa `cache:concerts:list:default:page:{page}:limit:{limit}` và TTL là 600 giây, sau đó trả về kết quả cho khán giả

#### Scenario: Khán giả truy cập danh sách concert có bộ lọc động bypass cache
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts` kèm theo ít nhất một bộ lọc động như `search`, `location`, hoặc `tag`
- **THEN** Hệ thống bỏ qua bộ nhớ đệm Redis, thực hiện truy vấn trực tiếp từ PostgreSQL dựa trên các bộ lọc và trả về kết quả cho khán giả


### Requirement: Sơ đồ sân khấu (Stage Map Caching)
**Mô tả:**
Vì tệp tin sơ đồ sân khấu dạng SVG có dung lượng khá lớn và rất ít khi thay đổi, hệ thống tách biệt API lấy sơ đồ sân khấu và lưu trữ bộ nhớ đệm riêng biệt với TTL dài hơn để tối ưu băng thông và tải cho PostgreSQL.

**Luồng chính:**
1. Khán giả gửi yêu cầu GET đến `/concerts/:id/stagemap`.
2. Hệ thống kiểm tra khóa `cache:concerts:{id}:stagemap` trên Redis.
3. Nếu có (Cache Hit): Lấy dữ liệu SVG trực tiếp từ Redis và phản hồi ngay lập tức cho khán giả.
4. Nếu không có (Cache Miss): Truy vấn cột `svg_stage_map` của concert đó từ PostgreSQL. Lưu trữ nội dung SVG vào Redis với khóa `cache:concerts:{id}:stagemap` và thời gian sống (TTL) là 1800 giây (30 phút).
5. Trả về kết quả sơ đồ sân khấu cho khán giả.

**Kịch bản lỗi:**
- Concert không tồn tại: Trả về HTTP 404 Not Found.

**Ràng buộc:**
- Khóa cache stagemap `cache:concerts:{id}:stagemap` có TTL là 1800 giây.

**Tiêu chí chấp nhận:**
- Trả về đúng dữ liệu SVG của sân khấu concert.
- Giảm tải truy vấn cột dung lượng lớn `svg_stage_map` từ database nhờ cache Redis.

#### Scenario: Khán giả truy cập sơ đồ sân khấu thành công từ cache (Cache Hit)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts/:id/stagemap` và khóa `cache:concerts:{id}:stagemap` đã tồn tại trên Redis
- **THEN** Hệ thống lấy nội dung SVG trực tiếp từ Redis và trả về kết quả ngay lập tức mà không truy vấn PostgreSQL

#### Scenario: Khán giả truy cập sơ đồ sân khấu thành công từ database (Cache Miss)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts/:id/stagemap` và khóa `cache:concerts:{id}:stagemap` chưa có trên Redis
- **THEN** Hệ thống truy vấn cột `svg_stage_map` từ PostgreSQL, lưu kết quả vào Redis với khóa `cache:concerts:{id}:stagemap` và thời gian sống (TTL) là 1800 giây, sau đó trả về kết quả cho khán giả


### Requirement: Hybrid Caching tồn kho vé (Hybrid Caching for Ticket Inventory)
**Mô tả:**
Hệ thống kết hợp thông tin cấu hình tĩnh của vé được cache bằng Cache-aside với số lượng tồn kho vé thực tế (available quantity) được quản lý thời gian thực trên Redis để đảm bảo hiệu năng tối đa khi truy vấn thông tin loại vé.

**Luồng chính:**
1. Khán giả gửi yêu cầu GET đến `/concerts/:id/ticket-types`.
2. Hệ thống kiểm tra khóa cache cấu hình vé `cache:concerts:{id}:ticket-types`.
3. Nếu có cấu hình vé (Cache Hit): Lấy cấu hình tĩnh của các loại vé (tên, giá, giới hạn tối đa) từ Redis.
4. Nếu không có cấu hình vé (Cache Miss): Truy cập PostgreSQL lấy danh sách cấu hình loại vé của concert, lưu vào Redis khóa `cache:concerts:{id}:ticket-types` với TTL là 600 giây.
5. Hệ thống gọi lệnh `MGET` lấy số lượng vé khả dụng từ các khóa `inventory:{concertId}:{ticketTypeId}` trên Redis.
6. Nếu một số khóa inventory trên Redis chưa được khởi tạo (ví dụ do Redis restart hoặc cache bị xóa sạch), hệ thống sử dụng giá trị `available_quantity` từ PostgreSQL để phản hồi và phục hồi/khởi tạo lại các khóa tồn kho Redis.
7. Đồng bộ số lượng khả dụng nhận được vào cấu hình tĩnh và trả về danh sách đầy đủ cho khán giả.

**Kịch bản lỗi:**
- Concert không tồn tại: Trả về HTTP 404 Not Found.

**Ràng buộc:**
- TTL của khóa cấu hình loại vé `cache:concerts:{id}:ticket-types` là 600 giây.
- Số lượng vé khả dụng được hiển thị phải dựa trên các khóa `inventory:{concertId}:{ticketTypeId}` trên Redis để phản ánh chính xác lượng vé còn lại trong quá trình đặt vé tốc độ cao.
- Sử dụng lệnh `MGET` để tối ưu hóa hiệu năng thay vì gửi nhiều lệnh GET đơn lẻ.

**Tiêu chí chấp nhận:**
- Trả về danh sách loại vé chính xác kèm theo số lượng khả dụng thực tế.
- Khởi tạo lại tồn kho trên Redis từ dữ liệu DB nếu Redis bị mất dữ liệu.

#### Scenario: Khán giả truy cập danh sách loại vé của concert thành công từ cache và Redis inventory (Cache Hit cấu hình tĩnh)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts/:id/ticket-types` và khóa `cache:concerts:{id}:ticket-types` đã tồn tại trên Redis
- **THEN** Hệ thống lấy thông tin cấu hình tĩnh của các loại vé từ Redis, thực hiện lệnh `MGET` lấy số lượng vé khả dụng từ các khóa `inventory:{concertId}:{ticketTypeId}` tương ứng trên Redis, cập nhật số lượng này vào kết quả và trả về cho khán giả ngay lập tức mà không cần truy vấn PostgreSQL

#### Scenario: Khán giả truy cập danh sách loại vé của concert thành công từ database và Redis inventory (Cache Miss cấu hình tĩnh)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts/:id/ticket-types` và khóa `cache:concerts:{id}:ticket-types` chưa có trên Redis
- **THEN** Hệ thống truy vấn danh sách các loại vé từ PostgreSQL, lưu cấu hình tĩnh vào Redis với khóa `cache:concerts:{id}:ticket-types` (TTL 600 giây), lấy số lượng khả dụng thực tế từ các khóa `inventory:{concertId}:{ticketTypeId}` trên Redis (hoặc dùng giá trị trong DB nếu Redis chưa khởi tạo khóa), cập nhật vào kết quả và trả về cho khán giả

#### Scenario: Khán giả lấy danh sách loại vé của concert không tồn tại thất bại
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts/:id/ticket-types` với `:id` không tồn tại trong hệ thống
- **THEN** Hệ thống trả về lỗi 404 Not Found
