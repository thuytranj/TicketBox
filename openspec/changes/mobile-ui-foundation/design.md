# Design: Mobile UI Foundation — TicketBox Gate App

## Bối cảnh & Nguyên tắc thiết kế

Gate App là công cụ **nghiệp vụ** (ops tool), không phải consumer app. Người dùng là nhân sự soát vé đứng tại cổng vào, điều kiện:

- Cầm điện thoại **1 tay** trong khi tay kia hướng dẫn khán giả.
- Ánh sáng **hỗn hợp** (sân khấu nhấp nháy, đèn đường, ban đêm).
- **Tốc độ nhận biết** ưu tiên hơn tính thẩm mỹ — nhân sự cần đọc kết quả quét trong <0.5 giây.
- **Trạng thái offline/online** phải luôn hiển thị, không được ẩn.

Nguyên tắc dẫn đầu: **Clarity over beauty. Speed over richness. Contrast over color.**

---

## 1. Visual Direction — "Gate Ops Dark"

Dark theme là **mặc định bắt buộc** (ThemeMode.dark, không dùng system theme). Lý do:
- Giảm eye strain trong môi trường tối.
- Tăng contrast ratio cho các status color (green/amber/red trên nền tối).
- Giảm screen glare khi ánh sáng yếu.

App không cần light theme ở giai đoạn này.

---

## 2. Color System

### 2.1 Base Palette — `gate_colors.dart`

```
Semantic Token          Value        Dùng cho
─────────────────────────────────────────────────────────────
GateColors.background   #0D0D0D     Scaffold background
GateColors.surface      #1A1A1A     Cards, bottom sheets
GateColors.surfaceHigh  #242424     Elevated cards, dialogs
GateColors.border       #2E2E2E     Dividers, borders nhẹ
GateColors.onBackground #F5F5F5     Text chính trên background
GateColors.onSurface    #E0E0E0     Text chính trên surface
GateColors.onSurfaceSub #9E9E9E     Text phụ, caption, hint
```

### 2.2 Status Colors — Semantic Mapping

Đây là phần quan trọng nhất. Mỗi status có 3 token: `primary`, `container` (background), `onContainer` (text).

```
Status          Primary     Container   OnContainer   Dùng cho
──────────────────────────────────────────────────────────────────────────
scanValid       #00E676     #00331A     #FFFFFF       Vé hợp lệ (VALID)
scanUsed        #FFB300     #332500     #FFFFFF       Vé đã dùng (ALREADY_USED)
scanInvalid     #FF3D00     #330D00     #FFFFFF       Vé không tồn tại (NOT_FOUND)
scanError       #B0BEC5     #1A1F22     #FFFFFF       Lỗi không xác định
networkOnline   #00C853     —           —             Dot indicator online
networkOffline  #FF9100     —           —             Dot indicator offline
syncPending     #FFB300     —           —             Badge pending queue
```

**Quy tắc bất biến**: Không bao giờ dùng `Colors.green`, `Colors.red`, `Colors.orange` raw. Luôn dùng token.

### 2.3 Brand & Primary

```
GateColors.primary        #7C4DFF     Accent chính (tím đậm, khác với consumer app)
GateColors.primaryVariant #651FFF
GateColors.onPrimary      #FFFFFF
```

Màu primary tím được chọn để **không bị nhầm lẫn** với status colors (green/amber/red). Primary chỉ dùng cho interactive elements (button, FAB, selected state).

---

## 3. Typography — `gate_typography.dart`

Font: **Inter** (Google Fonts). Reason: high legibility ở small sizes, excellent numerics, widely used trong ops software.

```
Token                   Size    Weight    Line Height    Dùng cho
──────────────────────────────────────────────────────────────────────
GateTypography.scanResult  48sp   Bold (700)   56sp      Kết quả quét (HỢP LỆ / ĐÃ DÙNG)
GateTypography.heading1    24sp   SemiBold(600) 32sp     Page title, event name
GateTypography.heading2    20sp   SemiBold(600) 28sp     Section heading
GateTypography.bodyLarge   17sp   Regular(400)  24sp     Body text chính
GateTypography.bodyMedium  15sp   Regular(400)  22sp     Secondary body
GateTypography.label       13sp   Medium (500)  18sp     Labels, chips, badges
GateTypography.caption     12sp   Regular(400)  16sp     Metadata, timestamps
GateTypography.counter     36sp   Mono/Bold     44sp     Scan counter (dùng tabular nums)
```

