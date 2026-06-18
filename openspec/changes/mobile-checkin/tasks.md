## 1. Database Schema & Migration

- [ ] 1.1 Tạo migration thêm trường `client_checked_in_at` và `checkin_device_id` vào bảng vé trong PostgreSQL
- [ ] 1.2 Tạo bảng `checkin_conflicts` trong PostgreSQL để lưu trữ các log soát vé bị xung đột/trùng lặp
- [ ] 1.3 Thiết lập cấu trúc cơ sở dữ liệu local (SQLite/Hive) trên Mobile App với các bảng `tickets` và `checkin_logs`

## 2. Authentication & Phân Quyền (RBAC) cho Gate Staff

- [ ] 2.1 Viết API đăng nhập `POST /auth/gate-login` xác thực tài khoản và cấp JWT token cho role `gate_staff`
- [ ] 2.2 Phân quyền API: Cấu hình Guard/Middleware chỉ cho phép `gate_staff` truy cập endpoint đồng bộ và tải danh sách vé
- [ ] 2.3 Implement logic tải Shared Secret Key và danh sách vé từ Server xuống Mobile App khi đăng nhập thành công. Sử dụng chiến lược Pagination (phân trang) hoặc Chunking để tải hàng loạt nhằm tránh OOM/Timeout.
- [ ] 2.4 Cài đặt cơ chế lưu trữ JWT Access Token và Shared Secret Keys an toàn vào Secure Storage (Keychain/EncryptedSharedPreferences) ở local
- [ ] 2.5 Thực hiện đồng bộ thời gian (NTP Sync / Server Time Handshake) với Server lúc đăng nhập để xử lý lỗi "Clock Drift"
- [ ] 2.6 Implement logic dọn dẹp (Secure Wipe): Xóa an toàn Shared Secret Keys và làm sạch SQLite Local DB khi đăng xuất hoặc sự kiện kết thúc

## 3. Xác thực mã hóa đối xứng HMAC-SHA256 (Offline Verification)

- [ ] 3.1 Tích hợp thuật toán sinh mã băm HMAC-SHA256 trên Backend khi phát hành vé
- [ ] 3.2 Nhúng thông tin chữ ký băm HMAC-SHA256 vào mã QR của vé dưới dạng chuỗi `base64url(payload).base64url(signature)`
- [ ] 3.3 Cài đặt thư viện/module tính HMAC-SHA256 trên Mobile App

## 4. Xử lý Quét vé & Lưu trữ local (Mobile App)

- [ ] 4.1 Xây dựng logic quét mã QR, phân tách payload và signature, băm đối chiếu bằng HMAC-SHA256 với Shared Secret Key ở local
- [ ] 4.2 Thiết kế logic truy vấn local DB để kiểm tra trùng lặp trên thiết bị hiện tại trước khi ghi nhận soát vé thành công
- [ ] 4.3 Lưu trữ log check-in mới vào bảng `checkin_logs` local kèm client timestamp chính xác cao

## 5. API Đồng bộ & Thuật toán Xử lý Xung đột First Timestamp Wins

- [ ] 5.1 Xây dựng logic gửi mảng check-in logs lên endpoint `POST /api/checkin/sync` khi Mobile App khôi phục kết nối mạng
- [ ] 5.2 Viết logic so sánh timestamp `T_new` với `T_existing` tại backend
- [ ] 5.3 Implement quy tắc cập nhật vé: nếu `T_new < T_existing`, cập nhật DB chính thức và đẩy bản ghi cũ sang bảng conflict
- [ ] 5.4 Implement quy tắc giữ nguyên vé: nếu `T_new >= T_existing`, giữ nguyên DB chính thức và đẩy bản ghi mới sang bảng conflict
- [ ] 5.5 Ghi log cảnh báo gian lận và trả về kết quả đồng bộ cho thiết bị client để cập nhật trạng thái đồng bộ local

## 6. Kiểm thử & Đánh giá (Testing & Verification)

- [ ] 6.1 Viết unit tests cho thuật toán băm đối chiếu HMAC-SHA256 trên client và server
- [ ] 6.2 Viết integration tests giả lập việc soát vé trên 2 thiết bị di động lệch giờ nhau để kiểm tra thuật toán First Timestamp Wins
- [ ] 6.3 Viết kiểm thử tự động cho API đăng nhập và phân quyền RBAC của `gate_staff`
