// ===== Cấu hình =====
// URL Apps Script Web App. Deploy lại (New deployment) thì URL đổi, nhớ sửa ở đây.
const API_URL = "https://script.google.com/macros/s/AKfycby4N8qqK3aiTWNx1wHQPHiafA1AVIAFPYDE-bZd19zsVohu5DjGfkHN2gUjqGr2ADN_GA/exec";

const CATEGORIES = [
  "Ăn uống", "Chợ/Siêu thị", "Đi lại", "Hoá đơn",
  "Sức khoẻ", "Mua sắm", "Giải trí", "Khác"
];
const PAYERS = ["Chương", "Thư"];

// ===== Trạng thái =====
const store = {
  get pin()      { return localStorage.getItem("ct_pin") || ""; },
  set pin(v)     { localStorage.setItem("ct_pin", v); },
  get payer()    { return localStorage.getItem("ct_payer") || PAYERS[0]; },
  set payer(v)   { localStorage.setItem("ct_payer", v); },
  get queue()    { try { return JSON.parse(localStorage.getItem("ct_queue") || "[]"); } catch { return []; } },
  set queue(v)   { localStorage.setItem("ct_queue", JSON.stringify(v)); }
};

let selectedCategory = CATEGORIES[0];
let selectedPayer = store.payer;
let entries = [];

// ===== Tiện ích =====
const $ = id => document.getElementById(id);

function formatMoney(n) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}

// Lấy số thuần từ chuỗi người dùng gõ ("50.000" -> 50000)
function parseAmount(text) {
  const digits = String(text).replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

function showToast(message) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { el.hidden = true; }, 2600);
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ===== Gọi API =====
// Tăng mỗi lần sửa app, hiển thị ở màn hình PIN để biết máy đang chạy bản nào.
const APP_VERSION = "7";

// ===== Nhật ký dò lỗi =====
// Ghi vào localStorage nên còn nguyên kể cả khi trang tự nạp lại — đây là
// cách duy nhất nhìn thấy chuyện gì xảy ra khi màn hình không báo gì cả.
function ghiNhatKy(viec) {
  const d = new Date();
  const gio = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  let dong = [];
  try { dong = JSON.parse(localStorage.getItem("ct_log") || "[]"); } catch { dong = []; }
  dong.unshift(`${gio} ${viec}`);
  localStorage.setItem("ct_log", JSON.stringify(dong.slice(0, 6)));
  hienNhatKy();
}

function hienNhatKy() {
  const el = document.getElementById("gate-log");
  if (!el) return;
  let dong = [];
  try { dong = JSON.parse(localStorage.getItem("ct_log") || "[]"); } catch { dong = []; }
  if (!dong.length) { el.hidden = true; return; }
  el.textContent = dong.join("\n");
  el.style.whiteSpace = "pre-line";
  el.hidden = false;
}

const RETRY_DELAYS = [700, 1800, 3500]; // giãn dần, tránh dội liên tục vào Google
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

// Apps Script chuyển hướng khi trả kết quả nên phải dùng text/plain:
// tránh preflight CORS, nếu dùng application/json trình duyệt sẽ chặn.
async function callApiOnce(action, payload) {
  if (!API_URL) throw new Error("Chưa cấu hình API_URL");
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, pin: store.pin, ...payload })
  });
  if (!res.ok) throw new Error("Máy chủ trả lỗi " + res.status);
  const data = await res.json();
  if (!data.ok) {
    const err = new Error(data.error || "Lỗi không rõ");
    // Sai PIN là lỗi cố định: thử lại bao nhiêu lần cũng vẫn sai.
    if (String(data.error || "").includes("PIN")) err.pinError = true;
    throw err;
  }
  return data;
}

// Google có lúc trả 404/5xx nhất thời khi đang xoay vòng phiên bản deploy,
// nên lỗi mạng được thử lại vài lần trước khi báo cho người dùng.
async function callApi(action, payload = {}, options = {}) {
  const maxRetry = options.retries === undefined ? 2 : options.retries;
  let lastErr;

  for (let lan = 0; lan <= maxRetry; lan++) {
    try {
      return await callApiOnce(action, payload);
    } catch (err) {
      lastErr = err;
      if (err.pinError) throw err;
      if (lan < maxRetry) {
        if (options.onRetry) options.onRetry(lan + 1, maxRetry);
        await sleep(RETRY_DELAYS[lan] || 3500);
      }
    }
  }
  throw lastErr;
}