**Quy tắc**: `bodyLarge` là minimum cho mọi text cần đọc khi di chuyển. Không dùng size dưới 12sp.

---

## 4. Spacing — `gate_spacing.dart`

Dùng hệ thống 8-point grid (standard Material).

```
GateSpacing.xs    =  4.0    Khoảng cách icon-text nhỏ
GateSpacing.sm    =  8.0    Padding nhỏ, gap nhỏ
GateSpacing.md    = 16.0    Padding chuẩn page
GateSpacing.lg    = 24.0    Section gap, card padding
GateSpacing.xl    = 32.0    Khoảng cách lớn giữa sections
GateSpacing.xxl   = 48.0    Padding màn hình đặc biệt (bottom safe area)
```

---

## 5. Border Radius — `gate_radii.dart`

```
GateRadii.none    =  0.0    Dividers
GateRadii.sm      =  6.0    Chips, tags, badges nhỏ
GateRadii.md      = 12.0    Cards, input fields
GateRadii.lg      = 16.0    Bottom sheets, dialogs
GateRadii.xl      = 24.0    FAB-style buttons
GateRadii.full    = 999.0   Pill shapes (status chips, round buttons)
```

---

## 6. Elevation & Shadow — `gate_elevation.dart`

Dark theme dùng surface tint thay vì drop shadow (Material3 convention).

```
GateElevation.none    = 0     Flat surfaces
GateElevation.card    = 1     Standard cards
GateElevation.raised  = 2     Elevated cards
GateElevation.overlay = 3     Bottom sheets, dialogs
GateElevation.modal   = 6     Modals
```

---

## 7. Button Hierarchy

Trong ops context, button hierarchy đơn giản, rõ ràng:

```
Tier 1 — Primary Action (1 per screen max):
  FilledButton / GatePrimaryButton
  Background: GateColors.primary (#7C4DFF)
  Height: 56dp min  ← phải tap được 1 tay với găng
  Width: full-width hoặc min 200dp
  Shape: GateRadii.xl

Tier 2 — Secondary Action:
  OutlinedButton / GateSecondaryButton
  Border: GateColors.border
  Height: 48dp min
  Shape: GateRadii.md

Tier 3 — Tertiary / Destructive:
  TextButton / GateTertiaryButton
  Text only, no background
  Use sparingly

Tier 4 — Icon Action (AppBar / Toolbar):
  IconButton
  Min size: 48×48dp (touch target)
  Use Tooltip always
```

---

## 8. Shared Widget Specs

### 8.1 `GateButton` (Primary, Secondary, Tertiary variants)

```
Props:
  label: String         — required
  onPressed: VoidCallback? — null = disabled state
  icon: IconData?       — optional leading icon
  isLoading: bool       — shows circular indicator, disables interaction
  variant: GateButtonVariant (primary | secondary | tertiary)

Behavior:
  - Loading state: spinner replaces icon, text stays, button disabled
  - Disabled: opacity 0.4, no tap response
  - Minimum height: 56dp (primary), 48dp (secondary/tertiary)
```

### 8.2 `GateCard`

```
Props:
  child: Widget
  padding: EdgeInsets?  — default GateSpacing.md
  onTap: VoidCallback?
  elevated: bool        — uses surfaceHigh if true

Behavior:
  - onTap: InkWell ripple effect
  - Rounded: GateRadii.md
  - Background: GateColors.surface (or surfaceHigh)
```

### 8.3 `GateLoadingState`

```
Props:
  message: String?      — optional caption below spinner

Behavior:
  - Centered CircularProgressIndicator (GateColors.primary)
  - Message in GateTypography.bodyMedium / onSurfaceSub
  - Full-area centered
```

### 8.4 `GateErrorState`

```
Props:
  message: String
  onRetry: VoidCallback?  — null = no retry button shown
  type: GateErrorType (network | server | unknown)

Behavior:
  - Icon: network=wifi_off, server=cloud_off, unknown=error_outline
  - Icon color: GateColors.scanInvalid.primary
  - Message: GateTypography.bodyLarge
  - Retry button: GateButton.secondary if onRetry != null
```

### 8.5 `GateEmptyState`

```
Props:
  message: String
  icon: IconData?       — default: inbox_outlined
  action: Widget?       — optional CTA

Behavior:
  - Centered, icon 64dp, muted color (onSurfaceSub)
```

