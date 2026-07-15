# Design: Mobile Auth & Event UX

## Dependency

Change này **yêu cầu** `mobile-ui-foundation` đã được implement. Mọi token, widget,
và theme đều được import từ:
- `lib/core/theme/theme.dart`
- `lib/shared/widgets/widgets.dart`

---

## 1. LoginScreen Redesign

### Layout Structure

```
┌─────────────────────────────────┐
│                                 │
│  ZONE 1: BRAND HEADER           │
│  (không có AppBar)              │
│                                 │
│    🎫  TicketBox                │  ← Icon + app name
│    Gate Staff Portal            │  ← subtitle/tagline
│                                 │
├─────────────────────────────────┤
│                                 │
│  ZONE 2: FORM CARD              │
│  (GateCard elevated)            │
│                                 │
│  ┌─────────────────────────┐    │
│  │ 📧 Email                │    │  ← icon prefix, filled dark
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │ 🔒 Mật khẩu         👁  │    │  ← show/hide toggle
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │   ERROR ZONE (inline)   │    │  ← chỉ hiện khi có lỗi
│  │   ⚠ message text        │    │  ← GateColors.scanInvalid.container bg
│  └─────────────────────────┘    │
│                                 │
│  [    Đăng Nhập    ]           │  ← GateButton.primary, fullWidth, 56dp
│                                 │
├─────────────────────────────────┤
│                                 │
│  ZONE 3: FOOTER                 │
│  v1.0.0 · TicketBox Gate        │  ← version string, muted
│                                 │
└─────────────────────────────────┘
```

### Brand Header Spec

```
Icon:        Icons.confirmation_number_outlined  (hoặc custom gate icon)
Icon size:   56dp
Icon color:  GateColors.primary
App name:    "TicketBox"  — GateTypography.heading1
Subtitle:    "Gate Staff Portal"  — GateTypography.bodyMedium, onSurfaceSub
Spacing:     GateSpacing.xl trên cùng (safe area), GateSpacing.lg giữa icon và text
```

### Form Card Spec

Container: `GateCard(elevated: true)` với `GateSpacing.lg` padding

**Email field:**
```
prefixIcon:  Icons.email_outlined
labelText:   'Email'
keyboardType: TextInputType.emailAddress
textInputAction: TextInputAction.next
autocorrect: false
validator:   (v) => empty → 'Vui lòng nhập email'
                    not contains '@' → 'Email không hợp lệ'
```

**Password field:**
```
prefixIcon:  Icons.lock_outline
labelText:   'Mật khẩu'
obscureText: _obscurePassword (state)
suffixIcon:  IconButton toggle — Icons.visibility / Icons.visibility_off
textInputAction: TextInputAction.done
onFieldSubmitted: (_) => _login()
validator:   (v) => empty → 'Vui lòng nhập mật khẩu'
```

**Error Zone** (inline, chỉ hiện khi `authProvider.state == AuthState.error`):
```
Container(
  color: GateColors.scanInvalid.container,
  border: Border(left: BorderSide(color: GateColors.scanInvalid.primary, width: 3)),
  padding: GateSpacing.md,
  child: Row(
    Icon(Icons.warning_amber_rounded, color: GateColors.scanInvalid.primary),
    SizedBox(width: GateSpacing.sm),
    Expanded(Text(_sanitizeError(authProvider.errorMessage))),
  )
)
```

Error message sanitizer — map exception type → human message:
```
contains 'SocketException' | 'NetworkException' | 'DioException' network
  → 'Không thể kết nối. Kiểm tra mạng và thử lại.'
contains 'Unauthorized' | '401' | 'Invalid credentials'
  → 'Email hoặc mật khẩu không đúng.'
contains 'không có quyền' | 'gate_staff'
  → 'Tài khoản không có quyền truy cập Gate Staff.'
default
  → 'Đăng nhập thất bại. Vui lòng thử lại.'
```

**Login Button:**
```
GateButton(
  label: 'Đăng Nhập',
  onPressed: authProvider.state == AuthState.loading ? null : _login,
  isLoading: authProvider.state == AuthState.loading,
  fullWidth: true,
)
```

### State Mapping

| `AuthState` | UI |
|-------------|-----|
| `initial` | Form enabled, no error shown |
| `loading` | Button loading + disabled, form fields disabled |
| `error` | Error zone visible, form re-enabled |
| `authenticated` | Never shown (main.dart routes away) |
| `unauthenticated` | Form enabled, no error (normal landing) |

### TextField Focus Flow

`emailFocus` → (tab/next) → `passwordFocus` → (done/submit) → `_login()`

Dùng `FocusNode` pair để quản lý: tự động move focus khi user nhấn "Tiếp theo" trên bàn phím.

---

## 2. EventListScreen Redesign

### Layout Structure

