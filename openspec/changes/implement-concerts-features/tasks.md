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

## 5. Tích hợp Phân trang cho API lấy danh sách Concert

- [x] 5.1 Định nghĩa `ConcertQueryDto` chứa các validation cho query parameters (`page`, `limit`, `search`, `location`, `tag`, `status`)
- [x] 5.2 Cập nhật `ConcertService.findAll` để thực hiện phân trang (sử dụng `skip` và `take` trên query builder) và trả về dữ liệu kèm metadata
- [x] 5.3 Cập nhật `ConcertController.findAll` để đón nhận `ConcertQueryDto` và trả về kết quả
- [x] 5.4 Cập nhật unit tests cho controller và service để kiểm chứng chức năng phân trang hoạt động chính xác
- [x] 5.5 Chạy và xác minh tất cả tests thành công

## 6. Triển khai Cache-aside cho danh sách Concert mặc định

- [x] 6.1 Cập nhật `ConcertService.findAll` để tích hợp đọc/ghi Redis cache cho trường hợp mặc định (không chứa `search`, `location`, `tag`)
- [x] 6.2 Cập nhật `ConcertService` ở các hàm ghi (create, update, remove, và các hàm liên quan đến TicketType) để xóa các khóa danh sách mặc định `cache:concerts:list:default:*` khi dữ liệu thay đổi
- [x] 6.3 Bổ sung unit test trong `concert.service.spec.ts` để kiểm chứng logic Cache-aside và Cache Invalidation cho danh sách concert mặc định
- [x] 6.4 Chạy và xác minh toàn bộ test suite thành công

## 7. Tách biệt API và Triển khai Hybrid Caching

- [x] 7.1 Cập nhật `ConcertService.findOne` để chỉ lấy và cache chi tiết Concert (không nạp quan hệ `ticketTypes`, không nạp `svg_stage_map`), sử dụng khóa `cache:concerts:{id}` (TTL 10 phút)
- [x] 7.2 Cập nhật `ConcertController.findOne` tương ứng (không trả về `ticketTypes`)
- [x] 7.3 Triển khai endpoint mới `GET /concerts/:id/ticket-types` trong `ConcertController` và `ConcertService.findTicketTypes` hỗ trợ Hybrid Caching
- [x] 7.4 Cập nhật logic thu hồi cache của Concert và TicketType khi có thao tác ghi dữ liệu (cập nhật các khóa cache và danh sách concert mặc định)
- [x] 7.5 Cập nhật và bổ sung unit test trong `concert.service.spec.ts` và `concert.controller.spec.ts` để kiểm chứng cấu trúc API mới và Hybrid Caching
- [x] 7.6 Chạy và xác minh toàn bộ test suite thành công

## 8. Tải ảnh poster lên Cloudinary

- [x] 8.1 Cài đặt thư viện `cloudinary` và `@types/multer` trong `src/backend`
- [x] 8.2 Bổ sung các biến môi trường cấu hình Cloudinary vào `.env.example`
- [x] 8.3 Tạo `CloudinaryProvider` để cấu hình và khởi tạo instance Cloudinary SDK
- [x] 8.4 Triển khai `CloudinaryService` hỗ trợ upload file buffer qua luồng stream (`upload_stream`)
- [x] 8.5 Tạo endpoint `POST /concerts/upload-poster` trong `ConcertController` tích hợp `FileInterceptor` và `CloudinaryService`
- [x] 8.6 Viết unit test cho `CloudinaryService` và endpoint upload trong `concert.controller.spec.ts`
- [x] 8.7 Chạy và xác minh toàn bộ test suite thành công




