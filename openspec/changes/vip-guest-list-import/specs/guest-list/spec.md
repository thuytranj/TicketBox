# Đặc tả: Nhập danh sách khách mời VIP từ CSV

## Mô tả
Cho phép Ban tổ chức (Organizer) tải lên tệp CSV chứa danh sách khách mời VIP. Dữ liệu tệp CSV sẽ được tải lên dịch vụ đám mây Supabase Storage dùng chung nhằm hỗ trợ hoạt động tin cậy trong môi trường phân tán đa instances. Tiến trình worker nền sẽ tải tệp xuống, phân tích dạng stream (sử dụng `csv-parser`), thực hiện validate cấu trúc dữ liệu từng dòng, gom nhóm dữ liệu hợp lệ và thực hiện chèn tối ưu theo cụm (Chunked Bulk Insert + Transaction) vào PostgreSQL. Sử dụng cơ chế chèn tránh trùng lặp (`ON CONFLICT (concert_id, email) DO NOTHING`) để cho phép ban tổ chức tải lên lại tệp gốc đã sửa mà không chèn trùng lặp khách mời.
Đồng thời, hệ thống sinh chữ ký điện tử HMAC-SHA256 phục vụ soát vé offline bảo mật và đẩy tin nhắn gửi email đính kèm mã QR sang hàng đợi thông báo sử dụng SDK Resend (REST API) với tốc độ tiêu thụ được khống chế tại Worker (Rate Limiting Consumer) để tránh bị khóa tài khoản hoặc vượt hạn mức API. Hình ảnh mã QR được đính kèm trực tiếp dưới dạng CID (Content-ID) Attachment để hòm thư tải và lưu trữ cục bộ, đảm bảo hiển thị tức thì và hoàn toàn offline cho người dùng tại cửa soát vé bất kể kết nối mạng nghẽn. Bố cục email chỉ hiển thị ảnh QR Code trực quan, loại bỏ hoàn toàn việc in chuỗi chữ ký số hash dài 64 ký tự để tối ưu hóa thiết kế thẩm mỹ của thư mời.
Để ứng phó với lỗi kết nối Resend API tạm thời, hàng đợi thông báo gửi email cấu hình cơ chế tự động gửi lại (Retry) tối đa 3 lần và chuyển vào hàng đợi thư chết (DLQ) nếu lỗi hoàn toàn.
Đối với các dòng dữ liệu bị lỗi, hệ thống ghi nhận thông tin dòng lỗi rút gọn (số dòng, email, lý do lỗi) vào DB để Admin đối chiếu, sửa trực tiếp trên file gốc cá nhân và tải lên lại.

## Luồng chính
1. Ban tổ chức gửi yêu cầu tải tệp CSV (`POST /api/v1/concerts/:id/guests/import`).
2. API instance nhận tệp, tải lên Supabase Storage làm lưu trữ đám mây dùng chung.
3. API tạo bản ghi Job tracking trong cơ sở dữ liệu (`vip_guest_imports`) với trạng thái ban đầu là `processing`.
4. API gửi message chứa ID Job, ID concert và URL tệp CSV trên Supabase Storage vào hàng đợi RabbitMQ (`vip_guest.import`), rồi lập tức phản hồi HTTP `202 Accepted` kèm ID Job cho Client để thực hiện polling.
5. Worker nhận nhiệm vụ từ RabbitMQ, tải tệp CSV từ Supabase Storage và thực hiện phân tích dạng stream (`csv-parser`).
6. Với từng dòng dữ liệu, thực hiện kiểm tra định dạng dữ liệu qua DTO và `class-validator` (họ tên, email, số điện thoại, công ty).
7. Gom nhóm các dòng hợp lệ, kiểm tra trùng lặp email đối với concert hiện tại dựa trên ràng buộc duy nhất trong cơ sở dữ liệu.
8. Thực hiện chèn dữ liệu các khách mời VIP hợp lệ theo từng cụm (ví dụ 500 dòng/cụm) bằng TypeORM QueryBuilder bọc trong một Database Transaction duy nhất, kết hợp mệnh đề chèn tránh trùng lặp `ON CONFLICT DO NOTHING`.
9. Sinh chữ ký bảo mật HMAC-SHA256 kết hợp payload định danh (`guestId:concertId`) và `SERVER_SECRET` cho mỗi khách mời.
10. Đẩy tin nhắn gửi email thư mời đính kèm mã QR dạng CID Attachment sang exchange/queue notification. Email worker tiêu thụ hàng đợi với cấu hình `prefetch = 1` và bộ điều tiết tốc độ (delay 100-200ms trước mỗi lần gửi) sử dụng Resend SDK nhằm khống chế lưu lượng gửi (Rate Limiting Consumer) tối đa 5-10 email/giây để tránh lỗi 429 từ Resend API.
11. Sau khi hoàn thành hoặc có lỗi xảy ra, worker cập nhật trạng thái Job (`completed` hoặc `failed`), lưu tổng số dòng, số dòng đã nhập thành công và danh sách JSON lỗi cụ thể (bao gồm số dòng, email, và lý do lỗi), đồng thời thực hiện xóa file trên Supabase Storage.

