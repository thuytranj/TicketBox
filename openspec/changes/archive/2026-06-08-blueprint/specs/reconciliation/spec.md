# Đặc tả: Đối soát & Đồng bộ tồn kho (Reconciliation & Cache Recovery)

## Mô tả
Tiến trình nền định kỳ chạy để đối chiếu dữ liệu tồn kho giữa PostgreSQL và cache Redis để phát hiện và khắc phục các sai lệch dữ liệu.

## Luồng chính
<!-- Các bước xử lý theo thứ tự, các thành phần tham gia -->

## Kịch bản lỗi
<!-- Điều gì xảy ra khi: timeout, mất mạng, dữ liệu không hợp lệ, ... -->

## Ràng buộc
<!-- Giới hạn hiệu năng, bảo mật, tính nhất quán cần đảm bảo -->

## Tiêu chí chấp nhận
<!-- Làm thế nào để biết tính năng này hoạt động đúng? -->

## ADDED Requirements

### Requirement: Đối soát và đồng bộ dữ liệu tự động
Hệ thống SHALL chạy cron job định kỳ để đối soát dữ liệu booking và cập nhật lại tồn kho Redis khớp với dữ liệu thật trong PostgreSQL.

#### Scenario: Phát hiện sai lệch và đồng bộ lại tồn kho
- **WHEN** Cron job đối soát phát hiện số lượng tồn kho thực tế trong DB khác với số lượng ghi nhận trên Redis
- **THEN** Hệ thống tự động ghi đè/hiệu chỉnh số lượng tồn kho trên Redis theo số liệu đối soát chính xác từ PostgreSQL
