## Context

Hiện tại, TicketBox chưa hỗ trợ tính năng cho phép Ban tổ chức nhập nhanh danh sách khách mời VIP. Các sự kiện âm nhạc thường có một lượng khách mời VIP nhận vé mời miễn phí. Danh sách này cần được tải lên thông qua tệp CSV bởi Admin, xử lý bất đồng bộ để tránh nghẽn API đối với các tệp lớn, lưu trữ vào database, cấp mã QR xác thực ký số bảo mật, và tự động gửi email thông báo kèm mã QR cho khách mời.

## Goals / Non-Goals

**Goals:**
- Triển khai endpoint `POST /concerts/:id/guests/import` để nhận tệp CSV, tải lên Supabase Storage làm lưu trữ đám mây dùng chung, khởi tạo bản ghi Job theo dõi và gửi message vào RabbitMQ.
- Xây dựng RabbitMQ consumer xử lý job `vip_guest.import` thực hiện tải file từ Supabase Storage, parse CSV dạng stream, validate từng dòng dữ liệu và thực hiện chèn dữ liệu theo cụm (Chunked Bulk Insert) kết hợp Transaction vào database.
- Ghi nhận trạng thái xử lý Job (`pending`, `processing`, `completed`, `failed`) và chi tiết log lỗi validate của từng dòng vào bảng `vip_guest_imports`.
- Sinh mã QR chứa chữ ký HMAC-SHA256 sử dụng `SERVER_SECRET` cho việc soát vé offline bảo mật.
- Tự động đẩy tác vụ gửi email thư mời kèm mã QR vào hàng đợi notification với cơ chế điều tiết tốc độ tiêu thụ (Rate Limiting Consumer).
- Cung cấp endpoint `GET /concerts/:id/guests/imports/:jobId` để poll trạng thái của Job và danh sách lỗi.

**Non-Goals:**
- Xây dựng giao diện UI quản trị để theo dõi realtime quá trình import.
- Cho phép chỉnh sửa template email gửi khách mời VIP trực tiếp trên hệ thống.
- Xuất danh sách khách mời hiện tại ngược lại ra file CSV.

## Decisions

### 1. Xử lý bất đồng bộ qua hàng đợi RabbitMQ
- **Lý do**: File CSV chứa danh sách VIP có thể lên tới hàng ngàn dòng, xử lý đồng bộ sẽ block luồng request của NestJS và dễ dẫn tới lỗi HTTP gateway timeout. Việc đẩy vào RabbitMQ giúp cô lập tài nguyên cho background worker, đảm bảo API chính luôn sẵn sàng cho luồng đặt vé quan trọng (Critical Booking Path).

### 2. Sử dụng Supabase Storage cho lưu trữ tệp CSV dùng chung
- **Lý do**: Tránh lỗi `File not found` trong mô hình multi-instance (khi API container và Worker container chạy độc lập). API sẽ tải tệp CSV lên Supabase Storage và truyền link URL qua RabbitMQ. Worker sẽ tải file từ URL này xuống để xử lý. Sau khi hoàn tất hoặc xảy ra lỗi, worker sẽ tự động xóa tệp trên Supabase Storage.

### 3. Tối ưu hóa Database I/O bằng Chunked Bulk Insert và Transaction
- **Lý do**: Việc thực hiện 2,000 câu lệnh INSERT đơn lẻ sẽ gây nghẽn kết nối DB mạng nội bộ. Thay vào đó, chúng ta validate dữ liệu từng dòng rồi gom các bản ghi hợp lệ lại, chia nhỏ thành các cụm (ví dụ: 500 dòng/cụm) để bulk insert bằng TypeORM QueryBuilder trong một Database Transaction duy nhất nhằm đạt hiệu năng tối đa và đảm bảo tính toàn vẹn dữ liệu.

### 4. Khống chế tốc độ gửi email (Rate Limiting Consumer) tại Worker
- **Lý do**: Gửi liên tiếp 2,000 email trong thời gian siêu ngắn sẽ khiến hệ thống bị nhà cung cấp dịch vụ SMTP (Gmail, AWS SES, SendGrid,...) đánh dấu spam hoặc chặn tài khoản. Email consumer sẽ được cấu hình RabbitMQ `prefetch = 1` kết hợp bộ điều tiết tốc độ tiêu thụ (ví dụ: delay 100-200ms trước mỗi lần gửi, tương đương 5-10 email/giây) để đảm bảo độ tin cậy của tên miền gửi thư (IP/Domain reputation).

