# ANTIGRAVITY
**Prompt**: 
Bạn đang ở giai đoạn hậu triển khai redesign mobile. Nhiệm vụ của bạn là audit lại toàn bộ `src/mobile` như một Gate App offline-first cho staff check-in và tìm mọi lỗi, regression, inconsistency, UX issue, test gap, hoặc vấn đề release-readiness còn sót lại.

Phạm vi:
- Chỉ audit `src/mobile` và các tài liệu/mobile-related OpenSpec liên quan.
- Không mở rộng sang backend/frontend trừ khi cần đối chiếu contract.
- Không tự redesign thêm nếu chưa có bằng chứng vấn đề.
- Không ưu tiên feature mới. Chỉ tìm bug, risk, inconsistency, missing tests, usability issue.

Bối cảnh ứng dụng:
- Đây là app nhân sự soát vé, không phải app audience.
- Flow chính: login -> chọn concert -> preload check-in data -> scanner -> online scan / offline fallback / sync.
- App phải usable ngoài hiện trường, thao tác nhanh, dễ đọc, tương phản cao, ít ambiguity.

Bắt buộc đọc:
- `src/mobile/lib/main.dart`
- `src/mobile/lib/core/**`
- `src/mobile/lib/shared/**`
- `src/mobile/lib/features/auth/**`
- `src/mobile/lib/features/concerts/**`
- `src/mobile/lib/features/checkin/**`
- `src/mobile/pubspec.yaml`
- `src/mobile/README.md`
- `openspec/changes/mobile-app-init/proposal.md`
- `openspec/changes/mobile-app-init/design.md`
- `openspec/changes/mobile-app-init/tasks.md`
- nếu tồn tại:
  - `openspec/changes/mobile-ui-foundation/**`
  - `openspec/changes/mobile-auth-event-ux/**`
  - `openspec/changes/mobile-preload-sync-ux/**`
  - `openspec/changes/mobile-scanner-ux-redesign/**`
  - `openspec/changes/mobile-polish-and-qa/**`

Các việc phải làm:
1. Audit kiến trúc UI
- tìm chỗ vi phạm design system
- tìm hard-coded styles còn sót
- tìm component trùng lặp
- tìm hierarchy thị giác yếu
- tìm màn hình state handling chưa nhất quán

2. Audit functional flow
- login flow
- auth restore flow
- logout flow
- concert fetch/select flow
- preload flow
- scanner flow
- manual sync flow
- offline fallback flow
- error/retry flow

3. Audit UX ngoài hiện trường
- tap target
- one-handed usage
- readability ngoài trời
- tốc độ hiểu scan result
- online/offline cues
- loading behavior
- duplicate scan prevention clarity
- error messages dễ hiểu hay không

4. Audit code quality
- widget structure có quá rối không
- state management có chỗ dễ race condition không
- mounted checks
- async error handling
- null safety
- dead code
- unused widget/service/helper
- naming inconsistency
- copy inconsistency Việt/Anh

5. Audit test coverage
- có thiếu widget tests cho critical state không
- có test nào quá nông, không bảo vệ regression không
- có flow quan trọng nào chưa test:
  - login loading/error
  - event list loading/error/selection
  - preload success/error
  - scanner result mapping
  - offline/sync states

6. Audit release readiness
- `flutter analyze`
- `flutter test`
- kiểm tra README còn khớp flow hiện tại không
- kiểm tra generated/build artifacts có bị track nhầm không
- kiểm tra package/dependency rủi ro hoặc thừa

Cách trả kết quả:
- Trả về theo mindset code review.
- Findings phải đứng trước, sắp theo severity.
- Mỗi finding cần có:
  - severity: high / medium / low
  - file reference cụ thể
  - mô tả lỗi/risk
  - tại sao đây là vấn đề thật
  - cách sửa đề xuất ngắn gọn
- Sau findings mới đến:
  - open questions
  - test gaps
  - release checklist
- Nếu không có findings nghiêm trọng, nói rõ là “No critical findings”, nhưng vẫn phải nêu residual risks.

