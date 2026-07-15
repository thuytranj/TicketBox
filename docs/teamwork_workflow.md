# Teamwork Workflow

Tài liệu này đặc tả quy trình phát triển phần mềm, quản lý mã nguồn qua Git, quy chuẩn viết commit message và quy trình gửi Pull Request áp dụng cho toàn bộ thành viên trong dự án TicketBox.

---

## 1. Git Workflow

### Branch Strategy

Hệ thống nhánh được phân chia rõ ràng để đảm bảo tính ổn định của mã nguồn trên production và dễ dàng tích hợp các tính năng mới:

```
main (production)
└── develop (integration)
```

- **`main` (production)**: Nhánh chứa mã nguồn ổn định nhất, đã được kiểm thử kỹ càng và đang chạy trên môi trường production. Chỉ Merge từ `develop` vào thông qua Pull Request chính thức khi phát hành phiên bản mới (Release).
- **`develop` (integration)**: Nhánh tích hợp chính. Mọi nhánh tính năng (`feature/*`) đều được tạo ra từ `develop` và merge ngược lại về `develop` sau khi hoàn thành.
- **`feature/your-feature-name`**: Nhánh phát triển tính năng hoặc sửa lỗi của từng thành viên. Nhánh này được tách ra từ `develop` và sẽ được xóa đi sau khi đã merge thành công vào `develop`.

---

## 2. Commit Message Convention

Mọi thành viên cần tuân thủ quy chuẩn viết commit message để lịch sử Git sạch sẽ, dễ theo dõi và hỗ trợ tự động hóa việc sinh changelog nếu cần.

### Format (Định dạng)

```
<type>(<scope>): <subject>

<body>

<footer>
```

- `<type>`: Thể hiện mục đích của commit (xem chi tiết ở bảng dưới).
- `<scope>`: Phạm vi ảnh hưởng của commit (ví dụ: `auth`, `booking`, `payment`, `ui`, `core`).
- `<subject>`: Mô tả ngắn gọn về thay đổi, viết bằng câu mệnh lệnh ngắn, bắt đầu bằng chữ thường và không có dấu chấm ở cuối.
- `<body>` (Tùy chọn): Mô tả chi tiết hơn về nguyên nhân và giải pháp thực hiện trong commit.
- `<footer>` (Tùy chọn): Chứa thông tin về Breaking Changes hoặc liên kết tới ID của Issue/Task tương ứng (ví dụ: `Closes #123`).

### Types (Các loại commit)

| Type | Mô tả ý nghĩa |
| :--- | :--- |
| **`feat`** | Tính năng mới |
| **`fix`** | Sửa bug |
| **`docs`** | Cập nhật documentation |
| **`style`** | Format code (không ảnh hưởng logic) |
| **`refactor`** | Refactor code |
| **`test`** | Thêm/sửa tests |
| **`chore`** | Cập nhật build, dependencies |

---

## 3. Pull Request Process

Quy trình gửi yêu cầu tích hợp mã nguồn (Pull Request) lên kho chứa từ xa (Remote Repository) cần tuân thủ 4 bước sau:

### Creating PR

#### 1. Tạo branch từ `develop`
Trước khi bắt đầu code bất kỳ tính năng mới nào, hãy cập nhật nhánh `develop` mới nhất và tạo một nhánh tính năng từ đó:
```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature
```

#### 2. Develop & commit
Tiến hành viết code, kiểm thử cục bộ và commit các thay đổi theo đúng chuẩn commit message đã thống nhất ở mục 2:
```bash
git add .
git commit -m "feat(scope): your message"
```

#### 3. Push to remote
Đẩy nhánh tính năng lên GitHub:
```bash
git push origin feature/your-feature
```

#### 4. Tạo Pull Request trên GitHub
Truy cập kho chứa dự án trên GitHub và thực hiện tạo Pull Request từ nhánh vào nhánh `develop`:
- **Title**: Mô tả ngắn gọn
- **Description**: Chi tiết thay đổi
- **Assign reviewers**
