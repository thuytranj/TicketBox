## 1. Cập nhật User & Concert Seeders hiện tại

- [x] 1.1 Cập nhật `src/backend/src/data/seeds/user.seed.ts` để bổ sung thêm các tài khoản gate staff (`staff2@ticketbox.vn`) và ít nhất 5 tài khoản khán giả (`audience1@ticketbox.vn` đến `audience5@ticketbox.vn`).
- [x] 1.2 Cập nhật `src/backend/src/data/seeds/concert.seed.ts` để thêm ít nhất 2 concert đã diễn ra trong quá khứ nhằm hỗ trợ hiển thị biểu đồ và phân tích thống kê.

## 2. Tạo các Seeders Mới

- [x] 2.1 Tạo file seeder mới `src/backend/src/data/seeds/vip-guest.seed.ts` để seed khách mời VIP mẫu cho một số sự kiện.
- [x] 2.2 Tạo file seeder mới `src/backend/src/data/seeds/transaction.seed.ts` để seed các bảng giao dịch bao gồm `Order`, `Ticket`, `Payment`, và `CheckinLog` với trạng thái và dòng tiền đồng bộ, thực tế.

## 3. Cập nhật Scripts Chạy Seed

- [x] 3.1 Cập nhật script chạy seed trực tiếp `src/backend/scripts/run-seed.cjs` để tích hợp và thực thi tất cả các seeder theo thứ tự phụ thuộc bảng.
- [x] 3.2 Chạy kiểm thử lệnh seed `npm run db:seed:direct` tại `src/backend` để xác nhận tất cả dữ liệu được ghi nhận thành công mà không gặp lỗi ràng buộc dữ liệu.
