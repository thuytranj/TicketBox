## Context

Hiện tại, vòng đời của concert bao gồm ba trạng thái: `draft`, `active` và `cancelled`. Các concert đã kết thúc vẫn được giữ ở trạng thái `active`. Để giúp việc truy vấn các concert đang hoạt động và các concert đã kết thúc được rõ ràng hơn (đặc biệt là đối với các số liệu thống kê trên dashboard), chúng ta sẽ giới thiệu trạng thái `completed` mới vào enum `ConcertStatus`.

## Goals / Non-Goals

**Goals:**
- Bổ sung trạng thái `completed` vào enum `ConcertStatus` ở cả backend và frontend.
- Cập nhật định nghĩa Entity `Concert` và các truy vấn thống kê trên dashboard để hỗ trợ chính xác trạng thái `completed`.
- Triển khai một cơ chế cron job/background worker tự động để chuyển đổi các concert từ trạng thái `active` sang `completed` sau khi `end_time` của chúng trôi qua.
- Cập nhật các script seeder để ban đầu đánh dấu các concert trong quá khứ với trạng thái `completed`.

**Non-Goals:**
- Chỉnh sửa logic đặt vé, thanh toán, soát vé hoặc cập nhật trạng thái đơn hàng dựa trên trạng thái của concert.
- Thay đổi vai trò (roles) hoặc quyền hạn (permissions) của người dùng.

## Decisions

### Decision 1: Cơ chế tự động chuyển trạng thái hoàn thành (Automatic Transition Mechanism)
Chúng ta sẽ triển khai một cron job NestJS bên trong module background worker để định kỳ kiểm tra và cập nhật trạng thái concert.
- **Các giải pháp thay thế đã xem xét**:
  - *Database trigger hoặc PG Agent*: Khó quản lý việc giải phóng bộ nhớ đệm (cache invalidation) và khó giữ logic nghiệp vụ tập trung tại tầng ứng dụng.
  - *Kiểm tra khi truy vấn (Dynamic completion)*: Tính toán động trạng thái hoàn thành trên mỗi lượt truy vấn. Giải pháp này tuy đơn giản nhưng ngăn cản việc tối ưu hóa truy vấn và lập chỉ mục (index) ở mức cơ sở dữ liệu, đồng thời làm phức tạp hóa việc kích hoạt các thông báo hoặc nhắc nhở sau sự kiện.
- **Lựa chọn giải pháp**: Chạy cron job hàng giờ bằng cách sử dụng bộ lập lịch `@Cron` của NestJS. Công việc này sẽ truy vấn PostgreSQL tìm các concert đang hoạt động (`active`) có `endTime < NOW()`, cập nhật trạng thái của chúng thành `completed`, và xóa sạch bộ nhớ đệm Redis tương ứng.

### Decision 2: Chiến lược Migration cơ sở dữ liệu (Database Migration Strategy)
Vì cột `status` trong bảng `concerts` là kiểu `varchar(50)` thay vì kiểu dữ liệu PostgreSQL ENUM đặc thù, việc thực hiện lệnh `ALTER TYPE` trong database migration là không bắt buộc. Tuy nhiên, chúng ta sẽ viết một tệp migration để quét và cập nhật tất cả các concert trong quá khứ hiện có trong cơ sở dữ liệu từ trạng thái `active` sang trạng thái `completed`.

## Risks / Trade-offs

- **[Risk] Bất đồng bộ dữ liệu Cache** → Nếu cron job chuyển đổi concert sang trạng thái hoàn thành, thông tin được lưu trong bộ nhớ đệm Redis (`cache:concerts:{id}`) của concert đó có thể vẫn sẽ hiển thị trạng thái cũ `active`.
  - *Mitigation*: Tiến trình cron job bắt buộc phải xóa các khóa cache Redis tương ứng của các concert vừa được cập nhật, tương tự như quy trình cập nhật của `ConcertService`.
