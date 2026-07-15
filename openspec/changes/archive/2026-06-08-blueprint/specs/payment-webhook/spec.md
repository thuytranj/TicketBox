# Đặc tả: Xử lý Webhook Thanh toán (Payment Webhooks)

## Mô tả
Hệ thống tiếp nhận các phản hồi (IPN/Webhook callback) bất đồng bộ từ các cổng thanh toán trực tuyến để cập nhật trạng thái đơn hàng.

## Luồng chính
<!-- Các bước xử lý theo thứ tự, các thành phần tham gia -->

## Kịch bản lỗi
<!-- Điều gì xảy ra khi: timeout, mất mạng, dữ liệu không hợp lệ, ... -->

## Ràng buộc
<!-- Giới hạn hiệu năng, bảo mật, tính nhất quán cần đảm bảo -->

## Tiêu chí chấp nhận
<!-- Làm thế nào để biết tính năng này hoạt động đúng? -->

## ADDED Requirements

### Requirement: Tiếp nhận và xác thực chữ ký Webhook
Hệ thống SHALL xác thực tính hợp lệ của Webhook từ cổng thanh toán và cập nhật trạng thái Booking một cách idempotent.

#### Scenario: Nhận xác nhận thanh toán thành công hợp lệ
- **WHEN** Cổng thanh toán gửi Webhook thông báo giao dịch thành công kèm chữ ký số hợp lệ
- **THEN** Hệ thống kiểm tra chữ ký số, đối soát transaction ID trong DB, cập nhật trạng thái đơn hàng thành paid và kích hoạt xuất vé
