# Thiết kế kỹ thuật: Kiểm thử tải và áp lực hệ thống (Load and Stress Testing Technical Design)

## Context
Hệ thống TicketBox cần kiểm chứng khả năng chịu tải và áp lực dưới các kịch bản thực tế quy định trong tài liệu yêu cầu [TicketBox.pdf](file:///Users/thuytran/Workspace/TicketBox/docs/TicketBox.pdf) trước khi triển khai sản xuất. Kiến trúc hiện tại của TicketBox gồm:
- **API Gateway:** Nginx điều phối request và thực hiện Rate Limiting cấp 1.
- **Application Layer:** NestJS API cluster.
- **Database Layer:** PostgreSQL lưu trữ dữ liệu nghiệp vụ (concert, ticket types, bookings, tickets...).
- **Caching Layer:** Redis cache cho trang chủ và thông tin chi tiết concert.
- **Message Broker:** RabbitMQ xử lý hàng đợi bất đồng bộ (email notification, VIP guests import).

Chúng ta sẽ sử dụng công cụ **k6** để viết các kịch bản kiểm thử hiệu năng, mô phỏng tải thực tế và phát hiện các điểm nghẽn (bottlenecks).

---

## Goals / Non-Goals

**Goals:**
- Thiết kế và triển khai 4 kịch bản kiểm thử k6 chính xác tương ứng với 4 yêu cầu về tải và concurrency trong đặc tả.
- Cấu hình k6 linh hoạt (Stages, VUs, Duration, Target URL) thông qua biến môi trường để dễ dàng tái sử dụng trên các môi trường khác nhau.
- Hướng dẫn thiết lập môi trường test sạch, cơ chế tiền sinh dữ liệu (pre-generation) của người dùng để tránh nghẽn luồng Auth khi chạy test luồng Đặt vé.
- Cung cấp tài liệu hướng dẫn chạy test và báo cáo kết quả hiệu năng chi tiết.

**Non-Goals:**
- Triển khai hạ tầng CI/CD tự động chạy load test (chỉ cung cấp hướng dẫn chạy thủ công cục bộ hoặc trong môi trường test độc lập).
- Thực hiện sửa đổi trực tiếp mã nguồn ứng dụng (chỉ đưa ra các khuyến nghị tối ưu hóa mã nguồn, cấu hình database và Redis dựa trên kết quả kiểm thử).

---

## Decisions

### 1. Sử dụng k6 (Grafana k6) làm công cụ kiểm thử tải chính
- **Giải pháp chọn:** Viết kịch bản kiểm thử tải bằng ngôn ngữ JavaScript chạy trên công cụ k6.
- **Lý do:** 
  - k6 viết bằng Go nên hiệu năng rất cao, tiêu thụ ít CPU/RAM trên máy chạy test so với các công cụ nền Java.
  - Sử dụng JavaScript giúp lập trình viên viết kịch bản linh hoạt (dễ dàng parse JSON, cấu hình header JWT, thực hiện các logic kiểm tra động).
  - k6 đã được cài đặt sẵn trên máy local của nhà phát triển.
- **Phương án thay thế:**
  - *JMeter:* Quá nặng, cấu hình bằng XML qua giao diện GUI phức tạp, khó quản lý phiên bản mã nguồn bằng Git.
  - *ApacheBench (ab):* Quá đơn giản, không hỗ trợ tốt kịch bản phức tạp (nhập JWT, xử lý token động, luồng đi tuần tự từ đọc concert sang đặt vé).

### 2. Tiền sinh Token Người dùng (User Token Pre-generation) cho kịch bản đặt vé
- **Giải pháp chọn:** Kịch bản stress test đặt vé sẽ sử dụng danh sách tài khoản và JWT token đã được sinh sẵn trước trong giai đoạn `setup` của k6 hoặc lưu ở file JSON tĩnh.
- **Lý do:** Nếu 500 VUs đồng thời thực hiện đăng nhập (`POST /auth/login`) rồi mới đặt vé, điểm nghẽn sẽ xảy ra ngay tại API đăng nhập (do thuật toán băm mật khẩu bcrypt tiêu tốn nhiều CPU). Việc tiền sinh token giúp cô lập hoàn toàn hiệu năng của API đặt vé (`POST /bookings`) và đảm bảo kết quả đo lường phản ánh đúng hiệu năng xử lý concurrency của DB.
- **Phương án thay thế:** Đăng nhập trực tiếp trong vòng lặp chính của k6. Bị loại bỏ vì làm sai lệch kết quả đo lường và gây quá tải CPU không cần thiết tại API Auth.

### 3. Cấu hình kiểm thử thông qua Environment Variables và k6 Options
- **Giải pháp chọn:** Sử dụng `options` của k6 để định nghĩa các stages (ramp-up, steady, ramp-down) và truyền tham số `BASE_URL`, `CONCERT_ID`, `TICKET_TYPE_ID` qua biến môi trường.
- **Lý do:** Giúp kịch bản test tách biệt khỏi dữ liệu cứng (hardcode), có thể chạy kiểm thử cho các concert khác nhau và trên các môi trường khác nhau (local, staging) mà không cần chỉnh sửa code.

---

## Risks / Trade-offs

- **[Risk 1] Rate Limiting chặn IP của máy chạy test:** Khi giả lập 2000 VUs, Nginx hoặc NestJS Rate Limiter sẽ nhận diện là tấn công và chặn IP, dẫn đến tỷ lệ lỗi 100% (HTTP 429).
  - *Mitigation:* Trong môi trường kiểm thử tải, cần tạm thời nâng ngưỡng giới hạn Rate Limiting trong file `.env` hoặc tắt Nginx Rate Limiting cho dải IP của máy chạy test.
- **[Risk 2] Dữ liệu rác chiếm dụng database sau khi chạy test:** Mỗi lượt chạy stress test đặt vé sẽ tạo ra hàng ngàn bản ghi bookings và tickets rác.
  - *Mitigation:* Cung cấp script cleanup SQL trong tài liệu hướng dẫn chạy test, hoặc thực hiện khôi phục (restore) cơ sở dữ liệu từ file backup sạch trước mỗi lần chạy test.
- **[Risk 3] Trực quan hóa kết quả test:** Kết quả console của k6 hiển thị dưới dạng văn bản thô, khó so sánh trực quan giữa các lượt chạy.
  - *Mitigation:* Hướng dẫn xuất kết quả ra file JSON/CSV hoặc sử dụng tùy chọn ghi log ra dashboard HTML thân thiện của k6 (`k6-reporter`).
