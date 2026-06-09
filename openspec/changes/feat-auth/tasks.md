## 1. Setup & Configuration

- [x] 1.1 Sửa lỗi đường dẫn cấu hình TypeORM trong `package.json` (từ `src/db/ormconfig.ts` thành `src/data/ormconfig.ts`)
- [x] 1.2 Cài đặt các thư viện phụ thuộc: `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt` và các gói `@types` tương ứng
- [x] 1.3 Cập nhật cấu hình môi trường bảo mật `JWT_SECRET` và `JWT_REFRESH_SECRET` trong file `.env` và `.env.example`

## 2. Core Entities & Utils

- [x] 2.1 Tạo hàm tiện ích `generateUuidV7` dùng mô-đun `crypto` native của Node.js
- [x] 2.2 Định nghĩa `UserRole` enum (`audience`, `organizer`, `gate_staff`) và thực thể `User` (`user.entity.ts`) sử dụng `@BeforeInsert` hook sinh UUID v7

## 3. Database Migration & Seeds

- [x] 3.1 Tạo file migration tạo bảng `users` với cấu trúc cột, kiểu dữ liệu, các chỉ mục và ràng buộc đã thiết kế
- [x] 3.2 Chạy migration tạo bảng và viết script seed cơ sở dữ liệu để thêm các tài khoản mẫu cho từng vai trò

## 4. DTOs & Service Implementation

- [x] 4.1 Định nghĩa các DTO validate dữ liệu đầu vào: `RegisterDto`, `LoginDto` và `RefreshTokenDto` sử dụng `class-validator`
- [x] 4.2 Triển khai logic xử lý đăng ký và mã hóa mật khẩu bằng `bcrypt` trong `AuthService`
- [x] 4.3 Triển khai logic đăng nhập phát sinh cả Access Token và Refresh Token, đồng thời lưu trữ hash của Refresh Token lên Redis
- [x] 4.4 Triển khai logic làm mới token (`refresh`) so khớp token gửi lên với Redis, thực hiện Token Rotation (xoay vòng token) và thu hồi token cũ
- [x] 4.5 Triển khai logic đăng xuất (`logout`) xóa bỏ Refresh Token tương ứng của người dùng khỏi Redis

## 5. Guards & Strategies

- [x] 5.1 Cấu hình Passport `JwtStrategy` giải mã Access Token và đính kèm thông tin người dùng vào request
- [x] 5.2 Xây dựng `Roles` decorator và `RolesGuard` để thực thi phân quyền (RBAC) trên các endpoints
- [x] 5.3 Tạo `AuthController` cấu hình các endpoints `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` và `/auth/me`

## 6. App Module Integration & Verification

- [x] 6.1 Khai báo và import `AuthModule` trong `AppModule`
- [x] 6.2 Kiểm thử thủ công luồng đăng nhập, lấy token mới bằng refresh token, gọi thử API protected và thực hiện đăng xuất (logout)
- [x] 6.3 Viết Unit Test cho `AuthService` để kiểm tra các kịch bản thành công và lỗi của login, register, refresh, và logout
