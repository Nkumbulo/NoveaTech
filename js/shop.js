// =========================================
// NOVEATECH SHOP — API-DRIVEN + AMAZON PAGINATION
// =========================================

const CONFIG = {
  API_URL: '/api/products',   // swap this later for your PHP/Supabase endpoint
  JSON_URL: './products.json', // level-2 fallback: read the file directly
  ITEMS_PER_PAGE: 12,
  WHATSAPP_NUMBER: '263777696880', // single source of truth — used for checkout AND product-detail chats
};

// Tiny built-in safety net (level-3 fallback) so the shop NEVER shows a dead
// "Loading..." screen even if both the API and products.json are unreachable
// (e.g. someone double-clicked shop.html and opened it as file://).
const EMBEDDED_FALLBACK = [
  { id: 1, cat: "phones", title: "iPhone 13 Pro 128GB - Certified", brand: "APPLE REFURB", price: 589, old: 799, badge: "hot", badgeText: "HOT", stock: "12 in stock", img: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500", dateAdded: "2026-08-01", condition: "refurbished", inStock: true, description: "Certified refurbished iPhone 13 Pro with 128GB storage. Fully board-level inspected by our microsoldering lab, battery health verified above 85%, and cosmetically graded before listing. Includes original-spec charging cable and a 6-month NoveaTech warranty." },
  { id: 2, cat: "laptops", title: "Dell XPS 13 9310 i7/16GB/512GB", brand: "DELL • NEW", price: 899, old: 1199, badge: "new", badgeText: "NEW ARRIVAL", stock: "5 in stock", img: "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=500", dateAdded: "2026-08-02", condition: "new", inStock: true, description: "Brand-new, sealed-box Dell XPS 13 9310 — 11th Gen Intel Core i7, 16GB RAM, 512GB NVMe SSD, 13.4\" FHD+ InfinityEdge display. Ships with full manufacturer warranty plus our standard 6-month NoveaTech coverage on top." },
  { id: 3, cat: "accessories", title: "Anker PowerCore 20000 PD Power Bank", brand: "ACCESSORY", price: 49, old: 69, badge: "new", badgeText: "TOP SELLER", stock: "30+ in stock", img: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=500", dateAdded: "2026-07-28", condition: "new", inStock: true, description: "20,000mAh power bank with 18W USB-C Power Delivery, dual USB-A outputs, and pass-through charging. Enough capacity for 3-4 full phone charges." },
  { id: 4, cat: "components", title: "Samsung 970 EVO Plus 1TB NVMe SSD", brand: "COMPONENT", price: 89, old: 119, badge: "hot", badgeText: "LOW STOCK", stock: "4 left", img: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=500", dateAdded: "2026-07-20", condition: "new", inStock: true, description: "Genuine Samsung 970 EVO Plus, 1TB, NVMe M.2 PCIe Gen3 x4. Sequential read/write up to 3,500/3,300 MB/s. Great drop-in upgrade for laptops and desktops." },
  { id: 5, cat: "phones", title: "Samsung Galaxy S22 Ultra 256GB", brand: "SAMSUNG", price: 629, old: 899, badge: "new", badgeText: "CERTIFIED", stock: "8 in stock", img: "https://images.unsplash.com/photo-1610945264803-c22b62d2a7b3?w=500", dateAdded: "2026-08-03", condition: "refurbished", inStock: true, description: "Certified refurbished Galaxy S22 Ultra with 256GB storage. Every unit passes our full diagnostic checklist — display, cameras, S Pen, battery health and board-level microsoldering inspection — before it's listed. Includes board report and 6-month warranty." },
  { id: 6, cat: "tools", title: "Microsoldering Starter Kit", brand: "NOVEATECH LAB", price: 149, old: 189, badge: "new", badgeText: "LAB PICK", stock: "15 in stock", img: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=500", dateAdded: "2026-07-15", condition: "new", inStock: true, description: "Everything you need to start board-level repair: hot air station, soldering iron, flux, wick, tweezer set and a practice board. Curated by our own repair lab technicians." },
];

// data source currently in use: 'api' | 'json' | 'embedded'
let dataMode = 'api';
// full local cache used only in 'json' / 'embedded' modes (client-side filtering)
let localProductsCache = null;
// every product we've ever rendered, indexed by id — populated on every
// render regardless of data source, so addToCart never has to guess.
const productIndex = new Map();

let currentPage = 1;
let activeCat = 'all';
let activePriceRange = 'all'; // 'all' | 'under100' | '100-500' | '500plus'
let cart = JSON.parse(localStorage.getItem('novea_cart') || '[]');

const grid = document.getElementById('productsGrid');
const paginationEl = document.getElementById('pagination');
const resultsInfoEl = document.getElementById('resultsInfo');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const priceRadios = document.querySelectorAll('input[name="price"]');
const conditionCheckboxes = document.querySelectorAll('input[name="condition"]');
const inStockCheckbox = document.getElementById('inStockOnly');

// Shared logic so the API-mode filter and the local fallback filter
// (Section 2/3 below) apply the exact same rule.
function matchesPriceRange(price, range) {
  if (range === 'under100') return price < 100;
  if (range === '100-500') return price >= 100 && price <= 500;
  if (range === '500plus') return price > 500;
  return true; // 'all'
}

// Reads the checkbox DOM live rather than caching state, so it's always
// in sync with whatever the user last clicked.
function getActiveConditions() {
  return [...conditionCheckboxes].filter(cb => cb.checked).map(cb => cb.value);
}
function getInStockOnly() {
  return inStockCheckbox.checked;
}

// ---- file:// guard -----------------------------------------------------
// fetch() to local files/relative APIs is blocked or unreliable under
// file://, which is the #1 cause of an infinite "Loading..." screen.
if (window.location.protocol === 'file:') {
  document.addEventListener('DOMContentLoaded', () => {
    grid.innerHTML = `
      <div style="grid-column:1/-1; padding:50px 30px; text-align:center; border:1px solid #FF3B30; border-radius:16px; background:rgba(255,59,48,.08);">
        <div style="font-size:32px; margin-bottom:10px;">⚠️</div>
        <h3 style="color:#FF3B30; margin-bottom:10px;">This page must be served over HTTP</h3>
        <p style="color:var(--muted); max-width:480px; margin:0 auto; line-height:1.6;">
          You opened this file directly (file://). Browsers block API/JSON requests from local files.
          Run <code>python3 api_server.py</code> in this folder, then open
          <strong>http://localhost:3000/shop.html</strong> instead.
        </p>
      </div>`;
    resultsInfoEl.textContent = 'Not running on a server';
  });
  throw new Error('shop.js halted: page opened via file:// — see on-screen instructions.');
}

// 1. FETCH A PAGE (API first, then products.json, then embedded fallback)
async function fetchPage(page) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(CONFIG.ITEMS_PER_PAGE),
    cat: activeCat,
    q: searchInput.value.trim(),
    sort: sortSelect.value,
    price: activePriceRange,
    condition: getActiveConditions().join(','), // e.g. "new,refurbished", or "" if none checked
    inStock: String(getInStockOnly()),
  });

  // --- Level 1: real API ---
  try {
    const res = await fetch(`${CONFIG.API_URL}?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`API responded ${res.status}`);
    const data = await res.json();
    dataMode = 'api';
    return data; // { products, total, page, totalPages, limit, hasNext, hasPrev }
  } catch (err) {
    console.warn('[shop] API unavailable, falling back to products.json:', err.message);
  }

  // --- Level 2: products.json directly (e.g. VS Code Live Server, no API running) ---
  try {
    if (!localProductsCache || dataMode !== 'json') {
      const res = await fetch(CONFIG.JSON_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`products.json responded ${res.status}`);
      localProductsCache = await res.json();
    }
    dataMode = 'json';
    return paginateLocally(localProductsCache, page);
  } catch (err) {
    console.warn('[shop] products.json unavailable, using embedded fallback:', err.message);
  }

  // --- Level 3: embedded fallback array, always works ---
  dataMode = 'embedded';
  localProductsCache = EMBEDDED_FALLBACK;
  return paginateLocally(localProductsCache, page);
}

// Client-side filter + sort + paginate, used for levels 2 & 3
function paginateLocally(allProducts, page) {
  let list = [...allProducts];

  if (activeCat !== 'all') list = list.filter(p => p.cat === activeCat);

  if (activePriceRange !== 'all') {
    list = list.filter(p => matchesPriceRange(p.price, activePriceRange));
  }

  const activeConditions = getActiveConditions();
  // If every box is unchecked, real filters show zero results — not "show all".
  // Products with no `condition` field at all (older data) default to 'new'
  // so they don't just vanish.
  list = list.filter(p => activeConditions.includes(p.condition || 'new'));

  if (getInStockOnly()) {
    list = list.filter(p => p.inStock !== false);
  }

  const q = searchInput.value.toLowerCase().trim();
  if (q) {
    list = list.filter(p => (p.title + ' ' + p.brand + ' ' + p.cat).toLowerCase().includes(q));
  }

  const sort = sortSelect.value;
  if (sort === 'low') list.sort((a, b) => a.price - b.price);
  else if (sort === 'high') list.sort((a, b) => b.price - a.price);
  else if (sort === 'new') list.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
  else list.sort((a, b) => a.id - b.id);

  const total = list.length;
  const limit = CONFIG.ITEMS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  page = Math.min(Math.max(1, page), totalPages);

  const start = (page - 1) * limit;
  const pageItems = list.slice(start, start + limit);

  return {
    products: pageItems,
    total,
    page,
    totalPages,
    limit,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

// 2. LOAD + RENDER A PAGE
async function loadPage(page) {
  grid.innerHTML = `<div style="grid-column:1/-1; padding:60px; text-align:center; color:var(--muted)">Loading inventory...</div>`;
  paginationEl.innerHTML = '';

  const data = await fetchPage(page);
  currentPage = data.page;
  renderProducts(data);
}

function renderProducts(data) {
  const { products, total, page, totalPages, limit } = data;

  if (total === 0) {
    const q = searchInput.value.trim();
    const notFoundMsg = q
      ? `"${q}" not found. Try different filters or <a href="http://localhost:3000/index.html/#contact">Chat to Source It.</a>`
      : `No products found. Try different filters or <a href="http://localhost:3000/index.html/#contact">Chat to Source It.</a>`;
    grid.innerHTML = `<div style="grid-column:1/-1; padding:60px; text-align:center; color:var(--muted)">${notFoundMsg}</div>`;
    paginationEl.innerHTML = '';
    resultsInfoEl.textContent = '0 results';
    return;
  }

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  resultsInfoEl.textContent = `Showing ${start}-${end} of ${total} products • Page ${page} of ${totalPages}`;

  // If we've fallen all the way to the embedded fallback, both the real
  // API and products.json are unreachable — this is showing 6 hardcoded
  // demo products as if they were real inventory. That should never be
  // silent: a customer could "order" something that doesn't exist.
  const existingWarning = document.getElementById('dataFallbackWarning');
  if (dataMode === 'embedded') {
    if (!existingWarning) {
      const warning = document.createElement('div');
      warning.id = 'dataFallbackWarning';
      warning.className = 'data-fallback-warning';
      warning.innerHTML = `⚠️ <strong>Showing demo inventory.</strong> The live product feed is unreachable — prices and stock below are placeholders, not real.`;
      grid.parentElement.insertBefore(warning, grid);
    }
    console.error('[shop] Both the API and products.json are unreachable — showing embedded demo data, not real inventory.');
  } else if (existingWarning) {
    existingWarning.remove();
  }

  // Index every product on this page — this is what addToCart reads
  // from, regardless of whether it came from the API, products.json,
  // or the embedded fallback. Scraping prices back out of card HTML
  // was fragile (breaks on markup changes, breaks on comma-formatted
  // prices) and was actually the *default* path in production since
  // the API tier never populated localProductsCache.
  products.forEach(p => productIndex.set(p.id, p));

  grid.innerHTML = products.map(p => {
    const hasDescription = Boolean(p.description);
    const desc = hasDescription
      ? p.description
      : 'Full details for this item aren\'t listed yet — message us on WhatsApp and we\'ll send the complete spec sheet.';
    const waMessage = encodeURIComponent(`Hi! Can you send me the full details for: ${p.title}?`);
    const waButton = !hasDescription
      ? `<a class="wa-detail-btn" href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${waMessage}" target="_blank" rel="noopener">🟢 Ask on WhatsApp</a>`
      : '';
    return `
    <div class="product-card flippable" data-id="${p.id}">
      <div class="flip-inner">
        <div class="flip-front">
          <div class="product-thumb">
            <span class="badge ${p.badge}">${p.badgeText}</span>
            <span class="badge stock">${p.stock}</span>
            <img src="${p.img}" alt="${p.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/300?text=No+Image'">
            <span class="flip-hint">ℹ️ Tap for details</span>
          </div>
          <div class="product-info">
            <div class="product-cat">${p.brand}</div>
            <div class="product-title">${p.title}</div>
            <div class="product-meta">
              <div class="price">$${p.price} <small>$${p.old}</small></div>
              <button class="add-btn" data-id="${p.id}">Add</button>
            </div>
          </div>
        </div>
        <div class="flip-back">
          <button class="flip-close" aria-label="Close details">✕</button>
          <span class="badge ${p.badge} flip-back-badge">${p.badgeText}</span>
          <h4 class="flip-back-title">${p.title}</h4>
          <div class="flip-back-cat">${p.brand}</div>
          <p class="flip-back-desc">${desc}</p>
          ${waButton}
          <div class="flip-back-footer">
            <div class="price">$${p.price} <small>$${p.old}</small></div>
            <button class="add-btn" data-id="${p.id}">Add</button>
          </div>
        </div>
      </div>
    </div>
  `;
  }).join('');

  document.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      addToCart(Number(btn.dataset.id));
    });
  });

  document.querySelectorAll('.product-card.flippable').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.add-btn')) return;
      if (e.target.closest('.wa-detail-btn')) return;
      if (e.target.closest('.flip-close')) {
        card.classList.remove('flipped');
        return;
      }
      card.classList.toggle('flipped');
    });
  });

  renderPagination(page, totalPages);

  const layout = document.querySelector('.shop-layout');
  if (layout) window.scrollTo({ top: layout.offsetTop - 100, behavior: 'smooth' });
}

