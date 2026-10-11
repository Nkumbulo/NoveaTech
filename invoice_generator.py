"""
THE HUT — Premium Invoice Generator
====================================
Generates a high-resolution, boutique-grade invoice image.

  Brand hierarchy
  ----------------
  THE HUT     -> the storefront. Large serif wordmark, front and center.
  NoveaTech   -> the platform behind it. Present only as a faint watermark
                 and a small tracked credit line — "in the shadows".

  What changed vs. the original version
  --------------------------------------
  - Real Google Fonts: Playfair Display (serif, for the wordmark & totals)
    and Inter (for everything else). Both are variable fonts, downloaded
    once from Google's official font repo and cached in ./fonts, so the
    file is a drop-in run-anywhere script (falls back to DejaVu Sans if
    there's no network and no cached fonts available).
  - HD output: every element is drawn at 3x supersample and downsampled
    with Lanczos filtering, so curves, gradients and small type are
    genuinely anti-aliased instead of jagged. Saved at 300 DPI.
  - Gradient-filled "TOTAL TO PAY" figure, a filled gradient status pill,
    a thin gradient hairline border on the card, letter-tracked labels,
    and a soft two-layer shadow for real depth.
  - NoveaTech appears as a large, near-invisible rotated watermark behind
    the card content, plus one small tracked credit line under the
    tagline — everywhere else the document reads as pure "THE HUT".

Requirements: pip install pillow
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import re
import textwrap
import os
import urllib.request
from datetime import datetime

# ---------------------------------------------------------------------
# BRAND TOKENS
# ---------------------------------------------------------------------
DARK        = (6, 8, 12)         # near-black header/footer
BLUE        = (0, 92, 255)       # gradient start
CYAN        = (0, 220, 255)      # gradient end
PAPER       = (253, 253, 255)    # card background
INK         = (16, 19, 26)       # primary text on paper
MUTED       = (112, 119, 133)    # secondary text on paper
LINE        = (228, 231, 237)    # hairline dividers
ROW_ALT     = (247, 249, 252)    # zebra striping (very subtle)
TOTAL_BG    = (237, 248, 255)    # soft cyan wash behind the grand total
SHADOW      = (4, 8, 20)         # drop shadow color
GOLD_HAIR   = (255, 255, 255)    # card border hairline base (kept white/subtle)

PAGE_BG     = (233, 235, 241)    # backdrop the card sits on


# ---------------------------------------------------------------------
# GOOGLE FONTS — downloaded once, cached next to this script
# ---------------------------------------------------------------------
FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")

GOOGLE_FONTS = {
    "playfair":        "https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf",
    "playfair_italic": "https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay-Italic%5Bwght%5D.ttf",
    "inter":           "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf",
}
FONT_FILENAMES = {
    "playfair": "PlayfairDisplay-VF.ttf",
    "playfair_italic": "PlayfairDisplay-Italic-VF.ttf",
    "inter": "Inter-VF.ttf",
}


def _ensure_google_fonts():
    """Make sure the Google Font files exist in FONT_DIR, downloading them
    on first run. Returns a dict of local paths (value is None for any
    font that couldn't be obtained, so callers can fall back cleanly)."""
    os.makedirs(FONT_DIR, exist_ok=True)
    paths = {}
    for key, filename in FONT_FILENAMES.items():
        local_path = os.path.join(FONT_DIR, filename)
        if not os.path.exists(local_path) or os.path.getsize(local_path) < 1024:
            try:
                req = urllib.request.Request(
                    GOOGLE_FONTS[key], headers={"User-Agent": "Mozilla/5.0"}
                )
                with urllib.request.urlopen(req, timeout=8) as resp:
                    data = resp.read()
                with open(local_path, "wb") as f:
                    f.write(data)
            except Exception:
                paths[key] = None
                continue
        paths[key] = local_path
    return paths


def _variable_font(path, size, variation):
    """Load a variable-font file at `size` and select a named instance
    (e.g. 'Bold', 'SemiBold'). Falls back to the default instance if the
    named one isn't available."""
    font = ImageFont.truetype(path, size)
    try:
        font.set_variation_by_name(variation)
    except Exception:
        pass
    return font


def load_fonts(scale=1.0):
    """Build the full type ramp at a given render scale (used for the
    supersampled HD pass). Prefers Playfair Display + Inter (Google
    Fonts); falls back to bundled DejaVu if they can't be loaded."""
    def s(n):
        return max(1, round(n * scale))

    gf = _ensure_google_fonts()
    playfair = gf.get("playfair")
    playfair_i = gf.get("playfair_italic")
    inter = gf.get("inter")

    def pf(size, weight):
        if playfair:
            try:
                return _variable_font(playfair, s(size), weight)
            except Exception:
                pass
        return ImageFont.truetype("DejaVuSerif-Bold.ttf", s(size)) if weight != "Regular" \
            else ImageFont.truetype("DejaVuSerif.ttf", s(size))

    def pf_i(size, weight):
        if playfair_i:
            try:
                return _variable_font(playfair_i, s(size), weight)
            except Exception:
                pass
        return pf(size, weight)

    def it(size, weight):
        if inter:
            try:
                return _variable_font(inter, s(size), weight)
            except Exception:
                pass
        name = "DejaVuSans-Bold.ttf" if weight in ("SemiBold", "Bold", "ExtraBold", "Medium", "Black") \
            else "DejaVuSans.ttf"
        return ImageFont.truetype(name, s(size))

    return {
        # display / serif — the THE HUT wordmark & the money figure
        "wordmark":   pf(46, "Black"),
        "wordmark_lg": pf(52, "Black"),
        "monogram":   pf(26, "Bold"),
        "section":    pf_i(21, "SemiBold"),
        "total":      pf(34, "ExtraBold") if False else pf(34, "Black"),

        # Inter — everything else
        "tagline":    it(11.5, "SemiBold"),
        "credit":     it(9, "Medium"),
        "h2":         it(17, "Bold"),
        "label":      it(11, "SemiBold"),
        "body":       it(15.5, "Regular"),
        "body_bold":  it(15.5, "SemiBold"),
        "small":      it(12.5, "Regular"),
        "small_bold": it(12.5, "SemiBold"),
        "pill":       it(12, "Bold"),
        "fine":       it(11.5, "Regular"),
    }


# ---------------------------------------------------------------------
# PARSER — unchanged in behaviour, so it's a drop-in replacement for
# anything already building the WhatsApp-format checkout message.
# ---------------------------------------------------------------------
def parse_noveatech_order(raw_text: str):
    title_match = re.search(r'\*(THE HUT.*?)\*', raw_text, re.IGNORECASE)
    title = title_match.group(1).strip() if title_match else "NEW ORDER"

    id_match = re.search(r'ID:\s*(#\w+)', raw_text)
    order_id = id_match.group(1) if id_match else "#TH000000"

    items = []
    item_pattern = r'\*(\d+)\.\s*(.*?)\*\s*Qty:\s*x(\d+)\s*\|\s*Price:\s*\$([\d\.]+)\s*\|\s*Sub:\s*\$([\d\.]+)'
    for m in re.finditer(item_pattern, raw_text):
        items.append({
            "num": m.group(1),
            "name": m.group(2).strip(),
            "qty": m.group(3),
            "price": m.group(4),
            "sub": m.group(5)
        })

    total_items_match = re.search(r'Total Items:\s*(\d+)', raw_text, re.IGNORECASE)
    total_items = total_items_match.group(1) if total_items_match else str(sum(int(i['qty']) for i in items))

    total_pay_match = re.search(r'TOTAL TO PAY:\s*\$([\d\.]+)', raw_text, re.IGNORECASE)
    total_pay = total_pay_match.group(1) if total_pay_match else "0.00"

    msg = "Hello TheHuT! I want to order the above."
    if "TOTAL TO PAY" in raw_text:
        after = raw_text.split("TOTAL TO PAY")[-1]
        cleaned = re.sub(r'[\*\-]{3,}', '', after)
        cleaned = cleaned.replace("*", "").strip()
        cleaned = re.sub(r':\s*\$?[\d\.]+', '', cleaned).strip()
        if len(cleaned) > 5:
            msg = cleaned

    return {
        "title": title,
        "order_id": order_id,
        "items": items,
        "total_items": total_items,
        "total_pay": total_pay,
        "message": msg
    }


# ---------------------------------------------------------------------
# DRAWING HELPERS
# ---------------------------------------------------------------------
def _lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_gradient(draw, xy, color1, color2, vertical=False):
    """Fill a rectangle with a linear gradient between two colors."""
    x0, y0, x1, y1 = xy
    span = (y1 - y0) if vertical else (x1 - x0)
    span = max(int(span), 1)
    for i in range(span):
        t = i / span
        color = _lerp(color1, color2, t)
        if vertical:
            draw.line([(x0, y0 + i), (x1, y0 + i)], fill=color)
        else:
            draw.line([(x0 + i, y0), (x0 + i, y1)], fill=color)


def gradient_image(size, color1, color2, vertical=False):
    img = Image.new("RGB", size, color1)
    d = ImageDraw.Draw(img)
    draw_gradient(d, (0, 0, size[0], size[1]), color1, color2, vertical=vertical)
    return img


def draw_gradient_circle(size, color1, color2):
    """Return an RGBA image of a circle filled with a diagonal gradient."""
    circle = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    cd = ImageDraw.Draw(circle)
    for y in range(size):
        t = y / size
        color = _lerp(color1, color2, t)
        cd.line([(0, y), (size, y)], fill=color + (255,))
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size, size), fill=255)
    circle.putalpha(mask)
    return circle


