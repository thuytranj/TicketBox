# Concert & Ticket Type API Specification

Tài liệu đặc tả chi tiết các API endpoints thuộc module Quản lý Hòa nhạc (Concerts) và Hạng vé (Ticket Types) của TicketBox.

## Tổng quan

- **Base URL:** `http://localhost:3000/api/v1` (môi trường Local Development)
- **Định dạng dữ liệu:** `application/json` cho tất cả các Request và Response.
- **Cơ chế xác thực:** Sử dụng JWT (JSON Web Tokens). Access Token được truyền qua HTTP Header `Authorization: Bearer <token>`.
- **Phân quyền:** Các API có ký hiệu `Bearer Token (Organizer)` yêu cầu người dùng phải đăng nhập với vai trò `organizer`. Các API khác được công khai (`Public`).

### Danh sách API Endpoints

#### 1. Quản lý Hòa nhạc (Concerts)

| HTTP Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/concerts` | Bearer Token (Organizer) | Tạo mới concert (chấp nhận mảng `ticketTypes` đi kèm) |
| **POST** | `/concerts/upload-poster` | Bearer Token (Organizer) | Tải lên ảnh poster cho concert (lưu trữ trên Cloudinary) |
| **GET** | `/concerts` | Public | Lấy danh sách concert (hỗ trợ tìm kiếm, lọc địa điểm, tag, status, phân trang) |
| **GET** | `/concerts/:id` | Public | Lấy thông tin chi tiết concert (loại trừ `svgStageMap` và `ticketTypes`, lưu Redis cache) |
| **GET** | `/concerts/:id/ticket-types` | Public | Lấy danh sách loại vé của concert kèm số lượng khả dụng real-time (Hybrid Caching) |
| **GET** | `/concerts/:id/stagemap` | Public | Lấy sơ đồ sân khấu SVG của concert (lưu Redis cache riêng biệt) |
| **PATCH** | `/concerts/:id` | Bearer Token (Organizer) | Cập nhật thông tin concert hoặc thay đổi trạng thái (hủy bỏ) |
| **DELETE** | `/concerts/:id` | Bearer Token (Organizer) | Xóa vật lý concert (chỉ cho phép khi chưa có lượt đặt vé) |
| **POST** | `/concerts/:id/artist-bio` | Bearer Token (Organizer) | Tải lên PDF để trích xuất văn bản và sinh tiểu sử nghệ sĩ bằng AI |
| **POST** | `/concerts/:id/artist-bio/regenerate` | Bearer Token (Organizer) | Yêu cầu tạo lại bản nháp tiểu sử nghệ sĩ bằng AI từ văn bản thô |
| **GET** | `/concerts/:id/artist-bio` | Bearer Token (Organizer) | Lấy trạng thái tiến trình và bản nháp tiểu sử nghệ sĩ bằng AI |
| **PUT** | `/concerts/:id/artist-bio/confirm` | Bearer Token (Organizer) | Phê duyệt và cập nhật chính thức tiểu sử nghệ sĩ vào concert |
| **POST** | `/concerts/:id/guests/import` | Bearer Token (Organizer) | Tải lên tệp CSV chứa danh sách khách mời VIP để xử lý bất đồng bộ |
| **GET** | `/concerts/:id/guests/imports/:jobId` | Bearer Token (Organizer) | Lấy trạng thái tiến trình và nhật ký lỗi của Job import VIP |

#### 2. Quản lý Loại vé (Ticket Types)

| HTTP Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/concerts/:concertId/ticket-types` | Bearer Token (Organizer) | Thêm một loại vé mới cho concert |
| **PATCH** | `/ticket-types/:id` | Bearer Token (Organizer) | Cập nhật giá vé, số lượng, hoặc thời gian bán vé của một loại vé |
| **DELETE** | `/ticket-types/:id` | Bearer Token (Organizer) | Xóa một loại vé (chỉ cho phép khi loại vé này chưa có lượt đặt) |

---

## Chi tiết API Endpoints - Concerts

### 1. Tạo mới concert (`POST /concerts`)

