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

  // Chuyển tiền giữa hai lọ: tổng tiền trong nhà không đổi.
  // Phải loại khỏi mọi phép tính Thu/Chi, nếu không báo cáo sẽ phồng lên
  // cả hai đầu mà nhìn vẫn hợp lý nên rất khó phát hiện.
  function laChuyenLo(e) {
    return e && e.type === "Chuyển";
  }

  function laKhoanChi(e) {
    return !laKhoanThu(e) && !laChuyenLo(e);
  }

  // ===== Sáu chiếc lọ =====
  // congDon: true = tiền để dành, cộng dồn qua các tháng.
  //          false = tiêu theo tháng, hết tháng phần dư được chuyển đi.
  // canhBaoRut: lọ mà việc rút ra đi ngược mục đích tiết kiệm.
  const LOS = [
    { key: "NEC",  ten: "Thiết yếu",         tiLe: 55, congDon: false },
    { key: "FFA",  ten: "Tự do tài chính",   tiLe: 10, congDon: true,  canhBaoRut: true },
    { key: "LTSS", ten: "Tiết kiệm dài hạn", tiLe: 10, congDon: true,  canhBaoRut: true },
    { key: "EDU",  ten: "Giáo dục",          tiLe: 10, congDon: true },
    { key: "PLAY", ten: "Hưởng thụ",         tiLe: 10, congDon: false },
    { key: "GIVE", ten: "Cho đi",            tiLe:  5, congDon: true }
  ];

  const LO_MAC_DINH_NHAN_DU = "LTSS";   // phần dư cuối tháng dồn về đây

  function timLo(key) {
    return LOS.find(l => l.key === key) || null;
  }

  function tiLeMacDinh() {
    const r = {};
    LOS.forEach(l => { r[l.key] = l.tiLe; });
    return r;
  }

  // Danh mục chi suy ra lọ nào. Người dùng sửa được từng khoản.
  const LO_THEO_DANH_MUC = {
    "Ăn uống": "NEC", "Chợ/Siêu thị": "NEC", "Đi lại": "NEC",
    "Hoá đơn": "NEC", "Sức khoẻ": "NEC", "Đồ dùng gia đình": "NEC",
    "Giải trí": "PLAY", "Mua sắm": "PLAY",
    "Học tập": "EDU",
    "Từ thiện": "GIVE", "Biếu tặng": "GIVE",
    "Đầu tư": "FFA"
  };

  function doanLo(danhMuc) {
    return LO_THEO_DANH_MUC[danhMuc] || "NEC";
  }

  // Chia khoản thu vào các lọ theo tỉ lệ.
  // Phần lẻ do làm tròn dồn hết vào lọ lớn nhất để TỔNG LUÔN BẰNG số tiền gốc —
  // nếu để hụt vài đồng mỗi lần, sau vài trăm giao dịch sổ sẽ lệch không truy được.
  function phanBo(soTien, tiLe) {
    const tien = Math.round(Number(soTien) || 0);
    const ty = tiLe || tiLeMacDinh();
    const tongTy = LOS.reduce((s, l) => s + (Number(ty[l.key]) || 0), 0);
    if (tien <= 0 || tongTy <= 0) {
      const rong = {}; LOS.forEach(l => { rong[l.key] = 0; }); return rong;
    }

    const kq = {};
    let daChia = 0;
    LOS.forEach(l => {
      const phan = Math.floor(tien * (Number(ty[l.key]) || 0) / tongTy);
      kq[l.key] = phan;
      daChia += phan;
    });

    const loLonNhat = LOS.slice().sort((a, b) =>
      (Number(ty[b.key]) || 0) - (Number(ty[a.key]) || 0))[0];
    kq[loLonNhat.key] += tien - daChia;
    return kq;
  }

  // Số tiền một khoản thu rót vào một lọ. Ưu tiên bảng phân bổ đã lưu cùng
  // khoản thu đó: tỉ lệ có thể đổi về sau, nhưng lịch sử phải giữ nguyên.
  function phanBoCuaKhoanThu(e, tiLeHienTai) {
    if (e && e.alloc && typeof e.alloc === "object") return e.alloc;
    return phanBo(e ? e.amount : 0, tiLeHienTai);
  }

  // Số dư các lọ tính tại thời điểm thangXem ("YYYY-MM").
  // Lọ cộng dồn: tính từ đầu tới hết tháng đó.
  // Lọ theo tháng: chỉ tính trong đúng tháng đó.
  function soDuCacLo(khoan, thangXem, tiLeHienTai) {
    const ds = khoan || [];
    const trongThang = e => String(e.date || "").slice(0, 7) === thangXem;
    const tinhToiNay = e => String(e.date || "").slice(0, 7) <= thangXem;

    const kq = {};
    LOS.forEach(lo => {
      const lay = lo.congDon ? tinhToiNay : trongThang;
      let vao = 0, ra = 0;

      ds.filter(lay).forEach(e => {
        if (laKhoanThu(e)) {
          vao += Number(phanBoCuaKhoanThu(e, tiLeHienTai)[lo.key] || 0);
        } else if (laChuyenLo(e)) {
          if (e.jarTo === lo.key) vao += Number(e.amount) || 0;
          if (e.jar === lo.key)   ra  += Number(e.amount) || 0;
        } else if ((e.jar || doanLo(e.category)) === lo.key) {
          ra += Number(e.amount) || 0;
        }
      });

      kq[lo.key] = { key: lo.key, ten: lo.ten, congDon: lo.congDon, vao, ra, con: vao - ra };
    });
    return kq;
  }

  // Phần dư của các lọ theo tháng ở những tháng ĐÃ QUA mà chưa được chuyển đi.
  // Bình thường luôn bằng 0 vì app tự chuyển; khác 0 nghĩa là có lệnh chuyển
  // chưa gửi được, tiền vẫn còn trên sổ chứ không bốc hơi.
  function duChuaChuyen(khoan, thangHienTai, tiLeHienTai) {
    const ds = khoan || [];
    const cacThang = [...new Set(ds.map(e => String(e.date || "").slice(0, 7)))]
      .filter(t => t && t < thangHienTai)
      .sort();

    const ra = [];
    cacThang.forEach(thang => {
      const soDu = soDuCacLo(ds, thang, tiLeHienTai);
      LOS.filter(l => !l.congDon).forEach(lo => {
        const con = soDu[lo.key].con;
        if (con > 0) ra.push({ thang, lo: lo.key, ten: lo.ten, tien: con });
      });
    });
    return ra;
  }

  // Mã cố định theo tháng và lọ: mở app bao nhiêu lần cũng chỉ sinh đúng
  // một lệnh chuyển, vì Apps Script từ chối ghi trùng mã.
  function maChuyenTuDong(thang, loNguon) {
    return `auto-${thang}-${loNguon}`;
  }

  // Dựng các lệnh chuyển tự động cho phần dư tháng trước.
  function lenhChuyenTuDong(khoan, thangHienTai, tiLeHienTai, loNhan) {
    const dich = loNhan || LO_MAC_DINH_NHAN_DU;
    const daCo = new Set((khoan || []).filter(laChuyenLo).map(e => e.id));

    return duChuaChuyen(khoan, thangHienTai, tiLeHienTai)
      .filter(d => d.lo !== dich)
      .map(d => ({
        id: maChuyenTuDong(d.thang, d.lo),
        date: ngayCuoiThang(d.thang),
        amount: d.tien,
        type: "Chuyển",
        jar: d.lo,
        jarTo: dich,
        category: "Chuyển lọ",
        note: `Tự động dồn dư ${d.ten} tháng ${d.thang}`,
        payer: ""
      }))
      .filter(l => !daCo.has(l.id));
  }

  function ngayCuoiThang(thang) {
    const [n, t] = String(thang).split("-").map(Number);
    return ngayKey(new Date(n, t, 0));
  }

  // Rút khỏi lọ tiết kiệm đi ngược mục đích của phương pháp sáu lọ:
  // cho phép nhưng phải cảnh báo rõ.
  function cankhoCanhBao(loNguon) {
    const lo = timLo(loNguon);
    return !!(lo && lo.canhBaoRut);
  }

  function kiemTraChuyen(loNguon, loDich, soTien, soDu) {
    if (!loNguon || !loDich) return { duoc: false, loi: "Chọn lọ nguồn và lọ đích nhé." };
    if (loNguon === loDich)  return { duoc: false, loi: "Hai lọ phải khác nhau." };
    if (!(Number(soTien) > 0)) return { duoc: false, loi: "Số tiền phải lớn hơn 0." };

    const con = soDu && soDu[loNguon] ? soDu[loNguon].con : 0;
    const vuot = Number(soTien) > con;
    return {
      duoc: true,
      vuotSoDu: vuot,
      canhBao: cankhoCanhBao(loNguon)
        ? `Đây là tiền để dành. Rút khỏi "${timLo(loNguon).ten}" là đi ngược mục tiêu tích luỹ — chỉ nên làm khi thật cần.`
        : (vuot ? `Lọ "${timLo(loNguon).ten}" chỉ còn ${formatMoney(con)} đ, chuyển đi nhiều hơn sẽ bị âm.` : "")
    };
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
    // Lệnh chuyển lọ KHÔNG phải khoản chi: tiền chỉ đổi chỗ giữa hai lọ.
    // Tính nhầm vào đây sẽ làm báo cáo phồng lên mà nhìn vẫn hợp lý.
    const khoanChi = trongKy.filter(laKhoanChi);

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
    formatMoney, parseAmount, ngayKey, thangKey,
    laKhoanThu, laChuyenLo, laKhoanChi,
    khoangKy, nhanKy, trongKhoang, tongHopKy, friendlyError,
    // Sáu chiếc lọ
    LOS, LO_MAC_DINH_NHAN_DU, timLo, tiLeMacDinh, doanLo,
    phanBo, phanBoCuaKhoanThu, soDuCacLo, duChuaChuyen,
    maChuyenTuDong, lenhChuyenTuDong, ngayCuoiThang, kiemTraChuyen
  };
})();
