## Context

Hiện tại, hệ thống TicketBox đang gặp phải một số hạn chế:
1. Trường `name` của `TicketType` được gán kiểu enum `TicketTypeName` giới hạn cứng 5 hạng vé (GA, SVIP, VIP, CAT1, CAT2). Check constraint trong Postgres ngăn chặn bất cứ tên hạng vé nào nằm ngoài tập này.
2. Chưa có cơ chế bảo vệ tính duy nhất của tên loại vé trong mỗi concert ở tầng cơ sở dữ liệu.
3. Phần tiểu sử (biography) của các concert hiển thị trên giao diện không có định dạng xuống dòng, làm giảm độ hấp dẫn của thông tin sự kiện.
4. Số lượng bản ghi seed dữ liệu giao dịch rất ít, gây khó khăn cho việc kiểm thử các dashboard biểu đồ thống kê.

## Goals / Non-Goals

**Goals:**
- Loại bỏ enum `TicketTypeName`, cho phép đặt tên loại vé tùy chỉnh bất kỳ.
- Ràng buộc tính duy nhất của tên hạng vé trong phạm vi từng concert (`uq_concert_ticket_type_name`).
- Cấu trúc lại seeder để nạp thông tin biography chi tiết dạng nhiều dòng (Plain Text) và nâng cao số lượng giao dịch mẫu (đơn hàng, vé, check-in, thanh toán).
- Cập nhật frontend để render biography bảo toàn ký tự xuống dòng bằng CSS `white-space: pre-wrap`.

**Non-Goals:**
- Tích hợp thêm các thư viện parser bên thứ ba (như Markdown) ở Frontend.
- Thay đổi cấu trúc cơ bản của luồng thanh toán hoặc soát vé check-in.

## Decisions

### 1. Sửa đổi Entity `TicketType` và DTOs liên quan
- Trong [ticket-type.entity.ts](file:///Users/thuytran/Workspace/TicketBox/src/backend/src/concert/entities/ticket-type.entity.ts):
  - Chuyển `name: TicketTypeName` thành `name: string`.
  - Thêm decorator `@Unique(['concertId', 'name'])` ở cấp độ Class `TicketType`.
- Trong [create-ticket-type.dto.ts](file:///Users/thuytran/Workspace/TicketBox/src/backend/src/concert/dto/create-ticket-type.dto.ts) và `update-ticket-type.dto.ts`:
  - Thay thế kiểm tra `@IsEnum(TicketTypeName)` thành `@IsString()` và `@IsNotEmpty()`.

### 2. Migration Loại Bỏ Check Constraint cũ
- Tạo file migration mới:
  - Chạy `ALTER TABLE "ticket_types" DROP CONSTRAINT "chk_ticket_types_name"` để xóa bỏ ràng buộc giới hạn 5 tên cũ.
  - Chạy `ALTER TABLE "ticket_types" ADD CONSTRAINT "uq_concert_ticket_type_name" UNIQUE ("concert_id", "name")` để đảm bảo tính duy nhất.

### 3. Cập Nhật Seeders Cho Phép Thống Kê Rõ Ràng
- Trong [concert.seed.ts](file:///Users/thuytran/Workspace/TicketBox/src/backend/src/data/seeds/concert.seed.ts):
  - Thay thế các tên hạng vé cũ bằng các tên linh hoạt: `Standard Zone A`, `Fanzone`, `Early Bird VIP`, `Balcony Seat`, v.v.
  - Viết lại trường `biography` của các concert mẫu thành văn bản dài, xuống dòng rõ ràng, chứa đầy đủ thông tin: Lịch trình (Timeline), Nghệ sĩ biểu diễn, Nội quy concert.
  - Làm tròn tất cả các mốc thời gian (bắt đầu/kết thúc concert, mở bán/kết thúc bán vé) thành các khung giờ đẹp như `xx:00` hoặc `xx:30` thông qua một hàm helper làm tròn ngày (ví dụ đặt cố định giờ và phút bằng `.setHours(hour, minute, 0, 0)`).
- Trong [transaction.seed.ts](file:///Users/thuytran/Workspace/TicketBox/src/backend/src/data/seeds/transaction.seed.ts):
  - Tăng số lượng giao dịch mẫu được tạo ra cho các sự kiện trong quá khứ và tương lai (ví dụ: tạo 50+ đơn hàng, 100+ vé, phân bổ đều tỉ lệ check-in hợp lệ và các lỗi check-in trùng lặp). Điều này đảm bảo khi chạy lên Dashboard Admin, các đồ thị thống kê doanh thu và check-in hoạt động sinh động và chính xác.

### 4. Cấu Hình CSS Hiển Thị Biography và Sửa Lỗi Múi Giờ Ở Frontend
- Tìm component hiển thị chi tiết Concert ở Frontend (ví dụ: `ConcertDetail` page).
- Thêm thuộc tính CSS `white-space: pre-wrap;` vào phần hiển thị `biography` để trình duyệt tự động ngắt dòng và giữ nguyên định dạng khoảng trắng giống như khi hiển thị Plain Text trong database.
- Trong `AdminConcerts.tsx`: Thiết lập hàm helper `toLocalISOString` để loại bỏ độ lệch múi giờ 7h khi hiển thị thời gian trong input `datetime-local` bằng cách trừ đi `getTimezoneOffset()`.

## Risks / Trade-offs

- **Xung đột trùng tên vé cũ**: Nếu database hiện tại đang có dữ liệu trùng lặp tên loại vé trong cùng một concert, việc tạo unique constraint sẽ báo lỗi.
  - *Giảm thiểu*: Do đây là môi trường local dev, lập trình viên có thể dọn sạch database bằng cách chạy `npm run schema:drop` rồi chạy lại `migration:run` để áp dụng cấu trúc sạch hoàn toàn trước khi chạy seed mới.