// ===== Màn hình PIN =====
function initGate() {
  const gate = $("gate");
  const input = $("pin-input");
  const error = $("gate-error");
  const submitBtn = $("pin-submit");

  // silent = lần thử ngầm bằng mã đã lưu trong máy, không phải người dùng bấm.
  const openWith = async (pin, silent) => {
    if (!pin) {
      error.textContent = "Anh nhập PIN nhé.";
      error.hidden = false;
      return;
    }

    error.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Đang kiểm tra…";

    store.pin = pin;
    ghiNhatKy(silent ? "thử ngầm mã đã lưu" : `bấm Mở sổ (${pin.length} ký tự)`);
    try {
      await loadEntries({
        retries: 3,
        onRetry: (lan, tong) => {
          submitBtn.textContent = `Mạng chậm, thử lại ${lan}/${tong}…`;
          ghiNhatKy(`mạng lỗi, thử lại ${lan}/${tong}`);
        }
      });
      gate.hidden = true;
      $("app").hidden = false;
      ghiNhatKy("MỞ SỔ THÀNH CÔNG");
      flushQueue();
    } catch (err) {
      store.pin = "";
      // Dọn sạch ô nhập: nếu để mã cũ nằm lại, mã mới người dùng gõ sẽ bị
      // nối vào đuôi mã cũ và luôn luôn sai dù gõ đúng.
      input.value = "";
      error.textContent = (silent && err.pinError)
        ? "Mã PIN đã đổi, anh nhập mã mới nhé."
        : friendlyError(err);
      error.hidden = false;
      ghiNhatKy("thất bại: " + String(err && err.message || err).slice(0, 90));
      input.focus();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Mở sổ";
    }
  };

  const tryOpen = () => openWith(input.value.replace(/\s/g, ""), false);

  submitBtn.addEventListener("click", tryOpen);
  input.addEventListener("keydown", e => { if (e.key === "Enter") tryOpen(); });
  // Chỉ ẩn lỗi khi người dùng thực sự gõ phím. Trước đây bắt sự kiện "input"
  // nên trình quản lý mật khẩu tự điền cũng làm mất luôn thông báo lỗi.
  input.addEventListener("keydown", () => { error.hidden = true; });

  // Có mã lưu sẵn thì thử ngầm, KHÔNG đổ vào ô nhập để tránh dính mã cũ.
  if (store.pin) openWith(store.pin, true);
}

// Cho phép người dùng tự dọn bản cũ kẹt trong máy mà không cần vào cài đặt
// trình duyệt: gỡ service worker, xoá cache, rồi tải lại kèm đuôi chống đệm.
function initResetButton() {
  const nhan = $("app-version");
  if (nhan) nhan.textContent = "bản " + APP_VERSION;
  hienNhatKy();

  const btn = $("btn-reset");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Đang dọn…";
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      localStorage.removeItem("ct_pin");
      localStorage.removeItem("ct_log");
    } catch (err) {
      // Dọn được tới đâu hay tới đó, vẫn tải lại để lấy bản mới.
    }
    location.replace(location.pathname + "?moi=" + Date.now());
  });
}

// ===== Dựng các nút chọn =====
function renderChips() {
  const catBox = $("categories");
  catBox.innerHTML = "";
  CATEGORIES.forEach(cat => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (cat === selectedCategory ? " on" : "");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      selectedCategory = cat;
      renderChips();
    });
    catBox.appendChild(btn);
  });

  const payBox = $("payers");
  payBox.innerHTML = "";
  PAYERS.forEach(p => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (p === selectedPayer ? " on" : "");
    btn.textContent = p;
    btn.addEventListener("click", () => {
      selectedPayer = p;
      store.payer = p;
      renderChips();
    });
    payBox.appendChild(btn);
  });
}