Tạo mới một sự kiện hòa nhạc. Hỗ trợ tạo đồng thời các hạng vé đi kèm thông qua cơ chế Cascade Save.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
- **Request Body:**
  ```json
  {
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
    "ticketTypes": [
      {
        "name": "SVIP",
        "price": 5500000,
        "totalQuantity": 100,
        "maxPerUser": 2,
        "saleStartTime": "2026-06-15T09:00:00.000Z",
        "saleEndTime": "2026-07-10T18:00:00.000Z"
      },
      {
        "name": "GA",
        "price": 1500000,
        "totalQuantity": 1000,
        "maxPerUser": 4
      }
    ]
  }
  ```
  - `title` (string, required): Tiêu đề sự kiện, tối đa 255 ký tự.
  - `description` (string, required): Mô tả chi tiết về sự kiện.
  - `location` (string, required): Địa điểm tổ chức.
  - `posterUrl` (string, optional): Đường dẫn ảnh poster (nhận được sau khi tải ảnh lên Cloudinary).
  - `posterPublicId` (string, optional): Mã định danh ảnh trên Cloudinary (dùng để xóa/dọn dẹp ảnh cũ).
  - `biography` (string, optional): Tiểu sử nghệ sĩ hoặc thông tin giới thiệu sự kiện.
  - `tags` (string[], optional): Danh sách nhãn tag phân loại.
  - `svgStageMap` (string, optional): Bản đồ sơ đồ ghế ngồi dạng SVG (Frontend đọc file bằng `FileReader` rồi gửi chuỗi XML/SVG).
  - `startTime` (ISO string, required): Thời gian bắt đầu sự kiện.
  - `endTime` (ISO string, required): Thời gian kết thúc sự kiện (phải sau `startTime`).
  - `ticketTypes` (array, optional): Danh sách hạng vé khởi tạo cùng. Mỗi hạng vé gồm:
    - `name` (enum, required): Chỉ chấp nhận `'GA' | 'SVIP' | 'VIP' | 'CAT1' | 'CAT2'`.
    - `price` (number, required): Giá vé (phải >= 0).
    - `totalQuantity` (number, required): Tổng số lượng vé phát hành (phải > 0).
    - `maxPerUser` (number, optional): Số vé tối đa mỗi user được mua (mặc định 4, phải > 0).
    - `saleStartTime` (ISO string, optional): Thời điểm bắt đầu bán vé (phải trước `concert.endTime`).
    - `saleEndTime` (ISO string, optional): Thời điểm kết thúc bán vé (phải sau `saleStartTime`).

- **Responses:**
  - **201 Created:** Tạo thành công concert cùng các loại vé đi kèm.
    ```json
    {
      "id": "019ec180-4917-74d1-b1bd-ef0e98bed9e0",
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
      "status": "draft",
      "reminderSent": false,
      "createdAt": "2026-06-13T15:00:00.000Z",
      "ticketTypes": [
        {
          "id": "019ec180-4917-7348-a9dc-7f8fbbc8a0e6",
          "concertId": "019ec180-4917-74d1-b1bd-ef0e98bed9e0",
          "name": "SVIP",
          "price": 5500000,
          "totalQuantity": 100,
          "availableQuantity": 100,
          "maxPerUser": 2,
          "saleStartTime": "2026-06-15T09:00:00.000Z",
          "saleEndTime": "2026-07-10T18:00:00.000Z"
        },
        {
          "id": "019ec180-4917-7fba-8f15-a89a2ddd7ab7",
          "concertId": "019ec180-4917-74d1-b1bd-ef0e98bed9e0",
          "name": "GA",
          "price": 1500000,
          "totalQuantity": 1000,
          "availableQuantity": 1000,
          "maxPerUser": 4,
          "saleStartTime": null,
          "saleEndTime": null
        }
      ]
    }
    ```
  - **400 Bad Request:** Lỗi nghiệp vụ hoặc định dạng dữ liệu (ví dụ: trùng tên hạng vé trong cùng concert, `endTime <= startTime`, hoặc ràng buộc thời gian mở bán vé không hợp lệ).
    ```json
    {
      "message": "Ticket sale end time must be after sale start time",
      "error": "Bad Request",
      "statusCode": 400
    }
    ```
  - **401 Unauthorized:** Token không hợp lệ hoặc thiếu.
  - **403 Forbidden:** Tài khoản không có vai trò `organizer`.

