# Báo Cáo Kiểm Thử: Giới hạn số lượng vé mỗi tài khoản dưới tải đồng thời

## 1. Mục tiêu kiểm thử
Xác minh hệ thống đảm bảo tính toàn vẹn dữ liệu (không xảy ra lỗi Race Condition) khi một tài khoản cố tình gửi nhiều yêu cầu mua vé cùng một lúc để lách luật giới hạn số lượng vé cho phép. 

Yêu cầu chứng minh (Theo IM03): **"Enforce giới hạn vé/tài khoản trên toàn bộ đơn thành công, kể cả request đồng thời."**

## 2. Kế hoạch và Kịch bản Test (Test Plan)
- **Công cụ:** `k6` (Load Testing Tool)
- **Script:** `src/backend/test/load-test/booking-per-user-limit-test.js`
- **Kịch bản (Scenario):**
  - **Số lượng VUs (Virtual Users):** 10 (Mô phỏng 10 luồng gửi request song song).
  - **Tài khoản sử dụng:** Tất cả 10 luồng đều dùng chung **duy nhất 1 tài khoản** (Token của `user[0]`).
  - **Mục tiêu đặt vé:** Loại vé `Rock VIP Pit` của sự kiện Rock Storm 2026. (Loại vé này được cấu hình `maxPerUser` là **4 vé/tài khoản**).
  - **Idempotency-Key:** Mỗi request trong 10 luồng được gắn một mã `Idempotency-Key` ngẫu nhiên khác nhau (bằng `uuidv4()`). Việc này nhằm đánh lừa lớp Anti-Duplicate đầu tiên của API, buộc toàn bộ 10 request cùng lọt xuống tầng xử lý ghi nhận vé (tầng có nguy cơ cao nhất xảy ra Race Condition).
- **Kỳ vọng (Expected Result):** 
  - Hệ thống xử lý Atomic (bằng Redis Lua Script `reserve-ticket.lua`), xếp hàng và trừ vé chính xác.
  - Phải có **đúng 4 request thành công** (trả về HTTP 202).
  - **Đúng 6 request còn lại thất bại** (trả về HTTP 400 - Limit Exceeded) ngay lập tức do đã chạm ngưỡng 4 vé.

## 3. Kết quả thực thi (Test Results)

Kết quả trả về từ công cụ k6 chạy tại Local Terminal:

```text
         /\      Grafana   /‾‾/  
    /\  /  \     |\  __   /  /   
   /  \/    \    | |/ /  /   ‾‾\ 
  /          \   |   (  |  (‾)  |
 / __________ \  |_|\_\  \_____/ 

     execution: local
        script: booking-per-user-limit-test.js
        output: -

     scenarios: (100.00%) 1 scenario, 10 max VUs, 40s max duration (incl. graceful stop):       
              * user_limit_test: 1 iterations for each of 10 VUs (maxDuration: 10s, gracefulStop: 30s)

  █ TOTAL RESULTS

    checks_total.......: 30     24.828415/s
    checks_succeeded...: 66.66% 20 out of 30
    checks_failed......: 33.33% 10 out of 30

    ✓ status is 202 or 400
    ✗ status is 202 (Success)
      ↳  40% — ✓ 4 / ✗ 6
    ✗ status is 400 (Limit Exceeded)
      ↳  60% — ✓ 6 / ✗ 4

    HTTP
    http_req_duration..............: avg=140.36ms min=99.63ms med=139.21ms max=191.42ms p(90)=162.62ms p(95)=177.02ms
      { expected_response:true }...: avg=145.6ms  min=99.63ms med=145.68ms max=191.42ms p(90)=178.39ms p(95)=184.91ms
    http_req_failed................: 60.00% 6 out of 10
    http_reqs......................: 10     8.276138/s

    EXECUTION
    iteration_duration.............: avg=1.15s    min=1.11s   med=1.15s    max=1.2s     p(90)=1.17s    p(95)=1.19s
    iterations.....................: 10     8.276138/s
    vus............................: 10     min=10      max=10
    vus_max........................: 10     min=10      max=10
```

## 4. Kết luận (Conclusion)
- Check `status is 202 (Success)` đạt **4/10** (Tương ứng 4 vé đặt thành công).
- Check `status is 400 (Limit Exceeded)` đạt **6/10** (Tương ứng 6 vé bị hệ thống từ chối do chạm trần giới hạn mua).
- Toàn bộ 100% request đều được hệ thống phản hồi (Không có lỗi vỡ server, quá tải hay deadlock).

**=> ĐẠT (PASSED).** Hệ thống đã xử lý hoàn hảo Constraint và Concurrent Lock thông qua cơ chế Redis Lua Script, đáp ứng 100% tiêu chí IM03.
