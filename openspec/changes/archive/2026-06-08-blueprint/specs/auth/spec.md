# Đặc tả: Xác thực và Phân quyền người dùng (JWT & RBAC)

## Mô tả
Hệ thống thực hiện xác thực danh tính người dùng bằng cơ chế stateless sử dụng JSON Web Token (JWT) gửi qua header HTTP. Đồng thời thực hiện phân quyền dựa trên vai trò (Role-Based Access Control - RBAC) để kiểm soát quyền truy cập API của 3 nhóm đối tượng: Khán giả (`audience`), Ban tổ chức (`organizer`), và Nhân viên soát vé (`gate_staff`).

## Luồng chính
1. **Đăng nhập & Cấp Token:** Người dùng gửi yêu cầu đăng nhập bằng email và mật khẩu. Hệ thống kiểm tra thông tin, nếu chính xác sẽ sinh JWT chứa payload (`userId`, `email`, `role`) ký bằng khóa bí mật của server và trả về cho Client.
2. **Gửi Request:** Client đính kèm JWT vào header `Authorization: Bearer <JWT_TOKEN>` cho mọi request gửi tới các endpoint cần bảo vệ.
3. **Xác thực (AuthGuard):** Tầng trung gian giải mã token, kiểm tra chữ ký và hạn dùng. Nếu hợp lệ, thông tin user được tiêm vào đối tượng request (`request.user`).
4. **Phân quyền (RolesGuard):** Guards đọc các Metadata vai trò được cấu hình tại Router/Controller (ví dụ `@Roles('organizer')`) và so sánh với `request.user.role`.
5. **Kiểm tra quyền sở hữu (Ownership Check):** Tầng Service thực hiện kiểm tra bổ sung để đảm bảo người dùng chỉ thao tác trên các tài nguyên thuộc sở hữu của chính mình (ví dụ: Khán giả chỉ có quyền đọc/hủy Booking của chính họ).
6. **Xử lý thành công:** Chuyển tiếp request đến Controller Layer để thực thi nghiệp vụ và trả về kết quả.

## Kịch bản lỗi
* **Token không hợp lệ / Hết hạn:** Server từ chối xử lý và trả về mã lỗi `HTTP 401 Unauthorized`.
* **Sai vai trò truy cập:** Ví dụ tài khoản `khán giả` cố gắng gọi API tạo concert `POST /concerts` của `ban tổ chức`. Server từ chối và trả về mã lỗi `HTTP 403 Forbidden`.
* **Sai quyền sở hữu:** Ví dụ một khán giả cố truy cập chi tiết đơn hàng của khán giả khác. Hệ thống chặn tại Service layer và trả về lỗi `HTTP 403 Forbidden`.

## Ràng buộc
* **Stateless:** Server không lưu thông tin session trong bộ nhớ. Mọi thông tin phân quyền hoàn toàn dựa vào payload giải mã từ JWT.
* **Bảo mật:** Mã khóa bí mật JWT (`JWT_SECRET`) phải được cấu hình qua biến môi trường. Thời gian hết hạn của token cần được đặt ngắn (ví dụ: 1 giờ) để giảm thiểu rủi ro khi bị rò rỉ.
* **Thời gian đáp ứng:** Quá trình giải mã và kiểm tra quyền tại Guards phải thực hiện cực kỳ nhanh (< 2ms) bằng các phép toán in-memory, tránh query cơ sở dữ liệu lặp đi lặp lại.

## Tiêu chí chấp nhận
* [ ] Đăng nhập thành công trả về mã JWT hợp lệ chứa đúng vai trò (`role`) của người dùng.
* [ ] Tài khoản có role `organizer` thực hiện được các thao tác tạo/sửa/xóa concert.
* [ ] Tài khoản có role `audience` khi truy cập các API của `organizer` hoặc `gate_staff` phải bị hệ thống từ chối và trả về mã lỗi `HTTP 403 Forbidden`.
* [ ] Tài khoản có role `gate_staff` khi gọi API quét vé `/checkin/scan` được thông qua, nhưng gọi các API admin hoặc đặt vé phải bị trả về lỗi `HTTP 403 Forbidden`.
* [ ] Mọi request không kèm Header Authorization hoặc kèm token bị sửa đổi/hết hạn đến các endpoint được bảo vệ đều nhận về mã lỗi `HTTP 401 Unauthorized`.

## ADDED Requirements

### Requirement: Phân quyền dựa trên vai trò (RBAC)
Hệ thống SHALL kiểm tra JWT token và vai trò của người dùng để quyết định quyền truy cập vào các API endpoints tương ứng.

#### Scenario: Đăng nhập thành công và phân quyền chính xác
- **WHEN** Người dùng gửi yêu cầu đăng nhập hợp lệ và truy cập các API tương ứng với vai trò của mình
- **THEN** Hệ thống cấp JWT và cho phép truy cập các API được phân quyền, đồng thời từ chối truy cập bằng HTTP 403 Forbidden nếu sai vai trò
