## 1. Cơ sở hạ tầng & Môi trường local

- [x] 1.1 Tạo tệp tin cấu hình môi trường mẫu `.env.example` cấu hình port và credentials cho PostgreSQL, Redis, RabbitMQ ở thư mục gốc
- [x] 1.2 Viết tệp tin `docker-compose.yml` ở thư mục gốc chứa cấu hình PostgreSQL, Redis và RabbitMQ
- [x] 1.3 Chạy lệnh `docker compose up -d` để khởi chạy các dịch vụ local và xác nhận các container đang hoạt động ổn định

## 2. Khởi tạo & Cấu hình dự án NestJS

- [x] 2.1 Khởi tạo dự án NestJS TypeScript tại thư mục `src/backend` thông qua CLI
- [x] 2.2 Cài đặt các dependencies cơ bản: `@nestjs/config`, `@nestjs/typeorm`, `typeorm`, `pg`, `ioredis`, `amqplib`, `class-validator`, `class-transformer`, `typeorm-extension`, `dotenv`
- [x] 2.3 Đăng ký `ConfigModule` đọc từ tệp tin `.env` trong `AppModule`

## 3. Cấu hình các kết nối hạ tầng (PostgreSQL & Redis)

- [x] 3.1 Cấu hình `TypeOrmModule` kết nối PostgreSQL sử dụng cấu hình từ `ConfigModule`
- [x] 3.1a Thiết lập tệp cấu hình `src/db/ormconfig.ts` sử dụng `dotenv` tự nạp cấu hình `.env` phục vụ CLI
- [x] 3.1b Đăng ký các lệnh chạy TypeORM CLI và Seeder (`migration:generate`, `migration:run`, `db:seed`) vào `package.json`
- [x] 3.2 Viết module/provider cho Redis Client dùng chung thông qua thư viện `ioredis`

## 4. Cấu hình kết nối RabbitMQ

- [x] 4.1 Thiết lập kết nối RabbitMQ Client phục vụ cho việc publish/consume các sự kiện bất đồng bộ

## 5. Dựng cấu trúc thư mục Modular Monolith

- [x] 5.1 Tạo khung thư mục cho các module nghiệp vụ trong `src/modules/`: `auth`, `concerts`, `bookings`, `payments`, `checkin`, `notification`
- [ ] 5.2 Chạy thử ứng dụng bằng lệnh `npm run start:dev` để kiểm tra kết nối tới các dịch vụ hạ tầng thành công mà không ném lỗi
