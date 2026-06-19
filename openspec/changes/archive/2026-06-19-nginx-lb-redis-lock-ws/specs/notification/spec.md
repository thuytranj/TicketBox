## ADDED Requirements

### Requirement: Phát thông báo qua Socket.io Redis Adapter
Hệ thống SHALL cấu hình Socket.io Server sử dụng Redis Adapter làm trung gian (broker) Pub/Sub để đồng bộ kết nối và định tuyến chính xác các sự kiện đẩy thông báo (push notifications) thời gian thực đến client đang kết nối tại bất kỳ API instance nào.

#### Scenario: Phát thông báo real-time thành công trên môi trường đa instances
- **WHEN** Một tác vụ nền (Worker) tạo thông báo mới cho người dùng đang trực tuyến tại API instance khác
- **THEN** Hệ thống thông qua Redis Adapter để gửi thông tin và kích hoạt sự kiện `notification_received` tới client trong vòng dưới 1 giây
