# Tasks: Mobile UI Foundation

## Phase 1 — Token Layer

- [x] 1. **Tạo `gate_colors.dart`**: Định nghĩa class `GateColors` với tất cả base palette tokens (`background`, `surface`, `surfaceHigh`, `border`, `onBackground`, `onSurface`, `onSurfaceSub`, `primary`, `primaryVariant`, `onPrimary`) và nested class `ScanStatusColor` với 4 status (`scanValid`, `scanUsed`, `scanInvalid`, `scanError`). Thêm `networkOnline`, `networkOffline`, `syncPending`. Không có magic number raw trong file này — mọi hex đều là `const Color(0xFF...)`.

- [x] 2. **Tạo `gate_typography.dart`**: Định nghĩa class `GateTypography` với 8 text style tokens (`scanResult`, `heading1`, `heading2`, `bodyLarge`, `bodyMedium`, `label`, `caption`, `counter`). Tích hợp Google Fonts `Inter` cho tất cả styles. Expose thêm `TextTheme get textTheme` để dùng trong ThemeData. Đảm bảo `counter` dùng `fontFeatures: [FontFeature.tabularFigures()]` để số không nhảy layout.

- [x] 3. **Tạo `gate_spacing.dart`**: Định nghĩa class `GateSpacing` với 6 constants (`xs=4`, `sm=8`, `md=16`, `lg=24`, `xl=32`, `xxl=48`). Thêm static methods tiện ích: `vertical(double)`, `horizontal(double)` trả về `SizedBox`.

- [x] 4. **Tạo `gate_radii.dart`**: Định nghĩa class `GateRadii` với 6 constants dạng `BorderRadius`: `none`, `sm(6)`, `md(12)`, `lg(16)`, `xl(24)`, `full(999)`. Thêm cả `double` raw values dạng `GateRadii.mdValue = 12.0` để dùng trong context không dùng `BorderRadius`.

- [x] 5. **Tạo `gate_elevation.dart`**: Định nghĩa class `GateElevation` với 5 constants (`none=0`, `card=1`, `raised=2`, `overlay=3`, `modal=6`). Đây là `double` constants.

## Phase 2 — Theme Builder

- [x] 6. **Tạo `gate_app_theme.dart`**: Implement class `GateAppTheme` với static method `dark()` trả về `ThemeData`. Wire đủ tất cả sub-themes: `colorScheme`, `textTheme`, `scaffoldBackgroundColor`, `cardTheme`, `elevatedButtonTheme`, `filledButtonTheme`, `outlinedButtonTheme`, `inputDecorationTheme`, `appBarTheme`, `bottomSheetTheme`, `snackBarTheme`, `dividerTheme`, `listTileTheme`. Không hard-code bất kỳ `Color` hay `double` literal nào — tất cả phải tham chiếu từ token files. Thêm docstring giải thích cách sử dụng.

- [x] 7. **Cập nhật `main.dart`**: Thay `theme: ThemeData(colorScheme: ColorScheme.fromSeed(...), useMaterial3: true)` bằng `theme: GateAppTheme.dark()` và `themeMode: ThemeMode.dark`. Không thay đổi bất kỳ logic nào khác trong file. Thêm `SystemChrome.setPreferredOrientations` portrait-lock.

## Phase 3 — Shared Widgets

- [x] 8. **Tạo `gate_button.dart`**: Implement `GateButton` widget với `variant` enum (`primary`, `secondary`, `tertiary`). Props: `label`, `onPressed`, `icon`, `isLoading`, `variant`. Loading state dùng `SizedBox(16×16)` + `CircularProgressIndicator.adaptive(strokeWidth: 2)`. Primary: `FilledButton` style với height 56dp, full-width, radius `GateRadii.xl`. Secondary: `OutlinedButton` 48dp. Tertiary: `TextButton`. Disabled khi `onPressed == null` hoặc `isLoading == true`.

- [x] 9. **Tạo `gate_card.dart`**: Implement `GateCard` widget với props `child`, `padding` (default `GateSpacing.md`), `onTap`, `elevated`. Dùng `Material` + `InkWell` để ripple effect hoạt động đúng trên dark background. `elevated: true` dùng `GateColors.surfaceHigh`, `false` dùng `GateColors.surface`. Border radius `GateRadii.md`.

- [x] 10. **Tạo `gate_loading_state.dart`**: Implement `GateLoadingState` widget với props `message`. Layout: `Column(center)` với `CircularProgressIndicator(color: GateColors.primary)` + optional `Text(message, style: GateTypography.bodyMedium)` với `GateSpacing.sm` gap. Dùng trong Center widget của parent.

- [x] 11. **Tạo `gate_error_state.dart`**: Implement `GateErrorState` widget với props `message`, `onRetry`, `type: GateErrorType`. Enum `GateErrorType` gồm `network`, `server`, `unknown` — mỗi type có icon riêng. Layout: `Column(center)` với Icon 48dp + Text + optional `GateButton.secondary('Thử lại', onPressed: onRetry)`. Icon color: `GateColors.scanInvalid.primary`.

- [x] 12. **Tạo `gate_empty_state.dart`**: Implement `GateEmptyState` widget với props `message`, `icon` (default `Icons.inbox_outlined`), `action`. Layout: Column center với icon 64dp muted color + text caption + optional action widget. Muted color: `GateColors.onSurfaceSub`.

- [x] 13. **Tạo `status_chip.dart`**: Implement `StatusChip` widget với props `status: ScanStatus` (enum: `valid`, `alreadyUsed`, `notFound`, `error`) và `showLabel: bool`. Resolve màu từ `GateColors` status tokens. Luôn có icon + label (không chỉ màu). Shape: `StadiumBorder()`. Padding: `EdgeInsets.symmetric(horizontal: 12, vertical: 6)`. Font: `GateTypography.label`.

- [x] 14. **Tạo `network_status_badge.dart`**: Implement `NetworkStatusBadge` widget với props `isOnline: bool`, `pendingCount: int?`. Online: dot `#00C853` + Text "ONLINE". Offline: dot `#FF9100` + Text "OFFLINE". Nếu `pendingCount != null && pendingCount > 0`: hiển thị thêm `⚡ {count}` với amber color. Row layout, compact. Font: `GateTypography.label`.

- [x] 15. **Tạo `gate_scaffold.dart`**: Implement `GateScaffold` widget với props `title`, `body`, `bottomBar`, `actions`, `showNetworkStatus: bool` (default false), `floatingActionButton`. Wrap `Scaffold` với `AppBar` được cấu hình đúng (backgroundColor surface, title style heading2). Nếu `showNetworkStatus == true`: prepend `NetworkStatusBadge` vào AppBar title row. Apply `SafeArea` cho body. Không custom navigation behavior.

## Phase 4 — Quality & Documentation

- [x] 16. **Viết widget tests cho tất cả shared widgets**: `test/shared/widgets/shared_widgets_test.dart` — cover 8 widget classes: GateButton (6 cases), GateCard (3), GateLoadingState (3), GateErrorState (5), GateEmptyState (2), StatusChip (4), NetworkStatusBadge (5), GateScaffold (4).

- [/] 17. **Chạy `flutter analyze`**: In progress.

- [/] 18. **Chạy `flutter test`**: Pending analyze result.

- [x] 19. **Thêm barrel exports**: `lib/core/theme/theme.dart` và `lib/shared/widgets/widgets.dart` — export tất cả tokens và widgets.

- [x] 20. **Viết usage guide**: Docstring trên `gate_app_theme.dart` với 3 quy tắc: token only, check shared widgets first, semantic colors.
