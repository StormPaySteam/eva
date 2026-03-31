// ===== EVA FLOWERS — ADMIN PANEL =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs, doc, updateDoc,
  query, orderBy, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBv9quQOKOsiNp1S8J3b15hVSsXPd7OlK0",
  authDomain: "evaflower-ae2d6.firebaseapp.com",
  projectId: "evaflower-ae2d6",
  storageBucket: "evaflower-ae2d6.firebasestorage.app",
  messagingSenderId: "1074251486860",
  appId: "1:1074251486860:web:a43e11b06025b28d1f4da9"
};

const ADMIN_EMAIL = "eva@eva.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const PRODUCTS = [
  { id:'f1', cat:'flowers', name:'Хризантемы', price:1800, emoji:'🌼' },
  { id:'f2', cat:'flowers', name:'Гортензии', price:2400, emoji:'💜' },
  { id:'f3', cat:'flowers', name:'Роза', price:2200, emoji:'🌹' },
  { id:'f4', cat:'flowers', name:'Кустовая роза', price:1900, emoji:'🌸' },
  { id:'f5', cat:'flowers', name:'Лилии', price:2600, emoji:'🌷' },
  { id:'f6', cat:'flowers', name:'Пионы', price:3200, emoji:'🌺' },
  { id:'b1', cat:'balloons', name:'Фольгированные шары', price:350, emoji:'🎈' },
  { id:'b2', cat:'balloons', name:'Воздушные шары', price:120, emoji:'🎀' },
  { id:'b3', cat:'balloons', name:'Шар-гигант', price:850, emoji:'🎊' },
  { id:'b4', cat:'balloons', name:'Связка шаров', price:600, emoji:'🎉' },
  { id:'t1', cat:'toys', name:'Мишка с сердцем', price:1200, emoji:'🧸' },
  { id:'t2', cat:'toys', name:'Зайка', price:950, emoji:'🐰' },
  { id:'t3', cat:'toys', name:'Единорог', price:1500, emoji:'🦄' },
  { id:'t4', cat:'toys', name:'Кот в цветах', price:1100, emoji:'🐱' },
];

const catNames = { flowers: 'Цветы', balloons: 'Шары', toys: 'Игрушки' };
const STATUS_MAP = {
  pending:  { label: 'Принят',          cls: 'badge-pending',  emoji: '🕐' },
  assembly: { label: 'Сборка букета',   cls: 'badge-assembly', emoji: '🌿' },
  delivery: { label: 'Курьер в пути',   cls: 'badge-delivery', emoji: '🚚' },
  done:     { label: 'Доставлен',       cls: 'badge-done',     emoji: '✅' }
};

let allOrders = [];
let activeFilter = 'all';

// ===== AUTH GUARD =====
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  if (user.email !== ADMIN_EMAIL) {
    showToast('Доступ запрещён');
    setTimeout(() => window.location.href = 'profile.html', 1500);
    return;
  }
  document.getElementById('adminEmail').textContent = user.email;
  await loadAllData();
});

// ===== LOAD ALL DATA =====
async function loadAllData() {
  await loadOrders();
  renderProducts();
  await loadCustomers();
}

// ===== ORDERS =====
async function loadOrders() {
  try {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    allOrders = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    updateStats();
    renderDashNewOrders();
    renderOrdersList();
  } catch(e) {
    console.error('Orders load error:', e);
    document.getElementById('ordersListAdmin').innerHTML =
      `<div class="admin-empty"><div class="em-icon">⚠️</div><p>Ошибка загрузки заказов.<br>Проверьте Firestore Rules (см. README)</p></div>`;
    document.getElementById('dashNewOrders').innerHTML =
      `<div class="admin-empty"><div class="em-icon">⚠️</div><p>Нет доступа к заказам.<br>Обновите Firestore Rules и добавьте ваш UID в коллекцию <strong>admins</strong></div>`;
  }
}

// ===== STATS =====
function updateStats() {
  const total = allOrders.length;
  const pending = allOrders.filter(o => o.status === 'pending').length;
  const delivery = allOrders.filter(o => o.status === 'delivery').length;
  const revenue = allOrders
    .filter(o => o.status === 'done')
    .reduce((s, o) => s + (o.total || 0), 0);

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-pending').textContent = pending;
  document.getElementById('stat-delivery').textContent = delivery;
  document.getElementById('stat-revenue').textContent = revenue.toLocaleString() + ' ₽';
  document.getElementById('pendingBadge').textContent = pending;
}

