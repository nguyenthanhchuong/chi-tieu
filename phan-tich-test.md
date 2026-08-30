# Phân tích độ phủ test — Sổ Chi Tiêu

Ngày phân tích: 2026-08-20 · trên nhánh `claude/test-coverage-analysis-sxsjqt`

## 1. Tình hình hiện tại

Bộ test hiện có nằm trong `test.html`: 134 ca, 23 nhóm, khung test tự viết
(`nhom` / `test` / `bang`), nạp `logic.js` rồi chạy trong trình duyệt.

**Đã kiểm chứng bằng cách chạy thật** (bóc phần thân `chayToanBo()` ra chạy dưới
Node + đo độ phủ bằng V8):

| Chỉ số | Kết quả |
|---|---|
| Số ca chạy | 134 |
| Số ca hỏng | **0** |
| Độ phủ dòng của `logic.js` | **98,9 %** (354/358 dòng) |
| Dòng chưa chạm | 232, 233 (nhánh `loai` lạ), 452, 453 (nhánh lỗi JSON) |

Phần tính toán trong `logic.js` được test rất kỹ — gần như không còn dòng nào
chưa chạy qua. Vấn đề không nằm ở đó.

Vấn đề nằm ở phạm vi: bộ test **chỉ nạp `logic.js`**, không nạp gì khác.

| File | Dòng code | Có test? |
|---|---:|---|
| `logic.js` | 357 | có — 98,9 % dòng |
| `app.js` | 1007 | **không** |
| `apps-script.gs` | 218 | **không** |
| `sw.js` | 40 | **không** |
| **Tổng** | **1622** | **22 % nằm trong tầm test** |

Nói cách khác: 78 % lượng code của app không có một ca test nào chạm tới, và
không thể chạm tới, vì `test.html` không có cách nào nạp `app.js` (nó chạy
`init()` ngay khi nạp và cần DOM thật) hay `apps-script.gs` (cần
`SpreadsheetApp`).

Ngoài ra:

- Không có `package.json`, không có CI. Test chỉ chạy khi có người **nhớ** mở
  `test.html` bằng tay.
- `test.html` không được nhắc tới trong `README.md`, cũng không có link từ
  `index.html`. Người mới vào repo không có cách nào biết là có test.
- `du-lieu-cu.json` (319 khoản thật, 9 tháng) nằm trong repo mà không ca test
  nào dùng.

---

## 2. Sáu vùng nên bổ sung, xếp theo mức đáng làm trước

### Vùng 1 — Đúng cái phần chống mất dữ liệu lại không có test

`README.md` hứa ba lớp bảo vệ dữ liệu. Cả ba đều nằm ngoài `logic.js`, nên cả
ba đều không có test:

| Lớp bảo vệ | Nằm ở đâu | Test hiện có |
|---|---|---|
| Hàng chờ khi mất mạng, tự gửi lại lần sau | `app.js` — `store.queue`, `saveEntry` (khối `catch`), `flushQueue` | không |
| Thử lại khi Google trả 4xx/5xx nhất thời | `app.js` — `callApi`, `RETRY_DELAYS` | không |
| Chặn ghi trùng theo `id` | `apps-script.gs` — `addEntry` | không |

Đây là nghịch lý đáng sửa trước: phần được test kỹ nhất (cộng trừ số tiền) là
phần *sai thì thấy ngay trên màn hình*; phần không có test nào là phần *sai thì
mất khoản chi vừa gõ mà không ai biết*.

Những điểm cụ thể chưa ai kiểm:

- `store.queue` bắt lỗi `JSON.parse` trả `[]` — nếu `localStorage` bị ghi rác,
  hàng chờ có bị xoá sạch không kèm cảnh báo?
- `flushQueue` gửi tuần tự, khoản nào lỗi thì đẩy vào `remain`. Chưa có test cho
  trường hợp gửi được 2/3 khoản: 1 khoản còn lại có được giữ đúng không, thứ tự
  có bị đảo không.
