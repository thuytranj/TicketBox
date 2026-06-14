## Bối cảnh

Hệ thống cần hỗ trợ quản lý sự kiện hòa nhạc (concert) cho nhà tổ chức (organizers) và tính năng tìm kiếm/truy vấn concert cho khán giả (audiences). Do lượng truy cập đọc thông tin chi tiết concert dự kiến sẽ rất cao, hệ thống cần áp dụng chiến lược lưu trữ đệm bằng Redis (mô hình Cache-aside) để giảm tải cho cơ sở dữ liệu. Ngoài ra, ban tổ chức cần cơ chế để dừng hoạt động sự kiện (hủy bỏ) hoặc xóa bỏ hoàn toàn nếu sự kiện chưa mở bán. Khán giả cũng cần bộ lọc và tìm kiếm cơ bản để nhanh chóng tìm thấy concert phù hợp. BTC cũng cần khả năng cấu hình các loại vé (ví dụ VIP, Standard, SVIP...) đi kèm cho mỗi concert.

## Mục tiêu / Phi mục tiêu

**Mục tiêu:**
- Định nghĩa cấu trúc thực thể (entity schema) `Concert` và `TicketType` trong PostgreSQL dựa trên thiết kế ERD chính thức trong `docs/design.md`.
- Tạo các REST endpoints cho phép tạo mới, cập nhật, hủy bỏ, xóa concert, giới hạn quyền truy cập cho vai trò `organizer` (nhà tổ chức).
- Cho phép ban tổ chức quản lý cấu hình các loại vé (tạo mới, cập nhật, xóa loại vé) đi kèm cho mỗi concert.
- Tạo các REST endpoints công khai (public) để hiển thị danh sách concert, hỗ trợ lọc cơ bản theo địa điểm (`location`), thẻ (`tags`) và tìm kiếm từ khóa tương đối (`search`) thông qua PostgreSQL.
- Triển khai cơ chế Redis cache-aside cho endpoint lấy chi tiết concert (`GET /concerts/:id`), trả về thông tin concert kèm theo các loại vé của nó (không kèm SVG sân khấu để tối ưu hóa bộ nhớ và truyền tải).
- Triển khai cơ chế Redis cache-aside riêng biệt cho endpoint lấy sơ đồ sân khấu dạng SVG (`GET /concerts/:id/stagemap`).
- Đảm bảo thu hồi cache (cache invalidation) khi thông tin concert hoặc loại vé được cập nhật, hủy bỏ, hoặc xóa bỏ.

**Phi mục tiêu:**
- Triển khai logic đặt vé hoặc giữ chỗ (sẽ được xử lý trong các dịch vụ liên quan đến booking).
- Triển khai các công cụ tìm kiếm chuyên dụng bên ngoài (như Elasticsearch) hoặc gợi ý tìm kiếm tự động thông minh.

## Quyết định kỹ thuật

### 1. Cấu trúc Cơ sở Dữ liệu (Thực thể `Concert`)
Dựa trên thiết kế ERD trong tài liệu `docs/design.md`, chúng tôi sẽ thêm bảng mới tên là `concerts` với cấu trúc như sau:
- `id`: `uuid` (Khóa chính, tự sinh bằng UUIDv7 trên ứng dụng trước khi insert)
- `title`: `varchar(255)` (Không rỗng)
- `description`: `text` (Không rỗng)
- `location`: `varchar(255)` (Không rỗng)
- `poster_url`: `varchar(500)` (Có thể rỗng)
- `summary`: `text` (Có thể rỗng, sinh bằng AI)
- `tags`: `varchar(50)[]` (Không rỗng, mặc định là mảng rỗng `{}`)
- `svg_stage_map`: `text` (Có thể rỗng, lưu trữ bản đồ sơ đồ ghế ngồi/sân khấu dạng chuỗi SVG)
- `start_time`: `timestamp` (Không rỗng, thời gian bắt đầu buổi diễn)
- `end_time`: `timestamp` (Không rỗng, thời gian kết thúc dự kiến)
- `status`: `varchar(50)` (Không rỗng, mặc định `draft`, ràng buộc kiểm tra `CHECK (status IN ('draft', 'active', 'cancelled'))`)
- `reminder_sent`: `boolean` (Không rỗng, mặc định `false`)
- `created_at`: `timestamp` (Không rỗng, mặc định: `CURRENT_TIMESTAMP`)

