# Design: Mobile App Check-in Integration Aligned With Existing Backend

## Backend Contract To Follow
Mobile app cần bám các endpoint và response path sau:

| Endpoint | Mục đích | Payload hữu ích trong HTTP response |
| :--- | :--- | :--- |
| `POST /auth/login` | Lấy access token / refresh token | `body.data` |
| `GET /auth/me` | Kiểm tra role người dùng | `body.data` |
| `GET /concerts` | Tải danh sách concert active để chọn | `body.data.concerts` + `body.data.meta` |
| `GET /checkin/data` | Preload dữ liệu soát vé offline | `body.data` |
| `POST /checkin/scan` | Check-in online | `body.data.data` |
| `POST /checkin/sync` | Upload log offline | `body.data` |

Lý do có sự khác nhau này là backend đang dùng `TransformInterceptor` bọc response toàn cục. Riêng `POST /checkin/scan` và `POST /checkin/sync` hiện trả object đã có `message` từ service nên payload bị lồng thêm một tầng.

## Architecture Overview
Ứng dụng đi theo kiến trúc offline-first với 4 khối chính:

1. **UI Layer**: Login, Event List, Scanner, lịch sử đồng bộ.
2. **Remote API Layer**: `dio` hoặc `http` client cho `auth`, `concerts`, `checkin`, kèm parser cho response envelope.
3. **Local Persistence Layer**: `sqflite` hoặc `isar` để lưu cache check-in theo concert và hàng đợi log offline.
4. **Sync Layer**: Luồng sync trong app dùng `connectivity_plus` để đẩy `offlineLogs` về `POST /checkin/sync` khi thiết bị online trở lại.

Không đưa Crypto/HMAC verification vào mobile app ở giai đoạn này vì backend check-in hiện không expose format QR payload hay secret cho client-side verification. Chuỗi QR cần được xử lý như `qrCodeHash` opaque.

## Local Data Models
Nên tách 2 bảng local để bám đúng backend contract.

**Table: `checkin_entries`**
- `id`: String, id của ticket hoặc vip guest từ server
- `concert_id`: String
- `entry_type`: String (`ticket` hoặc `vip_guest`)
- `qr_code_hash`: String, unique theo cặp `concert_id + qr_code_hash`
- `checkin_status`: String (`not_checked_in` / `checked_in`)
- `zone_id`: String nullable, chỉ có ở ticket; backend hiện map từ `ticketType.name`
- `checked_in_at`: DateTime nullable, thời điểm app ghi nhận gần nhất
- `updated_at`: DateTime

**Table: `offline_checkin_logs`**
- `id`: String, local UUID
- `concert_id`: String
- `qr_code_hash`: String
- `device_id`: String
- `scan_time`: DateTime
- `upload_status`: String (`pending` / `uploaded` / `failed`)
- `server_ack_at`: DateTime nullable

## Preload Flow
1. Đăng nhập bằng `POST /auth/login`, lưu token.
2. Gọi `GET /auth/me` để xác nhận role là `gate_staff` hoặc `organizer`.
3. Tải danh sách concert bằng `GET /concerts`, gom đủ các trang active concerts mà backend trả về.
4. Khi người dùng chọn concert, gọi `GET /checkin/data?concertId=<uuid>`.
5. Map `tickets` và `vipGuests` từ backend vào `checkin_entries`.
6. Với `tickets`, lưu thêm `zoneId` nếu backend trả về.

## Online Scan Flow
1. Camera quét QR và lấy raw string.
2. Dùng chính raw string làm `qrCodeHash`.
3. Nếu mạng ổn định, gọi `POST /checkin/scan` với `concertId`, `qrCodeHash`, `deviceId`, `scanTime`.
4. Parse payload hữu ích tại `body.data.data`.
5. Nếu thành công, cập nhật local `checkin_entries.checkin_status = checked_in`.
6. Nếu nhận `400` với mã machine-readable `ALREADY_USED`, hiển thị vé đã dùng; nếu `404`, hiển thị vé không thuộc concert hoặc không tồn tại.

## Offline Scan Flow
1. Nếu không có mạng hoặc request online timeout, tra cứu local theo `concert_id + qr_code_hash`.
2. Không tìm thấy bản ghi: báo vé không hợp lệ.
3. Tìm thấy nhưng `checkin_status = checked_in`: báo quét trùng.
4. Tìm thấy và chưa check-in: cập nhật local entry sang `checked_in`, set `checked_in_at`.
5. Tạo một bản ghi mới ở `offline_checkin_logs` với `upload_status = pending`.

## Background Sync Flow
1. Worker lấy các log `upload_status = pending`, nhóm theo `concert_id`.
2. Gửi `POST /checkin/sync` với body:
   ```json
   {
     "concertId": "<uuid>",
     "offlineLogs": [
       {
         "qrCodeHash": "<raw-qr-string>",
         "deviceId": "<device-id>",
         "scanTime": "2026-07-20T18:35:10.000Z"
       }
     ]
   }
   ```
3. Nếu server trả `202 Accepted`, đánh dấu log là `uploaded` và lưu `server_ack_at`. Trên mobile, trạng thái này chỉ có nghĩa là log đã được backend **accept/enqueue**, chưa phải kết quả đối soát cuối cùng.
4. Nếu request lỗi, giữ `pending` hoặc chuyển `failed` để retry.

## Backend-Aligned Constraints
- `GET /checkin/data` hiện không trả `guest_name`, `email`, `phone`; mobile UI không nên phụ thuộc các trường này.
- `GET /concerts` hiện trả danh sách concert `active` theo phân trang chung, chưa phải danh sách assignment riêng cho gate staff.
- `POST /checkin/scan` dùng field `ticketId` cho cả ticket thường lẫn VIP guest; cần đọc thêm `type` để phân biệt.
- `POST /checkin/sync` chỉ xác nhận log đã được enqueue. Kết quả đối soát cuối cùng diễn ra bất đồng bộ trong worker của backend, nên trạng thái `uploaded` trên mobile không đồng nghĩa với `valid` cuối cùng.
