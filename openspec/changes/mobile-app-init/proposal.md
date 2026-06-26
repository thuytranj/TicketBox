# Proposal: Mobile App Initialization & Offline Check-in

## What
Khởi tạo ứng dụng Mobile (Flutter) cho hệ thống TicketBox dành riêng cho nhân sự kiểm soát vé. Ứng dụng bao gồm tính năng đăng nhập, chọn sự kiện, và quét mã QR offline. Điểm cốt lõi là giải mã chữ ký số của vé ngoại tuyến bằng Public Key và tự động đồng bộ lên Server qua RabbitMQ khi có mạng.

## Why
Trong các sự kiện lớn, kết nối Internet thường xuyên bị chập chờn hoặc mất hoàn toàn. Việc quét vé yêu cầu tốc độ phản hồi cực nhanh (dưới 1s/vé) và phải đảm bảo tính bảo mật (không làm giả được vé). Việc sử dụng chữ ký số (Public/Private Key) kết hợp cơ chế lưu trữ Local DB (offline-first) và background sync giúp đảm bảo hệ thống vẫn hoạt động trơn tru trong mọi điều kiện mạng.

## Scope
- Khởi tạo project Flutter.
- UI Đăng nhập, Chọn sự kiện, Quét QR.
- Tích hợp camera quét QR (`mobile_scanner`).
- Giải mã chữ ký số RSA/ECDSA để kiểm tra tính hợp lệ.
- Local DB để lưu trữ danh sách khách mời tải trước và cập nhật trạng thái `is_checked_in`.
- WorkManager / Background Tasks để đồng bộ với RabbitMQ khi có internet.
