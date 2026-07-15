## Context

Hiện tại, hệ thống TicketBox chưa hỗ trợ tính năng tự động tạo tiểu sử tóm tắt cho nghệ sĩ biểu diễn trong Concert. Theo tài liệu kiến trúc tổng thể (`docs/design.md`), tính năng này sẽ được triển khai theo mô hình bất đồng bộ (Asynchronous Worker) sử dụng RabbitMQ để truyền tải và xử lý tác vụ trích xuất text từ tệp PDF, gọi API Google Gemini và cập nhật kết quả nháp. Để tăng tính tin cậy và kiểm soát nội dung của Ban tổ chức, hệ thống tách biệt dữ liệu nháp của AI ra bảng riêng và cung cấp quy trình Duyệt (Draft & Approve) kèm khả năng tự động tạo lại (Regenerate) từ text thô có sẵn trước khi lưu chính thức vào concert. Khi worker sinh xong bio, hệ thống sẽ tự động gửi thông báo In-app cho tài khoản Admin yêu cầu.

## Goals / Non-Goals

**Goals:**

- Tạo bảng mới `concert_ai_bios` và Entity `ConcertAIBio` để quản lý độc lập tiến trình sinh và nội dung nháp của AI.
- Cập nhật bảng `concerts` (Entity `Concert`) để bổ sung trường `biography` (`text`, `nullable: true`) lưu thông tin tiểu sử đã được Ban tổ chức phê duyệt.
- Xây dựng API `POST /concerts/:id/artist-bio` chỉ cho phép vai trò `organizer` tải lên file PDF (giới hạn dung lượng tối đa 10MB).
- Sử dụng thư viện `pdf-parse` để trích xuất text từ buffer file PDF, lưu text thô và cập nhật trạng thái xử lý AI thành `processing` ở bảng `concert_ai_bios`.
- Thiết lập RabbitMQ queue `ai.generate_bio` và publish task chứa text thô, ID concert và ID của người dùng thực hiện (`userId`) vào hàng đợi.
- Xây dựng background worker tiêu thụ task `ai.generate_bio`, sử dụng SDK `@google/generative-ai` và model `gemini-3.5-flash` để tóm tắt tiểu sử ngắn gọn dưới 300 từ.
- Triển khai cơ chế retry tối đa 3 lần với exponential backoff cho worker khi gặp lỗi kết nối hoặc rate limit từ Gemini API.
- Cập nhật kết quả tóm tắt vào cột `draft_bio` và trạng thái `status` thành `completed` (hoặc `failed` kèm theo `error` nếu lỗi) vào bảng `concert_ai_bios`.
- Khi kết thúc quá trình sinh, Worker tự động tạo bản ghi trong bảng `notification_logs` để gửi thông báo In-app báo cáo kết quả cho tài khoản Admin đã thực hiện yêu cầu.
- Xây dựng API `POST /concerts/:id/artist-bio/regenerate` cho phép Ban tổ chức yêu cầu AI tạo lại bản nháp tiểu sử từ `raw_text` đã trích xuất trước đó mà không cần upload lại file PDF.
- Xây dựng API `GET /concerts/:id/artist-bio` để lấy trạng thái và bản nháp tiểu sử.
- Xây dựng API `PUT /concerts/:id/artist-bio/confirm` cho phép Ban tổ chức phê duyệt bản nháp (hoặc cập nhật nội dung chỉnh sửa) để lưu chính thức vào trường `biography` của concert, đồng thời xóa bộ nhớ đệm (cache) của Concert đó trên Redis.

**Non-Goals:**

- Xây dựng giao diện người dùng frontend hoặc mobile app (chỉ tập trung hoàn toàn vào xử lý phía backend).
- Lưu trữ lâu dài file PDF gốc (file chỉ được xử lý tạm thời qua memory buffer để trích xuất text).
- Hỗ trợ các định dạng file khác ngoài PDF (như DOCX, TXT, hình ảnh).

## Decisions

### 1. Tách biệt dữ liệu AI ra bảng phụ `concert_ai_bios` (1-to-1 relationship với `concerts`)

- **Lý do**: Tránh làm phình to bảng chính `concerts` với các cột chỉ phục vụ quá trình xử lý AI bất đồng bộ như `status`, `error`, `raw_text` (text thô trích xuất từ PDF). Giúp cô lập dữ liệu thô dung lượng lớn không cần thiết cho các truy vấn xem concert thông thường. Đồng thời, cấu trúc này hỗ trợ tự nhiên luồng Duyệt bản nháp: AI ghi nhận kết quả vào bảng phụ, chỉ khi Admin bấm duyệt thì dữ liệu mới được đồng bộ sang bảng chính.
- **Cấu trúc bảng `concert_ai_bios`**:
  - `concert_id`: `uuid`, `PRIMARY KEY`, `FOREIGN KEY REFERENCES concerts(id) ON DELETE CASCADE`
  - `raw_text`: `text` - Text thô trích xuất từ PDF
  - `draft_bio`: `text`, `nullable: true` - Bản nháp tóm tắt tiểu sử sinh bởi AI
  - `status`: `varchar(50)`, `default: 'processing'` - Trạng thái: `processing`, `completed`, `failed`
  - `error`: `text`, `nullable: true` - Chi tiết lỗi
  - `updated_at`: `timestamp`, `default: CURRENT_TIMESTAMP`