- `callApi` **không** thử lại khi `err.pinError` — đúng logic, nhưng chưa test.
  Ngược lại, nó *có* thử lại với lỗi 4xx bất kỳ, kể cả lỗi vĩnh viễn.
- `saveEntry` khi thất bại thì cất vào hàng chờ **và** vẫn xoá ô nhập
  (`finally`). Nếu bước cất vào hàng chờ mà lỗi (`localStorage` đầy), dữ liệu
  người dùng vừa gõ biến mất hẳn. Không có test.
- `addEntry` quét toàn bộ cột ID để chặn trùng. Chưa test: `id` kiểu số vs kiểu
  chuỗi, `id` rỗng, sheet mới chưa có dòng nào.

**Đề xuất.** Tách phần thuần của `app.js` ra chỗ test được — cụ thể là hàm dựng
`entry` trong `saveEntry`, hàm quyết định "có nên thử lại không" trong `callApi`,
và phép biến đổi hàng chờ trong `flushQueue`. Ba hàm này không cần DOM, chỉ đang
bị chôn trong hàm có DOM. Sau khi tách, test được như `logic.js`.

Với `apps-script.gs`, viết một `SpreadsheetApp` giả (một mảng hai chiều là đủ)
rồi test `addEntry` / `suaKhoan` / `xoaKhoan` / `formatDate` như hàm thường.

### Vùng 2 — Không có cách chạy test tự động

Đây là việc rẻ nhất và tác dụng lớn nhất.

Tôi đã thử: bóc phần thân `chayToanBo()` khỏi `test.html`, nạp `logic.js` vào
một `vm` context của Node rồi chạy — **134/134 ca đạt**, mất khoảng 20 dòng
script. Nghĩa là bộ test hiện tại đã sẵn sàng chạy được không cần trình duyệt,
chỉ thiếu người nối dây.

**Đề xuất.**

1. Thêm `package.json` với `npm test` trỏ vào một runner Node như trên. Giữ
   nguyên `test.html` để còn mở bằng điện thoại xem cho vui — hai đường vào,
   một bộ ca test.
2. Thêm một workflow GitHub Actions chạy `npm test` mỗi lần push. Repo đã dùng
   GitHub Pages nên không phải dựng gì thêm.
3. Thêm một ca test canh **đúng cái bẫy mà `README.md` đã phải ghi chú**: số
   `?v=` trong `index.html`, `CACHE_VERSION` trong `sw.js`, và `APP_VERSION`
   trong `app.js` phải khớp nhau. Hiện tại quên tăng một trong ba thì máy đã cài
   giữ bản cũ, và không có gì nhắc. Đây là lỗi tái diễn, kiểm bằng test thì hết.
4. Nhắc `test.html` trong `README.md`.

### Vùng 3 — Bất biến xuyên hàm, chứ không phải thêm ca đơn lẻ

`logic.js` đã phủ 98,9 % dòng, nên thêm ca test cho từng hàm riêng lẻ gần như
không còn giá trị. Những lỗi còn lại là lỗi **giữa** các hàm — mỗi hàm đúng
nhưng ghép lại thì sai. Bộ test hiện tại không có ca nào thuộc loại này.

Chính comment trong code đã phát biểu các bất biến đó, nhưng không có test nào
canh:

> `phanBo`: *"Phần lẻ do làm tròn dồn hết vào lọ lớn nhất để TỔNG LUÔN BẰNG số
> tiền gốc — nếu để hụt vài đồng mỗi lần, sau vài trăm giao dịch sổ sẽ lệch
> không truy được."*

> `chiTietLo`: *"Dùng đúng bộ lọc thời gian như soDuCacLo, nhờ vậy cộng lại luôn
> ra đúng số dư đang hiện — nếu lệch thì người dùng không hiểu số ở đâu ra."*

> `chiTietMuc`: *"Cộng lại phải bằng đúng con số trên thanh, nếu không người
> dùng bấm vào xem sẽ thấy số khác với số vừa nhìn thấy."*

Ba câu này là ba test bất biến, nên viết đúng như vậy:

