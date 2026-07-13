## Why

Hệ thống TicketBox cần kiểm chứng khả năng chịu tải và áp lực dưới các kịch bản thực tế quy định trong tài liệu yêu cầu [TicketBox.pdf](file:///Users/thuytran/Workspace/TicketBox/docs/TicketBox.pdf) (như tải đột biến 80.000 người trong 5 phút đầu mở bán, tranh chấp vé hạng SVIP số lượng giới hạn, giới hạn số vé trên mỗi người dùng, và quá tải trang chủ/chi tiết). Việc thực hiện Load Test và Stress Test bằng công cụ k6 giúp xác định các điểm nghẽn hiệu năng (bottlenecks), kiểm tra tính chính xác của các cơ chế bảo vệ hệ thống (Rate Limiting, Redis Caching, Pessimistic Locking, Idempotency) và đảm bảo tính công bằng, ổn định dưới tải cao.

## What Changes

- **Backend / Test Suite**:
  - Bổ sung thư mục kiểm thử tải mới tại `src/backend/test/load-test/`.
  - Triển khai kịch bản `home-detail-read-load-test.js` để kiểm thử tải tính năng đọc danh sách và chi tiết concert nhằm đánh giá hiệu quả của tầng Caching (Redis).
  - Triển khai kịch bản `booking-concurrency-stress-test.js` để kiểm thử tranh chấp vé (Race Conditions) when hàng ngàn người dùng đặt các vé cuối cùng của concert (SVIP 200 chỗ) nhằm đánh giá cơ chế Transaction Locking (Pessimistic Write Lock).
  - Triển khai kịch bản `booking-per-user-limit-test.js` để kiểm thử khả năng thực thi giới hạn vé tối đa được mua của mỗi tài khoản (Per-user ticket limit enforcement) dưới tải cao.
  - Triển khai kịch bản `api-rate-limiting-spike-test.js` để mô phỏng tải đột biến 80.000 người trong 5 phút đầu (70% dồn vào phút đầu tiên) nhằm đánh giá cơ chế chặn bot và bảo vệ API Rate Limiting.
  - Thêm file hướng dẫn cài đặt k6, cách chạy các kịch bản test và định dạng báo cáo kết quả tại `src/backend/test/load-test/README.md`.

## Capabilities

### New Capabilities
- `load-stress-testing`: Cung cấp bộ kịch bản kiểm thử hiệu năng, tải đột biến và tranh chấp vé đồng thời sử dụng k6 nhằm bảo đảm hệ thống hoạt động ổn định và chính xác dưới tải cao theo yêu cầu nghiệp vụ.

### Modified Capabilities
<!-- Leave empty as we are only introducing testing capability without changing system functional requirements -->

## Impact

- **Test Infrastructure**: Bổ sung công cụ k6 để chạy kiểm thử hiệu năng cục bộ hoặc trên môi trường test.
- **Project Structure**: Thêm thư mục `src/backend/test/load-test/` chứa mã nguồn kịch bản test JavaScript và tài liệu.
- **CI/CD / Developer Workflow**: Các lập trình viên có thêm công cụ để tự chạy load test kiểm thử hiệu năng sau khi tối ưu hóa mã nguồn hoặc cấu trúc database.
