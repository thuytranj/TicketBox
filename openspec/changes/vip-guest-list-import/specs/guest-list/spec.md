# Đặc tả: Nhập danh sách khách mời VIP từ CSV

## Mô tả
Cho phép Ban tổ chức (Organizer) tải lên tệp CSV chứa danh sách khách mời VIP. Dữ liệu tệp CSV sẽ được tải lên dịch vụ đám mây Supabase Storage dùng chung nhằm hỗ trợ hoạt động tin cậy trong môi trường phân tán đa instances. Tiến trình worker nền sẽ tải tệp xuống, phân tích dạng stream (sử dụng `csv-parser`), thực hiện validate cấu trúc dữ liệu từng dòng, gom nhóm dữ liệu hợp lệ và thực hiện chèn tối ưu theo cụm (Chunked Bulk Insert + Transaction) vào PostgreSQL. Đồng thời, hệ thống sinh chữ ký điện tử HMAC-SHA256 phục vụ soát vé offline bảo mật và đẩy tin nhắn gửi email đính kèm mã QR sang hàng đợi thông báo với tốc độ tiêu thụ được khống chế tại Worker (Rate Limiting Consumer) để tránh bị khóa tài khoản SMTP. Hình ảnh mã QR được đính kèm trực tiếp dưới dạng CID (Content-ID) Attachment để hòm thư tải và lưu trữ cục bộ, đảm bảo hiển thị tức thì và hoàn toàn offline cho người dùng tại cửa soát vé bất kể kết nối mạng nghẽn.

## Luồng chính
1. Ban tổ chức gửi yêu cầu tải tệp CSV (`POST /api/v1/concerts/:id/guests/import`).
2. API instance nhận tệp, tải lên Supabase Storage làm lưu trữ đám mây dùng chung.
3. API tạo bản ghi Job tracking trong cơ sở dữ liệu (`vip_guest_imports`) với trạng thái ban đầu là `processing`.
4. API gửi message chứa ID Job, ID concert và URL tệp CSV trên Supabase Storage vào hàng đợi RabbitMQ (`vip_guest.import`), rồi lập tức phản hồi HTTP `202 Accepted` kèm ID Job cho Client để thực hiện polling.
5. Worker nhận nhiệm vụ từ RabbitMQ, tải tệp CSV từ Supabase Storage và thực hiện phân tích dạng stream (`csv-parser`).
6. Với từng dòng dữ liệu, thực hiện kiểm tra định dạng dữ liệu qua DTO và `class-validator` (họ tên, email, số điện thoại, công ty).
7. Gom nhóm các dòng hợp lệ, kiểm tra trùng lặp email đối với concert hiện tại dựa trên ràng buộc duy nhất trong cơ sở dữ liệu.
8. Thực hiện chèn dữ liệu các khách mời VIP hợp lệ theo từng cụm (ví dụ 500 dòng/cụm) bằng TypeORM QueryBuilder bọc trong một Database Transaction duy nhất để tối ưu hóa I/O Postgres.
9. Sinh chữ ký bảo mật HMAC-SHA256 kết hợp payload định danh (`guestId:concertId`) và `SERVER_SECRET` cho mỗi khách mời.
10. Đẩy tin nhắn gửi email thư mời đính kèm mã QR dạng CID Attachment sang exchange/queue notification. Email worker tiêu thụ hàng đợi với cấu hình `prefetch = 1` và bộ điều tiết tốc độ (delay 100-200ms trước mỗi lần gửi) để khống chế lưu lượng gửi (Rate Limiting Consumer) tối đa 5-10 email/giây.
11. Sau khi hoàn thành hoặc có lỗi xảy ra, worker cập nhật trạng thái Job (`completed` hoặc `failed`), lưu tổng số dòng, số dòng đã nhập thành công và danh sách JSON lỗi cụ thể, đồng thời thực hiện xóa file trên Supabase Storage.

## Kịch bản lỗi
- **Lỗi kết nối / Timeout tới Supabase Storage khi upload/download:** Worker thực hiện retry policy. Nếu thất bại hoàn toàn, cập nhật trạng thái Job thành `failed` kèm thông điệp lỗi chi tiết để quản trị viên theo dõi.
- **File CSV bị hỏng cấu trúc hoặc sai định dạng (Malformed CSV):** Worker bắt lỗi trong luồng stream, cập nhật trạng thái Job thành `failed`, ghi nhận lỗi cấu trúc tệp và dọn dẹp file.
- **Có dòng dữ liệu không hợp lệ hoặc trùng lặp email:** Worker bỏ qua các dòng lỗi đó, tiếp tục xử lý các dòng hợp lệ khác. Chi tiết lỗi của dòng (số dòng, email, lý do lỗi) được ghi nhận chính xác vào cột JSON log lỗi của Job trong cơ sở dữ liệu.
- **Worker bị crash giữa chừng khi đang xử lý Job:** Nhờ cơ chế RabbitMQ Manual Acknowledgement, tin nhắn sẽ được tự động requeue hoặc chuyển sang DLQ khi worker mất kết nối, giúp hệ thống không bị mất dấu hay treo trạng thái Job vĩnh viễn.