*Business Rules liên quan:*
- `end_time` bắt buộc phải lớn hơn `start_time`.
- Chỉ các concert có `status = 'active'` mới được hiển thị cho khán giả ở API danh sách.

### 2. Cấu trúc Cơ sở Dữ liệu (Thực thể `TicketType`)
Dựa trên thiết kế ERD trong tài liệu `docs/design.md`, chúng tôi sẽ thêm bảng mới tên là `ticket_types` với cấu trúc như sau:
- `id`: `uuid` (Khóa chính, tự sinh bằng UUIDv7 trên ứng dụng trước khi insert)
- `concert_id`: `uuid` (Khóa ngoại trỏ đến `concerts(id)` ON DELETE CASCADE)
- `name`: `varchar(100)` (Không rỗng, bắt buộc là một trong: 'GA', 'SVIP', 'VIP', 'CAT1', 'CAT2', ràng buộc `CHECK (name IN ('GA', 'SVIP', 'VIP', 'CAT1', 'CAT2'))`)
- `price`: `decimal(12, 2)` (Không rỗng, đảm bảo `CHECK (price >= 0)`)
- `total_quantity`: `integer` (Không rỗng, đảm bảo `CHECK (total_quantity > 0)`)
- `available_quantity`: `integer` (Không rỗng, đảm bảo `CHECK (available_quantity >= 0 AND available_quantity <= total_quantity)`)
- `max_per_user`: `integer` (Không rỗng, mặc định là `4`, đảm bảo `CHECK (max_per_user > 0)`)
- `sale_start_time`: `timestamp` (Có thể rỗng, thời gian bắt đầu bán vé)
- `sale_end_time`: `timestamp` (Có thể rỗng, thời gian kết thúc bán vé, ràng buộc `sale_end_time > sale_start_time`)

*Business Rules liên quan:*
- Tên loại vé `name` phải là duy nhất trên mỗi buổi biểu diễn cụ thể để tránh cấu hình trùng lặp. Đảm bảo bằng ràng buộc UNIQUE ghép: `UNIQUE (concert_id, name)`.
- Phân hạng vé `name` bắt buộc phải thuộc danh mục chuẩn: `GA`, `SVIP`, `VIP`, `CAT1`, `CAT2`.
- `available_quantity` ban đầu sẽ được gán bằng `total_quantity` khi tạo mới.
- Ràng buộc kiểm tra `CHECK (sale_end_time IS NULL OR sale_start_time IS NULL OR sale_end_time > sale_start_time)`.
- Thời điểm bán vé bắt buộc phải diễn ra trước khi concert kết thúc: `sale_start_time < concert.endTime`.
- Khi khách đặt mua vé, hệ thống kiểm tra thời gian hiện tại phải nằm trong khoảng `[sale_start_time, sale_end_time]` (nếu các trường này được cấu hình).

### 3. Mô hình Cache-aside sử dụng `RedisService`
Chúng tôi sẽ inject `RedisService` (từ `src/backend/src/common/redis`) trực tiếp vào `ConcertService` để triển khai cache-aside.
Do dữ liệu trường `svg_stage_map` (lưu trữ bản đồ sơ đồ ghế ngồi SVG) rất lớn (dao động từ 50KB đến 500KB+), chúng ta sẽ **tách biệt** dữ liệu này ra khỏi object Concert chính khi cache để tiết kiệm bộ nhớ Redis và giảm băng thông truyền tải.

#### A. Cache Chi tiết Concert (Không kèm SVG, không kèm Hạng vé)
- **Khóa Cache**: `cache:concerts:{id}`
- **TTL (Thời gian sống)**: 600 giây (10 phút)
- **Quy trình Lấy Chi tiết (Get Detail)**:
  1. Thử đọc khóa `cache:concerts:{id}` từ Redis.
  2. Nếu tìm thấy (cache hit), giải tuần tự hóa chuỗi JSON (chứa thông tin concert và **không có các trường `svg_stage_map` và `ticketTypes`**) và trả về.
  3. Nếu không tìm thấy (cache miss), truy vấn dữ liệu từ PostgreSQL (dùng TypeORM select loại trừ cột `svg_stage_map` và không nạp quan hệ `ticketTypes`).
  4. Nếu tìm thấy trong DB, tuần tự hóa dữ liệu thành chuỗi JSON và ghi vào Redis dưới khóa `cache:concerts:{id}` kèm theo TTL 10 phút, sau đó trả về kết quả.
  5. Nếu không tìm thấy trong DB, trả về lỗi 404.