### 8.6 `StatusChip` (Scan Result)

```
Props:
  status: ScanStatus (valid | alreadyUsed | notFound | error)
  showLabel: bool       — default true

Behavior:
  - Background: status container color
  - Text/icon: status primary color
  - Shape: GateRadii.full (pill)
  - Padding: horizontal 12dp, vertical 6dp
  - Always has icon + label (không chỉ dựa vào màu)
```

### 8.7 `NetworkStatusBadge`

```
Props:
  isOnline: bool
  pendingCount: int?    — shows queue badge if > 0

Behavior:
  - Online: dot #00C853 + "ONLINE" text label
  - Offline: dot #FF9100 + "OFFLINE" text label
  - pendingCount > 0: amber badge ⚡ {count} hiển thị sau dot
  - Compact, dùng trong status bar / AppBar
```

### 8.8 `GateScaffold`

```
Props:
  title: String?
  body: Widget
  bottomBar: Widget?
  actions: List<Widget>?
  showNetworkStatus: bool  — default false
  floatingActionButton: Widget?

Behavior:
  - Wrap Scaffold với GateAppTheme defaults
  - AppBar title: GateTypography.heading2
  - AppBar background: GateColors.surface (không phải background)
  - Nếu showNetworkStatus=true: hiển thị NetworkStatusBadge trong AppBar
  - SafeArea applied to body
```

---

## 9. Snackbar, Bottom Sheet & Dialog Rules

### SnackBar
- **Không dùng SnackBar cho error trạng thái quan trọng** (login fail, scan error).
- SnackBar chỉ dùng cho transient info (sync completed, action undone).
- Background: `GateColors.surfaceHigh`. Text: `GateColors.onSurface`.
- Duration: 3s max. Không dùng `indefinite` duration.

### Bottom Sheet
- `backgroundColor`: `GateColors.surface`.
- Top drag handle always visible.
- Border radius top: `GateRadii.lg`.
- Padding: `GateSpacing.lg`.
- Tránh để bottom sheet block camera trong scanner context.

### Dialog
- Dùng sparingly — chỉ cho destructive action confirmation.
- Background: `GateColors.surfaceHigh`.
- Max 2 actions: cancel (secondary) + confirm (primary/destructive).

---

## 10. MaterialApp Theme Wiring

`GateAppTheme.dark()` trả về `ThemeData` với:

```dart
ThemeData(
  useMaterial3: true,
  brightness: Brightness.dark,
  colorScheme: ColorScheme.dark(
    primary: GateColors.primary,
    surface: GateColors.surface,
    background: GateColors.background,
    error: GateColors.scanInvalid.primary,
    onPrimary: GateColors.onPrimary,
    onSurface: GateColors.onSurface,
    onBackground: GateColors.onBackground,
  ),
  textTheme: GateTypography.textTheme,
  scaffoldBackgroundColor: GateColors.background,
  cardTheme: CardTheme(color: GateColors.surface, ...),
  elevatedButtonTheme: ...,  // GatePrimaryButton defaults
  filledButtonTheme: ...,
  outlinedButtonTheme: ...,
  inputDecorationTheme: ..., // dark-mode form fields
  appBarTheme: AppBarTheme(backgroundColor: GateColors.surface, ...),
  bottomSheetTheme: ...,
  snackBarTheme: ...,
)
```

`main.dart` chỉ thay `theme:` và `themeMode:`, không thay gì khác.

---

## 11. File Structure

```
src/mobile/lib/
├── core/
│   └── theme/
│       ├── gate_app_theme.dart       ← ThemeData builder (entry point)
│       ├── gate_colors.dart          ← Color tokens + status colors
│       ├── gate_typography.dart      ← TextTheme + GateTypography class
│       ├── gate_spacing.dart         ← Spacing constants
│       ├── gate_radii.dart           ← BorderRadius constants
│       └── gate_elevation.dart       ← Elevation constants
└── shared/
    └── widgets/
        ├── gate_scaffold.dart        ← Page scaffolding wrapper
        ├── gate_button.dart          ← Primary/Secondary/Tertiary buttons
        ├── gate_card.dart            ← Tappable/static card
        ├── gate_loading_state.dart   ← Centered loading
        ├── gate_error_state.dart     ← Error + retry
        ├── gate_empty_state.dart     ← Empty list/data state
        ├── status_chip.dart          ← Scan result chip
        └── network_status_badge.dart ← Online/offline indicator
```
