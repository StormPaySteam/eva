// ===== EVA FLOWERS — MAIN APP =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, getDocs, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

function renderCatalog(filter = 'all') {
  const sections = { flowers: 'flowersGrid', balloons: 'balloonsGrid', toys: 'toysGrid' };
  const active = PRODUCTS.filter(p => p.active !== false);
  for (const [cat, gridId] of Object.entries(sections)) {
    const grid = document.getElementById(gridId);
    if (!grid) continue;
    if (filter !== 'all' && filter !== cat) { grid.closest('.section').style.display = 'none'; continue; }
    grid.closest('.section').style.display = '';
    const items = active.filter(p => p.cat === cat);
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

window.openProduct = function(id) {
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
      : `<img src="${user.photoURL||'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><circle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22%23f9c8d4%22/><text x=%2220%22 y=%2226%22 font-size=%2218%22 text-anchor=%22middle%22>🌸</text></svg>'}" alt=""/>`;
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
  const orderData = {
    userId: currentUser.uid,
    items: cart.map(item=>{ const p=PRODUCTS.find(x=>x.id===item.id); return {id:item.id,name:p?.name,price:p?.price,qty:item.qty,emoji:p?.emoji||'🌸'}; }),
    total: cart.reduce((s,item)=>{ const p=PRODUCTS.find(x=>x.id===item.id); return s+(p?p.price*item.qty:0); },0),
    recipient:document.getElementById('co_name').value,
    phone:document.getElementById('co_phone').value,
    address:document.getElementById('co_address').value,
    datetime:document.getElementById('co_datetime').value,
    note:document.getElementById('co_note').value,
    status:'pending', createdAt:serverTimestamp()
  };
  try {
    await addDoc(collection(db,'orders'),orderData);
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
document.getElementById('authBtn').onclick = () => openModal('authModal');

window.showToast = function(msg) {
  const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
};

initLogoAnimation();
loadProducts();