// ===== Hiển thị dữ liệu =====
function render() {
  const month = todayKey();
  const queue = store.queue;
  const all = [...queue.map(q => ({ ...q, unsent: true })), ...entries];

  const inMonth = all.filter(e => String(e.date || "").startsWith(month));
  const total = inMonth.reduce((s, e) => s + Number(e.amount || 0), 0);
  $("month-amount").textContent = formatMoney(total) + " đ";

  const d = new Date();
  $("month-label").textContent = `Chi tháng ${d.getMonth() + 1}/${d.getFullYear()}`;

  // Tổng theo từng người
  const box = $("by-person");
  box.innerHTML = "";
  PAYERS.forEach(p => {
    const sum = inMonth
      .filter(e => e.payer === p)
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    const card = document.createElement("div");
    card.className = "person-card";
    card.innerHTML = `<div class="person-name">${p}</div>
                      <div class="person-total">${formatMoney(sum)} đ</div>`;
    box.appendChild(card);
  });

  // Danh sách gần đây
  const list = $("recent-list");
  const recent = all.slice(0, 25);
  if (!recent.length) {
    list.innerHTML = '<p class="empty">Chưa có khoản chi nào.</p>';
  } else {
    list.innerHTML = "";
    recent.forEach(e => {
      const row = document.createElement("div");
      row.className = "item" + (e.unsent ? " unsent" : "");
      const meta = [e.date, e.payer, e.note].filter(Boolean).join(" · ");
      row.innerHTML = `
        <div class="item-main">
          <div class="item-cat">${e.category || "Khác"}${e.unsent ? " ⏳" : ""}</div>
          <div class="item-meta">${meta}</div>
        </div>
        <div class="item-amount">${formatMoney(e.amount)} đ</div>`;
      list.appendChild(row);
    });
  }

  const badge = $("pending-badge");
  if (queue.length) {
    badge.textContent = `${queue.length} khoản chờ gửi`;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

async function loadEntries(options = {}) {
  const data = await callApi("list", {}, options);
  entries = data.entries || [];
  render();
}

// ===== Lưu khoản chi =====
// Gửi thất bại thì cất vào hàng chờ, không để mất dữ liệu người dùng đã gõ.
async function saveEntry() {
  const amount = parseAmount($("amount").value);
  const error = $("entry-error");

  if (amount <= 0) {
    error.textContent = "Anh nhập số tiền nhé.";
    error.hidden = false;
    return;
  }
  error.hidden = true;

  const now = new Date();
  const entry = {
    id: `${now.getTime()}-${Math.round(now.getTime() % 9973)}`,
    date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    amount,
    category: selectedCategory,
    note: $("note").value.trim(),
    payer: selectedPayer
  };

  const btn = $("btn-save");
  btn.disabled = true;
  btn.textContent = "Đang lưu…";

  try {
    await callApi("add", { entry }, {
      retries: 2,
      onRetry: (lan, tong) => { btn.textContent = `Mạng chậm, thử lại ${lan}/${tong}…`; }
    });
    entries.unshift(entry);
    showToast(`Đã lưu ${formatMoney(amount)} đ`);
  } catch (err) {
    // Đã thử lại vẫn không được thì cất vào hàng chờ, không để mất khoản chi.
    store.queue = [entry, ...store.queue];
    showToast(err.pinError
      ? "PIN đã đổi, anh mở lại sổ nhé"
      : "Chưa gửi được, đã lưu tạm và sẽ tự gửi lại");
  } finally {
    $("amount").value = "";
    $("note").value = "";
    btn.disabled = false;
    btn.textContent = "Lưu khoản chi";
    render();
  }
}

// Thử gửi lại những khoản còn kẹt trong hàng chờ
async function flushQueue() {
  const queue = store.queue;
  if (!queue.length) return;

  const remain = [];
  for (const entry of queue) {
    try {
      await callApi("add", { entry });
      entries.unshift(entry);
    } catch {
      remain.push(entry);
    }
  }
  store.queue = remain;
  if (remain.length < queue.length) {
    showToast(`Đã gửi ${queue.length - remain.length} khoản còn kẹt`);
  }
  render();
}

// ===== Khởi động =====
function init() {
  // Mốc này lộ ra việc trang có tự nạp lại hay không: nếu nhật ký hiện hai
  // dòng "trang khởi động" liền nhau thì đúng là trang bị nạp lại giữa chừng.
  ghiNhatKy(`trang khởi động (bản ${APP_VERSION})`);
  renderChips();

  // Vừa gõ vừa chấm phân cách nghìn cho dễ đọc
  $("amount").addEventListener("input", e => {
    const n = parseAmount(e.target.value);
    e.target.value = n ? formatMoney(n) : "";
  });

  $("btn-save").addEventListener("click", saveEntry);

  $("btn-refresh").addEventListener("click", async () => {
    const btn = $("btn-refresh");
    btn.classList.add("spinning");
    try {
      await flushQueue();
      await loadEntries();
    } catch (err) {
      showToast(friendlyError(err));
    } finally {
      btn.classList.remove("spinning");
    }
  });

  // Quay lại app sau khi khoá màn hình thì gửi nốt phần còn kẹt
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !$("app").hidden) flushQueue();
  });

  initResetButton();
  initGate();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();
