# admin-tools Specification

## Purpose
Đặc tả các yêu cầu chức năng và kịch bản kiểm thử hành vi cho phân hệ Web Admin Portal dành cho Ban tổ chức, bám theo backend NestJS hiện tại.

## Requirements

### Requirement: Dashboard thống kê bằng Statistics API
Hệ thống SHALL hiển thị dashboard tổng quan cho Admin/Organizer bằng dữ liệu thật từ module Statistics của backend.

#### Scenario: Admin xem trang dashboard thống kê
- **WHEN** Admin mở trang Dashboard
- **THEN** Frontend gọi `GET /statistics/overview` để lấy tổng concert, đơn hàng, doanh thu, vé và check-in
- **AND** Frontend gọi `GET /statistics/revenue?period=day` để lấy dữ liệu doanh thu theo thời gian
- **AND** Frontend gọi `GET /concerts?page=1&limit=100` để lấy danh sách concert hiển thị sự kiện gần đây
- **AND** Frontend gọi `GET /statistics/concerts/:id` cho từng concert cần hiển thị tiến độ bán vé
- **AND** Hệ thống hiển thị tổng sự kiện, sự kiện đang bán, bản nháp, tổng vé phát hành, vé đã bán/giữ, tỷ lệ lấp đầy, doanh thu và check-in
- **AND** Nếu một request thống kê chi tiết concert thất bại, dashboard vẫn hiển thị các dữ liệu còn lại và cảnh báo số concert không tải được thống kê
- **AND** Frontend SHALL NOT gọi endpoint cũ `GET /admin/dashboard/statistics`

---

### Requirement: Nhập danh sách khách mời VIP từ tệp CSV
Hệ thống SHALL cho phép Admin/Organizer upload file CSV chứa danh sách khách VIP, tự động validate từng dòng, xử lý bất đồng bộ và hiển thị kết quả import bằng dữ liệu job status do backend trả về.

#### Scenario: Admin import thành công tệp CSV khách mời hợp lệ
- **WHEN** Admin upload tệp CSV chứa 500 khách mời VIP hợp lệ và nhấn "Bắt đầu Import"
- **THEN** Frontend gửi `POST /concerts/:id/guests/import` dạng `multipart/form-data`
- **AND** Hệ thống nhận `jobId` từ backend và theo dõi tiến trình bằng `GET /concerts/:id/guests/imports/:jobId`
- **AND** Khi job hoàn tất, hệ thống hiển thị báo cáo kết quả: "Thành công: 500 dòng, Thất bại: 0 dòng"
- **AND** Frontend cập nhật realtime khi nhận socket event `vip_import_status`

#### Scenario: Admin import tệp CSV có dòng lỗi dữ liệu
- **WHEN** Admin upload tệp CSV có 50 dòng bị sai định dạng và 450 dòng đúng
- **THEN** Backend import 450 dòng hợp lệ vào DB
- **AND** Frontend hiển thị báo cáo kết quả: "Thành công: 450 dòng, Thất bại: 50 dòng"
- **AND** Frontend hiển thị danh sách lỗi dòng từ JSON `errorLogs`
- **AND** Frontend SHALL NOT hiển thị nút tải `error_log.csv`/CDN URL khi backend chưa trả `errorLogUrl`

---

### Requirement: Tải lên PDF hồ sơ nghệ sĩ sinh Artist Bio bằng AI
Hệ thống SHALL cho phép Admin/Organizer upload file PDF press kit nghệ sĩ, gửi yêu cầu sinh tóm tắt tiểu sử bằng AI và cập nhật trạng thái loading/realtime trong quá trình xử lý.

#### Scenario: Admin tải lên PDF và xem tiến trình AI tóm tắt thành công
- **WHEN** Admin tải lên tệp PDF của nghệ sĩ cho một concert và bấm "Bắt đầu xử lý bằng AI"
- **THEN** Frontend gửi request `multipart/form-data` tới `POST /concerts/:id/artist-bio`
- **AND** Giao diện hiển thị trạng thái đang xử lý trong khi backend trích xuất văn bản PDF và gọi AI
- **WHEN** backend hoàn tất tóm tắt và phát notification realtime
- **THEN** Frontend tải lại hoặc cập nhật nội dung biography mới để Admin phê duyệt
- **AND** Admin có thể xác nhận nội dung bằng `PUT /concerts/:id/artist-bio/confirm`
