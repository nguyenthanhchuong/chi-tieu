# Nhật ký phiên bản — Sổ Chi Tiêu

Số bản hiện lên màn hình PIN (góc dưới) để biết máy đang chạy bản nào.

## Cách quay về bản cũ

```bash
git log --oneline --decorate    # xem các bản đã đánh dấu
git revert --no-commit v11..HEAD && git commit -m "Quay về bản v11"
git push origin master
```

Sau khi push, đợi khoảng 1 phút rồi mở app kèm đuôi chống đệm để nhận bản mới:
`https://nguyenthanhchuong.github.io/chi-tieu/?moi=1`

Nếu đã cài app ra màn hình chính thì bấm **Tải lại bản mới** ở cuối màn hình PIN.

> **Lưu ý về Apps Script:** quay lui code web KHÔNG tự quay lui phần chạy trên
> Google. Nếu bản cần quay về có thay đổi Apps Script, phải vào
> *Deploy → Manage deployments → Version* chọn lại đúng phiên bản cũ.
> Bảng dưới ghi rõ bản nào đụng tới Apps Script.

---

## v24 — Hạn mức chi tiêu theo danh mục
*Apps Script: không đổi*

- Đặt **hạn mức mỗi tháng** cho từng danh mục chi (nút **Đặt hạn mức** trong
  tab Thống kê)
- Thanh tiến độ đổi màu theo mức độ: xanh (an toàn) → cam (từ 80% trở lên) →
  đỏ (đã vượt), liếc là biết, không cần đọc số
- Mục **đang vượt xếp lên đầu**, không để lặn dưới đáy danh sách
- **Cảnh báo ngay lúc vừa ghi khoản** — đây mới là lúc nhắc có tác dụng, chứ
  vào Thống kê xem thì tiền đã tiêu rồi
- Chỉ hiện khi xem theo **Tháng**; xem tuần/quý/năm thì báo rõ lý do thay vì
  ghép bừa ra số vô nghĩa
- Khoản thu và khoản chuyển lọ **không** tính vào hạn mức
- Hạn mức khác sáu lọ: lọ là *chia tiền vào* khi có thu, hạn mức là *chặn tiền
  ra* theo danh mục — hai thứ bổ sung nhau
- Dùng chung kho thiết lập với tỉ lệ lọ nên **không phải deploy lại Apps Script**
- Số ca test: 155 → 169

## v23 — Tìm kiếm và lọc khoản
*Apps Script: không đổi*

- Nút **Tìm khoản** ở mục Gần đây, mở ra bảng lọc
- Tìm theo **ghi chú, danh mục, người, tên lọ**; gõ **không dấu vẫn ra** (gõ
  "an uong" tìm được "Ăn uống") vì gõ có dấu trên điện thoại rất chậm
- Nhiều từ khoá thì phải khớp hết, không phải khớp một từ là ra
- Lọc theo **loại** (Chi / Thu / Chuyển) và **khoảng ngày**
- Hiện **số khoản tìm được và tổng tiền** ngay dưới bảng lọc — con số này mới
  là thứ đáng xem, không phải chỉ danh sách
- Đóng bảng tìm thì tự bỏ lọc, tránh tưởng sổ bị mất khoản
- Số ca test: 139 → 156

## v22 — Khoản Chuyển hiện rõ chiều chuyển lọ
*Apps Script: không đổi*

- Khoản chuyển lọ không hiện giống khoản chi nữa: có dấu ⇄, màu riêng và ghi
  rõ "lọ nguồn → lọ đích"

## v21 — Sửa lỗi khoản Chuyển bị tính vào tổng chi
*Apps Script: không đổi*

- **Lỗi số liệu:** tổng chi tháng ở đầu app dùng `!laKhoanThu` nên gom cả khoản
  chuyển lọ vào chi, trong khi màn Thống kê dùng `laKhoanChi` nên loại ra —
  hai con số đá nhau mà nhìn vẫn "hợp lý" nên rất khó phát hiện

## v20 — Nhãn GIA ĐÌNH trên thanh tiêu đề
*Apps Script: không đổi*

- Có sổ cá nhân chạy song song trên cùng máy, ghi nhầm sổ thì phải vào tận
  Google Sheet sửa nên cần nhãn phân biệt

