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
// Apps Script chuyển hướng khi trả kết quả nên phải dùng text/plain:
// tránh preflight CORS, nếu dùng application/json trình duyệt sẽ chặn.
async function callApi(action, payload = {}) {
  if (!API_URL) throw new Error("Chưa cấu hình API_URL");
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, pin: store.pin, ...payload })
  });
  if (!res.ok) throw new Error("Máy chủ trả lỗi " + res.status);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Lỗi không rõ");
  return data;
}

// ===== Màn hình PIN =====
function initGate() {
  const gate = $("gate");
  const input = $("pin-input");
  const error = $("gate-error");

  const tryOpen = async () => {
    const pin = input.value.trim();
    if (!pin) { error.textContent = "Anh nhập PIN nhé."; error.hidden = false; return; }

    error.hidden = true;
    $("pin-submit").disabled = true;
    $("pin-submit").textContent = "Đang kiểm tra…";

    store.pin = pin;
    try {
      await loadEntries();
      gate.hidden = true;
      $("app").hidden = false;
      flushQueue();
    } catch (err) {
      store.pin = "";
      error.textContent = err.message.includes("PIN") ? "PIN không đúng." : err.message;
      error.hidden = false;
    } finally {
      $("pin-submit").disabled = false;
      $("pin-submit").textContent = "Mở sổ";
    }
  };

  $("pin-submit").addEventListener("click", tryOpen);
  input.addEventListener("keydown", e => { if (e.key === "Enter") tryOpen(); });

  // Đã nhập PIN từ lần trước thì vào thẳng
  if (store.pin) {
    input.value = store.pin;
    tryOpen();
  }
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

async function loadEntries() {
  const data = await callApi("list");
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
    await callApi("add", { entry });
    entries.unshift(entry);
    showToast(`Đã lưu ${formatMoney(amount)} đ`);
  } catch (err) {
    store.queue = [entry, ...store.queue];
    showToast("Chưa gửi được, đã lưu tạm và sẽ tự gửi lại");
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
      showToast(err.message);
    } finally {
      btn.classList.remove("spinning");
    }
  });

  // Quay lại app sau khi khoá màn hình thì gửi nốt phần còn kẹt
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !$("app").hidden) flushQueue();
  });

  initGate();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();