- `tổng phanBo(x, ty) === x` với mọi `x`, mọi bảng tỉ lệ. (Tôi đã thử 1287 số
  tiền × 3 bảng tỉ lệ: hiện tại **đúng cả**. Nhưng chỉ có 4 ca đơn lẻ canh nó —
  một lần sửa `phanBo` là mất bất biến mà không ai biết.)
- `soDuCacLo(...)[lo].con === tổng có dấu của chiTietLo(..., lo)` cho cả 6 lọ.
- `tổng theoDanhMuc === tongChi`, `tổng theoNguonThu === tongThu`,
  `tổng chiTietMuc(dòng) === số tiền của dòng đó`.

**Một bất biến trong số đó đang bị vi phạm.** `tongHopKy` tính `theoNguoi` bằng
cách lặp qua danh sách người truyền vào (`dsNguoi`, tức `PAYERS`), nên khoản chi
của người *không* nằm trong danh sách bị bỏ lặng lẽ:

```
3 khoản chi: Chương 100.000, "Bà nội" 50.000, payer rỗng 30.000
tongChi                = 180.000
tổng thanh "Chi theo người" = 100.000   ← lệch 80.000, không có cảnh báo nào
```

Hiện chưa gây hại vì `PAYERS` cố định hai người và dữ liệu cũ cũng chỉ có hai
người. Nhưng một dòng sửa tay trong Sheet, hay thêm người thứ ba rồi đổi tên, là
biểu đồ và số tổng lệch nhau mà nhìn vẫn hợp lý.

### Vùng 4 — Bất biến bị vi phạm nặng hơn: sửa khoản thu cũ làm lệch sổ vĩnh viễn

Đây là lỗi cụ thể tôi tìm được khi truy theo hướng Vùng 3, và nó đáng được một
nhóm test riêng vì hậu quả không tự khỏi.

Bối cảnh. `app.js` — `saveEntry` lưu kèm bảng `alloc` "tại thời điểm ghi", đúng
như comment giải thích: *"tỉ lệ có thể đổi về sau nhưng lịch sử thì không được
đổi theo"*. Nhưng `luuSuaKhoan` (dòng 780) lại tính lại:

```js
alloc: laThu ? Logic.phanBo(tien, tiLeLo) : (cu.alloc || null),
```

`tiLeLo` là tỉ lệ **hiện tại**. Nên chỉ cần sửa ghi chú của một khoản thu cũ là
bảng phân bổ lịch sử của nó bị viết lại theo tỉ lệ hôm nay.

Hậu quả không dừng ở đó. Số dư lọ tháng cũ đổi theo, sinh ra phần dư mới ở một
tháng **đã đóng**. Lệnh dồn dư tự động thì mang mã cố định
`auto-{tháng}-{lọ}` (`maChuyenTuDong`), mã đó đã tồn tại trong Sheet, nên
`lenhChuyenTuDong` lọc nó ra và **không bao giờ sinh lệnh mới**. Phần dư đó nằm
lại đó mãi.

Chạy thử trên dữ liệu dựng sẵn:

```
Tháng 7: thu 10tr (NEC 55% = 5.500.000), chi NEC 2tr
  → sweep lần 1: auto-2026-07-NEC 3.500.000, auto-2026-07-PLAY 1.000.000
  → NEC còn lại tháng 7 = 0            ✓ đúng
Sửa ghi chú khoản thu đó (tỉ lệ hiện tại NEC 70%):
  → alloc NEC tháng 7 bị viết lại 5.500.000 → 7.000.000
  → NEC còn lại tháng 7 = 1.500.000    ← phần dư ở tháng đã đóng
  → lệnh sweep sinh được: []           ← không bao giờ dồn được
```

Và trên **dữ liệu thật** trong repo (`du-lieu-cu.json`, 319 khoản — toàn bộ đều
không có `alloc`, nên `phanBoCuaKhoanThu` rơi về tỉ lệ hiện tại cho cả 9 tháng):

