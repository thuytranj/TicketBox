# Mobile UI/UX Redesign Roadmap

Tài liệu này tổng hợp lộ trình redesign toàn bộ giao diện `src/mobile` và bộ prompt chi tiết để triển khai bằng antigravity với OpenSpec workflow trong thư mục `.agent`.

## Mục tiêu

Biến `src/mobile` từ một Flutter app check-in còn thô thành một **Gate App** có:

- giao diện rõ ràng, hiện đại, phù hợp môi trường vận hành sự kiện
- UX tốt cho nhân sự soát vé, ưu tiên thao tác nhanh và ít nhầm lẫn
- trạng thái online/offline, preload, sync, scan result hiển thị rõ ràng
- design system đồng bộ, testable, dễ mở rộng

## Bối cảnh hiện tại

App mobile hiện là app cho staff check-in, không phải app audience. Các màn hình chính cần redesign:

- `src/mobile/lib/features/auth/screens/login_screen.dart`
- `src/mobile/lib/features/concerts/screens/event_list_screen.dart`
- `src/mobile/lib/features/checkin/screens/preload_screen.dart`
- `src/mobile/lib/features/checkin/screens/scanner_screen.dart`

Các workflow OpenSpec hiện có trong repo:

- `.agent/workflows/opsx-explore.md`
- `.agent/workflows/opsx-propose.md`
- `.agent/workflows/opsx-apply.md`
- `.agent/workflows/opsx-archive.md`

Active change liên quan mobile hiện có:

- `openspec/changes/mobile-app-init/`

## Chiến lược triển khai

Không gom toàn bộ redesign vào một change lớn. Chia thành 5 change nhỏ để:

- dễ kiểm soát scope
- dễ review
- dễ rollback
- cho phép antigravity vừa thiết kế, vừa code, vừa test theo từng chặng

## Thứ tự phase

1. `mobile-ui-foundation`
2. `mobile-auth-event-ux`
3. `mobile-preload-sync-ux`
4. `mobile-scanner-ux-redesign`
5. `mobile-polish-and-qa`

## Luồng làm việc khuyến nghị

### Bước 1: Audit trước khi sửa

Paste prompt này vào antigravity:

```text
/opsx:explore mobile gate app ui-ux audit

Hãy vào explore mode và audit toàn bộ src/mobile như một Gate App offline-first cho nhân sự soát vé.
Đọc các file chính:
- src/mobile/lib/main.dart
- src/mobile/lib/features/auth/screens/login_screen.dart
- src/mobile/lib/features/concerts/screens/event_list_screen.dart
- src/mobile/lib/features/checkin/screens/preload_screen.dart
- src/mobile/lib/features/checkin/screens/scanner_screen.dart
- src/mobile/lib/features/checkin/services/checkin_service.dart
- openspec/changes/mobile-app-init/proposal.md
- openspec/changes/mobile-app-init/design.md
- openspec/changes/mobile-app-init/tasks.md

Mục tiêu:
- Chỉ audit, không code.
- Liệt kê vấn đề UI, UX, accessibility, state handling, hierarchy, visual consistency, thao tác 1 tay, offline cues, scan feedback, error recovery.
- Vẽ ra target information architecture và component inventory.
- Đề xuất visual direction rõ ràng cho Gate App: high contrast, ops-focused, usable ngoài hiện trường.
- Kết thúc bằng danh sách 5 change OpenSpec nhỏ nhất nên tạo để redesign app an toàn.
```

## Phase 1: Mobile UI Foundation

### Mục tiêu

Thiết lập design system, theme, token, shared component, app shell cho toàn bộ mobile app.

### Prompt tạo change