#### B. Cache Danh sách Hạng vé của Concert (Hybrid Caching)
- **Khóa Cache cấu hình tĩnh**: `cache:concerts:{id}:ticket-types` (TTL 10 phút)
- **Quy trình Lấy Danh sách Hạng vé (Get Ticket Types)**:
  1. Thử đọc khóa `cache:concerts:{id}:ticket-types` từ Redis.
  2. Nếu tìm thấy (cache hit), giải tuần tự hóa chuỗi JSON để lấy danh sách hạng vé tĩnh.
  3. Nếu không tìm thấy (cache miss), truy vấn danh sách loại vé thuộc `concert_id` từ PostgreSQL. Lưu kết quả tĩnh vào Redis dưới khóa `cache:concerts:{id}:ticket-types` với TTL 10 phút.
  4. Với danh sách hạng vé có được, thực hiện đọc thời gian thực số vé khả dụng (`availableQuantity`) từ Redis thông qua lệnh `MGET` trên các khóa `inventory:{concertId}:{ticketTypeId}`.
  5. Ghi đè trường `availableQuantity` của từng loại vé bằng giá trị đọc được từ Redis (hoặc dùng giá trị trong DB nếu Redis chưa khởi tạo khóa này), sau đó trả về cho client.

#### C. Cache Sơ đồ Sân khấu (Chỉ chứa nội dung SVG)
- **Khóa Cache**: `cache:concerts:{id}:stagemap`
- **TTL (Thời gian sống)**: 1800 giây (30 phút - vì sơ đồ hầu như không thay đổi)
- **Quy trình Lấy Sơ đồ (Get Stage Map)**:
  1. Thử đọc khóa `cache:concerts:{id}:stagemap` từ Redis.
  2. Nếu tìm thấy (cache hit), trả về nội dung chuỗi SVG trực tiếp.
  3. Nếu không tìm thấy (cache miss), truy vấn cột `svg_stage_map` từ PostgreSQL cho concert tương ứng.
  4. Nếu tìm thấy trong DB, ghi nội dung chuỗi vào Redis dưới khóa `cache:concerts:{id}:stagemap` kèm TTL 30 phút, sau đó trả về kết quả cho client.
  5. Nếu không tìm thấy hoặc cột rỗng, trả về lỗi hoặc chuỗi trống.

#### C. Cache Danh sách Concert mặc định
- **Khóa Cache**: `cache:concerts:list:default:page:{page}:limit:{limit}`
- **TTL (Thời gian sống)**: 600 giây (10 phút)
- **Quy trình Lấy Danh sách (Get List)**:
  1. Chỉ áp dụng cho các request danh sách mặc định (không chứa bộ lọc động như `search`, `location`, hoặc `tag` - chỉ chứa `page` và `limit` để phân trang). Nếu có bộ lọc động, bỏ qua cache và truy vấn trực tiếp từ PostgreSQL.
  2. Thử đọc khóa `cache:concerts:list:default:page:{page}:limit:{limit}` từ Redis.
  3. Nếu tìm thấy (cache hit), giải tuần tự hóa chuỗi JSON và trả về.
  4. Nếu không tìm thấy (cache miss), truy vấn dữ liệu từ PostgreSQL (dùng TypeORM select phân trang và count).
  5. Nếu tìm thấy, tuần tự hóa kết quả dạng `{ concerts, meta }` thành chuỗi JSON, lưu vào Redis với TTL 10 phút, rồi trả về.

