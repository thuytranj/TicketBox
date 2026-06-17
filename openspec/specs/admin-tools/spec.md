# admin-tools Specification

## Purpose
Đặc tả các yêu cầu chức năng và kịch bản kiểm thử hành vi (Behavioral Scenarios) cho phân hệ Web Admin Portal dành cho Ban tổ chức.

## Requirements

### Requirement: Thống kê doanh thu và lượng vé bán trên Dashboard
Hệ thống SHALL hiển thị các biểu đồ Chart.js trực quan thống kê tổng doanh thu và tỷ lệ bán vé của các concert theo thời gian thực.

#### Scenario: Admin xem trang dashboard thống kê concert
- **WHEN** Admin chọn Concert "Anh Trai Say Hi" trên trang Dashboard
- **THEN** Hệ thống hiển thị các thẻ chỉ số (Tổng doanh thu, Tổng vé bán, Tỷ lệ lấp đầy)
- **AND** Render biểu đồ Line Chart về dòng tiền doanh số và Stacked Bar Chart về số lượng vé bán theo từng phân hạng (SVIP, VIP, GA) bằng thư viện Chart.js

---

### Requirement: Nhập danh sách khách mời VIP từ tệp CSV
Hệ thống SHALL cho phép Admin upload file CSV chứa danh sách khách VIP, tự động validate từng dòng, thực hiện batch insert các dòng đúng và trả về file báo cáo log lỗi nếu có dòng lỗi.

#### Scenario: Admin import thành công tệp CSV khách mời hợp lệ
- **WHEN** Admin upload tệp CSV chứa 500 khách mời VIP hợp lệ và nhấn "Bắt đầu Import"
- **THEN** Hệ thống gửi tệp tin lên server để tiến hành Stream Processing và Batch Insert
- **AND** Hiển thị thanh tiến trình loading thành công 500/500 dòng
- **AND** Báo cáo kết quả: "Thành công: 500 dòng, Thất bại: 0 dòng"

#### Scenario: Admin import tệp CSV có dòng lỗi dữ liệu
- **WHEN** Admin upload tệp CSV có 50 dòng bị sai định dạng (thiếu email hoặc sai SĐT) và 450 dòng đúng
- **THEN** Hệ thống tiến hành import 450 dòng hợp lệ vào DB
- **AND** Báo cáo kết quả: "Thành công: 450 dòng, Thất bại: 50 dòng"
- **AND** Hiển thị nút "Tải file báo cáo lỗi" chứa đường dẫn CDN tới tệp `error_log.csv` để Admin tải xuống sửa đổi

---

### Requirement: Tải lên PDF hồ sơ nghệ sĩ sinh Artist Bio bằng AI
Hệ thống SHALL cho phép Admin upload file PDF press kit nghệ sĩ, gửi yêu cầu sinh tóm tắt tiểu sử bằng AI và cập nhật trạng thái loading real-time trong quá trình xử lý.

#### Scenario: Admin tải lên PDF và xem tiến trình AI tóm tắt thành công
- **WHEN** Admin tải lên tệp PDF của ca sĩ Sơn Tùng M-TP cho concert "Anh Trai Say Hi" và bấm "Bắt đầu xử lý bằng AI"
- **THEN** Hệ thống gửi request thô dạng `multipart/form-data` lên server và nhận về trạng thái `202 Accepted`
- **AND** Giao diện Admin hiển thị hiệu ứng Loading Spinner và thông báo: "Hệ thống đang trích xuất văn bản PDF và phân tích bằng AI..."
- **WHEN** Gemini AI hoàn tất tóm tắt và cập nhật vào DB, Server gửi tín hiệu WebSocket báo hoàn tất
- **THEN** Hiệu ứng Loading biến mất, đoạn văn tóm tắt tiểu sử mới tự động render ra màn hình để Admin phê duyệt