```text
/opsx:propose mobile-ui-foundation

Tạo một change OpenSpec mới tên mobile-ui-foundation cho Flutter app trong src/mobile.

Mục tiêu change:
- Thiết lập design system và visual foundation cho TicketBox Gate App.
- Không đổi business logic backend/mobile contract.
- Tập trung vào theme, tokens, reusable widgets, app shell, global states.

Bối cảnh:
- App là Gate App cho staff check-in, không phải audience app.
- Cần ưu tiên tốc độ nhận biết, tương phản cao, thao tác 1 tay, trạng thái online/offline dễ thấy.
- Cần tránh UI Flutter mặc định và style inline rải rác.

Yêu cầu artifact:
- proposal.md phải nêu rõ scope, non-goals, risks, definition of done.
- design.md phải mô tả visual direction, color system, typography, spacing, radius, elevation, button hierarchy, status color mapping, snackbar/bottom sheet/dialog rules.
- tasks.md phải chia nhỏ theo task implementable.

Bắt buộc deliverables:
- lib/core/theme hoặc thư mục tương đương cho colors, typography, spacing, radii.
- shared widgets cho button, card, loading state, error state, empty state, status chip.
- chuẩn hóa MaterialApp theme trong main.dart.
- chuẩn hóa page scaffolding để các màn hình sau dùng chung.

Acceptance criteria:
- Không còn hard-coded styles mới phát sinh.
- Theme dùng được trên toàn app.
- Có widget nền tảng để phase sau tái sử dụng.
- Có kế hoạch test widget/analyze trong tasks.
```

### Prompt triển khai change

```text
/opsx:apply mobile-ui-foundation

Implement change mobile-ui-foundation trong src/mobile.
Hãy đọc toàn bộ artifact context rồi code.

Ràng buộc:
- Chỉ sửa mobile.
- Không đổi API contract.
- Ưu tiên refactor nhẹ main.dart và tạo nền tảng dùng lại.
- Giữ code sạch, không tạo abstraction thừa.

Bắt buộc sau khi implement:
- Chạy flutter analyze trong src/mobile.
- Chạy flutter test trong src/mobile.
- Nếu test thiếu coverage, thêm test tối thiểu cho theme/shared widget quan trọng.
- Update tasks.md checkbox ngay khi xong từng task.
- Kết thúc bằng diff summary, file touched, test result, residual risk.
```

## Phase 2: Mobile Auth + Event UX

### Mục tiêu

Redesign màn hình login và chọn sự kiện để có hierarchy tốt hơn, thao tác rõ hơn, đồng nhất với design system.

### Prompt tạo change

```text
/opsx:propose mobile-auth-event-ux

Tạo change mobile-auth-event-ux để redesign 2 màn hình:
- auth login
- event list / concert selection

Mục tiêu:
- Login phải có hierarchy tốt hơn, trạng thái loading/error tốt hơn, trust tốt hơn.
- Event list phải chuyển từ list tile cơ bản sang event cards có selected state rõ ràng và CTA dễ dùng.

Yêu cầu cụ thể:
- Login: brand header, form card, inline validation, show/hide password, loading button, error display chuẩn.
- Event list: event cards, selected state rõ, sticky bottom CTA thay vì phụ thuộc hoàn toàn vào FAB, empty/error/loading state nhất quán.
- Phải tận dụng design system từ mobile-ui-foundation.
- Không đổi luồng auth/concert service trừ khi cần rất nhỏ cho UX state.

Acceptance criteria:
- Staff có thể login và chọn concert với ít ambiguity hơn.
- Mọi state loading/error/empty đều có UI tốt.
- UI đồng nhất với theme mới.
- Có widget tests cho login state và event selection state.
```

### Prompt triển khai change

```text
/opsx:apply mobile-auth-event-ux

Implement mobile-auth-event-ux.
Hãy redesign code thật, không chỉ skin mỏng.

Tập trung vào:
- src/mobile/lib/features/auth/screens/login_screen.dart
- src/mobile/lib/features/concerts/screens/event_list_screen.dart
- provider/state liên quan nếu cần cho UX
- tận dụng shared components đã tạo

Bắt buộc:
- Giữ logic nghiệp vụ hiện có.
- Tối ưu spacing, hierarchy, tap targets, 1-handed usage.
- Chạy flutter analyze.
- Chạy flutter test.
- Thêm hoặc cập nhật widget tests cho 2 màn hình trên.
- Update tasks.md.
```

