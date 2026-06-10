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

- [x] 4.1.1 Định nghĩa các DTO cốt lõi: `RegisterDto`, `LoginDto`, `RefreshTokenDto`, `VerifyOtpDto` sử dụng `class-validator`
- [x] 4.1.2 Định nghĩa các DTO mới: `ForgotPasswordDto` và `ResetPasswordDto`
- [x] 4.2 Triển khai logic đăng ký (`register`) trong `AuthService`: lưu user ở trạng thái `pending`, sinh OTP lưu Redis (TTL 5m), đặt rate limit 60s, gửi RabbitMQ task
- [x] 4.3 Triển khai logic gửi lại OTP kích hoạt (`resendOtp`) trong `AuthService`: kiểm tra status `pending`, kiểm tra rate limit Redis, sinh OTP mới, gửi RabbitMQ task
- [x] 4.4 Triển khai logic xác thực OTP (`verifyOtp`) trong `AuthService`: so khớp mã OTP trong Redis, cập nhật trạng thái user thành `active` trong PostgreSQL, và xóa OTP khỏi Redis
- [x] 4.5 Triển khai logic yêu cầu khôi phục mật khẩu (`forgotPassword`) trong `AuthService`: kiểm tra email tồn tại và `active`, sinh OTP reset mật khẩu lưu trên Redis (TTL 5m), và gửi RabbitMQ task
- [x] 4.6 Triển khai logic đặt lại mật khẩu (`resetPassword`) trong `AuthService`: so khớp OTP reset, mã hóa mật khẩu mới bằng bcrypt, cập nhật database, và thu hồi toàn bộ session đăng nhập
- [x] 4.7 Triển khai logic đăng nhập (`login`) trong `AuthService`: kiểm tra mật khẩu và trạng thái `active` của tài khoản, sinh Access/Refresh Token và lưu hash của Refresh Token lên Redis
- [x] 4.8 Triển khai logic làm mới token (`refresh`): so khớp token gửi lên với Redis, thực hiện Token Rotation (xoay vòng token) và thu hồi token cũ
- [x] 4.9 Triển khai logic đăng xuất (`logout`): xóa bỏ Refresh Token tương ứng của người dùng khỏi Redis

## 5. Guards & Strategies

- [x] 5.1 Cấu hình Passport `JwtStrategy` giải mã Access Token và đính kèm thông tin người dùng vào request
- [x] 5.2 Xây dựng `Roles` decorator và `RolesGuard` để thực thi phân quyền (RBAC) trên các endpoints
- [x] 5.3 Triển khai các API còn thiếu trong `AuthController` và gắn Guards bảo vệ: `/resend-otp`, `/forgot-password`, `/reset-password`

## 6. App Module Integration & Verification

- [x] 6.1 Khai báo và import `AuthModule` trong `AppModule`
- [x] 6.2 Kiểm thử thủ công toàn bộ 9 API: đăng ký, gửi lại OTP, verify OTP, quên mật khẩu, đặt lại mật khẩu, đăng nhập, làm mới token, đăng xuất và lấy thông tin cá nhân (`/auth/me`)
- [x] 6.3 Cập nhật và bổ sung Unit Test cho `AuthService` kiểm tra các kịch bản thành công và lỗi của toàn bộ các API

## 7. Email Notification Service & Consumer Integration

- [x] 7.1 Cài đặt các thư viện `nodemailer` và `@types/nodemailer`
- [x] 7.2 Cấu hình các biến môi trường SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`) trong `.env` và `.env.example`
- [x] 7.3 Tạo `EmailService` (`email.service.ts`) chứa logic khởi tạo transporter SMTP và Master HTML Template Builder động
- [x] 7.4 Tạo `NotificationConsumer` (`notification.consumer.ts`) để lắng nghe queue `notification.email.otp`, giải mã message và gọi `EmailService`
- [x] 7.5 Định nghĩa `NotificationModule` và import vào `AppModule`
- [x] 7.6 Viết Unit Test cho `EmailService` và `NotificationConsumer`
- [x] 7.7 Thực hiện kiểm thử tích hợp thủ công, gửi mã OTP thật qua Mailtrap khi thực hiện luồng đăng ký/quên mật khẩu từ client

## 8. Refactor 2-Step Password Reset (Option 2)

- [x] 8.1 Định nghĩa DTO `VerifyResetOtpDto` và thay thế `otp` bằng `resetToken` trong `ResetPasswordDto`
- [x] 8.2 Triển khai logic xác thực OTP khôi phục mật khẩu (`verifyResetOtp`) trong `AuthService` sinh ra `resetToken` lưu Redis (TTL 5m)
- [x] 8.3 Cập nhật logic đặt lại mật khẩu (`resetPassword`) trong `AuthService` xác thực qua `resetToken` thay vì OTP
- [x] 8.4 Expose endpoint `/auth/verify-reset-otp` và cập nhật `/auth/reset-password` trong `AuthController`
- [x] 8.5 Cập nhật và bổ sung Unit Test trong `auth.service.spec.ts` cho các API reset mật khẩu mới

## 9. Implement Global Response & Exception Formatting (Unified Envelope)

- [x] 9.1 Tạo custom decorator `BypassInterceptor` để loại trừ đóng gói đối với các endpoint trả về dữ liệu thô (nếu cần)
- [x] 9.2 Triển khai `TransformInterceptor` đóng gói dữ liệu thành công (`success`, `statusCode`, `message`, `data`, `timestamp`) và cấu hình toàn cục trong `main.ts`
- [x] 9.3 Triển khai `GlobalExceptionFilter` xử lý mọi exception thành cấu trúc lỗi thống nhất (`success`, `statusCode`, `message`, `errors`, `timestamp`, `path`) và cấu hình toàn cục trong `main.ts`
- [x] 9.4 Cập nhật và bổ sung các Unit Test/E2E Test để đảm bảo định dạng response mới hoạt động chính xác
