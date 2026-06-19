# Đặc tả: Hệ thống thông báo In-app thời gian thực và tự động dọn dẹp

## Mô tả
Tính năng này cung cấp giải pháp đẩy thông báo trong ứng dụng (In-app Notification) thời gian thực tới người dùng đang trực tuyến (online) thông qua giao thức WebSockets (Socket.io). Đồng thời, cung cấp hệ thống REST API giúp người dùng quản lý danh sách thông báo (phân trang) và cập nhật trạng thái đã đọc. Hệ thống cũng tích hợp một tiến trình dọn dẹp tự động chạy ngầm (Cron Job) định kỳ hàng ngày để xóa sạch các thông báo cũ đã đọc quá 30 ngày nhằm tối ưu dung lượng lưu trữ của cơ sở dữ liệu.

## Luồng chính

### Luồng 1: Xác thực và Kết nối WebSockets
1. Client thiết lập kết nối WebSocket tới server Socket.io.
2. Client đính kèm JWT Access Token thông qua handshake auth object (`auth: { token: '<JWT>' }`), query parameter, hoặc header Authorization.
3. Server chạy Middleware xác thực token. 
   - Nếu token không hợp lệ hoặc thiếu: Server từ chối kết nối và trả về lỗi kết nối xác thực.
   - Nếu token hợp lệ: Gán `userId` từ token payload vào socket instance, cho phép kết nối thành công và đưa socket đó gia nhập vào Room có tên là `userId` (để hỗ trợ multi-device/multi-tab).

### Luồng 2: Sinh thông báo và Đẩy sự kiện Real-time
1. Hệ thống phát sinh một sự kiện sinh thông báo (ví dụ: Worker xử lý xong AI biography, thanh toán đơn hàng thành công, v.v.).
2. Service nghiệp vụ gọi `NotificationService.createNotification(userId, data)`.
3. Hệ thống lưu bản ghi thông báo vào bảng `notification_logs` trong cơ sở dữ liệu PostgreSQL.
4. Nếu kênh nhận là `in_app` (`channel = 'in_app'`), `NotificationService` kiểm tra xem người dùng có đang online hay không:
   - Nếu người dùng online (có socket đang kết nối): Đẩy sự kiện `notification_received` kèm payload thông tin chi tiết của thông báo tới Room `userId` của người dùng.
   - Nếu người dùng offline: Bỏ qua bước đẩy realtime, bản ghi vẫn được lưu trong DB để người dùng đọc sau.

### Luồng 3: Xem và cập nhật trạng thái thông báo qua REST API
1. **Xem danh sách phân trang (`GET /notifications`)**: Người dùng gửi yêu cầu lấy danh sách thông báo. API thực hiện phân trang theo tham số `page` và `limit`, chỉ trả về các thông báo của chính người dùng hiện tại, sắp xếp theo thời gian tạo giảm dần.
2. **Đánh dấu một thông báo đã đọc (`PATCH /notifications/:id/read`)**: Người dùng bấm xem một thông báo cụ thể. API cập nhật trường trạng thái `status = 'read'` và timestamp `read_at = thời điểm hiện tại`.
3. **Đánh dấu tất cả thông báo đã đọc (`PATCH /notifications/read-all`)**: Người dùng bấm nút đọc tất cả. API cập nhật trường trạng thái `status = 'read'` và `read_at = thời điểm hiện tại` cho tất cả thông báo chưa đọc của người dùng đó.

### Luồng 4: Tự động dọn dẹp định kỳ (Cron Job + Batching + Lock)
1. Đúng 2:00 AM hàng ngày, Worker Node kích hoạt Cron Job dọn dẹp dữ liệu.
2. Tiến trình cố gắng giành lấy khóa phân tán (Distributed Lock) `locks:notification-cleanup` thông qua Redis Service với thời gian hết hạn là 60 giây.
   - Nếu không lấy được khóa (do instance khác đang thực hiện): Kết thúc tiến trình tại instance này.
   - Nếu lấy được khóa thành công: Tiến hành thực hiện vòng lặp xóa dữ liệu.
3. Trong mỗi chu kỳ lặp, hệ thống thực hiện câu lệnh xóa tối đa 5,000 bản ghi thỏa mãn điều kiện `status = 'read'` và `read_at < (thời điểm hiện tại - 30 ngày)`.
4. Sau mỗi lô xóa thành công, hệ thống nghỉ (cooldown) 200ms để nhường Disk I/O cho hệ thống.
5. Vòng lặp tiếp tục cho đến khi số lượng bản ghi bị xóa trong lô nhỏ hơn 5,000 (tức là đã dọn dẹp sạch), sau đó giải phóng khóa phân tán và kết thúc.

## Kịch bản lỗi

### Kịch bản 1: JWT Token không hợp lệ khi handshake WebSockets
- **Mô tả**: Client truyền sai token, token hết hạn hoặc không truyền token khi kết nối Socket.io.
- **Xử lý**: Thiết lập middleware kiểm tra trong gateway. Trả về ngoại lệ kết nối (`connect_error`) với thông báo lỗi cụ thể và ngắt kết nối client ngay lập tức, không cho phép đi vào luồng xử lý chính.

