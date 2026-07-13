# Đặc tả: Kiểm thử tải và áp lực hệ thống (Load and Stress Testing Specification)

## Mô tả
Tài liệu đặc tả này định nghĩa các kịch bản kiểm thử tải, kiểm thử áp lực và tranh chấp đồng thời nhằm xác minh hệ thống TicketBox đáp ứng các yêu cầu hiệu năng, tính ổn định và tính chính xác dưới tải cao quy định trong tài liệu [TicketBox.pdf](file:///Users/thuytran/Workspace/TicketBox/docs/TicketBox.pdf).

---

## ADDED Requirements

### Requirement: Kiểm thử tải đọc thông tin concert (Concert Read Load Testing)
Hệ thống SHALL đáp ứng được lưu lượng đọc lớn đối với danh sách concert và thông tin chi tiết concert thông qua tầng cache Redis nhằm giảm tải cho cơ sở dữ liệu PostgreSQL.

#### Scenario: Đọc trang danh sách và chi tiết dưới tải cao
- **WHEN** 1000 người dùng ảo (VUs) liên tục gửi yêu cầu đọc danh sách concert (`GET /concerts`) và chi tiết concert (`GET /concerts/:id`) trong thời gian 2 phút
- **THEN** Hệ thống phản hồi thành công (HTTP 200) với tỷ lệ lỗi < 1%, thời gian phản hồi trung bình (p95 latency) dưới 50ms, và số lượng truy vấn trực tiếp xuống Database PostgreSQL giảm thiểu rõ rệt nhờ cơ chế Cache-aside.

---

### Requirement: Kiểm thử áp lực tranh chấp đặt vé (Concert Booking Concurrency Stress Testing)
Hệ thống SHALL ngăn chặn hoàn toàn việc bán vượt số lượng vé hiện có (overselling) và đảm bảo tính nhất quán của số lượng vé còn lại khi có hàng ngàn người dùng đặt mua đồng thời những vé cuối cùng của concert.

#### Scenario: Tranh chấp các vé SVIP cuối cùng của concert
- **WHEN** 500 VUs đồng thời gửi yêu cầu đặt vé (`POST /bookings`) đối với hạng vé SVIP chỉ còn đúng 200 chỗ trống
- **THEN** Hệ thống chỉ chấp nhận đúng 200 giao dịch đặt vé thành công (HTTP 201), từ chối toàn bộ 300 giao dịch còn lại do hết vé (HTTP 400), và tổng số lượng vé đã chèn thành công trong database phải bằng đúng 200 bản ghi.

---

### Requirement: Kiểm thử thực thi giới hạn vé trên mỗi người dùng dưới tải cao (Per-user Ticket Limit Enforcement under Load)
Hệ thống SHALL thực thi chính xác giới hạn số lượng vé tối đa được mua trên mỗi tài khoản (ví dụ: SVIP tối đa 2 vé/tài khoản) ngay cả khi tài khoản đó gửi nhiều yêu cầu đặt vé đồng thời.

#### Scenario: Một tài khoản người dùng gửi nhiều yêu cầu đặt vé song song
- **WHEN** 1 VU đại diện cho một tài khoản gửi song song 10 yêu cầu đặt vé (mỗi yêu cầu đặt 1 vé SVIP) lên hệ thống, trong khi cấu hình giới hạn là tối đa 2 vé SVIP/tài khoản
- **THEN** Hệ thống chỉ cho phép tối đa 2 yêu cầu đặt vé thành công (HTTP 201), từ chối 8 yêu cầu còn lại (HTTP 400) với lý do vượt quá giới hạn vé, và tổng số lượng vé đã mua trong DB của tài khoản đó bằng đúng 2.

---

### Requirement: Kiểm thử tải đột biến và Rate Limiting (Spike Load and Rate Limiting Testing)
Hệ thống SHALL bảo vệ backend API khỏi sập do quá tải tài nguyên bằng cách kích hoạt cơ chế giới hạn tần suất (Rate Limiting) đối với các request liên tục hoặc bot, mô phỏng tải đột biến 80.000 người truy cập trong 5 phút (70% dồn vào phút đầu tiên).

#### Scenario: Tải đột biến cực lớn lên hệ thống trong thời gian ngắn
- **WHEN** 2000 VUs gửi request dồn dập trong 5 phút đầu mở bán (trong đó 70% lượng request tập trung vào phút đầu tiên) để mô phỏng hành vi của 80.000 người truy cập đồng thời
- **THEN** Hệ thống tự động kích hoạt Rate Limiting chặn các request vượt quá ngưỡng cấu hình và trả về mã lỗi HTTP 429 Too Many Requests, đồng thời đảm bảo CPU backend không vượt quá 90% và dịch vụ không bị gián đoạn (no downtime).
