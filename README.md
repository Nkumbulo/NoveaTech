# NoveaTech Shop — Switching to a Real API

Your frontend (`shop.js`) doesn't care which server answers it, as long as
the server returns the same JSON shape at the same URL pattern. That's the
whole point of the setup you have now — swapping backends should not
require touching `shop.html` or `shop.js` except for one line.

---

## 1. The contract your frontend expects

**Request:**
```
GET /api/products?page=1&limit=12&cat=phones&q=iphone&sort=low&price=under100&condition=new,refurbished&inStock=true
```

| Param | Values | Default |
|---|---|---|
| `page` | integer, 1-based | `1` |
| `limit` | integer | `12` |
| `cat` | `all`, `phones`, `laptops`, `accessories`, `components`, `tools` | `all` |
| `q` | free text, matched against title/brand/cat | `""` |
| `sort` | `featured`, `low`, `high`, `new` | `featured` |
| `price` | `all`, `under100`, `100-500`, `500plus` | `all` |
| `condition` | comma-separated subset of `new`,`refurbished`,`openbox` — empty string means every box is unchecked and should return **zero** results, not "no filter" | not sent = no filter |
| `inStock` | `true` or `false` | `true` |

**Response (exact shape, all fields required):**
```json
{
  "products": [ { "id":1, "cat":"phones", "title":"...", "brand":"...", "price":589, "old":799, "badge":"hot", "badgeText":"...", "stock":"...", "img":"...", "dateAdded":"2026-08-01", "condition":"refurbished", "inStock":true } ],
  "total": 47,
  "page": 1,
  "totalPages": 4,
  "limit": 12,
  "hasNext": true,
  "hasPrev": false
}
```

As long as whatever you stand up returns this, `shop.js` needs **zero
changes** beyond the URL in `CONFIG.API_URL` at the top of the file.

---

## 2. Path A — Node/Express (`server.js`)

Already written, same contract, reads the same `products.json`. Good next
step if you want a real server but aren't ready for a database yet.

```bash
npm init -y
npm install express
node server.js
```

It prints the Shop URL and API URL, same as the Python version. To deploy
it somewhere permanent (Render, Railway, a VPS, etc.), just make sure the
process stays running — use `pm2` or the host's process manager, don't
rely on leaving a terminal open.

---

## 3. Path B — PHP + MySQL (`api/products.php`), for cPanel hosting

This is the one to use once you have real inventory in a database instead
of a JSON file.

**Step 1 — create the table:**
```sql
CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cat VARCHAR(30),
  title VARCHAR(255),
  brand VARCHAR(100),
  price DECIMAL(10,2),
  old_price DECIMAL(10,2),
  badge VARCHAR(20),
  badgeText VARCHAR(60),
  stock VARCHAR(60),
  img TEXT,
  dateAdded DATE,
  `condition` ENUM('new','refurbished','openbox') DEFAULT 'new',
  in_stock TINYINT(1) DEFAULT 1
);
```

**Step 2 — import your existing products** (quick one-off script, or just
insert them by hand / via phpMyAdmin's CSV import — export `products.json`
to CSV first if that's easier for you).

**Step 3 — edit `api/products.php`:**
```php
const MODE = 'mysql';   // change from 'json' to 'mysql'
```
and fill in the four variables inside `load_from_mysql()`:
```php
$host = 'localhost';
$db   = 'your_db_name';
$user = 'your_db_user';
$pass = 'your_db_password';
```
(cPanel → MySQL Databases will show you these.)

**Step 4 — upload** `api/products.php` to your host inside an `api/`
folder alongside `shop.html`.

**Step 5 — point the frontend at it.** Open `js/shop.js`, find:
```js
const CONFIG = {
  API_URL: '/api/products',
```
If your host serves `products.php` at `/api/products.php` rather than
`/api/products`, update that line to match:
```js
  API_URL: '/api/products.php',
```
(Most Apache/cPanel setups will resolve either — if in doubt, visit the
URL directly in your browser first and confirm it returns JSON.)

**Step 6 — delete `products.json` from the live server** once MySQL is
live, or just leave it — `shop.js`'s fallback chain will simply never
reach it as long as the PHP endpoint is responding.

---

## 4. Path C — Something else entirely (Supabase, a hosted API, etc.)

Same idea: build/point an endpoint that returns the exact JSON shape in
Section 1, given those five query params, then update `API_URL` in
`shop.js`. If the third-party API's shape doesn't match (e.g. Supabase's
raw REST responses won't by default), write a thin wrapper — a single
serverless function that calls Supabase, reshapes the result into the
contract above, and returns that. Don't reshape it in `shop.js` — the
frontend should stay dumb about where data comes from.

---

## 5. Checklist before you flip the switch on any of these

- [ ] Visit the API URL directly in a browser with a few query params —
      confirm it returns valid JSON matching Section 1, not an HTML error
      page or a PHP warning dumped above the JSON.
- [ ] Confirm `page`, `cat`, `q`, and `sort` all actually filter/sort —
      test each independently.
- [ ] Confirm pagination math: request `limit=5` against your real
      product count and check `totalPages` and `hasNext`/`hasPrev` are
      correct at the first and last page.
- [ ] Add cache-busting or a short cache lifetime on the endpoint if
      you're editing products often, so you're not chasing another
      "still the same" bug like the CSS one — this time from a CDN or
      browser cache in front of the API instead of a stylesheet.
- [ ] CORS: if the API ever lives on a different domain than the shop
      page, it needs `Access-Control-Allow-Origin` set (already included
      in all three server files here).

---

## 6. Quick troubleshooting

**Products stop loading after switching:** open browser dev tools →
Network tab → find the `/api/products` request → check its response.
If it's not valid JSON matching Section 1, `shop.js` will silently fall
back to reading `products.json` directly, then to the tiny embedded
fallback list — so the shop won't go blank, but it also won't show your
real inventory. That silent fallback is deliberate (it's what fixed your
original "stuck loading" bug), but it also means a broken new API can
hide in plain sight — always check Network tab after any backend switch.

**"Still the same" after a deploy:** hard refresh
(`Ctrl+Shift+R` / `Cmd+Shift+R`) before assuming the new backend is
broken — same caching gotcha as the CSS fix.
