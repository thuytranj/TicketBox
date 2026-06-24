## Context

Hiện tại, TicketBox chưa hỗ trợ tính năng cho phép Ban tổ chức nhập nhanh danh sách khách mời VIP. Các sự kiện âm nhạc thường có một lượng khách mời VIP nhận vé mời miễn phí. Danh sách này cần được tải lên thông qua tệp CSV bởi Admin, xử lý bất đồng bộ để tránh nghẽn API đối với các tệp lớn, lưu trữ vào database, cấp mã QR xác thực ký số bảo mật, và tự động gửi email thông báo kèm mã QR cho khách mời qua dịch vụ Resend.

## Goals / Non-Goals

**Goals:**
- Triển khai endpoint `POST /concerts/:id/guests/import` để nhận tệp CSV, tải lên Supabase Storage làm lưu trữ đám mây dùng chung, khởi tạo bản ghi Job theo dõi và gửi message vào RabbitMQ.
- Xây dựng RabbitMQ consumer xử lý job `vip_guest.import` thực hiện tải file từ Supabase Storage, parse CSV dạng stream, validate từng dòng dữ liệu và thực hiện chèn dữ liệu theo cụm (Chunked Bulk Insert) kết hợp Transaction và cơ chế bỏ qua trùng lặp (`ON CONFLICT DO NOTHING`) vào database.
- Ghi nhận trạng thái xử lý Job (`pending`, `processing`, `completed`, `failed`) và chi tiết log lỗi validate của từng dòng (chỉ lưu số dòng, email, và lý do lỗi) vào bảng `vip_guest_imports` để hiển thị trên UI.
- Sinh mã QR chứa chữ ký HMAC-SHA256 sử dụng `SERVER_SECRET` cho việc soát vé offline bảo mật.
- Tự động đẩy tác vụ gửi email thư mời kèm mã QR vào hàng đợi notification với cơ chế điều tiết tốc độ tiêu thụ (Rate Limiting Consumer) để tránh vượt quá rate limit của Resend.
- Tích hợp và cấu hình dịch vụ email Resend sử dụng SDK chính thức (`resend` package) thay thế cho cấu hình Nodemailer SMTP cũ.
- Áp dụng cơ chế **Tự động Retry (Max 3 lần)** với **Exponential Backoff** và chuyển tiếp tin nhắn lỗi vào **Dead Letter Queue (DLQ)** cho tác vụ gửi email nhằm tránh mất mát thông tin vé của khách mời.
- Cung cấp endpoint `GET /concerts/:id/guests/imports/:jobId` để poll trạng thái của Job và danh sách lỗi.

**Non-Goals:**
- Xây dựng giao diện UI quản trị để theo dõi realtime quá trình import.
- Cho phép chỉnh sửa template email gửi khách mời VIP trực tiếp trên hệ thống.
- Xuất danh sách khách mời hiện tại ngược lại ra file CSV.
- Hiển thị chuỗi ký tự chữ ký HMAC-SHA256 (64 ký tự) trong email thư mời.
- Cung cấp API kết xuất riêng tệp CSV chứa dòng lỗi.

## Decisions

### 1. Xử lý bất đồng bộ qua hàng đợi RabbitMQ
- **Lý do**: File CSV chứa danh sách VIP có thể lên tới hàng ngàn dòng, xử lý đồng bộ sẽ block luồng request của NestJS và dễ dẫn tới lỗi HTTP gateway timeout. Việc đẩy vào RabbitMQ giúp cô lập tài nguyên cho background worker, đảm bảo API chính luôn sẵn sàng cho luồng đặt vé quan trọng (Critical Booking Path).

### 2. Sử dụng Supabase Storage cho lưu trữ tệp CSV dùng chung
- **Lý do**: Tránh lỗi `File not found` trong mô hình multi-instance (khi API container và Worker container chạy độc lập). API sẽ tải tệp CSV lên Supabase Storage và truyền link URL qua RabbitMQ. Worker sẽ tải file từ URL này xuống để xử lý. Sau khi hoàn tất hoặc xảy ra lỗi, worker sẽ tự động xóa tệp trên Supabase Storage.

### 3. Tối ưu hóa Database I/O bằng Chunked Bulk Insert, Transaction và ON CONFLICT
- **Lý do**: Việc thực hiện 2,000 câu lệnh INSERT đơn lẻ sẽ gây nghẽn kết nối DB. Thay vào đó, chúng ta gom các bản ghi hợp lệ lại, chia nhỏ thành các cụm (ví dụ: 500 dòng/cụm) để bulk insert bằng TypeORM QueryBuilder trong một Database Transaction duy nhất.
- **ON CONFLICT**: Để xử lý tình huống Admin tải lên lại tệp CSV cũ (đã sửa một vài dòng) hoặc tải lên file lỗi đã được khắc phục, QueryBuilder được tích hợp mệnh đề `.orIgnore()` (tương đương với `ON CONFLICT (concert_id, email) DO NOTHING` trong SQL). Điều này giúp tự động bỏ qua các bản ghi email đã tồn tại trong concert mà không làm gián đoạn Transaction hay bắn ra lỗi.

