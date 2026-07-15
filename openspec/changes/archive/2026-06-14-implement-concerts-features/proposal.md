## Lý do

Hệ thống hiện tại chưa có khả năng cho phép nhà tổ chức (organizer) quản lý các sự kiện hòa nhạc (concert) và khán giả (audience) truy vấn thông tin chi tiết concert một cách hiệu quả. Việc triển khai các tính năng này kết hợp với cơ chế lưu trữ đệm Redis cache-aside sẽ giúp nhà tổ chức dễ dàng đăng tải sự kiện, đồng thời tối ưu hóa hiệu năng truy vấn cho khán giả khi có lưu lượng truy cập cao. Ngoài ra, ban tổ chức cần khả năng hủy bỏ hoặc xóa các concert, thiết lập các loại vé đi kèm mỗi concert (SVIP, VIP, Standard...), và khán giả cần khả năng tìm kiếm, lọc concert cơ bản theo từ khóa, địa điểm và thẻ (tags).

## Các thay đổi

- **Backend**:
  - Triển khai thực thể (entity) `Concert` và `TicketType` trong PostgreSQL dựa trên thiết kế ERD trong tài liệu hệ thống (sử dụng TypeORM).
  - Tạo `ConcertModule` và tích hợp quản lý loại vé trong NestJS để cung cấp các API endpoints:
    - Tạo mới concert kèm theo danh sách loại vé (chỉ dành cho nhà tổ chức - organizer).
    - Cập nhật thông tin concert và trạng thái hoạt động (chỉ dành cho nhà tổ chức - organizer).
    - Xóa concert (chỉ dành cho nhà tổ chức - organizer; chỉ cho phép khi chưa phát sinh đơn đặt vé).
    - Quản lý loại vé riêng biệt: tạo mới, cập nhật, xóa loại vé của concert (chỉ dành cho nhà tổ chức - organizer; hỗ trợ cấu hình thời gian mở bán/kết thúc bán).
    - Liệt kê danh sách concert kèm chức năng tìm kiếm và lọc cơ bản (công khai - public, hỗ trợ các query parameters: `search`, `location`, `tag`, `status`).
    - Xem thông tin chi tiết một concert và các loại vé của nó (công khai - public, không kèm sơ đồ sân khấu SVG để tối ưu kích thước truyền tải, sử dụng Redis cache-aside).
    - Xem sơ đồ sân khấu dạng SVG của concert (công khai - public, sử dụng Redis cache-aside).
  - Triển khai mô hình Cache-aside khi truy vấn thông tin concert: cache hit sẽ trả về dữ liệu trực tiếp từ Redis; cache miss sẽ đọc từ PostgreSQL, lưu vào Redis, rồi trả về dữ liệu.
  - Triển khai cơ chế thu hồi cache (cache invalidation) khi thông tin concert hoặc loại vé được cập nhật, hủy bỏ hoặc xóa.
  - Viết các bộ Unit Test cho `ConcertService` và `ConcertController` để kiểm chứng độc lập các chức năng nghiệp vụ, cache-aside và phân quyền.
- **Database Migrations**: Thêm migration TypeORM để tạo bảng `concerts` và `ticket_types` kèm các chỉ mục và ràng buộc khóa ngoại tối ưu hóa.

## Khả năng

### Khả năng mới
<!-- Capabilities being introduced. Replace <name> with kebab-case identifier (e.g., user-auth, data-export, api-rate-limiting). Each creates specs/<name>/spec.md -->

### Khả năng chỉnh sửa
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use existing spec names from openspec/specs/. Leave empty if no requirement changes. -->
- `concert`: Tinh chỉnh các yêu cầu quản lý concert bao gồm tạo, sửa, xóa, hủy bỏ, cấu hình loại vé đi kèm, tìm kiếm/lọc cơ bản trên PostgreSQL và cơ chế bộ nhớ đệm cache.

## Impact

- **Cơ sở dữ liệu**:
  - Thêm bảng mới `concerts` (với các trường: `title`, `description`, `location`, `poster_url`, `summary`, `tags`, `svg_stage_map`, `start_time`, `end_time`, `status`, `reminder_sent`, `created_at`).
  - Thêm bảng mới `ticket_types` (với các trường: `id`, `concert_id`, `name`, `price`, `total_quantity`, `available_quantity`, `max_per_user`, `sale_start_time`, `sale_end_time`).
- **API Routes**:
  - `POST /concerts` (Tạo concert mới và tùy chọn thiết lập các loại vé ban đầu, chỉ dành cho organizer)
  - `POST /concerts/:concertId/ticket-types` (Tạo loại vé mới cho concert, chỉ dành cho organizer)
  - `PATCH /ticket-types/:id` (Cập nhật thông tin loại vé, chỉ dành cho organizer)
  - `DELETE /ticket-types/:id` (Xóa loại vé, chỉ dành cho organizer)
  - `PATCH /concerts/:id` (Cập nhật concert/hủy concert, chỉ dành cho organizer)
  - `DELETE /concerts/:id` (Xóa concert, chỉ dành cho organizer)
  - `GET /concerts` (Xem danh sách concert, public, hỗ trợ lọc và tìm kiếm cơ bản)
  - `GET /concerts/:id` (Xem chi tiết concert kèm danh sách loại vé, không kèm SVG sân khấu, public, lưu cache trong Redis dưới khóa `cache:concerts:{id}`)
  - `GET /concerts/:id/stagemap` (Xem sơ đồ sân khấu dạng SVG của concert, public, lưu cache dưới khóa `cache:concerts:{id}:stagemap`)
- **Redis Cache**:
  - Định dạng khóa (key pattern) `cache:concerts:{id}` để lưu trữ thông tin chi tiết concert (bao gồm cả các loại vé liên kết) dưới dạng chuỗi JSON với TTL 10 phút.
  - Định dạng khóa (key pattern) `cache:concerts:{id}:stagemap` để lưu trữ sơ đồ sân khấu SVG với TTL 30 phút.
