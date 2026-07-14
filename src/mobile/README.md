# TicketBox Gate App 🎫

Ứng dụng soát vé chuyên dụng dành cho Nhân sự soát vé (Gate Staff) tại hiện trường sự kiện của hệ thống TicketBox. Được xây dựng trên nền tảng **Flutter** với triết lý thiết kế **Offline-First**, đảm bảo cổng soát vé vận hành trơn tru ngay cả khi kết nối mạng chập chờn hoặc mất hoàn toàn.

---

## 🛠 Hướng dẫn thiết lập Môi trường Phát triển

Ứng dụng mobile hiện mặc định gọi backend đã deploy tại:

```text
https://api.ticketboxz.me/api/v1
```

Bạn có thể chạy app trực tiếp mà **không cần khởi động backend local**:

```bash
cd src/mobile
flutter run
```

### Override sang backend local khi cần

Nếu bạn muốn test với backend local, hãy tự khởi động PostgreSQL, Redis, RabbitMQ và backend, sau đó truyền lại `API_BASE_URL` khi chạy Flutter.

```bash
# Terminal 1
docker compose up -d postgres redis rabbitmq

# Terminal 2
cd src/backend
npm run migration:run
npm run db:seed:direct
npm run start:dev
```

*Backend local mặc định chạy tại `http://localhost:3000`.*

### Thiết lập Port Forwarding cho Android khi dùng backend local

Nếu bạn chạy ứng dụng trên thiết bị Android thật hoặc Emulator và muốn gọi backend local, hãy chạy:

```bash
adb devices
adb reverse tcp:3000 tcp:3000
```

### Cấu hình `API_BASE_URL` khi cần override

*   **Android Studio / VS Code configuration args:**
    ```bash
    --dart-define=API_BASE_URL=http://127.0.0.1:3000/api/v1
    ```
*   **Chạy trực tiếp từ Flutter CLI:**
    ```bash
    flutter run --dart-define=API_BASE_URL=http://127.0.0.1:3000/api/v1
    ```

---

## 🏗 Kiến trúc dữ liệu Offline-First (Offline-First Architecture)

Ứng dụng Gate App được thiết kế để không bao giờ bị gián đoạn soát vé tại cổng khi mất mạng. Kiến trúc hoạt động dựa trên cơ chế lưu đệm (Caching) và đồng bộ hóa ngầm (Background Sync):

