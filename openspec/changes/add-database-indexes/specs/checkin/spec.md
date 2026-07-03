## ADDED Requirements

### Requirement: Tối ưu hóa hiệu năng truy vấn soát vé
Hệ thống MUST sử dụng các chỉ mục (indexes) cơ sở dữ liệu để tối ưu hóa tốc độ tìm kiếm và xử lý các thao tác soát vé trực tiếp cũng như đồng bộ hóa ngoại tuyến, đảm bảo không chạy truy vấn quét toàn bộ bảng (Full Table Scan) khi dữ liệu tăng lớn.

#### Scenario: Truy vấn soát vé sử dụng Index Scan
- **WHEN** Hệ thống nhận mã QR và tìm kiếm vé/khách VIP theo `qrCodeHash` hoặc tìm kiếm đơn hàng theo `orderId`
- **THEN** Cơ sở dữ liệu MUST sử dụng phương thức Index Scan để truy xuất bản ghi ngay lập tức

#### Scenario: Cập nhật đồng bộ check-in sử dụng Index Scan
- **WHEN** Hệ thống thực hiện đồng bộ check-in ngoại tuyến và chạy lệnh cập nhật/vô hiệu hóa log check-in cũ theo `ticketId` hoặc `vipGuestId`
- **THEN** Cơ sở dữ liệu MUST định vị các bản ghi cần cập nhật thông qua Index Scan và thực hiện cập nhật mà không quét toàn bộ bảng log check-in
