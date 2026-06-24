# Payment API Specification

Tài liệu đặc tả chi tiết các API endpoints thuộc module Thanh toán (Payment) của TicketBox, tích hợp các cổng thanh toán ngoại vi (MoMo Sandbox, VNPAY Sandbox) và cơ chế tự ngắt mạch bảo vệ (Circuit Breaker).

## Tổng quan

- **Base URL:** `http://localhost:3000/api/v1` (môi trường Local Development)
- **Định dạng dữ liệu:** `application/json` cho tất cả các Request và Response.
- **Cơ chế xác thực:** Sử dụng JWT (JSON Web Tokens). Access Token được truyền qua HTTP Header `Authorization: Bearer <token>`.
- **Bảo vệ mạch (Circuit Breaker):** Sử dụng thư viện `opossum` để theo dõi và tự động ngắt kết nối tới các cổng thanh toán (chuyển trạng thái mạch sang `OPEN`) nếu tỷ lệ lỗi vượt ngưỡng thiết lập. Khi mạch `OPEN`, hệ thống sẽ trả về mã lỗi `503 Service Unavailable` ngay lập tức mà không gọi tới gateway để bảo vệ hệ thống và hướng người dùng sang phương thức khác.

### Danh sách API Endpoints

| HTTP Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/payments/momo` | Bearer Token | Khởi tạo link thanh toán qua MoMo Sandbox |
| **POST** | `/payments/vnpay` | Bearer Token | Khởi tạo link thanh toán qua VNPAY Sandbox |
| **POST/GET** | `/payments/momo/webhook` | Public | Webhook IPN xử lý kết quả thanh toán tự động từ MoMo |
| **POST/GET** | `/payments/vnpay/webhook` | Public | Webhook IPN xử lý kết quả thanh toán tự động từ VNPAY |
| **GET** | `/payments/:orderId` | Bearer Token | Lấy chi tiết lịch sử giao dịch và trạng thái thanh toán của đơn hàng |
| **GET** | `/payments/circuit-breaker/status` | Bearer Token | Trả về trạng thái Circuit Breaker của từng cổng thanh toán |

---

## Chi tiết API Endpoints

### 1. Khởi tạo thanh toán MoMo (`POST /payments/momo`)

Khởi tạo phiên giao dịch thanh toán cho đơn hàng ở trạng thái `pending` qua MoMo Sandbox. 
API này sẽ:
1. Xác thực đơn hàng thuộc về người dùng hiện tại và đang ở trạng thái `pending`.
2. Tạo một bản ghi giao dịch `Payment` mới với trạng thái `pending`.
3. Gọi tới MoMo Sandbox API để tạo URL thanh toán thông qua Circuit Breaker bảo vệ.
4. Trả về thông tin link thanh toán (`payUrl`), deeplink (dùng trên mobile) và qrCodeUrl.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `idempotency-key` (string, required): Khóa chống trùng lặp gửi yêu cầu giao dịch liên tiếp.

- **Request Body:**
  ```json
  {
    "orderId": "019ead55-0ef1-738d-8616-b6f877b269c8",
    "orderInfo": "Thanh toán vé concert - Đơn hàng 019ead55-0ef1-738d-8616-b6f877b269c8"
  }
  ```
  - `orderId` (string, UUID, required): ID đơn hàng cần thanh toán.
  - `orderInfo` (string, optional): Thông tin hiển thị nội dung giao dịch trên MoMo. Mặc định hệ thống tự sinh nếu bỏ trống.

- **Responses:**
  - **200 OK:** Khởi tạo liên kết thanh toán MoMo thành công.
    ```json
    {
      "payUrl": "https://test-payment.momo.vn/v2/gateway/redirect?token=F8BBA842ECF85...",
      "deeplink": "momo://?action=payWithMethod&...",
      "qrCodeUrl": "https://test-payment.momo.vn/v2/gateway/qr?token=F8BBA842ECF85...",
      "paymentId": "019ead55-0ef1-738d-8616-b6f877b26dd4"
    }
    ```
  - **400 Bad Request:** Đơn hàng không ở trạng thái `pending` (ví dụ: đã thanh toán thành công hoặc đã hết hạn giải phóng vé).
    ```json
    {
      "message": "Order 019ead55-0ef1-738d-8616-b6f877b269c8 is not in PENDING state (current: expired)",
      "error": "Bad Request",
      "statusCode": 400
    }
    ```
  - **401 Unauthorized:** Token xác thực không hợp lệ hoặc thiếu.
  - **404 Not Found:** Không tìm thấy đơn hàng tương ứng với ID cung cấp hoặc đơn hàng không thuộc sở hữu của tài khoản gửi request.
    ```json
    {
      "message": "Order 019ead55-0ef1-738d-8616-b6f877b269c8 not found",
      "error": "Not Found",
      "statusCode": 404
    }
    ```
  - **429 Too Many Requests:** Quá giới hạn tần suất yêu cầu (Rate limit: tối đa 10 requests trong 10 giây đối với endpoint MoMo).
  - **503 Service Unavailable:** Khi cổng thanh toán MoMo gặp sự cố liên tiếp và Circuit Breaker tự ngắt mạch (`OPEN`).
    ```json
    {
      "message": "Cổng thanh toán MoMo hiện đang bảo trì. Vui lòng chọn phương thức khác (VNPAY) hoặc thử lại sau.",
      "error": "Service Unavailable",
      "statusCode": 503
    }
    ```

---

### 2. Khởi tạo thanh toán VNPAY (`POST /payments/vnpay`)

Khởi tạo liên kết thanh toán qua VNPAY Sandbox tương tự như MoMo.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `idempotency-key` (string, required): Khóa chống trùng lặp.

- **Request Body:**
  ```json
  {
    "orderId": "019ead55-0ef1-738d-8616-b6f877b269c8",
    "orderInfo": "Thanh toán vé concert - Đơn hàng 019ead55-0ef1-738d-8616-b6f877b269c8"
  }
  ```
  - `orderId` (string, UUID, required): ID đơn hàng cần thanh toán.
  - `orderInfo` (string, optional): Nội dung thanh toán hiển thị trên VNPAY.

- **Responses:**
  - **200 OK:** Khởi tạo liên kết thanh toán VNPAY thành công.
    ```json
    {
      "payUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=1100000000&...",
      "paymentId": "019ead55-0ef1-738d-8616-b6f877b26dd4"
    }
    ```
  - **400 Bad Request / 401 Unauthorized / 404 Not Found / 429 Too Many Requests (tối đa 3 requests/10 giây)** giống MoMo.
  - **503 Service Unavailable:** Khi Circuit Breaker của VNPAY ở trạng thái `OPEN`.
    ```json
    {
      "message": "Cổng thanh toán VNPAY hiện đang bảo trì. Vui lòng chọn phương thức khác (MoMo) hoặc thử lại sau.",
      "error": "Service Unavailable",
      "statusCode": 503
    }
    ```

---

### 3. Webhook IPN xử lý giao dịch MoMo (`POST/GET /payments/momo/webhook`)

Webhook IPN (Instant Payment Notification) tự động được MoMo Server gọi về để cập nhật kết quả giao dịch của khách hàng. Endpoint này công khai và bảo mật bằng việc tính toán và đối sánh chữ ký HMAC SHA256 được đính kèm trong payload.

- **Auth:** Public (Không yêu cầu JWT token).

- **Payload nhận từ MoMo (nhận cả ở Body và Query parameters):**
  ```json
  {
    "partnerCode": "MOMO",
    "orderId": "019ead55-0ef1-738d-8616-b6f877b269c8",
    "requestId": "019ead55-0ef1-738d-8616-b6f877b269c8-1718885474712",
    "amount": 11000000,
    "orderInfo": "Thanh toán vé concert - Đơn hàng 019ead55-0ef1-738d-8616-b6f877b269c8",
    "orderType": "momo_wallet",
    "transId": 2345678901,
    "resultCode": 0,
    "message": "Successful.",
    "payType": "qr",
    "responseTime": 1718885500000,
    "extraData": "",
    "signature": "3c825ad87..."
  }
  ```
  - `resultCode` (number): Mã kết quả từ MoMo. `0` đại diện cho thanh toán thành công, các mã khác là thất bại.
  - `signature` (string): Chữ ký bảo mật sinh từ secretKey của MoMo nhằm xác thực tính toàn vẹn và nguồn gốc của dữ liệu.

- **Xử lý phía Server:**
  - Nếu xác thực chữ ký thất bại: Trả về `{ "message": "invalid signature" }`.
  - Nếu xác thực thành công và `resultCode === 0`:
    1. Cập nhật bản ghi `Payment` tương ứng sang `success`, ghi nhận `transactionId` từ MoMo.
    2. Cập nhật trạng thái `Order` sang `paid` trong database.
    3. Đánh dấu trạng thái key thanh toán trên Redis thành `success`.
    4. Đẩy tin nhắn xác nhận thanh toán thành công vào RabbitMQ queue `payment_success`. Một worker khác sẽ tiêu thụ tin nhắn này để chuyển đổi các Ticket thuộc đơn hàng sang `active` và sinh mã QR code gửi qua email/in-app cho khán giả.
  - Nếu `resultCode !== 0`:
    1. Cập nhật bản ghi `Payment` tương ứng sang `failed`.
    2. Cập nhật `Order` sang `cancelled` hoặc giải phóng chỗ ngay lập tức tùy kịch bản.

- **Responses:**
  - **200 OK:**
    ```json
    {
      "message": "received"
    }
    ```
    hoặc khi xác thực chữ ký sai:
    ```json
    {
      "message": "invalid signature"
    }
    ```

---

### 4. Webhook IPN xử lý giao dịch VNPAY (`POST/GET /payments/vnpay/webhook`)

Webhook IPN tương tự dành cho cổng VNPAY. Điểm khác biệt là VNPAY yêu cầu phản hồi theo định dạng JSON đặc tả riêng của VNPAY để xác nhận hoàn tất IPN.

- **Auth:** Public.

- **Payload nhận từ VNPAY (nhận cả ở Body và Query parameters):**
  ```json
  {
    "vnp_Amount": "1100000000",
    "vnp_BankCode": "NCB",
    "vnp_BankTranNo": "VNP20260623223040",
    "vnp_CardType": "ATM",
    "vnp_OrderInfo": "Thanh toán vé concert - Đơn hàng 019ead55-0ef1-738d-8616-b6f877b269c8",
    "vnp_PayDate": "20260623223000",
    "vnp_ResponseCode": "00",
    "vnp_TmnCode": "VNPAY_TMN_CODE",
    "vnp_TransactionNo": "12345678",
    "vnp_TransactionStatus": "00",
    "vnp_TxnRef": "019ead55-0ef1-738d-8616-b6f877b269c8",
    "vnp_SecureHash": "5a4d3f8e9..."
  }
  ```
  - `vnp_ResponseCode` (string): Mã phản hồi kết quả giao dịch. `'00'` đại diện cho giao dịch thành công.
  - `vnp_Amount`: Số tiền thanh toán nhân 100 (Ví dụ: `1100000000` = 11.000.000 VND).

- **Responses (Đúng định dạng VNPAY quy định):**
  - **200 OK (Thành công):**
    ```json
    {
      "RspCode": "00",
      "Message": "Confirm Success"
    }
    ```
  - **200 OK (Chữ ký không hợp lệ):**
    ```json
    {
      "RspCode": "97",
      "Message": "Invalid signature"
    }
    ```
  - **200 OK (Không tìm thấy đơn hàng):**
    ```json
    {
      "RspCode": "01",
      "Message": "Order not found"
    }
    ```
  - **200 OK (Sai số tiền giao dịch):**
    ```json
    {
      "RspCode": "04",
      "Message": "Amount mismatch"
    }
    ```

---

### 5. Lấy trạng thái thanh toán đơn hàng (`GET /payments/:orderId`)

Cho phép khách hàng truy vấn lịch sử và trạng thái thanh toán hiện tại của một đơn hàng cụ thể.

- **Headers:**
  - `Authorization: Bearer <accessToken>`

- **Parameters:**
  - `orderId` (string, UUID, required): ID của đơn hàng cần tra cứu.

- **Responses:**
  - **200 OK:** Lấy thông tin thành công.
    ```json
    {
      "orderId": "019ead55-0ef1-738d-8616-b6f877b269c8",
      "orderStatus": "paid",
      "payments": [
        {
          "id": "019ead55-0ef1-738d-8616-b6f877b26dd4",
          "gateway": "momo",
          "status": "success",
          "transactionId": "2345678901",
          "amount": 11000000.00,
          "payUrl": "https://test-payment.momo.vn/v2/gateway/redirect?token=F8BBA842ECF85...",
          "createdAt": "2026-06-23T15:15:00.000Z"
        }
      ]
    }
    ```
  - **401 Unauthorized:** Token xác thực hết hạn hoặc không hợp lệ.
  - **404 Not Found:** Đơn hàng không tồn tại hoặc không có quyền truy cập.

---

### 6. Lấy trạng thái Circuit Breaker (`GET /payments/circuit-breaker/status`)

Trả về trạng thái hiện tại (bật/tắt mạch) của các cổng thanh toán. Đây là API giám sát hệ thống (Monitoring).

- **Headers:**
  - `Authorization: Bearer <accessToken>`

- **Responses:**
  - **200 OK:** Trả về trạng thái của các bộ ngắt mạch.
    ```json
    {
      "momo": "CLOSED",
      "vnpay": "CLOSED"
    }
    ```
    - Trạng thái nhận được bao gồm:
      - `CLOSED`: Hoạt động bình thường. Mọi request được chuyển tiếp đến cổng thanh toán.
      - `OPEN`: Đã ngắt mạch. Mọi request gọi đến cổng đó sẽ lập tức bị từ chối bằng lỗi 503 để bảo vệ hệ thống.
      - `HALF-OPEN`: Đang thăm dò để khôi phục. Cho phép thử một vài request đi qua để kiểm tra xem hệ thống cổng thanh toán đã ổn định trở lại chưa.