### Kịch bản 2: Client bị mất mạng đột ngột (Disconnect)
- **Mô tả**: Thiết bị client bị mất kết nối mạng khiến socket kết nối bị đóng.
- **Xử lý**: 
  - Server tự động phát hiện sự kiện ngắt kết nối thông qua heartbeat của Socket.io và dọn dẹp kết nối khỏi Room.
  - Client Socket.io tự động thử kết nối lại khi có mạng. Sau khi kết nối lại thành công, client chủ động gọi REST API `GET /notifications` để đồng bộ lại các thông báo bị bỏ lỡ trong thời gian mất mạng.

### Kịch bản 3: Đánh dấu đã đọc thông báo không tồn tại hoặc không thuộc quyền sở hữu
- **Mô tả**: Người dùng cố tình gửi request `PATCH /notifications/:id/read` với ID không tồn tại hoặc của người dùng khác.
- **Xử lý**: Service thực hiện kiểm tra quyền sở hữu bản ghi dựa trên `userId` trích xuất từ JWT token của Request. Trả về mã lỗi `404 Not Found` kèm thông điệp báo lỗi chi tiết nếu không tìm thấy hoặc bản ghi không thuộc quyền sở hữu của user.

### Kịch bản 4: Xung đột khóa phân tán khi dọn dẹp dữ liệu
- **Mô tả**: Có 2 hoặc nhiều Worker instance cùng kích hoạt Cron Job lúc 2:00 AM.
- **Xử lý**: Nhờ có Redis Lock, chỉ có instance đầu tiên giành được khóa thực thi. Instance thứ 2 sẽ bị từ chối khóa và lập tức thoát hàm dọn dẹp một cách an toàn mà không gây ra bất kỳ lỗi hệ thống nào.

### Kịch bản 5: Lỗi kết nối DB hoặc I/O trong quá trình xóa theo lô
- **Mô tả**: Database gặp sự cố tạm thời hoặc Disk bị nghẽn trong lúc đang lặp xóa các lô dữ liệu.
- **Xử lý**: Bọc khối lệnh lặp trong khối `try-catch`. Khi xảy ra lỗi, ghi nhận log lỗi (error log) chi tiết lên hệ thống và ngắt vòng lặp để thoát Cron Job một cách an toàn, tránh gây treo luồng hoặc crash server. Tác vụ sẽ tự động chạy lại vào ngày hôm sau.

## Ràng buộc

- **Bảo mật (Security)**: Bắt buộc phải áp dụng kiểm tra quyền sở hữu chéo (IDOR) trên tất cả các API REST và WebSocket. Không được phép để lộ thông tin thông báo của người dùng này cho người dùng khác.
- **Không nghẽn luồng (Non-blocking)**: Tác vụ dọn dẹp dữ liệu cũ bắt buộc phải chạy ở background của Worker Node, sử dụng cơ chế Batching (xóa theo lô) và Cooldown. Tuyệt đối không được thực hiện lệnh xóa hàng loạt bằng một câu query lớn duy nhất để tránh gây khóa bảng `notification_logs` ảnh hưởng tới luồng đặt vé và sử dụng API của khách hàng.
- **Tối ưu hóa Index**: Bảng `notification_logs` phải được đánh Partial Index trên trường `read_at` với điều kiện `status = 'read'` để tăng tốc độ quét dữ liệu cần xóa của Cron Job.
- **Tính nhất quán**: Trạng thái thông báo (`unread`/`read`) phải đồng bộ ngay lập tức sau khi cập nhật thành công qua API.

## Tiêu chí chấp nhận

- **Xác thực WebSocket**:
  - Gửi token JWT đúng -> Kết nối thành công.
  - Không gửi token hoặc token sai -> Kết nối thất bại và nhận lỗi `connect_error`.
- **Xem danh sách**: 
  - API `GET /notifications` trả về đúng định dạng JSON có phân trang (chứa mảng `data` và thông tin `meta` như `totalPages`, `totalItems`, `currentPage`).
  - Danh sách chỉ chứa thông báo thuộc về chính user đang đăng nhập và sắp xếp mới nhất lên đầu.
- **Đánh dấu đã đọc**:
  - Gọi API `PATCH /notifications/:id/read` cập nhật đúng trạng thái `read` và trường `readAt` trên DB, trả về HTTP 200 kèm bản ghi đã cập nhật.
  - Gọi API `PATCH /notifications/read-all` cập nhật thành công tất cả thông báo của user đó sang trạng thái `read` trên DB, trả về kết quả thành công.
- **Đẩy tin tức thời (Real-time Push)**:
  - Giả lập client online, tạo một thông báo in-app mới cho user đó -> Client phải nhận được sự kiện `notification_received` kèm payload thông báo trong vòng dưới 1 giây.
  - Giả lập client offline, tạo thông báo mới -> Không phát sinh lỗi, bản ghi được ghi nhận vào DB với trạng thái `unread` và `readAt = null`.
- **Tự động dọn dẹp**:
  - Kiểm thử định kỳ (giả lập thời gian chạy cron): Xóa sạch các bản ghi có trạng thái `read` và thời gian đọc quá 30 ngày.
  - Giữ nguyên các bản ghi chưa đọc (`unread`) và các bản ghi đã đọc dưới 30 ngày.
  - Ghi nhận log chi tiết số lượng bản ghi đã xóa ở mỗi đợt chạy.
