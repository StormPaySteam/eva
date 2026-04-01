// ===== EVA FLOWERS — ADMIN PANEL =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs, doc, updateDoc, deleteDoc,
  addDoc, setDoc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

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
const storage = getStorage(app);

const CAT_NAMES = { flowers:'🌸 Цветы', balloons:'🎈 Шары', toys:'🧸 Игрушки' };
const STATUS_MAP = {
  pending:  { label:'Принят',        cls:'badge-pending',  emoji:'🕐' },
  assembly: { label:'Сборка',        cls:'badge-assembly', emoji:'🌿' },
  delivery: { label:'Курьер в пути', cls:'badge-delivery', emoji:'🚚' },
  done:     { label:'Доставлен',     cls:'badge-done',     emoji:'✅' }
};

let allOrders = [];
let allProducts = [];
let activeFilter = 'all';
let editingProductId = null;

// ===== AUTH =====
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  if (user.email !== ADMIN_EMAIL) {
    showToast('Доступ запрещён');
    setTimeout(() => window.location.href = 'profile.html', 1500);
    return;
  }
  document.getElementById('adminEmail').textContent = user.email;
  await Promise.all([loadOrders(), loadProducts()]);
  await loadCustomers();
});

// ===== NAV =====
document.querySelectorAll('.admin-nav-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-' + btn.dataset.page).classList.add('active');
  };
});

document.getElementById('orderFilters').addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn'); if (!btn) return;
  document.querySelectorAll('#orderFilters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.status;
  renderOrdersList();
});

document.getElementById('logoutBtn').onclick = async () => { await signOut(auth); window.location.href = 'index.html'; };

// ===== ORDERS =====
async function loadOrders() {
  try {
    const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
    allOrders = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    updateStats();
    renderDashNewOrders();
    renderOrdersList();
  } catch(e) {
    document.getElementById('ordersListAdmin').innerHTML = `<div class="admin-empty"><div class="em-icon">⚠️</div><p>Ошибка загрузки. Проверьте Firestore Rules</p></div>`;
    document.getElementById('dashNewOrders').innerHTML = `<div class="admin-empty"><div class="em-icon">⚠️</div><p>Нет доступа к заказам</p></div>`;
  }
}

function updateStats() {
  const pending = allOrders.filter(o => o.status === 'pending').length;
  const revenue = allOrders.filter(o => o.status === 'done').reduce((s, o) => s + (o.total || 0), 0);
  document.getElementById('stat-total').textContent = allOrders.length;
  document.getElementById('stat-pending').textContent = pending;
  document.getElementById('stat-delivery').textContent = allOrders.filter(o => o.status === 'delivery').length;
  document.getElementById('stat-revenue').textContent = revenue.toLocaleString() + ' ₽';
  document.getElementById('pendingBadge').textContent = pending;
}

function renderDashNewOrders() {
  const newOrders = allOrders.filter(o => o.status === 'pending');
  const c = document.getElementById('dashNewOrders');
  if (!newOrders.length) { c.innerHTML = `<div class="admin-empty"><div class="em-icon">🎉</div><p>Новых заказов нет</p></div>`; return; }
  c.innerHTML = newOrders.map(o => orderCardHTML(o)).join('');
}

window.filterOrders = function() { renderOrdersList(); };

function renderOrdersList() {
  const search = (document.getElementById('orderSearch')?.value || '').toLowerCase();
  let orders = allOrders;
  if (activeFilter !== 'all') orders = orders.filter(o => o.status === activeFilter);
  if (search) orders = orders.filter(o =>
    (o.recipient || '').toLowerCase().includes(search) ||
    (o.phone || '').toLowerCase().includes(search) ||
    (o.address || '').toLowerCase().includes(search)
  );
  const c = document.getElementById('ordersListAdmin');
  if (!orders.length) { c.innerHTML = `<div class="admin-empty"><div class="em-icon">📦</div><p>Заказов не найдено</p></div>`; return; }
  c.innerHTML = orders.map(o => orderCardHTML(o)).join('');
}

