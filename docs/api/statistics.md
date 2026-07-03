# Statistics API Specification

Tài liệu đặc tả chi tiết các API endpoints thuộc module Thống kê (Statistics) của TicketBox.

## Tổng quan

- **Base URL:** `http://localhost:3000/api/v1`
- **Định dạng dữ liệu:** `application/json`
- **Cơ chế xác thực:** Yêu cầu đăng nhập (`Bearer Token`) và phải có role là `organizer`.
- **Caching:** Các API được thiết lập cache bằng Redis với TTL (Time-To-Live) mặc định là 30 giây để giảm tải cho database khi admin xem trang dashboard.

### Danh sách API Endpoints

| HTTP Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/statistics/overview` | Bearer Token (Organizer) | Lấy số liệu thống kê tổng quan toàn hệ thống |
| **GET** | `/statistics/revenue` | Bearer Token (Organizer) | Lấy dữ liệu biểu đồ doanh thu theo thời gian |
| **GET** | `/statistics/concerts/:id` | Bearer Token (Organizer) | Lấy thống kê chi tiết cho một concert cụ thể |
| **GET** | `/statistics/concerts/:id/revenue` | Bearer Token (Organizer) | Lấy dữ liệu biểu đồ doanh thu của một concert |

---

## Chi tiết API Endpoints

### 1. Thống kê tổng quan (`GET /statistics/overview`)

Trả về các số liệu tổng quát của toàn bộ hệ thống bao gồm: tổng số lượng concert, đơn hàng, tổng doanh thu, số lượng vé đã phát hành/bán và lượng check-in.

- **Headers:**
  - `Authorization: Bearer <accessToken>` (Role: organizer)

- **Responses:**
  - **200 OK:**
    ```json
    {
      "concerts": {
        "total": 15,
        "active": 5,
        "draft": 8,
        "cancelled": 2
      },
      "orders": {
        "total": 1250,
        "paid": 980,
        "pending": 50,
        "expired": 200,
        "cancelled": 20
      },
      "revenue": {
        "totalRevenue": 2450000000,
        "averageOrderValue": 2500000
      },
      "tickets": {
        "totalIssued": 15000,
        "totalSold": 12000,
        "fillRate": 80.0
      },
      "checkins": {
        "totalCheckins": 9500,
        "checkinRate": 79.16
      }
    }
    ```
  - **401 Unauthorized:** Không có token hoặc token không hợp lệ.
  - **403 Forbidden:** Tài khoản không có quyền truy cập (không phải organizer).

---

### 2. Biểu đồ doanh thu hệ thống (`GET /statistics/revenue`)

Lấy mảng dữ liệu doanh thu và số lượng đơn hàng theo thời gian để vẽ biểu đồ line/bar.

- **Headers:**
  - `Authorization: Bearer <accessToken>` (Role: organizer)

- **Query Parameters:**
  - `period` (string, optional): Đơn vị gom nhóm dữ liệu. Chấp nhận các giá trị: `day` (mặc định), `week`, `month`.
  - `from` (string/ISO-Date, optional): Lấy dữ liệu từ ngày nào. Mặc định là 30 ngày trước.
  - `to` (string/ISO-Date, optional): Lấy dữ liệu đến ngày nào. Mặc định là thời điểm hiện tại.

- **Responses:**
  - **200 OK:**
    ```json
    {
      "period": "day",
      "from": "2026-06-03T00:00:00.000Z",
      "to": "2026-07-03T00:00:00.000Z",
      "data": [
        {
          "date": "2026-06-15T00:00:00.000Z",
          "revenue": 150000000,
          "orderCount": 45
        },
        {
          "date": "2026-06-16T00:00:00.000Z",
          "revenue": 210000000,
          "orderCount": 62
        }
      ]
    }
    ```

---

### 3. Chi tiết thống kê 1 Concert (`GET /statistics/concerts/:id`)

Trả về thống kê chi tiết của một concert bao gồm doanh thu tổng, phân bố số lượng và doanh thu theo từng hạng vé, cũng như chi tiết check-in của vé thường và vé VIP.

- **Headers:**
  - `Authorization: Bearer <accessToken>` (Role: organizer)

- **Path Parameters:**
  - `id` (string, UUID, required): ID của concert.

- **Responses:**
  - **200 OK:**
    ```json
    {
      "concert": {
        "id": "fbcc9845-fe9b-40d2-8854-d335a6b37418",
        "title": "Concert Mùa Hè 2026",
        "status": "active",
        "startTime": "2026-08-15T19:00:00Z"
      },
      "revenue": {
        "totalRevenue": 850000000,
        "paidOrderCount": 420
      },
      "ticketTypes": [
        {
          "name": "VVIP",
          "price": 5000000,
          "totalQuantity": 100,
          "availableQuantity": 10,
          "soldQuantity": 90,
          "revenue": 450000000
        },
        {
          "name": "VIP",
          "price": 2000000,
          "totalQuantity": 300,
          "availableQuantity": 100,
          "soldQuantity": 200,
          "revenue": 400000000
        }
      ],
      "checkins": {
        "ticketCheckins": 250,
        "vipGuestCheckins": 15,
        "totalCheckins": 265
      }
    }
    ```
  - **404 Not Found:** Không tìm thấy concert với ID đã cho.

---

### 4. Biểu đồ doanh thu 1 Concert (`GET /statistics/concerts/:id/revenue`)

Hoạt động tương tự như `/statistics/revenue` nhưng dữ liệu được giới hạn cho một concert cụ thể.

- **Headers:**
  - `Authorization: Bearer <accessToken>` (Role: organizer)

- **Path Parameters:**
  - `id` (string, UUID, required): ID của concert.

- **Query Parameters:**
  - `period` (string, optional): `day`, `week`, `month`. Mặc định: `day`.
  - `from` (string/ISO-Date, optional): Ngày bắt đầu.
  - `to` (string/ISO-Date, optional): Ngày kết thúc.

- **Responses:**
  - **200 OK:**
    ```json
    {
      "concertId": "fbcc9845-fe9b-40d2-8854-d335a6b37418",
      "period": "day",
      "from": "2026-06-03T00:00:00.000Z",
      "to": "2026-07-03T00:00:00.000Z",
      "data": [
        {
          "date": "2026-06-15T00:00:00.000Z",
          "revenue": 40000000,
          "orderCount": 12
        }
      ]
    }
    ```
  - **404 Not Found:** Không tìm thấy concert với ID đã cho.
