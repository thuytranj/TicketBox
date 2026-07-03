## Context

Hiện tại hệ thống chỉ mới có dữ liệu hạt giống (seed data) tối thiểu cho `User` và `Concert` / `TicketType`. Việc thiếu dữ liệu giao dịch thực tế (như `Order`, `Ticket`, `Payment`, `CheckinLog`, `VipGuest`) khiến nhà phát triển không thể kiểm thử đầy đủ các luồng nghiệp vụ trên cả frontend và backend, đặc biệt là các chức năng như:
- Biểu đồ doanh thu và thống kê (Statistics) trên Admin Dashboard.
- Danh sách đơn hàng, quản lý và đối soát vé.
- Giao diện và luồng xử lý quét mã QR soát vé (Check-in) trực tuyến/ngoại tuyến.
- Quản lý danh sách khách mời VIP.

## Goals / Non-Goals

**Goals:**
- Tạo bộ dữ liệu mẫu đầy đủ và chân thực trải dài trên tất cả các bảng: `users`, `concerts`, `ticket_types`, `orders`, `tickets`, `payments`, `checkin_logs`, `vip_guests`.
- Bổ sung ít nhất 2 concert trong quá khứ để hiển thị dữ liệu lịch sử doanh thu và soát vé.
- Tạo ra các đơn hàng với nhiều trạng thái nghiệp vụ khác nhau: Đã thanh toán (`paid`), Chờ thanh toán (`pending`), Hết hạn (`expired`), Đã hủy (`cancelled`).
- Liên kết các đơn hàng đã thanh toán với các vé (`Ticket`) ở trạng thái hoạt động (`active`) hoặc đã sử dụng (`used`).
- Tạo lịch sử soát vé (`CheckinLog`) và liên kết với tài khoản Gate Staff thực tế.
- Tích hợp toàn bộ quy trình seed vào kịch bản chạy một lệnh duy nhất.

**Non-Goals:**
- Tích hợp với cổng thanh toán thực tế (chỉ seed trạng thái giao dịch giả lập trong cơ sở dữ liệu).
- Gửi email/notification thật khi seed (tuy nhiên có thể seed lịch sử logs nếu cần, nhưng không gửi email qua SMTP thật).

## Decisions

### 1. Phân bổ các Seeder Files riêng biệt và Chạy theo Thứ tự Phụ thuộc
Chúng ta sẽ tạo và cập nhật các file seeder sau trong thư mục `src/backend/src/data/seeds/`:
- `user.seed.ts`: Cập nhật để bổ sung thêm các tài khoản gate staff và audience mẫu.
- `concert.seed.ts`: Cập nhật để bổ sung thêm 2 concert trong quá khứ (ví dụ: đã diễn ra 1 tháng trước) cùng các thông tin vé tương ứng.
- `vip-guest.seed.ts` (Mới): Tạo dữ liệu khách mời VIP mẫu cho một số concert.
- `transaction.seed.ts` (Mới): Tạo các đơn hàng, vé, giao dịch thanh toán và lịch sử soát vé.

**Trình tự chạy trong `scripts/run-seed.cjs`:**
1. `UserSeeder`
2. `ConcertSeeder`
3. `VipGuestSeeder`
4. `TransactionSeeder`

### 2. Thiết lập Trạng thái Đồng bộ giữa Đơn hàng, Vé và Thanh toán
Để dữ liệu hợp lệ và thực tế, các trạng thái sẽ được ánh xạ như sau:
- **Đơn hàng thành công**: `Order` (status: `paid`) $\rightarrow$ `Payment` (status: `success`, gateway: `momo`/`vnpay`) $\rightarrow$ `Ticket` (status: `active` hoặc `used`).
- **Đơn hàng chờ xử lý**: `Order` (status: `pending`) $\rightarrow$ `Payment` (status: `pending` hoặc không có) $\rightarrow$ `Ticket` (status: `reserved`).
- **Đơn hàng thất bại/hết hạn**: `Order` (status: `expired`/`cancelled`) $\rightarrow$ `Payment` (status: `failed` hoặc không có) $\rightarrow$ Không tạo vé hoạt động.

### 3. Tạo dữ liệu soát vé (Check-in Logs)
- Đối với các vé có trạng thái là `used` và `checkinStatus` là `checked_in`, chúng ta sẽ tạo các bản ghi `CheckinLog` tương ứng.
- Người thực hiện soát vé (`checked_by`) sẽ là ID của một trong các tài khoản `Gate Staff` đã được seed ở bước 1.
- Thời gian soát vé (`scanTime`) sẽ được thiết lập ngẫu nhiên trong khoảng thời gian diễn ra concert đó.

## Risks / Trade-offs

- **[Risk] Trùng lặp dữ liệu khi chạy seed nhiều lần** $\rightarrow$ *Mitigation*: Sử dụng cơ chế kiểm tra sự tồn tại (ví dụ: `findOne` theo email người dùng, tiêu đề concert, mã giao dịch hoặc ID) trước khi insert để đảm bảo có thể chạy lại seed (idempotent) mà không bị lỗi duplicate key.
- **[Risk] Số lượng bản ghi quá lớn làm chậm quá trình khởi chạy** $\rightarrow$ *Mitigation*: Khống chế số lượng đơn hàng và vé mẫu ở mức vừa đủ (khoảng vài chục đến 100 đơn hàng trên mỗi sự kiện trong quá khứ) để đảm bảo tốc độ chạy seed nhanh nhưng vẫn đủ dữ liệu vẽ biểu đồ thống kê đẹp mắt.
