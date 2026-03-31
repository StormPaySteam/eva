// ===== EVA FLOWERS — PROFILE PAGE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc,
  collection, addDoc, getDocs, deleteDoc, query, where, orderBy,
  serverTimestamp
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let PRODUCTS = [];
async function loadProducts() {
  try {
    const snap = await getDocs(query(collection(db, 'products'), orderBy('sortOrder', 'asc')));
    PRODUCTS = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.active !== false);
  } catch(e) {
    PRODUCTS = [];
  }
}

let currentUser = null;
let userAddresses = [];
let userEvents = [];

// ===== AUTH GUARD =====
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  currentUser = user;
  await loadProducts();
  await loadProfile(user);
});

// ===== LOAD PROFILE =====
async function loadProfile(user) {
  const snap = await getDoc(doc(db, 'users', user.uid));
  const data = snap.exists() ? snap.data() : {};

  // Sidebar
  const name = data.fio || data.displayName || user.displayName || 'Пользователь';
  document.getElementById('sidebarName').textContent = name;
  document.getElementById('sidebarNick').textContent = data.nickname ? '@' + data.nickname : '';

  const avatar = data.avatarURL || user.photoURL;
  if (avatar) document.getElementById('avatarImg').src = avatar;

  // Form fields
  document.getElementById('p_fio').value = data.fio || data.displayName || user.displayName || '';
  document.getElementById('p_nick').value = data.nickname || '';
  document.getElementById('p_email').value = user.email || '';
  document.getElementById('p_phone').value = data.phone || '';
  document.getElementById('p_flowers').value = data.favoriteFlowers || '';
  document.getElementById('p_allergies').value = data.allergies || '';

  await loadOrders(user.uid);
  await loadAddresses(user.uid);
  await loadEvents(user.uid);
  loadCart();
  loadFavorites();
  loadArchive(user.uid);
}

// ===== SAVE PROFILE =====
document.getElementById('saveProfileBtn').onclick = async () => {
  if (!currentUser) return;
  const data = {
    fio: document.getElementById('p_fio').value,
    nickname: document.getElementById('p_nick').value,
    phone: document.getElementById('p_phone').value,
    favoriteFlowers: document.getElementById('p_flowers').value,
    allergies: document.getElementById('p_allergies').value,
    updatedAt: serverTimestamp()
  };
  try {
    await setDoc(doc(db, 'users', currentUser.uid), data, { merge: true });
    document.getElementById('sidebarName').textContent = data.fio || 'Пользователь';
    document.getElementById('sidebarNick').textContent = data.nickname ? '@' + data.nickname : '';
    showToast('Профиль сохранён ✓');
  } catch(e) { showToast('Ошибка сохранения'); }
};

