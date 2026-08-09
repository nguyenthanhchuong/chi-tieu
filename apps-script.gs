/**
 * Sổ Chi Tiêu - phần chạy trên Google (Apps Script).
 *
 * CÁCH CÀI:
 *  1. Tạo một Google Sheet mới, đặt tên tuỳ ý.
 *  2. Trong Sheet: Tiện ích mở rộng (Extensions) > Apps Script.
 *  3. Xoá hết code mẫu, dán toàn bộ file này vào.
 *  4. Sửa PIN bên dưới thành mã anh muốn.
 *  5. Bấm Triển khai (Deploy) > Tuỳ chọn triển khai mới (New deployment)
 *     - Loại: Ứng dụng web (Web app)
 *     - Thực thi với tư cách (Execute as): Tôi (Me)
 *     - Ai có quyền truy cập (Who has access): Bất kỳ ai (Anyone)
 *  6. Copy URL nhận được, dán vào biến API_URL trong file app.js.
 *
 * Lưu ý: đặt "Anyone" là bắt buộc để trang web gọi được, nhưng mọi yêu cầu
 * đều phải kèm đúng PIN nên người lạ có URL cũng không đọc/ghi được.
 */

// >>> ĐỔI PIN NÀY <<<
const PIN = "273914";

const SHEET_NAME = "ChiTieu";
// "Loại" thêm sau nên nằm cuối: hàng cũ để trống ô này và được hiểu là "Chi".
const HEADERS = ["ID", "Ngày", "Số tiền", "Danh mục", "Ghi chú", "Người chi", "Thời điểm ghi", "Loại"];

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    return sheet;
  }

  // Sheet đã có từ trước và thiếu cột mới thì bổ sung tiêu đề còn thiếu,
  // không đụng tới dữ liệu đang có.
  const soCot = sheet.getLastColumn();
  if (soCot < HEADERS.length) {
    const thieu = HEADERS.slice(soCot);
    sheet.getRange(1, soCot + 1, 1, thieu.length)
      .setValues([thieu])
      .setFontWeight("bold");
  }
  return sheet;
}

function reply(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.pin !== PIN) {
      return reply({ ok: false, error: "PIN không đúng" });
    }

    if (body.action === "list") {
      return reply({ ok: true, entries: listEntries() });
    }

    if (body.action === "add") {
      return reply(addEntry(body.entry));
    }

    return reply({ ok: false, error: "Không rõ yêu cầu: " + body.action });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

// Trả về các khoản gần nhất, mới nhất lên đầu.
// Giới hạn nới rộng vì màn hình thống kê cần dữ liệu cả năm, 100 dòng không đủ.
const GIOI_HAN = 3000;

function listEntries() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const start = Math.max(2, lastRow - GIOI_HAN + 1);
  const rows = sheet.getRange(start, 1, lastRow - start + 1, HEADERS.length).getValues();

  return rows.map(function (r) {
    return {
      id: String(r[0]),
      date: formatDate(r[1]),
      amount: Number(r[2]) || 0,
      category: String(r[3] || ""),
      note: String(r[4] || ""),
      payer: String(r[5] || ""),
      // Hàng cũ chưa có cột này, mặc định là khoản chi.
      type: String(r[7] || "Chi")
    };
  }).reverse();
}

function addEntry(entry) {
  if (!entry || !entry.id) return { ok: false, error: "Thiếu dữ liệu khoản chi" };

  const sheet = getSheet();

  // Chặn ghi trùng: hàng chờ ngoài app có thể gửi lại cùng một khoản.
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(entry.id)) {
        return { ok: true, duplicated: true };
      }
    }
  }

  sheet.appendRow([
    entry.id,
    entry.date || "",
    Number(entry.amount) || 0,
    entry.category || "",
    entry.note || "",
    entry.payer || "",
    new Date(),
    entry.type === "Thu" ? "Thu" : "Chi"
  ]);

  return { ok: true };
}

// Sheet trả ô ngày về dưới dạng đối tượng Date. Không dùng "instanceof Date"
// vì trong Apps Script phép này không đáng tin, làm ngày lọt ra ngoài dạng
// "Sat Aug 08 2026..." khiến app lọc theo tháng không khớp và báo tổng 0đ.
function formatDate(value) {
  if (value && typeof value.getTime === "function") {
    return Utilities.formatDate(new Date(value.getTime()),
                                Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value || "");
}
