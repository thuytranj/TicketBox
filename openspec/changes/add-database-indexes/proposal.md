## Why

Hiện tại, hệ thống TicketBox đang gặp một số vấn đề về hiệu năng tiềm ẩn trong cơ sở dữ liệu khi số lượng bản ghi tăng lên:
1. Soát vé khách VIP (`VipGuest`) và đồng bộ offline check-in log (`CheckinLog`) đang thực hiện quét toàn bộ bảng (Full Table Scan) do thiếu index trên các trường dùng để tìm kiếm (`qrCodeHash`, `ticketId`, `vipGuestId`).
2. Các câu lệnh JOIN thường xuyên giữa đơn hàng (`Order`) và vé (`Ticket`) cũng như tìm kiếm loại vé theo sự kiện (`TicketType`) đang thiếu index khóa ngoại.
3. API lấy danh sách Concerts sắp diễn ra bắt buộc phải Filesort trong bộ nhớ do thiếu composite index trên `(status, startTime)`.

Việc bổ sung các index này giúp tối ưu hóa hiệu năng truy vấn, ngăn ngừa quá tải cơ sở dữ liệu khi số lượng người dùng và giao dịch tăng cao, đồng thời đảm bảo thời gian phản hồi sub-second cho thao tác soát vé tại sự kiện.

## What Changes

- Bổ sung các decorator `@Index` và `@Index({ unique: true })` tương ứng trong các file Entity của TypeORM:
  - Bảng `vip_guests`: Thêm unique index trên cột `qr_code_hash`.
  - Bảng `checkin_logs`: Thêm index trên các cột `ticket_id` và `vip_guest_id`.
  - Bảng `tickets`: Thêm index trên các cột `order_id` và `ticket_type_id`.
  - Bảng `ticket_types`: Thêm index trên cột `concert_id`.
  - Bảng `concerts`: Thêm composite index trên `(status, start_time)`.
  - Bảng `notification_logs`: Thêm composite index trên `(user_id, channel, created_at)`.
- Tạo một file migration mới bằng TypeORM CLI để áp dụng các thay đổi cấu trúc bảng này vào database PostgreSQL.

## Capabilities

### New Capabilities
<!-- None, as indexing is a technical optimization and does not introduce new functional capabilities -->

### Modified Capabilities
- `checkin`: Tối ưu hóa hiệu năng truy vấn database của quy trình soát vé trực tuyến và đồng bộ hóa ngoại tuyến bằng cách bổ sung các chỉ mục (indexes).

## Impact

- **Database Schema**: Tạo thêm 7 indexes mới trên cơ sở dữ liệu PostgreSQL.
- **TypeORM Entities**: Cập nhật các file entity lớp TypeScript của backend.
- **Migrations**: Tạo thêm 1 file migration mới trong thư mục `src/data/migrations/`.
- **Hiệu năng**: Giảm đáng kể CPU usage của PostgreSQL, loại bỏ các phép Filesort và Full Table Scan trên các bảng chính.