Định dạng bắt buộc:

## Findings
1. [severity] ...
2. [severity] ...

## Open Questions

## Test Gaps

## Release Checklist

Nếu có thể, hãy chỉ ra chỗ nào nên fix ngay trước khi commit/merge và chỗ nào có thể defer.

**Result**: 

Kết quả Audit: src/mobile Gate App
flutter analyze: ✅ No issues found (126.6s)

Findings
🔴 HIGH (3 findings) — Fix bắt buộc trước khi merge
1. [HIGH] ScannerScreen chưa implement redesign spec — màn hình quan trọng nhất bị bỏ sót

Toàn bộ 9 tasks của mobile-scanner-ux-redesign chưa được implement
showModalBottomSheet với backgroundColor: Colors.white → nền trắng trên dark app, vỡ theme hoàn toàn
Không có auto-dismiss → staff phải bấm "Tiếp tục quét" sau mỗi vé → tốc độ soát vé giảm 50%
Không có NetworkStatusBadge, không có connectivity indicator
Dùng Colors.green/red/orange thay vì GateColors.scanValid/scanInvalid/scanUsed
→ Fix: implement ScanResultPanel + GateScaffold + token colors
2. [HIGH] syncOfflineLogs không có concurrent guard — race condition khi network flapping

_startInAppBackgroundSync có thể trigger nhiều syncAllOfflineLogs() đồng thời
syncAllOfflineLogs silent-fail hoàn toàn (catch (_) {}) — không log, không alert
Nếu API success nhưng local DB update fail → duplicate sync lần sau
→ Fix: thêm _isSyncing flag + meaningful error handling
3. [HIGH] preloadCheckinData dùng DELETE rồi INSERT — nếu server thiếu vé, local DB mất entries

Toàn bộ checkin_entries của concert bị xoá trước khi insert lại từ API
Nếu API trả thiếu (pagination/bug) → vé bị mất khỏi offline cache → reject vé hợp lệ khi offline
→ Fix: dùng UPSERT strategy thay vì delete-all-then-insert
🟡 MEDIUM (5 findings)
#	Issue	Location
4	checkAuthStatus() gọi trong create lambda — race condition với widget mount	main.dart:38
5	Không có MobileScannerController → camera không dispose được, flashlight không control được	scanner_screen.dart
6	EventCard có 2 onTap (GestureDetector + InkWell) → double callback	event_card.dart:34-76
7	AnimationController.repeat()/stop() gọi trong build() — side effect trong pure build	preload_screen.dart:166-179
9	PreloadStep.connecting không bao giờ hiển thị active vì bị override ngay	checkin_service.dart:95
10	CheckinService import checkin_provider.dart — vi phạm dependency direction	checkin_service.dart:11
🔵 LOW (14 findings)
Bao gồm: raw Colors.white/green/red, raw TextStyle, hard-coded spacing, Concert model thiếu date, User thiếu name, DB không có onUpgrade, .flutter-plugins-dependencies bị track, pubspec.yaml description chưa đổi, không có errorBuilder cho camera permission, _manualSync không guard concurrent.

Test Gaps Nghiêm Trọng
CheckinService — service phức tạp nhất (~363 dòng, offline logic, DB transactions, sync) hoàn toàn không có test. ScannerScreen cũng zero test. Đây là 2 missing test areas quan trọng nhất trước release.

Release Readiness
Hạng mục	Trạng thái
Static analysis	✅ Clean
Auth flow + tests	✅
Event list + tests	✅
Preload screen + tests	✅
Shared widgets + tests	✅
Design system tokens	✅
Scanner screen (màn hình chính)	❌ Chưa redesign
CheckinService tests	❌ Không có
Sync safety	❌ Race condition

# CODEX
**Prompt**:
Hãy review độc lập toàn bộ phần mobile vừa được redesign trong repo này. Tôi không muốn bạn redesign thêm; tôi muốn bạn đóng vai senior reviewer + QA engineer để tìm bug, regression, risk, test gap, code smell, UX inconsistency, và vấn đề release-readiness.

