## 1. Entity Modifications

- [x] 1.1 Thêm unique index trên cột `qrCodeHash` của entity `VipGuest`
- [x] 1.2 Thêm index đơn lẻ trên các cột `ticketId` và `vipGuestId` của entity `CheckinLog`
- [x] 1.3 Thêm index đơn lẻ trên cột `orderId` của entity `Ticket`
- [x] 1.4 Thêm index đơn lẻ trên cột `concertId` của entity `TicketType`
- [x] 1.5 Thêm composite index trên `(status, startTime)` của entity `Concert`
- [x] 1.6 Thêm composite index trên `(userId, channel, createdAt)` của entity `NotificationLog`

## 2. Database Migration

- [x] 2.1 Chạy lệnh của TypeORM để generate file migration chứa định nghĩa các index mới
- [x] 2.2 Chạy migration để áp dụng các index vào database local PostgreSQL và xác minh thành công

## 3. Verification & Testing

- [x] 3.1 Thực hiện `npm run build` để kiểm tra biên dịch dự án backend
- [x] 3.2 Chạy các test case kiểm soát quét vé và đồng bộ check-in để đảm bảo hệ thống hoạt động ổn định
