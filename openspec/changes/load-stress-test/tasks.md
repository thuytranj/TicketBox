## 1. Setup & Preparation

- [x] 1.1 Khởi tạo cấu trúc thư mục kiểm thử tải mới tại `src/backend/test/load-test/`
- [x] 1.2 Viết script SQL `pre-generate-users.sql` (hoặc script Node.js tương đương) để tạo sẵn 1000 tài khoản người dùng và sinh mã JWT token tương ứng, lưu kết quả ra file JSON `users-tokens.json` phục vụ k6
- [x] 1.3 Tạo tài liệu hướng dẫn `src/backend/test/load-test/README.md` chi tiết về cài đặt k6, chuẩn bị dữ liệu, và cách chạy các kịch bản kiểm thử tải

## 2. Implement k6 Test Scripts

- [x] 2.1 Triển khai kịch bản `home-detail-read-load-test.js` giả lập lưu lượng đọc trang chủ và chi tiết concert bằng phương pháp Cache-aside
- [x] 2.2 Triển khai kịch bản `booking-concurrency-stress-test.js` giả lập tranh chấp đặt vé đồng thời đối với hạng vé giới hạn (ví dụ: SVIP 200 chỗ), sử dụng JWT token đã được sinh sẵn
- [x] 2.3 Triển khai kịch bản `booking-per-user-limit-test.js` gửi nhiều yêu cầu đặt vé song song từ cùng một tài khoản để kiểm tra cơ chế kiểm soát số vé tối đa
- [x] 2.4 Triển khai kịch bản `api-rate-limiting-spike-test.js` mô phỏng tải đột biến 80.000 người trong 5 phút đầu (70% dồn vào phút đầu tiên) để kiểm tra hoạt động của cơ chế API Rate Limiting

## 3. Execution & Verification

- [x] 3.1 Chạy kịch bản `home-detail-read-load-test.js` và xác minh thời gian phản hồi trung bình (average latency) dưới 50ms nhờ Cache Redis
- [x] 3.2 Chạy kịch bản `booking-concurrency-stress-test.js` và kiểm tra database để đảm bảo không xảy ra tình trạng bán vượt số vé trống (no overselling)
- [x] 3.3 Chạy kịch bản `booking-per-user-limit-test.js` và xác minh rằng không có tài khoản nào mua được số lượng vé vượt quá giới hạn cấu hình
- [x] 3.4 Chạy kịch bản `api-rate-limiting-spike-test.js` và xác minh hệ thống kích hoạt cơ chế chặn request vượt ngưỡng (trả về HTTP 429) và không xảy ra downtime
- [x] 3.5 Tổng hợp tất cả các chỉ số kết quả kiểm thử và viết báo cáo hiệu năng mẫu lưu vào `README.md`