### 4. Khống chế tốc độ gửi email (Rate Limiting Consumer) tại Worker
- **Lý do**: Tài khoản Resend miễn phí giới hạn tốc độ gửi tối đa ở mức **10 email/giây**. Gửi liên tiếp 2,000 email không kiểm soát sẽ kích hoạt lỗi `429 Too Many Requests`. Do đó, Email consumer sẽ được cấu hình RabbitMQ `prefetch = 1` kết hợp bộ điều tiết tốc độ tiêu thụ (ví dụ: delay 100-200ms trước mỗi lần gửi, tương đương 5-10 email/giây) để đảm bảo không vi phạm giới hạn của Resend.

### 5. Thiết lập các chỉ mục (Indexes) tối ưu hóa cho các thực thể mới
- **VipGuest**: Sử dụng composite unique index `(concert_id, email)` (thông qua `@Unique` decorator). Index này vừa phục vụ chặn trùng lặp email cho cùng một concert, vừa được tái sử dụng để tối ưu hóa truy vấn danh sách khách VIP theo `concert_id` (do `concert_id` là cột dẫn đầu).
- **VipGuestImport**: Sử dụng composite index `(concert_id, created_at DESC)` (thông qua `@Index` decorator) để tối ưu hóa truy vấn danh sách lịch sử import của một concert sắp xếp từ mới nhất đến cũ nhất trên trang quản trị.

### 6. Bổ sung chỉ mục khóa ngoại cho các thực thể hiện hữu (Order, Payment)
- **Lý do**: Hiện tại các thực thể quan trọng như `Order` (cột `userId`, `concertId`) và `Payment` (cột `orderId`) chưa được khai báo chỉ mục cho các trường khóa ngoại. Khi số lượng bản ghi tăng lên, các truy vấn lịch sử đặt vé của người dùng và tra cứu trạng thái giao dịch sẽ bị chậm do quét tuần tự (Seq Scan). Việc bổ sung `@Index` cho các cột này là cần thiết để tối ưu hóa tốc độ truy vấn đọc và tốc độ thực thi các phép JOIN/DELETE.

### 7. Bảng thực thể lưu vết Job import `vip_guest_imports`
- **Lý do**: Cần có nơi lưu giữ tiến trình (`total_rows`, `imported_rows`), trạng thái của Job import và danh sách JSON lỗi rút gọn (chỉ gồm `row`, `email`, `reason`) phục vụ hiển thị nhanh cho Admin mà không làm phình to dung lượng database của hệ thống.

### 8. Đính kèm mã QR trực quan trong Email dưới dạng CID (Content-ID) Attachment qua Resend
- **Lý do**: Tại các sự kiện âm nhạc lớn, kết nối mạng di động (3G/4G) của người dùng thường cực kỳ yếu hoặc mất kết nối hoàn toàn do quá tải trạm phát sóng. Để đảm bảo QR hiển thị offline tức thì khi mở hòm thư, chúng ta đính kèm ảnh QR trực tiếp vào email dưới dạng CID. Trong SDK Resend, cấu trúc đính kèm này được thực hiện bằng cách cung cấp trường `id` cho đối tượng trong mảng `attachments` (ví dụ: `{ filename: 'qrcode.png', content: qrBuffer, id: 'vip-qr-code' }`), ánh xạ trực tiếp tới thẻ `<img src="cid:vip-qr-code" />` trong nội dung email HTML.

### 9. Sử dụng Resend SDK (REST API) thay cho Nodemailer SMTP Relay
- **Lý do**: Sử dụng REST API SDK chính thức của Resend giúp giảm bớt giao thức bắt tay phức tạp của SMTP (giảm TCP/TLS handshake latency), cải thiện đáng kể tốc độ gửi email đồng thời cung cấp khả năng phát hiện lỗi phản hồi chi tiết từ HTTP response của Resend API.