#### D. Quy trình Thu hồi Cache (Cache Invalidation)
- Khi có bất kỳ thay đổi nào liên quan đến thông tin Concert (sửa thông tin, thay đổi trạng thái, xóa concert), hệ thống xóa các khóa Redis `cache:concerts:{id}`, `cache:concerts:{id}:stagemap`, đồng thời xóa tất cả các khóa danh sách mặc định `cache:concerts:list:default:*`.
- Khi có thay đổi liên quan đến loại vé `TicketType` (tạo loại vé mới, cập nhật giá/số lượng, xóa loại vé), hệ thống phải xác định `concert_id` liên kết và xóa khóa Redis `cache:concerts:{concert_id}` cùng toàn bộ các khóa danh sách mặc định `cache:concerts:list:default:*` để danh sách vé và số lượng được cập nhật mới nhất.

### 4. Bảo mật Endpoint và Kiểm soát Quyền truy cập
- Vai trò `organizer` (Ban tổ chức) có quyền thực hiện các thao tác ghi:
  - Concert: `POST /concerts`, `PATCH /concerts/:id`, `DELETE /concerts/:id`
  - TicketType: `POST /concerts/:concertId/ticket-types`, `PATCH /ticket-types/:id`, `DELETE /ticket-types/:id`
- Khán giả có quyền truy cập công khai (public) các API đọc:
  - `GET /concerts`
  - `GET /concerts/:id` (Không kèm SVG)
  - `GET /concerts/:id/stagemap` (Chuyên trả về SVG)

### 5. Cơ chế Xóa (Delete) và Hủy bỏ (Cancel) Concert
Do ràng buộc khóa ngoại từ bảng `BOOKINGS` trỏ đến `CONCERTS` sử dụng quy tắc `ON DELETE RESTRICT`, chúng ta không thể xóa vật lý các concert đã có giao dịch mua vé. Thiết kế cụ thể như sau:
- **Hủy bỏ (Cancel)**:
  - Thực hiện thông qua API `PATCH /concerts/:id` bằng cách cập nhật trường `status` sang giá trị `cancelled`.
  - Việc này giữ lại dữ liệu lịch sử concert để phục vụ tra cứu đơn hàng và hóa đơn thanh toán liên quan.
  - Khi trạng thái chuyển sang `cancelled`, hệ thống phải thu hồi (xóa) cache `cache:concerts:{id}` và `cache:concerts:{id}:stagemap` khỏi Redis.
- **Xóa (Delete)**:
  - Thực hiện thông qua API `DELETE /concerts/:id`.
  - Hệ thống thực hiện kiểm tra kiểm soát toàn vẹn bằng cách truy vấn xem đã có bản ghi nào liên quan trong bảng `bookings` chưa.
  - **Nếu chưa có booking nào**: Thực hiện xóa vật lý (hard delete) concert khỏi PostgreSQL, đồng thời xóa cache `cache:concerts:{id}` và `cache:concerts:{id}:stagemap` trong Redis. Do thiết kế khóa ngoại ở bảng `ticket_types` sử dụng `ON DELETE CASCADE`, toàn bộ các loại vé liên kết sẽ tự động bị xóa theo.
  - **Nếu đã có booking**: Hệ thống từ chối thực hiện xóa vật lý, trả về lỗi `400 Bad Request` với thông điệp: "Không thể xóa concert đã có người đặt vé. Vui lòng chuyển trạng thái concert sang Hủy bỏ (cancelled)."

### 6. Thiết kế Tìm kiếm và Bộ lọc cơ bản bằng PostgreSQL
Để đáp ứng nhu cầu tìm kiếm nhanh mà không tăng độ phức tạp hạ tầng (không cần dùng Elasticsearch ở giai đoạn này), chúng ta sẽ tận dụng các tính năng có sẵn của PostgreSQL:
- **API GET `/concerts`** hỗ trợ các query parameters tùy chọn:
  - `search`: Chuỗi từ khóa cần tìm kiếm. Backend sẽ thực hiện so khớp không phân biệt hoa thường (`ILIKE`) trên cả 2 trường `title` và `description` của concert. Cú pháp SQL: `title ILIKE %search% OR description ILIKE %search%`.
  - `location`: Lọc chính xác theo địa điểm của concert. Ví dụ: `location = :location`.
  - `tag`: Lọc các concert có chứa tag được chỉ định. Cú pháp SQL sử dụng toán tử mảng `@>` (chứa mảng): `tags @> ARRAY[:tag]`.
  - `status`: Lọc theo trạng thái. Nếu là khách truy cập bình thường, hệ thống sẽ tự động gán cứng `status = 'active'`. Nếu là yêu cầu nội bộ hoặc quản trị, có thể lọc theo trạng thái mong muốn.