// 3. AMAZON-STYLE PAGINATION UI
function renderPagination(page, totalPages) {
  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }

  const pages = getPaginationNumbers(page, totalPages);

  let html = `
    <button class="page-btn prev ${page === 1 ? 'disabled' : ''}" ${page === 1 ? 'disabled' : ''} data-page="${page - 1}">
      ← Previous
    </button>
    <div class="page-numbers">
  `;

  pages.forEach(p => {
    if (p === '...') {
      html += `<span class="page-ellipsis">...</span>`;
    } else {
      html += `<button class="page-btn number ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
  });

  html += `</div>
    <button class="page-btn next ${page === totalPages ? 'disabled' : ''}" ${page === totalPages ? 'disabled' : ''} data-page="${page + 1}">
      Next →
    </button>
  `;

  paginationEl.innerHTML = html;

  paginationEl.querySelectorAll('.page-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = Number(btn.dataset.page);
      if (p >= 1 && p <= totalPages) loadPage(p);
    });
  });
}

// Amazon algorithm: 1 ... 4 5 [6] 7 8 ... 20
function getPaginationNumbers(current, total) {
  const delta = 1;
  const range = [];
  const rangeWithDots = [];
  let l;

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      range.push(i);
    }
  }

  for (const i of range) {
    if (l) {
      if (i - l === 2) rangeWithDots.push(l + 1);
      else if (i - l !== 1) rangeWithDots.push('...');
    }
    rangeWithDots.push(i);
    l = i;
  }

  return rangeWithDots;
}

// ---- CART (unchanged behaviour, localStorage-backed) -------------------
function addToCart(id) {

  let p = productIndex.get(id);

  if (!p) {
    // Genuine last resort — should only ever trigger if a product was
    // never rendered through renderProducts (shouldn't happen in
    // normal use, since the Add button only exists on rendered cards).
    console.warn(`[shop] Product ${id} missing from productIndex — falling back to DOM scrape.`);
    const card = [...document.querySelectorAll('.add-btn')].find(b => Number(b.dataset.id) === id);
    if (!card) {
      alert("Error: Could not find the product card in the HTML.");
      return;
    }
    const cardEl = card.closest('.product-card');
    const priceText = cardEl.querySelector('.price')?.firstChild?.textContent || '';
    p = {
      id,
      title: cardEl.querySelector('.product-title')?.textContent || 'Unknown item',
      price: Number(priceText.replace(/[^0-9.]/g, '')) || 0,
      img: cardEl.querySelector('img')?.src || '',
    };
  }
  const found = cart.find(x => x.id === id);
  if (found) found.qty++;
  else cart.push({ ...p, qty: 1 });
  
  saveCart();
  
  // 3. THIS IS THE FINAL STEP
  showToast('Item added to cart!');
}

function saveCart() {
  localStorage.setItem('novea_cart', JSON.stringify(cart));
  updateCartUI();
}

function updateCartUI() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const cartCountEl = document.getElementById('cartCount');
  if (cartCountEl) cartCountEl.textContent = count;
  document.getElementById('navCartCount').textContent = count;
  document.getElementById('drawerCount').textContent = `(${count})`;
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById('cartSubtotal').textContent = `$${subtotal.toFixed(2)}`;

  const clearBtn = document.getElementById('clearCartBtn');
  clearBtn.style.display = cart.length ? 'inline-flex' : 'none';

  const itemsEl = document.getElementById('cartItems');
  if (cart.length === 0) {
    itemsEl.innerHTML = `
      <div class="cart-empty">
        <p class="cart-empty-icon">🛒</p>
        <p class="cart-empty-title">Your cart is empty</p>
        <small>Products you add will show up here</small>
      </div>`;
    return;
  }

  itemsEl.innerHTML = cart.map(i => `
    <div class="cart-item">
      <img src="${i.img}" alt="${i.title}">
      <div class="cart-item-info">
        <h5>${i.title}</h5>
        <p class="cart-item-price">$${i.price.toFixed(2)} <span>each</span></p>
        <div class="qty-stepper">
          <button class="qty-btn qty-minus" data-id="${i.id}" aria-label="Decrease quantity">−</button>
          <input type="number" class="qty-input" min="1" step="1" value="${i.qty}" data-id="${i.id}" aria-label="Quantity" inputmode="numeric">
          <button class="qty-btn qty-plus" data-id="${i.id}" aria-label="Increase quantity">+</button>
        </div>
      </div>
      <div class="cart-item-side">
        <span class="cart-item-subtotal">$${(i.price * i.qty).toFixed(2)}</span>
        <button class="remove-btn" data-id="${i.id}" aria-label="Remove item" title="Remove item">🗑</button>
      </div>
    </div>
  `).join('');

  itemsEl.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(Number(btn.dataset.id)));
  });
  itemsEl.querySelectorAll('.qty-minus').forEach(btn => {
    btn.addEventListener('click', () => changeQty(Number(btn.dataset.id), -1));
  });
  itemsEl.querySelectorAll('.qty-plus').forEach(btn => {
    btn.addEventListener('click', () => changeQty(Number(btn.dataset.id), 1));
  });
  itemsEl.querySelectorAll('.qty-input').forEach(input => {
    input.addEventListener('change', () => setQty(Number(input.dataset.id), Number(input.value)));
  });
}

function changeQty(id, delta) {
  const item = cart.find(x => x.id === id);
  if (!item) return;
  setQty(id, item.qty + delta);
}

function setQty(id, qty) {
  qty = Math.floor(Number(qty));
  const item = cart.find(x => x.id === id);
  if (!item) return;
  if (!qty || qty <= 0) {
    removeFromCart(id);
    return;
  }
  item.qty = qty;
  saveCart();
}

function removeFromCart(id) {
  cart = cart.filter(x => x.id !== id);
  saveCart();
}

function clearCart() {
  if (cart.length === 0) return;
  if (!confirm('Remove all items from your cart?')) return;
  cart = [];
  saveCart();
}

function openCart() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
}
function closeCart() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
}

// ---- EVENTS --------------------------------------------------------

document.getElementById('openCartTop').addEventListener('click', (e) => { e.preventDefault(); openCart(); });

// ---- FLOATING SEARCH (bottom-right button) --------------------------
const searchFab = document.getElementById('searchFab');
const floatingSearch = document.getElementById('floatingSearch');
const floatingSearchInput = document.getElementById('floatingSearchInput');
const floatingSearchClose = document.getElementById('floatingSearchClose');
const floatingPriceSelect = document.getElementById('floatingPriceSelect');

// keep the sidebar price radios (source of truth for activePriceRange) in sync
function setPriceRange(value) {
  activePriceRange = value;
  priceRadios.forEach(radio => { radio.checked = (radio.value === value); });
  floatingPriceSelect.value = value;
}

function openFloatingSearch() {
  floatingSearch.classList.add('open');
  searchFab.classList.add('active');
  searchFab.setAttribute('aria-expanded', 'true');
  floatingSearchInput.value = searchInput.value;
  floatingPriceSelect.value = activePriceRange;
  // focus + activate cursor after the open transition starts
  requestAnimationFrame(() => floatingSearchInput.focus());
}

function closeFloatingSearch() {
  floatingSearch.classList.remove('open');
  searchFab.classList.remove('active');
  searchFab.setAttribute('aria-expanded', 'false');

  // reset search + price state so the catalogue goes back to default
  const hadQuery = floatingSearchInput.value.trim() !== '' || searchInput.value.trim() !== '';
  const hadPriceFilter = activePriceRange !== 'all';
  floatingSearchInput.value = '';
  searchInput.value = '';
  clearTimeout(floatingSearchDebounce);
  if (hadPriceFilter) setPriceRange('all');
  if (hadQuery || hadPriceFilter) loadPage(1);
}

searchFab.addEventListener('click', () => {
  if (floatingSearch.classList.contains('open')) closeFloatingSearch();
  else openFloatingSearch();
});

floatingSearchClose.addEventListener('click', closeFloatingSearch);

floatingPriceSelect.addEventListener('change', () => {
  setPriceRange(floatingPriceSelect.value);
  loadPage(1);
});

document.addEventListener('click', (e) => {
  if (!floatingSearch.classList.contains('open')) return;
  if (floatingSearch.contains(e.target) || e.target === searchFab) return;
  closeFloatingSearch();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && floatingSearch.classList.contains('open')) closeFloatingSearch();
});

let floatingSearchDebounce;
floatingSearchInput.addEventListener('input', () => {
  // mirror into the main search box so all existing filter logic (API + local) stays in sync
  searchInput.value = floatingSearchInput.value;
  clearTimeout(floatingSearchDebounce);
  floatingSearchDebounce = setTimeout(() => loadPage(1), 250);
});
document.getElementById('closeCart').addEventListener('click', closeCart);
document.getElementById('cartOverlay').addEventListener('click', closeCart);
document.getElementById('clearCartBtn').addEventListener('click', clearCart);

document.querySelectorAll('.cat-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCat = btn.dataset.cat;
    loadPage(1);
  });
});

// ---- FOOTER "SHOP" LINKS — reuse the real category filter -----------
document.querySelectorAll('.footer-cat-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const cat = link.dataset.cat;
    activeCat = cat;
    document.querySelectorAll('.cat-pill').forEach(b => {
      b.classList.toggle('active', b.dataset.cat === cat);
    });
    loadPage(1);
    document.querySelector('.shop-controls')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// ---- FOOTER "HELP" / LEGAL LINKS — these pages don't exist yet. -----
// Rather than leave them as dead href="#" links that silently do
// nothing (which just looks broken), be upfront about it and offer a
// real way to get the answer in the meantime.
const FOOTER_STUB_COPY = {
  "Shipping & Returns": "Full shipping and returns terms aren't published yet. Ask us directly and we'll confirm timelines for your order.",
  "Warranty Policy": "The detailed warranty policy page isn't live yet. Every item still ships with the 6-month warranty shown on the shop page — message us for the specifics.",
  "Track Order": "Order tracking isn't automated yet. Send us your order ID on WhatsApp and we'll give you a status update directly.",
  "FAQs": "We haven't published an FAQ page yet. Ask your question directly and we'll answer it right away.",
  "Privacy Policy": "A formal privacy policy hasn't been published yet.",
  "Terms of Service": "Formal terms of service haven't been published yet.",
};

const footerModalOverlay = document.getElementById('footerModalOverlay');
const footerModalTitle = document.getElementById('footerModalTitle');
const footerModalBody = document.getElementById('footerModalBody');

function openFooterModal(topic) {
  footerModalTitle.textContent = topic;
  footerModalBody.textContent = FOOTER_STUB_COPY[topic] || "This page hasn't been published yet.";
  footerModalOverlay.classList.add('open');
}

function closeFooterModal() {
  footerModalOverlay.classList.remove('open');
}

document.querySelectorAll('.footer-stub-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    openFooterModal(link.dataset.topic);
  });
});

document.getElementById('footerModalClose')?.addEventListener('click', closeFooterModal);
footerModalOverlay?.addEventListener('click', (e) => {
  if (e.target === footerModalOverlay) closeFooterModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && footerModalOverlay?.classList.contains('open')) closeFooterModal();
});

let searchDebounce;
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadPage(1), 250);
});
sortSelect.addEventListener('change', () => loadPage(1));

priceRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    activePriceRange = radio.value;
    loadPage(1);
  });
});

conditionCheckboxes.forEach(cb => {
  cb.addEventListener('change', () => loadPage(1));
});

inStockCheckbox.addEventListener('change', () => loadPage(1));

// Base URL of invoice_server.py — change this to your real domain once deployed
// (e.g. "https://api.noveatech.org"). Leave as-is for local development.
const INVOICE_API_BASE = "http://localhost:5000";

// ---- CHECKOUT LOADING TAB -------------------------------------------
// window.open('', '_blank') hands back a blank, white about:blank tab
// by default — jarring against a dark site, and it just sits there
// while we generate the invoice in the background. We immediately
// document.write a themed loading page into that tab instead, so the
// customer sees "something is happening" in THE HUT's own colors,
// then we navigate that same tab to WhatsApp once we're ready.
// Self-contained (own <style>, own Google Fonts link) because it's a
// separate document that can't see shop.css.
function buildInvoiceLoadingHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Preparing your order — THE HUT</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#050505; --blue:#00A8FF; --cyan:#00E5FF;
    --gradient:linear-gradient(135deg,var(--blue),var(--cyan));
    --text:#F5F7FA; --muted:#8B96A8; --border:rgba(255,255,255,.08);
  }
  *{box-sizing:border-box;}
  html,body{height:100%;}
  body{
    margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    padding:24px; font-family:'Inter',-apple-system,sans-serif; color:var(--text);
    background:
      radial-gradient(circle at 18% 20%, rgba(0,102,255,.28), transparent 40%),
      radial-gradient(circle at 85% 15%, rgba(0,229,255,.20), transparent 38%),
      var(--bg);
  }
  .card{
    width:100%; max-width:380px; text-align:center;
    background:rgba(255,255,255,.03);
    border:1px solid var(--border);
    border-radius:24px;
    padding:44px 32px 36px;
    box-shadow:0 30px 70px rgba(0,0,0,.6);
  }
  .ring-wrap{ width:84px; height:84px; margin:0 auto 26px; position:relative; }
  .ring{
    position:absolute; inset:0; border-radius:50%;
    background:conic-gradient(from 0deg,var(--blue),var(--cyan),var(--blue));
    -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 7px),#000 calc(100% - 7px));
            mask:radial-gradient(farthest-side,transparent calc(100% - 7px),#000 calc(100% - 7px));
    animation:spin 1.1s linear infinite;
  }
  .ring-mono{
    position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    font-weight:800; font-size:15px; letter-spacing:.5px; color:#fff;
  }
  @keyframes spin{ to{ transform:rotate(360deg); } }
  .wordmark{ font-weight:800; font-size:22px; letter-spacing:.5px; margin:0 0 6px; }
  .kicker{ display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:18px; }
  .kicker .dot{
    width:7px; height:7px; border-radius:50%; background:var(--cyan);
    box-shadow:0 0 10px var(--cyan); animation:pulse 1.6s infinite;
  }
  @keyframes pulse{ 0%,100%{opacity:1;} 50%{opacity:.35;} }
  .kicker span{ font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:var(--muted); }
  #status{ font-size:14.5px; min-height:20px; margin-bottom:22px; transition:opacity .2s ease; }
  .bar{ height:4px; border-radius:4px; background:rgba(255,255,255,.08); overflow:hidden; margin-bottom:20px; }
  .bar::after{
    content:""; display:block; height:100%; width:40%; border-radius:4px;
    background:var(--gradient); animation:sweep 1.3s ease-in-out infinite;
  }
  @keyframes sweep{ 0%{ transform:translateX(-120%); } 100%{ transform:translateX(360%); } }
  .fine{ font-size:11.5px; color:var(--muted); line-height:1.5; }
  @media (prefers-reduced-motion: reduce){
    .ring, .kicker .dot, .bar::after{ animation:none !important; }
  }
</style>
</head>
<body>
  <div class="card">
    <div class="ring-wrap">
      <div class="ring"></div>
      <div class="ring-mono">TH</div>
    </div>
    <p class="wordmark">THE HUT</p>
    <div class="kicker"><span class="dot"></span><span>Securely preparing order</span></div>
    <p id="status">Preparing your invoice…</p>
    <div class="bar"></div>
    <p class="fine">You'll be redirected to WhatsApp automatically —<br>keep this tab open.</p>
  </div>
</body>
</html>`;
}

// ---- INVOICE READY PAGE ----------------------------------------------
// Shown in the same tab once the invoice image has actually rendered.
// Instead of silently auto-downloading the image and auto-redirecting to
// WhatsApp (the old behaviour — easy to miss, and gives the customer no
// chance to double check the invoice first), we stop here and let them
// look at it, then explicitly choose what happens next.
function buildInvoiceReadyHTML(imgSrc, waUrl, orderId) {
  // Escape the one string we interpolate into an HTML attribute that
  // isn't already a controlled URL, to keep this self-contained document
  // safe to write even if an order id ever contains odd characters.
  const safeOrderId = String(orderId).replace(/[^A-Za-z0-9_-]/g, '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your invoice — THE HUT</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#050505; --blue:#00A8FF; --cyan:#00E5FF; --wa:#25D366; --wa-dark:#1DA851;
    --gradient:linear-gradient(135deg,var(--blue),var(--cyan));
    --text:#F5F7FA; --muted:#8B96A8; --border:rgba(255,255,255,.08);
  }
  *{box-sizing:border-box;}
  html,body{height:100%;}
  body{
    margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    padding:24px; font-family:'Inter',-apple-system,sans-serif; color:var(--text);
    background:
      radial-gradient(circle at 18% 20%, rgba(0,102,255,.28), transparent 40%),
      radial-gradient(circle at 85% 15%, rgba(0,229,255,.20), transparent 38%),
      var(--bg);
  }
  .card{
    width:100%; max-width:440px; text-align:center;
    background:rgba(255,255,255,.03);
    border:1px solid var(--border);
    border-radius:24px;
    padding:32px 28px 30px;
    box-shadow:0 30px 70px rgba(0,0,0,.6);
  }
  .wordmark{ font-weight:800; font-size:20px; letter-spacing:.5px; margin:0 0 4px; }
  .subtitle{ font-size:13px; color:var(--muted); margin:0 0 20px; }
  .invoice-frame{
    border:1px solid var(--border); border-radius:16px; overflow:hidden;
    background:#0c0c0c; margin-bottom:22px; max-height:56vh; overflow-y:auto;
  }
  .invoice-frame img{ display:block; width:100%; height:auto; }
  .btn-col{ display:flex; flex-direction:column; gap:10px; }
  button.action{
    font-family:inherit; font-size:14.5px; font-weight:700; letter-spacing:.2px;
    border-radius:12px; padding:14px 18px; cursor:pointer; border:1px solid transparent;
    display:flex; align-items:center; justify-content:center; gap:8px;
    transition:transform .12s ease, opacity .12s ease;
  }
  button.action:active{ transform:scale(.98); }
  .btn-save{
    background:rgba(255,255,255,.06); color:var(--text); border-color:var(--border);
  }
  .btn-save:hover{ background:rgba(255,255,255,.1); }
  .btn-whatsapp{
    background:linear-gradient(135deg,var(--wa),var(--wa-dark)); color:#04140a;
  }
  .btn-whatsapp:hover{ opacity:.92; }
  .btn-back{
    background:transparent; color:var(--muted); font-weight:600; font-size:13.5px; padding:10px;
  }
  .btn-back:hover{ color:var(--text); }
  .save-note{ font-size:11.5px; color:var(--muted); min-height:16px; margin-top:8px; }
  .invoice-link{ display:block; position:relative; }
  .invoice-link img{ cursor:zoom-in; transition:opacity .15s ease; }
  .invoice-link:hover img{ opacity:.88; }
  .zoom-hint{
    font-size:11.5px; color:var(--muted); margin:-14px 0 20px; display:flex;
    align-items:center; justify-content:center; gap:6px;
  }
</style>
</head>
<body>
  <div class="card">
    <p class="wordmark">THE HUT</p>
    <p class="subtitle">Invoice #${safeOrderId} is ready — review it below</p>
    <a class="invoice-link" id="invoiceLink" href="${imgSrc}" target="_blank" rel="noopener" aria-label="Open invoice full size">
      <div class="invoice-frame">
        <img id="invoiceImg" src="${imgSrc}" alt="Invoice ${safeOrderId}">
      </div>
    </a>
    <p class="zoom-hint">🔍 Tap the invoice to view full size and check your items</p>
    <div class="btn-col">
      <button class="action btn-save" id="saveInvoiceBtn">💾 Save Invoice</button>
      <button class="action btn-whatsapp" id="continueWaBtn">🟢 Continue to Checkout on WhatsApp</button>
      <button class="action btn-back" id="backToCartBtn">← Back to Cart</button>
    </div>
    <p class="save-note" id="saveNote"></p>
  </div>
<script>
  document.getElementById('saveInvoiceBtn').addEventListener('click', async () => {
    const note = document.getElementById('saveNote');
    try {
      const res = await fetch(${JSON.stringify(imgSrc)});
      if (!res.ok) throw new Error('image fetch failed: ' + res.status);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = ${JSON.stringify('NoveaTech-Invoice-' + safeOrderId + '.png')};
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      note.textContent = 'Saved to your downloads.';
    } catch (err) {
      // Cross-origin/CORS fallback — open the image directly so the
      // customer can long-press / right-click save it themselves.
      window.open(${JSON.stringify(imgSrc)}, '_blank');
      note.textContent = 'Opened the invoice in a new tab — save it from there.';
    }
  });

  document.getElementById('continueWaBtn').addEventListener('click', () => {
    window.location.href = ${JSON.stringify(waUrl)};
  });

  document.getElementById('backToCartBtn').addEventListener('click', () => {
    if (window.opener && !window.opener.closed) {
      try { window.opener.focus(); } catch (err) {}
    }
    window.close();
    // Some browsers refuse to close tabs the script didn't fully control
    // (e.g. if the user later interacted with it) — leave a clear manual fallback.
    setTimeout(() => {
      if (!window.closed) {
        document.getElementById('saveNote').textContent = 'You can close this tab and return to the shop.';
      }
    }, 300);
  });
<\/script>
</body>
</html>`;
}

document.getElementById('checkoutBtn')?.addEventListener('click', async () => {
  if (cart.length === 0) return alert('Cart is empty');

  // Open the tab synchronously, inside the click gesture, or some
  // browsers will block window.open() once we're past the first
  // await below (it stops counting as user-triggered). Paint it with
  // our themed loading page right away so it never shows blank white.
  const waTab = window.open('', '_blank');
  if (waTab) {
    waTab.document.open();
    waTab.document.write(buildInvoiceLoadingHTML());
    waTab.document.close();
  }

  // Best-effort — if the tab got popped/closed or is cross-origin for
  // any reason, just silently skip the status update.
  function setLoadingStatus(text) {
    try {
      if (waTab && !waTab.closed) {
        const el = waTab.document.getElementById('status');
        if (el) el.textContent = text;
      }
    } catch (err) { /* ignore */ }
  }

  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const orderId = `TH${Date.now().toString().slice(-6)}`;

  let message = `*THE HUT - NEW ORDER* 🛒\n`;
  message += `ID: #${orderId}\n`;
  message += `--------------------------------\n\n`;

  cart.forEach((item, index) => {
    // 1. FULL name, never truncated - bold
    message += `*${index + 1}. ${item.title}*\n`;
    
    // 2. If you have specs like size/color, it will show here
    if (item.variant || item.size || item.color) {
      const specs = item.variant || [item.size, item.color].filter(Boolean).join(' | ');
      message += `_${specs}_\n`;
    }
    
    // 3. Qty and price on second line
    message += `Qty: x${item.qty}  |  Price: $${item.price.toFixed(2)}  |  Sub: $${(item.price * item.qty).toFixed(2)}\n\n`;
  });

  message += `--------------------------------\n`;
  message += `*Total Items: ${totalQty}*\n`;
  message += `*TOTAL TO PAY: $${total.toFixed(2)}*\n\n`;
  message += `Hello TheHuT! I want to order the above.`;

  const checkoutBtn = document.getElementById('checkoutBtn');
  const originalLabel = checkoutBtn.textContent;
  checkoutBtn.disabled = true;
  checkoutBtn.textContent = 'Preparing invoice…';

  // Try to generate the branded invoice image first. WhatsApp click-to-chat
  // links can only pre-fill text, not attach a file, so once the image is
  // ready we hand the customer a review page (image + explicit actions)
  // instead of silently downloading it and redirecting them.
  setLoadingStatus('Talking to the invoice service…');
  try {
    const res = await fetch(`${INVOICE_API_BASE}/api/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: orderId,
        items: cart.map(i => ({ name: i.title, qty: i.qty, price: i.price })),
      }),
    });

    if (!res.ok) throw new Error(`Invoice server responded ${res.status}`);
    const { url } = await res.json();
    const imgUrl = `${INVOICE_API_BASE}${url}`;

    setLoadingStatus('Rendering your invoice…');
    // Confirm the image actually renders before we hand the tab over —
    // catches a 200 response with a broken/empty image early.
    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) throw new Error(`Invoice image responded ${imgRes.status}`);

    message += `\n\n📎 I've got the invoice image for this order and will attach it here.`;
    const waUrlWithInvoice = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    setLoadingStatus('Invoice ready…');
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = originalLabel;

    if (waTab && !waTab.closed) {
      waTab.document.open();
      waTab.document.write(buildInvoiceReadyHTML(imgUrl, waUrlWithInvoice, orderId));
      waTab.document.close();
    } else {
      // Popup was blocked despite our best effort — open a fresh tab with the review page.
      const fallbackTab = window.open('', '_blank');
      if (fallbackTab) {
        fallbackTab.document.open();
        fallbackTab.document.write(buildInvoiceReadyHTML(imgUrl, waUrlWithInvoice, orderId));
        fallbackTab.document.close();
      } else {
        // Nothing we can do about popups — fall back to a direct WhatsApp navigation.
        window.location.href = waUrlWithInvoice;
      }
    }
    return; // invoice-ready page handles Save / Continue / Back itself
  } catch (err) {
    // Invoice server not running / unreachable, or the image itself
    // failed — don't block checkout, just proceed with the text-only
    // order as before.
    console.warn('Invoice generation skipped:', err);
    setLoadingStatus('Continuing without an invoice image…');
  } finally {
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = originalLabel;
  }

  const waUrl = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  if (waTab) {
    // Hand the tab we've been painting off to WhatsApp — no blank
    // white flash at any point in the flow.
    waTab.location.href = waUrl;
  } else {
    // Popup was blocked despite our best effort — fall back to a normal navigation.
    window.open(waUrl, '_blank');
  }
});
// ---- INIT --------------------------------------------------------
loadPage(1);
updateCartUI();

// ---- NEWSLETTER FORM -----------------------------------------------
// NOTE: this only confirms the submission in the UI — it does not
// actually store or send the email anywhere yet. Wire this fetch() up
// to a real mailing-list endpoint (Mailchimp, Buttondown, your own
// backend, etc.) before relying on it to collect real subscribers.
document.getElementById('newsletterForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const emailInput = document.getElementById('newsletterEmail');
  const email = emailInput.value.trim();
  if (!email) return;

  // TODO: replace with a real subscribe call, e.g.:
  // fetch('/api/newsletter', { method: 'POST', body: JSON.stringify({ email }) })
  console.log('[newsletter] would subscribe:', email);

  emailInput.value = '';
  showToast("You're on the list!");
});
function showToast(message) {

  const toast = document.getElementById('cart-toast');
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}