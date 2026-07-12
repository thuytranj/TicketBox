# TicketBox — Project Proposal

## Mục lục
- [Why](#why)
- [Mục tiêu](#mục-tiêu)
- [Người dùng và nhu cầu](#người-dúng-và-nhu-cầu)
  - [1. Khán giả (Audience)](#1-khán-giả-audience)
  - [2. Ban tổ chức (Organizer)](#2-ban-tổ-chức-organizer)
  - [3. Nhân viên Soát vé (Gate Staff)](#3-nhân-viên-soát-vé-gate-staff)
- [What Changes](#what-changes)
  - [Trong phạm vi đồ án](#trong-phạm-vi-đồ-án)
  - [Ngoài phạm vi đồ án](#ngoài-phạm-vi-đồ-án)
- [Rủi ro và ràng buộc](#rủi-ro-và-ràng-buộc)
  - [Rủi ro kỹ thuật đã xác định](#rủi-ro-kỹ-thuật-đã-xác-định)
  - [Ràng buộc kỹ thuật](#ràng-buộc-kỹ-thuật)

---

## Why

Thị trường giải trí và âm nhạc tại Việt Nam đang bùng nổ với các sự kiện quy mô lớn (Anh Trai Say Hi, Anh Trai Vượt Ngàn Chông Gai, các concert quốc tế tại SVĐ Mỹ Đình…). Hiện nay, đa phần các đơn vị tổ chức sự kiện nhỏ và vừa vẫn đang vận hành kênh bán vé bằng các phương thức thủ công: tiếp nhận đơn đặt vé qua **Zalo OA**, **Google Form**, sau đó xác nhận thanh toán qua hình ảnh chuyển khoản ngân hàng và gửi vé điện tử bằng tay qua tin nhắn hoặc email. Quy trình này hoạt động được ở quy mô vài trăm vé, nhưng hoàn toàn sụp đổ khi sự kiện thu hút hàng chục nghìn người mua cùng lúc.

Hậu quả nghiêm trọng đã xảy ra nhiều lần trên thực tế:

- **Website/hệ thống sập ngay khi mở bán**: Lượng truy cập đột biến lên tới **80.000 người trong 5 phút đầu** (trong đó **~70% dồn vào phút đầu tiên**, tức khoảng **933 requests/giây** chỉ riêng luồng đặt vé) khiến server quá tải hoàn toàn. Khán giả nhận thông báo lỗi 502/503 liên tục, không thể truy cập trang mua vé.
- **Bán vé trùng lặp (Over-selling)**: Khi hàng nghìn yêu cầu đặt vé đổ về cùng lúc, hệ thống không có cơ chế khóa tồn kho nguyên tử (atomic lock). Nhiều giao dịch đồng thời đọc cùng một giá trị tồn kho còn lại, dẫn đến số vé bán ra vượt quá số vé thực tế — ví dụ: 500 vé SVIP nhưng hệ thống xác nhận cho 520 đơn hàng.
- **Trừ tiền nhưng không ra vé**: Khách hàng hoàn tất thanh toán qua cổng VNPAY/MoMo, tiền đã bị trừ từ tài khoản ngân hàng, nhưng do timeout mạng hoặc lỗi webhook callback, hệ thống không nhận được xác nhận thanh toán. Kết quả: đơn hàng mắc kẹt ở trạng thái `pending`, khách không nhận được vé, phải liên hệ hotline để khiếu nại hoàn tiền thủ công.
- **Scalper bot gom vé trong vài giây**: Không có cơ chế Rate Limiting hay CAPTCHA, các bot tự động (scalper) có thể gửi hàng trăm yêu cầu đặt vé mỗi giây từ nhiều IP khác nhau, gom sạch toàn bộ vé hot trong vòng chưa đầy 10 giây kể từ lúc mở bán. Khán giả thật không có cơ hội mua vé, buộc phải mua lại từ "chợ đen" với giá gấp 3–5 lần.
- **Giới hạn mua vé trên mỗi tài khoản bị vô hiệu hóa dưới tải cao**: Quy tắc "tối đa 2 vé/tài khoản" được kiểm tra bằng query đọc database thông thường. Dưới tải cao, nhiều request của cùng một user xuyên qua được bước kiểm tra trước khi bất kỳ request nào kịp ghi kết quả, dẫn đến một tài khoản mua được 6–8 vé thay vì tối đa 2.
- **Soát vé tại cổng sự kiện thất bại khi mất mạng**: Sân vận động và nhà thi đấu thường có hàng chục nghìn người tập trung, gây nghẽn sóng di động. Hệ thống soát vé phụ thuộc hoàn toàn vào kết nối internet để xác thực mã QR trực tuyến. Khi mất sóng, máy quét không hoạt động, nhân viên buộc phải cho vào bằng tay — mở ra lỗ hổng cho vé giả và vé dùng lại.

## Mục tiêu

Xây dựng hệ thống bán vé sự kiện **TicketBox** giải quyết triệt để các vấn đề nêu trên, với các mục tiêu kỹ thuật cụ thể:

1. **Chịu tải cao không sập**: Hệ thống PHẢI xử lý ổn định **80.000 người truy cập đồng thời trong 5 phút đầu** mở bán, với peak load đạt **~1.000 booking requests/giây** mà không bị downtime hoặc trả lỗi 5xx cho người dùng hợp lệ.
2. **Không bao giờ over-selling**: Đảm bảo tính nhất quán tuyệt đối (strong consistency) của tồn kho vé — số vé bán ra KHÔNG BAO GIỜ vượt quá tổng số vé thực tế, kể cả khi hàng nghìn request đặt vé đổ về cùng một mili-giây.
3. **Enforce chính xác giới hạn mua vé**: Quy tắc "tối đa N vé/tài khoản" PHẢI được thực thi đúng 100% dưới mọi mức tải, không có race condition nào cho phép một user mua vượt giới hạn.
4. **Không trừ tiền hai lần**: Mọi giao dịch thanh toán PHẢI có cơ chế Idempotency đảm bảo dù client gửi lại request (do timeout, retry) hay webhook callback bị gọi nhiều lần, tiền chỉ bị trừ đúng 1 lần và vé chỉ được xuất đúng 1 lần.
5. **Soát vé hoạt động cả khi mất mạng**: Nhân viên soát vé PHẢI quét được mã QR và xác thực vé ngay cả khi thiết bị hoàn toàn mất kết nối internet. Khi có mạng trở lại, dữ liệu check-in ngoại tuyến tự động đồng bộ lên server và phát hiện vé bị quét trùng từ máy khác.
6. **Chống bot hiệu quả**: Tích hợp Rate Limiting thông minh (Token Bucket trên Redis) để giới hạn tần suất request theo IP và tài khoản, đảm bảo người dùng thật có cơ hội công bằng khi mua vé.
7. **Xử lý lỗi cổng thanh toán không gây sập hệ thống**: Khi cổng thanh toán VNPAY/MoMo gặp sự cố (timeout, 5xx), hệ thống PHẢI tự động cắt mạch (Circuit Breaker) để tránh ảnh hưởng dây chuyền đến các dịch vụ khác (xem concert, soát vé, admin).
8. **Thông báo tự động đáng tin cậy**: Sau khi mua vé thành công, khán giả PHẢI nhận được thông báo xác nhận qua in-app notification và email kèm e-ticket (QR code ký số nhúng inline PNG). Trước 24 giờ khi concert diễn ra, hệ thống PHẢI tự động gửi nhắc nhở. Kiến trúc notification PHẢI được thiết kế mở rộng để dễ dàng bổ sung kênh mới (SMS, Zalo OA…) mà không cần sửa code publisher.

## Người dùng và nhu cầu

Hệ thống TicketBox phục vụ **ba nhóm người dùng chính**, mỗi nhóm có vai trò, quyền hạn và nhu cầu hoàn toàn khác nhau:

### 1. Khán giả (Audience)
Là người dùng cuối — khách hàng mua vé xem concert. Họ truy cập hệ thống qua **Web Application** (trình duyệt desktop/mobile).

**Nhu cầu cốt lõi:**
- Xem danh sách concert đang mở bán, thông tin chi tiết (nghệ sĩ biểu diễn, ngày giờ, địa điểm, giá vé từng hạng).
- Chọn hạng vé, số lượng và tiến hành đặt vé nhanh chóng trong thời gian giữ chỗ tạm (10 phút).
- Thanh toán qua VNPAY hoặc MoMo và nhận vé điện tử kèm mã QR ngay sau khi thanh toán thành công.
- Nhận thông báo xác nhận đặt vé qua in-app notification và email kèm e-ticket (QR code inline PNG).
- Nhận nhắc nhở tự động trước 24 giờ khi concert sắp diễn ra.
- Xem lại lịch sử đơn hàng, trạng thái vé đã mua và danh sách thông báo.

**Điều quan trọng nhất:** Trải nghiệm mua vé phải **nhanh, công bằng và đáng tin cậy** — không bị sập, không bị mất tiền vô cớ, và không bị bot cướp hết vé trước khi kịp bấm.

### 2. Ban tổ chức (Organizer)
Là đơn vị tạo và quản lý sự kiện. Họ truy cập hệ thống qua **Admin Portal** (Web Application riêng biệt, xác thực bằng JWT + RBAC).

**Nhu cầu cốt lõi:**
- Tạo concert mới: nhập thông tin sự kiện, thiết lập các hạng vé (SVIP, VIP, GA, CAT1…) với giá, số lượng và giới hạn mua tối đa trên mỗi tài khoản.
- Quản lý trạng thái concert (Draft → Active → Cancelled/Completed).
- Nhập danh sách khách mời VIP từ **tệp CSV** do đối tác/nhãn hàng cung cấp.
- Tải lên PDF press kit/hồ sơ nghệ sĩ để hệ thống tự động trích xuất và tạo bài giới thiệu nghệ sĩ bằng AI.
- Xem thống kê bán vé theo thời gian thực (số vé đã bán, doanh thu, tỷ lệ lấp đầy).

**Điều quan trọng nhất:** Công cụ quản trị phải **trực quan, tự động hóa cao** — giảm thiểu thao tác thủ công, đặc biệt là quản lý danh sách khách mời và nội dung nghệ sĩ.

### 3. Nhân viên Soát vé (Gate Staff)
Là nhân sự vận hành tại cổng sự kiện. Họ sử dụng **Mobile Application** chuyên biệt (Flutter hoặc React Native) để quét mã QR trên vé điện tử.

**Nhu cầu cốt lõi:**
- Quét mã QR nhanh chóng (< 1 giây phản hồi) để xác nhận vé hợp lệ và cho khán giả vào cổng.
- **Hoạt động ổn định ngay cả khi mất mạng hoàn toàn** — đây là yêu cầu đặc biệt quan trọng vì sân vận động thường bị nghẽn sóng khi đông người.
- Tự động đồng bộ dữ liệu check-in khi có mạng trở lại, phát hiện và cảnh báo vé đã bị quét trùng từ máy khác.
- Soát vé khách VIP từ danh sách guest list mà không cần vé thông thường.

**Điều quan trọng nhất:** **Tốc độ quét và khả năng hoạt động offline** — nếu máy quét chậm hoặc không hoạt động được khi mất sóng, hàng nghìn khán giả sẽ bị kẹt tại cổng.

## What Changes

### Trong phạm vi đồ án

- **Backend API hoàn chỉnh (NestJS)**: Thiết kế kiến trúc module hóa, phân tách rõ ràng theo Domain-Driven Design. Bao gồm các module chính: Auth, Concert, Booking, Payment, Check-in, Guest List, AI Bio, **Notification**.
- **Cơ sở dữ liệu PostgreSQL**: Thiết kế schema tối ưu sử dụng **UUID v7** làm khóa chính cho tất cả bảng nghiệp vụ (tận dụng tính chất time-ordered để tối ưu B-Tree index, giảm page fragmentation). Bao gồm các bảng: `users`, `concerts`, `ticket_types`, `bookings`, `tickets`, `checkin_logs`, `vip_guests`, `notification_logs` (bảng log dùng BIGSERIAL PK để tiết kiệm dung lượng).
- **Chiến lược High Concurrency (Redis Lua Script + RabbitMQ)**:
  - **Redis Lua Script** xử lý nguyên tử (atomic): trừ tồn kho vé + kiểm tra giới hạn mua per-user trong một lệnh duy nhất, không race condition.
  - **RabbitMQ** nhận booking task từ API và xử lý bất đồng bộ — worker tiêu thụ message và ghi vào PostgreSQL tuần tự, tránh nghẽn database.
  - **Lua Script hồi kho** (compensation): tự động trả lại tồn kho trên Redis khi đơn hàng hết hạn thanh toán.
- **Hệ thống bảo vệ**:
  - Rate Limiting (Token Bucket trên Redis) chống DDoS và bot spam.
  - Circuit Breaker (opossum) bọc cuộc gọi cổng thanh toán VNPAY/MoMo.
  - Idempotency Key (lưu trên Redis, TTL 24h) chống trùng giao dịch thanh toán.
  - Cache-aside (Redis, TTL 10 phút) giảm tải query đọc danh sách/chi tiết concert.
- **Soát vé trực tuyến & ngoại tuyến (Offline Check-in)**: API check-in online + cơ chế tải dữ liệu vé xuống SQLite cục bộ trên mobile, quét QR offline, đồng bộ lại khi có mạng với cơ chế phát hiện quét trùng.
- **Nhập khách mời VIP từ CSV**: API upload CSV, xử lý validate từng dòng, bỏ qua dòng lỗi, lưu khách hợp lệ vào database, sinh mã QR riêng cho cổng VIP.
- **AI Artist Bio**: Tích hợp đọc PDF (pdf-parse), gửi văn bản sang Google Gemini API để tạo tóm tắt tiểu sử nghệ sĩ hiển thị trên trang concert.
- **Xác thực & Phân quyền (JWT + RBAC)**: Hệ thống đăng ký/đăng nhập, JWT access token, phân quyền theo vai trò (Khán giả, Ban tổ chức, Nhân viên Soát vé) với NestJS Guards.
- **Hệ thống Thông báo (Notification)**: Kiến trúc thông báo mở rộng sử dụng RabbitMQ Topic Exchange — publisher chỉ gửi 1 message, mỗi kênh (in-app, email) là một queue riêng. Hỗ trợ 2 loại thông báo: (1) Xác nhận mua vé thành công kèm e-ticket QR code ký số (HMAC-SHA256) nhúng inline PNG trong email qua Nodemailer + Mailtrap SMTP mock, (2) Nhắc nhở concert trước 24 giờ qua Cron Job. Bảng `notification_logs` (BIGSERIAL PK) lưu lịch sử gửi và trạng thái đọc cho in-app notification.

### Ngoài phạm vi đồ án

- **Tích hợp cổng thanh toán thật**: VNPAY và MoMo sẽ được triển khai dưới dạng **giả lập (mock/sandbox)**, không kết nối API production thật. Mục tiêu là chứng minh kiến trúc xử lý thanh toán (Circuit Breaker, Idempotency, Webhook callback) hoạt động đúng, chứ không phải kết nối ngân hàng thật.
- **Web Frontend & Mobile App hoàn chỉnh**: Đồ án tập trung vào **Backend API + kiến trúc hệ thống**. Giao diện web (React) và mobile app (Flutter) chỉ xây dựng ở mức tối thiểu đủ để demo luồng chính, không đầu tư vào UI/UX hoàn thiện.
- **Hệ thống giám sát & logging production**: Không triển khai Prometheus, Grafana, ELK Stack hay các công cụ APM.
- **Push Notification thật (FCM/APNs)**: Không tích hợp Firebase Cloud Messaging hay Apple Push Notification Service. Thông báo chỉ gồm in-app (lưu DB) và email.
- **Hệ thống hoàn tiền tự động (Refund)**: Quy trình hoàn tiền nếu có sẽ xử lý thủ công ngoài hệ thống.

## Rủi ro và ràng buộc

### Rủi ro kỹ thuật đã xác định

| # | Rủi ro | Mô tả chi tiết | Chiến lược giảm thiểu |
|---|--------|----------------|----------------------|
| R1 | **Tranh chấp tồn kho vé (Race Condition)** | Hàng nghìn request đặt vé đồng thời đọc cùng giá trị tồn kho, dẫn đến bán vượt số lượng thực tế. Đây là rủi ro nghiêm trọng nhất của hệ thống. | Sử dụng **Redis Lua Script** để trừ tồn kho và kiểm tra giới hạn per-user trong một thao tác nguyên tử (single-threaded execution trên Redis). PostgreSQL chỉ ghi sau khi Redis đã xác nhận thành công. |
| R2 | **Tải đột biến phút đầu mở bán (Thundering Herd)** | 70% lượng truy cập (≈56.000 người) dồn vào phút đầu tiên. Nếu tất cả request đổ thẳng vào PostgreSQL, database sẽ quá tải và sập. | Kiến trúc 2 lớp: Redis gánh tải ghi ban đầu (in-memory, single-threaded) → RabbitMQ đệm message → Worker ghi vào PostgreSQL tuần tự. Database không bao giờ chịu tải đột biến trực tiếp. |
| R3 | **Mất đồng bộ Redis ↔ PostgreSQL** | Redis bị restart đột ngột hoặc lỗi mạng xảy ra sau khi Lua Script trừ tồn kho nhưng trước khi message vào RabbitMQ. Tồn kho trên Redis và dữ liệu thực trên PostgreSQL bị lệch. | Triển khai **Reconciliation Job** chạy định kỳ (mỗi 15 phút) quét booking ở trạng thái `pending`/`paid` trong PostgreSQL để đối chiếu và hiệu chỉnh lại tồn kho trên Redis. Redis bật AOF persistence để giảm thiểu mất dữ liệu khi restart. |
| R4 | **Cổng thanh toán không ổn định** | VNPAY/MoMo có thể timeout, trả lỗi 5xx, hoặc gọi webhook callback nhiều lần. Nếu không xử lý đúng, hệ thống sẽ bị treo chờ response hoặc trừ tiền 2 lần. | **Circuit Breaker** (thư viện `opossum` cho từng cổng riêng biệt) tự động cắt mạch khi tỷ lệ lỗi > 50% trong 10 giây. Tích hợp **Graceful Degradation** chuyển đổi cổng linh hoạt (Dynamic Switch) hoặc chuyển sang luồng **Pay Later** (gia hạn giữ chỗ lên 2 giờ) khi tất cả các cổng trực tuyến bị sập. **Idempotency Key** trên Redis (TTL 24h) đảm bảo mỗi giao dịch chỉ xử lý tối đa 1 lần, dù webhook bị gọi lặp. |
| R5 | **Soát vé thất bại khi mất kết nối mạng** | Sân vận động chứa hàng chục nghìn người gây nghẽn sóng. Nếu máy quét phụ thuộc 100% vào internet, hàng nghìn khán giả bị kẹt ở cổng. | App soát vé tải trước danh sách vé hợp lệ vào **SQLite cục bộ**. Quét QR so khớp offline, đánh dấu check-in local. Khi có mạng → batch sync lên server, server đối soát phát hiện vé bị quét trùng từ máy khác. |
| R6 | **Đơn hàng "ma" chiếm tồn kho** | Khách tạo đơn hàng (Redis trừ tồn kho) nhưng không hoàn tất thanh toán, khiến vé bị "khóa" vĩnh viễn trong Redis, khách khác không mua được. | Đơn hàng `pending` có **thời hạn mặc định 10 phút**, nhưng có thể được gia hạn lên **2 giờ** dưới dạng **Pay Later** khi có sự cố thanh toán toàn bộ cổng. Scheduler/TTL Keyspace Notification tự động hủy đơn hết hạn và chạy Lua Script hồi kho (incrby tồn kho, decrby user count) trên Redis. |
| R7 | **CSV khách mời VIP lỗi dữ liệu** | Tệp CSV do đối tác cung cấp có thể thiếu trường bắt buộc, sai định dạng email/phone, hoặc chứa bản ghi trùng lặp. Nếu import lỗi → toàn bộ file bị reject hoặc data bẩn vào database. | Xử lý **từng dòng (row-by-row validation)**: dòng lỗi bị bỏ qua và ghi vào error log, các dòng hợp lệ vẫn được import bình thường. Cơ chế dedup theo email+concert_id ngăn chặn trùng lặp. |

### Ràng buộc kỹ thuật

- **Ngôn ngữ & Framework**: TypeScript + NestJS (Backend API), PostgreSQL (persistent storage), Redis (cache + atomic operations), RabbitMQ (message broker).
- **Khóa chính**: Tất cả bảng sử dụng **UUID v7** — cung cấp tính unique toàn cục như UUID v4 nhưng thêm tính chất time-ordered giúp B-Tree index hoạt động hiệu quả hơn đáng kể (giảm random I/O, giảm page split).
- **Môi trường chạy**: Docker Compose local (PostgreSQL, Redis, RabbitMQ, NestJS containers). Không yêu cầu hạ tầng cloud.
- **Cổng thanh toán**: Mock/Sandbox mode cho VNPAY và MoMo. API interface giống thật để dễ dàng chuyển sang production sau này.