- **Tối ưu hóa hiệu năng bằng Indexes**:
  - Tạo chỉ mục **GIN Index** trên cột mảng `tags` để tăng tốc độ truy vấn lọc theo tag:
    `CREATE INDEX idx_concerts_tags ON concerts USING gin (tags);`
  - Tạo chỉ mục B-Tree ghép trên hai cột `location` và `status` phục vụ lọc danh sách:
    `CREATE INDEX idx_concerts_location_status ON concerts (location, status);`
  - Tạo chỉ mục B-Tree trên `ticket_types.concert_id` phục vụ load liên kết:
    `CREATE INDEX idx_ticket_types_concert_id ON ticket_types (concert_id);`
  - Tạo ràng buộc UNIQUE ghép trên `ticket_types`:
    `UNIQUE (concert_id, name)`

### 7. Tải ảnh poster lên Cloudinary (Cloudinary Integration)
Để hỗ trợ ban tổ chức tải lên ảnh poster khi tạo concert, chúng tôi tích hợp Cloudinary SDK để quản lý và lưu trữ tệp tin đa phương tiện.
- **API Endpoint**: `POST /concerts/upload-poster` (Auth: Bearer Token cho Organizer)
- **Multer Memory Storage**: Sử dụng bộ lưu trữ tạm thời trong RAM của Multer (`MemoryStorage`) để lấy đối tượng file (`file.buffer`).
- **Cloudinary Service**: Viết `CloudinaryService` đọc cấu hình `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` từ `.env`, tạo luồng Stream (`cloudinary.uploader.upload_stream`) để đẩy trực tiếp buffer ảnh lên Cloudinary (thư mục `ticketbox/posters`) mà không lưu tạm ra ổ đĩa cục bộ.
- **Ràng buộc**: Giới hạn file tải lên tối đa 5MB và chỉ chấp nhận định dạng ảnh phổ biến (`jpg`, `jpeg`, `png`, `webp`).

## Risks / Trade-offs

- **Risk**: Cache Inconsistency. Nếu thông tin chi tiết concert được chỉnh sửa trực tiếp trong DB (ví dụ bằng migration hoặc câu lệnh thủ công), cache sẽ bị lỗi thời.
- **Biện pháp giảm thiểu**: Bắt buộc tất cả các cập nhật phải đi qua phương thức của `ConcertService`. TTL 10 phút đóng vai trò là chốt chặn dự phòng để đảm bảo tính nhất quán sau cùng (eventual consistency).
- **Risk**: Hiện tượng Cache Penetration. Việc truy vấn liên tục các ID không tồn tại sẽ luôn đẩy yêu cầu trực tiếp vào cơ sở dữ liệu.
- **Biện pháp giảm thiểu**: Trả về lỗi 404 trực tiếp là tiêu chuẩn. Nếu cần thiết trong tương lai, chúng ta có thể lưu cache cho các giá trị rỗng/null với TTL ngắn.
- **Risk**: Hiệu năng tìm kiếm tương đối (`ILIKE %keyword%`) giảm sút khi dữ liệu cực lớn.
- **Biện pháp giảm thiểu**: Tạo chỉ mục GIN cho tag và chỉ mục B-Tree cho địa điểm/trạng thái giúp giảm không gian tìm kiếm. Giới hạn số lượng bản ghi trả về bằng phân trang cơ bản (nếu cần thiết sau này). Ở quy mô trung bình (dưới 100k concerts), Postgres xử lý hoàn hảo.
- **Risk**: Độ trễ khi upload ảnh lên Cloudinary làm nghẽn luồng xử lý của server NestJS.
- **Biện pháp giảm thiểu**: Quá trình upload được thực hiện bất đồng bộ (sử dụng `Promise` và stream nhị phân). Giới hạn kích thước ảnh tải lên ở mức 5MB để hạn chế tối đa độ trễ mạng.

