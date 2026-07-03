# web-apps Specification

## Purpose
Đặc tả các yêu cầu chức năng và kịch bản kiểm thử hành vi cho phân hệ Web App Khán giả, bám theo frontend React hiện tại và backend NestJS đã expose.

## Requirements

### Requirement: Hiển thị danh sách concert có bộ lọc tags
Hệ thống SHALL hiển thị danh sách các concert đang hoạt động và cho phép người dùng tìm kiếm theo từ khóa hoặc lọc theo phong cách âm nhạc/tags.

#### Scenario: Tìm kiếm concert và lọc theo phong cách thành công
- **WHEN** Khán giả truy cập trang chủ và nhập từ khóa "Anh Trai" vào thanh tìm kiếm
- **THEN** Frontend gọi `GET /concerts?status=active&page=&limit=&search=&tag=`
- **AND** Giao diện chỉ hiển thị các Concert Card phù hợp với dữ liệu backend trả về
- **WHEN** Khán giả click vào một tag trên bộ lọc
- **THEN** Giao diện hiển thị các concert có tag tương ứng

---

### Requirement: Hiển thị sơ đồ SVG tương tác và tải tồn kho gần realtime
Hệ thống SHALL hiển thị sơ đồ phân khu dạng SVG, cho phép click vào phân khu và hiển thị số lượng vé còn lại từ ticket types do backend trả về.

#### Scenario: Khán giả click vào phân khu trên sơ đồ SVG
- **WHEN** Khán giả click vào phân khu có ID như "SVIP-01" trên sơ đồ SVG
- **THEN** Frontend map zone ID về hạng vé tương ứng như "SVIP"
- **AND** Phân khu được highlight trên sơ đồ
- **AND** Sidebar hiển thị tên hạng vé, đơn giá, số lượng còn lại và giới hạn mua tối đa từ `GET /concerts/:id/ticket-types`
- **AND** Nếu SVG không map được zone, người dùng vẫn có thể chọn hạng vé bằng danh sách ticket types

---

### Requirement: Thanh toán đơn hàng chống trùng lặp bằng Idempotency Key
Hệ thống SHALL đính kèm mã định danh `idempotency-key` trong header của request đặt vé/thanh toán để chống lỗi tạo giao dịch trùng lặp dưới tải cao hoặc retry mạng.

#### Scenario: Gửi yêu cầu thanh toán kèm Idempotency-Key thành công
- **WHEN** Khán giả chọn vé và bấm đặt vé
- **THEN** React Client sinh UUID bằng `crypto.randomUUID()` và gửi `POST /bookings` với header `idempotency-key`
- **AND** Sau khi booking chuyển sang `pending`, người dùng được đưa tới checkout
- **WHEN** Khán giả chọn MoMo hoặc VNPAY và bấm thanh toán
- **THEN** React Client sinh một `idempotency-key` mới cho request `POST /payments/momo` hoặc `POST /payments/vnpay`
- **AND** Khóa nút thanh toán trong lúc gửi request để ngăn click lặp
- **AND** Chuyển hướng người dùng sang `payUrl` sandbox khi backend trả về link thanh toán

---

### Requirement: Xử lý lỗi cổng thanh toán bằng Circuit Breaker
Hệ thống SHALL chủ động ẩn hoặc disable các cổng thanh toán bị lỗi theo trạng thái Circuit Breaker do backend trả về.

#### Scenario: Cổng thanh toán MoMo bị sập
- **WHEN** Backend trả về trạng thái Circuit Breaker của cổng MoMo là `OPEN`
- **THEN** Web App disable lựa chọn "MoMo" trên giao diện
- **AND** Hiển thị cảnh báo rằng cổng MoMo đang bảo trì hoặc tạm thời không khả dụng
- **AND** Người dùng vẫn có thể chọn VNPAY nếu cổng VNPAY chưa `OPEN`

#### Scenario: Toàn bộ cổng thanh toán MoMo và VNPAY đều bị sập
- **WHEN** Backend trả về trạng thái Circuit Breaker của cả MoMo và VNPAY là `OPEN`
- **THEN** Web App disable toàn bộ nút thanh toán online
- **AND** Hiển thị thông báo rằng hiện chưa có cổng thanh toán khả dụng
- **AND** Frontend SHALL NOT hiển thị hoặc gọi luồng "Pay Later" cho tới khi backend cung cấp endpoint thật cho chức năng này

---

### Requirement: Theo dõi trạng thái thanh toán và hiển thị vé/QR
Hệ thống SHALL theo dõi trạng thái booking và payment sau khi người dùng quay lại từ cổng thanh toán.

#### Scenario: Payment callback thành công
- **WHEN** Khán giả quay lại route `/payment-callback/:orderId`
- **THEN** Frontend poll `GET /bookings/:orderId` để lấy trạng thái đơn hàng và danh sách vé
- **AND** Frontend gọi `GET /payments/:orderId` để lấy trạng thái giao dịch thanh toán khi backend có dữ liệu payment
- **AND** Nếu order chuyển `paid`, hệ thống hiển thị vé và QR từ dữ liệu `tickets`
- **AND** Nếu order `expired` hoặc `cancelled`, hệ thống hiển thị trạng thái thất bại/hết hạn
