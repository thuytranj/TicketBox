## Why

Hiện tại, hệ thống TicketBox đang gặp một số giới hạn và thiếu sót về mặt dữ liệu cũng như cấu hình:
1. **Giới hạn loại vé**: Tên loại vé của các sự kiện bị giới hạn cứng nhắc trong 5 giá trị (GA, SVIP, VIP, CAT1, CAT2) thông qua Check Constraint ở DB và `@IsEnum` ở DTO. Điều này làm giảm tính linh hoạt khi tổ chức các concert có cấu trúc vé đặc thù (như Early Bird, VVIP, Standard Zone A/B, Student Pass).
2. **Thiếu ràng buộc trùng tên vé**: Hệ thống chưa có cơ chế đảm bảo tên loại vé phải là duy nhất trong cùng một concert (ví dụ: một concert không được phép có hai loại vé cùng tên "GA" nhưng giá khác nhau).
3. **Dữ liệu seed còn đơn giản**: Tiểu sử (biography) của các concert rất ngắn gọn, không định dạng xuống dòng, và số lượng giao dịch seed (orders, payments, check-ins) quá ít, làm các biểu đồ thống kê dashboard trông đơn điệu và khó phân tích.

Việc điều chỉnh này giúp tăng tính linh hoạt của hệ thống quản lý sự kiện, đồng thời nạp một bộ dữ liệu mẫu chi tiết, đa dạng để phục vụ kiểm thử và xem báo cáo thống kê trực quan hơn.

## What Changes

- **Backend**:
  - Loại bỏ ràng buộc enum `TicketTypeName` trên trường `name` của entity `TicketType`, chuyển thành kiểu chuỗi tự do (`string`).
  - Thêm ràng buộc duy nhất (Unique composite index) trên cặp cột `(concertId, name)` của bảng `ticket_types`.
  - Cập nhật các DTO `CreateTicketTypeDto` và `UpdateTicketTypeDto` để chấp nhận kiểu chuỗi tùy chỉnh thay vì enum.
  - Cấu trúc lại seeder dữ liệu mẫu:
    - [concert.seed.ts](file:///Users/thuytran/Workspace/TicketBox/src/backend/src/data/seeds/concert.seed.ts): Định nghĩa các loại vé đa dạng (Early Bird, Standard, Balcony...), viết lại tiểu sử dài và có xuống dòng rõ ràng cho các concert.
    - [transaction.seed.ts](file:///Users/thuytran/Workspace/TicketBox/src/backend/src/data/seeds/transaction.seed.ts): Sinh số lượng lớn giao dịch mẫu đa dạng trạng thái (Paid, Expired, Checked-in) để hiển thị biểu đồ dashboard chi tiết.
- **Frontend**:
  - Cập nhật CSS hiển thị phần tiểu sử (biography) tại trang chi tiết Concert để sử dụng thuộc tính `white-space: pre-wrap;`, giúp xuống dòng và giữ nguyên định dạng khoảng trắng của Plain Text từ DB.

## Capabilities

### New Capabilities
<!-- None, this optimization improves flexibility and seed quality of existing features -->

### Modified Capabilities
- `concert`: Cho phép tùy chỉnh tên hạng vé linh hoạt (đảm bảo duy nhất trong concert đó) và lưu/hiển thị nội dung tiểu sử nhiều dòng rõ ràng.

## Impact

- **Database**: Drop check constraint `chk_ticket_types_name`, thêm unique constraint `uq_concert_ticket_type_name` trên bảng `ticket_types`.
- **Entities & DTOs**: Sửa `TicketType` entity, DTOs liên quan đến tạo/cập nhật ticket type.
- **Seeders**: Sửa đổi dữ liệu trong `concert.seed.ts` và `transaction.seed.ts`.
- **Frontend**: Cập nhật CSS tại trang chi tiết Concert để hỗ trợ hiển thị `pre-wrap` cho biography.
