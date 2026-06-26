# Check-in API Specification

Tài liệu đặc tả chi tiết các API endpoints thuộc module Soát vé (Check-in) của TicketBox. Module này hỗ trợ nhân viên soát vé quét mã QR tại cổng sự kiện, bao gồm cả hai chế độ: Trực tuyến (Online) và Ngoại tuyến (Offline Synchronization).

## Tổng quan

- **Base URL:** `http://localhost:3000/api/v1` (môi trường Local Development)
- **Định dạng dữ liệu:** `application/json` cho tất cả các Request và Response.
- **Cơ chế xác thực:** Sử dụng JWT (JSON Web Tokens). Access Token được truyền qua HTTP Header `Authorization: Bearer <token>`.
- **Phân quyền:** Các API có ký hiệu `Bearer Token (Gate Staff/Organizer)` yêu cầu người dùng phải đăng nhập với vai trò `gate_staff` hoặc `organizer`.

### Danh sách API Endpoints

| HTTP Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/checkin/data` | Bearer Token (Gate Staff/Organizer) | Tải toàn bộ dữ liệu vé và khách VIP của một concert về máy hỗ trợ soát vé offline |
| **POST** | `/checkin/scan` | Bearer Token (Gate Staff/Organizer) | Quét và xác nhận mã QR vé (Chế độ soát vé Online) |
| **POST** | `/checkin/sync` | Bearer Token (Gate Staff/Organizer) | Đồng bộ hàng loạt lịch sử soát vé từ máy offline lên hệ thống |

---

## Chi tiết API Endpoints

### 1. Tải dữ liệu soát vé (`GET /checkin/data`)

Lấy toàn bộ dữ liệu về các vé hợp lệ (đã thanh toán) và danh sách khách mời VIP của một sự kiện hòa nhạc cụ thể để lưu trữ vào SQLite cục bộ trên ứng dụng di động (Mobile App) của nhân viên soát vé. Dữ liệu này giúp nhân viên có thể soát vé độc lập ngay cả khi nghẽn mạng hoặc mất kết nối tại cổng sự kiện.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
- **Query Parameters:**
  - `concertId` (uuid, required): ID của concert cần tải dữ liệu.
- **Responses:**
  - **200 OK:**
    ```json
    {
      "concertId": "019ec180-4917-74d1-b1bd-ef0e98bed9e0",
      "tickets": [
        {
          "id": "019ec1a0-9999-5678-b1bd-ef0e98bed9e0",
          "qrCodeHash": "hash_abc_123_xyz",
          "checkinStatus": "not_checked_in"
        }
      ],
      "vipGuests": [
        {
          "id": "019ec1b0-1111-2222-b1bd-ef0e98bed9e0",
          "qrCodeHash": "hash_vip_789_xyz",
          "checkinStatus": "not_checked_in"
        }
      ]
    }
    ```
  - **401 Unauthorized:** Token không hợp lệ hoặc thiếu.
  - **403 Forbidden:** Tài khoản không có vai trò phù hợp.
  - **404 Not Found:** Concert không tồn tại.

---

### 2. Quét QR code trực tuyến (`POST /checkin/scan`)

Gửi thông tin mã QR để hệ thống kiểm tra và đánh dấu người dùng đã vào cổng thành công. API này xử lý quét cho cả vé thường và vé mời VIP. Hệ thống sẽ lưu lại `device_id` của thiết bị thực hiện để phục vụ đối soát và audit.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
- **Request Body:**
  ```json
  {
    "concertId": "019ec180-4917-74d1-b1bd-ef0e98bed9e0",
    "qrCodeHash": "hash_abc_123_xyz",
    "deviceId": "gate_scanner_01",
    "scanTime": "2026-07-20T18:30:15.000Z"
  }
  ```
  - `concertId` (uuid, required): ID của concert đang tiến hành soát vé.
  - `qrCodeHash` (string, required): Chuỗi băm đọc từ mã QR của khách hàng.
  - `deviceId` (string, required): Mã định danh phần cứng (hoặc tên đăng nhập) của máy quét.
  - `scanTime` (timestamp, optional): Thời điểm quét thực tế (nếu không có sẽ lấy thời gian server).

- **Responses:**
  - **200 OK:** Quét vé thành công, hợp lệ.
    ```json
    {
      "success": true,
      "message": "Check-in successful",
      "data": {
        "type": "regular_ticket", // hoặc "vip_guest"
        "ticketId": "019ec1a0-9999-5678-b1bd-ef0e98bed9e0",
        "checkinStatus": "checked_in",
        "checkedInAt": "2026-07-20T18:30:15.000Z"
      }
    }
    ```
  - **400 Bad Request:** Vé đã được sử dụng trước đó (lỗi trùng lặp).
    ```json
    {
      "success": false,
      "message": "Ticket has already been used",
      "error": "Duplicate Check-in",
      "statusCode": 400
    }
    ```
  - **401 Unauthorized:** Token không hợp lệ.
  - **403 Forbidden:** Tài khoản không có vai trò phù hợp.
  - **404 Not Found:** Không tìm thấy mã vé trong hệ thống hoặc vé không thuộc sự kiện này.

---

### 3. Đồng bộ check-in offline (`POST /checkin/sync`)

API nhận một danh sách các lượt quét đã được thực hiện ngoại tuyến (Offline) tại ứng dụng di động và đẩy vào hàng đợi RabbitMQ để xử lý bất đồng bộ. Việc xử lý tuần tự qua Worker ngầm giúp tránh Race Condition khi nhiều máy quét cùng đồng bộ dữ liệu lên server cùng lúc. Hệ thống áp dụng thuật toán **"The First Timestamp Wins"** (ai quét trước về mặt thời gian thực tế sẽ được công nhận) để giải quyết xung đột gian lận liên máy.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
- **Request Body:**
  ```json
  {
    "concertId": "019ec180-4917-74d1-b1bd-ef0e98bed9e0",
    "offlineLogs": [
      {
        "qrCodeHash": "hash_abc_123_xyz",
        "deviceId": "gate_scanner_02",
        "scanTime": "2026-07-20T18:35:10.000Z"
      },
      {
        "qrCodeHash": "hash_def_456_xyz",
        "deviceId": "gate_scanner_02",
        "scanTime": "2026-07-20T18:36:20.000Z"
      }
    ]
  }
  ```

- **Responses:**
  - **202 Accepted:** Dữ liệu đã được tiếp nhận và đưa vào hàng đợi xử lý ngầm. Kết quả đối soát sẽ được ghi nhận vào bảng `checkin_logs` trên Database và cảnh báo gian lận (nếu có) sẽ hiển thị trên trang quản trị của BTC.
    ```json
    {
      "success": true,
      "message": "Offline check-in sync accepted for processing",
      "total": 2
    }
    ```
  - **400 Bad Request:** Payload sai định dạng.
  - **401 Unauthorized:** Token không hợp lệ.
  - **403 Forbidden:** Tài khoản không có vai trò phù hợp.
  - **404 Not Found:** Concert không tồn tại.

