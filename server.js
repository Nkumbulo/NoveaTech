/**
 * NoveaTech Shop — Node/Express server (same API contract as api_server.py)
 *
 * Install once:  npm init -y && npm install express
 * Run:           node server.js
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const net = require('net');

const ROOT = __dirname;
const PRODUCTS_FILE = path.join(ROOT, 'products.json');
const START_PORT = 3000;

function loadProducts() {
  try {
    const raw = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('[api] products.json missing or invalid:', e.message);
    return [];
  }
}

function matchesPriceRange(price, range) {
  if (range === 'under100') return price < 100;
  if (range === '100-500') return price >= 100 && price <= 500;
  if (range === '500plus') return price > 500;
  return true; // 'all'
}

function applyFilters(products, { cat, q, sort, price, conditions, inStockOnly }) {
  let result = [...products];

  if (cat && cat !== 'all') result = result.filter(p => p.cat === cat);

  if (price && price !== 'all') {
    result = result.filter(p => matchesPriceRange(p.price, price));
  }

  // conditions === null means "not sent" -> skip; [] (all boxes unchecked) -> zero results
  // A product with no `condition` field defaults to 'new' rather than vanishing.
  if (conditions !== null) {
    result = result.filter(p => conditions.includes(p.condition || 'new'));
  }

  if (inStockOnly) {
    result = result.filter(p => p.inStock !== false);
  }

  if (q) {
    const qLower = q.toLowerCase();
    result = result.filter(p =>
      `${p.title} ${p.brand} ${p.cat}`.toLowerCase().includes(qLower)
    );
  }

  if (sort === 'low') result.sort((a, b) => a.price - b.price);
  else if (sort === 'high') result.sort((a, b) => b.price - a.price);
  else if (sort === 'new') result.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
  else result.sort((a, b) => a.id - b.id);

  return result;
}

function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      if (port > startPort + 50) return reject(new Error('No free port found'));
      const tester = net.createServer()
        .once('error', () => tryPort(port + 1))
        .once('listening', () => tester.once('close', () => resolve(port)).close())
        .listen(port, '0.0.0.0');
    };
    tryPort(startPort);
  });
}

const app = express();
app.use(express.static(ROOT)); // serves shop.html, js/, css/, products.json, etc.

app.get('/api/products', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 12);
    const cat = req.query.cat || 'all';
    const q = req.query.q || '';
    const sort = req.query.sort || 'featured';
    const price = req.query.price || 'all';
    const conditionParam = req.query.condition; // undefined if not sent at all
    const conditions = conditionParam !== undefined
      ? conditionParam.split(',').filter(Boolean)
      : null;
    const inStockOnly = (req.query.inStock ?? 'true') !== 'false';

    const all = loadProducts(); // re-read every request — edits show up on refresh
    const filtered = applyFilters(all, { cat, q, sort, price, conditions, inStockOnly });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const pageItems = filtered.slice(start, start + limit);

    res.json({
      products: pageItems,
      total,
      page: safePage,
      totalPages,
      limit,
      hasNext: safePage < totalPages,
      hasPrev: safePage > 1,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

(async () => {
  const port = await findFreePort(START_PORT);
  const products = loadProducts();
  app.listen(port, () => {
    console.log('='.repeat(60));
    console.log('  NoveaTech Shop — Node server running');
    console.log('='.repeat(60));
    console.log(`  Shop URL:   http://localhost:${port}/thehut.html`);
    console.log(`  API URL:    http://localhost:${port}/api/products`);
    console.log(`  Products:   ${products.length} loaded from products.json`);
    console.log('='.repeat(60));
  });
})();