// ===== DASHBOARD NEW ORDERS =====
function renderDashNewOrders() {
  const newOrders = allOrders.filter(o => o.status === 'pending');
  const c = document.getElementById('dashNewOrders');
  if (!newOrders.length) {
    c.innerHTML = `<div class="admin-empty"><div class="em-icon">🎉</div><p>Новых заказов нет</p></div>`;
    return;
  }
  c.innerHTML = newOrders.map(o => orderCardHTML(o)).join('');
  attachOrderHandlers();
}

// ===== ORDERS LIST =====
window.filterOrders = function() { renderOrdersList(); };

function renderOrdersList() {
  const search = (document.getElementById('orderSearch')?.value || '').toLowerCase();
  let orders = allOrders;

  if (activeFilter !== 'all') {
    orders = orders.filter(o => o.status === activeFilter);
  }
  if (search) {
    orders = orders.filter(o =>
      (o.recipient || '').toLowerCase().includes(search) ||
      (o.phone || '').toLowerCase().includes(search) ||
      (o.address || '').toLowerCase().includes(search)
    );
  }

  const c = document.getElementById('ordersListAdmin');
  if (!orders.length) {
    c.innerHTML = `<div class="admin-empty"><div class="em-icon">📦</div><p>Заказов не найдено</p></div>`;
    return;
  }
  c.innerHTML = orders.map(o => orderCardHTML(o)).join('');
  attachOrderHandlers();
}

// ===== ORDER CARD HTML =====
function orderCardHTML(o) {
  const st = STATUS_MAP[o.status] || STATUS_MAP.pending;
  const date = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString('ru') : '—';
  const items = (o.items || []).map(i => `${i.emoji || '🌸'} ${i.name} × ${i.qty}`).join(' · ');
  const deliveryTime = o.datetime
    ? `🕐 Доставка: ${new Date(o.datetime).toLocaleString('ru', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' })}`
    : '';

  return `
    <div class="admin-order-card" data-id="${o._id}">
      <div class="aoc-head">
        <div>
          <span class="aoc-id">#${o._id.slice(-8).toUpperCase()}</span>
          <span class="aoc-date" style="margin-left:12px">${date}</span>
        </div>
        <span class="badge ${st.cls}">${st.emoji} ${st.label}</span>
      </div>

      <div class="aoc-body">
        <div class="aoc-customer">
          <span>👤 <strong>${o.recipient || '—'}</strong></span>
          <span>📞 <strong>${o.phone || '—'}</strong></span>
        </div>
        ${o.address ? `<div class="aoc-address">📍 ${o.address}</div>` : ''}
        ${deliveryTime ? `<div class="aoc-delivery-time">${deliveryTime}</div>` : ''}
        ${items ? `<div class="aoc-items" style="margin-top:8px">${items}</div>` : ''}
        ${o.note ? `<div class="aoc-note">💬 ${o.note}</div>` : ''}
        <div class="aoc-total" style="margin-top:10px">${(o.total || 0).toLocaleString()} ₽</div>
      </div>

      ${o.assemblyPhoto ? `
        <div class="aoc-photo">
          <div class="aoc-photo-label">📸 Фото букета:</div>
          <img src="${o.assemblyPhoto}" alt="Букет"/>
        </div>
      ` : ''}

      <div class="aoc-footer">
        <select class="status-select" data-id="${o._id}" onchange="changeStatus(this)">
          <option value="pending"  ${o.status==='pending'  ? 'selected' : ''}>🕐 Принят</option>
          <option value="assembly" ${o.status==='assembly' ? 'selected' : ''}>🌿 Сборка</option>
          <option value="delivery" ${o.status==='delivery' ? 'selected' : ''}>🚚 Доставка</option>
          <option value="done"     ${o.status==='done'     ? 'selected' : ''}>✅ Выполнен</option>
        </select>

        <div class="photo-input-wrap">
          <input
            type="url"
            class="photo-url-input"
            data-id="${o._id}"
            value="${o.assemblyPhoto || ''}"
            placeholder="Ссылка на фото букета (необязательно)"
          />
          <button class="btn-primary small" onclick="savePhoto('${o._id}')">📸 Сохранить фото</button>
        </div>
      </div>
    </div>
  `;
}

function attachOrderHandlers() {
  // handlers are inline via window.changeStatus / window.savePhoto
}

