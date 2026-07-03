## Context

Hệ thống TicketBox sử dụng TypeORM làm ORM kết nối tới cơ sở dữ liệu PostgreSQL. Hiện tại, một số bảng dữ liệu quan trọng như `tickets`, `vip_guests`, `checkin_logs`, `notification_logs` đang chạy mà không có index tối ưu cho các cột khóa ngoại hoặc các trường tìm kiếm chính. 

Khi lượng dữ liệu tăng lên trong môi trường sản xuất (production), điều này sẽ dẫn đến các vấn đề nghiêm trọng:
- Thao tác soát vé (check-in) tốn nhiều thời gian và tài nguyên CPU do thực hiện Full Table Scan.
- Việc đồng bộ check-in offline sẽ làm nghẽn PostgreSQL do liên tục quét toàn bộ bảng log quét vé.
- Danh sách Concerts tại trang chủ phải sắp xếp trong bộ nhớ (Filesort) thay vì sử dụng Index Scan.

## Goals / Non-Goals

**Goals:**
- Thêm đầy đủ B-Tree indexes cho các khóa ngoại và trường tìm kiếm chính trong các bảng `tickets`, `vip_guests`, `checkin_logs`, `notification_logs`, `concerts`.
- Đảm bảo thời gian phản hồi sub-second (< 100ms) đối với các API check-in và đồng bộ offline.
- Tự động hóa việc tạo và chạy migration thông qua TypeORM CLI.

**Non-Goals:**
- Thay đổi cấu trúc bảng hoặc kiểu dữ liệu của các cột hiện tại.
- Cấu hình phân vùng bảng (Table Partitioning) hay cấu hình cụm PostgreSQL.
- Thay đổi logic nghiệp vụ trong code backend.

## Decisions

### 1. Unique Index trên `vip_guests.qr_code_hash`
- **Lựa chọn**: Tạo một Unique B-Tree Index trên trường `qrCodeHash` của `VipGuest`.
- **Lý do**: Mỗi khách VIP có một mã QR code duy nhất. Khi soát vé VIP, hệ thống tìm kiếm bản ghi theo mã hash này. Việc đánh unique index giúp tìm kiếm đạt độ phức tạp $O(\log N)$ thay vì $O(N)$ (Full Table Scan).

### 2. Single B-Tree Index trên `checkin_logs.ticket_id` và `checkin_logs.vip_guest_id`
- **Lựa chọn**: Đánh index đơn lẻ trên hai cột `ticketId` và `vipGuestId` của entity `CheckinLog`.
- **Lý do**: Khi đồng bộ check-in offline, worker sẽ vô hiệu hóa các log cũ bằng cách chạy câu lệnh UPDATE lọc theo `ticketId` hoặc `vipGuestId`. Log check-in có thể lên đến hàng triệu bản ghi, vì vậy cần index hai trường này để tránh làm nghẽn database.

### 3. Single B-Tree Index trên `tickets.order_id` và `ticket_types.concert_id`
- **Lựa chọn**: Đánh index đơn lẻ trên các cột khóa ngoại.
- **Lý do**: Đây là các cột thường xuyên được JOIN hoặc lọc (ví dụ: lấy danh sách vé của một đơn hàng, lấy các loại vé của một concert).

### 4. Composite B-Tree Index trên `concerts.(status, start_time)`
- **Lựa chọn**: Tạo composite index theo thứ tự cột `status` trước, `startTime` sau.
- **Lý do**: Trang chủ hiển thị sự kiện mặc định truy vấn `where status = 'active' order by startTime ASC`. Thiết kế index composite này giúp PostgreSQL trả về kết quả theo đúng thứ tự sắp xếp trực tiếp từ index mà không cần thực hiện Filesort.

### 5. Composite B-Tree Index trên `notification_logs.(user_id, channel, created_at)`
- **Lựa chọn**: Tạo composite index `(userId, channel, createdAt)`.
- **Lý do**: Truy vấn danh sách thông báo in-app của user sắp xếp theo thời gian mới nhất (createdAt DESC). Composite index giúp tối ưu cả bộ lọc lẫn sắp xếp.

## Risks / Trade-offs

- **Tăng dung lượng đĩa (Storage Overhead)**: Mỗi index chiếm thêm dung lượng trên đĩa cứng.
  - *Giảm thiểu*: Các bảng trong hệ thống chỉ lưu thông tin text/uuid gọn nhẹ, dung lượng index tăng thêm không đáng kể so với dung lượng lưu trữ của máy chủ.
- **Tăng độ trễ ghi dữ liệu (Write Latency)**: Thao tác INSERT hoặc UPDATE trên các bảng này sẽ chậm hơn một chút vì PostgreSQL phải cập nhật các cây index tương ứng.
  - *Giảm thiểu*: Các cột được chọn đánh index đều có tần suất ghi thấp so với tần suất đọc (ví dụ: thông tin concert, ticket_type ít khi cập nhật, còn log check-in chỉ ghi một lần).
