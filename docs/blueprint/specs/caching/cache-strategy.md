# Đặc tả: Chiến lược Caching (Caching Strategy)

## Mô tả
Hệ thống TicketBox tối ưu hóa hiệu năng phục vụ lượng truy cập lớn (đặc biệt khi mở bán các sự kiện/concerts hot) bằng cách sử dụng chiến lược **Cache-aside (Lazy Loading)** và **Hybrid Caching** với bộ nhớ đệm phân tán Redis. Các yêu cầu đọc chiếm >90% traffic (như danh sách sự kiện, chi tiết sự kiện, và sơ đồ sân khấu) được phục vụ từ cache để giảm tải tối đa cho PostgreSQL.

Cơ chế bao gồm:
1. **Cache-aside (Lazy Loading):** Cache thông tin tĩnh của concert, danh sách concert mặc định, và sơ đồ sân khấu độc lập.
2. **Hybrid Caching (Bộ nhớ đệm lai):** Kết hợp cache các trường tĩnh của hạng vé (`ticket-types`) với việc truy xuất thời gian thực tồn kho động (`availableQuantity`) từ Redis counter thông qua `MGET`, bảo đảm tính chính xác 100% của tồn kho mà không cần truy vấn DB.
3. **Invalidation chủ động:** Tự động xóa/đồng bộ lại cache khi có bất kỳ sự thay đổi thông tin nào từ quản trị viên.

### Danh mục đối tượng Cache và thời gian sống (TTL)

| Đối tượng | Redis Key Pattern | Thời gian sống (TTL) | Chiến lược và Mục đích |
| :--- | :--- | :--- | :--- |
| **Danh sách concert mặc định** | `cache:concerts:list:default:page:{page}:limit:{limit}` | 10 phút (600 giây) | Tránh bùng nổ khóa do các bộ lọc động, chỉ cache trang mặc định. |
| **Chi tiết concert** | `cache:concerts:{id}` | 10 phút (600 giây) | Chỉ lưu thông tin cơ bản của concert, loại trừ sơ đồ ghế nặng để bảo vệ memory. |
| **Hạng vé tĩnh** | `cache:concerts:{id}:ticket-types` | 10 phút (600 giây) | Cache các thông số tĩnh của hạng vé. |
| **Sơ đồ sân khấu (SVG)** | `cache:concerts:{id}:stagemap` | 30 phút (1800 giây) | Nội dung SVG rất nặng được cache riêng biệt với thời gian sống dài để tối ưu I/O DB. |
| **Tồn kho thực tế** | `inventory:{concert_id}:{ticket_type_id}` | Vĩnh viễn (Không TTL) | Đóng vai trò là source of truth cho luồng mua vé, cập nhật trực tiếp qua Lua script. |

---

## Luồng chính

### 1. Xem danh sách Concert mặc định (GET `/api/v1/concerts`)
- **Điều kiện:** Request không có bộ lọc tìm kiếm động (`search`, `location`, `tag`), chỉ có phân trang (`page`, `limit`).
- **Quy trình:**
  1. Kiểm tra xem request có phải là request mặc định không.
  2. Nếu có: Tạo cache key theo dạng `cache:concerts:list:default:page:{page}:limit:{limit}`.
  3. Đọc dữ liệu từ Redis. Nếu cache hit -> Trả về kết quả ngay lập tức cho client.
  4. Nếu cache miss -> Truy vấn PostgreSQL lấy danh sách concert và tổng số item.
  5. Ghi kết quả JSON vào Redis với thời gian hết hạn TTL là 10 phút (600 giây). Trả kết quả về cho client.

### 2. Xem chi tiết Concert (GET `/api/v1/concerts/:id`)
- **Quy trình:**
  1. Tạo cache key dạng `cache:concerts:{id}`.
  2. Truy vấn Redis key này. Nếu cache hit -> Trả về kết quả JSON đã parse.
  3. Nếu cache miss -> Truy vấn PostgreSQL lấy thông tin chi tiết concert. Để tối ưu băng thông và bộ nhớ, câu lệnh SELECT loại trừ trường sơ đồ sân khấu `svgStageMap`.
  4. Lưu object concert sạch vào Redis với TTL là 10 phút (600 giây) và trả về cho client.

### 3. Xem sơ đồ sân khấu SVG (GET `/api/v1/concerts/:id/stagemap`)
Do sơ đồ sân khấu có nội dung XML/SVG rất lớn (50KB - 500KB+), nó được quản lý độc lập khỏi chi tiết concert.
- **Quy trình:**
  1. Tạo cache key dạng `cache:concerts:{id}:stagemap`.
  2. Truy vấn Redis key. Nếu cache hit -> Trả về chuỗi SVG thô.
  3. Nếu cache miss -> Truy vấn PostgreSQL chỉ lấy trường `svgStageMap` của concert tương ứng.
  4. Lưu chuỗi SVG vào Redis với TTL là 30 phút (1800 giây), trả về kết quả cho client.

### 4. Xem hạng vé của Concert (GET `/api/v1/concerts/:id/ticket-types` - Hybrid Caching)
Đảm bảo hiển thị số vé còn lại chính xác tuyệt đối mà không cần truy vấn PostgreSQL liên tục.
- **Quy trình:**
  1. Tạo cache key cho phần thông tin tĩnh: `cache:concerts:{concertId}:ticket-types`.
  2. Đọc Redis key này.
     - **Nếu cache hit:** Sử dụng mảng thông tin các hạng vé tĩnh đã parse.
     - **Nếu cache miss:** Truy vấn PostgreSQL lấy danh sách hạng vé của concert (tên, giá, tổng số vé `totalQuantity`, giới hạn mua `maxPerUser`). Lưu mảng này vào Redis với TTL là 10 phút (600 giây).
  3. Với mảng hạng vé có được (từ cache hoặc DB), xây dựng danh sách các key tồn kho: `inventory:{concertId}:{ticketTypeId}`.
  4. Gọi lệnh `MGET` trên Redis cho tất cả các key tồn kho này.
  5. Duyệt qua mảng hạng vé và ghi đè thuộc tính `availableQuantity` bằng giá trị tương ứng lấy từ `MGET`.
  6. Phản hồi mảng hạng vé đã được cập nhật số lượng tồn kho thời gian thực cho client.