// ===== CHANGE STATUS =====
window.changeStatus = async function(select) {
  const id = select.dataset.id;
  const newStatus = select.value;
  try {
    await updateDoc(doc(db, 'orders', id), { status: newStatus });
    const order = allOrders.find(o => o._id === id);
    if (order) order.status = newStatus;
    updateStats();
    renderDashNewOrders();

    const st = STATUS_MAP[newStatus];
    showToast(`Статус обновлён: ${st.emoji} ${st.label}`);

    // Update badge in the card without re-rendering
    const card = select.closest('.admin-order-card');
    const badge = card.querySelector('.badge');
    badge.className = `badge ${st.cls}`;
    badge.textContent = `${st.emoji} ${st.label}`;
  } catch(e) {
    showToast('Ошибка обновления статуса: ' + e.message);
    console.error(e);
  }
};

// ===== SAVE PHOTO =====
window.savePhoto = async function(id) {
  const input = document.querySelector(`.photo-url-input[data-id="${id}"]`);
  if (!input) return;
  const url = input.value.trim();
  try {
    await updateDoc(doc(db, 'orders', id), { assemblyPhoto: url });
    const order = allOrders.find(o => o._id === id);
    if (order) order.assemblyPhoto = url;
    showToast(url ? 'Фото сохранено 📸' : 'Фото удалено');

    // Show/hide photo preview
    const card = input.closest('.admin-order-card');
    let photoDiv = card.querySelector('.aoc-photo');
    if (url) {
      if (!photoDiv) {
        photoDiv = document.createElement('div');
        photoDiv.className = 'aoc-photo';
        card.querySelector('.aoc-footer').before(photoDiv);
      }
      photoDiv.innerHTML = `<div class="aoc-photo-label">📸 Фото букета:</div><img src="${url}" alt="Букет"/>`;
    } else if (photoDiv) {
      photoDiv.remove();
    }
  } catch(e) {
    showToast('Ошибка: ' + e.message);
    console.error(e);
  }
};

// ===== PRODUCTS =====
function renderProducts() {
  const c = document.getElementById('productsList');
  c.innerHTML = PRODUCTS.map(p => `
    <div class="admin-product-row">
      <div class="apc-emoji">${p.emoji}</div>
      <div class="apc-info">
        <div class="apc-name">${p.name}</div>
        <div class="apc-cat">${catNames[p.cat] || p.cat}</div>
      </div>
      <div class="apc-price">
        <input
          type="number"
          value="${p.price}"
          min="0"
          step="50"
          data-id="${p.id}"
          onchange="updatePrice('${p.id}', this.value)"
        /> ₽
      </div>
    </div>
  `).join('');
}

window.updatePrice = function(id, value) {
  const p = PRODUCTS.find(x => x.id === id);
  if (p) {
    p.price = parseInt(value);
    showToast(`Цена "${p.name}" обновлена`);
  }
};

// ===== CUSTOMERS =====
async function loadCustomers() {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const c = document.getElementById('customersList');
    if (snap.empty) {
      c.innerHTML = `<div class="admin-empty"><div class="em-icon">👥</div><p>Клиентов нет</p></div>`;
      return;
    }
    c.innerHTML = `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;background:var(--white);border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06)">
          <thead>
            <tr style="background:var(--pink-pale)">
              <th style="padding:14px 20px;text-align:left;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;color:var(--gray)">Имя</th>
              <th style="padding:14px 20px;text-align:left;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;color:var(--gray)">Email</th>
              <th style="padding:14px 20px;text-align:left;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;color:var(--gray)">Телефон</th>
              <th style="padding:14px 20px;text-align:left;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;color:var(--gray)">Аллергии</th>
            </tr>
          </thead>
          <tbody>
            ${snap.docs.map(d => {
              const u = d.data();
              return `
                <tr style="border-top:1px solid var(--pink-light)">
                  <td style="padding:14px 20px;font-weight:500">${u.fio || u.displayName || '—'}</td>
                  <td style="padding:14px 20px;color:var(--gray);font-size:.88rem">${u.email || '—'}</td>
                  <td style="padding:14px 20px;color:var(--gray);font-size:.88rem">${u.phone || '—'}</td>
                  <td style="padding:14px 20px;color:var(--pink);font-size:.82rem">${u.allergies || '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch(e) {
    document.getElementById('customersList').innerHTML =
      `<div class="admin-empty"><div class="em-icon">⚠️</div><p>Ошибка загрузки клиентов</p></div>`;
  }
}

// ===== NAV =====
document.querySelectorAll('.admin-nav-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-' + btn.dataset.page).classList.add('active');
  };
});

// ===== ORDER FILTERS =====
document.getElementById('orderFilters').addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('#orderFilters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.status;
  renderOrdersList();
});

// ===== LOGOUT =====
document.getElementById('logoutBtn').onclick = async () => {
  await signOut(auth);
  window.location.href = 'index.html';
};

// ===== TOAST =====
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
