# TicketBox Load & Stress Testing Suite (k6)

Thư mục này chứa bộ kịch bản kiểm thử hiệu năng, kiểm thử tải (Load Test) và kiểm thử áp lực (Stress Test) sử dụng **k6** nhằm đánh giá khả năng chịu tải và concurrency của hệ thống TicketBox.

---

## 1. Cài đặt k6

### macOS
```bash
brew install k6
```

### Linux (Ubuntu/Debian)
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5DCC117B3C111CD
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

---

## 2. Chuẩn bị dữ liệu kiểm thử (Tiền sinh Users & Tokens)

Để kiểm thử tính năng đặt vé (Booking) dưới tải cao, chúng ta cần sinh sẵn 1000 tài khoản người dùng và mã JWT token tương ứng trong database. Việc này giúp cô lập hiệu năng API Đặt vé và tránh làm sập luồng băm bcrypt của API Đăng nhập.

Chạy script Node.js sau trên máy host:
```bash
# Đứng tại thư mục src/backend
npm install
node test/load-test/scripts/pre-generate-users.js
```

Script sẽ thực hiện:
1. Kết nối vào DB PostgreSQL tại `localhost:5433`.
2. Tự động dọn dẹp các bản ghi orders, tickets cũ của load-test users để tránh vi phạm khóa ngoại.
3. Tạo mới 1000 tài khoản khán giả (`loadtest_user_0001@ticketbox.test` đến `loadtest_user_1000@ticketbox.test`).
4. Sinh mã JWT token (thời hạn 30 ngày) cho 1000 user này và lưu ra file `src/backend/test/load-test/users-tokens.json` để k6 nạp vào bộ nhớ khi chạy test.

---

## 3. Các kịch bản kiểm thử

Tất cả các lệnh dưới đây được chạy khi đang đứng tại thư mục `src/backend/test/load-test/`.

### 3.1 Kiểm thử tải Đọc thông tin Concert (Cache-aside Verification)
Kịch bản giả lập hàng trăm người dùng liên tục truy vấn danh sách và chi tiết concert để kiểm chứng tính hiệu quả của Redis Cache dưới sự cân bằng tải của Gateway.
*   **File kịch bản:** `home-detail-read-load-test.js`
*   **Chuẩn bị trước khi chạy:** Để k6 không bị chặn bởi bộ lọc IP thô của Gateway khi chạy từ một máy đơn, chúng ta có thể:
    *   Chạy nhắm vào NestJS backend trực tiếp (cổng 3001) bằng cách chỉnh `docker-compose.yml` mở port `3001:3000` cho NestJS.
    *   Nâng tạm thời IP rate limit ở `nginx.conf` lên `rate=5000r/s` rồi reload nginx, và chạy trực tiếp qua Gateway (cổng 3000):
    ```bash
    BASE_URL=http://localhost:3000 k6 run home-detail-read-load-test.js
    ```
*   **Tiêu chí đạt:** Tỷ lệ lỗi 0.00%, thời gian phản hồi trung bình (average latency) dưới 50ms (do đa số request trúng cache).

### 3.2 Kiểm thử áp lực đặt vé đồng thời (Concurrency & Race Conditions)
Giả lập 500 người dùng đồng thời tranh chấp đặt mua 200 vé SVIP cuối cùng của sự kiện nhằm kiểm tra chống bán vượt (overselling).
*   **File kịch bản:** `booking-concurrency-stress-test.js`
*   **Cách chạy:**
    ```bash
    k6 run booking-concurrency-stress-test.js
    ```
*   **Tiêu chí đạt:** 
    *   Chỉ có đúng 200 request phản hồi HTTP 202 Accepted (thành công).
    *   300 request còn lại phản hồi HTTP 400 Bad Request (hết vé).
    *   Kiểm tra DB: số lượng vé đã bán thực tế bằng đúng 200.

### 3.3 Kiểm thử giới hạn vé tối đa trên mỗi tài khoản (Per-user Limit under Load)
Gửi 10 yêu cầu đặt vé song song từ cùng một tài khoản để kiểm tra cơ chế khóa và kiểm tra số lượng vé tối đa được phép mua (giới hạn 4 vé/user).
*   **File kịch bản:** `booking-per-user-limit-test.js`
*   **Cách chạy:**
    ```bash
    k6 run booking-per-user-limit-test.js
    ```
*   **Tiêu chí đạt:** 
    *   Chỉ có đúng 4 request phản hồi HTTP 202.
    *   6 request còn lại phản hồi HTTP 400 (Vượt giới hạn).
    *   Kiểm tra DB: tài khoản đó sở hữu đúng 4 vé.


### 3.4 Kiểm thử tải đột biến và Rate Limiting (Spike Load & Rate Limiting)
Giả lập lượng truy cập đột biến (tương đương 80.000 users / 5 phút) gửi từ một địa chỉ IP để xác minh Nginx Gateway chặn bot và giới hạn tần suất.
*   **File kịch bản:** `api-rate-limiting-spike-test.js`
*   **Cách chạy:**
    ```bash
    k6 run api-rate-limiting-spike-test.js
    ```
*   **Tiêu chí đạt:** Nginx tự động chặn các request vượt ngưỡng và trả về HTTP 429 kèm header `X-RateLimit-Source: gateway`.

### 3.5 Kiểm thử giới hạn tần suất Thanh toán (Payment User-level Rate Limiting)
Giả lập người dùng gửi nhiều yêu cầu thanh toán liên tiếp để kiểm chứng cơ chế chặn và lọc tải sớm tại Gateway cho luồng thanh toán (3 req/min).
*   **File kịch bản:** `payment-rate-limit-test.js`
*   **Cách chạy:**
    ```bash
    k6 run payment-rate-limit-test.js
    ```
*   **Tiêu chí đạt:** 
    *   3 request đầu tiên vượt qua Gateway thành công (trả về lỗi xác thực payload 400 của NestJS).
    *   Từ request thứ 4 trở đi bị chặn và từ chối trực tiếp tại OpenResty Gateway, trả về HTTP 429 và header `X-RateLimit-Source: gateway-user`.

---

## 4. Dọn dẹp dữ liệu rác sau khi chạy Test

Chạy câu lệnh SQL sau trong PostgreSQL để xóa các đơn đặt vé rác sinh ra trong quá trình chạy stress test:

```sql
BEGIN;
DELETE FROM tickets 
WHERE order_id IN (
    SELECT id FROM orders 
    WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'loadtest_user_%@ticketbox.test')
);
DELETE FROM orders 
WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'loadtest_user_%@ticketbox.test');
COMMIT;
```

Đồng thời, reset lại số lượng vé còn lại và khóa giới hạn mua trong Redis:
```bash
redis-cli FLUSHALL
```