function orderCardHTML(o) {
  const st = STATUS_MAP[o.status] || STATUS_MAP.pending;
  const date = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString('ru') : '—';
  const items = (o.items || []).map(i => `${i.emoji || '🌸'} ${i.name} × ${i.qty}`).join(' · ');
  const deliveryTime = o.datetime
    ? `🕐 Доставка: ${new Date(o.datetime).toLocaleString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
    : '';
  return `
    <div class="admin-order-card" data-id="${o._id}">
      <div class="aoc-head">
        <div><span class="aoc-id">#${o._id.slice(-8).toUpperCase()}</span><span class="aoc-date" style="margin-left:12px">${date}</span></div>
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
      ${o.assemblyPhoto ? `<div class="aoc-photo"><div class="aoc-photo-label">📸 Фото букета:</div><img src="${o.assemblyPhoto}" alt="Букет"/></div>` : ''}
      <div class="aoc-footer">
        <select class="status-select" data-id="${o._id}" onchange="changeStatus(this)">
          <option value="pending"  ${o.status === 'pending'  ? 'selected' : ''}>🕐 Принят</option>
          <option value="assembly" ${o.status === 'assembly' ? 'selected' : ''}>🌿 Сборка</option>
          <option value="delivery" ${o.status === 'delivery' ? 'selected' : ''}>🚚 Доставка</option>
          <option value="done"     ${o.status === 'done'     ? 'selected' : ''}>✅ Выполнен</option>
        </select>
        <label class="upload-photo-btn">
          📸 Загрузить фото
          <input type="file" accept="image/*" capture="environment" style="display:none" onchange="uploadOrderPhoto(this,'${o._id}')"/>
        </label>
        ${o.assemblyPhoto ? `<button class="btn-ghost small" onclick="removeOrderPhoto('${o._id}')">🗑 Удалить фото</button>` : ''}
      </div>
    </div>
  `;
}

window.changeStatus = async function(select) {
  const id = select.dataset.id;
  try {
    await updateDoc(doc(db, 'orders', id), { status: select.value });
    const order = allOrders.find(o => o._id === id);
    if (order) order.status = select.value;
    updateStats();
    renderDashNewOrders();
    const st = STATUS_MAP[select.value];
    showToast(`Статус: ${st.emoji} ${st.label}`);
    const card = select.closest('.admin-order-card');
    const badge = card.querySelector('.badge');
    badge.className = `badge ${st.cls}`;
    badge.textContent = `${st.emoji} ${st.label}`;
  } catch(e) { showToast('Ошибка: ' + e.message); }
};

window.uploadOrderPhoto = async function(input, orderId) {
  const file = input.files[0]; if (!file) return;
  showToast('Загружаем фото…');
  try {
    const storageRef = ref(storage, `orders/${orderId}_${Date.now()}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    await updateDoc(doc(db, 'orders', orderId), { assemblyPhoto: url });
    const order = allOrders.find(o => o._id === orderId);
    if (order) order.assemblyPhoto = url;
    showToast('Фото загружено 📸');
    renderOrdersList();
    renderDashNewOrders();
  } catch(e) { showToast('Ошибка загрузки: ' + e.message); }
};

window.removeOrderPhoto = async function(orderId) {
  try {
    await updateDoc(doc(db, 'orders', orderId), { assemblyPhoto: '' });
    const order = allOrders.find(o => o._id === orderId);
    if (order) order.assemblyPhoto = '';
    showToast('Фото удалено');
    renderOrdersList();
  } catch(e) { showToast('Ошибка: ' + e.message); }
};

// ===== PRODUCTS =====
async function loadProducts() {
  try {
    const snap = await getDocs(query(collection(db, 'products'), orderBy('sortOrder', 'asc')));
    allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProductsList();
  } catch(e) {
    document.getElementById('productsList').innerHTML = `<div class="admin-empty"><div class="em-icon">⚠️</div><p>Ошибка загрузки товаров</p></div>`;
  }
}