## v19 — Khoá tạm khi nhập sai PIN nhiều lần
*Apps Script: không đổi*

- Nhập sai PIN liên tiếp thì khoá tạm, chống dò mã
- PIN chuyển sang **Script Properties** của Apps Script, không còn nằm trong
  mã nguồn công khai nữa

## v18 — Chọn ngày khi nhập
*Apps Script: không đổi*

- Thêm ô chọn ngày ở màn hình nhập, mặc định hôm nay
- Ngày khác hôm nay thì ô đổi viền đậm và hiện nút **về hôm nay**, để không
  lỡ tay ghi nhầm vào ngày cũ rồi vài hôm sau mới phát hiện
- Giữ nguyên ngày đã chọn sau khi lưu, tiện ghi liền nhiều khoản cùng một ngày
- Hộp sửa khoản cũng sửa được ngày

## v17 — Đổi tông màu sang Hồng đào
*Apps Script: không đổi*

- Nền `#fdf3f0`, màu neo `#b85252` (gạch ngả cam), khoản thu `#2f7d5f`
- Đỏ báo lỗi làm sẫm hẳn (`#8f1d14`) để không lẫn với màu gạch của nút
- Đổi luôn màu thanh trạng thái điện thoại, màn hình chờ và icon ngoài
  màn hình chính
- **Gom màu khoản thu về một biến `--thu`**: trước đây ghi cứng ở 5 chỗ trong
  CSS cộng 3 chỗ cho chế độ tối, đổi tông rất dễ sót
- Biểu đồ đọc màu từ biến CSS thay vì ghi cứng trong JS, nên chỉ còn một
  nguồn màu duy nhất cho cả app

> Icon đã đổi màu. Nếu anh cài app ra màn hình chính từ trước, cần gỡ icon cũ
> rồi cài lại mới thấy icon mới.

## v16 — Biểu đồ diễn biến theo tháng
*Apps Script: không đổi*

- Biểu đồ **cột** hoặc **đường** cho 6 tháng gần nhất, bấm để đổi kiểu
- Chọn xem: tổng thu và tổng chi, hoặc riêng từng nguồn thu / danh mục chi /
  từng người
- Chạm vào cột hoặc điểm để xem số tiền đầy đủ
- Nhãn trục rút gọn (15tr, 500k) cho khỏi chồng chữ
- Tháng không có khoản nào vẫn hiện với giá trị 0, biểu đồ không đứt quãng
- Vẽ bằng SVG viết tay, không dùng thư viện ngoài nên vẫn chạy khi mất mạng
- Số ca test: 113 → 134

## v15 — Sửa và xoá khoản đã ghi
*Apps Script: **Version 8** (thêm lệnh `update` và `delete`)*

- Bấm vào một khoản trong mục **Gần đây** để sửa số tiền, danh mục, người, ghi chú
- Nút xoá phải bấm hai lần mới xoá hẳn, tránh lỡ tay trên điện thoại
- Sửa số tiền khoản thu thì tự chia lại vào các lọ theo tỉ lệ hiện tại
- Sửa danh mục khoản chi thì lọ tương ứng đổi theo
- Khoản còn nằm trong hàng chờ (chưa gửi lên Sheet) thì chưa sửa được
- Cảnh báo khi sửa lệnh dồn dư do app tự tạo: xoá đi thì lần mở sau sẽ được
  tạo lại, vì phần dư tháng đó vẫn còn

> Bản này có đổi Apps Script. Nếu quay lui về v14 trở về trước, phải vào
> *Manage deployments* chọn lại **Version 7**.

## v14 — Bấm vào dòng thống kê để xem chi tiết
*Apps Script: không đổi*

- Bấm vào từng dòng trong **Thu theo nguồn**, **Chi theo danh mục**, **Chi theo
  người** để xem danh sách khoản đứng sau con số đó
- Tổng các khoản chi tiết bằng đúng số trên thanh (có ca test canh từng dòng)
- Lệnh chuyển lọ không lọt vào chi tiết khoản chi
- Gom hộp chi tiết của lọ và của thống kê thành một khuôn dùng chung
- Số ca test: 102 → 113

## v13 — Xem chi tiết lọ và thống kê nguồn thu
*Apps Script: không đổi*

