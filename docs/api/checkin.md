# Check-in API Specification

Tài liệu đặc tả chi tiết các API endpoints thuộc module Soát vé (Check-in) của TicketBox. Module này hỗ trợ nhân viên soát vé quét mã QR tại cổng sự kiện, bao gồm cả hai chế độ: Trực tuyến (Online) và Ngoại tuyến (Offline Synchronization).

## Tổng quan

- **Base URL:** `http://localhost:3000/api/v1` (môi trường Local Development)
- **Định dạng dữ liệu:** `application/json` cho tất cả các Request và Response.
- **Cơ chế xác thực:** Sử dụng JWT (JSON Web Tokens). Access Token được truyền qua HTTP Header `Authorization: Bearer <token>`.
- **Phân quyền:** Các API có ký hiệu `Bearer Token (Gate Staff/Organizer)` yêu cầu người dùng phải đăng nhập với vai trò `gate_staff` hoặc `organizer`.
- **Response envelope:** Backend hiện bọc hầu hết success response qua `TransformInterceptor` theo dạng:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Request processed successfully",
    "data": {},
    "timestamp": "2026-06-26T14:00:00.000Z"
  }
  ```
- **Error envelope:** Các lỗi HTTP đi qua `GlobalExceptionFilter` theo dạng:
  ```json
  {
    "success": false,
    "statusCode": 400,
    "message": "Validation failed",
    "timestamp": "2026-06-26T14:00:00.000Z",
    "path": "/api/v1/checkin/scan"
  }
  ```

### Danh sách API Endpoints

| HTTP Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/checkin/data` | Bearer Token (Gate Staff/Organizer) | Tải toàn bộ dữ liệu vé và khách VIP của một concert về máy hỗ trợ soát vé offline |
| **POST** | `/checkin/scan` | Bearer Token (Gate Staff/Organizer) | Quét và xác nhận mã QR vé (chế độ soát vé online) |
| **POST** | `/checkin/sync` | Bearer Token (Gate Staff/Organizer) | Đồng bộ hàng loạt lịch sử soát vé từ máy offline lên hệ thống |

---

## Chi tiết API Endpoints

### 1. Tải dữ liệu soát vé (`GET /checkin/data`)

Lấy toàn bộ dữ liệu về các vé hợp lệ (đã thanh toán) và danh sách khách mời VIP của một concert để lưu xuống local DB trên ứng dụng mobile.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
- **Query Parameters:**
  - `concertId` (uuid, required): ID của concert cần tải dữ liệu.
- **Responses:**
  - **200 OK:**
    ```json
    {
      "success": true,
      "statusCode": 200,
      "message": "Request processed successfully",
      "data": {
        "concertId": "019ec180-4917-74d1-b1bd-ef0e98bed9e0",
        "tickets": [
          {
            "id": "019ec1a0-9999-5678-b1bd-ef0e98bed9e0",
            "qrCodeHash": "hash_abc_123_xyz",
            "checkinStatus": "not_checked_in",
            "zoneId": "VIP"
          }
        ],
        "vipGuests": [
          {
            "id": "019ec1b0-1111-2222-b1bd-ef0e98bed9e0",
            "qrCodeHash": "hash_vip_789_xyz",
            "checkinStatus": "not_checked_in"
          }
        ]
      },
      "timestamp": "2026-06-26T14:00:00.000Z"
    }
    ```
    - `tickets` chỉ bao gồm vé có order `paid` và ticket `status = active`.
    - `vipGuests` chỉ bao gồm khách VIP có `status = active`.
    - `zoneId` hiện được backend map từ `ticketType.name`.
  - **401 Unauthorized:** Token không hợp lệ hoặc thiếu.
  - **403 Forbidden:** Tài khoản không có vai trò phù hợp.
  - **404 Not Found:** Concert không tồn tại.
    ```json
    {
      "success": false,
      "statusCode": 404,
      "message": "Concert not found",
      "timestamp": "2026-06-26T14:00:00.000Z",
      "path": "/api/v1/checkin/data?concertId=019ec180-4917-74d1-b1bd-ef0e98bed9e0"
    }
    ```

---

### 2. Quét QR code trực tuyến (`POST /checkin/scan`)

