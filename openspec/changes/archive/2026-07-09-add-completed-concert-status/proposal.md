## Why

Hiện tại, các concert đã qua/đã kết thúc vẫn được đánh dấu là `active` trong cơ sở dữ liệu. Điều này yêu cầu các truy vấn và logic nghiệp vụ phải liên tục so sánh khoảng thời gian (`endTime < now`) để phân biệt giữa concert sắp diễn ra và concert đã kết thúc.
Việc bổ sung thêm một trạng thái chuyên biệt `completed` cho các concert sẽ đơn giản hóa logic nghiệp vụ, tối ưu hóa việc lập chỉ mục (index) và tăng hiệu năng truy vấn database (đặc biệt là cho trang thống kê/dashboard), đồng thời thể hiện rõ ràng giai đoạn thực tế trong vòng đời của mỗi concert.

## What Changes

- Bổ sung trạng thái mới `completed` vào enum `ConcertStatus`.
- Cập nhật định nghĩa Entity Concert để chấp nhận trạng thái `completed` mới.
- **BREAKING**: Chỉnh sửa các endpoints, bộ lọc và logic nghiệp vụ vốn trước đây giả định các concert cũ nằm dưới trạng thái `active`, chuyển sang sử dụng trạng thái `completed`.
- Cập nhật script seed dữ liệu mẫu để đánh dấu các concert trong quá khứ (ví dụ: Rap Viet Finals 2025, Indie Sound Concert 2025, v.v.) với trạng thái `completed`.
- Thêm một cron job/background task mới (hoặc cập nhật task hiện tại) để tự động chuyển trạng thái các concert từ `active` sang `completed` khi `endTime` trôi qua.

## Capabilities

### New Capabilities
*Không có*

### Modified Capabilities
- `concert`: Thêm trạng thái `COMPLETED` vào vòng đời concert, entity và các phản hồi API.
- `stats`: Cập nhật các truy vấn thống kê trên dashboard để tính toán chính xác theo trạng thái `completed` mới.

## Impact

- **Cơ sở dữ liệu**: Cột `status` trong bảng `concerts` sẽ chấp nhận giá trị `'completed'`. Cần tạo tệp migration.
- **Backend API**: Các API danh sách concert, endpoint lọc và tính toán thống kê cần xử lý hợp lý trạng thái `completed`.
- **Frontend App**: Admin Dashboard và các màn hình hiển thị danh sách concert cần hiển thị trạng thái `completed` và lọc chính xác.
