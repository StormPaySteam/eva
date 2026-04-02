// ===== EVA FLOWERS — MAIN APP =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, getDocs, serverTimestamp, query, orderBy, where, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
const googleProvider = new GoogleAuthProvider();

const DEFAULT_PRODUCTS = [
  { id:'f1', cat:'flowers', name:'Хризантемы', desc:'Нежный микс хризантем в стильной упаковке', price:1800, emoji:'🌼', color:'#fff9c4' },
  { id:'f2', cat:'flowers', name:'Гортензии', desc:'Пышные шапки гортензий — для особых моментов', price:2400, emoji:'💜', color:'#e8d5f5' },
  { id:'f3', cat:'flowers', name:'Роза', desc:'Классическая роза — вечный символ любви', price:2200, emoji:'🌹', color:'#ffd5dc' },
  { id:'f4', cat:'flowers', name:'Кустовая роза', desc:'Воздушные кустовые розы в нежной палитре', price:1900, emoji:'🌸', color:'#ffd5dc' },
  { id:'f5', cat:'flowers', name:'Лилии', desc:'Королевские лилии с тонким ароматом', price:2600, emoji:'🌷', color:'#fff0f5' },
  { id:'f6', cat:'flowers', name:'Пионы', desc:'Пышные пионы — роскошь в каждом лепестке', price:3200, emoji:'🌺', color:'#ffd5dc' },
  { id:'b1', cat:'balloons', name:'Фольгированные шары', desc:'Яркие фольгированные шары — сердца, звёзды, цифры', price:350, emoji:'🎈', color:'#ffd5dc' },
  { id:'b2', cat:'balloons', name:'Воздушные шары', desc:'Классические латексные шары в любом цвете', price:120, emoji:'🎀', color:'#d5f0ff' },
  { id:'b3', cat:'balloons', name:'Шар-гигант', desc:'Большой фольгированный шар 90 см', price:850, emoji:'🎊', color:'#fff9c4' },
  { id:'b4', cat:'balloons', name:'Связка шаров', desc:'Букет из 5 воздушных шаров на ленте', price:600, emoji:'🎉', color:'#ffd5dc' },
  { id:'t1', cat:'toys', name:'Мишка с сердцем', desc:'Мягкий медведь с красным сердечком', price:1200, emoji:'🧸', color:'#fff0d5' },
  { id:'t2', cat:'toys', name:'Зайка', desc:'Пушистый зайка — идеальный подарок', price:950, emoji:'🐰', color:'#f5f5f5' },
  { id:'t3', cat:'toys', name:'Единорог', desc:'Волшебный единорог с блёстками', price:1500, emoji:'🦄', color:'#f0d5ff' },
  { id:'t4', cat:'toys', name:'Кот в цветах', desc:'Мягкий кот с букетом из ткани', price:1100, emoji:'🐱', color:'#d5f5e3' },
];

let PRODUCTS = [];
let cart = JSON.parse(localStorage.getItem('eva_cart') || '[]');
let currentUser = null;
let favorites = JSON.parse(localStorage.getItem('eva_favs') || '[]');
let currentProduct = null;
let modalQty = 1;
let currentSort = 'default';
let currentCatFilter = 'all';

async function loadProducts() {
  try {
    const snap = await getDocs(collection(db, 'products'));
    if (snap.empty) {
      await seedProducts();
    } else {
      PRODUCTS = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.active !== false)
        .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
    }
  } catch(e) {
    console.warn('Firestore unavailable, using defaults', e);
    PRODUCTS = [...DEFAULT_PRODUCTS];
  }
  renderCatalog();
  updateCartBadge();
  renderCartDrawer();
}

async function seedProducts() {
  PRODUCTS = [];
  for (let i = 0; i < DEFAULT_PRODUCTS.length; i++) {
    const p = DEFAULT_PRODUCTS[i];
    await setDoc(doc(db, 'products', p.id), { ...p, sortOrder: i, active: true });
    PRODUCTS.push({ ...p, sortOrder: i, active: true });
  }
}

