# Design: Mobile Scanner UX Redesign

## 1. Scanner Screen Layout Structure

Màn hình Scanner sẽ sử dụng cấu trúc `Stack` xếp chồng lớp để đảm bảo camera chạy toàn màn hình và các thông tin vận hành hiển thị nổi bật phía trên.

```
┌──────────────────────────────────────────┐
│ AppBar: Quét vé - Rock Night 2026        │  ← GateScaffold AppBar
│ [ONLINE] ⚡ 5 pending  [Sync] [Flash]     │  ← Badge trạng thái & nút bấm
├──────────────────────────────────────────┤
│                                          │
│             CAMERA SCAN STREAM           │
│                                          │
│               ┌──────────┐               │
│               │  ┌────┐  │               │  ← Khung ngắm định vị (Scan Frame)
│               │  └────┘  │               │  ← Đường laser chạy lên xuống
│               └──────────┘               │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│ BOTTOM ZONE: RESULT PANEL (Non-blocking) │
│ ┌──────────────────────────────────────┐ │
│ │  🎫 HỢP LỆ (Online)                 │ │  ← Trạng thái vé (nổi bật cực đại)
│ │  Vé thường | Khu A                   │ │  ← Chi tiết entry local/backend khi có
│ │  Tự động ẩn sau 1.5 giây             │ │  ← Đếm lùi tự động đóng
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### Stack Layers Spec

1. **Lớp 1: Camera Preview (`MobileScanner`)**
   - Chạy full screen làm hình nền.
   - Khi có kết quả quét mới, camera tạm thời bị block quét mã mới (để tránh quét trùng liên tục) cho đến khi panel kết quả cũ tự động ẩn hoặc qua thời gian cooldown 1.5 giây.

2. **Lớp 2: Khung định vị quét (Scan Frame Overlay)**
   - Khung ngắm căn chỉnh hình vuông `250dp x 250dp` nằm ở tâm màn hình.
   - Viền khung bo tròn nhẹ, độ dày 3dp, màu tím primary (`GateColors.primary`). Khi quét thành công hoặc lỗi, viền có thể chuyển màu tương ứng trong 0.5s để tạo feedback trực quan tức thì.
   - **Laser Line Animation**: Một đường thẳng màu tím ngang quét lên xuống liên tục trong khung ngắm để staff biết camera đang hoạt động bình thường.

3. **Lớp 3: Bottom ScanResultPanel**
   - Đặt ở bottom màn hình (`Positioned(bottom: 24)` hoặc dùng bottom bar của scaffold).
   - Thiết kế dạng nổi (floating card) với radius lớn (`GateRadii.lg`).
   - Panel này hiển thị kết quả của lần quét vé gần nhất.
   - **Cơ chế tự động ẩn (Auto-dismiss)**:
     - Vé **Hợp lệ (VALID)**: Tự động đóng sau **1.5 giây** để tối ưu hóa tốc độ soát vé.
     - Vé **Lỗi / Đã dùng / Không tồn tại (ERROR / ALREADY_USED / NOT_FOUND)**: Tự động đóng sau **2.5 giây** để staff kịp nhận biết thông tin.
     - Cho phép chạm (tap) trực tiếp vào Panel để đóng ngay lập tức (instant dismiss) giúp quét tiếp không cần chờ.

---

## 2. ScanResultPanel Visual Specifications

Giao diện của `ScanResultPanel` được tối ưu hóa cho độ tương phản tối đa ngoài trời:

| Trạng thái | Nền Container | Icon | Tiêu đề hiển thị | Text Chi tiết |
|------------|---------------|------|------------------|---------------|
| **HỢP LỆ** | `GateColors.scanValid.container` | `Icons.check_circle_rounded` màu xanh | **HỢP LỆ** | "Vé thường | Khu A" khi local cache có metadata |
| **ĐÃ DÙNG** | `GateColors.scanUsed.container` | `Icons.warning_rounded` màu cam | **VÉ ĐÃ SỬ DỤNG** | "Khách VIP | Đã check-in lúc 19:30" khi có timestamp |
| **KHÔNG TỒN TẠI**| `GateColors.scanInvalid.container`| `Icons.cancel_rounded` màu đỏ | **MÃ VÉ KHÔNG ĐÚNG** | "Mã vé không tồn tại trên hệ thống" |
| **LỖI KẾT NỐI**| `GateColors.scanError.container` | `Icons.cloud_off_rounded` màu xám | **LỖI ĐỒNG BỘ** | "Mất kết nối. Thử lại sau." |

### Text Hierarchy inside Panel
- **Tiêu đề:** Font size 24dp, `FontWeight.w700`, màu chữ tương ứng với accent color (`VALID` -> xanh, `USED` -> cam, `INVALID` -> đỏ).
- **Chi tiết:** Font size 15dp, màu chữ `onSurface`, ghi rõ loại vé, khu vực cổng hoặc thời gian quét trùng nếu có.
- **Badge trạng thái mạng:** Hiển thị nhãn nhỏ ghi rõ quét ở chế độ "(Online)" hay "(Offline Fallback)" để staff nắm được tình trạng đồng bộ dữ liệu.

---

## 3. Real-time Sync & Connectivity

### Thống kê hàng đợi sync offline thời gian thực (Real-time pending sync count)
Để hiển thị số lượng pending offline logs trên AppBar, chúng ta cần:
1. Thêm method `Future<int> getPendingLogCount(String concertId)` vào `CheckinService` thực thi câu lệnh:
   ```sql
   SELECT COUNT(*) FROM offline_checkin_logs WHERE concert_id = ? AND upload_status = 'pending'
   ```
2. Trong `ScannerScreen`, khởi động một `Timer` chạy tuần hoàn mỗi 3 giây (hoặc cập nhật trực tiếp sau mỗi lần offline scan/manual sync) để truy vấn SQLite và cập nhật số lượng pending logs lên AppBar.

### Connectivity State
Sử dụng Stream `Connectivity().onConnectivityChanged` có sẵn trong `CheckinService` (hoặc lắng nghe trong Screen) để cập nhật màu sắc badge Online/Offline trên AppBar.

---

## 4. Code Structure & Testability

Để widget tests hoạt động ổn định mà không cần khởi tạo camera stream thực của `mobile_scanner`, chúng ta sẽ tách logic hiển thị Panel kết quả thành widget độc lập:

- `lib/features/checkin/widgets/scan_result_panel.dart`
  - Nhận model dữ liệu `ScanResult` (hoặc Map kết quả) và `VoidCallback onClose`.
  - Quản lý Timer đếm ngược tự đóng cục bộ.
  - Widget tests sẽ pump widget này với các dữ liệu mock khác nhau để kiểm tra giao diện tương phản và icons.
