# Đặc tả: Quản lý thông tin concert và bộ nhớ đệm

## Mô tả
Hệ thống cho phép ban tổ chức tạo concert mới và quản lý thông tin, đồng thời tối ưu hóa truy vấn bằng Cache-aside trên Redis và cơ chế Hybrid Caching cho số lượng vé khả dụng. Ngoài ra, hệ thống hỗ trợ tải ảnh poster của concert trực tiếp lên dịch vụ lưu trữ đám mây Cloudinary.

## Luồng chính
1. **Tải lên poster concert (Cloudinary)**:
   - Ban tổ chức gửi yêu cầu POST đến `/concerts/upload-poster` kèm tệp tin hình ảnh dưới dạng `multipart/form-data` (trường `file`).
   - Hệ thống xác thực token và vai trò `organizer` của người dùng.
   - Hệ thống tải ảnh trực tiếp lên Cloudinary dưới dạng Stream từ bộ nhớ đệm nhị phân, sau đó trả về URL HTTPS bảo mật của ảnh kèm `publicId` (Cloudinary Public ID) phục vụ việc xóa/dọn dẹp ảnh sau này.
2. **Tạo concert mới**:
   - Ban tổ chức gửi yêu cầu POST đến `/concerts` kèm payload chứa thông tin buổi diễn (bao gồm trường `posterUrl` và `posterPublicId` nhận được từ bước tải ảnh) và cấu hình loại vé ban đầu.
   - Sơ đồ sân khấu (`svgStageMap`) được đọc phía Frontend bằng JavaScript `FileReader` để chuyển đổi file `.svg` thành chuỗi XML/SVG và gửi trong payload JSON, không sử dụng API upload riêng biệt ở Backend.
   - Hệ thống xác thực token và vai trò `organizer` của người dùng.
   - Hệ thống lưu thông tin concert mới (lưu `posterUrl`, `posterPublicId`, `svgStageMap` dưới dạng chuỗi) và các loại vé liên kết vào PostgreSQL, trả về kết quả thành công.
3. **Cấu hình loại vé riêng biệt**:
   - Ban tổ chức gửi yêu cầu POST đến `/concerts/:concertId/ticket-types` hoặc PATCH đến `/ticket-types/:id`.
   - Hệ thống xác thực quyền organizer.
   - Hệ thống thực hiện thêm mới hoặc cập nhật thông tin loại vé trong database, sau đó xóa cache Redis cấu hình tĩnh của vé (`cache:concerts:{concertId}:ticket-types`) và cache danh sách concert mặc định để đảm bảo dữ liệu đồng bộ.
4. **Cập nhật concert**:
   - Ban tổ chức gửi yêu cầu PATCH đến `/concerts/:id` kèm payload cập nhật (chứa cả `posterUrl` và `posterPublicId` nếu thay đổi).
   - Hệ thống xác thực và kiểm tra quyền của organizer.
   - Nếu `posterUrl` hoặc `posterPublicId` thay đổi, hệ thống sẽ gọi Cloudinary API để xóa ảnh cũ (dựa trên `posterPublicId` cũ) nhằm tránh rác tài nguyên.
   - Hệ thống cập nhật PostgreSQL, xóa các khóa cache Redis liên quan: `cache:concerts:{id}`, `cache:concerts:{id}:stagemap`, `cache:concerts:{id}:ticket-types`, đồng thời xóa tất cả các khóa danh sách mặc định `cache:concerts:list:default:*`, và trả về kết quả thành công.
5. **Lấy chi tiết concert**:
   - Người dùng gửi yêu cầu GET đến `/concerts/:id`.
   - Hệ thống kiểm tra khóa `cache:concerts:{id}` trên Redis.
   - Nếu tồn tại (Cache Hit), trả về dữ liệu concert (không bao gồm các loại vé và cột `svg_stage_map`) ngay lập tức.
   - Nếu không tồn tại (Cache Miss), truy vấn từ PostgreSQL (loại trừ cột `svg_stage_map` và không nạp quan hệ loại vé), lưu dạng JSON vào Redis với khóa `cache:concerts:{id}` (TTL 600s), và trả về kết quả.
6. **Lấy danh sách loại vé của concert (Hybrid Caching)**:
   - Người dùng gửi yêu cầu GET đến `/concerts/:id/ticket-types`.
   - Hệ thống kiểm tra khóa `cache:concerts:{id}:ticket-types` trên Redis.
   - Nếu tồn tại (Cache Hit), giải tuần tự hóa dữ liệu cấu hình tĩnh của các loại vé từ Redis.
   - Nếu không tồn tại (Cache Miss), truy vấn danh sách loại vé thuộc concert từ PostgreSQL, lưu cấu hình tĩnh của danh sách loại vé dạng JSON vào Redis với khóa `cache:concerts:{id}:ticket-types` (TTL 600s).
   - Hệ thống thực hiện đọc thời gian thực số lượng vé khả dụng (`availableQuantity`) từ Redis thông qua lệnh `MGET` trên các khóa `inventory:{concertId}:{ticketTypeId}`.
   - Cập nhật trường `availableQuantity` của từng loại vé bằng giá trị đọc được từ Redis (hoặc dùng giá trị trong DB nếu Redis chưa khởi tạo khóa này), sau đó trả về kết quả cho khách hàng.