function productImgHTML(p, style = '') {
  if (p.imageURL) return `<img src="${p.imageURL}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;${style}"/>`;
  return `<span>${p.emoji || '🌸'}</span>`;
}

function sortProducts(items) {
  const sorted = [...items];
  if (currentSort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
  else if (currentSort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
  else if (currentSort === 'rating') sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else sorted.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
  return sorted;
}

function renderCatalog(filter = currentCatFilter) {
  currentCatFilter = filter;
  const sections = { flowers: 'flowersGrid', balloons: 'balloonsGrid', toys: 'toysGrid' };
  const active = PRODUCTS.filter(p => p.active !== false);
  for (const [cat, gridId] of Object.entries(sections)) {
    const grid = document.getElementById(gridId);
    if (!grid) continue;
    if (filter !== 'all' && filter !== cat) { grid.closest('.section').style.display = 'none'; continue; }
    grid.closest('.section').style.display = '';
    const items = sortProducts(active.filter(p => p.cat === cat));
    grid.innerHTML = items.map(p => `
      <div class="product-card" onclick="openProduct('${p.id}')">
        <div class="product-img" style="background:${p.color||'#ffd5dc'}">
          ${productImgHTML(p)}
          <button class="product-fav ${favorites.includes(p.id)?'active':''}" onclick="toggleFav(event,'${p.id}')" title="В избранное">
            ${favorites.includes(p.id)?'❤️':'🤍'}
          </button>
        </div>
        <div class="product-body">
          <div class="product-name">${p.name}</div>
          <div class="product-desc">${p.desc}</div>
          <div class="product-footer">
            <span class="product-price">${p.price.toLocaleString()} ₽</span>
            <button class="add-cart-btn" onclick="addToCart(event,'${p.id}')">+</button>
          </div>
        </div>
      </div>
    `).join('');
  }
}

window.openProduct = async function(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  currentProduct = p; modalQty = 1;
  document.getElementById('productModalContent').innerHTML = `
    <div class="product-modal-img" style="background:${p.color||'#ffd5dc'}">${productImgHTML(p)}</div>
    <div class="product-modal-info">
      <h2>${p.name}</h2>
      <p class="desc">${p.desc}</p>
      <div class="product-modal-price" id="modalPrice">${(p.price*modalQty).toLocaleString()} ₽</div>
      <div class="qty-control">
        <button class="qty-lg" id="qtyMinus">−</button>
        <span class="qty-val" id="qtyVal">1</span>
        <button class="qty-lg" id="qtyPlus">+</button>
      </div>
      <button class="btn-primary full" id="modalAddCart">🛒 Добавить в корзину</button>
      <button class="btn-ghost full" style="margin-top:10px" onclick="toggleFav(null,'${p.id}')">
        ${favorites.includes(p.id)?'❤️ Убрать из избранного':'🤍 В избранное'}
      </button>
      <div class="product-reviews-section">
        <div class="product-reviews-header">
          <h4>Отзывы</h4>
          <span class="reviews-loading-hint" id="reviewsHint-${p.id}">Загрузка…</span>
        </div>
        <div id="productReviewsList-${p.id}"></div>
        <div id="productReviewFormWrap-${p.id}"></div>
      </div>
    </div>
  `;
  document.getElementById('qtyMinus').onclick = () => { if(modalQty>1){modalQty--;updateModalQty(p);} };
  document.getElementById('qtyPlus').onclick = () => { modalQty++;updateModalQty(p); };
  document.getElementById('modalAddCart').onclick = () => {
    for(let i=0;i<modalQty;i++) addToCartById(p.id);
    closeModal('productModal');
    showToast(`${p.name} добавлен${modalQty>1?' ('+modalQty+' шт.)':''} в корзину 🌸`);
  };
  openModal('productModal');
  // Load reviews async
  const reviews = await loadProductReviews(p.id);
  const hint = document.getElementById(`reviewsHint-${p.id}`);
  if (hint) hint.remove();
  const reviewsList = document.getElementById(`productReviewsList-${p.id}`);
  if (reviewsList) {
    const avg = reviews.length ? (reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1) : null;
    reviewsList.innerHTML = (avg ? `<div class="reviews-avg">${avg} ★ <span>(${reviews.length})</span></div>` : '') + reviewsListHTML(reviews);
  }
  const formWrap = document.getElementById(`productReviewFormWrap-${p.id}`);
  if (formWrap) formWrap.innerHTML = reviewFormHTML(p.id);
};

function updateModalQty(p) {
  document.getElementById('qtyVal').textContent = modalQty;
  document.getElementById('modalPrice').textContent = (p.price*modalQty).toLocaleString()+' ₽';
}

window.addToCart = function(e,id) { e.stopPropagation(); addToCartById(id); showToast(PRODUCTS.find(x=>x.id===id)?.name+' добавлен в корзину 🌸'); };

function addToCartById(id) {
  const ex = cart.find(x=>x.id===id);
  if(ex) ex.qty++; else cart.push({id,qty:1});
  saveCart(); updateCartBadge(); renderCartDrawer();
}

function saveCart() { localStorage.setItem('eva_cart',JSON.stringify(cart)); }

function updateCartBadge() {
  document.getElementById('cartBadge').textContent = cart.reduce((s,x)=>s+x.qty,0);
}

function renderCartDrawer() {
  const c = document.getElementById('cartItems');
  if(!cart.length){ c.innerHTML='<div class="empty-state">🛒 Корзина пуста</div>'; document.getElementById('cartTotal').textContent='0 ₽'; return; }
  c.innerHTML = cart.map(item=>{
    const p = PRODUCTS.find(x=>x.id===item.id); if(!p) return '';
    return `<div class="cart-item">
      <div class="cart-item-emoji">${p.imageURL?`<img src="${p.imageURL}" style="width:36px;height:36px;border-radius:8px;object-fit:cover"/>`:p.emoji}</div>
      <div class="cart-item-info"><div class="cart-item-name">${p.name}</div><div class="cart-item-price">${(p.price*item.qty).toLocaleString()} ₽</div></div>
      <div class="cart-qty">
        <button class="qty-btn" onclick="changeQty('${item.id}',-1)">−</button>
        <span>${item.qty}</span>
        <button class="qty-btn" onclick="changeQty('${item.id}',1)">+</button>
      </div></div>`;
  }).join('');
  const total = cart.reduce((s,item)=>{ const p=PRODUCTS.find(x=>x.id===item.id); return s+(p?p.price*item.qty:0); },0);
  document.getElementById('cartTotal').textContent = total.toLocaleString()+' ₽';
}

window.changeQty = function(id,delta) {
  const item=cart.find(x=>x.id===id); if(!item) return;
  item.qty+=delta; if(item.qty<=0) cart=cart.filter(x=>x.id!==id);
  saveCart(); updateCartBadge(); renderCartDrawer();
};

window.toggleFav = function(e,id) {
  if(e) e.stopPropagation();
  if(favorites.includes(id)){ favorites=favorites.filter(x=>x!==id); showToast('Убрано из избранного'); }
  else { favorites.push(id); showToast('Добавлено в избранное ❤️'); }
  localStorage.setItem('eva_favs',JSON.stringify(favorites));
  renderCatalog();
};

window.doSearch = function() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  if(!q){ renderCatalog(); return; }
  const sections={flowers:'flowersGrid',balloons:'balloonsGrid',toys:'toysGrid'};
  for(const [cat,gridId] of Object.entries(sections)){
    const grid=document.getElementById(gridId); if(!grid) continue;
    const items=PRODUCTS.filter(p=>p.active!==false&&p.cat===cat&&(p.name.toLowerCase().includes(q)||p.desc.toLowerCase().includes(q)));
    grid.closest('.section').style.display=items.length?'':'none';
    grid.innerHTML=items.map(p=>`
      <div class="product-card" onclick="openProduct('${p.id}')">
        <div class="product-img" style="background:${p.color||'#ffd5dc'}">${productImgHTML(p)}</div>
        <div class="product-body">
          <div class="product-name">${p.name}</div>
          <div class="product-desc">${p.desc}</div>
          <div class="product-footer"><span class="product-price">${p.price.toLocaleString()} ₽</span><button class="add-cart-btn" onclick="addToCart(event,'${p.id}')">+</button></div>
        </div></div>`).join('');
  }
};

function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }

