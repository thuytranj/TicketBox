# Đặc tả: Quản lý Concert và Bộ nhớ đệm (Concert Management & Caching)

## Mô tả
Tính năng Quản lý Concert chịu trách nhiệm quản lý vòng đời của các buổi biểu diễn (Concert) và cấu hình hạng vé liên quan. Nhằm giải quyết bài toán tải cực lớn lên hệ thống cơ sở dữ liệu khi mở bán vé (luồng đọc thông tin chi tiết, sơ đồ ghế SVG và kiểm tra tồn kho), hệ thống tích hợp mô hình bộ nhớ đệm đa tầng (Redis Caching) kết hợp kiểm soát tồn kho thời gian thực.

Các chức năng chính được phân tích chi tiết:
1. **Tải ảnh Poster (Upload Poster Stream):** NestJS đóng vai trò proxy bảo mật, nhận tệp ảnh từ Ban tổ chức và tải trực tiếp dạng stream lên Cloudinary nhằm tránh lưu trữ tệp tạm thời trên ổ cứng server.
2. **Quản lý Vòng đời Concert:** Cho phép Ban tổ chức quản lý trạng thái concert từ Nháp (`draft`), Đang mở bán (`active`), Hủy (`cancelled`) cho tới Đã diễn ra (`completed`).
3. **Quản lý Hạng vé (Ticket Type):** Cấu hình loại vé với giá vé, số lượng phát hành, giới hạn mua của mỗi người dùng và thời gian mở bán.
4. **Tự động Hoàn thành Sự kiện:** Định kỳ chạy tác vụ cron để quét các sự kiện đã kết thúc, cập nhật trạng thái cơ sở dữ liệu và xóa bộ nhớ đệm tương ứng.
5. **Bộ nhớ đệm thông tin tĩnh (Cache-aside):** Tách biệt thông tin cơ bản concert, sơ đồ SVG sân khấu và cấu hình vé tĩnh để lưu trữ tối ưu trên Redis.
6. **Bộ đếm tồn kho thời gian thực (Hybrid Inventory Caching):** Sử dụng các khóa Redis độc lập không có TTL để lưu trữ số lượng vé khả dụng, phục vụ xác thực giao dịch mua vé nhanh.

---

## Luồng chính

### 1. Tải lên poster lên Cloudinary (Upload Poster Stream)
- **Endpoint:** `POST /concerts/upload-poster` (Multipart/form-data)
- **Quy trình xử lý:**
  1. Ban tổ chức gửi file ảnh kèm header `Authorization: Bearer <accessToken>`.
  2. Lớp `RolesGuard` xác thực vai trò `organizer`.
  3. Lớp Interceptor kiểm tra định dạng file (chấp nhận: `image/jpeg`, `image/png`, `image/webp`) và giới hạn dung lượng file tối đa là $10\text{MB}$.
  4. Sử dụng thư viện `cloudinary` SDK để khởi tạo một `upload stream` truyền dữ liệu trực tiếp:
     ```typescript
     cloudinary.uploader.upload_stream({ folder: 'ticketbox/concerts' }, (error, result) => { ... })
     ```
  5. Cloudinary xử lý và trả về URL ảnh CDN (`secure_url`) cùng khóa định danh `public_id`.
  6. Hệ thống trả về kết quả JSON dạng:
     ```json
     {
       "url": "https://res.cloudinary.com/.../ticketbox/concerts/image.png",
       "publicId": "ticketbox/concerts/public_id_string"
     }
     ```

### 2. Quản lý thông tin Concert (Concert Management)
- **Tạo concert (`POST /concerts`):**
  - Nhận các thuộc tính cấu hình chi tiết (Tiêu đề, Địa điểm, Thời gian, Poster URL, Poster Public ID).
  - Khởi tạo bản ghi trong bảng `concerts` với trạng thái mặc định là `draft`. Nếu có danh sách hạng vé đính kèm, lưu trữ đồng thời vào bảng `ticket_types` thông qua transaction.
- **Cập nhật concert (`PATCH /concerts/:id`):**
  - Tìm kiếm concert trong PostgreSQL. Nếu thay đổi poster, gọi API `cloudinary.uploader.destroy(oldPublicId)` để dọn dẹp ảnh cũ.
  - Cập nhật thông tin trong PostgreSQL và thực hiện giải phóng cache liên quan trên Redis:
    ```typescript
    await Promise.all([
      redis.del(`cache:concerts:${id}`),
      redis.del(`cache:concerts:${id}:stagemap`),
      redis.del(`cache:concerts:${id}:ticket-types`),
      redis.delPattern(`cache:concerts:list:default:*`)
    ]);
    ```
- **Hủy concert (`PATCH /concerts/:id` với status: `cancelled`):**
  - Chuyển trạng thái sang `cancelled` trong PostgreSQL, hủy toàn bộ cache Redis của concert đó và cache danh sách mặc định.