def rounded_shadow_card(width, height, radius=28, blur=18, offset=(0, 10), passes=1):
    """Soft (optionally double-layered) drop shadow behind a rounded card."""
    pad = blur * 4
    canvas = Image.new('RGBA', (width + pad * 2, height + pad * 2), (0, 0, 0, 0))
    layers = [(90, blur, offset)]
    if passes > 1:
        layers.append((45, int(blur * 2.2), (offset[0], int(offset[1] * 1.8))))
    for alpha, b, off in layers:
        shadow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow)
        sd.rounded_rectangle(
            (pad + off[0], pad + off[1], pad + width + off[0], pad + height + off[1]),
            radius=radius, fill=SHADOW + (alpha,)
        )
        shadow = shadow.filter(ImageFilter.GaussianBlur(b))
        canvas = Image.alpha_composite(canvas, shadow)
    return canvas, pad


def text_w(draw, text, font):
    return draw.textlength(text, font=font)


def tracked_width(draw, text, font, tracking=0):
    if not text:
        return 0
    w = sum(draw.textlength(ch, font=font) for ch in text)
    return w + tracking * max(len(text) - 1, 0)


def draw_tracked(draw, xy, text, font, fill, tracking=0):
    """Draw text with manual letter-spacing (PIL has no native tracking)."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking
    return x


def paste_gradient_text(card, xy, text, font, color1, color2):
    """Render `text` filled with a horizontal gradient and paste it onto
    the (RGBA) card at xy. Returns the rendered width."""
    tmp = Image.new("L", (10, 10))
    td = ImageDraw.Draw(tmp)
    bbox = td.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad = 6
    mask = Image.new("L", (w + pad * 2, h + pad * 2), 0)
    md = ImageDraw.Draw(mask)
    md.text((pad - bbox[0], pad - bbox[1]), text, font=font, fill=255)
    grad = gradient_image(mask.size, color1, color2, vertical=False)
    grad_rgba = grad.convert("RGBA")
    grad_rgba.putalpha(mask)
    x, y = xy
    card.alpha_composite(grad_rgba, (int(x - pad), int(y - pad)))
    return w


def add_watermark(card, text, font, opacity, angle=-24):
    """Paint a large, faint, rotated watermark behind everything else on
    the (RGBA) card. This is where NoveaTech lives — present, but only
    in the shadows."""
    W, H = card.size
    tmp = Image.new("L", (10, 10))
    td = ImageDraw.Draw(tmp)
    bbox = td.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad = 40
    layer = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.text((pad - bbox[0], pad - bbox[1]), text, font=font, fill=INK + (opacity,))
    layer = layer.rotate(angle, expand=True, resample=Image.BICUBIC)
    px = (W - layer.width) // 2
    py = (H - layer.height) // 2
    card.alpha_composite(layer, (px, py))


# ---------------------------------------------------------------------
# MAIN GENERATOR
# ---------------------------------------------------------------------
def generate_pictured_invoice(data: dict, output_path="invoice.png",
                               brand="THE HUT", parent_brand="NoveaTech",
                               subtitle="PREMIUM TECH & ACCESSORIES"):
    """
    data = {
        "order_id": "#TH580945",
        "items": [{"name": "...", "qty": "1", "price": "299.00", "sub": "299.00"}, ...],
        "total_items": "6",
        "total_pay": "3244.00",
        "message": "Hello TheHuT! I want to order the above.",
        "status": "PENDING",           # optional
        "customer": "Jane Moyo",       # optional
        "date": "19 Aug 2026",         # optional, defaults to today
    }

    `brand` is the name shown large in the header (THE HUT).
    `parent_brand` is shown only as a small tracked credit line and a
    faint background watermark (NoveaTech) — present, not prominent.
    """
    # ---- HD rendering setup: draw everything supersampled, then
    # downsample with Lanczos so curves, gradients and type are
    # genuinely anti-aliased instead of jagged. ------------------------
    SS = 3          # internal supersample factor
    OUT = 1.7       # final size relative to the 1000px logical design
    F = load_fonts(scale=SS)

    def P(n):
        return round(n * SS)

    W = P(1000)
    HEADER_H = P(196)
    ROW_H = P(60)
    FOOTER_H = P(148)
    PAD_X = P(64)

    # table column x-positions — needed early so we can measure how
    # much horizontal room item names actually have to wrap into.
    col_item_x = PAD_X
    col_qty_x = W - PAD_X - P(330)
    col_price_x = W - PAD_X - P(225)
    col_sub_x = W - PAD_X - P(110)
    name_x = col_item_x + P(28)
    item_col_w = col_qty_x - name_x - P(24)

    # ---- pre-wrap item names to the ACTUAL column width (pixel-accurate,
    # not a character-count guess) and size each row to fit the full,
    # untruncated name — nothing gets cut off with an ellipsis anymore. --
    _measure = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    LINE_H = P(21)

    def wrap_to_width(text, font, max_width):
        words = text.split()
        lines, cur = [], ""
        for w in words:
            trial = (cur + " " + w).strip()
            if not cur or _measure.textlength(trial, font=font) <= max_width:
                cur = trial
            else:
                lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        return lines or [text]

    items = data['items'] or [{}]
    row_heights = []
    for item in items:
        lines = wrap_to_width(item.get('name', ''), F["body_bold"], item_col_w)
        item['_lines'] = lines
        row_heights.append(max(ROW_H, P(16) + len(lines) * LINE_H + P(18)))

    n_rows = max(len(items), 1)
    body_h = P(230) + sum(row_heights) + P(190)
    CARD_H = HEADER_H + body_h + FOOTER_H
    RADIUS = P(30)

    # ---- shadow + base canvas -----------------------------------------
    base, pad = rounded_shadow_card(W, CARD_H, radius=RADIUS, blur=P(9),
                                     offset=(0, P(7)), passes=2)
    card = Image.new('RGBA', (W, CARD_H), PAPER + (255,))
    mask = Image.new('L', (W, CARD_H), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, W, CARD_H), radius=RADIUS, fill=255)

    # ---- NoveaTech watermark — drawn first, so it sits *behind*
    # everything else on the card. This is the "in the shadows" part. --
    add_watermark(card, parent_brand.upper(), F["wordmark_lg"], opacity=10, angle=-22)

    draw = ImageDraw.Draw(card)

    # ---- HEADER: gradient band ------------------------------------------
    header_mask = Image.new('L', (W, HEADER_H), 0)
    hd = ImageDraw.Draw(header_mask)
    hd.rounded_rectangle((0, 0, W, HEADER_H + P(30)), radius=RADIUS, fill=255)
    hd.rectangle((0, HEADER_H - P(30), W, HEADER_H), fill=255)
    header_layer = Image.new('RGB', (W, HEADER_H), DARK)
    hdraw = ImageDraw.Draw(header_layer)
    draw_gradient(hdraw, (0, HEADER_H - P(6), W, HEADER_H), BLUE, CYAN, vertical=False)
    card.paste(header_layer, (0, 0), header_mask)
    draw = ImageDraw.Draw(card)

    # ---- monogram — gradient circle with "TH" ---------------------------
    logo_size = P(66)
    logo_y = P(46)
    logo = draw_gradient_circle(logo_size, BLUE, CYAN)
    card.paste(logo, (PAD_X, logo_y), logo)
    draw = ImageDraw.Draw(card)
    mono = "TH"
    mono_w = text_w(draw, mono, F["monogram"])
    draw.text((PAD_X + (logo_size - mono_w) / 2, logo_y + logo_size / 2 - P(17)),
              mono, font=F["monogram"], fill=(255, 255, 255))

    # ---- brand wordmark (THE HUT — the star of the show) -----------------
    text_x = PAD_X + logo_size + P(24)
    wm_y = P(38)
    draw_tracked(draw, (text_x, wm_y), brand.upper(), F["wordmark"],
                 (255, 255, 255), tracking=P(1.5))

    tagline_y = wm_y + P(56)
    draw_tracked(draw, (text_x, tagline_y), subtitle, F["tagline"],
                 (198, 232, 255), tracking=P(2.2))

    # NoveaTech's one visible mention: small, faint, tracked, secondary.
    credit_y = tagline_y + P(21)
    draw_tracked(draw, (text_x, credit_y), f"A {parent_brand.upper()} PLATFORM",
                 F["credit"], (255, 255, 255, 130) if False else (150, 170, 195),
                 tracking=P(1.8))

    # ---- status pill, right-aligned in header — filled, not outlined ----
    status = data.get("status", "AWAITING CONFIRMATION").upper()
    pill_font = F["pill"]
    pill_text_w = tracked_width(draw, status, pill_font, tracking=P(0.6))
    pill_pad_x = P(18)
    pill_w = pill_text_w + pill_pad_x * 2
    pill_h = P(34)
    pill_x1 = W - PAD_X
    pill_x0 = pill_x1 - pill_w
    pill_y0 = P(46)
    pill_y1 = pill_y0 + pill_h

    pill_mask = Image.new("L", (int(pill_w), pill_h), 0)
    ImageDraw.Draw(pill_mask).rounded_rectangle((0, 0, pill_w, pill_h), radius=pill_h // 2, fill=255)
    pill_grad = gradient_image((int(pill_w), pill_h), BLUE, CYAN)
    pill_rgba = pill_grad.convert("RGBA")
    pill_rgba.putalpha(pill_mask)
    card.alpha_composite(pill_rgba, (int(pill_x0), int(pill_y0)))
    draw = ImageDraw.Draw(card)
    draw_tracked(draw, (pill_x0 + pill_pad_x, pill_y0 + P(9)), status, pill_font,
                 (255, 255, 255), tracking=P(0.6))

    y = HEADER_H + P(38)

    # ---- META ROW: order id / date / customer, with vertical dividers ---
    order_id = data.get("order_id", "#TH000000")
    date_str = data.get("date") or datetime.now().strftime("%d %b %Y, %H:%M")
    customer = data.get("customer", "")

    meta_items = [("ORDER ID", order_id), ("DATE ISSUED", date_str)]
    if customer:
        meta_items.append(("CUSTOMER", customer))

    col_w = (W - PAD_X * 2) / len(meta_items)
    for i, (label, value) in enumerate(meta_items):
        mx = PAD_X + i * col_w
        if i > 0:
            draw.line([(mx - P(24), y - P(4)), (mx - P(24), y + P(50))], fill=LINE, width=P(1))
        draw_tracked(draw, (mx, y), label, F["label"], MUTED, tracking=P(1))
        draw.text((mx, y + P(22)), value, font=F["h2"], fill=INK)

    y += P(76)
    draw.line([(PAD_X, y), (W - PAD_X, y)], fill=LINE, width=P(1))
    y += P(34)

    # ---- SECTION TITLE with short gradient accent bar -------------------
    accent_w = P(34)
    draw_gradient(draw, (PAD_X, y + P(6), PAD_X + accent_w, y + P(12)), BLUE, CYAN)
    draw.text((PAD_X + accent_w + P(16), y - P(6)), "Order Summary", font=F["section"], fill=INK)
    y += P(48)

    # ---- TABLE HEADER -----------------------------------------------------
    draw_tracked(draw, (col_item_x, y), "ITEM", F["label"], MUTED, tracking=P(1))
    draw_tracked(draw, (col_qty_x, y), "QTY", F["label"], MUTED, tracking=P(1))
    draw_tracked(draw, (col_price_x, y), "PRICE", F["label"], MUTED, tracking=P(1))
    draw_tracked(draw, (col_sub_x, y), "SUBTOTAL", F["label"], MUTED, tracking=P(1))
    y += P(26)
    draw.line([(PAD_X, y), (W - PAD_X, y)], fill=LINE, width=P(1))
    y += P(4)

    # ---- TABLE ROWS (subtle zebra striping, full item names — wrapped
    # to as many lines as needed, never truncated) ---------------------------
    for idx, item in enumerate(items):
        row_h = row_heights[idx]
        row_top = y
        row_bottom = y + row_h
        if idx % 2 == 1:
            draw.rectangle((PAD_X - P(16), row_top, W - PAD_X + P(16), row_bottom), fill=ROW_ALT)

        lines = item['_lines']
        num = item.get('num', str(idx + 1))
        draw.text((col_item_x, row_top + P(16)), f"{num}.", font=F["small"], fill=MUTED)
        line_y = row_top + P(14)
        for line in lines:
            draw.text((name_x, line_y), line, font=F["body_bold"], fill=INK)
            line_y += LINE_H

        value_y = row_top + max(P(16), (row_h - P(20)) / 2)
        draw.text((col_qty_x, value_y), f"×{item['qty']}", font=F["body"], fill=INK)
        draw.text((col_price_x, value_y), f"${float(item['price']):.2f}", font=F["body"], fill=INK)
        draw.text((col_sub_x, value_y), f"${float(item['sub']):.2f}", font=F["body_bold"], fill=INK)

        y = row_bottom

    draw.line([(PAD_X, y), (W - PAD_X, y)], fill=LINE, width=P(1))
    y += P(28)

    # ---- TOTALS BLOCK (right aligned) --------------------------------------
    total_pay = float(data['total_pay'])
    total_items = data.get('total_items', str(sum(int(i['qty']) for i in data['items'])))

    right_x1 = W - PAD_X
    label_x = right_x1 - P(300)

    draw.text((label_x, y), "Total items", font=F["body"], fill=MUTED)
    draw.text((right_x1 - text_w(draw, str(total_items), F["body"]), y), str(total_items),
              font=F["body"], fill=INK)
    y += P(28)
    draw.text((label_x, y), "Delivery", font=F["body"], fill=MUTED)
    delivery_txt = "Calculated at checkout"
    draw.text((right_x1 - text_w(draw, delivery_txt, F["small"]), y + P(2)), delivery_txt,
              font=F["small"], fill=(0, 130, 190))
    y += P(42)

    # grand total — gradient-bordered highlight box, gradient-filled figure
    box_h = P(96)
    box_x0 = label_x - P(24)
    box_border = Image.new("RGBA", (int(right_x1 - box_x0), box_h), (0, 0, 0, 0))
    bb = ImageDraw.Draw(box_border)
    bb.rounded_rectangle((0, 0, box_border.size[0] - 1, box_h - 1), radius=P(16), fill=TOTAL_BG)
    border_mask = Image.new("L", box_border.size, 0)
    ImageDraw.Draw(border_mask).rounded_rectangle(
        (0, 0, box_border.size[0] - 1, box_h - 1), radius=P(16), outline=255, width=P(2))
    border_grad = gradient_image(box_border.size, BLUE, CYAN).convert("RGBA")
    border_grad.putalpha(border_mask)
    card.alpha_composite(box_border, (int(box_x0), int(y)))
    card.alpha_composite(border_grad, (int(box_x0), int(y)))
    draw = ImageDraw.Draw(card)

    total_label = "TOTAL TO PAY"
    draw_tracked(draw, (right_x1 - tracked_width(draw, total_label, F["label"], P(1)) - P(24), y + P(16)),
                 total_label, F["label"], MUTED, tracking=P(1))
    total_txt = f"${total_pay:,.2f}"
    tw = text_w(draw, total_txt, F["total"])
    paste_gradient_text(card, (right_x1 - tw - P(24), y + P(38)), total_txt, F["total"], BLUE, CYAN)
    draw = ImageDraw.Draw(card)
    y += box_h + P(32)

    draw.line([(PAD_X, y), (W - PAD_X, y)], fill=LINE, width=P(1))
    y += P(26)

    # customer message, if present
    msg = data.get('message', '')
    if msg:
        for line in textwrap.wrap(msg, width=76):
            draw.text((PAD_X, y), line, font=F["small"], fill=MUTED)
            y += P(21)

    # ---- FOOTER: gradient band ---------------------------------------------
    footer_top = CARD_H - FOOTER_H
    footer_mask = Image.new('L', (W, FOOTER_H), 0)
    fd = ImageDraw.Draw(footer_mask)
    fd.rounded_rectangle((0, -P(30), W, FOOTER_H), radius=RADIUS, fill=255)
    fd.rectangle((0, 0, W, P(30)), fill=255)
    footer_layer = Image.new('RGB', (W, FOOTER_H), DARK)
    fdraw = ImageDraw.Draw(footer_layer)
    draw_gradient(fdraw, (0, 0, W, P(5)), BLUE, CYAN, vertical=False)

    perks = "6-MONTH WARRANTY      ·      TESTED BY TECHS      ·      7-DAY RETURNS"
    perks_w = tracked_width(fdraw, perks, F["small_bold"], tracking=P(0.6))
    draw_tracked(fdraw, ((W - perks_w) / 2, P(32)), perks, F["small_bold"], (255, 255, 255), tracking=P(0.6))

    thanks = f"Thank you for shopping with {brand.title()}"
    thanks_w = text_w(fdraw, thanks, F["h2"])
    fdraw.text(((W - thanks_w) / 2, P(66)), thanks, font=F["h2"], fill=(255, 255, 255))

    fine = f"All prices in USD  ·  Quote valid for 7 days  ·  {parent_brand.lower()}.org"
    fine_w = text_w(fdraw, fine, F["fine"])
    fdraw.text(((W - fine_w) / 2, P(102)), fine, font=F["fine"], fill=(180, 200, 220))

    card.paste(footer_layer, (0, footer_top), footer_mask)
    draw = ImageDraw.Draw(card)

    # ---- thin gradient hairline border around the whole card --------------
    border_layer = Image.new("RGBA", (W, CARD_H), (0, 0, 0, 0))
    bl_mask = Image.new("L", (W, CARD_H), 0)
    ImageDraw.Draw(bl_mask).rounded_rectangle(
        (0, 0, W - 1, CARD_H - 1), radius=RADIUS, outline=255, width=P(2))
    bl_grad = gradient_image((W, CARD_H), BLUE, CYAN, vertical=True).convert("RGBA")
    bl_grad.putalpha(Image.eval(bl_mask, lambda a: int(a * 0.35)))
    card.alpha_composite(bl_grad, (0, 0))

    # ---- composite the rounded card onto the soft shadow canvas -----------
    final = base.copy()
    final.paste(card, (pad, pad), mask)

    # flatten onto a light page background so it reads as a printable card
    page = Image.new('RGB', final.size, PAGE_BG)
    page.paste(final, (0, 0), final)

    # ---- downsample for crisp, HD anti-aliasing ----------------------------
    out_w = round(1000 * OUT)
    out_h = round(page.height * (out_w / page.width))
    page = page.resize((out_w, out_h), Image.LANCZOS)

    page.save(output_path, dpi=(300, 300))
    print(f"Invoice saved to {output_path}  ({out_w}x{out_h}px, 300 DPI)")
    return output_path


# ---------------------------------------------------------------------
# EXAMPLE USAGE
# ---------------------------------------------------------------------
if __name__ == "__main__":
    raw = (
        "noveatech *THE HUT - NEW ORDER* ID: #TH580945 "
        "-------------------------------- "
        "*1. iPhone SE 2022 64GB* Qty: x1 | Price: $299.00 | Sub: $299.00 "
        "*2. iPhone 13 Pro 128GB - Certified* Qty: x5 | Price: $589.00 | Sub: $2945.00 "
        "-------------------------------- "
        "*Total Items: 6* *TOTAL TO PAY: $3244.00* "
        "Hello TheHuT! I want to order the above."
    )

    parsed = parse_noveatech_order(raw)
    parsed["status"] = "AWAITING CONFIRMATION"
    generate_pictured_invoice(parsed, "thehut_invoice.png")
