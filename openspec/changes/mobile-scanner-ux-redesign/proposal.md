# Proposal: Mobile Scanner UX Redesign

## What
Thiết kế lại toàn bộ giao diện và luồng tương tác của màn hình Quét vé (`ScannerScreen`) — màn hình quan trọng nhất của Gate App. Thay thế Bottom Sheet bằng mô hình hiển thị kết quả không chặn (non-blocking overlay / bottom result panel) tự động biến mất sau 1.8 giây, giúp nâng cao hiệu suất quét vé rảnh tay (hands-free continuous scanning) lên đến 2-3 lần.

Đồng thời cải tiến khung định vị camera (Scan Frame), tích hợp trạng thái online/offline thời gian thực, hiển thị chỉ số hàng đợi sync offline và luồng manual sync trực quan tại thanh công cụ.

## Why
Màn hình quét vé hiện tại có những điểm yếu nghiêm trọng khi vận hành thực tế ở cổng soát vé:
1. **Trải nghiệm quét bị ngắt quãng:** Mỗi lần quét, app hiển thị một Modal Bottom Sheet chặn đứng màn hình camera, buộc nhân sự phải dùng tay kia ấn nút "Tiếp tục quét" để tắt đi. Điều này làm mất thời gian và khiến việc soát vé bằng một tay cực kỳ khó khăn.
2. **Scan Frame tối giản:** Khung camera trống trơn không có hướng dẫn trực quan khiến nhân sự khó căn chỉnh mã QR vào tiêu cự.
3. **Màu sắc không tối ưu cho ngoài trời:** Các thông tin quan trọng hiển thị nhỏ, độ tương phản thấp, khó đọc dưới ánh sáng ban ngày chói chang hoặc ban đêm ánh sáng hỗn hợp.
4. **Trạng thái đồng bộ mù mờ:** Nút đồng bộ thủ công (manual sync) chỉ hiện thông báo SnackBar nhỏ dễ bị trôi đi và không báo cáo tiến độ chi tiết.

## Scope
**Trong scope:**
- `lib/features/checkin/screens/scanner_screen.dart`: Thiết kế lại toàn bộ giao diện: camera overlay, scan frame laser, inline result banner/panel tự động tắt sau 1.8 giây. Tích hợp app bar có hiển thị trạng thái kết nối mạng và queue pending sync.
- Tạo widget phụ trợ chuyên biệt hiển thị kết quả quét `ScanResultPanel` độc lập để dễ dàng viết Widget Tests mà không bị phụ thuộc vào camera stream của `mobile_scanner`.
- Bổ sung logic lắng nghe thay đổi trạng thái mạng (`ConnectivityResult`) và số lượng queue đồng bộ chưa tải lên từ `CheckinService`.
- Widget tests kiểm thử đầy đủ 4 trạng thái hiển thị của kết quả scan (Hợp lệ, Đã dùng, Không tồn tại, Lỗi) cùng hành vi tự động ẩn.

**Ngoài scope (non-goals):**
- Không thay đổi logic xử lý giải mã QR của thư viện `mobile_scanner`.
- Không thay đổi API backend hoặc thay đổi contract dữ liệu quét của `CheckinService`.

## Risks
| Risk | Khả năng | Mức độ | Mitigation |
|------|----------|--------|------------|
| Thời gian tự tắt 1.8 giây quá nhanh khiến nhân sự không kịp nhìn kết quả lỗi | Trung bình | Thấp | Cấu hình thời gian tự tắt linh hoạt: Vé "Hợp lệ" tự tắt nhanh (1.5s), các vé lỗi/trùng/không tồn tại tự tắt lâu hơn (2.5s) hoặc cho phép chạm màn hình để bỏ qua nhanh. |
| Camera quét quá nhạy gây quét lặp liên tục khi overlay chưa ẩn | Cao | Trung bình | Cơ chế chặn quét trùng QR cũ trong 3s được kết hợp với flag `_isProcessing` để khóa tạm thời camera trigger cho đến khi xử lý xong API và đóng panel. |
| Thư viện `mobile_scanner` gây crash hoặc lỗi layout trên một số emulator/test environment | Cao | Trung bình | Tách logic hiển thị panel kết quả ra một widget con độc lập để mock dữ liệu trong widget tests mà không cần bật camera thật. |

## Definition of Done
- [ ] Màn hình quét vé không dùng Bottom Sheet chặn camera để báo kết quả, thay thế bằng Bottom Result Panel tự động đóng sau 1.5s - 2.5s.
- [ ] Giao diện có Scan Frame định vị và laser scan animation.
- [ ] AppBar tích hợp online/offline badge và hiển thị real-time số lượng pending offline logs chưa sync.
- [ ] Nút manual sync hiển thị trạng thái đang xoay đồng bộ chi tiết.
- [ ] Kết quả quét phân biệt rõ 4 trạng thái bằng màu sắc tương phản cao, icons lớn, và tiêu đề rõ ràng.
- [ ] `flutter analyze` 0 lỗi linter trên code Scanner.
- [ ] Bộ widget tests kiểm thử 4 kết quả scan hoạt động chính xác.