- **Xóa concert (`DELETE /concerts/:id`):**
  - Kiểm tra xem đã có đơn hàng nào tồn tại trong PostgreSQL liên kết với concert này chưa (bằng cách đếm số orders).
  - Nếu có đơn hàng -> Từ chối xóa.
  - Nếu chưa có đơn hàng -> Gọi API Cloudinary xóa poster cũ -> Thực hiện xóa vật lý concert khỏi PostgreSQL (Cascade xóa tự động hạng vé liên kết) -> Giải phóng toàn bộ các khóa cache Redis liên quan.

### 3. Quản lý hạng vé (Ticket Type Management)
- **Thêm hạng vé (`POST /concerts/:concertId/ticket-types`):**
  - Tạo mới hạng vé trong bảng `ticket_types` (gán `available_quantity` = `total_quantity`).
  - Xóa cache cấu hình vé `cache:concerts:{concertId}:ticket-types` và cache danh sách concert.
- **Cập nhật hạng vé (`PATCH /ticket-types/:id`):**
  - Cập nhật bản ghi trong PostgreSQL, giải phóng cache hạng vé của concert liên quan và cache danh sách mặc định.
- **Xóa hạng vé (`DELETE /ticket-types/:id`):**
  - Kiểm tra xem hạng vé đó đã có vé nào được khởi tạo (`tickets` table) chưa. Nếu chưa có -> Xóa bản ghi PostgreSQL và giải phóng các khóa cache Redis tương ứng.

### 4. Tự động chuyển đổi trạng thái Concert hoàn thành (Automatic Concert Completion)
- Tác vụ chạy ngầm được thực hiện qua NestJS Cron Job:
  - **Tần suất quét:** Mỗi 15 phút một lần (`*/15 * * * *`).
  - **Câu lệnh SQL cập nhật trạng thái:**
    ```sql
    UPDATE concerts 
    SET status = 'completed' 
    WHERE status = 'active' AND end_time <= NOW() 
    RETURNING id;
    ```
  - **Giải phóng bộ nhớ đệm:**
    - Với mỗi `concertId` trong danh sách trả về từ câu lệnh cập nhật, hệ thống thực hiện giải phóng cache chi tiết, cache stagemap, cache cấu hình vé, cache dashboard tổng quan và cache thống kê chi tiết sự kiện:
      ```typescript
      await redis.del(`cache:concerts:${concertId}`);
      await redis.del(`cache:concerts:${concertId}:stagemap`);
      await redis.del(`cache:concerts:${concertId}:ticket-types`);
      await redis.del(`stats:concert:${concertId}:overview`);
      await redis.del(`stats:concert:${concertId}:detail`);
      ```
    - Đồng thời xóa cache danh sách mặc định và cache trang dashboard chính:
      ```typescript
      await redis.delPattern(`cache:concerts:list:default:*`);
      await redis.del(`stats:overview`);
      ```

### 5. Cơ chế Caching thông tin chi tiết sự kiện
- **Khóa cache chi tiết (`cache:concerts:{id}`):**
  - Lưu trữ dưới dạng chuỗi JSON đã tuần tự hóa (Serialized JSON String) của thực thể Concert.
  - **Bảo mật & Dung lượng tối ưu:** Không chứa quan hệ hạng vé (`ticketTypes`) và loại bỏ cột dữ liệu lớn sơ đồ sân khấu `svg_stage_map` để giảm thiểu tải bộ nhớ RAM cho Redis.
  - TTL (Time-To-Live) mặc định: 600 giây (10 phút).
- **Khóa cache danh sách (`cache:concerts:list:default:page:{page}:limit:{limit}`):**
  - Lưu trữ mảng JSON danh sách concert trang chủ (chỉ lấy các concert có trạng thái `active`).
  - TTL mặc định: 600 giây (10 phút).
- **Quy tắc Bypass:** Bất kỳ yêu cầu GET `/concerts` nào chứa tham số lọc động (ví dụ: `?search=Da+Lat`, `?location=Da+Nang`, `?tag=indie`) đều không đi qua Redis mà được chuyển tiếp trực tiếp vào PostgreSQL để đảm bảo tính thời gian thực của kết quả lọc.

### 6. Sơ đồ sân khấu (Stage Map Caching)
- **Khóa cache stagemap (`cache:concerts:{id}:stagemap`):**
  - Sơ đồ sân khấu dạng SVG (chuỗi XML thô) có thể lên đến hàng trăm KB hoặc MB. Nhằm tránh kéo theo SVG nặng này ở luồng đọc thông tin concert thông thường, hệ thống tách biệt thành endpoint riêng biệt `GET /concerts/:id/stagemap`.
  - Khóa cache stagemap lưu trực tiếp chuỗi văn bản SVG thô với TTL dài hơn: 1800 giây (30 phút).

### 7. Hybrid Caching tồn kho vé (Hybrid Caching for Ticket Inventory)
- **Cấu hình hạng vé tĩnh (`cache:concerts:{id}:ticket-types`):**
  - Lưu trữ thông tin tĩnh (tên, giá, giới hạn mua, thời gian bán) của các hạng vé. TTL = 600 giây.
