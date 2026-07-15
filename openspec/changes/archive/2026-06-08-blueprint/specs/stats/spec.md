# Đặc tả: Thống kê & Báo cáo (Stats & Reports)

## Mô tả
API cung cấp thông tin thống kê về doanh thu, số vé đã bán và tỷ lệ lấp đầy phục vụ giao diện quản trị của ban tổ chức.

## Luồng chính
<!-- Các bước xử lý theo thứ tự, các thành phần tham gia -->

## Kịch bản lỗi
<!-- Điều gì xảy ra khi: timeout, mất mạng, dữ liệu không hợp lệ, ... -->

## Ràng buộc
<!-- Giới hạn hiệu năng, bảo mật, tính nhất quán cần đảm bảo -->

## Tiêu chí chấp nhận
<!-- Làm thế nào để biết tính năng này hoạt động đúng? -->

## ADDED Requirements

### Requirement: Tổng hợp số liệu thống kê thời gian thực
Hệ thống SHALL cho phép ban tổ chức xem báo cáo tổng hợp doanh thu và số lượng vé bán ra của concert thông qua các truy vấn tối ưu.

#### Scenario: Truy vấn thống kê doanh thu thành công
- **WHEN** Ban tổ chức có vai trò hợp lệ gọi API truy vấn thống kê của một concert
- **THEN** Hệ thống thực hiện tính toán và trả về chính xác tổng doanh thu, số lượng vé đã bán và tỷ lệ phần trăm lấp đầy
