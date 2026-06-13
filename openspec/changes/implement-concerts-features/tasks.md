## 1. Thiết lập Cơ sở Dữ liệu

- [x] 1.1 Tạo các file thực thể `Concert` trong `src/backend/src/concert/entities/concert.entity.ts` và `TicketType` trong `src/backend/src/concert/entities/ticket-type.entity.ts`
- [x] 1.2 Tạo và chạy migration TypeORM để tạo bảng `concerts` và `ticket_types` kèm các chỉ mục tối ưu (`idx_concerts_tags`, `idx_concerts_location_status`, `idx_ticket_types_concert_id`) và ràng buộc unique ghép `UNIQUE (concert_id, name)`
- [x] 1.3 Đăng ký cả hai thực thể `Concert` và `TicketType` trong `app.module.ts` và `src/backend/src/concert/concert.module.ts`

## 2. Triển khai Backend cho Concert và TicketType

- [x] 2.1 Tạo các DTO phục vụ cho việc tạo/cập nhật concert và tạo/cập nhật loại vé (`CreateTicketTypeDto`, `UpdateTicketTypeDto`) trong `src/backend/src/concert/dto`
- [x] 2.2 Triển khai `ConcertService` hỗ trợ:
  - Tạo mới concert (cho phép gửi kèm danh sách loại vé khởi tạo)
  - Cập nhật, hủy bỏ, xóa concert (kiểm tra bookings)
  - Quản lý các loại vé (thêm loại vé mới cho concert, cập nhật loại vé, xóa loại vé khi chưa có bookings)
- [x] 2.3 Tích hợp logic đọc cache-aside bằng `RedisService`:
  - Trong `ConcertService.findOne`: truy vấn kèm quan hệ `ticketTypes`, loại bỏ trường `svg_stage_map`, lưu vào Redis khóa `cache:concerts:{id}` (TTL 10 phút)
  - Trong `ConcertService.findStageMap`: truy vấn trường `svg_stage_map`, lưu vào Redis khóa `cache:concerts:{id}:stagemap` (TTL 30 phút)
  - Thu hồi cache (xóa các key liên quan) trong tất cả phương thức thay đổi dữ liệu của Concert hoặc TicketType
- [x] 2.4 Triển khai `ConcertController` hỗ trợ đầy đủ các endpoints:
  - Concert: `POST /concerts`, `PATCH /concerts/:id`, `DELETE /concerts/:id`, `GET /concerts`, `GET /concerts/:id`, `GET /concerts/:id/stagemap`
  - TicketType: `POST /concerts/:concertId/ticket-types`, `PATCH /ticket-types/:id`, `DELETE /ticket-types/:id`
  - Áp dụng `JwtAuthGuard` và `RolesGuard` cho các thao tác chỉnh sửa (chỉ cho phép vai trò `organizer`)
- [x] 2.5 Kết nối tất cả các thành phần trong `ConcertModule` và import nó vào `AppModule`

## 3. Xác minh tính đúng đắn

- [x] 3.1 Viết các bài kiểm tra tự động (automated tests) hoặc chạy các lệnh curl kiểm tra thủ công để xác minh việc tạo concert, tạo/sửa/xóa loại vé, tìm kiếm/lọc concert, xóa concert (thành công/thất bại), truy xuất chi tiết (cache miss/hit), truy xuất stagemap (cache miss/hit), và cơ chế đồng bộ/thu hồi bộ nhớ đệm
- [x] 3.2 Tạo tệp unit test cho `ConcertService` (`src/backend/src/concert/concert.service.spec.ts`) bao phủ các kịch bản tạo/sửa/xóa, cache-aside và các trường hợp lỗi
- [x] 3.3 Tạo tệp unit test cho `ConcertController` (`src/backend/src/concert/concert.controller.spec.ts`) bao phủ routing endpoints và kiểm tra tích hợp Guards (JwtAuthGuard, RolesGuard) bằng mocking

## 4. Thiết lập thời gian bán vé cho từng loại vé

- [x] 4.1 Tạo migration bổ sung hai cột `sale_start_time` và `sale_end_time` (timestamp, nullable) kèm theo Check Constraint `chk_ticket_types_sale_time` vào bảng `ticket_types`
- [x] 4.2 Cập nhật thực thể `TicketType` trong `ticket-type.entity.ts` để định nghĩa hai trường mới
- [x] 4.3 Cập nhật `CreateTicketTypeDto` và `UpdateTicketTypeDto` để chấp nhận và validate hai trường thời gian bán vé dưới dạng chuỗi ISO Date tùy chọn
- [x] 4.4 Cập nhật `ConcertService` để kiểm soát logic nghiệp vụ: `saleEndTime` phải sau `saleStartTime`, và `saleStartTime` phải diễn ra trước khi concert kết thúc (`saleStartTime < concert.endTime`)
- [x] 4.5 Bổ sung các test cases kiểm tra trong script kiểm thử tự động để xác nhận các ràng buộc kiểm tra hoạt động chính xác (tạo loại vé hợp lệ/không hợp lệ, lỗi 400 Bad Request)
