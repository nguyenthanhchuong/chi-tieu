# Sổ Chi Tiêu

App ghi chi tiêu gia đình dùng riêng, chạy được trên điện thoại, máy tính và web
từ cùng một bộ code. Dữ liệu lưu trong Google Sheet của gia đình.

## Kiến trúc

```
Điện thoại / Máy tính / Web
   (PWA trên GitHub Pages)
            │  POST kèm PIN
            ▼
   Google Apps Script Web App
            │
            ▼
       Google Sheet
```

Không có máy chủ riêng, không tốn phí. Apps Script đóng vai trò lớp trung gian
để trang web ghi được vào Sheet mà không cần lộ thông tin đăng nhập Google.

## Cài đặt

### 1. Dựng phần Google

1. Tạo một Google Sheet mới.
2. Trong Sheet chọn **Extensions → Apps Script**.
3. Xoá code mẫu, dán toàn bộ nội dung file [`apps-script.gs`](apps-script.gs).
4. Đổi giá trị `PIN` ở đầu file thành mã riêng.
5. **Deploy → New deployment**:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy URL Web App nhận được.

### 2. Nối vào app

Mở [`app.js`](app.js), dán URL vừa copy vào biến `API_URL` ở dòng đầu, rồi push lên GitHub.

### 3. Cài lên máy

| Thiết bị | Cách cài |
|---|---|
| iPhone | Mở link bằng Safari → nút Chia sẻ → *Thêm vào MH chính* |
| Android | Mở link bằng Chrome → menu → *Cài đặt ứng dụng* |
| Windows / Mac | Mở link bằng Chrome/Edge → biểu tượng cài đặt trên thanh địa chỉ |

Lần đầu mở app sẽ hỏi PIN. Nhập một lần, máy nhớ cho những lần sau.

## Về bảo mật

Repo phải để public thì GitHub Pages mới chạy miễn phí, nghĩa là URL Apps Script
trong code ai cũng đọc được. Vì vậy mọi yêu cầu đều phải kèm PIN đúng, và PIN
**không** nằm trong code — nó do người dùng nhập và chỉ lưu trên máy họ.

Đây là mức bảo vệ hợp lý cho sổ chi tiêu gia đình, không phải mức dành cho dữ
liệu tài chính nghiêm ngặt. Nếu cần chặt hơn thì phải chuyển sang hạ tầng có
đăng nhập thật (ví dụ Firebase Auth).

## Ghi chú kỹ thuật

- Gọi API bằng `Content-Type: text/plain` là cố ý: Apps Script chuyển hướng khi
  trả kết quả, dùng `application/json` sẽ kích hoạt preflight CORS và bị chặn.
- Khoản chi gửi thất bại được cất vào hàng chờ trong máy và tự gửi lại khi mở
  app lần sau, tránh mất dữ liệu lúc mất sóng.
- Mỗi khoản có `id` riêng, Apps Script bỏ qua `id` đã tồn tại nên gửi lại nhiều
  lần cũng không bị ghi trùng.
- Sửa CSS/JS thì tăng số `?v=` trong `index.html` **và** `CACHE_VERSION` trong
  `sw.js`, nếu không máy đã cài sẽ giữ bản cũ.
