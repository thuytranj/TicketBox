# Design: Mobile Preload & Sync UX

## 1. UX & Visual Architecture of PreloadScreen

Màn hình Preload sẽ được thiết kế lại để hiển thị đầy đủ thông tin vận hành dưới dạng một bảng điều khiển kiểm tra mức độ sẵn sàng (Readiness Dashboard).

### ASCII Wireframe

```
┌──────────────────────────────────────────┐
│ AppBar: Chuẩn bị soát vé                 │
├──────────────────────────────────────────┤
│                                          │
│  SỰ KIỆN ĐANG CHUẨN BỊ                   │
│  ┌────────────────────────────────────┐  │
│  │ 🎫 Rock Night 2026                 │  │
│  │ 📍 Hà Nội Arena                    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  TIẾN TRÌNH ĐỒNG BỘ                      │
│  ┌────────────────────────────────────┐  │
│  │  ● [1] Kết nối máy chủ ........ OK │  │
│  │  ● [2] Tải dữ liệu vé ......... OK │  │
│  │  ⏳ [3] Lưu trữ offline ...... 80%  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  THÔNG TIN DỮ LIỆU OFFLINE               │
│  ┌────────────────────────────────────┐  │
│  │  Tổng số vé thường:  1,420         │  │
│  │  Tổng số khách VIP:   120          │  │
│  │  Trạng thái: Sẵn sàng soát offline  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ℹ Thiết bị sẽ tự động chuyển sang chế   │
│    độ soát vé offline khi mất kết nối.   │
│                                          │
├──────────────────────────────────────────┤
│ BOTTOM BAR:                              │
│ [ Vào màn hình Quét vé ] (Hoặc Thử lại)   │
└──────────────────────────────────────────┘
```

### Detailed Design Specs

1. **Zone 1: Event Information Card**
   - Sử dụng `GateCard(elevated: true)` để bọc thông tin sự kiện.
   - Title của event hiển thị bằng `GateTypography.heading2` với màu `GateColors.onBackground`.
   - Location hiển thị kèm icon `Icons.location_on_outlined` bằng `GateTypography.bodyMedium` màu `GateColors.onSurfaceSub`.

2. **Zone 2: Sync Progress Narrative (Step-by-step indicator)**
   - Hiển thị 3 bước đồng bộ:
     1. **Kết nối máy chủ** (`connecting`): Xác thực endpoint và API status.
     2. **Tải dữ liệu từ máy chủ** (`downloading`): Nhận payload json từ API `/checkin/data`.
     3. **Lưu trữ database an toàn** (`saving`): Ghi dữ liệu vào SQLite.
   - Mỗi bước có 3 trạng thái visual:
     - *Chưa bắt đầu / Chờ:* Text màu `onSurfaceSub`, icon circle rỗng hoặc `Icons.radio_button_unchecked_rounded`.
     - *Đang thực hiện:* Spinner nhỏ (20x20) hoặc icon `Icons.sync` xoay nhẹ, text màu `GateColors.primary`.
     - *Hoàn thành:* Icon check xanh `Icons.check_circle_outline_rounded` màu `GateColors.networkOnline`, text màu `onSurface`.
     - *Thất bại:* Icon lỗi đỏ `Icons.error_outline_rounded` màu `GateColors.scanInvalid.primary`, text màu `GateColors.scanInvalid.primary`.

3. **Zone 3: Database Offline Summary Card**
   - Chỉ xuất hiện khi `PreloadState.loaded`.
   - Hiển thị thống kê dạng grid hoặc list:
     - Số lượng vé thường (`ticketCount`) kèm icon `Icons.local_activity_outlined`.
     - Số lượng VIP guests (`vipCount`) kèm icon `Icons.star_outline_rounded`.
   - Bổ sung thông tin: "Dữ liệu được lưu trữ offline thành công lúc [Giờ hiện tại]".
   - Trạng thái hoạt động: Hiển thị một badge màu xanh `GateColors.networkOnline` ghi "SẴN SÀNG" để nhân sự an tâm.

4. **Zone 4: Bottom Action Bar**
   - Cung cấp một `GateButton.primary` lớn (56dp height):
     - Khi đang load: Button bị disabled, hiển thị text "Đang chuẩn bị...".
     - Khi thành công: Button enabled, hiển thị text "Vào màn hình Quét vé", icon `Icons.qr_code_scanner_rounded`.
     - Khi thất bại: Button hiển thị text "Thử lại", màu đỏ hoặc secondary border, gọi lại `preloadData`.

---

## 2. API Contract & Database Services Extension

### Database Helper / Service Updates
Trong `CheckinService`, bổ sung 2 query methods:
```dart
Future<int> getTicketCount(String concertId) async {
  final db = await _dbHelper.database;
  final result = await db.rawQuery(
    "SELECT COUNT(*) as count FROM checkin_entries WHERE concert_id = ? AND entry_type = 'ticket'",
    [concertId],
  );
  return Sqflite.firstIntValue(result) ?? 0;
}

Future<int> getVipCount(String concertId) async {
  final db = await _dbHelper.database;
  final result = await db.rawQuery(
    "SELECT COUNT(*) as count FROM checkin_entries WHERE concert_id = ? AND entry_type = 'vip_guest'",
    [concertId],
  );
  return Sqflite.firstIntValue(result) ?? 0;
}
```

### Provider State & Steps Updates
Trong `CheckinProvider`, mở rộng state management:
```dart
enum PreloadStep { initial, connecting, downloading, saving, completed, error }

class CheckinProvider with ChangeNotifier {
  // ...
  PreloadStep _currentStep = PreloadStep.initial;
  int _ticketCount = 0;
  int _vipCount = 0;
  
  PreloadStep get currentStep => _currentStep;
  int get ticketCount => _ticketCount;
  int get vipCount => _vipCount;
  
  // Logic preloadData sẽ cập nhật _currentStep liên tục:
  // 1. _currentStep = PreloadStep.connecting
  // 2. Gọi API -> _currentStep = PreloadStep.downloading
  // 3. Nhận data, chuẩn bị ghi DB -> _currentStep = PreloadStep.saving
  // 4. Ghi DB xong, đếm số lượng -> _currentStep = PreloadStep.completed
}
```

---

## 3. UI Colors & Accessibility

- Màn hình sử dụng theme tối mặc định (`ThemeMode.dark`).
- **High Contrast**: Nút "Thử lại" khi bị lỗi sẽ dùng màu đỏ hoặc viền rõ ràng, text to dễ đọc.
- **Offline Cue**: Sử dụng màu sắc của `GateColors.networkOnline` cho trạng thái Sẵn sàng và `GateColors.networkOffline` cho các cảnh báo mất mạng.
- **Semantics**: Giao diện tiến độ và thống kê số vé sẽ được gắn `Semantics` label rõ ràng để các trình đọc màn hình hỗ trợ tốt cho nhân sự có khiếm khuyết thị lực nhẹ.