7. **Lấy sơ đồ sân khấu (SVG)**:
   - Người dùng gửi yêu cầu GET đến `/concerts/:id/stagemap`.
   - Hệ thống kiểm tra khóa `cache:concerts:{id}:stagemap` trên Redis.
   - Nếu tồn tại (Cache Hit), trả về chuỗi SVG ngay lập tức.
   - Nếu không tồn tại (Cache Miss), truy vấn cột `svg_stage_map` từ PostgreSQL, lưu vào Redis với khóa `cache:concerts:{id}:stagemap` (TTL 1800s), và trả về kết quả.
8. **Liệt kê danh sách concert**:
   - Người dùng gửi yêu cầu GET đến `/concerts` kèm theo các query parameters tùy chọn (`search`, `location`, `tag`, `page`, `limit`).
   - Nếu yêu cầu là mặc định (chỉ gồm `page` và `limit` để phân trang, không chứa bộ lọc động như `search`, `location`, `tag`), hệ thống kiểm tra khóa `cache:concerts:list:default:page:{page}:limit:{limit}` trên Redis.
     - Nếu tồn tại (Cache Hit), trả về danh sách phân trang ngay lập tức.
     - Nếu không tồn tại (Cache Miss), truy vấn PostgreSQL, lưu dạng JSON vào Redis với khóa `cache:concerts:list:default:page:{page}:limit:{limit}` (TTL 600s), và trả về kết quả.
   - Nếu yêu cầu có chứa ít nhất một bộ lọc động (`search`, `location`, hoặc `tag`), hệ thống bỏ qua bộ nhớ đệm, lọc và tìm kiếm dữ liệu trực tiếp trong PostgreSQL và trả về kết quả.
9. **Xóa concert**:
   - Ban tổ chức gửi yêu cầu DELETE đến `/concerts/:id`.
   - Hệ thống kiểm tra xem có đơn đặt vé nào cho concert này chưa.
   - Nếu chưa có, thực hiện xóa ảnh poster cũ trên Cloudinary sử dụng `posterPublicId` (nếu có), thực hiện xóa vật lý concert khỏi DB và xóa các khóa cache Redis liên quan (`cache:concerts:{id}`, `cache:concerts:{id}:stagemap`, `cache:concerts:{id}:ticket-types`) đồng thời xóa toàn bộ các khóa danh sách mặc định `cache:concerts:list:default:*`.
   - Nếu đã có, từ chối và trả về mã lỗi 400.

## Kịch bản lỗi
- **Dữ liệu đầu vào không hợp lệ khi tạo/cập nhật**: Ví dụ: `end_time` nhỏ hơn hoặc bằng `start_time`, thiếu các trường bắt buộc (`title`, `description`, `location`, `start_time`, `end_time`), giá vé âm (`price < 0`), số lượng vé nhỏ hơn hoặc bằng 0. Trả về lỗi 400 Bad Request kèm chi tiết lỗi.
- **Trùng tên loại vé**: Khi tạo loại vé mới trùng tên (ví dụ: tạo 2 loại vé cùng tên "VIP") trên một concert, hệ thống trả về lỗi 400 Bad Request.
- **Không tìm thấy concert hoặc loại vé**: Yêu cầu GET `/concerts/:id`, GET `/concerts/:id/ticket-types`, GET `/concerts/:id/stagemap`, PATCH `/concerts/:id`, DELETE `/concerts/:id` với ID không tồn tại trả về lỗi 404 Not Found.
- **Không có quyền truy cập**: Yêu cầu ghi từ người dùng không phải organizer hoặc không đăng nhập sẽ trả về lỗi 401 Unauthorized hoặc 403 Forbidden.
- **Xóa concert/loại vé đã có bookings**: Ban tổ chức yêu cầu DELETE `/concerts/:id` hoặc DELETE `/ticket-types/:id` nhưng đã phát sinh đơn đặt hàng (bookings), hệ thống trả về lỗi 400 Bad Request kèm thông điệp báo lỗi.
- **Lỗi kết nối Redis**: Khi Redis bị timeout hoặc gặp sự cố kết nối, hệ thống vẫn hoạt động bình thường bằng cách truy vấn trực tiếp PostgreSQL (cơ chế fallback, không ảnh hưởng đến trải nghiệm người dùng).
- **Lỗi tải tệp ảnh poster không hợp lệ**: Tải lên tệp vượt quá 10MB hoặc định dạng không được hỗ trợ (ví dụ `.pdf`, `.txt`) sẽ trả về lỗi 400 Bad Request.