### 5. Thiết lập các chỉ mục (Indexes) tối ưu hóa cho các thực thể mới
- **VipGuest**: Sử dụng composite unique index `(concert_id, email)` (thông qua `@Unique` decorator). Index này vừa phục vụ chặn trùng lặp email cho cùng một concert, vừa được tái sử dụng để tối ưu hóa truy vấn danh sách khách VIP theo `concert_id` (do `concert_id` là cột dẫn đầu).
- **VipGuestImport**: Sử dụng composite index `(concert_id, created_at DESC)` (thông qua `@Index` decorator) để tối ưu hóa truy vấn danh sách lịch sử import của một concert sắp xếp từ mới nhất đến cũ nhất trên trang quản trị.

### 6. Bổ sung chỉ mục khóa ngoại cho các thực thể hiện hữu (Order, Payment)
- **Lý do**: Hiện tại các thực thể quan trọng như `Order` (cột `userId`, `concertId`) và `Payment` (cột `orderId`) chưa được khai báo chỉ mục cho các trường khóa ngoại. Khi số lượng bản ghi tăng lên, các truy vấn lịch sử đặt vé của người dùng và tra cứu trạng thái giao dịch sẽ bị chậm do quét tuần tự (Seq Scan). Việc bổ sung `@Index` cho các cột này là cần thiết để tối ưu hóa tốc độ truy vấn đọc và tốc độ thực thi các phép JOIN/DELETE.

### 7. Bảng thực thể lưu vết Job import `vip_guest_imports`
- **Lý do**: Cần có nơi lưu giữ tiến trình (`total_rows`, `imported_rows`), trạng thái của Job import và danh sách JSON lỗi cụ thể (dòng lỗi, lý do lỗi) để admin kiểm tra và chỉnh sửa thủ công sau đó.

### 8. Đính kèm mã QR trực quan trong Email dưới dạng CID (Content-ID) Attachment
- **Lý do**: Tại các sự kiện âm nhạc lớn, kết nối mạng di động (3G/4G) của người dùng thường cực kỳ yếu hoặc mất kết nối hoàn toàn do quá tải trạm phát sóng. Nếu sử dụng các dịch vụ sinh QR code qua liên kết HTTPS bên ngoài (như quickchart.io hay qrserver.com), điện thoại của khách mời sẽ không thể tải được ảnh QR khi mất mạng. Để giải quyết triệt để lỗi trải nghiệm này, chúng ta sử dụng thư viện `qrcode` để tạo ảnh mã QR (dạng Buffer PNG) ngay ở Worker, sau đó đính kèm vào email dưới dạng CID Attachment (`cid:vip-qr-code`). Ứng dụng email của người dùng sẽ tải và lưu trữ ảnh này cục bộ ngay khi nhận thư mới ở chế độ nền, giúp mã QR hiển thị tức thì và hoàn toàn offline tại cửa soát vé.

## Risks / Trade-offs

- **Lỗi kết nối tới Supabase Storage**:
  - *Biện pháp*: Thiết lập retry policy khi upload/download tệp từ Supabase Storage và bọc trong try-catch để cập nhật trạng thái Job thành `failed` nếu lỗi lưu trữ kéo dài.
- **Worker bị crash khi Job đang ở trạng thái `processing`**:
  - *Biện pháp*: Sử dụng cơ chế Message Acknowledgement của RabbitMQ. Nếu worker crash, tin nhắn sẽ được requeue hoặc chuyển sang DLQ, giúp hệ thống không bị mất dấu job.
- **Rác tệp trên Supabase Storage**:
  - *Biện pháp*: Đảm bảo lệnh xóa file trên Supabase Storage luôn nằm trong khối `finally` của tiến trình worker để dọn dẹp tài nguyên.
- **Làm tăng nhẹ dung lượng email gửi đi do đính kèm ảnh (CID Trade-off)**:
  - *Lý do*: Việc đính kèm trực tiếp ảnh QR code làm tăng dung lượng mỗi email lên khoảng 10-20KB. Tuy nhiên, mức tăng này là hoàn toàn chấp nhận được so với lợi ích to lớn là đảm bảo khách mời luôn hiển thị được vé soát tại cổng mà không phụ thuộc vào tình trạng mạng di động của Venue.
