# Check-in Specification

## Purpose
Đặc tả luồng soát vé trực tuyến và ngoại tuyến tại cổng sự kiện, bao gồm cơ chế tải dữ liệu trước, đồng bộ dữ liệu sau khi kết nối mạng phục hồi, và thuật toán giải quyết xung đột "First Timestamp Wins" (Thời gian quét sớm nhất thắng) để chống tình trạng gian lận một vé vào cổng nhiều lần trong môi trường sóng yếu.

## Requirements

### Requirement: Tải dữ liệu soát vé ngoại tuyến (Pre-sync Data)
**Mô tả:**
Hệ thống cho phép nhân viên soát vé tải trước danh sách toàn bộ vé hợp lệ và khách mời VIP của một concert về thiết bị di động (mobile app) để phục vụ cho việc kiểm tra mã QR cục bộ ngay cả khi mất kết nối mạng.

**Luồng chính:**
1. Nhân viên soát vé gửi yêu cầu GET đến `/api/v1/checkin/data?concertId=<uuid>`.
2. Hệ thống xác thực quyền truy cập (`GATE_STAFF` hoặc `ORGANIZER`).
3. Truy vấn danh sách vé phổ thông đã thanh toán (trạng thái `active` và order `paid`) kèm thông tin phân khu (`zoneId`).
4. Truy vấn danh sách khách mời VIP đang hoạt động (trạng thái `active`).
5. Trả về payload chứa mã băm QR (`qrCodeHash`), id, và trạng thái soát vé (`checkinStatus`) của tất cả các vé và VIP.

**Kịch bản lỗi:**
- Concert không tồn tại: Trả về HTTP 404 Not Found.
- Không có quyền truy cập: Trả về HTTP 403 Forbidden.

**Ràng buộc:**
- API chỉ trả về chuỗi băm `qrCodeHash` thay vì mã raw QR gốc để đảm bảo tính bảo mật khi lưu trữ cục bộ trên thiết bị.

**Tiêu chí chấp nhận:**
- Dữ liệu trả về đầy đủ cả danh sách vé phổ thông lẫn khách mời VIP để thiết bị đối chiếu chính xác.

#### Scenario: Nhân viên tải dữ liệu ngoại tuyến thành công
- **WHEN** Nhân viên soát vé gọi API tải dữ liệu soát vé cho một concert hợp lệ với quyền truy cập đúng
- **THEN** Hệ thống trả về danh sách toàn bộ vé (`qrCodeHash`) và khách mời VIP của concert đó kèm trạng thái check-in hiện hành

### Requirement: Soát vé trực tuyến (Online Check-in)
**Mô tả:**
Khi có kết nối mạng ổn định, ứng dụng di động gửi yêu cầu quét mã QR trực tiếp lên máy chủ. Hệ thống xác thực tính hợp lệ, đánh dấu vé đã được sử dụng và ngăn chặn tức thời các lần quét trùng tiếp theo.

**Luồng chính:**
1. Nhân viên quét mã QR và gửi POST đến `/api/v1/checkin/scan` với `qrCodeHash`, `concertId`, `deviceId` và `scanTime`.
2. Hệ thống tìm kiếm vé phổ thông hoặc khách mời VIP khớp với `qrCodeHash` và `concertId`.
3. Kiểm tra trạng thái check-in hiện tại: nếu đã là `CHECKED_IN`, ném ra lỗi trùng lặp.
4. Nếu hợp lệ, mở database transaction:
   - Cập nhật trạng thái vé/VIP thành `CHECKED_IN` và lưu thời gian `checkedInAt` bằng `scanTime` (nếu không có thì lấy thời gian hiện tại).
   - Tạo bản ghi CheckinLog với trạng thái `VALID`, đánh dấu `isOffline: false` cùng thông tin thiết bị (`deviceId`).
5. Commit transaction và phản hồi thành công (200 OK) cho ứng dụng.

**Kịch bản lỗi:**
- Vé hoặc VIP không tồn tại: Trả về HTTP 404 Not Found.
- Vé đã được check-in trước đó: Trả về HTTP 400 Bad Request kèm mã lỗi `ALREADY_USED`.

**Ràng buộc:**
- Logic cập nhật trạng thái vé và lưu log phải nằm chung trong một Database Transaction để đảm bảo tính toàn vẹn, tránh tình trạng soát vé thành công nhưng không có log.

**Tiêu chí chấp nhận:**
- Vé quét thành công lần đầu được cập nhật đúng và lưu thông tin thiết bị, thời gian.
- Vé quét lần hai (hoặc vé đã bị đổi trạng thái) bị từ chối với thông báo "Ticket has already been used".

#### Scenario: Soát vé trực tuyến thành công lần đầu
- **WHEN** Nhân viên soát vé quét mã QR của một vé/VIP chưa được check-in và gửi yêu cầu trực tuyến
- **THEN** Hệ thống cập nhật trạng thái thành `CHECKED_IN`, ghi log check-in hợp lệ và trả về thông báo check-in thành công