## Ràng buộc
- **Giới hạn hiệu năng**: Thời gian phản hồi của API chi tiết concert, sơ đồ sân khấu và danh sách loại vé trong trường hợp Cache Hit phải dưới 50ms.
- **Bảo mật**: Chỉ các tài khoản có vai trò `organizer` mới được thực hiện các thao tác ghi dữ liệu (POST, PATCH, DELETE, upload ảnh).
- **Tính nhất quán**: Dữ liệu cache trong Redis phải được xóa ngay lập tức khi có thao tác cập nhật, hủy hoặc xóa concert/loại vé để tránh trả về thông tin cũ cho khán giả.

## Tiêu chí chấp nhận
- API `POST /concerts/upload-poster` tải ảnh lên Cloudinary thành công và trả về URL ảnh HTTPS với mã 201.
- API `POST /concerts` tạo thành công concert mới trong database kèm các loại vé (nếu có) và trả về mã trạng thái 201.
- API `POST /concerts/:concertId/ticket-types` tạo thành công loại vé mới, không trùng tên trên concert đó và xóa cache ticket-types cùng danh sách mặc định thành công.
- API `PATCH /ticket-types/:id` cập nhật thành công thông tin loại vé và xóa cache ticket-types cùng danh sách mặc định liên quan.
- API `DELETE /ticket-types/:id` xóa thành công loại vé khỏi PostgreSQL và xóa cache ticket-types cùng danh sách mặc định nếu chưa có bookings. Trả về lỗi 400 nếu đã có bookings.
- API `DELETE /concerts/:id` xóa thành công bản ghi khỏi PostgreSQL và xóa sạch cache liên quan trong Redis nếu chưa có đơn đặt vé. Trả về lỗi 400 nếu đã có đơn đặt vé.
- API `GET /concerts` mặc định (không có bộ lọc tìm kiếm/địa điểm/tag) được cache dưới khóa `cache:concerts:list:default:page:{page}:limit:{limit}`. Yêu cầu đầu tiên ghi nhận cache miss, các yêu cầu tiếp theo ghi nhận cache hit. Khi có bộ lọc động, bỏ qua cache và truy vấn trực tiếp từ PostgreSQL.
- API `GET /concerts/:id` trả về thông tin chi tiết concert (không bao gồm các loại vé và sơ đồ sân khấu SVG). Yêu cầu đầu tiên ghi nhận cache miss, các yêu cầu tiếp theo ghi nhận cache hit từ khóa `cache:concerts:{id}`.
- API `GET /concerts/:id/ticket-types` trả về danh sách loại vé kèm số lượng vé khả dụng (`availableQuantity`) được cập nhật trực tiếp theo thời gian thực từ Redis. Cấu hình tĩnh của các loại vé được cache dưới khóa `cache:concerts:{id}:ticket-types`.
- API `GET /concerts/:id/stagemap` đầu tiên ghi nhận cache miss (truy vấn DB cột `svg_stage_map` và lưu cache), các yêu cầu tiếp theo ghi nhận cache hit (trả về trực tiếp từ Redis dưới khóa `cache:concerts:{id}:stagemap`).

## MODIFIED Requirements

### Requirement: Quản lý thông tin concert và bộ nhớ đệm
Hệ thống SHALL cho phép ban tổ chức tạo concert mới và quản lý thông tin, đồng thời tối ưu hóa truy vấn bằng Cache-aside trên Redis.

#### Scenario: Ban tổ chức tải lên ảnh poster thành công
- **WHEN** Ban tổ chức gửi yêu cầu POST đến `/concerts/upload-poster` kèm tệp tin hình ảnh hợp lệ (dung lượng <= 10MB, định dạng `.jpg`, `.jpeg`, `.png` hoặc `.webp`) và tài khoản có vai trò `organizer`
- **THEN** Hệ thống truyền trực tiếp dữ liệu tệp tin qua stream lên Cloudinary, lưu trữ và trả về URL ảnh dạng HTTPS cùng với `publicId` với mã trạng thái 201

#### Scenario: Ban tổ chức tải lên ảnh poster không hợp lệ thất bại
- **WHEN** Ban tổ chức gửi yêu cầu tải ảnh poster vượt quá 10MB hoặc định dạng không hợp lệ, hoặc tài khoản không có vai trò `organizer`
- **THEN** Hệ thống từ chối tải lên và trả về lỗi thích hợp (400 Bad Request hoặc 403 Forbidden)

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

