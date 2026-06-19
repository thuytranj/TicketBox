## Why

Việc nhập thông tin tiểu sử nghệ sĩ một cách thủ công thường tốn thời gian và thiếu tính nhất quán. Tính năng AI Artist Bio tự động hóa quy trình này bằng cách cho phép Ban tổ chức tải lên tệp PDF thông tin nghệ sĩ, tự động trích xuất nội dung và sử dụng mô hình Google Gemini để tạo ra một bản tóm tắt tiểu sử ngắn gọn (dưới 300 từ), chuyên nghiệp và hấp dẫn cho trang chi tiết concert. Để đảm bảo chất lượng nội dung hiển thị, hệ thống cung cấp quy trình duyệt (Draft & Approve) cho phép Ban tổ chức xem trước bản nháp do AI sinh ra, chỉnh sửa hoặc yêu cầu tạo lại trước khi chính thức phê duyệt lưu vào trang concert công khai. Đồng thời, hệ thống ghi nhận thông báo để báo cáo kết quả sinh tiểu sử cho người dùng ngay cả khi họ đã rời khỏi trang.

## What Changes

- **Bổ sung thực thể mới `ConcertAIBio` (Bảng `concert_ai_bios`)**: Tách biệt dữ liệu nháp của AI ra khỏi bảng chính `concerts` để tránh bẩn dữ liệu và lưu trữ text thô để tái sử dụng.
- **Bổ sung các API endpoint**:
  - `POST /concerts/:id/artist-bio`: Ban tổ chức tải lên tệp PDF để trích xuất văn bản và khởi chạy quá trình sinh tiểu sử nghệ sĩ bằng AI một cách bất đồng bộ.
  - `POST /concerts/:id/artist-bio/regenerate`: Yêu cầu tạo lại bản nháp tiểu sử bằng AI từ dữ liệu văn bản thô (`raw_text`) đã trích xuất trước đó, không cần tải lại file PDF.
  - `GET /concerts/:id/artist-bio`: Kiểm tra trạng thái xử lý (`status`, `error`) và lấy nội dung bản nháp tiểu sử (`draft_bio`) từ AI.
  - `PUT /concerts/:id/artist-bio/confirm`: Phê duyệt bản nháp (hoặc nội dung đã chỉnh sửa từ Admin) để lưu chính thức vào trường `biography` của concert.
- **Trích xuất văn bản từ PDF**: Tích hợp thư viện `pdf-parse` để đọc và trích xuất nội dung text từ file PDF gửi lên.
- **Xử lý bất đồng bộ qua RabbitMQ**: Gửi task `ai.generate_bio` kèm theo `concert_id`, `userId` người gửi và text đã trích xuất vào hàng đợi để Worker xử lý ngầm.
- **Worker sinh bio bằng Gemini AI**: Worker tiêu thụ task, sử dụng thư viện `@google/generative-ai` và model `gemini-3.5-flash` để tóm tắt tiểu sử dưới 300 từ.
- **Ghi nhận thông báo hệ thống**: Worker tự động tạo bản ghi trong bảng `notification_logs` để gửi thông báo In-app cho tài khoản Admin đã thực hiện yêu cầu khi quá trình sinh kết thúc (thành công hoặc thất bại).

## Capabilities

### New Capabilities

_(Không có capability mới)_

### Modified Capabilities

- `ai-bio`: Định nghĩa chi tiết hành vi của API tải lên PDF, quá trình xử lý trích xuất văn bản, đưa vào hàng đợi RabbitMQ, gọi mô hình Gemini AI để sinh tiểu sử nháp, tạo lại bản nháp từ văn bản thô có sẵn, các endpoint kiểm tra trạng thái, xác nhận lưu chính thức và sinh thông báo kết quả.

## Impact

- **Database**:
  - Tạo bảng mới `concert_ai_bios` lưu thông tin xử lý AI (`concert_id`, `raw_text`, `draft_bio`, `status`, `error`, `updated_at`).
  - Thêm cột `biography` (`text`, `nullable: true`) vào bảng `concerts` để lưu thông tin đã duyệt.
  - Thêm bản ghi thông báo mới trong bảng `notification_logs`.
- **RabbitMQ**: Đăng ký queue mới `ai.generate_bio`.
- **Dependencies**: Bổ sung `@google/generative-ai` và `pdf-parse` vào `package.json` của backend.
- **API**: Thêm các endpoint `POST /concerts/:id/artist-bio`, `POST /concerts/:id/artist-bio/regenerate`, `GET /concerts/:id/artist-bio` và `PUT /concerts/:id/artist-bio/confirm`.