// ===== LOGO ANIMATION =====
function initLogoAnimation() {
  const logoImg = document.querySelector('.logo-img');
  if(!logoImg) return;
  const ring = document.createElement('div');
  ring.className = 'logo-ring';
  logoImg.parentNode.insertBefore(ring, logoImg);
  ring.appendChild(logoImg);
  const petals = ['🌸','🌹','🌷','🌺','🌼'];
  function spawnPetal() {
    const rect = ring.getBoundingClientRect();
    if(rect.width === 0) return;
    const el = document.createElement('span');
    el.className = 'logo-petal';
    el.textContent = petals[Math.floor(Math.random()*petals.length)];
    el.style.left = (rect.left + rect.width/2 + (Math.random()*40-20)) + 'px';
    el.style.top = (rect.bottom - 8) + 'px';
    el.style.setProperty('--drift', (Math.random()*40-20) + 'px');
    el.style.animationDuration = (1.6+Math.random()*0.8) + 's';
    el.style.fontSize = (10+Math.random()*7) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }
  setInterval(spawnPetal, 750);
  ring.addEventListener('mouseenter', () => { for(let i=0;i<5;i++) setTimeout(spawnPetal,i*60); });
}

// ===== AUTH =====
const ADMIN_EMAIL = "eva@eva.com";

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const btn = document.getElementById('authBtn');
  if(user) {
    const isAdmin = user.email === ADMIN_EMAIL;
    btn.innerHTML = isAdmin ? `<span style="font-size:18px">⚙️</span>`
      : `<img src="${user.photoURL||'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><circle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22%23f9c8d4%22/><text x=%2220%22 y=%2226%22 font-size=%2218%22 text-anchor=%22middle%22>🌸</text></svg>'}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;display:block"/>`;
    btn.onclick = () => { window.location.href = isAdmin ? 'admin.html' : 'profile.html'; };
  } else {
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    btn.onclick = () => openModal('authModal');
  }
});