#### Scenario: Khán giả truy cập thông tin concert thành công từ cache (Cache Hit)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts/:id` và khóa `cache:concerts:{id}` đã tồn tại trên Redis
- **THEN** Hệ thống lấy thông tin concert (không bao gồm danh sách các loại vé và sơ đồ sân khấu SVG) từ Redis và trả về kết quả ngay lập tức mà không truy vấn PostgreSQL

#### Scenario: Khán giả truy cập thông tin concert thành công từ database (Cache Miss)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts/:id` and khóa `cache:concerts:{id}` chưa có trên Redis
- **THEN** Hệ thống truy vấn thông tin concert (loại trừ cột `svg_stage_map` và quan hệ loại vé) từ PostgreSQL, lưu kết quả dạng JSON vào Redis với khóa `cache:concerts:{id}` và thời gian sống (TTL) là 600 giây, sau đó trả về kết quả cho khán giả

#### Scenario: Khán giả truy cập danh sách loại vé của concert thành công từ cache và Redis inventory (Cache Hit cấu hình tĩnh)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts/:id/ticket-types` và khóa `cache:concerts:{id}:ticket-types` đã tồn tại trên Redis
- **THEN** Hệ thống lấy thông tin cấu hình tĩnh của các loại vé từ Redis, thực hiện lệnh `MGET` lấy số lượng vé khả dụng từ các khóa `inventory:{concertId}:{ticketTypeId}` tương ứng trên Redis, cập nhật số lượng này vào kết quả và trả về cho khán giả ngay lập tức mà không cần truy vấn PostgreSQL

#### Scenario: Khán giả truy cập danh sách loại vé của concert thành công từ database và Redis inventory (Cache Miss cấu hình tĩnh)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts/:id/ticket-types` và khóa `cache:concerts:{id}:ticket-types` chưa có trên Redis
- **THEN** Hệ thống truy vấn danh sách các loại vé từ PostgreSQL, lưu cấu hình tĩnh vào Redis với khóa `cache:concerts:{id}:ticket-types` (TTL 600 giây), lấy số lượng khả dụng thực tế từ các khóa `inventory:{concertId}:{ticketTypeId}` trên Redis (hoặc dùng giá trị trong DB nếu Redis chưa khởi tạo khóa), cập nhật vào kết quả và trả về cho khán giả

#### Scenario: Khán giả lấy danh sách loại vé của concert không tồn tại thất bại
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts/:id/ticket-types` với `:id` không tồn tại trong hệ thống
- **THEN** Hệ thống trả về lỗi 404 Not Found

#### Scenario: Khán giả truy cập sơ đồ sân khấu thành công từ cache (Cache Hit)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts/:id/stagemap` và khóa `cache:concerts:{id}:stagemap` đã tồn tại trên Redis
- **THEN** Hệ thống lấy nội dung SVG trực tiếp từ Redis và trả về kết quả ngay lập tức mà không truy vấn PostgreSQL

#### Scenario: Khán giả truy cập sơ đồ sân khấu thành công từ database (Cache Miss)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts/:id/stagemap` và khóa `cache:concerts:{id}:stagemap` chưa có trên Redis
- **THEN** Hệ thống truy vấn cột `svg_stage_map` từ PostgreSQL, lưu kết quả vào Redis với khóa `cache:concerts:{id}:stagemap` và thời gian sống (TTL) là 1800 giây, sau đó trả về kết quả cho khán giả

#### Scenario: Khán giả lấy danh sách concert mặc định thành công từ cache (Cache Hit)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts` chỉ chứa tham số phân trang (`page`, `limit`) hoặc không có tham số, và khóa `cache:concerts:list:default:page:{page}:limit:{limit}` đã tồn tại trên Redis
- **THEN** Hệ thống lấy danh sách concert từ Redis và trả về kết quả ngay lập tức mà không truy vấn PostgreSQL

#### Scenario: Khán giả lấy danh sách concert mặc định thành công từ database (Cache Miss)
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts` chỉ chứa tham số phân trang hoặc không có tham số, và khóa `cache:concerts:list:default:page:{page}:limit:{limit}` chưa có trên Redis
- **THEN** Hệ thống truy vấn danh sách các concert có trạng thái `active` từ PostgreSQL kèm phân trang, lưu kết quả dạng JSON vào Redis với khóa `cache:concerts:list:default:page:{page}:limit:{limit}` và TTL là 600 giây, sau đó trả về kết quả cho khán giả

#### Scenario: Khán giả truy cập danh sách concert có bộ lọc động bypass cache
- **WHEN** Khán giả gửi yêu cầu GET đến `/concerts` kèm theo ít nhất một bộ lọc động như `search`, `location`, hoặc `tag`
- **THEN** Hệ thống bỏ qua bộ nhớ đệm Redis, thực hiện truy vấn trực tiếp từ PostgreSQL dựa trên các bộ lọc và trả về kết quả cho khán giả