```
┌─────────────────────────────────┐
│ GateScaffold AppBar             │
│ "Chọn Sự Kiện"   [logout icon] │
├─────────────────────────────────┤
│                                 │
│  BODY: ListView (padding-bottom │
│         = CTA_HEIGHT + spacing) │
│                                 │
│  ┌─────────────────────────┐    │
│  │ EventCard               │    │
│  │ ▸ Title (heading2)      │    │
│  │ ▸ Location (bodyMed)    │    │  ← 80dp min height
│  │ [✓ checkmark if sel.]   │    │  ← trailing icon
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │ EventCard (selected)    │    │
│  │ — border primary 2dp   │    │  ← clear selected state
│  │ — bg surfaceHigh       │    │
│  └─────────────────────────┘    │
│                                 │
├─────────────────────────────────┤
│  STICKY BOTTOM BAR              │
│  [ Xác nhận → Preload Data ]   │  ← GateButton.primary, fullWidth
│  (greyed out nếu chưa chọn)    │
│  safe-area padding              │
└─────────────────────────────────┘
```

### EventCard Widget Spec

**File:** `lib/features/concerts/widgets/event_card.dart`

```dart
Props:
  concert: Concert          — required
  isSelected: bool          — required
  onTap: VoidCallback       — required

Visual (unselected):
  background:   GateColors.surface
  border:       1dp, GateColors.border
  radius:       GateRadii.md
  min-height:   80dp
  trailing:     chỉ có icon placeholder màu transparent

Visual (selected):
  background:   GateColors.surfaceHigh
  border:       2dp, GateColors.primary  ← key differentiator
  radius:       GateRadii.md
  trailing:     Icons.check_circle_rounded, color: GateColors.primary, size: 24dp
  title color:  GateColors.primary (accent)
```

**Content layout:**
```
Row(
  leading:  Container(48×48, color: surfaceHigh, icon: event_outlined),
  content:  Column(
    Text(concert.title, heading2, maxLines:2, overflow:ellipsis),
    SizedBox(sm),
    Row(Icon(location_on, 14dp), Text(concert.location, bodyMedium, muted)),
  ),
  trailing: check icon (khi selected) / SizedBox.shrink (khi không),
)
```

> **Note on date/time**: `Concert` model hiện chỉ có `title` và `location` (không có datetime field từ backend). Không fake dữ liệu. Nếu backend sau này trả thêm `startTime`, card sẽ tự hiển thị qua một nullable row.

### Sticky Bottom CTA Spec

```dart
// bottomNavigationBar trong GateScaffold:
Container(
  color: GateColors.surface,
  padding: EdgeInsets.fromLTRB(md, md, md, md + MediaQuery.of(context).padding.bottom),
  child: GateButton(
    label: selectedConcert != null
           ? 'Xác nhận: ${selectedConcert.title}'
           : 'Chọn một sự kiện để tiếp tục',
    onPressed: selectedConcert != null ? _navigateToNext : null,
    icon: Icons.arrow_forward_rounded,
    fullWidth: true,
  ),
)
```

Khi `selectedConcert == null`: button disabled (opacity 0.4, không tap được) — không ẩn.

### State Mapping

| `ConcertState` | UI Body |
|----------------|---------|
| `initial` | `GateLoadingState(message: 'Đang tải danh sách sự kiện...')` |
| `loading` | `GateLoadingState(message: 'Đang tải danh sách sự kiện...')` |
| `loaded` + empty | `GateEmptyState(icon: event_busy, message: 'Hiện không có sự kiện đang mở để soát vé.')` |
| `loaded` + data | `ListView` với `EventCard` items |
| `error` | `GateErrorState(message: ..., type: network/server, onRetry: fetchConcerts)` |

**Error type detection:**
```dart
GateErrorType _resolveErrorType(String message) {
  if (message.contains('SocketException') || message.contains('network'))
    return GateErrorType.network;
  return GateErrorType.server;
}
```

### Pull-to-Refresh

Wrap `ListView` trong `RefreshIndicator` để user có thể pull-to-refresh:
```dart
RefreshIndicator(
  color: GateColors.primary,
  onRefresh: () => provider.fetchConcerts(),
  child: ListView.builder(...),
)
```

> **Backend note:** `GET /concerts` hiện trả danh sách concert `active` theo phân trang chung, không phải assignment list riêng cho gate staff. Mobile cần fetch đủ các trang thay vì giả định page đầu đã đầy đủ.

### Logout Action

Giữ logout icon ở AppBar `actions` nhưng thêm `Tooltip('Đăng xuất')` và tăng hitbox:
```dart
Tooltip(
  message: 'Đăng xuất',
  child: IconButton(
    icon: const Icon(Icons.logout_rounded),
    onPressed: () => context.read<AuthProvider>().logout(),
  ),
)
```

---

## 3. File Structure

```
src/mobile/lib/
├── features/
│   ├── auth/
│   │   └── screens/
│   │       └── login_screen.dart       ← MODIFY (full redesign)
│   └── concerts/
│       ├── screens/
│       │   └── event_list_screen.dart  ← MODIFY (full redesign)
│       └── widgets/
│           └── event_card.dart         ← NEW
test/
└── features/
    ├── auth/
    │   └── login_screen_test.dart      ← NEW
    └── concerts/
        └── event_list_screen_test.dart ← NEW
```

---

## 4. Mock Strategy cho Tests

Cả hai tests cần mock Provider. Dùng `ChangeNotifierProvider` với mock class:

```dart
class MockAuthProvider extends ChangeNotifier implements AuthProvider {
  @override AuthState state;
  @override String errorMessage;
  // ...
}
```

Tests không cần real network — chỉ pump widget với mock provider state.