getRedirectResult(auth).then(async (result) => {
  if(!result) return;
  const user = result.user;
  await setDoc(doc(db,'users',user.uid),{ email:user.email, displayName:user.displayName, photoURL:user.photoURL, createdAt:serverTimestamp() },{merge:true});
  showToast(`Привет, ${user.displayName}! 🌸`);
}).catch(e=>{ if(e.code!=='auth/no-current-user') console.error(e); });

document.getElementById('googleSignIn').onclick = async () => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  try {
    if(isMobile) { await signInWithRedirect(auth, googleProvider); }
    else {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      await setDoc(doc(db,'users',user.uid),{ email:user.email, displayName:user.displayName, photoURL:user.photoURL, createdAt:serverTimestamp() },{merge:true});
      closeModal('authModal');
      showToast(`Привет, ${user.displayName}! 🌸`);
    }
  } catch(e){ showToast('Ошибка входа: '+e.message); }
};

document.getElementById('emailSignIn').onclick = async () => {
  const email=document.getElementById('loginEmail').value, pass=document.getElementById('loginPassword').value;
  try { await signInWithEmailAndPassword(auth,email,pass); closeModal('authModal'); showToast('Добро пожаловать! 🌸'); }
  catch(e){ showToast('Ошибка: '+e.message); }
};