## Phase 3: Mobile Preload + Sync UX

### Mục tiêu

Biến preload screen thành màn hình vận hành rõ ràng, giúp staff biết app đã sẵn sàng quét hay chưa và sync offline đang ở trạng thái nào.

### Prompt tạo change

```text
/opsx:propose mobile-preload-sync-ux

Tạo change mobile-preload-sync-ux cho màn hình preload và trạng thái sync offline.

Mục tiêu:
- Biến preload screen thành màn hình vận hành rõ ràng, không còn là loading page tối giản.
- Làm rõ trạng thái dữ liệu offline, retry, readiness trước khi vào scan.

Yêu cầu:
- Hiển thị concert đang chuẩn bị.
- Hiển thị trạng thái preload theo step hoặc progress narrative.
- Hiển thị các trạng thái success/error/retry rõ ràng.
- Nếu lấy được số lượng vé / vipGuests, hiển thị chúng.
- Chuẩn hóa UX cho manual sync entry point và offline explanation.
- Tận dụng design system phase trước.

Acceptance criteria:
- Staff biết khi nào dữ liệu đã sẵn sàng để quét.
- Retry flow dễ hiểu.
- Online/offline cues rõ.
- Có widget tests cho preload success và preload error.
```

### Prompt triển khai change

```text
/opsx:apply mobile-preload-sync-ux

Implement mobile-preload-sync-ux.
Tập trung vào:
- src/mobile/lib/features/checkin/screens/preload_screen.dart
- provider/state liên quan
- nếu cần, expose thêm dữ liệu presentation-safe từ checkin service nhưng không đổi API contract

Bắt buộc:
- Không phá preload flow hiện tại.
- Chạy flutter analyze.
- Chạy flutter test.
- Thêm widget tests cho preload screen states.
- Update tasks.md.
```

## Phase 4: Mobile Scanner UX Redesign

### Mục tiêu

Đây là phase quan trọng nhất. Scanner phải chuyển từ “màn hình camera + bottom sheet đơn giản” thành tool vận hành chuyên dụng cho check-in.

### Prompt tạo change

```text
/opsx:propose mobile-scanner-ux-redesign

Tạo change mobile-scanner-ux-redesign cho ScannerScreen, đây là màn hình quan trọng nhất của Gate App.

Mục tiêu:
- Thiết kế lại scanner thành experience vận hành chuyên dụng, nhanh, rõ, an toàn ngoài hiện trường.

Yêu cầu:
- Scan frame rõ ràng.
- Overlay camera đẹp và có chức năng.
- Online/offline badge.
- Manual sync action rõ hơn.
- Kết quả scan phải có 4 trạng thái nổi bật: hợp lệ, đã dùng, không tồn tại, lỗi kết nối/offline fallback.
- Result sheet hoặc overlay phải đọc được trong dưới 1 giây.
- Chống scan trùng rõ ràng hơn về UX.
- Tối ưu feedback bằng màu, icon, chữ, không phụ thuộc riêng màu.
- Có thể thêm scan history ngắn hoặc last result zone nếu hợp lý.
- Không thay đổi backend contract.

Acceptance criteria:
- Scanner UX tốt hơn rõ rệt.
- Staff nhìn một lần biết cho qua hay chặn lại.
- Flow manual sync rõ.
- Có widget tests cho result state mapping; nếu camera khó test, tách presentation widget để test.
```

### Prompt triển khai change