```
sweep lần đầu (tỉ lệ mặc định): 14 lệnh, tổng 1.882.568.358 đ
sau khi đổi tỉ lệ NEC 55% → 60%: 6 tháng còn dư, tổng 145.115.412 đ
lệnh sweep sinh được: 0
```

Nghĩa là **một lần đổi tỉ lệ sáu lọ — một thao tác được UI hỗ trợ hẳn hoi — để
lại 145 triệu đồng phần dư ở các tháng đã đóng mà app không bao giờ dồn được.**

**Đề xuất.** Nhóm test "lịch sử không được đổi theo tỉ lệ":

- Sửa bất kỳ trường nào của một khoản thu cũ **không** được làm đổi `alloc`.
- Với mọi dãy thao tác, phần dư của một tháng đã đóng phải hoặc bằng 0, hoặc
  sinh ra được một lệnh dồn dư — không được có trạng thái thứ ba.
- Khoản thu cũ không có `alloc` (dữ liệu nhập từ `du-lieu-cu.json`) phải được
  chốt `alloc` một lần rồi giữ nguyên, thay vì tính lại mỗi lần mở app.

### Vùng 5 — Nhánh phòng thân và hàm chưa có ca test trực tiếp

Sáu hàm được export mà không có ca test nào gọi trực tiếp (chỉ được chạy gián
tiếp qua hàm khác, nên khi hỏng thì thông báo lỗi chỉ vào nơi khác):

`thangKey`, `timLo`, `trongKhoang`, `laKhoanChi`, `laChuyenLo`,
`LO_MAC_DINH_NHAN_DU`

`trongKhoang` đáng chú ý nhất: nó là bộ lọc đứng sau **mọi** màn hình thống kê
mà không có một ca test trực tiếp nào.

Các nhánh phòng thân đã kiểm chứng bằng cách gọi thử:

| Gọi | Trả về | Nhận xét |
|---|---|---|
| `kiemTraChuyen("DAU_TU", "NEC", 100, {})` | **ném TypeError** | `timLo(loNguon).ten` với `loNguon` không phải lọ → `null.ten` |
| `ngayCuoiThang("rac")` | `"NaN-NaN-NaN"` | chuỗi này sẽ được ghi vào Sheet làm ngày của lệnh chuyển |
| `dienBienMuc(..., "nguoi", ...)` | `[{tien: 0}, ...]` | `loai` sai chính tả → biểu đồ phẳng bằng 0, không báo lỗi |
| `chiTietMuc(..., "nguoiThu", ...)` | `[]` | như trên, danh sách rỗng thay vì lỗi |
| `trongKhoang("2026-01-05", undefined, undefined)` | `false` | im lặng loại hết mọi khoản |

Cái đầu tiên chưa với tới được từ UI (ô chọn lọ nguồn chỉ liệt kê `LOS`) — nhưng
ô chọn lọ **đích** đã có `DAU_TU` / `TIET_KIEM`, nên "rút tiền từ sổ tiết kiệm
ra" chỉ cách một tính năng nữa là app crash.

Hai cái ở giữa (`loai` lạ → trả 0/rỗng thay vì lỗi) là dòng 232–233 chưa được
phủ. Đây là loại hỏng tệ nhất: thêm một kiểu dòng thống kê mới vào `app.js` mà
quên thêm nhánh trong `logic.js` thì biểu đồ hiện đường phẳng 0 đ, trông như
"tháng này không chi gì" chứ không như lỗi.

**Đề xuất.** Một ca test khẳng định tập giá trị `loaiChiTiet` mà `app.js` truyền
(`nguonThu`, `danhMucChi`, `nguoiChi` — trong `renderStats` và
`renderChartControls`) **bằng đúng** tập mà `logic.js` xử lý. Cộng thêm ca test
cho từng nhánh phòng thân ở bảng trên, để chúng hỏng ra tiếng chứ không hỏng
lặng lẽ.

### Vùng 6 — Múi giờ và mốc nửa đêm

