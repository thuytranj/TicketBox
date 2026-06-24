# Notification API Specification

Tài liệu đặc tả chi tiết các API REST và các sự kiện thời gian thực (WebSockets) thuộc module Thông báo (Notification) của TicketBox.

## Tổng quan

- **Base URL:** `http://localhost:3000/api/v1` (môi trường Local Development)
- **REST Auth:** JWT (JSON Web Tokens). Access Token được truyền qua HTTP Header `Authorization: Bearer <token>`.
- **WebSocket URL:** `ws://localhost:3000` hoặc `http://localhost:3000` (Sử dụng client Socket.io, không đổi đường dẫn socket kết nối trực tiếp qua cổng load balancer)
- **WebSocket Auth:** JWT Token được truyền qua Handshake auth object `{ token: '<JWT_Token>' }` hoặc URL query parameter `?token=<JWT_Token>` hoặc HTTP Header `Authorization: Bearer <token>`.

### Danh sách REST API Endpoints

| HTTP Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/notifications` | Bearer Token | Lấy danh sách thông báo in-app phân trang của người dùng |
| **PATCH** | `/notifications/read-all` | Bearer Token | Đánh dấu tất cả thông báo in-app của người dùng là đã đọc |
| **PATCH** | `/notifications/:id/read` | Bearer Token | Đánh dấu một thông báo in-app cụ thể là đã đọc |

### Danh sách WebSocket Events

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `notification_received` | Server -> Client | Notification Object | Gửi thông báo in-app mới thời gian thực tới người dùng đang kết nối |
| `vip_import_status` | Server -> Client | VipGuestImport Object | Gửi cập nhật trạng thái tiến trình import VIP (hoàn thành/thất bại) thời gian thực tới người dùng yêu cầu |

---

## Chi tiết REST API Endpoints

### 1. Lấy danh sách thông báo in-app (`GET /notifications`)

Lấy danh sách các thông báo trong ứng dụng (channel = `in_app`) của người dùng hiện tại, sắp xếp theo thời gian tạo giảm dần.

- **Headers:**
  - `Authorization: Bearer <JWT_Token>`

- **Query Parameters:**
  - `page` (number, optional, default: `1`): Số trang muốn truy vấn.
  - `limit` (number, optional, default: `10`): Số lượng thông báo tối đa mỗi trang.
  - `status` (string, optional): Lọc theo trạng thái đọc. Nhận giá trị `'read'` hoặc `'unread'`. Nếu bỏ trống, trả về tất cả thông báo.


- **Responses:**
  - **200 OK:** Lấy danh sách thông báo thành công.
    ```json
    {
      "data": [
        {
          "id": "1",
          "userId": "019ead55-0ef1-738d-8616-b6f877b269c8",
          "type": "ai_bio_completed",
          "title": "Artist biography generated successfully",
          "body": "The artist biography for concert \"K-Pop Wave\" has been successfully generated as a draft. Please review and approve it.",
          "channel": "in_app",
          "status": "unread",
          "referenceId": "019ead55-0ef1-738d-8616-b6f877b26999",
          "readAt": null,
          "sentAt": null,
          "createdAt": "2026-06-18T16:00:00.000Z"
        }
      ],
      "meta": {
        "totalItems": 1,
        "itemCount": 1,
        "itemsPerPage": 10,
        "totalPages": 1,
        "currentPage": 1
      }
    }
    ```
  - **401 Unauthorized:** Token không hợp lệ hoặc đã hết hạn.

---

### 2. Đánh dấu tất cả thông báo đã đọc (`PATCH /notifications/read-all`)

Cập nhật trường `status` thành `read` và `readAt` thành thời gian hiện tại cho tất cả thông báo in-app đang ở trạng thái `unread` của người dùng.

- **Headers:**
  - `Authorization: Bearer <JWT_Token>`

- **Responses:**
  - **200 OK:** Cập nhật thành công.
    ```json
    {
      "success": true
    }
    ```
  - **401 Unauthorized:** Token không hợp lệ hoặc đã hết hạn.

---

### 3. Đánh dấu một thông báo đã đọc (`PATCH /notifications/:id/read`)

Đánh dấu trạng thái của một thông báo cụ thể (bằng ID) là đã đọc (`read`).

- **Headers:**
  - `Authorization: Bearer <JWT_Token>`

- **Parameters:**
  - `id` (number, required): ID của thông báo cần cập nhật.

- **Responses:**
  - **200 OK:** Đánh dấu đã đọc thành công, trả về thông báo sau khi cập nhật.
    ```json
    {
      "id": "1",
      "userId": "019ead55-0ef1-738d-8616-b6f877b269c8",
      "type": "ai_bio_completed",
      "title": "Artist biography generated successfully",
      "body": "The artist biography for concert \"K-Pop Wave\" has been successfully generated as a draft. Please review and approve it.",
      "channel": "in_app",
      "status": "read",
      "referenceId": "019ead55-0ef1-738d-8616-b6f877b26999",
      "readAt": "2026-06-18T16:05:00.000Z",
      "sentAt": null,
      "createdAt": "2026-06-18T16:00:00.000Z"
    }
    ```
  - **401 Unauthorized:** Token không hợp lệ hoặc đã hết hạn.
  - **404 Not Found:** Không tìm thấy thông báo tương ứng với ID được truyền vào hoặc thông báo không thuộc quyền sở hữu của người dùng hiện tại.
    ```json
    {
      "message": "Notification with ID 999 not found",
      "error": "Not Found",
      "statusCode": 404
    }
    ```

---

## Chi tiết WebSocket Real-time Push

Sử dụng giao thức WebSocket thông qua thư viện Socket.io để thiết lập kênh thông báo tức thời giữa Server và Client.

### 1. Cơ chế kết nối & Xác thực (Handshake)

Khi khởi tạo kết nối tới server, Client bắt buộc phải đính kèm JWT token. Nếu token bị thiếu hoặc không hợp lệ, server sẽ lập tức ngắt kết nối (reject connection).

**Ví dụ Code kết nối ở Client (JavaScript):**
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // Access Token JWT
  },
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Connected to WebSocket Server with ID:', socket.id);
});

socket.on('connect_error', (err) => {
  console.error('Connection failed:', err.message); // In ra lý do lỗi xác thực
});
```

