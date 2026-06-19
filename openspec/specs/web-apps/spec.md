# web-apps Specification

## Purpose
Đặc tả các yêu cầu chức năng và kịch bản kiểm thử hành vi (Behavioral Scenarios) cho phân hệ Web App Khán giả (Audience).

## Requirements

### Requirement: Hiển thị danh sách concert có bộ lọc tags
Hệ thống SHALL hiển thị danh sách các concert đang hoạt động và cho phép người dùng tìm kiếm theo từ khóa hoặc lọc theo phong cách âm nhạc (tags).

#### Scenario: Tìm kiếm concert và lọc theo phong cách thành công
- **WHEN** Khán giả truy cập trang chủ và nhập từ khóa "Anh Trai" vào thanh tìm kiếm
- **THEN** Giao diện chỉ hiển thị các Concert Card có tiêu đề chứa từ "Anh Trai"
- **WHEN** Khán giả click vào thẻ tag "#rap" trên bộ lọc
- **THEN** Giao diện hiển thị các concert có chứa tag "rap" trong mảng tags của dữ liệu

---

### Requirement: Hiển thị sơ đồ SVG tương tác và tải tồn kho thời gian thực
Hệ thống SHALL hiển thị sơ đồ phân khu phẳng dạng SVG, cho phép click vào phân khu và hiển thị số lượng vé còn lại lấy từ cache Redis.

#### Scenario: Khán giả click vào phân khu trên sơ đồ SVG
- **WHEN** Khán giả click vào phân khu có ID "SVIP-01" trên sơ đồ SVG
- **THEN** Phân khu "SVIP-01" được highlight (thêm viền neon) ở sơ đồ bên trái
- **AND** Sidebar bên phải hiển thị tên hạng vé "SVIP", đơn giá "5.000.000 VNĐ" và số lượng vé còn lại là "120 vé" (đọc từ cache Redis)

---

### Requirement: Thanh toán đơn hàng chống trùng lặp bằng Idempotency Key
Hệ thống SHALL đính kèm mã định danh Idempotency-Key (UUID v4) trong header của request thanh toán để chống lỗi trừ tiền hai lần dưới tải cao.

#### Scenario: Gửi yêu cầu thanh toán kèm Idempotency-Key thành công
- **WHEN** Khán giả nhập thông tin người nhận vé và chọn cổng thanh toán MoMo rồi bấm nút "Thanh toán"
- **THEN** Hệ thống React Client tự động sinh chuỗi UUID v4 và đính kèm vào header `Idempotency-Key` của request
- **AND** Khóa (disable) nút "Thanh toán" ở giao diện để ngăn người dùng click lại lần 2
- **AND** Chuyển hướng người dùng sang trang thanh toán sandbox MoMo khi nhận được link trả về

---

### Requirement: Xử lý lỗi sập cổng thanh toán (Circuit Breaker & Graceful Degradation)
Hệ thống SHALL chủ động ẩn hoặc disable các cổng thanh toán bị lỗi và kích hoạt phương thức thanh toán dự phòng khi toàn bộ cổng trực tuyến gặp sự cố.

#### Scenario: Cổng thanh toán MoMo bị sập (Circuit Breaker Open)
- **WHEN** Backend trả về trạng thái Circuit Breaker của cổng MoMo là "OPEN" (đang bảo trì)
- **THEN** Web App làm mờ và disable nút chọn cổng "MoMo" trên giao diện
- **AND** Hiển thị cảnh báo: "Cổng thanh toán MoMo đang bảo trì, vui lòng chọn phương thức khác (VNPAY)"

#### Scenario: Toàn bộ cổng thanh toán MoMo và VNPAY đều bị sập
- **WHEN** Backend trả về trạng thái Circuit Breaker của cả hai cổng MoMo và VNPAY là "OPEN"
- **THEN** Web App ẩn khu vực thanh toán trực tuyến
- **AND** Kích hoạt nút thanh toán dự phòng "Pay Later (Thanh toán sau)"
- **AND** Đồng thời hiển thị thông tin tài khoản ngân hàng của BTC để người dùng chuyển khoản và gia hạn giữ vé tạm thời lên 2 tiếng