Mọi ca test hiện tại đều truyền ngày cố định (`N("2026-08-12")`, `now` của
`khoangKy`). Rất tốt cho tính ổn định — nhưng nghĩa là **không ca nào kiểm phần
app dùng đồng hồ thật**: `todayKey`, `ngayHomNay`, `thangHienTai`, và
`khoangKy(mode, offset)` khi gọi không có tham số `now` (đúng cách `renderStats`
đang gọi).

Rủi ro cụ thể, và có comment trong `apps-script.gs` xác nhận là đã từng cháy:

- `logic.js` sinh ngày theo giờ **máy người dùng** (`d.getFullYear()`,
  `getMonth()`, `getDate()`).
- `apps-script.gs` — `formatDate` đọc ngày theo giờ **script của Google**
  (`Session.getScriptTimeZone()`).
- Hai múi giờ đó lệch nhau thì một khoản ghi lúc 23 giờ rơi sang ngày khác so
  với ngày hiện trên màn hình. Comment ngay trên `formatDate` ghi rõ lỗi họ hàng
  của nó từng làm *"app lọc theo tháng không khớp và báo tổng 0đ"*.

**Đề xuất.** Chạy bộ test dưới vài biến `TZ` khác nhau trong runner Node
(`TZ=Pacific/Kiritimati`, `TZ=Pacific/Niue` là hai đầu cực) — rẻ, và bắt được cả
một họ lỗi. Thêm ca test cho `formatDate` với `Utilities` / `Session` giả, gồm
ca ô ngày trả về `Date` và ca trả về chuỗi.

### Vùng 7 — Dùng dữ liệu thật làm mốc chống tụt lùi

`du-lieu-cu.json` có 319 khoản thật trải 9 tháng, đang nằm không.

**Đề xuất.** Dùng nó làm fixture: chốt tổng thu / tổng chi từng tháng thành số
kỳ vọng, và khẳng định **không khoản nào bị rơi khỏi bất kỳ bảng phân tách nào**
(tổng các thanh phải bằng số tổng). Riêng ca sau cùng này đã đủ bắt được lỗi
`theoNguoi` ở Vùng 3.

---

## 3. Nên làm theo thứ tự nào

| Thứ tự | Việc | Vì sao trước |
|---|---|---|
| 1 | Runner Node + CI + ca test canh số phiên bản (Vùng 2) | Rẻ nhất, và làm mọi việc sau đó có giá trị. Bộ test hiện tại đã chạy được dưới Node mà không cần sửa gì. |
| 2 | Nhóm test "lịch sử không đổi theo tỉ lệ" (Vùng 4) | Lỗi đã kiểm chứng, hậu quả không tự khỏi, đang ảnh hưởng dữ liệu thật. |
| 3 | Test bất biến thay vì test từng hàm (Vùng 3) | `logic.js` đã phủ 98,9 % dòng — lỗi còn lại chỉ lộ ra ở dạng bất biến. |
| 4 | Tách phần thuần của `app.js`, giả `SpreadsheetApp` (Vùng 1) | Việc nhiều nhất, nhưng là cách duy nhất chạm tới 78 % code còn lại. |
| 5 | Nhánh phòng thân + `TZ` + fixture thật (Vùng 5, 6, 7) | Làm dần, mỗi lần thêm một ít. |

## 4. Cách kiểm chứng lại những số trong tài liệu này

```bash
# 134/134 ca đạt, chạy dưới Node không cần trình duyệt
node -e '
const fs=require("fs"),vm=require("vm");
const ctx={console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync("logic.js","utf8"),ctx);
const html=fs.readFileSync("test.html","utf8");
const body=html.match(/function chayToanBo\(\) \{([\s\S]*?)\n\/\/ =+\n\/\/ Hiển thị kết quả/)[1];
vm.runInContext("var __r;(function(){"+body+"__r=ketQua;})();",ctx);
const r=vm.runInContext("__r",ctx);
console.log("dat",r.filter(k=>k.dat).length,"/",r.length);'
```

Độ phủ 98,9 % đo bằng `NODE_V8_COVERAGE` trên một bản `logic.js` có thêm
`module.exports = Logic;`, tính theo dòng có code (bỏ dòng trống và dòng
comment).