### 2. Sự kiện đẩy thông báo (`notification_received`)

Mỗi khi hệ thống lưu một thông báo in-app mới cho người dùng (ví dụ: background worker sinh biography xong thành công/thất bại), Server sẽ đẩy sự kiện `notification_received` chứa thông tin chi tiết của thông báo đó về phía Client.

**Ví dụ code nhận sự kiện ở Client:**
```javascript
socket.on('notification_received', (notification) => {
  console.log('New In-app Notification received:', notification);
  // Thực hiện hiển thị UI Toast / Popover trên Client
});
```

### 3. Sự kiện cập nhật trạng thái import VIP (`vip_import_status`)

Mỗi khi tiến trình import danh sách khách mời VIP trong nền hoàn thành (`completed`) hoặc thất bại (`failed`), Server sẽ đẩy sự kiện `vip_import_status` chứa thông tin chi tiết trạng thái của Job (bao gồm thống kê số dòng đã nhập thành công và mảng nhật ký lỗi nếu có) về phía client của người dùng đã thực hiện hành động import.

*Lưu ý bảo mật:* Object payload trả về không bao gồm trường `fileUrl`.

**Ví dụ code nhận sự kiện ở Client:**
```javascript
socket.on('vip_import_status', (importJob) => {
  console.log('VIP import status updated:', importJob);
  // Cập nhật trạng thái giao diện import, thông báo toast hoặc cập nhật danh sách
});
```
