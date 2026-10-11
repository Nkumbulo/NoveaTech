#!/usr/bin/env python3
"""
NoveaTech Shop — local dev server (Python, no npm required)

- Serves the static site (shop.html, js/, css/, etc.) from this folder
- Serves a real REST API at /api/products that reads products.json
  fresh on every request — edit products.json, refresh the browser,
  no restart needed
- Auto-finds a free port starting at 3000 if that port is busy

Run:
    python3 api_server.py
Then open the URL it prints (something like http://localhost:3000/shop.html)
"""

import json
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PRODUCTS_FILE = ROOT / "products.json"
START_PORT = 3000
MAX_PORT_ATTEMPTS = 50


def find_free_port(start_port: int) -> int:
    for port in range(start_port, start_port + MAX_PORT_ATTEMPTS):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("0.0.0.0", port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"No free port found in range {start_port}-{start_port + MAX_PORT_ATTEMPTS}")


def load_products():
    """Reads products.json fresh every call, so edits show up on refresh."""
    if not PRODUCTS_FILE.exists():
        return []
    try:
        raw = PRODUCTS_FILE.read_text(encoding="utf-8")
        data = json.loads(raw)
        if not isinstance(data, list):
            return []
        return data
    except json.JSONDecodeError as e:
        print(f"[api] WARNING: products.json is not valid JSON: {e}")
        return []


def matches_price_range(price, price_range):
    if price_range == "under100":
        return price < 100
    if price_range == "100-500":
        return 100 <= price <= 500
    if price_range == "500plus":
        return price > 500
    return True  # 'all'


def apply_filters(products, cat, q, sort, price_range="all", conditions=None, in_stock_only=True):
    result = list(products)

    if cat and cat != "all":
        result = [p for p in result if p.get("cat") == cat]

    if price_range and price_range != "all":
        result = [p for p in result if matches_price_range(p.get("price", 0), price_range)]

    # conditions=None means "param not sent" -> don't filter (used by non-shop callers).
    # conditions=[] (all boxes unchecked in the UI) correctly yields zero results.
    # A product with no `condition` field at all (older data) defaults to 'new'
    # rather than silently failing every filter.
    if conditions is not None:
        result = [p for p in result if p.get("condition", "new") in conditions]

    if in_stock_only:
        result = [p for p in result if p.get("inStock", True) is not False]

    if q:
        q_lower = q.lower()
        result = [
            p for p in result
            if q_lower in f"{p.get('title','')} {p.get('brand','')} {p.get('cat','')}".lower()
        ]

    if sort == "low":
        result.sort(key=lambda p: p.get("price", 0))
    elif sort == "high":
        result.sort(key=lambda p: p.get("price", 0), reverse=True)
    elif sort == "new":
        result.sort(key=lambda p: p.get("dateAdded", ""), reverse=True)
    else:  # featured / default
        result.sort(key=lambda p: p.get("id", 0))

    return result


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[{self.address_string()}] {fmt % args}")

    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        # CORS so this also works if the frontend is ever served from elsewhere
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/products":
            return self.handle_products(parsed)

        # Everything else: serve as a static file from ROOT
        return self.serve_static(parsed)

    # ---- API ----
    def handle_products(self, parsed):
        try:
            qs = parse_qs(parsed.query, keep_blank_values=True)
            page = max(1, int(qs.get("page", ["1"])[0]))
            limit = max(1, int(qs.get("limit", ["12"])[0]))
            cat = qs.get("cat", ["all"])[0]
            q = qs.get("q", [""])[0]
            sort = qs.get("sort", ["featured"])[0]
            price_range = qs.get("price", ["all"])[0]
            condition_param = qs.get("condition", [None])[0]
            conditions = [c for c in condition_param.split(",") if c] if condition_param is not None else None
            in_stock_only = qs.get("inStock", ["true"])[0].lower() != "false"

            all_products = load_products()
            filtered = apply_filters(all_products, cat, q, sort, price_range, conditions, in_stock_only)

            total = len(filtered)
            total_pages = max(1, (total + limit - 1) // limit)
            page = min(page, total_pages)

            start = (page - 1) * limit
            end = start + limit
            page_items = filtered[start:end]

            self._send_json({
                "products": page_items,
                "total": total,
                "page": page,
                "totalPages": total_pages,
                "limit": limit,
                "hasNext": page < total_pages,
                "hasPrev": page > 1,
            })
        except Exception as e:
            self._send_json({"error": str(e)}, status=500)

    # ---- static files ----
    def serve_static(self, parsed):
        rel_path = parsed.path.lstrip("/")
        if rel_path == "":
            rel_path = "shop.html"

        file_path = (ROOT / rel_path).resolve()

        # prevent path traversal outside ROOT
        if ROOT not in file_path.parents and file_path != ROOT:
            self.send_error(403, "Forbidden")
            return

        if not file_path.exists() or file_path.is_dir():
            self.send_error(404, "File not found")
            return

        content_types = {
            ".html": "text/html; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon",
        }
        ctype = content_types.get(file_path.suffix.lower(), "application/octet-stream")

        try:
            data = file_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_error(500, str(e))


def main():
    port = find_free_port(START_PORT)
    products = load_products()

    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)

    print("=" * 60)
    print("  NoveaTech Shop — dev server running")
    print("=" * 60)
    print(f"  Shop URL:     http://localhost:{port}/thehut.html")
    print(f"  API URL:      http://localhost:{port}/api/products")
    print(f"  Products:     {len(products)} loaded from products.json")
    print("=" * 60)
    print("  Edit products.json and refresh the browser — no restart needed.")
    print("  Press Ctrl+C to stop.")
    print("=" * 60)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()