Ngữ cảnh:
- Mobile app ở `src/mobile`
- Đây là Gate App cho staff check-in, offline-first
- Flow chính:
  - login
  - chọn concert
  - preload dữ liệu check-in
  - scanner
  - online scan
  - offline fallback
  - sync offline logs
- Tôi cần một review độc lập, thực dụng, ưu tiên bug/risk thật.

Yêu cầu bắt buộc:
1. Đọc code và review theo mindset “findings first”.
2. Tập trung vào:
- `src/mobile/lib/main.dart`
- `src/mobile/lib/core/**`
- `src/mobile/lib/shared/**`
- `src/mobile/lib/features/auth/**`
- `src/mobile/lib/features/concerts/**`
- `src/mobile/lib/features/checkin/**`
- `src/mobile/test/**`
- `src/mobile/pubspec.yaml`
- `src/mobile/README.md`
3. Đối chiếu thêm các OpenSpec/mobile docs nếu cần:
- `openspec/changes/mobile-app-init/**`
- các change mobile redesign nếu có
4. Chạy các kiểm tra thực tế nếu môi trường cho phép:
- `flutter analyze`
- `flutter test`
- kiểm tra git status xem có build/generated artifacts bị track nhầm không
5. Nếu một lệnh fail do môi trường, nói rõ fail do đâu và phần nào chưa verify được.
6. Không tự sửa code. Chỉ review.
7. Không nói chung chung. Mỗi finding phải gắn với file/path cụ thể.
8. Nếu không có bug lớn, vẫn phải nêu:
- residual risks
- test gaps
- code areas đáng nghi nhưng chưa chứng minh được bug

Các hạng mục cần review:
- Functional correctness
- Async/state handling correctness
- UX consistency
- Accessibility/readability
- Offline-first behavior
- Error/retry behavior
- Scanner result interpretation
- Widget composition quality
- Test quality and coverage
- Release hygiene

Checklist chi tiết:
- Login:
  - validation
  - loading state
  - error state
  - password visibility
  - auth restore behavior
- Event list:
  - loading/error/empty
  - selection state
  - CTA state
  - logout interaction
- Preload:
  - loading progress clarity
  - retry behavior
  - readiness to enter scanner
- Scanner:
  - duplicate scan throttling
  - processing lock
  - success / already used / not found / error mapping
  - manual sync
  - mounted safety around async + dialogs/sheets/snackbar
  - camera overlay usability
- Shared system:
  - theme consistency
  - hard-coded styles
  - copy consistency
  - unnecessary abstraction
  - dead code
- Tests:
  - critical UI states covered?
  - brittle tests?
  - missing regression tests?

Output format bắt buộc:

## Findings
1. [severity] <title>
- File:
- Problem:
- Why it matters:
- Suggested fix:

2. ...

## Open Questions

## Test Gaps

## Verification Run
- flutter analyze:
- flutter test:
- other checks:

## Merge Risk
- Ready / Not ready
- Blocking issues
- Non-blocking issues

Nếu không có findings nghiêm trọng, hãy nói rõ:
- “No critical findings”
- nhưng vẫn liệt kê residual risks và test gaps.

**Result**: 

Findings
[critical] Scanner flow is not actually release-ready after the claimed redesign
File: [scanner_screen.dart (line 1)](E:\\D\\DAI_HOC\\NAM_3\\KY_2\\SD\\Project\\TicketBox\\src\\mobile\\lib\\features\\checkin\\screens\\scanner_screen.dart:1), [mobile-scanner-ux-redesign/tasks.md](E:\\D\\DAI_HOC\\NAM_3\\KY_2\\SD\\Project\\TicketBox\\openspec\\changes\\mobile-scanner-ux-redesign\\tasks.md)
Problem: The production scanner still uses bare Scaffold, showModalBottomSheet, hard-coded colors, no GateScaffold, no online/offline badge, no pending sync count, no non-blocking result panel, no scan frame/laser, and there are no scanner tests in src/mobile/test.
Why it matters: This is the primary gate-operation screen. The implemented screen does not match the stated redesign/release contract, so current docs and readiness signals are overstating what is actually shipped.
Suggested fix: Either descope scanner redesign from this release explicitly, or finish the scanner contract before merge and add dedicated scanner tests.

