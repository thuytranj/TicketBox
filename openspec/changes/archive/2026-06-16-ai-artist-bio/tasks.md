## 1. Cấu hình và Cập nhật Schema Database

- [x] 1.1 Cài đặt các thư viện mới `@google/generative-ai` và `pdf-parse` (cùng `@types/pdf-parse` nếu có) vào backend.
- [x] 1.2 Tạo thực thể mới `ConcertAIBio` trong `src/backend/src/concert/entities/concert-ai-bio.entity.ts` với các trường `concertId`, `rawText`, `draftBio`, `status`, `error`, và `updatedAt`.
- [x] 1.3 Cập nhật thực thể `Concert` trong `src/backend/src/concert/entities/concert.entity.ts` để bổ sung trường `biography` (`text`, `nullable: true`).
- [x] 1.4 Tạo migration TypeORM mới để tạo bảng `concert_ai_bios` và thêm cột `biography` vào bảng `concerts`.
- [x] 1.5 Chạy migration để cập nhật schema cơ sở dữ liệu PostgreSQL.

## 2. Xây dựng Module AI và Tích hợp Gemini API

- [x] 2.1 Tạo `AIService` trong `src/backend/src/ai/ai.service.ts` để cấu hình và gọi API Google Gemini (`gemini-3.5-flash`) sinh tóm tắt tiểu sử nghệ sĩ dưới 300 từ từ đoạn text trích xuất.
- [x] 2.2 Tạo `AIConsumer` trong `src/backend/src/ai/ai.consumer.ts` để tiêu thụ task từ queue `ai.generate_bio` của RabbitMQ.
- [x] 2.3 Cấu hình xử lý task trong consumer: gọi `AIService`, thực hiện retry tối đa 3 lần nếu gặp lỗi tạm thời (Timeout/Rate limit), cập nhật trạng thái `completed`/`failed` (kèm thông tin lỗi `error`) vào bảng `concert_ai_bios`, đồng thời lưu bản ghi thông báo kết quả vào bảng `notification_logs` cho Admin.
- [x] 2.4 Đăng ký `AIModule` trong `src/backend/src/app.module.ts` và đăng ký kết nối queue RabbitMQ cần thiết.

## 3. Cập nhật Concert Controller và Service

- [x] 3.1 Cập nhật `ConcertService` để trích xuất text thô từ buffer file PDF qua `pdf-parse`, khởi tạo dữ liệu bản ghi `ConcertAIBio` với trạng thái `processing`, và gửi task `ai.generate_bio` kèm theo `userId` người gửi sang RabbitMQ.
- [x] 3.2 Thêm endpoint `POST /concerts/:id/artist-bio` trong `ConcertController` sử dụng `FileInterceptor('file')` để chấp nhận tải lên tệp PDF của Ban tổ chức.
- [x] 3.3 Thêm endpoint `POST /concerts/:id/artist-bio/regenerate` trong `ConcertController` để yêu cầu tạo lại bản nháp tiểu sử từ văn bản thô đã trích xuất trước đó (gửi kèm `userId` người gửi sang RabbitMQ).
- [x] 3.4 Thêm endpoint `GET /concerts/:id/artist-bio` trong `ConcertController` để lấy trạng thái và bản nháp tiểu sử.
- [x] 3.5 Thêm endpoint `PUT /concerts/:id/artist-bio/confirm` trong `ConcertController` để duyệt/chỉnh sửa bản nháp, lưu chính thức vào cột `biography` của bảng `concerts`, đồng thời thực hiện xóa các cache Redis của concert đó (khóa `cache:concerts:{id}`, `cache:concerts:list:default:*`).

## 4. Kiểm thử và Xác minh

- [x] 4.1 Tạo các kịch bản kiểm thử (unit/integration test) hoặc kiểm tra thủ công bằng Postman/cURL để xác nhận luồng tải lên PDF thành công, tạo lại nháp thành công, lấy trạng thái, duyệt thành công, gửi thông báo In-app chuẩn xác và các kịch bản lỗi liên quan.
- [x] 4.2 Kiểm thử khả năng chịu lỗi khi Gemini API giả lập bị lỗi (đảm bảo retry tối đa 3 lần và cập nhật trạng thái thất bại cùng thông báo lỗi In-app chính xác).