```
                        ┌──────────────────────────────┐
                        │      API Server Backend      │
                        └──────────────┬───────────────┘
                                       │
                                 Sync / Preload
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📱 TicketBox Gate App (Local Device)                                        │
│                                                                             │
│   ┌────────────────────────┐                   ┌────────────────────────┐   │
│   │ SQLite Local Database  │ ◄─── Process ─────┤ Camera QR Scanner      │   │
│   │                        │                   │                        │   │
│   │ 1. checkin_entries     │                   │ 1. Quét mã QR code     │   │
│   │ 2. offline_checkin_logs│ ─── Background ──►│ 2. Tự tắt panel (1.5-2.5s)│ │
│   └────────────────────────┘         Sync      └────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Các bảng SQLite cục bộ:
1.  `checkin_entries`: Lưu danh sách toàn bộ vé và khách mời VIP của sự kiện đã đồng bộ về máy trong bước **Preload**. Khi quét mã QR ở chế độ offline, app sẽ cập nhật trạng thái `checkin_status` thành `checked_in` trực tiếp trên bảng này.
2.  `offline_checkin_logs`: Lưu trữ hàng đợi các lượt quét thành công ở chế độ offline. Mỗi bản ghi lưu mã code, thiết bị, và thời gian quét.

### Cơ chế đồng bộ ngầm (Background Sync Stream):
Ứng dụng sử dụng gói `connectivity_plus` để lắng nghe trạng thái kết nối mạng thời gian thực.
*   Khi thiết bị chuyển từ **OFFLINE ➡️ ONLINE**: Luồng ngầm (`Connectivity().onConnectivityChanged`) tự động kích hoạt tiến trình đẩy toàn bộ dữ liệu từ `offline_checkin_logs` lên máy chủ API qua endpoint `/checkin/sync`.
*   Trạng thái đồng bộ được phản ánh trực tiếp trên AppBar thông qua badge số lượng vé chưa sync (ví dụ: `⚡ 5 pending`).
*   Khi staff bấm đồng bộ thủ công, phản hồi thành công chỉ có nghĩa là log đã được **đưa vào hàng đợi xử lý của backend**, chưa phải kết quả đối soát cuối cùng.

### Danh sách sự kiện & lọc
Concert được tải về từ hai endpoint song song: `GET /concerts?status=active` và `GET /concerts?status=completed`. App gộp (merge) và loại trùng (dedupe) theo `id` trước khi hiển thị — active ưu tiên nếu cùng ID. Nếu endpoint `completed` không được hỗ trợ, app tiếp tục bình thường chỉ với danh sách active.

**Màn hình EventListScreen** cho phép staff:
- Tìm kiếm nhanh theo tên hoặc địa điểm (local, case-insensitive) qua thanh search cố định phía trên.
- Lọc theo 3 tab: **Hôm nay** (mặc định), **Sắp diễn ra**, **Đã diễn ra**.
- Phân trang cục bộ 6 concert/trang sau khi áp filter + search.
- **Chạm trực tiếp vào card concert** → điều hướng ngay sang màn Check-in Dashboard (`PreloadScreen`) mà không qua bước xác nhận trung gian.

### Check-in Readiness Dashboard (`PreloadScreen`)
Khi staff chọn một concert, app tự động tải dữ liệu vé xuống nền và chuyển sang màn **Check-in Readiness Dashboard**. Đây là màn hình trung gian trước khi vào camera quét QR.

**Bố cục:**
- **Header**: Tên concert lớn + địa điểm + ngày giờ (nếu có) + nhãn `SỰ KIỆN ĐANG MỞ`.
- **Dòng trạng thái** (realtime, dựa vào `Connectivity().onConnectivityChanged`):
  - Đang tải: `Đang chuẩn bị dữ liệu check-in...`
  - Đã đồng bộ + online: `● Trạng thái: Đã đồng bộ (Ngoại tuyến sẵn sàng)`
  - Đã đồng bộ + offline: `● Trạng thái: Mất kết nối (Đang chạy chế độ offline)`
  - Lỗi: `● Trạng thái: Chưa sẵn sàng`
- **3 số liệu lớn** (sau khi tải xong): Đã quét (`checked_in / total`), Vé còn lại, VIP chưa vào — đọc trực tiếp từ SQLite local.
- **Nút chính**: `BẮT ĐẦU QUÉT MÃ QR` → mở `ScannerScreen`.
- **Khi lỗi**: Card thông báo ngắn (sanitized, user-facing) + nút `Thử lại`.

> Màn hình này không hiển thị bất kỳ log kỹ thuật nào (bước kết nối, tải, lưu trữ). Toàn bộ tiến trình backend được ẩn, chỉ phản ánh kết quả cuối cho staff.

---

## 🎨 Quy tắc sử dụng Design System (Design Tokens System)

Mã nguồn trong ứng dụng tuyệt đối **không sử dụng** màu sắc thô (`Colors.xyz`) hoặc khoảng cách tùy tiện. Lập trình viên bắt buộc phải sử dụng hệ thống token trong barrel export `package:ticketbox_mobile/core/theme/theme.dart`:

### 1. Token Màu sắc (`GateColors`)
*   `GateColors.background`: Màu nền tối chủ đạo (near-black) giảm mỏi mắt ngoài trời.
*   `GateColors.surface` / `GateColors.surfaceHigh`: Màu nền của thẻ hoặc panel.
*   `GateColors.primary`: Màu tím thương hiệu dùng cho các nút bấm chính.
*   `GateColors.scanValid` / `GateColors.scanUsed` / `GateColors.scanInvalid`: Màu trạng thái kết quả quét (mỗi loại gồm có `primary`, `container`, `onContainer`).

### 2. Spacing (`GateSpacing`)
Sử dụng lưới khoảng cách 8-point để padding hoặc gap:
*   `GateSpacing.xs` (4.0) | `GateSpacing.sm` (8.0) | `GateSpacing.md` (16.0) | `GateSpacing.lg` (24.0) | `GateSpacing.xl` (32.0).
*   *Tiện ích vertical / horizontal spacer:*
    ```dart
    GateSpacing.vertical(GateSpacing.md); // Trả về SizedBox(height: 16)
    ```

### 3. Typography (`GateTypography`)
Tất cả các Text Widget nên sử dụng TextTheme hoặc gọi trực tiếp:
*   `GateTypography.scanResult`: Nhãn kết quả lớn (48dp).
*   `GateTypography.heading1` / `GateTypography.heading2`: Tiêu đề chính/phụ.
*   `GateTypography.bodyLarge` / `GateTypography.bodyMedium`: Chữ hiển thị thông tin.
*   `GateTypography.counter`: Dùng `FontFeature.tabularFigures()` cho bộ đếm số lượng vé, tránh tình trạng nhảy lệch giao diện khi số thay đổi.

---

## 🧪 Phân tích Tĩnh & Chạy Kiểm thử

Đảm bảo chạy phân tích tĩnh và test trước khi tạo Pull Request:

### 1. Phân tích Tĩnh (Static Analysis)
```bash
flutter analyze lib/ test/ --no-fatal-infos
```

### 2. Chạy Bộ Tests
```bash
flutter test test/
```

#### Test coverage hiện tại

| Module | File test | Scope |
|--------|-----------|-------|
| Login screen | `test/features/auth/login_screen_test.dart` | UI states, form validation, error display |
| Auth restore | `test/features/auth/auth_provider_test.dart` | Offline degraded mode, 401+refresh, invalid role |
| Event list | `test/features/concerts/event_list_screen_test.dart` | Loading/error/empty states; search bar render; 3-tab filter (Hôm nay mặc định); tab switches concerts; pagination next/prev; tap card → route push (no confirm CTA); no sticky bottom bar |
| Concert provider | `test/features/concerts/concert_provider_test.dart` | State transitions, fetch trigger, error handling — no selection-tracking state |
| Concert service | `test/features/concerts/concert_service_test.dart` | `/concerts` multi-page aggregation; `getAllConcerts()` active+completed parallel fetch, merge, dedupe by id, graceful degradation when completed fetch fails |
| Check-in Dashboard | `test/features/checkin/preload_screen_test.dart` | Concert identity header (title, location, SỰ KIỆN ĐANG MỞ); loading shows readiness message (no step log labels); loaded shows status line + 3 metrics (Đã quét/Vé còn lại/VIP chưa vào) + BẮT ĐẦU QUÉT MÃ QR; error shows sanitized message + Thử lại; no dev-facing step icons |
| Scanner screen | `test/features/checkin/scanner_screen_test.dart` | AppBar contract, scan frame overlay, manual sync messaging |
| ScanResultPanel | `test/features/checkin/scan_result_panel_test.dart` | 4 states, auto-dismiss, tap dismiss, one-shot guard |
| Scan throttle | `test/features/checkin/scan_throttle_test.dart` | Duplicate QR cooldown acceptance/rejection logic |
| Sync/preload logic | `test/features/checkin/checkin_service_test.dart` | Logic-level sync guard and preload merge invariants only |
| Shared widgets | `test/shared/` | GateButton, GateCard, GateErrorState, etc. |

> **Note:** `CheckinService` full integration tests (`processScan`, `syncOfflineLogs`, preload with a real SQLite DB)
> still require `sqflite_common_ffi`, which is not yet in `dev_dependencies`. Offline-resume routing and real
> camera/plugin integration are still not covered by an integration-style test run. These remain known test gaps.
