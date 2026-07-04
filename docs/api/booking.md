# Booking API Specification

Tài liệu đặc tả chi tiết các API endpoints thuộc module Đặt vé (Booking) của TicketBox.

## Tổng quan

- **Base URL:** `http://localhost:3000/api/v1` (môi trường Local Development)
- **Định dạng dữ liệu:** `application/json` cho tất cả các Request và Response.
- **Cơ chế xác thực:** Sử dụng JWT (JSON Web Tokens). Access Token được truyền qua HTTP Header `Authorization: Bearer <token>`.

### Danh sách API Endpoints

| HTTP Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/bookings` | Bearer Token | Khởi tạo đơn đặt vé mới (xử lý bất đồng bộ qua Queue) |
| **GET** | `/bookings` | Bearer Token | Lấy danh sách tất cả vé đã mua của người dùng hiện tại |
| **GET** | `/bookings/:id` | Bearer Token | Lấy chi tiết thông tin và trạng thái đơn đặt vé (dùng để polling) |

---

## Chi tiết API Endpoints

### 1. Khởi tạo đơn đặt vé (`POST /bookings`)

Tạo mới một yêu cầu đặt vé cho concert. Do tính chất lượng truy cập cao (high concurrency), API này hoạt động bất đồng bộ:
1. Xác thực các hạng vé yêu cầu và kiểm tra tồn kho trong cache Redis bằng Lua Script.
2. Nếu đủ điều kiện, tạm giữ vé trên Redis và đẩy thông tin đơn đặt vé vào RabbitMQ queue (`booking_tasks`) để worker lưu xuống Database sau.
3. Đồng thời đẩy một tin nhắn có thời gian sống (TTL = 10 phút) vào queue trì hoãn (`booking_delay_queue`) để xử lý hết hạn đơn đặt hàng (Order Expiration) tự động qua Dead Letter Exchange (DLX).
4. Phản hồi lập tức mã `202 Accepted` kèm ID đơn hàng được sinh sẵn (UUIDv7) để client thực hiện polling trạng thái.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `idempotency-key` (string, required): Khóa duy nhất (ví dụ UUIDv4) để ngăn chặn việc gửi trùng lặp đơn hàng từ client trong khoảng thời gian ngắn.

- **Request Body:**
  ```json
  {
    "concertId": "019ead55-0ef1-738d-8616-b6f877b26aa1",
    "items": [
      {
        "ticketTypeId": "019ead55-0ef1-738d-8616-b6f877b26cc3",
        "quantity": 2
      }
    ]
  }
  ```
  - `concertId` (string, UUID, required): ID của hòa nhạc cần đặt vé.
  - `items` (array, required, min size 1): Danh sách vé đặt mua. Mỗi hạng vé gồm:
    - `ticketTypeId` (string, UUID, required): ID của hạng vé.
    - `quantity` (number, integer, required): Số lượng vé đặt mua (từ 1 đến 10).

- **Responses:**
  - **202 Accepted:** Đã nhận đơn đặt vé và đang tiến hành xử lý ngầm.
    ```json
    {
      "message": "Booking is being processed. Please wait for confirmation.",
      "status": "pending",
      "orderId": "019ead55-0ef1-738d-8616-b6f877b269c8",
      "totalAmount": 11000000
    }
    ```
  - **400 Bad Request:**
    - *Lỗi validation dữ liệu đầu vào hoặc định dạng UUID:*
      ```json
      {
        "message": [
          "concertId must be a UUID",
          "items.0.ticketTypeId must be a UUID",
          "items.0.quantity must not be greater than 10"
        ],
        "error": "Bad Request",
        "statusCode": 400
      }
      ```
    - *Lỗi hết vé/thiếu tồn kho (trả về từ Lua script):*
      ```json
      {
        "message": "Not enough tickets available for ticket type: SVIP",
        "error": "Bad Request",
        "statusCode": 400
      }
      ```
    - *Lỗi vượt quá giới hạn vé tối đa được mua trên mỗi tài khoản:*
      ```json
      {
        "message": "Purchase limit exceeded for ticket type: SVIP (max 2 per account)",
        "error": "Bad Request",
        "statusCode": 400
      }
      ```
  - **401 Unauthorized:** Token không hợp lệ hoặc hết hạn.
  - **429 Too Many Requests:** Tần suất gửi yêu cầu quá giới hạn cho phép (Rate limit: tối đa 5 requests trong 10 giây đối với endpoint đặt vé).
    ```json
    {
      "statusCode": 429,
      "message": "ThrottlerException: Too Many Requests"
    }
    ```

---

### 2. Lấy danh sách vé đã mua (`GET /bookings`)

Trả về toàn bộ danh sách các đơn đặt vé (kèm vé cụ thể và thông tin concert) của người dùng đang đăng nhập, sắp xếp theo thời gian đặt mới nhất trước. Hỗ trợ lọc theo trạng thái và phân trang.

- **Headers:**
  - `Authorization: Bearer <accessToken>`

- **Query Parameters:**

  | Param | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `status` | string | Không | Lọc theo trạng thái đơn: `pending` \| `paid` \| `expired` \| `cancelled` |
  | `page` | integer | Không | Trang hiện tại (min: 1, mặc định: 1) |
  | `limit` | integer | Không | Số kết quả mỗi trang (min: 1, max: 50, mặc định: 10) |

- **Responses:**
  - **200 OK:**
    ```json
    {
      "data": [
        {
          "id": "019ead55-0ef1-738d-8616-b6f877b269c8",
          "userId": "019ead55-0ef1-738d-8616-b6f877b26999",
          "concertId": "019ead55-0ef1-738d-8616-b6f877b26aa1",
          "status": "paid",
          "totalAmount": 11000000.00,
          "idempotencyKey": "some-idempotency-key",
          "createdAt": "2026-06-23T15:10:00.000Z",
          "tickets": [
            {
              "id": "019ead55-0ef1-738d-8616-b6f877b26bb2",
              "orderId": "019ead55-0ef1-738d-8616-b6f877b269c8",
              "ticketTypeId": "019ead55-0ef1-738d-8616-b6f877b26cc3",
              "qrCodeHash": "abc123...",
              "status": "active",
              "checkinStatus": "not_checked_in",
              "checkedInAt": null,
              "ticketType": {
                "id": "019ead55-0ef1-738d-8616-b6f877b26cc3",
                "name": "SVIP",
                "price": 5500000
              }
            }
          ],
          "concert": {
            "id": "019ead55-0ef1-738d-8616-b6f877b26aa1",
            "title": "The Eras Tour - HCMC",
            "location": "Sân vận động Quân khu 7, TP. Hồ Chí Minh",
            "startTime": "2026-07-20T19:00:00.000Z",
            "endTime": "2026-07-20T23:00:00.000Z",
            "posterUrl": "https://res.cloudinary.com/your-cloud/image/upload/posters/example.jpg",
            "status": "active",
            "tags": ["Pop", "Live Concert"]
          }
        }
      ],
      "meta": {
        "total": 25,
        "page": 1,
        "limit": 10,
        "totalPages": 3
      }
    }
    ```
  - **400 Bad Request:** Query param không hợp lệ (ví dụ `status` không nằm trong enum).
  - **401 Unauthorized:** Token không hợp lệ hoặc hết hạn.

---

### 3. Lấy chi tiết đơn đặt vé (`GET /bookings/:id`)

Truy vấn thông tin chi tiết của một đơn đặt vé bằng ID đơn hàng. API này thường được client gọi lặp lại định kỳ (polling) sau khi nhận mã `202 Accepted` từ API đặt vé, cho đến khi trạng thái đơn hàng chuyển sang `pending` (đã ghi DB thành công và chờ thanh toán) hoặc bị hủy/lỗi.

- **Headers:**
  - `Authorization: Bearer <accessToken>`

- **Parameters:**
  - `id` (string, UUID, required): ID của đơn đặt vé cần lấy thông tin.

- **Responses:**
  - **200 OK:** Lấy thông tin thành công.
    ```json
    {
      "id": "019ead55-0ef1-738d-8616-b6f877b269c8",
      "userId": "019ead55-0ef1-738d-8616-b6f877b26999",
      "concertId": "019ead55-0ef1-738d-8616-b6f877b26aa1",
      "status": "pending",
      "totalAmount": 11000000.00,
      "idempotencyKey": "some-idempotency-key",
      "createdAt": "2026-06-23T15:10:00.000Z",
      "tickets": [
        {
          "id": "019ead55-0ef1-738d-8616-b6f877b26bb2",
          "orderId": "019ead55-0ef1-738d-8616-b6f877b269c8",
          "ticketTypeId": "019ead55-0ef1-738d-8616-b6f877b26cc3",
          "qrCode": null,
          "status": "reserved",
          "ticketType": {
            "id": "019ead55-0ef1-738d-8616-b6f877b26cc3",
            "name": "SVIP",
            "price": 5500000,
            "totalQuantity": 100,
            "maxPerUser": 2,
            "saleStartTime": "2026-06-15T09:00:00.000Z",
            "saleEndTime": "2026-07-10T18:00:00.000Z"
          }
        }
      ],
      "concert": {
        "id": "019ead55-0ef1-738d-8616-b6f877b26aa1",
        "title": "The Eras Tour - HCMC",
        "description": "Trải nghiệm concert đỉnh cao cùng Taylor Swift",
        "location": "Sân vận động Quân khu 7, TP. Hồ Chí Minh",
        "posterUrl": "https://res.cloudinary.com/your-cloud-name/image/upload/v1234567890/posters/example.jpg",
        "posterPublicId": "ticketbox/posters/example",
        "biography": "Đêm nhạc hoành tráng tái hiện các kỷ nguyên âm nhạc độc đáo.",
        "tags": ["Pop", "Live Concert"],
        "svgStageMap": "<svg>...</svg>",
        "startTime": "2026-07-20T19:00:00.000Z",
        "endTime": "2026-07-20T23:00:00.000Z",
        "createdAt": "2026-06-23T15:00:00.000Z",
        "updatedAt": "2026-06-23T15:00:00.000Z"
      }
    }
    ```
    - Trạng thái `status` của đơn đặt vé (`Order`) gồm:
      - `pending`: Đơn hàng được tạo thành công trên DB, đang giữ vé trong thời gian chờ thanh toán (mặc định tối đa 10 phút).
      - `paid`: Đơn đặt vé đã thanh toán thành công qua cổng thanh toán ngoại vi.
      - `expired`: Đơn hàng đã hết thời gian thanh toán (10 phút) và đã tự động giải phóng vé (rollback inventory về Redis/DB).
      - `cancelled`: Đơn hàng bị hủy thủ công hoặc do lỗi giao dịch.
    - Trạng thái `status` của từng vé (`Ticket`) gồm:
      - `reserved`: Vé đang được tạm giữ (khi Order ở dạng `pending`).
      - `active`: Vé hoạt động chính thức sau khi thanh toán thành công (khi đó trường `qrCode` sẽ chứa thông tin mã QR để quét vé).
      - `used`: Vé đã được quét sử dụng tại cổng sự kiện.
  - **401 Unauthorized:** Token không hợp lệ hoặc hết hạn.
  - **404 Not Found:** Không tìm thấy đơn hàng, hoặc đơn hàng đó không thuộc sở hữu của người dùng gửi yêu cầu.
    ```json
    {
      "message": "Booking with ID 019ead55-0ef1-738d-8616-b6f877b269c8 not found",
      "error": "Not Found",
      "statusCode": 404
    }
    ```
