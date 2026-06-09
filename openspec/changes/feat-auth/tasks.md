## 1. Setup & Configuration

- [x] 1.1 Sửa lỗi đường dẫn cấu hình TypeORM trong `package.json` (từ `src/db/ormconfig.ts` thành `src/data/ormconfig.ts`)
- [x] 1.2 Cài đặt các thư viện phụ thuộc: `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt` và các gói `@types` tương ứng
- [x] 1.3 Cập nhật cấu hình môi trường bảo mật `JWT_SECRET` và `JWT_REFRESH_SECRET` trong file `.env` và `.env.example`

## 2. Core Entities & Utils

- [x] 2.1 Tạo hàm tiện ích `generateUuidV7` dùng mô-đun `crypto` native của Node.js
- [x] 2.2 Tạo hàm tiện ích sinh mã OTP ngẫu nhiên gồm 6 chữ số (`generateOtp`)
- [x] 2.3 Định nghĩa `UserRole` enum (`audience`, `organizer`, `gate_staff`) và thực thể `User` (`user.entity.ts`) sử dụng `@BeforeInsert` hook sinh UUID v7, bổ sung cột `status` (`pending`, `active` với mặc định là `pending`)

## 3. Database Migration & Seeds

- [x] 3.1 Tạo file migration tạo bảng `users` với cột `status` và ràng buộc CHECK (`status IN ('pending', 'active')`)
- [x] 3.2 Chạy migration tạo bảng và viết script seed cơ sở dữ liệu để thêm các tài khoản mẫu cho từng vai trò với trạng thái mặc định là `active`

## 4. DTOs & Service Implementation

- [x] 4.1 Định nghĩa các DTO validate dữ liệu đầu vào: `RegisterDto`, `LoginDto`, `RefreshTokenDto`, và `VerifyOtpDto` sử dụng `class-validator`
- [x] 4.2 Triển khai logic xử lý đăng ký trong `AuthService`: băm mật khẩu bằng `bcrypt`, lưu user mới ở trạng thái `pending`, sinh OTP lưu trên Redis (TTL 5 phút), và gửi message nhiệm vụ gửi mail chứa OTP vào RabbitMQ
- [x] 4.3 Triển khai logic xác thực OTP (`verifyOtp`) trong `AuthService`: so khớp mã OTP trong Redis, cập nhật trạng thái user thành `active` trong PostgreSQL, và xóa OTP khỏi Redis
- [x] 4.4 Triển khai logic đăng nhập trong `AuthService`: kiểm tra mật khẩu và trạng thái `active` của tài khoản, sinh Access/Refresh Token và lưu hash của Refresh Token lên Redis
- [x] 4.5 Triển khai logic làm mới token (`refresh`) so khớp token gửi lên với Redis, thực hiện Token Rotation (xoay vòng token) và thu hồi token cũ
- [x] 4.6 Triển khai logic đăng xuất (`logout`) xóa bỏ Refresh Token tương ứng của người dùng khỏi Redis

## 5. Guards & Strategies

- [x] 5.1 Cấu hình Passport `JwtStrategy` giải mã Access Token và đính kèm thông tin người dùng vào request
- [x] 5.2 Xây dựng `Roles` decorator và `RolesGuard` để thực thi phân quyền (RBAC) trên các endpoints
- [x] 5.3 Tạo `AuthController` cấu hình các endpoints `/auth/register`, `/auth/verify-otp`, `/auth/login`, `/auth/refresh`, `/auth/logout` và `/auth/me`

## 6. App Module Integration & Verification

- [x] 6.1 Khai báo và import `AuthModule` trong `AppModule`
- [x] 6.2 Kiểm thử thủ công luồng đăng ký, gửi OTP, xác thực kích hoạt tài khoản, đăng nhập, lấy token mới bằng refresh token và đăng xuất
- [x] 6.3 Viết Unit Test cho `AuthService` để kiểm tra các kịch bản thành công và lỗi của login, register, verify OTP, refresh, và logout
