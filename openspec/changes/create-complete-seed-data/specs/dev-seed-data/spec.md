## ADDED Requirements

### Requirement: Cung cấp đầy đủ dữ liệu mẫu (Seed Data) cho phát triển và kiểm thử
Hệ thống SHALL cung cấp một bộ dữ liệu mẫu toàn diện chứa đầy đủ thông tin người dùng, buổi biểu diễn, loại vé, đơn hàng, vé bán ra, giao dịch thanh toán, khách mời VIP và lịch sử soát vé để mô phỏng một môi trường vận hành thực tế.

#### Scenario: Thực thi lệnh seed cơ sở dữ liệu thành công
- **WHEN** Nhà phát triển thực hiện lệnh seed cơ sở dữ liệu (`npm run db:seed:direct` hoặc `npm run db:seed`)
- **THEN** Toàn bộ các bảng liên quan đến người dùng, buổi biểu diễn, loại vé, đơn hàng, vé, giao dịch thanh toán, khách mời VIP và lịch sử soát vé được điền dữ liệu mẫu hợp lệ mà không xảy ra bất kỳ lỗi ràng buộc dữ liệu nào.

### Requirement: Tạo dữ liệu buổi biểu diễn (Concerts) và loại vé (TicketTypes) đa dạng
Hệ thống SHALL tạo dữ liệu các buổi biểu diễn với nhiều trạng thái khác nhau (Active, Draft, Cancelled) và các mốc thời gian đa dạng (đã diễn ra trong quá khứ, đang mở bán, sắp diễn ra trong tương lai) để phục vụ cho giao diện hiển thị và tính toán số liệu thống kê.

#### Scenario: Phân bổ trạng thái và thời gian của buổi biểu diễn sau khi seed
- **WHEN** Xem danh sách buổi biểu diễn trong cơ sở dữ liệu sau khi chạy seed
- **THEN** Có ít nhất 3 buổi biểu diễn trong quá khứ (để xem thống kê), có các buổi biểu diễn đang hoạt động và đang mở bán vé, cùng các buổi biểu diễn ở trạng thái Nháp (Draft) hoặc đã Hủy (Cancelled).

### Requirement: Tạo đơn hàng (Orders), vé (Tickets) và thông tin thanh toán (Payments) nhất quán
Hệ thống SHALL tạo dữ liệu các đơn hàng, vé và giao dịch thanh toán đồng bộ về trạng thái và giá trị để mô phỏng đúng các giao dịch tài chính thực tế.

#### Scenario: Đồng bộ trạng thái giao dịch
- **WHEN** Đơn hàng có trạng thái là Đã thanh toán (`paid`)
- **THEN** Giao dịch thanh toán tương ứng phải có trạng thái Thành công (`success`) và các vé thuộc đơn hàng đó phải ở trạng thái Hoạt động (`active`) hoặc Đã sử dụng (`used`).

#### Scenario: Đồng bộ trạng thái đơn hàng hết hạn hoặc đã hủy
- **WHEN** Đơn hàng có trạng thái là Hết hạn (`expired`) hoặc Đã hủy (`cancelled`)
- **THEN** Không có vé hoạt động nào được tạo ra cho đơn hàng đó và giao dịch thanh toán (nếu có) phải ở trạng thái Thất bại (`failed`) hoặc Chờ thanh toán (`pending`).

### Requirement: Tạo dữ liệu khách mời VIP và lịch sử soát vé (CheckinLogs)
Hệ thống SHALL tạo dữ liệu khách mời VIP cho các buổi biểu diễn và lịch sử soát vé tương ứng được thực hiện bởi tài khoản Nhân viên soát vé (Gate Staff).

#### Scenario: Xác thực lịch sử soát vé mẫu
- **WHEN** Kiểm tra bảng lịch sử soát vé sau khi chạy seed
- **THEN** Các lượt soát vé (CheckinLog) tham chiếu chính xác đến vé thường hoặc khách mời VIP, thời gian quét vé nằm trong khoảng thời gian diễn ra sự kiện, và trường người thực hiện (checked_by) trỏ tới ID của người dùng có vai trò Nhân viên soát vé (Gate Staff).