document.getElementById('emailRegister').onclick = async () => {
  const name=document.getElementById('regName').value, email=document.getElementById('regEmail').value, pass=document.getElementById('regPassword').value;
  try {
    const cred=await createUserWithEmailAndPassword(auth,email,pass);
    await setDoc(doc(db,'users',cred.user.uid),{ email, displayName:name, createdAt:serverTimestamp() });
    closeModal('authModal'); showToast('Аккаунт создан! 🌸');
  } catch(e){ showToast('Ошибка: '+e.message); }
};

document.getElementById('switchToRegister').onclick = () => { document.getElementById('authContent').style.display='none'; document.getElementById('registerContent').style.display='block'; };
document.getElementById('switchToLogin').onclick = () => { document.getElementById('authContent').style.display='block'; document.getElementById('registerContent').style.display='none'; };

document.getElementById('checkoutBtn').onclick = () => {
  if(!cart.length){ showToast('Корзина пуста'); return; }
  if(!currentUser){ openModal('authModal'); showToast('Войдите для оформления заказа'); return; }
  closeCart(); openModal('checkoutModal');
};

document.getElementById('placeOrderBtn').onclick = async () => {
  if(!currentUser) return;
  const name = document.getElementById('co_name').value.trim();
  const phone = document.getElementById('co_phone').value.trim();
  const address = document.getElementById('co_address').value.trim();
  const datetime = document.getElementById('co_datetime').value.trim();
  if (!name) { showToast('Укажите имя получателя'); document.getElementById('co_name').focus(); return; }
  if (!phone) { showToast('Укажите телефон'); document.getElementById('co_phone').focus(); return; }
  if (!address) { showToast('Укажите адрес доставки'); document.getElementById('co_address').focus(); return; }
  if (!datetime) { showToast('Укажите дату и время доставки'); document.getElementById('co_datetime').focus(); return; }

  const rawTotal = cart.reduce((s,item)=>{ const p=PRODUCTS.find(x=>x.id===item.id); return s+(p?p.price*item.qty:0); },0);
  let finalTotal = rawTotal;
  if (activePromo) {
    if (activePromo.type === 'percent') finalTotal = Math.round(rawTotal * (1 - activePromo.value / 100));
    else finalTotal = Math.max(0, rawTotal - activePromo.value);
  }

  const orderData = {
    userId: currentUser.uid,
    items: cart.map(item=>{ const p=PRODUCTS.find(x=>x.id===item.id); return {id:item.id,name:p?.name,price:p?.price,qty:item.qty,emoji:p?.emoji||'🌸'}; }),
    total: finalTotal,
    rawTotal,
    promoCode: activePromo?.code || null,
    promoDiscount: rawTotal - finalTotal,
    recipient: name,
    phone,
    address,
    datetime,
    note: document.getElementById('co_note').value.trim(),
    status:'pending', createdAt:serverTimestamp()
  };
  try {
    await addDoc(collection(db,'orders'),orderData);
    if (activePromo) {
      try { await updateDoc(doc(db,'promoCodes',activePromo.id), { usedCount: increment(1) }); } catch(_){}
      activePromo = null;
    }
    cart=[]; saveCart(); updateCartBadge(); renderCartDrawer();
    closeModal('checkoutModal');
    showToast('Заказ оформлен! Мы скоро свяжемся с вами 🌸');
  } catch(e){ showToast('Ошибка оформления заказа'); console.error(e); }
};

function openCart(){ document.getElementById('cartDrawer').classList.add('open'); document.getElementById('overlay').classList.add('open'); }
function closeCart(){ document.getElementById('cartDrawer').classList.remove('open'); document.getElementById('overlay').classList.remove('open'); }