// ===== AVATAR =====
document.getElementById('avatarChangeBtn').onclick = () => document.getElementById('avatarInput').click();
document.getElementById('avatarInput').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file || !currentUser) return;
  showToast('Загружаем аватар…');
  try {
    const storageRef = ref(storage, `avatars/${currentUser.uid}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    document.getElementById('avatarImg').src = url;
    await setDoc(doc(db, 'users', currentUser.uid), { avatarURL: url }, { merge: true });
    showToast('Аватар обновлён 🌸');
  } catch(e) { showToast('Ошибка загрузки: ' + e.message); }
};

// ===== ORDERS =====
async function loadOrders(uid) {
  try {
    const q = query(collection(db, 'orders'), where('userId', '==', uid), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const container = document.getElementById('ordersContainer');
    if (snap.empty) { container.innerHTML = '<div class="empty-state">📦 Заказов пока нет</div>'; return; }
    
    const statusMap = {
      pending: { label: 'Принят', cls: 'status-pending' },
      assembly: { label: 'Сборка букета', cls: 'status-assembly' },
      delivery: { label: 'Курьер в пути', cls: 'status-delivery' },
      done: { label: 'Доставлен', cls: 'status-done' }
    };

    container.innerHTML = snap.docs.map(d => {
      const o = d.data();
      const st = statusMap[o.status] || statusMap.pending;
      const date = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString('ru') : '—';
      const itemsList = (o.items || []).map(i => `${i.emoji||'🌸'} ${i.name} × ${i.qty}`).join(', ');
      return `
        <div class="order-card">
          <div class="order-head">
            <span class="order-id">Заказ от ${date}</span>
            <span class="order-status ${st.cls}">${st.label}</span>
          </div>
          <div class="order-items">${itemsList || 'Товары'}</div>
          <div class="order-total">${(o.total || 0).toLocaleString()} ₽</div>
          ${o.address ? `<div style="font-size:.82rem;color:var(--gray);margin-top:6px">📍 ${o.address}</div>` : ''}
          ${o.assemblyPhoto ? `<div class="order-photo"><p style="font-size:.8rem;color:var(--gray);margin-bottom:6px">📸 Фото букета:</p><img src="${o.assemblyPhoto}" alt="Букет"/></div>` : ''}
          ${o.status === 'done' ? `<button class="btn-ghost" style="margin-top:12px;padding:8px 16px;font-size:.82rem" onclick="repeatOrder('${d.id}')">🔄 Повторить заказ</button>` : ''}
        </div>
      `;
    }).join('');
  } catch(e) { console.error('Orders error:', e); }
}

window.repeatOrder = async function(orderId) {
  try {
    const snap = await getDoc(doc(db, 'orders', orderId));
    if (!snap.exists()) return;
    const o = snap.data();
    const cart = o.items || [];
    localStorage.setItem('eva_cart', JSON.stringify(cart.map(i => ({ id: i.id, qty: i.qty }))));
    window.location.href = 'index.html';
    showToast('Товары добавлены в корзину 🌸');
  } catch(e) { showToast('Ошибка'); }
};

// ===== CART IN PROFILE =====
function loadCart() {
  const cart = JSON.parse(localStorage.getItem('eva_cart') || '[]');
  const container = document.getElementById('profileCartContainer');
  if (!cart.length) { container.innerHTML = '<div class="empty-state">🛒 Корзина пуста</div>'; return; }
  
  let total = 0;
  const html = cart.map(item => {
    const p = PRODUCTS.find(x => x.id === item.id);
    if (!p) return '';
    total += p.price * item.qty;
    return `
      <div class="profile-cart-item">
        <span style="font-size:1.8rem">${p.emoji}</span>
        <div style="flex:1">
          <div style="font-weight:500">${p.name}</div>
          <div style="color:var(--gray);font-size:.82rem">${item.qty} шт.</div>
        </div>
        <div style="font-weight:600;color:var(--pink)">${(p.price * item.qty).toLocaleString()} ₽</div>
      </div>
    `;
  }).join('');
  container.innerHTML = html + `<div class="profile-cart-total">Итого: ${total.toLocaleString()} ₽</div>
    <button class="btn-primary" style="margin-top:16px" onclick="window.location.href='index.html'">Перейти в магазин</button>`;
}

// ===== ADDRESSES =====
async function loadAddresses(uid) {
  try {
    const snap = await getDocs(collection(db, `users/${uid}/addresses`));
    userAddresses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAddresses();
    populateEventAddresses();
  } catch(e) { console.error(e); }
}

function renderAddresses() {
  const c = document.getElementById('addressesContainer');
  if (!userAddresses.length) { c.innerHTML = '<div class="empty-state">📍 Адресов нет</div>'; return; }
  c.innerHTML = userAddresses.map(a => `
    <div class="address-card">
      <div>
        <div class="address-label">${a.label || 'Адрес'}</div>
        <div class="address-info">${a.address || ''}</div>
        ${a.recipient ? `<div class="address-info">👤 ${a.recipient}</div>` : ''}
        ${a.phone ? `<div class="address-info">📞 ${a.phone}</div>` : ''}
      </div>
      <div class="address-actions">
        <button class="del-btn" onclick="deleteAddress('${a.id}')" title="Удалить">🗑</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('addAddressBtn').onclick = () => {
  document.getElementById('addressForm').style.display = 'flex';
};
document.getElementById('cancelAddressBtn').onclick = () => {
  document.getElementById('addressForm').style.display = 'none';
};
document.getElementById('saveAddressBtn').onclick = async () => {
  if (!currentUser) return;
  const addr = {
    label: document.getElementById('addr_label').value || 'Адрес',
    address: document.getElementById('addr_address').value,
    phone: document.getElementById('addr_phone').value,
    recipient: document.getElementById('addr_recipient').value,
    createdAt: serverTimestamp()
  };
  try {
    const ref = await addDoc(collection(db, `users/${currentUser.uid}/addresses`), addr);
    userAddresses.push({ id: ref.id, ...addr });
    renderAddresses();
    populateEventAddresses();
    document.getElementById('addressForm').style.display = 'none';
    ['addr_label','addr_address','addr_phone','addr_recipient'].forEach(id => document.getElementById(id).value = '');
    showToast('Адрес сохранён 📍');
  } catch(e) { showToast('Ошибка сохранения'); }
};

window.deleteAddress = async function(id) {
  if (!currentUser || !confirm('Удалить адрес?')) return;
  try {
    await deleteDoc(doc(db, `users/${currentUser.uid}/addresses`, id));
    userAddresses = userAddresses.filter(a => a.id !== id);
    renderAddresses();
    showToast('Адрес удалён');
  } catch(e) { showToast('Ошибка'); }
};

// ===== EVENTS / CALENDAR =====
async function loadEvents(uid) {
  try {
    const snap = await getDocs(collection(db, `users/${uid}/events`));
    userEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    userEvents.sort((a, b) => {
      const [am, ad] = (a.date || '').split('-').slice(1);
      const [bm, bd] = (b.date || '').split('-').slice(1);
      return (parseInt(am)*100 + parseInt(ad)) - (parseInt(bm)*100 + parseInt(bd));
    });
    renderEvents();
    checkUpcomingEvents();
  } catch(e) { console.error(e); }
}

function renderEvents() {
  const c = document.getElementById('eventsContainer');
  if (!userEvents.length) { c.innerHTML = '<div class="empty-state">📅 Событий нет</div>'; return; }
  const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  c.innerHTML = userEvents.map(ev => {
    const [y, m, d] = (ev.date || '----').split('-');
    const mi = parseInt(m) - 1;
    const daysLeft = getDaysLeft(ev.date);
    return `
      <div class="event-card">
        <div class="ev-date">${d}<span class="ev-month">${months[mi] || ''}</span></div>
        <div class="event-info">
          <div class="event-title">${ev.title}</div>
          <div class="event-meta">
            ${ev.repeat ? '🔄 Ежегодно · ' : ''}
            ${daysLeft !== null ? (daysLeft === 0 ? '🎉 Сегодня!' : daysLeft > 0 ? `⏳ Через ${daysLeft} дн.` : `${Math.abs(daysLeft)} дн. назад`) : ''}
            ${ev.remindBefore ? ` · Напомнить за ${ev.remindBefore} дн.` : ''}
          </div>
        </div>
        <div class="address-actions">
          <button class="del-btn" onclick="deleteEvent('${ev.id}')">🗑</button>
        </div>
      </div>
    `;
  }).join('');
}

function getDaysLeft(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const today = new Date();
  const thisYear = today.getFullYear();
  let target = new Date(thisYear, m-1, d);
  const diff = Math.round((target - today) / 86400000);
  return diff;
}

function checkUpcomingEvents() {
  userEvents.forEach(ev => {
    const days = getDaysLeft(ev.date);
    if (days !== null && ev.remindBefore && days <= ev.remindBefore && days >= 0) {
      showToast(`📅 ${ev.title} — через ${days} дн.!`);
    }
  });
}

function populateEventAddresses() {
  const sel = document.getElementById('ev_address');
  sel.innerHTML = '<option value="">— Выберите адрес —</option>';
  userAddresses.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id; opt.textContent = `${a.label} — ${a.address}`;
    sel.appendChild(opt);
  });
}

