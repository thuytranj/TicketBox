# Tasks: Mobile Auth & Event UX

## Phase 1 — EventCard Widget (dependency cho EventListScreen)

- [x] 1. **Tạo `lib/features/concerts/widgets/event_card.dart`**: Widget `EventCard` với props `concert`, `isSelected`, `onTap`. Unselected: `GateColors.surface` bg, `GateColors.border` 1dp border, không có trailing icon. Selected: `GateColors.surfaceHigh` bg, `GateColors.primary` 2dp border, trailing `Icons.check_circle_rounded` primary color, title text đổi sang primary color. Content: leading icon placeholder 48×48, `Text(concert.title, maxLines: 2, overflow: ellipsis)`, Row location icon + location text. Min-height 80dp. `AnimatedContainer` 150ms transition. Semantics label cho accessibility.

## Phase 2 — LoginScreen Redesign

- [x] 2. **Thêm `_obscurePassword` state và FocusNode vào `_LoginScreenState`**: Thêm `bool _obscurePassword = true`, `FocusNode _emailFocus` và `FocusNode _passwordFocus`. Dispose FocusNodes trong `dispose()`. Không thay đổi bất kỳ logic auth nào.

- [x] 3. **Thêm `_sanitizeErrorMessage(String raw)` helper vào `_LoginScreenState`**: Map raw exception string sang thông báo thân thiện tiếng Việt. Cases: network errors → kết nối, 401/credentials → sai email/mật khẩu, quyền → không có quyền gate_staff, default → thất bại, thử lại. Method trả `String`.

- [x] 4. **Xây dựng `_buildBrandHeader()` widget method**: Trả `Column` center với icon container 72×72 (radius 20, primary tint), `Icons.confirmation_number_outlined` 36dp, `Text('TicketBox', heading1)`, `Text('Gate Staff Portal', bodyMedium muted)`.

- [x] 5. **Xây dựng `_buildFormCard()` widget method**: Trả `GateCard(elevated: true)` chứa email field (prefixIcon, next action, FocusNode, validator), password field (prefixIcon lock, suffixIcon toggle, done action, FocusNode, validator), `_buildErrorZone()`, `GateButton.primary` login button.

- [x] 6. **Xây dựng `_buildErrorZone()` widget method**: Trả `SizedBox.shrink()` nếu `authProvider.state != AuthState.error`. Khi có lỗi: `Container` với `GateColors.scanInvalid.container` bg, left border 3dp `GateColors.scanInvalid.primary`, padding `GateSpacing.md`, warning icon + sanitized message text.

- [x] 7. **Rebuild `LoginScreen.build()` hoàn chỉnh**: `Scaffold` không AppBar, `SafeArea` + `GestureDetector` dismiss keyboard + `SingleChildScrollView` + `Form` + `Column`. Brand header → form card → version footer. GateButton: `onPressed: isLoading ? null : _login`, `isLoading: state == loading`, `fullWidth: true`. Form fields disabled khi loading.

## Phase 3 — EventListScreen Redesign

- [x] 8. **Rebuild `_buildBody()` trong `EventListScreen`**: Switch statement trên `ConcertState`. Loading → `GateLoadingState`. Error → `GateErrorState` với type + sanitized message + retry callback. Empty → `GateEmptyState` với `event_busy_outlined`. Loaded → `_buildConcertList()`.

- [x] 9. **Xây dựng ListView với EventCard và pull-to-refresh**: `RefreshIndicator(color: primary)` wrapping `ListView.separated` dùng `EventCard`. ListView padding bottom = `_ctaBarHeight + GateSpacing.md`. `AlwaysScrollableScrollPhysics()` để pull-to-refresh hoạt động khi ít items.

- [x] 10. **Xây dựng sticky bottom CTA**: `bottomBar` trong `GateScaffold` — `Container` với top border + safe-area padding. `GateButton` label dynamic: selected → "Xác nhận: {title}", unselected → "Chọn một sự kiện để tiếp tục". `onPressed: null` khi chưa chọn. FAB cũ đã xóa.

- [x] 11. **Migrate `EventListScreen` sang `GateScaffold`**: `GateScaffold(title: 'Chọn Sự Kiện', actions: [Tooltip logout], bottomBar: ...)`. Thêm helper `_resolveErrorType()` và `_resolveErrorMessage()`.

## Phase 4 — Widget Tests

- [x] 12. **Tạo `test/features/auth/login_screen_test.dart`**: 19 tests — brand header, form fields, no AppBar, loading button disabled, form fields disabled, 4 error cases, 3 validation cases, password toggle (obscureText via EditableText, icon switching), login trigger.

- [x] 13. **Tạo `test/features/concerts/event_list_screen_test.dart`**: 15 tests — loading/initial states, error with retry, empty, loaded cards, location text, select tap, selected check icon, unselected no icon, CTA disabled/enabled, CTA label variants, logout button.

- [x] 14. **Tạo `test/features/concerts/event_card_test.dart`**: 10 tests — title, location, location icon, unselected no check, selected check icon, border widths (1dp vs 2dp), onTap fires, min-height 80dp, long title ellipsis.

## Phase 5 — Quality

- [x] 15. **Chạy `flutter analyze lib/ test/`**: No issues found ✓

- [x] 16. **Chạy `flutter test test/`**: 76/76 tests passed ✓ (33 shared widgets + 43 new screen/widget tests)