## Kịch bản lỗi
- **Lỗi kết nối / Timeout tới Supabase Storage khi upload/download:** Worker thực hiện retry policy. Nếu thất bại hoàn toàn, cập nhật trạng thái Job thành `failed` kèm thông điệp lỗi chi tiết để quản trị viên theo dõi.
- **Lỗi từ Resend API (như lỗi xác thực API Key, quá quota 100 mail/ngày, quá 10 mail/giây):** Worker bắt lỗi từ SDK Resend, cập nhật trạng thái Job thành `failed` hoặc ghi nhận lý do lỗi cụ thể vào cột JSON log lỗi của Job.
- **File CSV bị hỏng cấu trúc hoặc sai định dạng (Malformed CSV):** Worker bắt lỗi trong luồng stream, cập nhật trạng thái Job thành `failed`, ghi nhận lỗi cấu trúc tệp và dọn dẹp file.
- **Có dòng dữ liệu không hợp lệ hoặc trùng lặp email:** Worker bỏ qua các dòng lỗi đó, tiếp tục xử lý các dòng hợp lệ khác. Chi tiết lỗi của dòng (bao gồm số dòng, email và lý do lỗi) được ghi nhận chính xác vào cột JSON log lỗi của Job trong cơ sở dữ liệu.
- **Lỗi gửi email tạm thời ở Worker:** Message tự động được retry lại tối đa 3 lần với exponential backoff. Nếu lỗi vẫn tiếp tục kéo dài (ví dụ: Resend khóa tài khoản), message được định tuyến sang DLQ để đối soát thủ công và chuyển trạng thái log gửi thư sang thất bại.
- **Worker bị crash giữa chừng khi đang xử lý Job:** Nhờ cơ chế RabbitMQ Manual Acknowledgement, tin nhắn sẽ được tự động requeue hoặc chuyển sang DLQ khi worker mất kết nối, giúp hệ thống không bị mất dấu hay treo trạng thái Job vĩnh viễn.

## Ràng buộc
- **Phân quyền bảo mật:** API tải lên CSV và API truy vấn trạng thái Job chỉ cho phép tài khoản có vai trò `organizer` thực hiện.
- **Chống giả mạo vé:** Mã QR của khách mời VIP bắt buộc phải có chữ ký số HMAC-SHA256 sử dụng `SERVER_SECRET` để soát vé offline ngoại vi một cách an toàn.
- **Giao thức và tích hợp Email:** Hệ thống sử dụng trực tiếp SDK Resend (REST API) thay vì SMTP. Cấu hình email thông qua `RESEND_API_KEY` và `MAIL_FROM`.
- **Bố cục thư mời:** Email thư mời chỉ hiển thị ảnh QR Code dưới dạng CID nhúng, KHÔNG hiển thị chuỗi ký tự mã hash signature dài 64 ký tự.
- **Tính chống mất mát của thư mời:** Thiết lập cơ chế tự động gửi lại thư (Retry) tối đa 3 lần và hàng đợi thư chết (DLQ) cho email worker.
- **Tốc độ gửi Email:** Giới hạn lưu lượng gửi email tối đa 5-10 email/giây tại Worker nhằm duy trì độ tin cậy của địa chỉ IP/Tên miền (IP/Domain reputation) và tránh vi phạm giới hạn 10/s của Resend.
- **Nhất quán cơ sở dữ liệu:** Sử dụng Transaction khi thực hiện Chunked Bulk Insert để đảm bảo tính toàn vẹn của dữ liệu khi chèn theo cụm.
- **Ràng buộc dữ liệu duy nhất:** Bắt buộc có composite unique index `(concert_id, email)` trên bảng `vip_guests` để chống ghi đè hoặc tạo nhiều bản ghi VIP cho cùng một email trong một buổi hòa nhạc.
- **Chỉ mục hiệu năng:** Phải đánh chỉ mục khóa ngoại trên bảng tracking (`vip_guest_imports`) và các thực thể liên quan (`orders` và `payments`) để đảm bảo không bị suy giảm hiệu năng khi số lượng dữ liệu lớn.
- **Đường dẫn lưu trữ nội bộ (fileUrl):** Phải được ẩn khỏi tất cả các API trả về cho client để đảm bảo bảo mật thông tin nội bộ của hệ thống lưu trữ.
- **Định dạng số điện thoại:** Số điện thoại nhập vào của khách mời VIP phải tuân thủ định dạng số điện thoại di động hợp lệ tại Việt Nam (cho phép đầu số 0 hoặc +84 và các dải số di động quy định) thông qua kiểm tra `@IsPhoneNumber('VN')`.