function renderProductsList() {
  const c = document.getElementById('productsList');
  if (!allProducts.length) { c.innerHTML = `<div class="admin-empty"><div class="em-icon">🌸</div><p>Товаров нет. Нажмите «+ Добавить товар»</p></div>`; return; }
  c.innerHTML = allProducts.map(p => `
    <div class="admin-product-row ${p.active === false ? 'inactive' : ''}">
      <div class="apc-img" style="background:${p.color || '#ffd5dc'}">
        ${p.imageURL ? `<img src="${p.imageURL}" alt="${p.name}"/>` : `<span>${p.emoji || '🌸'}</span>`}
      </div>
      <div class="apc-info">
        <div class="apc-name">${p.name} ${p.active === false ? '<span style="color:var(--gray);font-size:.75rem">(скрыт)</span>' : ''}</div>
        <div class="apc-cat">${CAT_NAMES[p.cat] || p.cat}</div>
        <div class="apc-desc">${(p.desc || '').slice(0, 50)}${p.desc?.length > 50 ? '…' : ''}</div>
      </div>
      <div class="apc-price">${p.price.toLocaleString()} ₽</div>
      <div class="apc-actions">
        <button class="apc-btn" onclick="startEditProduct('${p.id}')" title="Редактировать">✏️</button>
        <button class="apc-btn" onclick="toggleProductActive('${p.id}')" title="${p.active === false ? 'Показать' : 'Скрыть'}">
          ${p.active === false ? '👁' : '🚫'}
        </button>
        <button class="apc-btn del" onclick="deleteProduct('${p.id}')" title="Удалить">🗑</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('addProductBtn').onclick = () => openProductForm();

function openProductForm(product = null) {
  editingProductId = product ? product.id : null;
  document.getElementById('productFormTitle').textContent = product ? 'Редактировать товар' : 'Новый товар';
  document.getElementById('pf_name').value  = product?.name  || '';
  document.getElementById('pf_desc').value  = product?.desc  || '';
  document.getElementById('pf_price').value = product?.price || '';
  document.getElementById('pf_emoji').value = product?.emoji || '🌸';
  document.getElementById('pf_color').value = product?.color || '#ffd5dc';
  document.getElementById('pf_cat').value   = product?.cat   || 'flowers';
  const prev = document.getElementById('pf_imagePreview');
  prev.innerHTML = product?.imageURL ? `<img src="${product.imageURL}" alt="фото"/>` : '<span>Фото не выбрано</span>';
  prev.dataset.existingUrl = product?.imageURL || '';
  document.getElementById('pf_image').value = '';
  const form = document.getElementById('productForm');
  form.style.display = 'flex';
  setTimeout(() => form.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}

document.getElementById('cancelProductBtn').onclick = () => {
  document.getElementById('productForm').style.display = 'none';
  editingProductId = null;
};

document.getElementById('pf_image').onchange = (e) => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { document.getElementById('pf_imagePreview').innerHTML = `<img src="${ev.target.result}" alt="preview"/>`; };
  reader.readAsDataURL(file);
};

document.getElementById('saveProductBtn').onclick = async () => {
  const name  = document.getElementById('pf_name').value.trim();
  const price = parseInt(document.getElementById('pf_price').value);
  if (!name || !price) { showToast('Заполните название и цену'); return; }

  const data = {
    name,
    desc:  document.getElementById('pf_desc').value.trim(),
    price,
    emoji: document.getElementById('pf_emoji').value.trim() || '🌸',
    color: document.getElementById('pf_color').value,
    cat:   document.getElementById('pf_cat').value,
    active: true
  };

  const btn = document.getElementById('saveProductBtn');
  btn.textContent = 'Сохраняем…';
  btn.disabled = true;

  try {
    const fileInput = document.getElementById('pf_image');
    const existingUrl = document.getElementById('pf_imagePreview').dataset.existingUrl;
    if (fileInput.files[0]) {
      const fileRef = ref(storage, `products/${Date.now()}_${fileInput.files[0].name}`);
      await uploadBytes(fileRef, fileInput.files[0]);
      data.imageURL = await getDownloadURL(fileRef);
    } else if (existingUrl) {
      data.imageURL = existingUrl;
    }

    if (editingProductId) {
      await updateDoc(doc(db, 'products', editingProductId), data);
      const idx = allProducts.findIndex(p => p.id === editingProductId);
      if (idx >= 0) allProducts[idx] = { ...allProducts[idx], ...data };
      showToast('Товар обновлён ✓');
    } else {
      data.sortOrder = allProducts.length;
      const newRef = await addDoc(collection(db, 'products'), data);
      allProducts.push({ id: newRef.id, ...data });
      showToast('Товар добавлен 🌸');
    }

    renderProductsList();
    document.getElementById('productForm').style.display = 'none';
    editingProductId = null;
  } catch(e) {
    showToast('Ошибка: ' + e.message);
    console.error(e);
  } finally {
    btn.textContent = 'Сохранить';
    btn.disabled = false;
  }
};

window.startEditProduct = function(id) {
  const p = allProducts.find(x => x.id === id);
  if (p) openProductForm(p);
};

window.toggleProductActive = async function(id) {
  const p = allProducts.find(x => x.id === id); if (!p) return;
  const newActive = p.active === false ? true : false;
  try {
    await updateDoc(doc(db, 'products', id), { active: newActive });
    p.active = newActive;
    renderProductsList();
    showToast(newActive ? 'Товар показан 👁' : 'Товар скрыт 🚫');
  } catch(e) { showToast('Ошибка: ' + e.message); }
};

window.deleteProduct = async function(id) {
  if (!confirm('Удалить товар? Это нельзя отменить.')) return;
  try {
    await deleteDoc(doc(db, 'products', id));
    allProducts = allProducts.filter(p => p.id !== id);
    renderProductsList();
    showToast('Товар удалён');
  } catch(e) { showToast('Ошибка: ' + e.message); }
};

// ===== CUSTOMERS =====
async function loadCustomers() {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const c = document.getElementById('customersList');
    if (snap.empty) { c.innerHTML = `<div class="admin-empty"><div class="em-icon">👥</div><p>Клиентов нет</p></div>`; return; }
    c.innerHTML = `<div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;background:var(--white);border-radius:16px;overflow:hidden">
        <thead><tr style="background:var(--pink-pale)">
          <th style="padding:14px 20px;text-align:left;font-size:.78rem;text-transform:uppercase;color:var(--gray)">Имя</th>
          <th style="padding:14px 20px;text-align:left;font-size:.78rem;text-transform:uppercase;color:var(--gray)">Email</th>
          <th style="padding:14px 20px;text-align:left;font-size:.78rem;text-transform:uppercase;color:var(--gray)">Телефон</th>
          <th style="padding:14px 20px;text-align:left;font-size:.78rem;text-transform:uppercase;color:var(--gray)">Аллергии</th>
        </tr></thead>
        <tbody>${snap.docs.map(d => { const u = d.data(); return `
          <tr style="border-top:1px solid var(--pink-light)">
            <td style="padding:14px 20px;font-weight:500">${u.fio || u.displayName || '—'}</td>
            <td style="padding:14px 20px;color:var(--gray);font-size:.88rem">${u.email || '—'}</td>
            <td style="padding:14px 20px;color:var(--gray);font-size:.88rem">${u.phone || '—'}</td>
            <td style="padding:14px 20px;color:var(--pink);font-size:.82rem">${u.allergies || '—'}</td>
          </tr>`; }).join('')}</tbody>
      </table></div>`;
  } catch(e) { document.getElementById('customersList').innerHTML = `<div class="admin-empty"><div class="em-icon">⚠️</div><p>Ошибка загрузки</p></div>`; }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