- **Tồn kho thực tế Redis (`inventory:{concertId}:{ticketTypeId}`):**
  - Khóa lưu số lượng vé còn lại dưới dạng số nguyên (String đại diện cho Integer trên Redis). Khóa này **không có TTL** để duy trì trạng thái nhất quán lâu dài.
  - Khi người dùng gửi yêu cầu lấy hạng vé, hệ thống thực hiện `MGET` tất cả các khóa tồn kho trên Redis và đính kèm số lượng khả dụng thực tế này vào thông tin cấu hình tĩnh tương ứng để trả về cho client.
  - **Cơ chế phục hồi (Repopulate):** Nếu một khóa `inventory` trên Redis trả về giá trị trống (do Redis khởi động lại hoặc cache bị xóa), hệ thống sẽ đọc giá trị `available_quantity` hiện thời trong PostgreSQL để ghi lại vào Redis và trả về cho khán giả.

---

## Kịch bản lỗi
1. **Lỗi truyền tải và kết nối API ngoài:**
   - **Tệp poster bị lỗi dữ liệu giữa chừng:** Kết nối upload stream lên Cloudinary bị đứt -> Trả về lỗi `500 Internal Server Error` và không ghi nhận thông tin poster.
   - **Mất kết nối với Redis:**
     - Các luồng đọc thông tin chi tiết sự kiện, danh sách mặc định và stagemap SVG tự động bỏ qua Redis để truy vấn trực tiếp cơ sở dữ liệu PostgreSQL (Graceful Degradation).
     - Đối với luồng đọc hạng vé, hệ thống lấy trực tiếp giá trị `available_quantity` từ PostgreSQL để phản hồi cho client.
2. **Dữ liệu cấu hình thời gian không hợp lệ:**
   - **WHEN:** Ban tổ chức thiết lập thời gian bán vé `sale_start_time` $\ge$ `sale_end_time` hoặc `sale_start_time` $\ge$ thời điểm kết thúc sự kiện `end_time`.
   - **THEN:** Trả về lỗi `400 Bad Request` kèm thông báo lỗi cấu hình thời gian.
3. **Thao tác xóa sự kiện/hạng vé đã bán vé:**
   - **WHEN:** Ban tổ chức gọi API DELETE cho concert hoặc ticket_type đã phát sinh ít nhất 1 đơn đặt vé (`orders` count > 0 hoặc `tickets` count > 0).
   - **THEN:** Hệ thống từ chối yêu cầu xóa vật lý, giữ nguyên tính nhất quán toàn vẹn dữ liệu trong cơ sở dữ liệu và trả về lỗi `400 Bad Request` kèm cảnh báo "Không thể xóa sự kiện/hạng vé đã bán vé".
4. **Bản đồ sân khấu SVG không hợp lệ:**
   - Định dạng tải lên không chứa thẻ mở `<svg>` hoặc thẻ đóng `</svg>` hoặc dung lượng vượt quá giới hạn 5MB -> Trả về lỗi `400 Bad Request`.

---

## Ràng buộc
- **Tính toàn vẹn khóa ngoại:** Không cho phép xóa các bản ghi trong bảng `concerts` hoặc `ticket_types` nếu có các đơn đặt vé tương ứng trong bảng `orders` để đảm bảo báo cáo thống kê và lịch sử soát vé.
- **Dọn dẹp tệp tin vật lý:** Bắt buộc dọn dẹp ảnh poster cũ trên CDN Cloudinary ngay khi sự kiện được cập nhật poster mới hoặc khi sự kiện bị xóa nhằm tránh lãng phí dung lượng lưu trữ đám mây.
- **Ràng buộc vai trò (RBAC):** Chỉ có vai trò `organizer` hoặc `admin` mới được cấp quyền ghi vào cơ sở dữ liệu đối với các bảng `concerts`, `ticket_types`, và `concert_ai_bios`.
- **Hạn chế overselling:** Các khóa tồn kho vé `inventory` trên Redis MUST luôn là nguồn đáng tin cậy duy nhất đại diện cho số lượng vé khả dụng tại thời điểm bán vé tốc độ cao.

---

## Tiêu chí chấp nhận
- Ảnh poster được upload thành công lên thư mục chỉ định `ticketbox/concerts` trên Cloudinary và lưu đúng mã định dạng ID hình ảnh vào PostgreSQL.
- Thao tác chỉnh sửa thông tin concert hoặc hạng vé thực hiện xóa chính xác các khóa cache Redis tương ứng và xóa cache danh sách trang chủ.
- Cron job chạy chính xác định kỳ mỗi 15 phút, tự động chuyển đổi trạng thái concert sang `completed` và thực hiện xóa các khóa cache Redis liên quan của sự kiện đó cùng các bảng dashboard tổng quan.
- Tỷ lệ tồn kho vé khả dụng trả về khớp chính xác số lượng thực tế từ các khóa `inventory` trên Redis và tự động khôi phục lại dữ liệu tồn kho trên Redis từ DB khi xảy ra sự cố mất cache.
