// Phần tính toán thuần: không đụng tới DOM, không gọi mạng.
// Tách riêng để test được độc lập (xem test.html).
const Logic = (function () {

  function formatMoney(n) {
    return new Intl.NumberFormat("vi-VN").format(Math.round(n));
  }

  // Lấy số thuần từ chuỗi người dùng gõ ("50.000" -> 50000)
  function parseAmount(text) {
    const digits = String(text == null ? "" : text).replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  }

  function ngayKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function thangKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  // Hàng cũ trong Sheet chưa có cột Loại nên mặc định là khoản chi.
  function laKhoanThu(e) {
    return e && e.type === "Thu";
  }

  // Khoảng ngày của kỳ đang xem. offset 0 = kỳ hiện tại, -1 = kỳ trước.
  // Tham số now tách ra để test cố định được ngày, không phụ thuộc hôm nay.
  // Date của JS tự cuộn năm khi tháng vượt 0..11 nên không cần xử lý riêng.
  function khoangKy(mode, offset, now) {
    now = now || new Date();
    let dau, cuoi;

    if (mode === "tuan") {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thu = (d.getDay() + 6) % 7;          // quy về thứ Hai = 0
      d.setDate(d.getDate() - thu + offset * 7);
      dau = d;
      cuoi = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6);
    } else if (mode === "thang") {
      dau = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      cuoi = new Date(dau.getFullYear(), dau.getMonth() + 1, 0);
    } else if (mode === "quy") {
      const quyHienTai = Math.floor(now.getMonth() / 3);
      dau = new Date(now.getFullYear(), (quyHienTai + offset) * 3, 1);
      cuoi = new Date(dau.getFullYear(), dau.getMonth() + 3, 0);
    } else {
      dau = new Date(now.getFullYear() + offset, 0, 1);
      cuoi = new Date(now.getFullYear() + offset, 11, 31);
    }
    return { dau, cuoi };
  }

  function nhanKy(mode, dau, cuoi) {
    const dm = d => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (mode === "tuan") return `${dm(dau)} – ${dm(cuoi)}/${cuoi.getFullYear()}`;
    if (mode === "thang") return `Tháng ${dau.getMonth() + 1}/${dau.getFullYear()}`;
    if (mode === "quy") return `Quý ${Math.floor(dau.getMonth() / 3) + 1}/${dau.getFullYear()}`;
    return `Năm ${dau.getFullYear()}`;
  }

  // Ngày lưu dạng "YYYY-MM-DD" nên so sánh chuỗi là đủ và đúng thứ tự.
  // Hai đầu mốc đều tính vào trong kỳ.
  function trongKhoang(ngay, tuNgay, denNgay) {
    const d = String(ngay || "");
    return d >= tuNgay && d <= denNgay;
  }

  // Gộp số liệu một kỳ. Trả về tổng thu, tổng chi, còn lại và
  // phần chi tách theo danh mục và theo người, đã xếp từ lớn xuống nhỏ.
  function tongHopKy(khoan, tuNgay, denNgay, dsNguoi) {
    const trongKy = (khoan || []).filter(e => trongKhoang(e && e.date, tuNgay, denNgay));
    const khoanThu = trongKy.filter(laKhoanThu);
    const khoanChi = trongKy.filter(e => !laKhoanThu(e));

    const cong = ds => ds.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const tongThu = cong(khoanThu);
    const tongChi = cong(khoanChi);

    const gomDanhMuc = {};
    khoanChi.forEach(e => {
      const k = (e && e.category) || "Khác";
      gomDanhMuc[k] = (gomDanhMuc[k] || 0) + (Number(e.amount) || 0);
    });

    const theoDanhMuc = Object.keys(gomDanhMuc)
      .map(k => ({ ten: k, tien: gomDanhMuc[k] }))
      .sort((a, b) => b.tien - a.tien);

    const theoNguoi = (dsNguoi || [])
      .map(p => ({ ten: p, tien: cong(khoanChi.filter(e => e && e.payer === p)) }))
      .filter(h => h.tien > 0)
      .sort((a, b) => b.tien - a.tien);

    return {
      soKhoan: trongKy.length,
      tongThu,
      tongChi,
      conLai: tongThu - tongChi,
      theoDanhMuc,
      theoNguoi
    };
  }

  // Đổi lỗi kỹ thuật thành câu người dùng đọc hiểu được.
  function friendlyError(err) {
    const msg = String((err && err.message) || err || "");
    if (err && err.pinError) return "PIN không đúng.";
    if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) {
      return "Không kết nối được, anh kiểm tra mạng giúp nhé.";
    }
    if (/\b(4\d\d|5\d\d)\b/.test(msg)) {
      return "Máy chủ đang bận, anh thử lại sau chút nhé.";
    }
    if (/JSON|Unexpected token/i.test(msg)) {
      return "Máy chủ trả dữ liệu lạ, anh thử lại giúp nhé.";
    }
    return "Có trục trặc, anh thử lại giúp nhé.";
  }

  return {
    formatMoney, parseAmount, ngayKey, thangKey, laKhoanThu,
    khoangKy, nhanKy, trongKhoang, tongHopKy, friendlyError
  };
})();
