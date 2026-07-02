# Proposal: Mobile Preload & Sync UX

## What
Redesign màn hình preload dữ liệu offline (`PreloadScreen`) thành một trang vận hành trực quan, cung cấp thông tin rõ ràng về tiến độ tải, kết quả dữ liệu đã đồng bộ (số lượng vé thường, vé VIP), và đảm bảo nhân sự soát vé tự tin về trạng thái "Readiness" (sẵn sàng) của thiết bị trước khi bắt đầu soát vé offline tại cổng.

Đồng thời, nâng cấp `CheckinProvider` và `CheckinService` để cung cấp các thông tin thống kê số lượng dữ liệu offline đã preload thành công.

## Why
Theo kết quả audit UI/UX và vận hành thực tế tại cổng soát vé:
1. **Thiếu thông tin tiến độ:** Màn hình preload cũ chỉ hiển thị một loading spinner tối giản và câu thông báo chung chung. Nhân sự không biết app đang làm gì (tải vé hay lưu database) và mất bao lâu.
2. **Thiếu thống kê xác thực:** Khi preload hoàn tất, màn hình chỉ thông báo "Tải dữ liệu hoàn tất" mà không hiển thị số lượng vé đã tải xuống. Nhân sự không có cơ sở để đối chiếu với ban tổ chức (ví dụ: "Đã sync đủ 1,500 vé chưa?").
3. **Retry flow và Offline cues kém:** Nếu xảy ra lỗi mạng trong quá trình preload, thông báo lỗi hiển thị raw exception, không hướng dẫn nhân sự bật mạng hoặc kiểm tra kết nối để thử lại.
4. **Chưa có visual cues về tính offline-first:** Nhân sự chưa được giải thích rõ là dữ liệu đã được lưu an toàn dưới local để soát vé không cần mạng.

## Scope
**Trong scope:**
- `lib/features/checkin/screens/preload_screen.dart`: Redesign toàn bộ giao diện theo hướng vận hành chi tiết: hiển thị thông tin sự kiện, tiến độ các bước (step narrative), kết quả thống kê (số vé, số VIP), nút xác nhận vào màn hình scan, và giao diện lỗi có hướng dẫn rõ ràng.
- `lib/features/checkin/providers/checkin_provider.dart`: Bổ sung các properties đếm số lượng vé/VIP guests đã sync, bổ sung các sub-states/steps của tiến trình preload để cập nhật giao diện thời gian thực.
- `lib/features/checkin/services/checkin_service.dart`: Bổ sung các phương thức đếm số lượng ticket/vip_guest trong database cục bộ cho một concert cụ thể.
- Widget tests cho `PreloadScreen` bao gồm các trường hợp: đang tải (với các step), lỗi (có retry), và thành công (hiển thị thông tin thống kê vé).

**Ngoài scope (non-goals):**
- Không thay đổi schema SQLite của bảng `checkin_entries` hay `offline_checkin_logs`.
- Không thay đổi luồng checkin online/offline chính tại màn hình `ScannerScreen`.
- Không thay đổi API backend `/checkin/data`.

## Risks
| Risk | Khả năng | Mức độ | Mitigation |
|------|----------|--------|------------|
| Truy vấn đếm số lượng vé trong SQLite chậm trên thiết bị cấu hình yếu với số lượng vé cực lớn (>10k vé) | Thấp | Thấp | SQLite tối ưu index rất tốt trên primary/foreign key. Sử dụng transaction hoặc thực hiện query bất đồng bộ hợp lý. |
| Người dùng bấm "Vào màn hình Quét vé" khi preload chưa thực sự hoàn tất do lỗi logic | Thấp | Trung bình | Disable nút này hoàn toàn cho đến khi state chuyển sang `PreloadState.loaded`. |
| Không có mạng khiến preload thất bại liên tục và không thể soát vé | Cao | Cao | Hiển thị thông điệp lỗi rõ ràng hướng dẫn nhân sự kết nối Wi-Fi/4G để tải dữ liệu sự kiện ít nhất một lần trước khi vào cổng. |

## Definition of Done
- [ ] `PreloadScreen` sử dụng `GateScaffold`, đồng bộ visual design với Gate App theme mới.
- [ ] Hiển thị tiến trình preload qua ít nhất 3 bước trực quan (narrative): 1. Kết nối máy chủ, 2. Tải dữ liệu sự kiện, 3. Lưu trữ offline.
- [ ] Hiển thị thống kê số lượng vé và VIP guest đã tải xuống sau khi thành công.
- [ ] Giao diện báo lỗi preload hiển thị nút "Thử lại" hoạt động chính xác.
- [ ] `flutter analyze` không có cảnh báo/lỗi trên các file chỉnh sửa.
- [ ] Đạt coverage tốt với các widget tests mới được bổ sung.
