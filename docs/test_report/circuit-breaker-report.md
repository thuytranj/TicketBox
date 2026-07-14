# Báo Cáo Kiểm Thử: Circuit Breaker và Graceful Degradation (IM13)

## 1. Mục tiêu kiểm thử
Xác minh hệ thống có khả năng tự bảo vệ và duy trì hoạt động (Graceful Degradation) khi một cổng thanh toán bên thứ ba (MoMo hoặc VNPAY) bị sập, timeout, hoặc gặp sự cố liên tục.

Yêu cầu chứng minh (Theo IM13): **"Test payment lỗi liên tiếp; trang concert vẫn hoạt động."**

## 2. Kế hoạch và Kịch bản Test (Test Plan)
- **Công cụ:** Gửi request thông qua file `payment-api.http` (hoặc REST Client tương đương).
- **Cơ chế ngắt mạch (Circuit Breaker):** Sử dụng thư viện `opossum` (`src/backend/src/payment/circuit-breaker/circuit-breaker.service.ts`).
  - **Threshold:** 50% lỗi.
  - **Volume:** Cần tối thiểu 5 requests lỗi để bắt đầu kích hoạt tính toán.
  - **Reset Timeout:** 30 giây ở trạng thái OPEN sẽ chuyển sang HALF-OPEN.
- **Kịch bản (Scenario):**
  - **Bước 1 (Chuẩn bị):** Chạy request `POST /bookings` để tạo đơn hàng mới, sau đó copy `orderId` dán vào biến toàn cục.
  - **Bước 2 (Kích hoạt ngắt mạch):** Gửi 5 request liên tiếp tới cổng thanh toán MoMo, cố tình truyền `orderInfo` chứa chuỗi `FAIL_MOMO` (Đây là "Cheat code" được code ngầm trong `momo.gateway.ts` để giả lập MoMo trả về lỗi).
  - **Bước 3 (Kiểm tra ngắt mạch):** Ở request thứ 6 (mạch OPEN), server phải từ chối ngay lập tức và trả về lỗi 503.
  - **Bước 4 (Kiểm tra Graceful Degradation):** Dù MoMo đang sập, gọi các API khác như `GET /concerts` (Trang chủ) hay `POST /payments/vnpay` (Cổng thanh toán dự phòng) vẫn phải hoạt động bình thường 100%.
  - **Bước 5 (Phục hồi):** Chờ 30 giây (mạch HALF-OPEN), gửi request MoMo bình thường để hệ thống phục hồi lại.

## 3. Phân tích kết quả thực tế
Khi thực thi kịch bản trên bằng file `payment-api.http`:

1. **Từ request 1 đến 5 (Đang ở trạng thái CLOSED):**
   - Hệ thống cố gắng gọi qua MoMo API (bị lỗi giả lập).
   - Code `CircuitBreakerService` ghi nhận có lỗi. Mạch vẫn duy trì trạng thái CLOSED để ráng thử nghiệm.
2. **Tại request thứ 6 (Kích hoạt ngắt mạch - OPEN):**
   - Cầu dao (Breaker) nhận thấy tỉ lệ lỗi > 50% ở 5 request trước đó. Nó chuyển sang trạng thái **OPEN**.
   - Ngay khi request thứ 6 tới, nó bị từ chối ngay lập tức (REJECT) và không thèm gọi qua MoMo nữa.
   - Server lập tức trả về Http Status `503 Service Unavailable`: *"Cổng thanh toán MoMo hiện đang bảo trì. Vui lòng chọn phương thức khác (VNPAY) hoặc thử lại sau."*
3. **Tại request thứ 7 (Sau 30 giây - HALF-OPEN):**
   - Cầu dao chuyển sang **HALF-OPEN** để "thử nước". 
   - Request lọt qua thành công và gọi tới MoMo (không dùng chữ FAIL_MOMO nữa). MoMo trả về thành công -> Cầu dao đóng lại (**CLOSED**), hệ thống phục hồi 100%.

**Đánh giá sự đánh đổi (Graceful Degradation):**
- Khi cổng MoMo bị sập, thay vì để ứng dụng "treo" (hanging) để ráng chờ MoMo trả lời (rồi sập luôn toàn bộ server vì cạn kiệt Connection Pool), Circuit Breaker đã **ngắt mạch lập tức** và trả về lỗi phản hồi cực nhanh.
- Hệ thống chính (Node.js API) hoàn toàn không bị ảnh hưởng. Người dùng vẫn tiếp tục lướt xem Concert, đăng nhập, và thanh toán bằng VNPAY một cách hoàn toàn bình thường. Mọi chức năng khác của "trang concert" vẫn sống nhăn răng.

## 4. Bằng chứng (Minh chứng nộp đồ án)
1. Cấu hình Circuit Breaker: `src/backend/src/payment/circuit-breaker/circuit-breaker.service.ts`
2. Kịch bản test HTTP: File `payment-api.http` (Từ dòng 92).

## 5. Kết luận
- **Trạng thái:** **PASSED** (Đạt chuẩn 100%).
- Hệ thống đã xử lý lỗi (Fault Tolerance) xuất sắc và cung cấp giải pháp Graceful Degradation (Báo bảo trì cục bộ một tính năng) đúng như lý thuyết Thiết Kế Phần Mềm hiện đại.
