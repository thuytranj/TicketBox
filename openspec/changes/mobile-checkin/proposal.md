## Why

Hệ thống soát vé hiện tại yêu cầu kết nối mạng trực tuyến liên tục để kiểm tra trạng thái vé từ cơ sở dữ liệu chính. Tuy nhiên, tại các sự kiện đông người, kết nối internet thường xuyên bị chập chờn hoặc mất hoàn toàn, dẫn đến việc soát vé bị đình trệ. Cần có giải pháp cho phép nhân viên tại cổng (gate_staff) soát vé ngoại tuyến an toàn bằng thiết bị di động, tự kiểm tra tính hợp lệ của vé mà không phụ thuộc vào internet, đồng thời đảm bảo dữ liệu soát vé được đồng bộ chính xác khi kết nối mạng được phục hồi.

## What Changes

- **Soát vé ngoại tuyến an toàn:** Thiết bị di động có thể xác thực tính chính chủ của vé từ mã QR ngoại tuyến bằng giải pháp xác thực mã hóa đối xứng HMAC-SHA256 sử dụng Shared Secret Key (không cần gọi API backend).
- **Lưu trữ dữ liệu local:** Sử dụng Local Database (SQLite/Hive) trên thiết bị di động để lưu trữ danh sách vé (hoặc mã băm của vé) và lưu lịch sử check-in ngoại tuyến.
- **Đồng bộ và xử lý xung đột:** Tải log check-in ngoại tuyến lên hệ thống khi khôi phục kết nối mạng. Áp dụng quy tắc "First Timestamp Wins" để giải quyết xung đột khi một vé bị soát trùng trên nhiều thiết bị.
- **Phân quyền và bảo mật cho Gate Staff:** Cung cấp API đăng nhập dành riêng cho role `gate_staff`, cấp JWT token và đặc tả cấu trúc lưu trữ JWT local bảo mật để phục vụ phiên làm việc ngoại tuyến.

## Risks & Assumptions

- **Giả định (Assumptions):** Thiết bị di động của gate_staff có thể đồng bộ thời gian thực tế với Server (thông qua giao thức NTP hoặc bắt tay khi đăng nhập online) để tính toán sai số thời gian (clock drift), giúp quy tắc "First Timestamp Wins" hoạt động chính xác tuyệt đối.
- **Nguy cơ (Risks):** Lộ Shared Secret Key trên thiết bị di động (nếu bị can thiệp vật lý hoặc root máy). Biện pháp giảm thiểu: Khóa mã hóa phải được lưu trữ trong Keystore/Keychain bảo mật phần cứng và tự động hủy sau khi sự kiện kết thúc.

## Non-Goals (Những gì không làm)

- **Không đồng bộ Peer-to-Peer:** Không thiết lập mạng LAN/mạng ngang hàng nội bộ để đồng bộ tức thì giữa các thiết bị soát vé khi tất cả đều đang offline.
- **Không hỗ trợ nghiệp vụ bán vé/đổi vé:** Ứng dụng di động chỉ phục vụ soát vé và tải log, không tích hợp tính năng mua vé, hủy vé hoặc đổi vé offline.

## Capabilities

### New Capabilities
- `auth-rbac`: Cơ chế đăng nhập cho role `gate_staff` và cấu trúc lưu trữ JWT local trên thiết bị di động.

### Modified Capabilities
- `checkin`: Cải tiến đặc tả soát vé để tích hợp cơ chế tự kiểm tra ngoại tuyến bằng HMAC-SHA256 sử dụng Shared Secret Key, lưu local DB và đồng bộ giải quyết xung đột bằng "First Timestamp Wins".

## Impact

- **Mobile Application:** 
  - Tích hợp SQLite/Hive để lưu trữ database offline.
  - Tích hợp thư viện mã hóa HMAC-SHA256 để tính toán và đối chiếu mã băm.
  - Tích hợp logic đồng bộ tự động hoặc thủ công kèm cơ chế lưu trữ timestamp chính xác cao ở local.
- **Backend API Service:**
  - Cung cấp API đăng nhập cho `gate_staff` nhận JWT token phù hợp.
  - Cung cấp API tải danh sách vé/chữ ký và Shared Secret Key của concert để app lưu local.
  - Thay đổi API cập nhật check-in / đồng bộ check-in: hỗ trợ nhận mảng log check-in kèm client timestamp, triển khai thuật toán "First Timestamp Wins" để phát hiện và xử lý vé bị quét trùng.
- **Database Schema chính:**
  - Thêm trường `client_checked_in_at` (timestamp) và `checkin_device_id` vào bảng vé/log check-in để đối chiếu.