document.getElementById('cartToggle').onclick = openCart;
document.getElementById('cartClose').onclick = closeCart;
document.getElementById('overlay').onclick = closeCart;
document.getElementById('searchToggle').onclick = () => document.getElementById('searchBar').classList.toggle('open');
document.getElementById('searchInput').onkeydown = (e) => { if(e.key==='Enter') doSearch(); };
document.getElementById('authModalClose').onclick = () => closeModal('authModal');
document.getElementById('checkoutClose').onclick = () => closeModal('checkoutModal');
document.getElementById('productModalClose').onclick = () => closeModal('productModal');
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click',e=>{ if(e.target===m) m.classList.remove('open'); }));
document.querySelectorAll('.cat-chip').forEach(btn => {
  btn.onclick = () => { document.querySelectorAll('.cat-chip').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderCatalog(btn.dataset.cat); };
});

// ===== SORT CHIPS =====
document.querySelectorAll('.sort-chip').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.sort-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSort = btn.dataset.sort;
    renderCatalog();
  };
});
document.getElementById('authBtn').onclick = () => openModal('authModal');

// ===== PROMO CODES =====
let activePromo = null;

async function validatePromoCode(code) {
  if (!code) return null;
  try {
    const q = query(collection(db, 'promoCodes'),
      where('code', '==', code.toUpperCase()),
      where('active', '==', true));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0].data();
    if (d.expiresAt && d.expiresAt.toDate && d.expiresAt.toDate() < new Date()) return null;
    if (d.maxUses && d.usedCount >= d.maxUses) return null;
    return { id: snap.docs[0].id, ...d };
  } catch(e) { return null; }
}

async function applyPromoUI(inputId, statusId) {
  const code = document.getElementById(inputId)?.value?.trim();
  if (!code) return;
  const promo = await validatePromoCode(code);
  const statusEl = document.getElementById(statusId);
  if (promo) {
    activePromo = promo;
    const label = promo.type === 'percent' ? `-${promo.value}%` : `-${promo.value.toLocaleString()} ₽`;
    statusEl.textContent = `✅ Промокод применён: ${label}`;
    statusEl.style.color = '#2e7d32';
    showToast(`Промокод ${promo.code} применён: скидка ${label} 🎉`);
    if (inputId === 'co_promo') updateCheckoutTotal();
  } else {
    activePromo = null;
    statusEl.textContent = '❌ Промокод недействителен';
    statusEl.style.color = '#c62828';
  }
}

function updateCheckoutTotal() {
  const rawTotal = cart.reduce((s, item) => {
    const p = PRODUCTS.find(x => x.id === item.id);
    return s + (p ? p.price * item.qty : 0);
  }, 0);
  let discounted = rawTotal;
  if (activePromo) {
    if (activePromo.type === 'percent') discounted = Math.round(rawTotal * (1 - activePromo.value / 100));
    else discounted = Math.max(0, rawTotal - activePromo.value);
  }
  const el = document.getElementById('checkoutTotalDisplay');
  if (el) el.textContent = discounted.toLocaleString() + ' ₽';
}

document.getElementById('promoApplyBtn').onclick = () => applyPromoUI('promoInput', 'promoStatus');
document.getElementById('coPromoApplyBtn').onclick = () => applyPromoUI('co_promo', 'coPromoStatus');

