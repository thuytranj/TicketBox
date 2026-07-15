# Báo Cáo Kiểm Thử: Phân quyền truy cập dựa trên vai trò (RBAC)

## 1. Mục tiêu kiểm thử
Xác minh tính chính xác của cơ chế phân quyền dựa trên vai trò (Role-Based Access Control - RBAC) trong hệ thống. Đảm bảo:
- Các API không yêu cầu phân quyền đều có thể truy cập tự do.
- Các API yêu cầu phân quyền được kiểm soát chặt chẽ:
  - Cho phép truy cập khi người dùng có vai trò (`UserRole`) hợp lệ.
  - Từ chối truy cập và phản hồi mã lỗi `ForbiddenException` khi không cung cấp vai trò hoặc vai trò không đủ quyền hạn.

## 2. Kế hoạch và Kịch bản Test (Test Plan)
- **Công cụ:** Jest (Unit Testing framework tích hợp trong NestJS)
- **File Test:** [roles.guard.spec.ts](src/backend/src/auth/guards/roles.guard.spec.ts)
- **Các kịch bản kiểm thử (Test Cases):**
  1. **Khởi tạo:** `RolesGuard` được khởi tạo thành công cùng các dependencies.
  2. **Bypass (Không yêu cầu vai trò - undefined):** Cho phép truy cập nếu Metadata của route không yêu cầu vai trò cụ thể (`Reflector` trả về `undefined`).
  3. **Bypass (Không yêu cầu vai trò - mảng rỗng):** Cho phép truy cập nếu Metadata của route yêu cầu một danh sách vai trò rỗng.
  4. **Từ chối (Không có user):** Quăng lỗi `ForbiddenException` với thông điệp `"Access denied: no user role provided"` khi request không chứa thông tin người dùng.
  5. **Từ chối (User không có role):** Quăng lỗi `ForbiddenException` với thông điệp `"Access denied: no user role provided"` khi thông tin người dùng không chứa trường `role`.
  6. **Từ chối (Role không hợp lệ):** Quăng lỗi `ForbiddenException` với thông điệp `"Access denied: insufficient permissions"` khi vai trò của người dùng không trùng khớp với bất kỳ vai trò yêu cầu nào (ví dụ: route yêu cầu `ORGANIZER` nhưng user có vai trò `AUDIENCE`).
  7. **Cho phép (Role hợp lệ):** Cho phép truy cập khi vai trò người dùng trùng khớp với vai trò yêu cầu (ví dụ: route yêu cầu `ORGANIZER` và user có vai trò `ORGANIZER`).
  8. **Cho phép (Một trong nhiều Role):** Cho phép truy cập khi vai trò người dùng nằm trong danh sách các vai trò được chấp nhận (ví dụ: route yêu cầu `ORGANIZER` hoặc `GATE_STAFF`, user có vai trò `GATE_STAFF`).

## 3. Kết quả thực thi (Test Results)

Kết quả chạy Unit Test trên local terminal bằng Jest:

### 3.1. Chạy riêng RolesGuard Test
```text
> ticketbox@0.0.1 test
> jest src/auth/guards/roles.guard.spec.ts

PASS src/auth/guards/roles.guard.spec.ts
  RolesGuard
    ✓ should be defined (6 ms)
    canActivate
      ✓ should return true if no roles are required (reflector returns undefined) (2 ms)
      ✓ should return true if no roles are required (reflector returns empty array) (1 ms)
      ✓ should throw ForbiddenException if user is not in request (5 ms)
      ✓ should throw ForbiddenException if user does not have a role (2 ms)
      ✓ should throw ForbiddenException if user role does not match required roles (2 ms)
      ✓ should return true if user has required role (15 ms)
      ✓ should return true if user has another acceptable role from the list (1 ms)

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        0.806 s
Ran all test suites matching src/auth/guards/roles.guard.spec.ts.
```

### 3.2. Chạy toàn bộ Test Suites thuộc Auth module
```text
> ticketbox@0.0.1 test
> jest src/auth

PASS src/auth/auth.service.spec.ts
[Nest] 47041  - 07/14/2026, 8:29:23 PM   ERROR [JwtAuthGuard] Redis check blocked IP failed (fail-open): Redis connection error
PASS src/auth/guards/jwt-auth.guard.spec.ts
PASS src/auth/guards/roles.guard.spec.ts

Test Suites: 3 passed, 3 total
Tests:       39 passed, 39 total
Snapshots:   0 total
Time:        1.361 s
Ran all test suites matching src/auth.
```

## 4. Kết luận (Conclusion)
- **Tình trạng:** **ĐẠT (PASSED)**
- Hệ thống phân quyền RBAC qua `RolesGuard` hoạt động cực kỳ chính xác theo các thiết kế nghiệp vụ và bảo mật.
- Đã phủ đầy đủ các tình huống biên và phân quyền lỗi (Access Denied / Insufficient Permissions).
