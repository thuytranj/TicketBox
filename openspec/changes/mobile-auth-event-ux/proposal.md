# Proposal: Mobile Auth & Event UX — Login + Concert Selection Redesign

## What

Redesign hai màn hình đầu tiên trong flow Gate App:

1. **`LoginScreen`** — Thêm brand header, form card, inline validation, show/hide password toggle, loading button nhất quán, và error display thay thế SnackBar.
2. **`EventListScreen`** — Thay `ListTile` bằng `EventCard` với selected state rõ ràng, sticky bottom CTA, và các state loading/error/empty dùng shared widgets từ `mobile-ui-foundation`.

Cả hai màn hình sẽ sử dụng hoàn toàn design system từ `mobile-ui-foundation` (tokens, shared widgets, `GateScaffold`).

## Why

Audit UI/UX (`mobile-gate-ui-ux-audit`) xác định 2 màn hình này có các vấn đề tác động trực tiếp đến khả năng vận hành của staff:

**Login:**
- AppBar trên màn hình login không cần thiết, lãng phí không gian.
- Button nhỏ, không đủ tap target 1 tay.
- Error chỉ qua SnackBar nhỏ — không nhìn thấy khi ánh sáng hỗn hợp.
- Không có loading state rõ ràng trên button, layout shift khi loading.
- Không có show/hide password → nhập sai không nhận ra.

**Event List:**
- `ListTile` 48dp quá nhỏ, selected state (tileColor nhạt) khó nhận ra.
- Không hiển thị ngày giờ sự kiện — staff không biết đang chọn ca nào.
- FAB `Tiếp tục` xuất hiện muộn, nằm ở vùng khó nhất với 1 tay.
- Error state in raw error string từ exception.
- Empty state chỉ là 1 dòng text.

## Scope

**Trong scope:**
- `lib/features/auth/screens/login_screen.dart` — full redesign UI, không đổi `AuthProvider` hay `AuthService`.
- `lib/features/concerts/screens/event_list_screen.dart` — full redesign UI, không đổi `ConcertProvider` hay `ConcertService`.
- `lib/features/concerts/widgets/event_card.dart` — widget mới, reusable card cho concert item.
- Tests cho login states và event selection states.

**Ngoài scope (non-goals):**
- Không thay đổi `AuthProvider`, `AuthService`, `ConcertProvider`, `ConcertService`.
- Không thêm field mới vào `Concert` model — chỉ dùng `id`, `title`, `location`, `posterUrl`.
- Không thay đổi navigation logic (push/pop, routing).
- Không redesign `PreloadScreen` hay `ScannerScreen` — scope riêng.
- Không thêm "remember me" hay token persistence — scope riêng.

## Risks

| Risk | Khả năng | Mức | Mitigation |
|------|----------|-----|-----------|
| Sticky bottom CTA che nội dung list cuối | Low | Low | Thêm `bottomPadding` cho ListView bằng CTA height |
| `EventCard` layout bị overflow nếu title/location dài | Medium | Low | Dùng `TextOverflow.ellipsis` và max 2 dòng |
| AuthProvider `errorMessage` có thể trả raw exception string | Medium | Medium | Sanitize message trước khi hiển thị — map exception type → message thân thiện |
| Show/hide password toggle gây layout jump | Low | Low | Dùng `suffixIcon` trực tiếp trong `InputDecoration`, không thay đổi height |

## Definition of Done

- [ ] `LoginScreen` không còn `AppBar`, có brand header, form card với inline validation, show/hide password, loading button, inline error zone.
- [ ] `EventListScreen` dùng `EventCard` với selected state có border/checkmark rõ, sticky bottom CTA, `GateScaffold`.
- [ ] Tất cả loading/error/empty states dùng shared widgets từ `mobile-ui-foundation`.
- [ ] Không còn hardcoded `Colors.*`, `EdgeInsets.all(16)`, `SizedBox(height: 16)` raw — tất cả dùng token.
- [ ] `flutter analyze lib/ test/` — no new issues.
- [ ] Widget tests cover: login loading, login error, login success trigger; event loading, event error, event empty, event selection, event CTA disabled/enabled.