// ===== REVIEWS =====
async function loadProductReviews(productId) {
  try {
    const q = query(collection(db, 'reviews'),
      where('productId', '==', productId),
      where('approved', '==', true),
      orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { return []; }
}

async function loadStoreReviews() {
  try {
    const snap = await getDocs(query(collection(db, 'reviews'),
      where('approved', '==', true),
      orderBy('createdAt', 'desc')));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => !r.productId || r.productId === 'null');
  } catch(e) { return []; }
}

function starsHTML(rating, interactive = false, prefix = '') {
  return [1,2,3,4,5].map(i => `
    <span class="star ${interactive ? 'star-interactive' : ''} ${!interactive && i <= rating ? 'star-filled' : ''}"
      data-val="${i}" data-prefix="${prefix}">${i <= rating ? '★' : '☆'}</span>
  `).join('');
}

function reviewsListHTML(reviews) {
  if (!reviews.length) return '<div class="reviews-empty">Пока нет отзывов. Будьте первым! 🌸</div>';
  return reviews.map(r => {
    const date = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('ru') : '';
    return `<div class="review-item">
      <div class="review-header">
        <span class="review-author">${r.userName || 'Аноним'}</span>
        <span class="review-stars">${[1,2,3,4,5].map(i => `<span class="star ${i <= r.rating ? 'star-filled' : ''}">★</span>`).join('')}</span>
        <span class="review-date">${date}</span>
      </div>
      <p class="review-text">${r.text || ''}</p>
    </div>`;
  }).join('');
}

function reviewFormHTML(productId) {
  const pid = productId || 'store';
  const pidAttr = productId ? productId : '';
  return `
    <div class="review-form" id="reviewForm-${pid}">
      <h4>Оставить отзыв</h4>
      <div class="review-stars-pick" id="starPick-${pid}">
        ${[1,2,3,4,5].map(i => `<span class="star star-pick" data-val="${i}" data-pid="${pid}">☆</span>`).join('')}
      </div>
      <textarea id="reviewText-${pid}" placeholder="Ваш отзыв…" rows="3" class="review-textarea"></textarea>
      <button class="btn-primary small" onclick="submitReview('${pidAttr}', '${pid}')">Отправить отзыв</button>
    </div>`;
}

window.submitReview = async function(productId, pid) {
  if (!currentUser) { showToast('Войдите, чтобы оставить отзыв'); openModal('authModal'); return; }
  const rating = parseInt(document.getElementById(`starPick-${pid}`)?.dataset.selected || 0);
  const text = document.getElementById(`reviewText-${pid}`)?.value?.trim();
  if (!rating) { showToast('Поставьте оценку ★'); return; }
  const resolvedProductId = productId && productId !== 'null' ? productId : null;
  try {
    await addDoc(collection(db, 'reviews'), {
      productId: resolvedProductId,
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Пользователь',
      userPhoto: currentUser.photoURL || null,
      rating,
      text: text || '',
      approved: false,
      createdAt: serverTimestamp()
    });
    showToast('Отзыв отправлен на модерацию 🌸');
    const form = document.getElementById(`reviewForm-${pid}`);
    if (form) form.innerHTML = '<p style="color:var(--pink);text-align:center;padding:12px 0">✅ Спасибо! Отзыв появится после проверки.</p>';
  } catch(e) { showToast('Ошибка: ' + e.message); }
};

// Star picker interaction (delegated)
document.addEventListener('click', (e) => {
  const star = e.target.closest('.star-pick');
  if (!star) return;
  const pid = star.dataset.pid;
  const val = parseInt(star.dataset.val);
  const picker = document.getElementById(`starPick-${pid}`);
  if (!picker) return;
  picker.dataset.selected = val;
  picker.querySelectorAll('.star-pick').forEach((s, i) => {
    s.textContent = i < val ? '★' : '☆';
    s.classList.toggle('star-filled', i < val);
  });
});

async function renderStoreReviews() {
  const container = document.getElementById('storeReviewsList');
  if (!container) return;
  const reviews = await loadStoreReviews();
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
  document.getElementById('storeRatingBig').textContent = avg ? `${avg} ★` : '—';
  document.getElementById('storeReviewCount').textContent = reviews.length ? `${reviews.length} отзыв${reviews.length === 1 ? '' : reviews.length < 5 ? 'а' : 'ов'}` : '';
  container.innerHTML = reviewsListHTML(reviews);
  const formWrap = document.getElementById('storeReviewFormWrap');
  if (formWrap) formWrap.innerHTML = reviewFormHTML(null);
}

window.showToast = function(msg) {
  const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
};

initLogoAnimation();
loadProducts();
renderStoreReviews();