## Tiêu chí chấp nhận
- API trả về mã trạng thái HTTP 202 Accepted và ID Job hợp lệ khi nhận tệp CSV thành công.
- Tệp CSV được lưu trữ thành công trên Supabase Storage và bị xóa dọn dẹp sau khi tiến trình hoàn tất hoặc lỗi.
- Toàn bộ khách mời VIP hợp lệ được lưu đầy đủ vào bảng `vip_guests` và bỏ qua các email đã tồn tại nhờ mệnh đề `ON CONFLICT DO NOTHING`.
- Danh sách các dòng dữ liệu bị lỗi được ghi nhận đầy đủ, chi tiết dưới dạng JSON vào bản ghi Job trong bảng `vip_guest_imports` để Admin tra cứu.
- Trạng thái của Job chuyển sang `completed` (nếu có ít nhất một dòng thành công) hoặc `failed` (nếu lỗi toàn bộ file).
- API `GET /concerts/:id/guests/imports/:jobId` không chứa thuộc tính `fileUrl` trong JSON phản hồi.
- Email thư mời đính kèm QR code CID (và không in chuỗi hash) được phân phối đúng địa chỉ với tốc độ gửi được kiểm soát an toàn qua API của Resend, đi kèm cơ chế Retry/DLQ hoạt động đúng đắn.
- Hệ thống cung cấp API `GET /concerts/:id/guests` phân quyền cho vai trò `organizer` và `admin` để tra cứu danh sách khách VIP đã chèn thành công cho Concert với đầy đủ phân trang và tìm kiếm theo họ tên hoặc email.

## MODIFIED Requirements

### Requirement: Nhập danh sách khách mời VIP từ CSV
Hệ thống SHALL cung cấp API cho phép Ban tổ chức tải lên tệp CSV chứa thông tin khách mời VIP để hệ thống xử lý bất đồng bộ qua hàng đợi, thực hiện kiểm tra lỗi dữ liệu, loại bỏ trùng lặp bằng cơ chế chèn tránh trùng lặp (`ON CONFLICT`), lưu trữ vào cơ sở dữ liệu, sinh mã QR bảo mật và gửi email cho khách mời mà không ảnh hưởng đến các hoạt động khác.

#### Scenario: Nhập thành công tệp CSV hợp lệ
- **WHEN** Ban tổ chức gọi API tải lên tệp CSV hợp lệ của một concert
- **THEN** Hệ thống tải tệp CSV lên Supabase Storage, tạo Job với trạng thái "processing", đẩy tác vụ vào hàng đợi, trả về HTTP 202 Accepted kèm mã `import_job_id` ngay lập tức, sau đó tiến trình nền tải tệp từ Supabase Storage, phân tích tệp, thực hiện chèn dữ liệu các khách mời VIP hợp lệ vào database theo cụm (Chunked Bulk Insert) kết hợp Transaction và bỏ qua các bản ghi trùng email (`ON CONFLICT DO NOTHING`), sinh mã QR code chứa HMAC chữ ký số bảo mật, gửi email (không chứa chuỗi hash signature hiển thị) cho khách mời thông qua bộ khống chế tốc độ tiêu thụ (Rate Limiting Consumer) sử dụng Resend SDK để tránh spam và lỗi 429, và cập nhật trạng thái Job thành công.

#### Scenario: Bỏ qua dòng lỗi và ghi nhận nhật ký lỗi
- **WHEN** Tệp CSV có một vài dòng bị lỗi dữ liệu (như thiếu Email, định dạng Phone không đúng) hoặc trùng email
- **THEN** Tiến trình nền bỏ qua các dòng lỗi đó, tiếp tục import các dòng hợp lệ khác, gửi email cho các dòng hợp lệ thông qua Resend SDK, ghi nhận chi tiết danh sách lỗi (chỉ gồm số dòng, email và lý do lỗi) dưới dạng JSON vào bản ghi Job trong cơ sở dữ liệu và cập nhật Job hoàn thành.
