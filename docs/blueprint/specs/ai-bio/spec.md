# Đặc tả: Tự động Trích xuất và Tóm tắt Tiểu sử Nghệ sĩ bằng AI (AI-Generated Artist Biography)

## Mô tả
Tính năng cho phép Ban tổ chức tải lên hồ sơ thông tin nghệ sĩ định dạng PDF cho một sự kiện (concert). Hệ thống sẽ tự động trích xuất nội dung văn bản thô từ PDF và gọi API Google Gemini thông qua hàng đợi để tóm tắt thành một đoạn tiểu sử nghệ sĩ ngắn gọn (dưới 300 từ). Ban tổ chức có thể xem bản nháp, chỉnh sửa, yêu cầu tạo lại bằng AI hoặc phê duyệt để công bố chính thức lên trang chi tiết sự kiện cho khán giả xem.

## Luồng chính
1. **Tải lên PDF và Khởi tạo Tác vụ (Upload & Extract):**
   - Ban tổ chức gọi API `POST /concerts/:id/artist-bio` kèm theo tệp PDF.
   - Hệ thống thực hiện giải mã văn bản từ file PDF, lưu vào trường `raw_text` của bảng phụ `concert_ai_bios` với trạng thái `processing`.
   - Hệ thống đẩy một tác vụ xử lý vào hàng đợi RabbitMQ `ai.generate_bio` kèm theo ID người dùng và ID concert, sau đó trả về ngay lập tức mã trạng thái `202 Accepted`.
2. **Worker xử lý tóm tắt bằng AI (Background Worker):**
   - Background Worker tiêu thụ tác vụ từ hàng đợi RabbitMQ.
   - Worker gọi API Google Gemini sử dụng mô hình `gemini-3.5-flash` kèm theo prompt quy chuẩn để tóm tắt văn bản thô thành nội dung dưới 300 từ.
   - Nếu thành công: Cập nhật nội dung vào `draft_bio` và trạng thái thành `completed` trong bảng `concert_ai_bios`, đồng thời tạo bản ghi thông báo thành công cho Ban tổ chức.
3. **Tra cứu trạng thái và bản nháp (Poll & Retrieve):**
   - Ban tổ chức gửi yêu cầu `GET /concerts/:id/artist-bio` để theo dõi tiến độ xử lý của tác vụ AI.
   - Hệ thống trả về trạng thái (`processing`, `completed`, `failed`), nội dung bản nháp `draft_bio` hoặc thông báo lỗi `error` (nếu có).
4. **Tạo lại bản nháp từ văn bản thô (Regenerate Bio):**
   - Ban tổ chức có thể yêu cầu tạo lại bản nháp tiểu sử từ văn bản thô sẵn có trong DB qua endpoint `POST /concerts/:id/artist-bio/regenerate` mà không cần tải lên lại tệp PDF.
   - Hệ thống cập nhật trạng thái thành `processing`, gửi lại tác vụ vào RabbitMQ và phản hồi `202 Accepted`.
5. **Phê duyệt và Xuất bản (Confirm & Publish):**
   - Ban tổ chức thực hiện phê duyệt bản nháp (hoặc gửi nội dung tiểu sử đã tự chỉnh sửa trực tiếp) qua endpoint `PUT /concerts/:id/artist-bio/confirm`.
   - Hệ thống ghi đè nội dung chính thức vào trường `biography` của bảng `concerts`.
   - Hệ thống thực hiện giải phóng cache liên quan của concert đó trên Redis (`cache:concerts:{id}`, `cache:concerts:list:default:*`) để khán giả thấy thông tin cập nhật tức thì.

## Kịch bản lỗi
1. **Định dạng hoặc dung lượng tệp tải lên không hợp lệ:**
   - Nếu tệp tải lên không phải là PDF hoặc dung lượng vượt quá giới hạn cấu hình, hệ thống SHALL từ chối yêu cầu và trả về lỗi `400 Bad Request`.
2. **Lỗi kết nối hoặc lỗi giới hạn tần suất (Rate Limit) từ Gemini API:**
   - Trong quá trình gọi Gemini, nếu xảy ra lỗi timeout hoặc bị rate limit, Worker SHALL tự động thực hiện cơ chế thử lại (Retry) tối đa 3 lần với khoảng thời gian chờ tăng dần (exponential backoff).
   - Nếu cả 3 lần thử lại đều thất bại, hệ thống SHALL cập nhật trạng thái bản ghi thành `failed`, ghi chi tiết lỗi vào trường `error` và gửi thông báo lỗi cho Ban tổ chức qua `notification_logs`.
3. **Yêu cầu tạo lại bio từ sự kiện chưa có dữ liệu PDF:**
   - Khi gọi API `/regenerate` cho concert chưa từng có file PDF (hoặc trường `raw_text` trống), hệ thống SHALL từ chối và trả về lỗi `400 Bad Request`.
4. **Xác thực quyền hạn thất bại:**
   - Người dùng không có quyền quản lý sự kiện (không có vai trò `organizer` hoặc `admin`) gọi các endpoint này SHALL bị hệ thống từ chối và trả về lỗi `403 Forbidden`.

## Ràng buộc
- **Xử lý bất đồng bộ (Asynchronous):** Tiến trình xử lý AI và gọi API ngoài MUST được chạy bất đồng bộ qua RabbitMQ để tránh gây nghẽn và timeout luồng HTTP chính của hệ thống API Gateway.
- **Tính nhất quán cache:** Khi lưu chính thức tiểu sử nghệ sĩ vào bảng `concerts`, hệ thống MUST xóa sạch cache chi tiết của concert đó trên Redis để tránh hiển thị dữ liệu cũ cho khán giả.
- **Giới hạn số từ:** Bản tóm tắt tiểu sử tạo ra từ AI SHALL có độ dài không vượt quá 300 từ để phù hợp với hiển thị giao diện.

## Tiêu chí chấp nhận
- Tải lên PDF hợp lệ trả về mã HTTP `202 Accepted` kèm ID sự kiện.
- Endpoint `/regenerate` hoạt động chính xác bằng cách đọc `raw_text` trong DB mà không cần người dùng chọn tệp tải lại.
- Dữ liệu hiển thị ở API tra cứu trạng thái chuyển trạng thái từ `processing` sang `completed` đúng lúc Worker xử lý xong.
- Sau khi phê duyệt thành công, trường `biography` trong bảng `concerts` được điền đúng dữ liệu, và cache của concert tương ứng trên Redis bị vô hiệu hóa hoàn toàn.
