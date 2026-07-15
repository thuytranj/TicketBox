# TicketBox Web Portal — Hướng dẫn Cài đặt & Khởi chạy

Cổng thông tin web (Web Portal) của hệ thống bán vé sự kiện TicketBox phục vụ hai nhóm đối tượng người dùng chính:
- **Khán giả (Client Space):** Tìm kiếm sự kiện, chọn hạng vé, đặt chỗ giữ vé thời gian thực và thanh toán trực tuyến qua cổng MoMo, quản lý ví vé cá nhân (My Bookings).
- **Ban tổ chức (Admin Dashboard):** Thiết lập sự kiện, quản lý hạng vé, theo dõi số liệu doanh thu dạng Bento Grid, kiểm soát tiến độ bán vé, quản lý danh sách khách mời VIP và tạo tiểu sử sự kiện bằng AI.

Ứng dụng được xây dựng trên nền tảng **React 18** kết hợp với **TypeScript**, chạy bằng công cụ đóng gói siêu tốc **Vite** và sử dụng **Vitest** để kiểm thử tự động.

---

## 1. Luồng dữ liệu & Tích hợp Hệ thống (Data Flow & Architecture)

Frontend Web Portal đóng vai trò giao tiếp trực tiếp với người dùng và liên kết chặt chẽ với cơ sở hạ tầng Backend (NestJS, PostgreSQL, Redis, RabbitMQ) theo sơ đồ luồng dưới đây:

```
               ┌────────────────────────────────────────────────────────┐
               │              Web Portal (React Client)                │
               │                                                        │
               │    REST Requests                   Socket.IO Events    │
               └──────────┬─────────────────────────────────▲───────────┘
                          │ (qua Vite Proxy)                │
                          ▼                                 │
     ┌───────────────────────────────────────────┐          │
     │            nginx-lb:3000 (Proxy)          │          │
     └────────────────────┬──────────────────────┘          │
                          │                                 │
                          ▼                                 │
     ┌───────────────────────────────────────────┐          │
     │      ticketbox-api:3000 (NestJS App)      ├──────────┘
     └──────────┬──────────────────────┬─────────┘
                │                      │
                ▼                      ▼
     ┌────────────────────┐  ┌───────────────────┐
     │ PostgreSQL (DB)    │  │ Redis Cache       │
     └────────────────────┘  └───────────────────┘
```

## 2. Cấu trúc thư mục dự án (Directory Structure)

Dưới đây là sơ đồ cấu trúc các thư mục chính của mã nguồn Frontend:

```text
src/frontend/
├── src/
│   ├── api/                  # Cấu hình API client và các hàm gọi API chung
│   ├── assets/               # Chứa các tài nguyên tĩnh (hình ảnh, logo)
│   ├── components/           # Các component dùng chung toàn dự án (RouteGuards...)
│   ├── features/             # Chứa các module chức năng chính của ứng dụng
│   │   ├── admin/            # Quản trị (Dashboard, Quản lý sự kiện, Soát vé)
│   │   ├── auth/             # Xác thực (Đăng nhập, Đăng ký, Quản lý token)
│   │   ├── booking/          # Đặt vé và Quản lý vé cá nhân (My Bookings)
│   │   ├── concerts/         # Xem danh sách và chi tiết sự kiện
│   │   ├── notifications/    # Hệ thống chuông thông báo thời gian thực
│   │   ├── payment/          # Tích hợp cổng thanh toán VNPay
│   │   └── socket/           # Kết nối WebSocket (Socket.IO) nhận sự kiện real-time
│   ├── test/                 # Chứa toàn bộ các file unit test (Vitest)
│   ├── App.tsx               # Cấu hình các tuyến đường (Routing) chính
│   ├── index.css             # Định nghĩa CSS variables, design token và global styles
│   └── main.tsx              # Tệp chạy ứng dụng React (Entry Point)
├── package.json              # Khai báo thư viện phụ thuộc và các scripts chạy dự án
├── tsconfig.json             # Cấu hình dự án TypeScript
└── vite.config.ts            # Cấu hình bundler Vite và dev-proxy
```

---

