## Why

Hiện tại, hệ thống mới chỉ có dữ liệu seed tối thiểu (một vài tài khoản người dùng và thông tin concert), chưa có dữ liệu giao dịch thực tế như booking (đơn hàng), ticket (vé), payment (thanh toán), check-in log (lịch sử soát vé) hay VIP guest. Điều này gây khó khăn cho việc kiểm thử các tính năng giao diện admin (như biểu đồ doanh thu, thống kê, quản lý vé, quản lý check-in), kiểm thử quy trình nghiệp vụ nâng cao (đối soát, quét vé offline/online) và chạy demo hệ thống.

## What Changes

- Bổ sung dữ liệu seed đầy đủ và thực tế hơn cho cơ sở dữ liệu để có thể chạy thử đầy đủ các luồng nghiệp vụ.
- Tạo thêm các vai trò người dùng (Admin, thêm nhân viên Gate Staff, nhiều tài khoản khán giả Audience).
- Tạo các Concerts ở nhiều trạng thái khác nhau (Active, Draft, Cancelled, đặc biệt là các Concert trong quá khứ để phục vụ việc xem dữ liệu thống kê lịch sử).
- Tạo dữ liệu Booking (Order) & Ticket tương ứng với các trạng thái khác nhau (Pending, Paid, Cancelled, Expired, Used/Checked-in).
- Tạo dữ liệu Payment tương ứng (Success, Pending, Failed) cho các cổng thanh toán Momo và VNPay.
- Tạo dữ liệu VIP Guest và các lượt CheckinLog tương ứng (soát vé hợp lệ bởi các nhân viên Gate Staff).
- Tích hợp tất cả các seeders mới vào lệnh chạy seed chung để nhà phát triển có thể thiết lập nhanh toàn bộ dữ liệu chỉ bằng một câu lệnh `npm run db:seed:direct` hoặc `npm run db:seed`.

## Capabilities

### New Capabilities
- `dev-seed-data`: Cung cấp bộ dữ liệu mẫu (seed data) hoàn chỉnh bao gồm người dùng, sự kiện, đơn hàng, vé, giao dịch thanh toán và lịch sử soát vé để hỗ trợ hoạt động phát triển, kiểm thử giao diện và phân tích số liệu.

### Modified Capabilities
<!-- No modified capabilities since requirements of existing capabilities remain the same, we are just adding developer/testing seeding tools -->

## Impact

- **Cơ sở dữ liệu**: Bảng `users`, `concerts`, `ticket_types`, `orders`, `tickets`, `payments`, `checkin_logs`, `vip_guests` sẽ được bổ sung lượng lớn dữ liệu mẫu khi chạy script.
- **Scripts**: Cập nhật file `scripts/run-seed.cjs` của backend để điều phối và thực thi các seeder mới theo đúng trình tự phụ thuộc của cơ sở dữ liệu.
