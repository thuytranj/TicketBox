# ai-bio Specification

## Purpose
TBD - created by archiving change blueprint. Update Purpose after archive.
## Requirements
### Requirement: Tự động trích xuất và tóm tắt tiểu sử nghệ sĩ bằng AI

Hệ thống SHALL cho phép Ban tổ chức tải lên tệp PDF hồ sơ nghệ sĩ của một concert qua API endpoint `POST /concerts/:id/artist-bio`. Hệ thống SHALL thực hiện trích xuất nội dung văn bản từ tệp PDF, khởi tạo dữ liệu trong bảng `concert_ai_bios` với trạng thái `processing`, đẩy task vào hàng đợi RabbitMQ `ai.generate_bio` kèm theo ID người dùng (`userId`), và phản hồi ngay lập tức với mã trạng thái `202 Accepted`. Tiếp theo, hệ thống Worker SHALL tiêu thụ task từ RabbitMQ, gọi API Google Gemini với mô hình `gemini-3.5-flash` để tóm tắt tiểu sử dưới 300 từ. Nếu thành công, hệ thống cập nhật kết quả nháp `draft_bio` và trạng thái `completed` trong bảng `concert_ai_bios`, đồng thời tạo một bản ghi thông báo thành công trong bảng `notification_logs` cho tài khoản Admin. Nếu thất bại (sau tối đa 3 lần thử lại), hệ thống cập nhật trạng thái `failed` kèm thông tin lỗi vào trường `error` trong bảng `concert_ai_bios`, đồng thời tạo một bản ghi thông báo thất bại trong bảng `notification_logs` cho tài khoản Admin.

#### Scenario: Tải lên PDF và khởi tạo sinh tóm tắt thành công

- **WHEN** Ban tổ chức tải lên tệp PDF press kit hợp lệ của nghệ sĩ cho một concert thông qua `POST /concerts/:id/artist-bio`
- **THEN** Hệ thống lưu trữ trạng thái đang xử lý (`processing`), đưa task vào hàng đợi `ai.generate_bio`, và trả về mã trạng thái `202 Accepted`

#### Scenario: Tải lên PDF không hợp lệ thất bại

- **WHEN** Người dùng không có quyền organizer tải lên tệp tin, hoặc tệp tin tải lên không phải là định dạng PDF
- **THEN** Hệ thống từ chối yêu cầu và trả về lỗi tương ứng (400 Bad Request hoặc 403 Forbidden)

#### Scenario: Gemini API bị lỗi và Worker tự động retry thất bại

- **WHEN** API Gemini bị lỗi rate limit hoặc timeout liên tục cả 3 lần gọi
- **THEN** Hệ thống Worker lưu trạng thái lỗi `failed` và thông tin lỗi vào trường `error` của bảng `concert_ai_bios`, đồng thời tạo một bản ghi thông báo thất bại gửi cho tài khoản Admin yêu cầu trong bảng `notification_logs`

### Requirement: Tạo lại bản nháp tiểu sử nghệ sĩ từ văn bản đã trích xuất

Hệ thống SHALL cho phép Ban tổ chức yêu cầu tạo lại bản nháp tiểu sử bằng AI từ dữ liệu văn bản thô đã trích xuất từ trước qua API endpoint `POST /concerts/:id/artist-bio/regenerate` mà không cần upload lại file PDF.

#### Scenario: Tạo lại bản nháp tiểu sử từ văn bản thô thành công

- **WHEN** Ban tổ chức gửi yêu cầu `POST /concerts/:id/artist-bio/regenerate` với token xác thực hợp lệ đối với concert đã có bản ghi `raw_text`
- **THEN** Hệ thống cập nhật trạng thái bản nháp thành `processing`, đẩy task vào hàng đợi `ai.generate_bio` kèm theo ID người dùng và trả về mã trạng thái `202 Accepted`

#### Scenario: Tạo lại bản nháp tiểu sử thất bại do chưa tải lên PDF bao giờ

- **WHEN** Ban tổ chức gửi yêu cầu `POST /concerts/:id/artist-bio/regenerate` đối với concert chưa từng tải lên PDF (chưa có bản ghi hoặc `raw_text` rỗng)
- **THEN** Hệ thống từ chối yêu cầu và trả về lỗi `400 Bad Request` kèm thông báo lỗi phù hợp

### Requirement: Tra cứu trạng thái sinh tiểu sử và bản nháp

Hệ thống SHALL cho phép Ban tổ chức tra cứu trạng thái xử lý AI và nội dung bản nháp tiểu sử nghệ sĩ của một concert qua API endpoint `GET /concerts/:id/artist-bio`.

#### Scenario: Lấy trạng thái và bản nháp tiểu sử thành công

- **WHEN** Ban tổ chức gửi yêu cầu `GET /concerts/:id/artist-bio` với token xác thực hợp lệ
- **THEN** Hệ thống truy vấn từ bảng `concert_ai_bios` và trả về thông tin trạng thái (`status`), bản nháp (`draft_bio`) và lỗi (`error` nếu có) kèm mã trạng thái `200 OK`

### Requirement: Phê duyệt và công bố tiểu sử nghệ sĩ lên concert

Hệ thống SHALL cho phép Ban tổ chức phê duyệt bản nháp (hoặc gửi nội dung tiểu sử đã tự chỉnh sửa) qua API endpoint `PUT /concerts/:id/artist-bio/confirm` để lưu chính thức vào bảng `concerts` làm tiểu sử hiển thị công khai. Hệ thống SHALL thực hiện xóa các khóa cache liên quan đến Concert đó trên Redis để cập nhật thông tin mới nhất.

#### Scenario: Phê duyệt và lưu tiểu sử chính thức thành công

- **WHEN** Ban tổ chức gửi yêu cầu `PUT /concerts/:id/artist-bio/confirm` kèm theo payload chứa nội dung tiểu sử nghệ sĩ và token xác thực hợp lệ
- **THEN** Hệ thống cập nhật nội dung vào trường `biography` của concert trong bảng `concerts`, đồng thời thực hiện xóa các cache Redis của concert đó (khóa `cache:concerts:{id}`, `cache:concerts:list:default:*`) và phản hồi với mã trạng thái `200 OK`