## 3. Yêu cầu hệ thống

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt các phần mềm sau:
- **Node.js** >= 18.x (khuyên dùng phiên bản LTS mới nhất)
- **NPM** >= 9.x
- **Backend API Server** đang hoạt động (ở chế độ Host hoặc Docker Compose) để thực hiện kết nối dữ liệu.

---

## 4. Các bước cài đặt chi tiết

### Bước 1: Cài đặt các thư viện phụ thuộc (Dependencies)
Di chuyển vào thư mục `src/frontend` và chạy lệnh cài đặt:
```bash
cd src/frontend
npm install
```

### Bước 2: Thiết lập biến môi trường (.env)
Hệ thống sử dụng cơ chế đọc biến môi trường qua `import.meta.env` của Vite. Mặc định khi chạy local, nếu bạn không cấu hình gì, hệ thống sẽ tự động dùng các giá trị mặc định:
- API endpoint: Sử dụng proxy `/api` (được Vite chuyển tiếp tới `http://localhost:3000` của backend).
- WebSocket URL: `http://localhost:3000`.

Nếu muốn tùy chỉnh cổng chạy hoặc kết nối tới cụ thể máy chủ khác, hãy tạo tệp `.env` tại thư mục `src/frontend`:
```env
# URL máy chủ API Backend (Mặc định: /api/v1 nếu bỏ trống)
VITE_API_BASE_URL=http://localhost:3000/api/v1

# URL máy chủ WebSocket để nhận thông tin sự kiện thời gian thực (Mặc định: http://localhost:3000)
VITE_SOCKET_URL=http://localhost:3000
```

---

## 5. Quy trình Khởi chạy & Phát triển (Developer Workflow)

Quy trình phát triển của Frontend được đồng bộ hóa tương ứng với các Workflow hoạt động của Backend:

### 4.1 Quy trình Phát triển Cục bộ (Workflow A - Host Development)
*Khuyên dùng trong quá trình viết code và sửa lỗi giao diện hàng ngày vì hỗ trợ Hot-Reload (HMR) cực nhanh.*

1. **Khởi động Backend (trên host):**
   Đảm bảo các container cơ sở dữ liệu và app NestJS đang chạy (cổng `3000`).
2. **Khởi chạy Frontend Web:**
   ```bash
   # Đứng tại thư mục src/frontend
   npm run dev
   ```
   *Vite Server sẽ chạy tại: **`http://localhost:5173`**. Yêu cầu gọi API `/api/*` sẽ được proxy chuyển tiếp thẳng tới NestJS chạy ở cổng `3000`.*

### 4.2 Quy trình Tích hợp hệ thống (Workflow B - Docker Compose Integration)
*Khuyên dùng khi chạy kiểm thử tích hợp (E2E), kiểm tra cân bằng tải (Load Balancing) hoặc giả lập môi trường Production.*

1. **Khởi động toàn bộ cụm Docker Compose:**
   Chạy lệnh ở thư mục gốc dự án để khởi chạy cơ sở dữ liệu, API Node Load-balanced (2 instances) phía sau Nginx:
   ```bash
   docker compose up --build -d
   ```
2. **Khởi chạy Frontend Web:**
   ```bash
   # Đứng tại thư mục src/frontend
   npm run dev
   ```
   *Lúc này, yêu cầu API từ Frontend sẽ đi qua Vite Proxy ➡️ Nginx Load Balancer (`nginx-lb` ở cổng `3000`) ➡️ Tự động điều phối đến một trong hai API instances.*

---

## 6. Tài khoản kiểm thử mặc định (Default Seed Accounts)

Sau khi khởi chạy ứng dụng và nạp dữ liệu mẫu của Backend (`npm run db:seed:direct` tại `src/backend`), lập trình viên có thể sử dụng các tài khoản mặc định dưới đây để đăng nhập trải nghiệm:

| Vai trò người dùng | Địa chỉ Email | Mật khẩu đăng nhập | Phạm vi tính năng thử nghiệm |
| :--- | :--- | :--- | :--- |
| **Ban tổ chức (Organizer)** | `organizer@ticketbox.vn` | `123123` | Quản trị Dashboard, Quản lý show, Import khách VIP, Tạo Bio AI |
| **Khán giả (Audience)** | `audience@ticketbox.vn` | `123123` | Mua vé, xem danh sách show, truy cập ví vé (My Bookings), Check-out MoMo |
| **Nhân viên soát vé (Staff)** | `staff@ticketbox.vn` | `123123` | Quét QR Code trên Mobile App Gate |

