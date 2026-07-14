## 1. Setup & Docker Configuration

- [x] 1.1 Cập nhật `docker-compose.yml` để nâng cấp image của container `ticketbox-nginx-lb` sang `openresty/openresty:alpine`
- [x] 1.2 Cấu hình mount thư mục chứa các Lua scripts của OpenResty vào container Load Balancer
- [x] 1.3 Truyền biến môi trường `JWT_SECRET` vào container OpenResty thông qua cấu hình `environment` trong `docker-compose.yml`

## 2. Implement OpenResty Lua Scripts

- [x] 2.1 Viết Lua script xác thực chữ ký JWT (`jwt-validation.lua`) sử dụng thư viện `lua-resty-jwt` để kiểm tra token từ header `Authorization`
- [x] 2.2 Viết Lua script kiểm tra rate limit (`jwt-rate-limiter.lua`) kết nối Redis và chạy thuật toán sliding window log theo `userId` cho endpoint `/api/v1/bookings`
- [x] 2.3 Cấu hình trả về mã trạng thái HTTP 429, header `X-RateLimit-Source: gateway-user`, và JSON payload báo lỗi trực tiếp từ OpenResty khi quá ngưỡng giới hạn

## 3. Gateway Configuration & Verification

- [x] 3.1 Cập nhật tệp cấu hình `nginx.conf` của Gateway để áp dụng các khối lệnh Lua (access_by_lua_file) cho endpoint `/api/v1/bookings`
- [x] 3.2 Khởi động lại container Load Balancer và kiểm tra cú pháp cấu hình OpenResty thành công
- [x] 3.3 Chạy kịch bản kiểm thử tải k6 `booking-concurrency-stress-test.js` để xác minh cơ chế chặn rate limit theo User ID hoạt động trực tiếp ở tầng Gateway (không chạm tới NestJS) và phản hồi đúng định dạng yêu cầu