### 2. Xử lý bất đồng bộ qua RabbitMQ thay vì gọi trực tiếp (Synchronous)

- **Lý do**: API của Google Gemini có độ trễ lớn (thường mất từ 5 - 15 giây). Việc gọi đồng bộ trực tiếp từ request thread sẽ làm nghẽn thread pool của NestJS, tiêu tốn connection pool của database và tăng nguy cơ timeout phía Client. Xử lý bất đồng bộ giúp API phản hồi tức thì trạng thái `202 Accepted` và đưa task vào hàng đợi RabbitMQ để worker xử lý ngầm.

### 3. Tích hợp mô hình `gemini-3.5-flash` của Google Gemini

- **Lý do**: Đây là mô hình tối ưu về chi phí và tốc độ, có dung lượng context window lớn, cực kỳ phù hợp cho các tác vụ xử lý văn bản và tóm tắt nhanh như tiểu sử nghệ sĩ.

### 4. Cơ chế tạo lại bản nháp (Regenerate Workflow) từ `raw_text`

- **Lý do**: File PDF có dung lượng lớn (có thể lên tới 10MB). Nếu mỗi lần muốn tạo lại bản nháp (do kết quả AI chưa ưng ý) người dùng đều phải tải lại file PDF sẽ gây tốn băng thông mạng và trải nghiệm tồi tệ. Việc lưu trữ `raw_text` trong DB cho phép API đọc lại dữ liệu text thô có sẵn và phát hành một tác vụ RabbitMQ mới ngay lập tức.
- **Xử lý tại API `/regenerate`**:
  - Tìm bản ghi `ConcertAIBio` tương ứng. Nếu không tìm thấy hoặc `raw_text` rỗng, ném lỗi `400 Bad Request` yêu cầu tải lên file PDF trước.
  - Cập nhật `status = 'processing'`, `draft_bio = null`, `error = null`.
  - Gửi task `ai.generate_bio` với `{ concertId: id, userId: req.user.id, rawText: raw_text }` vào RabbitMQ và trả về `202 Accepted` ngay lập tức.

### 5. Cơ chế Duyệt & Xác nhận lưu (Confirm Workflow)

- **Lý do**: AI có thể tạo ra các từ ngữ hoặc định dạng chưa chuẩn xác. Luồng duyệt cung cấp một bước kiểm duyệt thủ công (Human-in-the-loop) để Ban tổ chức có cơ hội sửa đổi văn bản hoặc tạo lại bản nháp trước khi xuất bản ra trang chi tiết concert cho khán giả thấy.

### 6. Gửi Thông báo In-app sau khi sinh xong tiểu sử

- **Lý do**: Vì đây là luồng xử lý bất đồng bộ, người dùng có thể tắt tab trình duyệt hoặc làm việc khác. Tạo thông báo trong bảng `notification_logs` giúp gửi thông báo hệ thống In-app cho Admin, giúp họ nhận thấy kết quả của quá trình sinh khi quay lại hệ thống.
- **Thông tin bản ghi thông báo**:
  - `user_id`: ID của Admin gửi yêu cầu.
  - `type`: `'ai_bio_completed'` hoặc `'ai_bio_failed'`.
  - `title`: `"Tạo tiểu sử nghệ sĩ thành công"` hoặc `"Tạo tiểu sử nghệ sĩ thất bại"`.
  - `body`: `"Tiểu sử nghệ sĩ cho concert \"[Tên Concert]\" đã được tạo thành công dạng nháp."` hoặc `"Tạo tiểu sử nghệ sĩ cho concert \"[Tên Concert]\" thất bại: [Lỗi]"`.
  - `channel`: `"in_app"`.
  - `status`: `"unread"`.
  - `reference_id`: `concert_id`.

## Risks / Trade-offs

- **Lỗi Rate Limit (HTTP 429) hoặc Timeout từ Gemini API**:
  - _Mô tả_: API bên thứ ba có thể bị quá tải hoặc từ chối dịch vụ khi lượng yêu cầu quá cao.
  - _Giảm thiểu_: Áp dụng cơ chế Retry tối đa 3 lần với RabbitMQ. Cấu hình exponential backoff để giãn cách các lần gọi lại. Nếu vẫn lỗi sau 3 lần, cập nhật trạng thái `failed`, ghi nhận chi tiết lỗi vào `error` và gửi thông báo In-app thất bại cho Admin.
- **Dữ liệu văn bản rác hoặc file PDF quá lớn**:
  - _Mô tả_: File PDF chứa hình ảnh dạng quét không có text (scanned PDF) hoặc kích thước file quá lớn gây tốn bộ nhớ RAM.
  - _Giảm thiểu_: Cấu hình giới hạn file upload tối đa 10MB thông qua Multer. Trong prompt gửi cho Gemini, chỉ định rõ ràng yêu cầu xử lý dữ liệu và nếu không trích xuất được text hợp lệ từ PDF (ví dụ file rỗng sau trích xuất), cập nhật trạng thái `failed` kèm thông báo lỗi phù hợp.