---

## 7. Quy tắc sử dụng Design System & CSS Tokens (Quy chuẩn code UI)

Để đảm bảo tính nhất quán thẩm mỹ giống như hệ thống Design Token trên Mobile (Flutter), mã nguồn giao diện Web **tuyệt đối không sử dụng** mã màu thô (Hex/RGB) hoặc các khoảng cách tự phát. Lập trình viên bắt buộc phải sử dụng các biến CSS Tokens được định nghĩa sẵn trong tệp index.css:

### 6.1 Tokens Màu sắc chủ đạo (Color Variables)
*   `var(--primary)` / `var(--primary-soft)`: Xanh dương thương hiệu TicketBox, dùng cho các nút bấm chính, liên kết điều hướng active.
*   `var(--accent)` / `var(--accent-soft)`: Màu hồng tím, chuyên dùng cho trạng thái soát vé (Check-in), các nút nổi bật phụ.
*   `var(--warning)` / `var(--warning-soft)`: Màu vàng hổ phách, dùng cho cảnh báo lỗi và trạng thái vé "Giữ chỗ".
*   `var(--success)`: Màu xanh lá cây, dùng cho biểu thị doanh thu tăng trưởng và trạng thái đơn hàng "Đã thanh toán".
*   `var(--surface)` / `var(--surface-alt)`: Màu nền thẻ, panel dữ liệu, giúp giao diện trông nổi bật trên nền chính.

### 6.2 Quy định về Icon (Biểu tượng trong code)
*   Tuyệt đối **không được** nhúng mã SVG thô trực tiếp trong các tệp component `.tsx` hoặc sử dụng các tệp ảnh icon rời rạc (`.png`, `.svg` trong assets) gây nặng ứng dụng và mất đồng bộ.
*   Lập trình viên bắt buộc phải sử dụng các Icon component được import trực tiếp từ thư viện **`lucide-react`** đã thiết lập sẵn trong dự án.

### 6.3 Quy chuẩn Responsive (Desktop-First & Mobile-Friendly)
Dự án sử dụng cơ chế thiết kế **Desktop-First** (thiết lập kiểu dáng hiển thị cho màn hình rộng trước, sau đó sử dụng các truy vấn `@media (max-width: ...px)` để ghi đè tùy biến cho các màn hình nhỏ hơn):
*   **Màn hình máy tính (Desktop):** Bố cục hiển thị lưới Bento Grid đa cột rộng rãi, dễ dàng tra cứu thông tin tổng quan.
*   **Màn hình di động (`<= 960px`):**
    *   Menu Admin dọc tự động chuyển thành **Slide-over Drawer** trượt ẩn hiện mượt mà từ lề trái đè lên nội dung, hỗ trợ lớp nền mờ backdrop làm dịu giao diện.
    *   Trang Đăng nhập ẩn bớt banner phụ, tự động đẩy khung nhập liệu lên đầu để người dùng tương tác ngay lập tức.
    *   Giao diện danh sách đơn đặt vé tự động xếp dọc (flex-column) và mở rộng ảnh poster 100% chiều ngang để cuộn mượt mà.

---

## 8. Quy trình Kiểm thử tự động (Testing Workflow)

Frontend sử dụng **Vitest** kết hợp với thư viện giả lập DOM **jsdom** để thực hiện kiểm thử tự động các component và logic hooks.

*   **Chạy toàn bộ kiểm thử một lần:**
    ```bash
    npm run test
    ```
*   **Chạy kiểm thử ở chế độ theo dõi (Watch Mode):**
    ```bash
    npx vitest
    ```
*   **Môi trường Mock dữ liệu:**
    Các tệp cấu hình kiểm thử tự động, giả lập API (`msw` hoặc mock fetch) và các biến môi trường chạy thử được tập trung trong tệp `src/test/setup.ts`. Hãy đảm bảo cập nhật tệp này nếu bạn bổ sung thêm thư viện ngoài hoặc API endpoint mới.
