# payment-webhook Specification

## Purpose
TBD - created by archiving change blueprint. Update Purpose after archive.
## Requirements
### Requirement: Tiếp nhận và xác thực chữ ký Webhook
Hệ thống SHALL xác thực tính hợp lệ của Webhook từ cổng thanh toán và cập nhật trạng thái Booking một cách idempotent.

#### Scenario: Nhận xác nhận thanh toán thành công hợp lệ
- **WHEN** Cổng thanh toán gửi Webhook thông báo giao dịch thành công kèm chữ ký số hợp lệ
- **THEN** Hệ thống kiểm tra chữ ký số, đối soát transaction ID trong DB, cập nhật trạng thái đơn hàng thành paid và kích hoạt xuất vé