[high] Scan processing lock is released before the result UI is dismissed
File: [scanner_screen.dart (line 20)](E:\\D\\DAI_HOC\\NAM_3\\KY_2\\SD\\Project\\TicketBox\\src\\mobile\\lib\\features\\checkin\\screens\\scanner_screen.dart:20)
Problem: _isProcessing is reset in finally immediately after _showScanResult(), while MobileScanner.onDetect remains active behind the modal sheet.
Why it matters: The camera can keep detecting while the previous result is still on screen, which risks repeated detections, stacked bottom sheets, or scanning the next attendee before staff has acknowledged the previous result.
Suggested fix: Keep the processing lock until the result UI closes, or pause/resume a MobileScannerController around result presentation.

[critical] Cold-start offline auth restore is broken
File: [auth_provider.dart (line 20)](E:\\D\\DAI_HOC\\NAM_3\\KY_2\\SD\\Project\\TicketBox\\src\\mobile\\lib\\features\\auth\\providers\\auth_provider.dart:20), [main.dart (line 43)](E:\\D\\DAI_HOC\\NAM_3\\KY_2\\SD\\Project\\TicketBox\\src\\mobile\\lib\\main.dart:43)
Problem: checkAuthStatus() treats any getMe()/refresh failure as unauthenticated and routes back to login. A network outage at app launch drops a previously signed-in staff user out of the app, even if local preload data already exists.
Why it matters: For an offline-first gate app, app restart at venue is a realistic scenario. Current behavior can make the app unusable offline after restart.
Suggested fix: Distinguish network failure from invalid session, cache the last verified user/role locally, and allow a degraded authenticated state until connectivity returns.

[high] Preload can silently reopen already-scanned tickets after offline sync ACK
File: [checkin_service.dart (line 49)](E:\\D\\DAI_HOC\\NAM_3\\KY_2\\SD\\Project\\TicketBox\\src\\mobile\\lib\\features\\checkin\\services\\checkin_service.dart:49)
Problem: Preload merge preserves only pending offline logs. After /checkin/sync, logs are marked uploaded immediately, but backend reconciliation is explicitly asynchronous. A later preload can overwrite local checked_in entries back to stale server status.
Why it matters: A ticket already admitted offline can become scannable again locally before backend state catches up.
Suggested fix: Preserve local checked-in overrides until preload data confirms server-side check-in, or introduce an uploaded_but_unconfirmed local state that is still merged during preload.

[high] Offline sync has no re-entrancy guard and can double-submit the same logs
File: [checkin_service.dart (line 25)](E:\\D\\DAI_HOC\\NAM_3\\KY_2\\SD\\Project\\TicketBox\\src\\mobile\\lib\\features\\checkin\\services\\checkin_service.dart:25), [scanner_screen.dart (line 51)](E:\\D\\DAI_HOC\\NAM_3\\KY_2\\SD\\Project\\TicketBox\\src\\mobile\\lib\\features\\checkin\\screens\\scanner_screen.dart:51)
Problem: Connectivity-triggered sync and manual sync can run concurrently. There is no mutex, no in-flight row state, and both paths read pending rows before marking them uploaded.
Why it matters: Under flaky connectivity, the same offline scans can be POSTed multiple times, producing duplicate server work and harder-to-explain “already used” outcomes.
Suggested fix: Add a service-level/per-concert sync lock and mark rows syncing transactionally before POST.

