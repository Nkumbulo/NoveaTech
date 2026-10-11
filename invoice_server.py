"""
NoveaTech — Invoice Server
============================
A small Flask API that the "Checkout on WhatsApp" button calls to
generate a branded invoice image before opening WhatsApp.

IMPORTANT — read this before you assume the button "sends" the image:
WhatsApp click-to-chat links (wa.me) can only pre-fill TEXT. There is
no way, from a plain website, to make WhatsApp auto-attach a file to
an outgoing chat — that's a platform restriction, not something this
code can work around. So the real flow is:

  1. Customer clicks "Checkout on WhatsApp"
  2. Browser POSTs the cart to this server
  3. Server generates the invoice PNG and returns a URL to it
  4. Browser auto-downloads that PNG to the customer's device
  5. Browser opens WhatsApp with the pre-filled order text
  6. Customer attaches the already-downloaded image in the chat

Run it:
    pip install flask flask-cors pillow
    python invoice_server.py
    -> serves on http://localhost:5000

Then in shop.js, INVOICE_API_BASE must point at wherever this is
hosted (localhost while developing, your real domain in production).
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime
import os
import re

from invoice_generator import generate_pictured_invoice

app = Flask(__name__)
CORS(app)  # allow the shop front-end (different origin while developing) to call this

INVOICE_DIR = os.path.join(os.path.dirname(__file__), "invoices")
os.makedirs(INVOICE_DIR, exist_ok=True)


def safe_order_id(order_id: str) -> str:
    """Prevent path traversal / weird characters from becoming a filename."""
    cleaned = re.sub(r'[^A-Za-z0-9#\-_]', '', order_id or '')
    return cleaned or f"TH{int(datetime.now().timestamp())}"


@app.route("/api/invoice", methods=["POST"])
def create_invoice():
    payload = request.get_json(silent=True) or {}

    items = payload.get("items", [])
    if not items:
        return jsonify({"error": "Cart is empty — nothing to invoice."}), 400

    # ---- Recompute totals server-side. Never trust a client-supplied
    # total — always the right call for anything money-related, even
    # here where the "payment" is just a WhatsApp handoff. ----------
    clean_items = []
    total_pay = 0.0
    total_qty = 0
    for i, raw in enumerate(items):
        try:
            qty = max(1, int(raw.get("qty", 1)))
            price = float(raw.get("price", 0))
        except (TypeError, ValueError):
            return jsonify({"error": f"Invalid qty/price on item {i + 1}."}), 400

        name = str(raw.get("name", "")).strip()
        if not name:
            return jsonify({"error": f"Item {i + 1} is missing a name."}), 400

        sub = round(qty * price, 2)
        total_pay += sub
        total_qty += qty
        clean_items.append({
            "num": str(i + 1),
            "name": name,
            "qty": str(qty),
            "price": f"{price:.2f}",
            "sub": f"{sub:.2f}",
        })

    order_id = safe_order_id(payload.get("order_id", ""))

    data = {
        "order_id": f"#{order_id}" if not order_id.startswith("#") else order_id,
        "items": clean_items,
        "total_items": str(total_qty),
        "total_pay": f"{total_pay:.2f}",
        "message": payload.get("message", "Hello TheHuT! I want to order the above."),
        "status": payload.get("status", "AWAITING CONFIRMATION"),
        "customer": payload.get("customer", ""),
    }

    filename = f"{order_id.lstrip('#')}.png"
    output_path = os.path.join(INVOICE_DIR, filename)

    try:
        generate_pictured_invoice(data, output_path=output_path)
    except Exception as exc:
        return jsonify({"error": f"Could not generate invoice: {exc}"}), 500

    return jsonify({
        "order_id": data["order_id"],
        "total_pay": data["total_pay"],
        "url": f"/invoices/{filename}",
    })


@app.route("/invoices/<path:filename>")
def serve_invoice(filename):
    return send_from_directory(INVOICE_DIR, filename)


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
