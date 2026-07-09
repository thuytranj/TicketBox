## MODIFIED Requirements

### Requirement: Tổng hợp số liệu thống kê thời gian thực
Hệ thống SHALL cho phép ban tổ chức xem báo cáo tổng hợp doanh thu và số lượng vé bán ra của concert thông qua các truy vấn tối ưu, bao gồm các concert ở trạng thái `completed`.

#### Scenario: Truy vấn thống kê doanh thu thành công
- **WHEN** Ban tổ chức có vai trò hợp lệ gọi API truy vấn thống kê của một concert
- **THEN** Hệ thống thực hiện tính toán và trả về chính xác tổng doanh thu, số lượng vé đã bán và tỷ lệ phần trăm lấp đầy