document.getElementById('addEventBtn').onclick = () => {
  document.getElementById('eventForm').style.display = 'flex';
};
document.getElementById('cancelEventBtn').onclick = () => {
  document.getElementById('eventForm').style.display = 'none';
};
document.getElementById('saveEventBtn').onclick = async () => {
  if (!currentUser) return;
  const ev = {
    title: document.getElementById('ev_title').value,
    date: document.getElementById('ev_date').value,
    repeat: document.getElementById('ev_repeat').checked,
    remindBefore: parseInt(document.getElementById('ev_remind').value) || 0,
    addressId: document.getElementById('ev_address').value,
    createdAt: serverTimestamp()
  };
  try {
    const ref = await addDoc(collection(db, `users/${currentUser.uid}/events`), ev);
    userEvents.push({ id: ref.id, ...ev });
    renderEvents();
    document.getElementById('eventForm').style.display = 'none';
    showToast('Событие добавлено 📅');
  } catch(e) { showToast('Ошибка сохранения'); }
};

window.deleteEvent = async function(id) {
  if (!currentUser || !confirm('Удалить событие?')) return;
  try {
    await deleteDoc(doc(db, `users/${currentUser.uid}/events`, id));
    userEvents = userEvents.filter(e => e.id !== id);
    renderEvents();
    showToast('Событие удалено');
  } catch(e) { showToast('Ошибка'); }
};

// ===== FAVORITES =====
function loadFavorites() {
  const favs = JSON.parse(localStorage.getItem('eva_favs') || '[]');
  const c = document.getElementById('favoritesContainer');
  if (!favs.length) { c.innerHTML = '<div class="empty-state">❤️ Нет избранных товаров</div>'; return; }
  const items = favs.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
  c.innerHTML = `<div class="fav-grid">` + items.map(p => `
    <div class="fav-card" onclick="window.location.href='index.html'">
      <div class="fav-img">${p.emoji}</div>
      <div class="fav-name">${p.name}</div>
      <div class="fav-price">${p.price.toLocaleString()} ₽</div>
    </div>
  `).join('') + `</div>`;
}

// ===== ARCHIVE =====
async function loadArchive(uid) {
  try {
    const snap = await getDocs(collection(db, `users/${uid}/archive`));
    const c = document.getElementById('archiveContainer');
    if (snap.empty) { c.innerHTML = '<div class="empty-state">🗂 Архив пуст</div>'; return; }
    c.innerHTML = snap.docs.map(d => {
      const a = d.data();
      return `
        <div class="archive-card">
          ${a.photo ? `<img class="archive-img" src="${a.photo}" alt="Букет"/>` : `<div class="archive-img" style="display:flex;align-items:center;justify-content:center;font-size:3rem;background:var(--pink-pale)">💐</div>`}
          <div class="archive-body">
            <div class="archive-date">${a.date || '—'}</div>
            <div class="archive-name">${a.name || 'Букет'}</div>
            <div class="archive-recipient">👤 ${a.recipient || 'Получатель'}</div>
            ${a.phone ? `<div style="font-size:.8rem;color:var(--gray)">📞 ${a.phone}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch(e) { console.error(e); }
}

// ===== TAB NAVIGATION =====
document.querySelectorAll('.pnav-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.pnav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  };
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