```text
/opsx:apply mobile-scanner-ux-redesign

Implement mobile-scanner-ux-redesign.
Tập trung vào:
- src/mobile/lib/features/checkin/screens/scanner_screen.dart
- presentation widgets phụ nếu cần
- mapping kết quả từ checkin service sang UI state
- không thay business contract, chỉ nâng UX và structure

Bắt buộc:
- Refactor để UI result state testable.
- Nếu cần, tách bottom sheet/result card/widget riêng.
- Chạy flutter analyze.
- Chạy flutter test.
- Thêm widget tests cho VALID / ALREADY_USED / NOT_FOUND / generic error states.
- Update tasks.md.
```

## Phase 5: Mobile Polish And QA

### Mục tiêu

Rà soát consistency, accessibility, test, README và hoàn thiện app sau redesign.

### Prompt tạo change

```text
/opsx:propose mobile-polish-and-qa

Tạo change mobile-polish-and-qa để hoàn thiện mobile gate app sau redesign.

Mục tiêu:
- polish toàn app
- accessibility
- visual consistency audit
- test stabilization
- README update

Yêu cầu:
- rà soát typography, spacing, tap targets, icon consistency, Vietnamese copywriting
- đảm bảo dark/high-contrast ops look nhất quán
- bổ sung widget tests còn thiếu
- cập nhật src/mobile/README.md theo workflow mới
- nếu có state chưa đẹp, fix ở mức polish chứ không mở rộng scope tính năng

Acceptance criteria:
- flutter analyze sạch
- flutter test pass
- UX copy rõ ràng, nhất quán
- README phản ánh đúng cách chạy app và flow check-in
```

### Prompt triển khai change

```text
/opsx:apply mobile-polish-and-qa

Implement mobile-polish-and-qa.
Hãy audit lại toàn bộ mobile app sau các phase trước, fix inconsistency, hoàn thiện tests và docs.

Bắt buộc:
- chạy flutter analyze
- chạy flutter test
- cập nhật README nếu flow thay đổi
- tóm tắt những gì đã polish và những gì còn deferred
- update tasks.md
```

## Archive Sau Mỗi Phase

Chỉ archive khi phase đó đã xong thật sự:

```text
/opsx:archive mobile-ui-foundation
/opsx:archive mobile-auth-event-ux
/opsx:archive mobile-preload-sync-ux
/opsx:archive mobile-scanner-ux-redesign
/opsx:archive mobile-polish-and-qa
```

## Guardrails Khi Dùng Antigravity

- Luôn truyền rõ tên change vào `/opsx:apply`.
- Không để agent tự mở rộng scope sang backend/frontend.
- Không cho agent đổi API contract trừ khi mở change riêng.
- Nếu agent phát hiện blocker về contract backend, yêu cầu nó dừng và ghi ra issue/spec delta thay vì tự sửa logic backend.
- Mỗi phase đều phải:
  - đọc context files từ OpenSpec
  - implement code thật
  - cập nhật `tasks.md`
  - chạy `flutter analyze`
  - chạy `flutter test`

## Definition Of Done Tổng Thể

Mobile redesign được xem là hoàn tất khi:

- không còn màn hình nào mang cảm giác Flutter demo mặc định
- login, event list, preload, scanner đều có loading/error/empty/success state rõ ràng
- scanner cho feedback tức thì, dễ đọc, ít ambiguity
- trạng thái online/offline/sync hiển thị rõ cho staff
- design system đồng nhất trên toàn app
- `flutter analyze` sạch
- `flutter test` pass

## Gợi Ý Chạy Theo Ngày

### Ngày 1

- audit bằng `/opsx:explore`
- propose + apply `mobile-ui-foundation`

### Ngày 2

- propose + apply `mobile-auth-event-ux`

### Ngày 3

- propose + apply `mobile-preload-sync-ux`

### Ngày 4

- propose + apply `mobile-scanner-ux-redesign`

### Ngày 5

- propose + apply `mobile-polish-and-qa`
- archive các change đã hoàn tất

