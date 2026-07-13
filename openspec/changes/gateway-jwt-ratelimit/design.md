## Context

Hiện tại, Nginx đóng vai trò là API Gateway để phân phối tải và giới hạn tần suất truy cập toàn cục theo IP (50 req/s). Tuy nhiên, cơ chế rate limit theo User ID cho API đặt vé lại được xử lý ở tầng NestJS Application thông qua Redis. Dưới tải cao đột biến (80k user truy cập), việc xử lý JWT và kiểm tra Redis ở tầng NestJS tốn nhiều tài nguyên Event Loop và dễ dẫn đến nghẽn HTTP thread. Nâng cấp cổng Gateway lên OpenResty cho phép xử lý các tác vụ kiểm tra này sớm ở tầng Gateway, phản hồi 429 cực nhanh và bảo vệ NestJS.

## Goals / Non-Goals

**Goals:**
- Di chuyển toàn bộ logic xác thực JWT signature và rate limit theo User ID của luồng Đặt vé (`POST /api/v1/bookings`) lên Nginx/OpenResty Gateway.
- Lọc bỏ 100% các request quá hạn mức hoặc mang token rác trước khi chúng chạm tới NestJS.
- Đảm bảo hệ thống hoạt động ổn định và chính xác dưới tải 80.000 user/5 phút, đặc biệt là người dùng thật đi qua NAT IP.

**Non-Goals:**
- Tích hợp phòng chờ ảo Virtual Waiting Room hoặc CAPTCHA trong phạm vi thay đổi này (sẽ làm ở các Change Proposal tiếp theo).
- Thay đổi logic nghiệp vụ đặt vé chính trong NestJS.

## Decisions

### Quyết định 1: Sử dụng OpenResty thay thế Nginx tiêu chuẩn làm API Gateway
*   **Giải pháp:** Nâng cấp image Docker Load Balancer sang `openresty/openresty:alpine`.
*   **Lý do chọn:** OpenResty tích hợp sẵn LuaJIT engine cực kỳ nhẹ và nhanh, cho phép thực thi mã Lua để xử lý logic phức tạp (đọc token, kết nối Redis) trực tiếp ở tầng Gateway mà vẫn giữ được tốc độ xử lý hàng chục ngàn kết nối mỗi giây của Nginx.
*   **Phương án thay thế đã cân nhắc:**
    *   *Sử dụng Nginx auth_request module*: Chuyển hướng xác thực sang một microservice phụ. Bị loại bỏ vì vẫn tạo thêm tải HTTP nội bộ và làm tăng độ trễ (latency).

### Quyết định 2: Xác thực chữ ký JWT bằng Lua ngay tại Gateway
*   **Giải pháp:** Sử dụng thư viện `lua-resty-jwt` trong OpenResty. Gateway tự động parse header `Authorization: Bearer <JWT>`, kiểm tra tính hợp lệ và chữ ký bảo mật dựa trên biến môi trường `JWT_SECRET`.
*   **Lý do chọn:** Ngăn chặn tuyệt đối các cuộc tấn công spam token giả nhằm vắt kiệt CPU của NestJS (tác vụ giải mã crypto chữ ký JWT rất tốn CPU).
*   **Phương án thay thế đã cân nhắc:**
    *   *Chỉ decode Base64 mà không check signature*: Chỉ trích xuất `userId` để check rate limit mà không verify. Bị loại bỏ vì hacker có thể giả mạo `userId` bất kỳ để spam.

### Quyết định 3: Lưu trữ trạng thái rate limit trong Redis dùng chung
*   **Giải pháp:** OpenResty kết nối trực tiếp đến Redis cluster/instance hiện tại bằng module `resty.redis` và chạy script Lua sliding window log tương đương với logic ở NestJS.
*   **Lý do chọn:** Đồng bộ trạng thái giới hạn tần suất giữa Gateway và NestJS. Nếu Gateway từ chối, nó sẽ ghi nhận vào Redis và NestJS cũng sẽ thấy trạng thái tương tự.

## Risks / Trade-offs

- **[Risk] Kết nối từ OpenResty đến Redis bị gián đoạn**
  - *Mitigation:* Áp dụng chiến lược Fail-Open. Nếu OpenResty không thể kết nối tới Redis, log lỗi và cho phép chuyển tiếp request sang NestJS để đảm bảo tính sẵn sàng của hệ thống (NestJS vẫn còn lớp phòng vệ thứ 2 là `ThrottlerGuard` nội bộ).
- **[Risk] Lộ JWT_SECRET tại Load Balancer**
  - *Mitigation:* `JWT_SECRET` được truyền vào container OpenResty qua Docker Compose environment variables được bảo mật, không hardcode vào file cấu hình nginx.conf.
