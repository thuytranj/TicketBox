## 1. Cập nhật Backend Core

- [x] 1.1 Cập nhật enum `ConcertStatus` trong `concert.entity.ts` để thêm `COMPLETED = 'completed'`
- [x] 1.2 Cập nhật các quy tắc xác thực dữ liệu (validation) hoặc DTO tham chiếu đến `ConcertStatus` ở backend
- [x] 1.3 Cập nhật logic lấy số liệu tổng quan trong `StatisticsService` để đếm và ánh xạ các concert trạng thái `completed`

## 2. Tự động chuyển đổi trạng thái

- [x] 2.1 Tạo hoặc cập nhật một cron job NestJS trong background services để quét các concert đã kết thúc
- [x] 2.2 Triển khai cập nhật hàng loạt (batch update) trong DB chuyển đổi các concert đã kết thúc từ `active` sang `completed`
- [x] 2.3 Bổ sung logic giải phóng bộ nhớ đệm Redis (cache invalidation) bên trong cron job cho các concert vừa chuyển đổi trạng thái

## 3. Migrations database & Cập nhật Seed

- [x] 3.1 Tạo tệp migration để cập nhật các concert cũ hiện có sang trạng thái `completed` trong PostgreSQL
- [x] 3.2 Cập nhật tệp `concert.seed.ts` để đánh dấu trạng thái khởi tạo của các concert cũ là `ConcertStatus.COMPLETED`

## 4. Cập nhật Frontend

- [x] 4.1 Cập nhật enum `ConcertStatus` trong mã nguồn frontend
- [x] 4.2 Cập nhật giao diện dashboard và các nhãn trạng thái (status badges) hiển thị đúng màu sắc và văn bản cho trạng thái `completed`