---

### 2. Tải lên ảnh poster (`POST /concerts/upload-poster`)

Tải lên tệp ảnh poster của concert lên dịch vụ lưu trữ đám mây Cloudinary.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: multipart/form-data`
- **Request Body (Multipart Form Data):**
  - `file` (File, required): Tệp ảnh poster cần tải lên.
    - **Định dạng cho phép:** `.jpg`, `.jpeg`, `.png`, `.webp`
    - **Dung lượng tối đa:** 10MB
- **Responses:**
  - **201 Created:** Tải lên thành công và trả về URL ảnh kèm Public ID trên Cloudinary.
    ```json
    {
      "url": "https://res.cloudinary.com/your-cloud-name/image/upload/v1234567890/posters/example.jpg",
      "publicId": "ticketbox/posters/example"
    }
    ```
  - **400 Bad Request:**
    - Khi không có tệp nào được tải lên:
      ```json
      {
        "message": "No file uploaded",
        "error": "Bad Request",
        "statusCode": 400
      }
      ```
    - Khi tệp không đúng định dạng hình ảnh cho phép:
      ```json
      {
        "message": "Only image files (jpg, jpeg, png, webp) are allowed!",
        "error": "Bad Request",
        "statusCode": 400
      }
      ```
    - Khi dung lượng tệp vượt quá giới hạn 10MB:
      ```json
      {
        "message": "File too large",
        "error": "Payload Too Large",
        "statusCode": 400
      }
      ```
  - **401 Unauthorized:** Token không hợp lệ hoặc thiếu.
  - **403 Forbidden:** Tài khoản không có vai trò `organizer`.

---


### 3. Lấy danh sách concert (`GET /concerts`)

Tìm kiếm và lọc danh sách sự kiện hòa nhạc có phân trang.
* **Lọc mặc định:** Chỉ trả về các concert ở trạng thái `active`.
* **Tối ưu hiệu năng:** Trường `svgStageMap` sẽ bị loại trừ khỏi danh sách trả về.
* **Cơ chế Cache-aside:** 
  - Với yêu cầu mặc định (chỉ chứa phân trang `page` và `limit`, không có `search`, `location`, `tag`), hệ thống sẽ đọc và ghi bộ nhớ đệm Redis dưới khóa `cache:concerts:list:default:page:{page}:limit:{limit}` (TTL 10 phút).
  - Với yêu cầu chứa bộ lọc động, hệ thống sẽ truy vấn trực tiếp PostgreSQL.

- **Query Parameters:**
  - `search` (string, optional): Tìm kiếm tương đối (`ILIKE`) theo `title` hoặc `description`.
  - `location` (string, optional): Lọc chính xác theo địa điểm.
  - `tag` (string, optional): Lọc các concert có chứa tag được chọn.
  - `status` (string, optional): Lọc theo trạng thái (`active`, `draft`, `cancelled`). Mặc định là `active` đối với người dùng thông thường.
  - `page` (number, optional): Số thứ tự trang muốn lấy, bắt đầu từ 1. Mặc định là 1.
  - `limit` (number, optional): Số phần tử tối đa trên mỗi trang (từ 1 đến 100). Mặc định là 10.

- **Responses:**
  - **200 OK:** Dữ liệu phân trang khớp với bộ lọc (được sắp xếp theo thời gian bắt đầu tăng dần).
    ```json
    {
      "concerts": [
        {
          "id": "019ec180-4917-74d1-b1bd-ef0e98bed9e0",
          "title": "The Eras Tour - HCMC",
          "description": "Trải nghiệm concert đỉnh cao cùng Taylor Swift",
          "location": "Sân vận động Quân khu 7, TP. Hồ Chí Minh",
          "posterUrl": "https://example.com/poster.jpg",
          "biography": "Đêm nhạc hoành tráng tái hiện các kỷ nguyên âm nhạc độc đáo.",
          "tags": ["Pop", "Live Concert"],
          "startTime": "2026-07-20T19:00:00.000Z",
          "endTime": "2026-07-20T23:00:00.000Z",
          "status": "active",
          "reminderSent": false,
          "createdAt": "2026-06-13T15:00:00.000Z"
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

---

### 4. Lấy chi tiết concert (`GET /concerts/:id`)

Lấy thông tin chi tiết một concert.
* **Tối ưu hiệu năng:** Kết quả trả về không bao gồm danh sách loại vé `ticketTypes` và sơ đồ sân khấu lớn `svgStageMap` để tiết kiệm băng thông và tài nguyên.
* **Cơ chế Cache-aside:** API sẽ đọc dữ liệu từ Redis cache trước. Nếu cache miss, dữ liệu sẽ được đọc từ PostgreSQL và ghi vào Redis (khóa `cache:concerts:{id}`) với thời gian sống (TTL) là 10 phút.

- **Parameters:**
  - `id` (uuid, required): ID của concert cần xem.

- **Responses:**
  - **200 OK:** Trả về thông tin chi tiết concert (không có các hạng vé).
    ```json
    {
      "id": "019ec180-4917-74d1-b1bd-ef0e98bed9e0",
      "title": "The Eras Tour - HCMC",
      "description": "Trải nghiệm concert đỉnh cao cùng Taylor Swift",
      "location": "Sân vận động Quân khu 7, TP. Hồ Chí Minh",
      "posterUrl": "https://example.com/poster.jpg",
      "biography": "Đêm nhạc hoành tráng tái hiện các kỷ nguyên âm nhạc độc đáo.",
      "tags": ["Pop", "Live Concert"],
      "startTime": "2026-07-20T19:00:00.000Z",
      "endTime": "2026-07-20T23:00:00.000Z",
      "status": "active",
      "reminderSent": false,
      "createdAt": "2026-06-13T15:00:00.000Z"
    }
    ```
  - **404 Not Found:** Concert không tồn tại trong hệ thống.
    ```json
    {
      "message": "Not found concert with id: 019ec180-4917-74d1-b1bd-ef0e98bed9e9",
      "error": "Not Found",
      "statusCode": 404
    }
    ```

---

### 5. Lấy danh sách loại vé của concert (`GET /concerts/:id/ticket-types`)

Lấy danh sách các hạng vé đang mở bán kèm theo số lượng vé khả dụng được cập nhật thời gian thực.
* **Cơ chế Hybrid Caching:**
  - Đọc cấu hình tĩnh của các hạng vé từ Redis dưới khóa `cache:concerts:{id}:ticket-types` (TTL 10 phút). Nếu cache miss, lấy từ PostgreSQL rồi ghi lại vào cache Redis.
  - Số lượng vé khả dụng (`availableQuantity`) được lấy trực tiếp theo thời gian thực từ các khóa `inventory:{concertId}:{ticketTypeId}` trên Redis bằng lệnh `MGET` nhằm đảm bảo tính chính xác 100% khi khách hàng đặt vé.

- **Parameters:**
  - `id` (uuid, required): ID của concert.

- **Responses:**
  - **200 OK:** Danh sách các loại vé.
    ```json
    [
      {
        "id": "019ec180-4917-7348-a9dc-7f8fbbc8a0e6",
        "concertId": "019ec180-4917-74d1-b1bd-ef0e98bed9e0",
        "name": "SVIP",
        "price": 5500000,
        "totalQuantity": 100,
        "availableQuantity": 42,
        "maxPerUser": 2,
        "saleStartTime": "2026-06-15T09:00:00.000Z",
        "saleEndTime": "2026-07-10T18:00:00.000Z"
      },
      {
        "id": "019ec180-4917-7fba-8f15-a89a2ddd7ab7",
        "concertId": "019ec180-4917-74d1-b1bd-ef0e98bed9e0",
        "name": "GA",
        "price": 1500000,
        "totalQuantity": 1000,
        "availableQuantity": 980,
        "maxPerUser": 4,
        "saleStartTime": null,
        "saleEndTime": null
      }
    ]
    ```
  - **404 Not Found:** Concert không tồn tại trong hệ thống.

---

### 6. Lấy sơ đồ sân khấu SVG (`GET /concerts/:id/stagemap`)

Lấy nội dung SVG của sơ đồ sân khấu/ghế ngồi.
* **Cơ chế Cache-aside:** API sẽ cache nội dung chuỗi SVG thô vào Redis dưới khóa `cache:concerts:{id}:stagemap` với thời gian sống (TTL) là 30 phút.

- **Parameters:**
  - `id` (uuid, required): ID của concert.

- **Responses:**
  - **200 OK:**
    ```json
    {
      "svgStageMap": "<svg viewBox=\"0 0 800 600\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>"
    }
    ```
  - **404 Not Found:** Concert không tồn tại.

---

### 7. Cập nhật thông tin concert (`PATCH /concerts/:id`)

Cập nhật thông tin chi tiết concert hoặc chuyển đổi trạng thái (ví dụ sang `cancelled` hoặc `active`).
* **Cache Invalidation:** Mỗi khi cập nhật thành công, toàn bộ các khóa Redis liên quan bao gồm `cache:concerts:{id}`, `cache:concerts:{id}:stagemap`, `cache:concerts:{id}:ticket-types` và cache danh sách mặc định `cache:concerts:list:default:*` sẽ tự động bị xóa bỏ để đồng bộ dữ liệu mới.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
- **Parameters:**
  - `id` (uuid, required): ID của concert cần cập nhật.
- **Request Body (chấp nhận một hoặc nhiều trường tùy chọn):**
  ```json
  {
    "title": "The Eras Tour - HCMC (Updated Title)",
    "posterUrl": "https://res.cloudinary.com/your-cloud-name/image/upload/v1234567890/posters/new-example.jpg",
    "posterPublicId": "ticketbox/posters/new-example",
    "status": "active"
  }
  ```
  *(Lưu ý: Nếu `posterUrl` hoặc `posterPublicId` được cập nhật thay đổi so với giá trị cũ, hệ thống sẽ tự động gọi API dọn dẹp xóa ảnh cũ trên Cloudinary để tránh rác tài nguyên).*

- **Responses:**
  - **200 OK:** Trả về đối tượng concert sau khi cập nhật thành công.
  - **400 Bad Request:** Dữ liệu cập nhật sai định dạng hoặc thời gian không logic.
  - **404 Not Found:** Không tìm thấy concert.

---

### 8. Xóa concert (`DELETE /concerts/:id`)

Xóa bỏ hoàn toàn concert và các hạng vé liên quan (`cascade delete`).
* **Ràng buộc nghiệp vụ:** Hệ thống kiểm tra xem concert đã phát sinh bất kỳ đơn đặt vé (booking) nào chưa.
  * Nếu chưa có booking: thực hiện xóa ảnh poster cũ trên Cloudinary (nếu có) thông qua `posterPublicId`, thực hiện xóa vật lý trong database, đồng thời thu hồi tất cả các khóa cache liên quan trong Redis.
  * Nếu đã có ít nhất một booking: từ chối xóa và yêu cầu chuyển trạng thái sang `cancelled` để lưu giữ lịch sử.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
- **Parameters:**
  - `id` (uuid, required): ID của concert cần xóa.

- **Responses:**
  - **204 No Content:** Xóa thành công.
  - **400 Bad Request:** Không cho phép xóa vì concert đã phát sinh booking giao dịch mua vé.
    ```json
    {
      "message": "Không thể xóa concert đã có người đặt vé. Vui lòng chuyển trạng thái concert sang Hủy bỏ (cancelled).",
      "error": "Bad Request",
      "statusCode": 400
    }
    ```
  - **404 Not Found:** Concert không tồn tại.

---

### 9. Yêu cầu tạo tiểu sử nghệ sĩ bằng AI (`POST /concerts/:id/artist-bio`)

Tải lên tệp PDF thông tin báo chí (Press Kit) của nghệ sĩ để trích xuất văn bản thô và gửi yêu cầu sinh tóm tắt tiểu sử bằng AI (Gemini) ở chế độ bất đồng bộ.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: multipart/form-data`
- **Parameters:**
  - `id` (uuid, required): ID của concert.
- **Request Body (Multipart Form Data):**
  - `file` (File, required): Tệp PDF của Ban tổ chức.
    - **Định dạng cho phép:** `application/pdf`
    - **Dung lượng tối đa:** 10MB
- **Responses:**
  - **202 Accepted:** Yêu cầu đã nhận và đang được xử lý trong hàng đợi.
    ```json
    {
      "message": "PDF uploaded successfully, bio generation is in progress"
    }
    ```
  - **400 Bad Request:** Thiếu tệp tải lên, tệp không đúng định dạng PDF, hoặc lỗi xử lý tệp.
  - **401 Unauthorized:** Token không hợp lệ hoặc thiếu.
  - **403 Forbidden:** Tài khoản không phải vai trò `organizer`.
  - **404 Not Found:** Concert không tồn tại.

---

### 10. Tạo lại nháp tiểu sử nghệ sĩ bằng AI (`POST /concerts/:id/artist-bio/regenerate`)

Yêu cầu tạo lại bản nháp tóm tắt tiểu sử nghệ sĩ bằng AI từ văn bản thô đã được trích xuất và lưu trong cơ sở dữ liệu trước đó.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
- **Parameters:**
  - `id` (uuid, required): ID của concert.
- **Responses:**
  - **202 Accepted:** Yêu cầu tạo lại đã nhận và đang được xử lý.
    ```json
    {
      "message": "Bio regeneration is in progress"
    }
    ```
  - **400 Bad Request:** Chưa có dữ liệu văn bản thô (cần upload PDF trước).
  - **401 Unauthorized:** Token không hợp lệ hoặc thiếu.
  - **403 Forbidden:** Tài khoản không phải vai trò `organizer`.

---

### 11. Lấy trạng thái và bản nháp tiểu sử bằng AI (`GET /concerts/:id/artist-bio`)

Lấy chi tiết trạng thái tiến trình tạo tiểu sử, bản nháp tiểu sử hoặc lỗi phát sinh nếu có (loại trừ văn bản thô để tối ưu băng thông).

- **Headers:**
  - `Authorization: Bearer <accessToken>`
- **Parameters:**
  - `id` (uuid, required): ID của concert.
- **Responses:**
  - **200 OK:** Trả về chi tiết bản ghi AI Bio.
    ```json
    {
      "concertId": "019ec180-4917-74d1-b1bd-ef0e98bed9e0",
      "draftBio": "Draft biography generated by Gemini API under 300 words.",
      "status": "completed",
      "error": null,
      "updatedAt": "2026-06-16T15:00:00.000Z"
    }
    ```
    - `status` có thể là: `'processing' | 'completed' | 'failed'`.
  - **401 Unauthorized:** Token không hợp lệ hoặc thiếu.
  - **403 Forbidden:** Tài khoản không phải vai trò `organizer`.
  - **404 Not Found:** Không tìm thấy yêu cầu tạo tiểu sử AI cho concert này.

---

### 12. Phê duyệt và cập nhật chính thức tiểu sử (`PUT /concerts/:id/artist-bio/confirm`)

Duyệt hoặc chỉnh sửa bản nháp tóm tắt tiểu sử nghệ sĩ và lưu chính thức vào cột `biography` của bảng `concerts`.
* **Cache Invalidation:** Tự động xóa các khóa Redis cache liên quan: `cache:concerts:{id}`, `cache:concerts:list:default:*`.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
- **Parameters:**
  - `id` (uuid, required): ID của concert.
- **Request Body:**
  ```json
  {
    "biography": "Confirmed biography text for the artist..."
  }
  ```
  - `biography` (string, required): Nội dung tiểu sử nghệ sĩ chính thức.
- **Responses:**
  - **200 OK:** Cập nhật thành công.
    ```json
    {
      "message": "Biography updated successfully"
    }
    ```
  - **400 Bad Request:** Thiếu trường `biography` hoặc định dạng sai.
  - **401 Unauthorized:** Token không hợp lệ hoặc thiếu.
  - **403 Forbidden:** Tài khoản không phải vai trò `organizer`.
  - **404 Not Found:** Concert không tồn tại.

---

### 11. Nhập danh sách khách mời VIP từ CSV (`POST /concerts/:id/guests/import`)

Tải lên một tệp CSV chứa danh sách khách mời VIP cho một concert để hệ thống tiến hành xử lý bất đồng bộ thông qua hàng đợi RabbitMQ.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: multipart/form-data`
- **Parameters:**
  - `id` (uuid, required): ID của concert cần nhập khách mời VIP.
- **Request Body (Multipart Form Data):**
  - `file` (File, required): Tệp CSV danh sách khách mời VIP.
    - **Định dạng cho phép:** `.csv`
    - **Cấu trúc tệp CSV mẫu:**
      ```csv
      full name,email,phone,affiliate_company
      Nguyen Van A,nva@example.com,0901234567,Company A
      Tran Thi B,ttb@example.com,0907654321,Company B
      ```
- **Responses:**
  - **202 Accepted:** Tải lên tệp thành công, đã khởi tạo Job và đẩy vào hàng đợi xử lý nền.
    ```json
    {
      "message": "VIP Guest list import started",
      "jobId": "019ec180-4925-78ba-aa04-e20952174fbe",
      "status": "pending"
    }
    ```
  - **400 Bad Request:**
    - Khi không có tệp nào được tải lên:
      ```json
      {
        "message": "No file uploaded",
        "error": "Bad Request",
        "statusCode": 400
      }
      ```
    - Khi tệp không đúng định dạng `.csv`:
      ```json
      {
        "message": "Only CSV files are allowed!",
        "error": "Bad Request",
        "statusCode": 400
      }
      ```
  - **401 Unauthorized:** Token không hợp lệ hoặc thiếu.
  - **403 Forbidden:** Tài khoản không phải vai trò `organizer`.
  - **404 Not Found:** Concert không tồn tại.

---

### 12. Kiểm tra trạng thái Job import VIP (`GET /concerts/:id/guests/imports/:jobId`)

Lấy thông tin chi tiết về tiến trình xử lý, trạng thái và nhật ký lỗi định dạng của từng dòng trong Job import danh sách VIP.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
- **Parameters:**
  - `id` (uuid, required): ID của concert liên quan.
  - `jobId` (uuid, required): ID của Job import cần tra cứu.
- **Responses:**
  - **200 OK:** Trả về thông tin chi tiết của Job:
    - **Khi Job đang xử lý (`processing`):**
      ```json
      {
        "id": "019ec180-4925-78ba-aa04-e20952174fbe",
        "concertId": "019ec180-4917-74d1-b1bd-ef0e98bed9e0",
        "status": "processing",
        "totalRows": 0,
        "importedRows": 0,
        "errorLogs": null,
        "createdAt": "2026-06-24T11:32:00.000Z",
        "updatedAt": "2026-06-24T11:32:00.000Z"
      }
      ```
    - **Khi Job hoàn thành thành công (`completed`):**
      ```json
      {
        "id": "019ec180-4925-78ba-aa04-e20952174fbe",
        "concertId": "019ec180-4917-74d1-b1bd-ef0e98bed9e0",
        "status": "completed",
        "totalRows": 1500,
        "importedRows": 1500,
        "errorLogs": [],
        "createdAt": "2026-06-24T11:32:00.000Z",
        "updatedAt": "2026-06-24T11:33:15.000Z"
      }
      ```
    - **Khi Job hoàn thành nhưng có một số dòng bị lỗi (Graceful Recovery):**
      *Lưu ý: Các dòng chứa email đã tồn tại sẵn trong cơ sở dữ liệu của concert sẽ được bỏ qua một cách im lặng (silently skipped) nhờ cơ chế `ON CONFLICT DO NOTHING` và KHÔNG được ghi nhận là lỗi trong `errorLogs` để giúp Admin dễ dàng tải lại toàn bộ tệp gốc sau khi đã sửa các dòng lỗi khác.*
      ```json
      {
        "id": "019ec180-4925-78ba-aa04-e20952174fbe",
        "concertId": "019ec180-4917-74d1-b1bd-ef0e98bed9e0",
        "status": "completed",
        "totalRows": 5,
        "importedRows": 3,
        "errorLogs": [
          {
            "row": 3,
            "email": "invalid-email",
            "reason": "email must be an email"
          },
          {
            "row": 5,
            "email": "ttb@example.com",
            "reason": "Duplicate guest email in CSV file"
          }
        ],
        "createdAt": "2026-06-24T11:32:00.000Z",
        "updatedAt": "2026-06-24T11:32:10.000Z"
      }
      ```
    - **Khi Job thất bại hoàn toàn (`failed`):**
      ```json
      {
        "id": "019ec180-4925-78ba-aa04-e20952174fbe",
        "concertId": "019ec180-4917-74d1-b1bd-ef0e98bed9e0",
        "status": "failed",
        "totalRows": 0,
        "importedRows": 0,
        "errorLogs": [
          {
            "row": 0,
            "reason": "Malformed CSV file or header configuration mismatch"
          }
        ],
        "createdAt": "2026-06-24T11:32:00.000Z",
        "updatedAt": "2026-06-24T11:32:02.000Z"
      }
      ```
  - **401 Unauthorized:** Token không hợp lệ hoặc thiếu.
  - **403 Forbidden:** Tài khoản không phải vai trò `organizer`.
  - **404 Not Found:** Không tìm thấy Concert hoặc Job import tương ứng.

---

## Chi tiết API Endpoints - Ticket Types

### 1. Thêm loại vé mới cho concert (`POST /concerts/:concertId/ticket-types`)

Thêm một hạng vé mới cho concert đã tồn tại.
* **Cache Invalidation:** Tự động thu hồi cache tĩnh của hạng vé (`cache:concerts:{concertId}:ticket-types`) và cache danh sách concert mặc định.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
- **Parameters:**
  - `concertId` (uuid, required): ID của concert cần thêm vé.
- **Request Body:**
  ```json
  {
    "name": "VIP",
    "price": 3000000,
    "totalQuantity": 200,
    "maxPerUser": 4,
    "saleStartTime": "2026-06-20T09:00:00.000Z",
    "saleEndTime": "2026-07-15T18:00:00.000Z"
  }
  ```

- **Responses:**
  - **201 Created:** Trả về đối tượng TicketType vừa được tạo.
    ```json
    {
      "id": "019ec180-4925-759a-9204-f2095217427e",
      "concertId": "019ec180-4917-74d1-b1bd-ef0e98bed9e0",
      "name": "VIP",
      "price": 3000000,
      "totalQuantity": 200,
      "availableQuantity": 200,
      "maxPerUser": 4,
      "saleStartTime": "2026-06-20T09:00:00.000Z",
      "saleEndTime": "2026-07-15T18:00:00.000Z"
    }
    ```
  - **400 Bad Request:** Trùng tên hạng vé đã tồn tại trong concert, hoặc cấu hình thời gian mở bán vé sai quy tắc.
  - **404 Not Found:** Concert không tồn tại.

---

### 2. Cập nhật hạng vé (`PATCH /ticket-types/:id`)

Cập nhật thông tin của hạng vé cụ thể (giá, số lượng phát hành, thời gian bán...).
* **Cache Invalidation:** Tự động xác định `concertId` liên kết và thực hiện thu hồi cache hạng vé của concert đó (`cache:concerts:{concertId}:ticket-types`) và cache danh sách concert mặc định.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
- **Parameters:**
  - `id` (uuid, required): ID của TicketType cần cập nhật.
- **Request Body (chấp nhận một hoặc nhiều trường tùy chọn):**
  ```json
  {
    "price": 3200000,
    "totalQuantity": 250
  }
  ```

- **Responses:**
  - **200 OK:** Trả về thông tin hạng vé sau khi cập nhật thành công.
  - **400 Bad Request:** Thời gian mở bán/kết thúc không hợp lệ.
  - **404 Not Found:** Loại vé không tồn tại.

---

### 3. Xóa hạng vé (`DELETE /ticket-types/:id`)

Xóa bỏ một hạng vé khỏi concert.
* **Cache Invalidation:** Tự động thu hồi cache hạng vé của concert đó (`cache:concerts:{concertId}:ticket-types`) và cache danh sách concert mặc định.
* **Ràng buộc nghiệp vụ:** Chỉ được xóa hạng vé chưa phát sinh đơn đặt vé nào.

- **Headers:**
  - `Authorization: Bearer <accessToken>`
- **Parameters:**
  - `id` (uuid, required): ID của TicketType cần xóa.

- **Responses:**
  - **204 No Content:** Xóa thành công.
  - **400 Bad Request:** Không thể xóa vì đã có người mua vé thuộc hạng vé này.
  - **404 Not Found:** Loại vé không tồn tại.