### 10. Luồng khắc phục lỗi Đơn giản hóa (Simplified Error Recovery)
- **Lý do**: Thay vì kết xuất file CSV lỗi phức tạp và lưu trữ cồng kềnh, chúng ta áp dụng quy trình xử lý lỗi tối giản:
  - Khi có lỗi dòng, thông tin lỗi (số dòng, email, lý do) được hiển thị trực quan trên Web UI.
  - Admin mở file CSV gốc trên máy tính cá nhân, tìm đến các dòng lỗi tương ứng, sửa lại dữ liệu và tiến hành **upload lại toàn bộ tệp CSV gốc đã sửa**.
  - Nhờ cơ chế `ON CONFLICT DO NOTHING` đã thiết lập ở tầng Database, hệ thống sẽ tự động lọc bỏ các dòng đã chèn thành công trước đó và chỉ ghi nhận thêm các dòng mới được sửa. Cách tiếp cận này giúp tối ưu hóa hiệu năng, giảm thiểu 100% dung lượng database bloat và mang lại trải nghiệm quen thuộc cho người dùng.

### 11. Loại bỏ chuỗi Signature mã hóa (64 ký tự) khỏi Email Layout
- **Lý do**: Chuỗi HMAC-SHA256 dài 64 ký tự hiển thị thô trong email trông rất kỹ thuật, khô khan và làm xấu giao diện thư mời VIP của sự kiện nghệ thuật. Thay vào đó, chúng ta loại bỏ chuỗi này khỏi HTML template. Bản thân ảnh đính kèm QR Code chứa trọn vẹn chữ ký bảo mật này để máy quét soát vé offline đọc và giải mã, và hệ thống soát vé đã hỗ trợ chức năng tìm kiếm người dùng theo Tên/Email/SĐT trong danh sách đồng bộ SQLite nội bộ như một phương án dự phòng thủ công hoàn hảo.

### 12. Cơ chế Retry tự động và hàng đợi DLQ cho Email Job
- **Lý do**: Việc phân phối email qua API bên thứ ba có thể gặp lỗi tạm thời (mất mạng, quá tải API Resend). Do đó, hàng đợi RabbitMQ gửi email cần có cấu hình tự động retry lên tới 3 lần với cơ chế delay tăng dần (exponential backoff). Nếu vẫn thất bại sau 3 lần, message sẽ được đẩy vào Dead Letter Queue (DLQ) để phục vụ giám sát kỹ thuật và phục hồi thủ công sau này mà không gây mất dấu thông tin.

### 13. Ẩn đường dẫn fileUrl khỏi kết quả trả về của API
- **Lý do**: Đường dẫn `fileUrl` trên Supabase chỉ mang tính chất nội bộ cho Background Worker. Sau khi xử lý xong, file đã bị xóa nên URL này không còn tồn tại. Do đó, việc ẩn trường này thông qua `@Exclude({ toPlainOnly: true })` hoặc DTO serialization giúp tăng độ bảo mật và tránh làm nhiễu thông tin cho client.

### 14. Sử dụng class-validator @IsPhoneNumber('VN') kiểm soát SĐT khách mời
- **Lý do**: Số điện thoại của khách mời VIP cần được kiểm tra định dạng di động Việt Nam hợp lệ (chấp nhận cả đầu `0` hoặc `+84` và độ dài đúng chuẩn của các nhà mạng viễn thông). Dùng `@IsPhoneNumber('VN')` giúp đảm bảo tính linh hoạt hơn so với kiểm tra cứng độ dài 10 chữ số vốn có nguy cơ chặn lỗi các số có mã quốc gia hoặc số quốc tế.

### 15. Cung cấp API GET /concerts/:id/guests tra cứu danh sách VIP
- **Lý do**: Giúp ban tổ chức dễ dàng theo dõi trực quan danh sách khách VIP đã chèn thành công cho mỗi Concert. API này hỗ trợ phân trang (`page`, `limit`) và tìm kiếm tương đối (`search`) theo họ tên hoặc email khách mời để tối ưu hóa khả năng truy xuất dữ liệu quy mô lớn.

## Risks / Trade-offs

- **Lỗi kết nối tới Supabase Storage hoặc Resend API**:
  - *Biện pháp*: Thiết lập retry policy khi gọi các API bên ngoài và bọc trong try-catch để cập nhật trạng thái Job thành `failed` nếu lỗi kéo dài.
- **Admin tải lại tệp CSV gốc đã sửa dẫn đến chèn lặp dữ liệu**:
  - *Biện pháp*: Sử dụng cơ chế `ON CONFLICT DO NOTHING` ở tầng PostgreSQL. Các bản ghi đã tồn tại sẽ bị bỏ qua một cách an toàn mà không làm làm hỏng transaction hay tạo trùng khách VIP.
- **Làm tăng nhẹ dung lượng email gửi đi do đính kèm ảnh (CID Trade-off)**:
  - *Lý do*: Việc đính kèm trực tiếp ảnh QR code làm tăng dung lượng mỗi email lên khoảng 10-20KB. Tuy nhiên, mức tăng này là hoàn toàn chấp nhận được so với lợi ích to lớn là đảm bảo khách mời luôn hiển thị được vé soát tại cổng mà không phụ thuộc vào mạng di động.
