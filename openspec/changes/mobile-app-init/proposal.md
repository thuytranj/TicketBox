# Proposal: Mobile App Initialization & Offline Check-in

## What
Khởi tạo ứng dụng Flutter cho nhân sự soát vé của TicketBox, bám đúng contract backend hiện có để có thể triển khai ngay. Ứng dụng cần hỗ trợ:

- đăng nhập bằng `POST /auth/login`
- kiểm tra vai trò bằng `GET /auth/me`
- chọn sự kiện từ `GET /concerts`
- tải dữ liệu soát vé bằng `GET /checkin/data`
- quét QR trực tuyến bằng `POST /checkin/scan`
- fallback offline bằng tra cứu local theo `qrCodeHash` và đồng bộ lại bằng `POST /checkin/sync`

## Why
Trong môi trường sự kiện thực tế, mạng thường chập chờn nên mobile app phải hoạt động theo hướng offline-first. Tuy nhiên backend check-in hiện tại không expose cơ chế verify HMAC trên thiết bị; contract thực tế của app là:

- QR scan được xem như chuỗi `qrCodeHash` opaque
- mobile preload danh sách `tickets` và `vipGuests` từ backend
- mobile tự tra cứu local để cho phép check-in offline
- khi có mạng, mobile gửi lại các log offline để backend xử lý bất đồng bộ qua RabbitMQ

Việc chỉnh lại tài liệu theo đúng code backend hiện có giúp tránh xây Flutter dựa trên giả định không tồn tại, đặc biệt ở phần verify QR và response payload.

## Scope
- Khởi tạo project Flutter và cấu hình `API_BASE_URL`.
- UI đăng nhập, chọn sự kiện, quét QR.
- API client cho `auth`, `concerts`, `checkin`.
- Local DB để lưu `checkin_entries` và hàng đợi `offline_checkin_logs`.
- Quét QR bằng `mobile_scanner`, dùng chính chuỗi quét được làm `qrCodeHash`.
- Online scan qua `/checkin/scan` khi có mạng ổn định.
- Offline lookup + background sync qua `/checkin/sync` khi mất mạng.