[medium] Event selection can remain valid after refresh even when the event is gone
File: [concert_provider.dart (line 22)](E:\\D\\DAI_HOC\\NAM_3\\KY_2\\SD\\Project\\TicketBox\\src\\mobile\\lib\\features\\concerts\\providers\\concert_provider.dart:22), [event_list_screen.dart (line 135)](E:\\D\\DAI_HOC\\NAM_3\\KY_2\\SD\\Project\\TicketBox\\src\\mobile\\lib\\features\\concerts\\screens\\event_list_screen.dart:135)
Problem: fetchConcerts() replaces _concerts but never revalidates _selectedConcert. The bottom CTA stays enabled off stale selection.
Why it matters: Staff can continue into preload for a concert they are no longer assigned to after pull-to-refresh or reassignment.
Suggested fix: Clear selection if its id is absent from the newly fetched list.

[medium] Scan result interpretation is brittle and falls back to raw operator-facing errors
File: [checkin_service.dart (line 179)](E:\\D\\DAI_HOC\\NAM_3\\KY_2\\SD\\Project\\TicketBox\\src\\mobile\\lib\\features\\checkin\\services\\checkin_service.dart:179), [scanner_screen.dart (line 137)](E:\\D\\DAI_HOC\\NAM_3\\KY_2\\SD\\Project\\TicketBox\\src\\mobile\\lib\\features\\checkin\\screens\\scanner_screen.dart:137)
Problem: “Already used” is recognized only when HTTP 400 contains English substring already. Other backend wordings/statuses fall through to a raw snackbar like Lỗi: ....
Why it matters: Gate staff need deterministic, normalized outcomes for duplicate/invalid tickets. Raw backend text is the opposite of that.
Suggested fix: Normalize scan outcomes centrally by structured status/statusCode, not message text, and keep UI messaging sanitized.

[medium] Docs and test signals overstate readiness of the critical path
File: [README.md](E:\\D\\DAI_HOC\\NAM_3\\KY_2\\SD\\Project\\TicketBox\\src\\mobile\\README.md), [widget_test.dart (line 1)](E:\\D\\DAI_HOC\\NAM_3\\KY_2\\SD\\Project\\TicketBox\\src\\mobile\\test\\widget_test.dart:1)
Problem: README claims broad flow coverage, but the scanner path has no tests at all, and test/widget_test.dart is only a trivial placeholder.
Why it matters: This creates false confidence exactly where the operational risk is highest.
Suggested fix: Reduce the readiness claims in docs until scanner/service coverage exists, or add the missing regression tests before release.

Open Questions
Is cold-start offline after a previous successful preload supposed to be supported? If yes, finding 3 is a release blocker by product requirement, not just by engineering preference.
Is third_party/mobile_scanner in [pubspec.yaml (line 44)](E:\\D\\DAI_HOC\\NAM_3\\KY_2\\SD\\Project\\TicketBox\\src\\mobile\\pubspec.yaml:44) an intentional maintained fork? If yes, release ownership and upgrade policy should be documented.
Does backend expose a stable machine-readable duplicate/not-found code for /checkin/scan, or is the client expected to parse human message text?
Test Gaps
No scanner tests for duplicate throttling, processing lock, modal/result lifecycle, manual sync state, mounted safety, or result-state mapping.
No service/provider tests for offline auth restore, token refresh failure behavior, preload merge after uploaded logs, or sync concurrency.
No regression test for stale event selection after fetchConcerts().
No integration-style test for the preload -> scanner handoff with cached local data.
test/widget_test.dart is effectively dead weight and does not validate app behavior.
Verification Run
flutter analyze: Not run per your latest instruction. Earlier attempts were interrupted, so I do not have a verified result.
flutter test: Not run per your latest instruction. Earlier attempts were interrupted, so I do not have a verified result.
other checks: Earlier git status --short showed ?? src/mobile/ as one untracked tree. I also observed local generated directories like src/mobile/build/ and .dart_tool/ on disk; src/mobile/.gitignore does ignore them, but commit hygiene still needs a deliberate add/review step.
Merge Risk
Not ready
Blocking issues: scanner screen not actually at redesign/release-ready state; offline auth restore breaks cold-start offline usage; preload/sync merge can reopen already-used tickets; sync concurrency can double-submit logs.
Non-blocking issues: stale concert selection after refresh, brittle scan error mapping, docs/test signals overstating coverage, smaller UX/perf inconsistencies in preload/scanner.
