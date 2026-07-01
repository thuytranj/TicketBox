# Proposal: Mobile UI Foundation — TicketBox Gate App

## What

Thiết lập design system và visual foundation hoàn chỉnh cho TicketBox Gate App (Flutter, `src/mobile`). Change này tạo ra tầng nền — tokens, theme, shared widgets, app shell — để tất cả các màn hình hiện tại và tương lai sử dụng nhất quán, không còn style inline rải rác.

Kết quả cụ thể:
- **GateAppTheme**: dark theme với semantic color tokens cho ops context.
- **Token files**: colors, typography, spacing, radii, elevation dưới `lib/core/theme/`.
- **Shared widgets**: button, card, loading state, error state, empty state, status chip, offline badge, scan result overlay.
- **App shell chuẩn hóa**: `main.dart` dùng theme mới, `GateScaffold` wrapper cho page scaffolding nhất quán.

Change **không đổi** bất kỳ business logic, backend contract, offline flow hay state management nào.

## Why

Gate App hiện tại dùng `ColorScheme.fromSeed(seedColor: Colors.blue)` và style inline (hardcoded `Colors.green`, `Colors.red`, `Colors.black87`, `EdgeInsets.all(16)`) rải rác ở mọi màn hình. Điều này tạo ra 3 vấn đề nghiêm trọng cho một ops tool dùng ngoài hiện trường:

1. **Không đủ tương phản**: Palette mặc định không đạt WCAG AA trong điều kiện ánh sáng hỗn hợp (sân khấu đêm, ngoài trời).
2. **Không nhất quán**: `Colors.green` ở `preload_screen` ≠ `Colors.green` ở `scanner_screen` về semantic nghĩa; không có shared language.
3. **Không scale được**: Mỗi màn hình mới sẽ tiếp tục tạo style mới thay vì dùng token chung.

UI Foundation là prerequisite cần thiết trước khi redesign từng màn hình (scanner feedback, login/UX, event selection).

## Scope

**Trong scope:**
- `lib/core/theme/` — token files (colors, typography, spacing, radii, elevation).
- `lib/core/theme/gate_app_theme.dart` — MaterialApp theme builder.
- `lib/shared/widgets/` — button, card, loading, error, empty state, status chip, offline badge.
- `main.dart` — switch sang GateAppTheme, không đổi provider/routing logic.
- `lib/shared/widgets/gate_scaffold.dart` — page scaffolding wrapper chuẩn hóa.

**Ngoài scope (non-goals):**
- Không redesign screen content của bất kỳ màn hình nào (`login_screen`, `event_list_screen`, `scanner_screen`, `preload_screen`).
- Không thay đổi state management, provider, service, repository.
- Không thay đổi backend contract hay offline logic.
- Không thêm routing library (go_router, auto_route) — chờ change riêng.
- Không thêm animation phức tạp — chờ phase sau.
- Không implement scan feedback redesign — chờ change `scanner-feedback-redesign`.

## Risks

| Risk | Khả năng | Mức độ | Mitigation |
|------|----------|--------|-----------|
| Theme token không cover hết edge case của screens hiện tại | Medium | Low | Chạy `flutter analyze` + widget test sau mỗi token file; xem xét mọi hardcoded color trong codebase trước khi viết token |
| Dark theme làm vỡ layout do contrast assumption | Low | Medium | Test từng screen trên dark mode trước khi merge; dùng `ThemeMode.dark` forced, không dùng system theme |
| Shared widgets có API không match nhu cầu màn hình sau | Low | Low | Widget API được thiết kế generically; docs đủ để screen sau biết cách dùng |
| `GateScaffold` wrapper phá vỡ navigation/back behavior | Low | Medium | `GateScaffold` chỉ wrap `Scaffold` với defaults nhất quán, không intercept navigation |

## Definition of Done

- [ ] `lib/core/theme/` tồn tại với đủ 5 token files (colors, typography, spacing, radii, elevation).
- [ ] `GateAppTheme.dark()` build thành công và được dùng trong `MaterialApp` của `main.dart`.
- [ ] Tất cả shared widgets trong `lib/shared/widgets/` có widget test cover happy path.
- [ ] `flutter analyze` không có warning mới từ change này.
- [ ] `flutter test` pass toàn bộ.
- [ ] Code review confirm không còn hardcoded color/spacing mới trong bất kỳ file nào thuộc change này.
- [ ] README hoặc docstring trên `GateAppTheme` giải thích cách sử dụng token.