Gửi thông tin mã QR để hệ thống kiểm tra và đánh dấu người dùng đã vào cổng thành công. API này xử lý quét cho cả vé thường và vé mời VIP. Hệ thống lưu `deviceId` để phục vụ audit.

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
  - `qrCodeHash` (string, required): Chuỗi QR thô mà mobile quét được.
  - `deviceId` (string, required): Mã định danh của máy quét.
  - `scanTime` (timestamp, optional): Thời điểm quét thực tế. Nếu bỏ qua, server dùng thời gian hiện tại.

- **Responses:**
  - **200 OK:** Quét vé thành công, hợp lệ.
    ```json
    {
      "success": true,
      "statusCode": 200,
      "message": "Check-in successful",
      "data": {
        "success": true,
        "data": {
          "type": "regular_ticket",
          "ticketId": "019ec1a0-9999-5678-b1bd-ef0e98bed9e0",
          "checkinStatus": "checked_in",
          "checkedInAt": "2026-07-20T18:30:15.000Z"
        }
      },
      "timestamp": "2026-06-26T14:00:00.000Z"
    }
    ```
    - Payload hữu ích hiện nằm ở `body.data.data`.
    - Backend đang dùng field `ticketId` cho cả `regular_ticket` và `vip_guest`; mobile cần đọc thêm `type` để phân biệt.
  - **400 Bad Request:** Vé đã được sử dụng trước đó.
    ```json
    {
      "success": false,
      "statusCode": 400,
      "message": "Ticket has already been used",
      "timestamp": "2026-06-26T14:00:00.000Z",
      "path": "/api/v1/checkin/scan"
    }
    ```
  - **401 Unauthorized:** Token không hợp lệ.
  - **403 Forbidden:** Tài khoản không có vai trò phù hợp.
  - **404 Not Found:** Không tìm thấy mã vé trong hệ thống hoặc vé không thuộc concert này.
    ```json
    {
      "success": false,
      "statusCode": 404,
      "message": "Ticket or VIP guest not found for this concert",
      "timestamp": "2026-06-26T14:00:00.000Z",
      "path": "/api/v1/checkin/scan"
    }
    ```

---

### 3. Đồng bộ check-in offline (`POST /checkin/sync`)

API nhận danh sách các lượt quét đã được thực hiện ngoại tuyến và đẩy vào RabbitMQ để xử lý bất đồng bộ. Worker backend áp dụng chiến lược **First Timestamp Wins** để giải quyết xung đột giữa các máy quét.

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
  - **202 Accepted:** Dữ liệu đã được nhận và đưa vào hàng đợi xử lý.
    ```json
    {
      "success": true,
      "statusCode": 202,
      "message": "Offline check-in sync accepted for processing",
      "data": {
        "success": true,
        "total": 2
      },
      "timestamp": "2026-06-26T14:00:00.000Z"
    }
    ```
    - `202 Accepted` chỉ xác nhận server đã enqueue message, không phải kết quả đối soát cuối cùng của từng log.
  - **400 Bad Request:** Payload sai định dạng.
    ```json
    {
      "success": false,
      "statusCode": 400,
      "message": "Validation failed",
      "errors": [
        "offlineLogs should not be empty"
      ],
      "timestamp": "2026-06-26T14:00:00.000Z",
      "path": "/api/v1/checkin/sync"
    }
    ```
  - **401 Unauthorized:** Token không hợp lệ.
  - **403 Forbidden:** Tài khoản không có vai trò phù hợp.
  - **404 Not Found:** Concert không tồn tại.
    ```json
    {
      "success": false,
      "statusCode": 404,
      "message": "Concert not found",
      "timestamp": "2026-06-26T14:00:00.000Z",
      "path": "/api/v1/checkin/sync"
    }
    ```

---

## Ghi chú tích hợp Mobile

- Chuỗi QR hiện được backend xử lý trực tiếp như `qrCodeHash`; mobile app không cần, và hiện cũng không thể, tự verify HMAC theo module check-in hiện có.
- Nếu build offline-first trên Flutter, nên lưu local 2 nhóm dữ liệu tách biệt: `checkin_entries` (cache từ `GET /checkin/data`) và `offline_checkin_logs` (queue gửi `POST /checkin/sync`).
- Vì `POST /checkin/sync` là bất đồng bộ, trạng thái local sau khi upload nên là `uploaded` hoặc `queued`, không nên hiểu là `validated`.