## Ràng buộc
- **Phân quyền bảo mật:** API tải lên CSV và API truy vấn trạng thái Job chỉ cho phép tài khoản có vai trò `organizer` thực hiện.
- **Chống giả mạo vé:** Mã QR của khách mời VIP bắt buộc phải có chữ ký số HMAC-SHA256 sử dụng `SERVER_SECRET` để soát vé offline ngoại vi một cách an toàn.
- **Tốc độ gửi Email:** Giới hạn lưu lượng gửi email tối đa 5-10 email/giây tại Worker nhằm duy trì độ tin cậy của địa chỉ IP/Tên miền (IP/Domain reputation).
- **Nhất quán cơ sở dữ liệu:** Sử dụng Transaction khi thực hiện Chunked Bulk Insert để đảm bảo tính toàn vẹn của dữ liệu khi chèn theo cụm.
- **Ràng buộc dữ liệu duy nhất:** Bắt buộc có composite unique index `(concert_id, email)` trên bảng `vip_guests` để chống ghi đè hoặc tạo nhiều bản ghi VIP cho cùng một email trong một buổi hòa nhạc.
- **Chỉ mục hiệu năng:** Phải đánh chỉ mục khóa ngoại trên bảng tracking (`vip_guest_imports`) và các thực thể liên quan (`orders` và `payments`) để đảm bảo không bị suy giảm hiệu năng khi số lượng dữ liệu lớn.

## Tiêu chí chấp nhận
- API trả về mã trạng thái HTTP 202 Accepted và ID Job hợp lệ khi nhận tệp CSV thành công.
- Tệp CSV được lưu trữ thành công trên Supabase Storage và bị xóa dọn dẹp sau khi tiến trình hoàn tất hoặc lỗi.
- Toàn bộ khách mời VIP hợp lệ được lưu đầy đủ vào bảng `vip_guests` kèm theo mã QR chứa chữ ký HMAC chính xác.
- Danh sách các dòng dữ liệu bị lỗi được ghi nhận đầy đủ, chi tiết dưới dạng JSON vào bản ghi Job trong bảng `vip_guest_imports` để Admin tra cứu.
- Trạng thái của Job chuyển sang `completed` (nếu có ít nhất một dòng thành công) hoặc `failed` (nếu lỗi toàn bộ file).
- Email thư mời kèm QR code được phân phối đúng địa chỉ với tốc độ gửi được kiểm soát an toàn.

## MODIFIED Requirements

### Requirement: Nhập danh sách khách mời VIP từ CSV
Hệ thống SHALL cung cấp API cho phép Ban tổ chức tải lên tệp CSV chứa thông tin khách mời VIP để hệ thống xử lý bất đồng bộ qua hàng đợi, thực hiện kiểm tra lỗi dữ liệu, loại bỏ trùng lặp, lưu trữ vào cơ sở dữ liệu, sinh mã QR bảo mật và gửi email cho khách mời mà không ảnh hưởng đến các hoạt động khác.

#### Scenario: Nhập thành công tệp CSV hợp lệ
- **WHEN** Ban tổ chức gọi API tải lên tệp CSV hợp lệ của một concert
- **THEN** Hệ thống tải tệp CSV lên Supabase Storage, tạo Job với trạng thái "processing", đẩy tác vụ vào hàng đợi, trả về HTTP 202 Accepted kèm mã `import_job_id` ngay lập tức, sau đó tiến trình nền tải tệp từ Supabase Storage, phân tích tệp, thực hiện chèn dữ liệu các khách mời VIP hợp lệ vào database theo cụm (Chunked Bulk Insert) kết hợp Transaction, sinh mã QR code chứa HMAC chữ ký số bảo mật, gửi email cho khách mời thông qua bộ khống chế tốc độ tiêu thụ (Rate Limiting Consumer) để tránh spam, và cập nhật trạng thái Job thành công.

#### Scenario: Bỏ qua dòng lỗi và ghi nhận nhật ký lỗi
- **WHEN** Tệp CSV có một vài dòng bị lỗi dữ liệu (như thiếu Email, định dạng Phone không đúng) hoặc trùng email
- **THEN** Tiến trình nền bỏ qua các dòng lỗi đó, tiếp tục import các dòng hợp lệ khác, gửi email cho các dòng hợp lệ, ghi nhận chi tiết các dòng lỗi kèm lý do vào trường lỗi của Job trong cơ sở dữ liệu và cập nhật Job hoàn thành.