#### Scenario: Soát vé trực tuyến thất bại do quét trùng
- **WHEN** Nhân viên soát vé quét mã QR của một vé/VIP đã có trạng thái `CHECKED_IN` trong database
- **THEN** Hệ thống từ chối yêu cầu và trả về lỗi 400 Bad Request kèm mã `ALREADY_USED` để cảnh báo nhân viên

### Requirement: Đồng bộ dữ liệu ngoại tuyến & Giải quyết xung đột (Offline Sync)
**Mô tả:**
Khi khu vực soát vé bị mất sóng, ứng dụng ghi nhận các lượt quét nội bộ trên máy. Khi có mạng lại, nó gửi danh sách các log này lên máy chủ. Hệ thống xử lý bất đồng bộ qua RabbitMQ và áp dụng thuật toán "First Timestamp Wins" (Lượt quét nào diễn ra sớm nhất theo thời gian thực sẽ là lượt quét hợp lệ) để giải quyết xung đột khi có nhiều thiết bị cùng quét một vé và gửi đồng bộ trễ.

**Luồng chính:**
1. Ứng dụng gửi POST đến `/api/v1/checkin/sync` chứa mảng `offlineLogs`.
2. API xác nhận nhanh và gửi mảng này vào RabbitMQ (`checkin.sync.queue`), trả về mã 202 Accepted cho thiết bị.
3. `CheckinSyncConsumer` tiêu thụ message, duyệt qua từng log offline:
   - Tìm vé hoặc VIP tương ứng dựa trên `qrCodeHash`.
   - **Trường hợp 1 (Vé chưa check-in):** Cập nhật trạng thái thành `CHECKED_IN` và lưu log là `VALID`.
   - **Trường hợp 2 (Vé ĐÃ check-in) - Giải quyết xung đột:** So sánh `scanTime` của log offline với `checkedInAt` đang lưu của vé.
     - Nếu **scanTime < checkedInAt (Đến sớm hơn):** Lượt quét offline này thực chất diễn ra sớm hơn, nhưng do mất mạng nên đồng bộ lên sau. Hệ thống công nhận lượt quét này: Cập nhật lại `checkedInAt` của vé bằng `scanTime`, đánh dấu các CheckinLog cũ thành `INVALIDATED_FRAUD` (gian lận), và lưu log offline hiện tại là `VALID`.
     - Nếu **scanTime >= checkedInAt (Đến trễ hơn):** Lượt quét offline diễn ra sau khi vé đã được check-in (tại một thiết bị khác). Đây là vé copy/trùng lặp. Hệ thống giữ nguyên trạng thái vé, lưu log offline này là `INVALIDATED_FRAUD`.

**Kịch bản lỗi:**
- Vé không tồn tại trong DB khi đang sync: Bỏ qua log và ghi cảnh báo lỗi vào log hệ thống.
- Cấu trúc message queue bị lỗi hoặc database sập: RabbitMQ sẽ giữ lại message và requeue.

**Ràng buộc:**
- API đồng bộ phải phản hồi tức thời (Non-blocking) nhờ RabbitMQ.
- Thuật toán giải quyết xung đột bắt buộc áp dụng Transaction cho từng vé để xử lý các vấn đề cập nhật chéo (race conditions) an toàn.

**Tiêu chí chấp nhận:**
- Log gửi lên từ thiết bị nào quét sớm nhất (theo timestamp) luôn được công nhận là `VALID`, bất kể thiết bị đó có mạng muộn hay sớm.
- Các lượt quét diễn ra sau đó (dù có mạng gửi lên trước) cuối cùng vẫn sẽ bị phân loại là `INVALIDATED_FRAUD`.

#### Scenario: Đồng bộ vé ngoại tuyến lần đầu
- **WHEN** Worker tiêu thụ message log ngoại tuyến cho một vé chưa từng check-in
- **THEN** Hệ thống cập nhật trạng thái vé thành `CHECKED_IN` và ghi nhận log là `VALID`

#### Scenario: Giải quyết xung đột "First Timestamp Wins" - Log offline có thời gian SỚM HƠN
- **WHEN** Worker tiêu thụ log ngoại tuyến có `scanTime` NHỎ HƠN (sớm hơn) thời gian `checkedInAt` hiện tại của vé (do thiết bị offline quét vé thật trước, nhưng thiết bị online quét vé giả và gửi lên trước)
- **THEN** Hệ thống ghi đè thời gian `checkedInAt` bằng `scanTime` mới, cập nhật các log cũ của vé này thành trạng thái `INVALIDATED_FRAUD`, và lưu log offline hiện tại thành `VALID`

#### Scenario: Giải quyết xung đột - Log offline có thời gian TRỄ HƠN
- **WHEN** Worker tiêu thụ log ngoại tuyến có `scanTime` LỚN HƠN hoặc BẰNG thời gian `checkedInAt` hiện tại của vé
- **THEN** Hệ thống xác định đây là quét trùng/gian lận, giữ nguyên thời gian `checkedInAt` của vé, không thay đổi log cũ, và lưu log offline hiện tại thành `INVALIDATED_FRAUD`
