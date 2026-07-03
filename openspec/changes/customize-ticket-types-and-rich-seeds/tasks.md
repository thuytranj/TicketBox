## 1. Sửa đổi Cấu trúc Backend (Backend Modification)

- [x] 1.1 Cập nhật entity `TicketType` ở `ticket-type.entity.ts`: Đổi kiểu dữ liệu của `name` thành `string` và thêm decorator `@Unique(['concertId', 'name'])`
- [x] 1.2 Cập nhật `create-ticket-type.dto.ts` để kiểm định trường `name` bằng `@IsString()` thay vì `@IsEnum()`
- [x] 1.3 Cập nhật `update-ticket-type.dto.ts` để kiểm định trường `name` bằng `@IsString()` thay vì `@IsEnum()`

## 2. Tạo & Thực thi Migration (Database Migration)

- [x] 2.1 Chạy lệnh tạo migration tự động để TypeORM phát hiện thay đổi cấu trúc bảng `ticket_types`
- [x] 2.2 Thực thi migration (`npm run migration:run`) để áp dụng các ràng buộc mới vào database local

## 3. Nâng cấp Seed Dữ liệu Mẫu (Rich Seed Data)

- [x] 3.1 Cập nhật `concert.seed.ts` để đa dạng hóa tên loại vé (Early Bird, Standard...) và viết lại biography chi tiết dạng nhiều dòng (Plain Text), đồng thời làm tròn các mốc thời gian diễn ra concert và mở bán/đóng bán vé về các mốc giờ chẵn/nửa giờ (ví dụ xx:00 hoặc xx:30)
- [x] 3.2 Cập nhật `transaction.seed.ts` để tạo ra lượng lớn các giao dịch mẫu (Orders, Tickets, Payments) phân bổ đa dạng trạng thái để tối ưu Dashboard
- [x] 3.3 Chạy thử nghiệm seed trực tiếp (`npm run db:seed:direct`) để xác nhận nạp dữ liệu thành công

## 4. Tối ưu hiển thị Frontend (Frontend Style Update)

- [x] 4.1 Tìm và cập nhật CSS tại component chi tiết Concert ở Frontend để sử dụng thuộc tính `white-space: pre-wrap;` cho biography
- [x] 4.2 Cập nhật `AdminConcerts.tsx` ở Frontend để sửa lỗi lệch múi giờ 7h khi gán thời gian bắt đầu/kết thúc vào ô nhập liệu `datetime-local` (sử dụng hàm helper `toLocalISOString`)

## 5. Xác minh hệ thống (System Verification)

- [x] 5.1 Thực hiện build backend để đảm bảo không có lỗi biên dịch dự án
- [x] 5.2 Chạy bộ unit test liên quan để đảm bảo các tiến trình hoạt động ổn định