### 5. Vô hiệu hóa Cache (Cache Invalidation)
Xảy ra khi admin cập nhật thông tin sự kiện hoặc chạy tác vụ tự động.
- **Trigger:** Các hàm tạo, sửa, xóa, hoặc đổi trạng thái concert.
- **Quy trình thực hiện:**
  1. Tìm và xóa key chi tiết concert: `DEL cache:concerts:{concertId}`.
  2. Tìm và xóa key sơ đồ sân khấu: `DEL cache:concerts:{concertId}:stagemap`.
  3. Tìm và xóa key hạng vé tĩnh: `DEL cache:concerts:{concertId}:ticket-types`.
  4. Quét danh sách các key cache phân trang mặc định thông qua: `KEYS cache:concerts:list:default:*`.
  5. Xóa toàn bộ các key list tìm thấy để đảm bảo trang chủ hiển thị dữ liệu mới nhất.

---

## Kịch bản lỗi

### 1. Redis Server bị mất kết nối (Cache Fail-Open)
- **WHEN:** Redis server bị sập hoặc gặp lỗi kết nối/timeout khi API đang xử lý đọc dữ liệu cache.
- **THEN:**
  - Hệ thống bọc khối try-catch xung quanh các lệnh gọi Redis client.
  - Ghi log warning cảnh báo lỗi kết nối Redis.
  - Tự động chuyển đổi sang luồng chạy dự phòng (Fail-Open): truy vấn trực tiếp dữ liệu từ PostgreSQL để đảm bảo API luôn phản hồi thành công và không làm gián đoạn trải nghiệm của khách hàng.

### 2. Dữ liệu bị stale do cập nhật ngầm trong DB (Stale Cache)
- **WHEN:** Dữ liệu concert thay đổi trực tiếp thông qua các script hoặc tác vụ ngầm mà không kích hoạt API điều khiển của Admin.
- **THEN:**
  - Các key cache cũ sẽ tự động bị xóa bỏ sau khi hết thời gian sống TTL (10 phút đối với concert/ticket-types, 30 phút đối với stagemap).
  - Tác vụ gửi nhắc nhở sự kiện ngầm (Reminder Scheduler) cũng chủ động gọi lệnh xóa cache khi cập nhật trạng thái `reminderSent` của concert.

### 3. Hiện tượng dồn request khi cache hết hạn (Cache Stampede)
- **WHEN:** Các key cache hết hạn TTL đúng vào thời điểm có hàng ngàn request đồng thời đổ vào hệ thống (ví dụ lúc mở bán vé).
- **THEN:**
  - Để giảm nhẹ tải trọng I/O của PostgreSQL khi gặp Cache Miss đồng thời, trường sơ đồ sân khấu nặng (SVG) đã được tách rời độc lập và có TTL dài (30 phút).
  - Frontend chỉ tải sơ đồ sân khấu khi người dùng chuyển tab chọn ghế, phân tán thời gian gọi API so với API xem thông tin concert chính.

---

## Ràng buộc

- **Tính nhất quán của tồn kho:** Số vé còn lại `availableQuantity` **tuyệt đối không được cache** trong dữ liệu JSON tĩnh của hạng vé. Bắt buộc phải lấy thời gian thực từ keys `inventory:*` trên Redis bằng `MGET`. Key tồn kho này là source of truth chạy đồng bộ với Lua script giữ chỗ.
- **Bảo vệ dung lượng bộ nhớ Redis (RAM Safe):** Không bao giờ gộp nội dung chuỗi SVG của sơ đồ sân khấu vào object thông tin concert. Việc gộp chung sẽ làm phình to bộ nhớ lưu trữ Redis lên gấp 100 lần đối với mỗi key concert chi tiết.
- **Bỏ qua cache khi lọc nâng cao:** Mọi truy vấn danh sách sự kiện chứa từ khóa tìm kiếm hoặc thẻ lọc (`search`, `tag`, `location`) bắt buộc chạy trực tiếp bằng câu lệnh truy vấn PostgreSQL tối ưu hóa index (GIN/B-Tree index) thay vì cache trên Redis, tránh việc bùng nổ số lượng key (Key Explosion) do tổ hợp filter quá nhiều.

---

## Tiêu chí chấp nhận

- **Hiệu năng phản hồi nhanh:** Khi cache hit, thời gian API phản hồi phải nhỏ hơn 5ms.
- **Tồn kho nhất quán:** Số lượng vé còn lại hiển thị ở trang chi tiết đặt vé phải khớp chính xác với số lượng tồn kho nguyên tử thực tế mà Redis Lua Script dùng để trừ vé.
- **Invalidation tức thì:** Ngay sau khi admin thực hiện sửa đổi thông tin concert hoặc cập nhật hạng vé, các truy vấn chi tiết tiếp theo từ client phải thấy ngay dữ liệu mới nhất (cache cũ đã bị dọn sạch).
- **Khả năng chịu lỗi cao:** Khi giả lập hạ dịch vụ Redis, hệ thống vẫn phải hoạt động bình thường, các API đọc dữ liệu tự động chuyển hướng truy vấn trực tiếp PostgreSQL thành công.