- Bấm vào một lọ để xem mọi khoản đã tác động lên lọ đó: tiền chia từ khoản
  thu, các khoản chi, tiền chuyển vào và chuyển đi
- Danh sách chi tiết cộng lại đúng bằng số dư đang hiện (có ca test canh)
- Thống kê thêm mục **Thu theo nguồn** (Lương, Thưởng, Kinh doanh...)
- Bổ sung số liệu thu theo người
- Số ca test: 88 → 102

## v12 — Sáu chiếc lọ (giao diện)
*Apps Script: Version 7*

- Màn hình **Lọ**: số dư từng lọ, thanh tiến độ, phần đã đầu tư và đã tiết kiệm
- Chuyển tiền giữa các lọ, kèm cảnh báo khi rút từ lọ tích luỹ
- Tự động dồn phần dư cuối tháng vào lọ nhận, có ghi lịch sử
- Màn hình chỉnh tỉ lệ sáu lọ, chặn khi tổng khác 100%
- Danh mục mới: Đồ dùng gia đình, Mua sắm cá nhân, Học tập, Biếu tặng
- Tỉ lệ khởi điểm 50/10/15/10/10/5

## v11 — Tách logic và bổ sung unit test
*Apps Script: không đổi*

- Tách phần tính toán sang `logic.js`, `app.js` chỉ còn lo giao diện
- Thêm `test.html`: 88 ca test, mở là tự chạy
- Trang test luôn nạp code mới nhất, không test nhầm bản trong bộ nhớ đệm

## v10 — Khoản thu và tab Thống kê
*Apps Script: Version 5-6 (thêm cột "Loại")*

- Ghi được cả khoản thu, không chỉ khoản chi
- Tab **Thống kê** theo tuần / tháng / quý / năm
- Thu - Chi - Còn lại, chi theo danh mục và theo người
- Nới giới hạn đọc từ 100 lên 3.000 dòng để thống kê cả năm đủ số

## v9 — Sửa tương phản chế độ tối
*Apps Script: không đổi*

- Làm đậm màu hồng ở chế độ tối: chữ trắng trên nút từ 4,24 lên 4,97 (chuẩn tối thiểu 4,5)

## v8 — Giao diện hồng pastel
*Apps Script: không đổi*

- Đổi toàn bộ tông màu, kèm màu thanh trạng thái điện thoại và icon ngoài màn hình chính

## v7 — Sửa lỗi không mở được sổ
*Apps Script: không đổi*

- **Lỗi nghiêm trọng:** đăng nhập đúng nhưng màn hình PIN không tắt, che kín app.
  Do `.gate { display: flex }` đè lên thuộc tính `hidden` của trình duyệt.
- Thêm luật `[hidden] { display: none !important }` để không tái diễn

## v6 — Nhật ký dò lỗi trên màn hình
*Apps Script: không đổi*

- Ghi 6 việc gần nhất vào máy, còn nguyên kể cả khi trang tự nạp lại
- Chỉ ẩn thông báo lỗi khi thực sự gõ phím (trước đây trình quản lý mật khẩu tự điền cũng xoá mất lỗi)

## v5 — Số hiệu bản và nút tự dọn
*Apps Script: không đổi*

- Hiện số bản trên màn hình PIN
- Nút **Tải lại bản mới**: tự gỡ service worker và xoá bộ nhớ đệm

## v4 — Sửa service worker
*Apps Script: không đổi*

- **Lỗi nghiêm trọng:** service worker dùng cache-first nên mọi bản sửa đẩy lên
  đều không tới được máy người dùng. Đổi sang ưu tiên mạng.

## v3 — Thông báo lỗi dễ hiểu và tự thử lại
*Apps Script: không đổi*

- Lỗi mạng tự thử lại 3 lần rồi mới báo; sai PIN báo ngay
- Không để lọt mã lỗi kỹ thuật ra màn hình

## v2 — Sửa lỗi dính mã PIN cũ
*Apps Script: không đổi*

- Mã cũ còn nằm trong ô nhập làm mã mới bị nối vào đuôi, gõ đúng vẫn báo sai

## v1 — Bản đầu
*Apps Script: Version 1-4*

- PWA ghi chi tiêu, dữ liệu về Google Sheet, khoá bằng mã PIN
- Chạy được trên điện thoại, máy tính và web từ cùng một bộ code
