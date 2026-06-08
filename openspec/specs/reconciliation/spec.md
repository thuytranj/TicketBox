# reconciliation Specification

## Purpose
TBD - created by archiving change blueprint. Update Purpose after archive.
## Requirements
### Requirement: Đối soát và đồng bộ dữ liệu tự động
Hệ thống SHALL chạy cron job định kỳ để đối soát dữ liệu booking và cập nhật lại tồn kho Redis khớp với dữ liệu thật trong PostgreSQL.

#### Scenario: Phát hiện sai lệch và đồng bộ lại tồn kho
- **WHEN** Cron job đối soát phát hiện số lượng tồn kho thực tế trong DB khác với số lượng ghi nhận trên Redis
- **THEN** Hệ thống tự động ghi đè/hiệu chỉnh số lượng tồn kho trên Redis theo số liệu đối soát chính xác từ PostgreSQL

