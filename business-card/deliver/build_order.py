"""Build one paid card order into a card and a proof for a person to check.

Usage: python3 -I build_order.py <order.json> <out_dir>

Reads one order (the format is order.schema.json), refuses it loudly when anything is missing or wrong,
and otherwise writes to out_dir:
  card/        the built card from site/build.py: index.html, the contact file, media/ (logo, and the
               chosen film for a ready-made order). This folder, and only this folder, is what gets hosted.
  brand-kit.json  the kit made from the order, which build.py read (working record: never hosted)
  order.json   a copy of the order as built
  PROOF.md     the checklist for the person delivering it: what was built, what still needs a film,
               and what the buyer and Phill must approve before the card goes anywhere public

Nothing is filled in for the buyer: no default name, link, phone, colour or film. Nothing is sent,
uploaded or hosted, and nothing here reads payment data or calls Stripe or any other live service.
"""
import hashlib
import json
import os
import re
import shutil
import secrets
import struct
import subprocess
import sys
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
CARD_DIR = os.path.dirname(HERE)                      # business-card/
REPO = os.path.dirname(CARD_DIR)
BUILD = os.path.join(CARD_DIR, "site", "build.py")
TEMPLATE = os.path.join(CARD_DIR, "card.html")
VALIDATE = os.path.join(CARD_DIR, "brand-kits", "validate.py")
# The nine ready-made films are editions in the showroom kit; the order borrows the film, nothing else. The showroom's
# restoration edition is Phill's own and is never offered to a buyer (no restoration content on buyer cards).
SHOWROOM_KIT = os.path.join(CARD_DIR, "brand-kits", "phill-mcgurk.json")
WORK = os.path.join(HERE, ".work")                     # the buyer's logo sits here only while build.py runs

REQUIRED = ("order_ref", "tier", "film", "buyer_name", "role", "email", "phone", "businesses", "extra_businesses", "logo_file")
OPTIONAL = ("brand_colour", "colour_source")
FILMS = ("portal", "blueprint", "forge", "constellation", "ink", "rewind", "skyline", "origami", "magnet")
PENDING = "custom, pending proof"
TIERS = {"ready-made": 249, "made-for-you": 449}
EXTRA_PRICE = 199

# All matched with fullmatch: "$" also matches before a trailing line break, which would let "x\n" through.
REF = re.compile(r"[A-Za-z0-9][A-Za-z0-9-]{2,39}")
EMAIL = re.compile(r'[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+')
TEL = re.compile(r"\+?[0-9]{6,15}")
HEX = re.compile(r"#[0-9A-Fa-f]{6}")
SAFE_URL = re.compile(r'https://[^\s/?#"<>]+[^\s"<>]*')         # same rule as card.html, build.py and validate.py
CTRL = re.compile(r"[\x00-\x1f\x7f  ]")
LOGO_TYPES = {".png": b"\x89PNG\r\n\x1a\n"}       # PNG only: it is rebuilt from its pixels (clean_png)
LOGO_MAX = 120_000                                     # build.py's limit for the contact picture


# card.html is Phill's own card: its enquiry form is filled with his example (Sam Example from Example Restorations,
# Ipswich, asking about a RestoreAssist trial) and it notes the game is Rana's build. A buyer's card is built from a
# copy with those taken out, so they are not in its source either (its script still clears them at load, as before).
# Each must be found exactly once: if card.html changes, the build refuses rather than ship the example.
BUYER_TEMPLATE_CUTS = (
    (" The game is Rana's build. Its permanent address", " The game's permanent address"),
    (' value="Sam Example"', ""),
    (' value="sam@example.com.au"', ""),
    (' value="Example Restorations, Ipswich"', ""),
    (">We heard your talk in Brisbane and would like to discuss a trial of RestoreAssist for our crew of six.</textarea>",
     "></textarea>"),
    ("Example entry shown. Replace it with your own.", "Nothing is sent from here: you see your message first."),
)
# What the cuts take out, checked again in every page the build wrote
PHILLS_EXAMPLE = ("Rana's build", "Sam Example", "sam@example.com.au", "Example Restorations", "RestoreAssist")


class Refused(Exception):
    pass


def text(order, key, errs, lo, hi):
    """A required text value, or an error naming it. Blank is missing, never filled in."""
    v = order.get(key)
    if not isinstance(v, str):
        errs.append(f"'{key}' must be text")
        return None
    raw, v = v, v.strip()
    if not v:
        errs.append(f"'{key}' is blank")
    elif CTRL.search(raw):
        errs.append(f"'{key}' must not contain line breaks or control characters")
    elif not lo <= len(v) <= hi:
        errs.append(f"'{key}' must be {lo} to {hi} characters")
    else:
        return v
    return None


def check(order, order_dir):
    """Every problem with the order, each naming its field. An empty list means the order can be built."""
    if not isinstance(order, dict):
        return ["the order must be a JSON object"]
    errs = [f"missing required field '{k}'" for k in REQUIRED if k not in order or (order[k] is None and k != "phone")]
    errs += [f"'{k}' is not a field of the order format (payment data never goes in an order)"
             for k in order if k not in REQUIRED + OPTIONAL]
    if "order_ref" in order and not (isinstance(order["order_ref"], str) and REF.fullmatch(order["order_ref"])):
        errs.append("'order_ref' must be 3 to 40 letters, numbers or dashes")
    tier, film = order.get("tier"), order.get("film")
    if "tier" in order and not (isinstance(tier, str) and tier in TIERS):
        errs.append(f"'tier' must be ready-made or made-for-you, not {tier!r}")
    if "film" in order and not isinstance(film, str):
        errs.append("'film' must be text")
    elif "film" in order:
        if tier == "ready-made" and film not in FILMS:
            errs.append(f"'film' for a ready-made order must be one of the nine films ({', '.join(FILMS)}), not {film!r}")
        elif tier == "made-for-you" and film != PENDING:
            errs.append(f"'film' for a made-for-you order must be exactly {PENDING!r}: the film is made after the proof")
        elif film not in FILMS + (PENDING,):
            errs.append(f"'film' {film!r} is not one of the nine films or {PENDING!r}")
    for key, lo, hi in (("buyer_name", 2, 80), ("role", 2, 100)):
        if key in order and order[key] is not None:
            text(order, key, errs, lo, hi)
    if order.get("buyer_name") and isinstance(order["buyer_name"], str) and not slug(order["buyer_name"]):
        errs.append("'buyer_name' needs at least one letter or number from A to Z or 0 to 9 for the card's file names")
    if "email" in order and order["email"] is not None:
        e = text(order, "email", errs, 3, 120)
        if e and not EMAIL.fullmatch(e):
            errs.append(f"'email' {e!r} is not an email address")
    if "phone" in order and order["phone"] is not None:
        p = order["phone"]
        if not isinstance(p, dict) or set(p) != {"display", "tel"}:
            errs.append("'phone' must be {\"display\": ..., \"tel\": ...}, or null when the buyer wants no phone on the card")
        else:
            if not isinstance(p["display"], str) or not 6 <= len(p["display"].strip()) <= 30 or CTRL.search(p["display"]):
                errs.append("'phone'.display must be the number as shown, 6 to 30 characters")
            if not isinstance(p["tel"], str) or not TEL.fullmatch(p["tel"]):
                errs.append("'phone'.tel must be the number as dialled, digits with an optional leading +")
    businesses = order.get("businesses")
    if "businesses" in order and businesses is not None:
        if not isinstance(businesses, list) or not 1 <= len(businesses) <= 8:
            errs.append("'businesses' must list 1 to 8 businesses")
            businesses = None
        else:
            for i, b in enumerate(businesses):
                where = f"businesses[{i}]"
                if not isinstance(b, dict):
                    errs.append(f"{where} must be an object with 'name' and 'url'")
                    continue
                errs += [f"{where} is missing required field '{k}'" for k in ("name", "url") if not b.get(k)]
                errs += [f"{where} has '{k}', which is not a field of a business" for k in b if k not in ("name", "url", "note")]
                if b.get("name") and (not isinstance(b["name"], str) or not 2 <= len(b["name"].strip()) <= 60 or CTRL.search(b["name"])):
                    errs.append(f"{where} 'name' must be 2 to 60 characters on one line")
                if b.get("url") and not (isinstance(b["url"], str) and SAFE_URL.fullmatch(b["url"])):
                    errs.append(f"{where} 'url' must be plain https with no spaces, quotes or angle brackets, not {b['url']!r}")
                if "note" in b and (not isinstance(b["note"], str) or len(b["note"]) > 60 or CTRL.search(b["note"])):
                    errs.append(f"{where} 'note' must be at most 60 characters on one line")
    if "extra_businesses" in order and order["extra_businesses"] is not None:
        x = order["extra_businesses"]
        if not isinstance(x, int) or isinstance(x, bool) or x < 0:
            errs.append("'extra_businesses' must be a whole number, 0 or more")
        elif isinstance(businesses, list) and x != len(businesses) - 1:
            errs.append(f"'extra_businesses' is {x} but the order lists {len(businesses) - 1} business(es) after the main one; "
                        "check what was paid for")
    if "logo_file" in order and order["logo_file"] is not None:
        if not isinstance(order["logo_file"], str) or not order["logo_file"].strip():
            errs.append("'logo_file' must be the file name of the buyer's logo (text, not blank)")
        else:
            logo_path(order, order_dir, errs)
    if "brand_colour" in order:
        if not (isinstance(order["brand_colour"], str) and HEX.fullmatch(order["brand_colour"])):
            errs.append("'brand_colour' must be #RRGGBB")
        cs = order.get("colour_source")
        if "colour_source" in order and not isinstance(cs, str):
            errs.append("'colour_source' must be text")
        elif not (cs or "").strip():
            errs.append("missing required field 'colour_source': say where 'brand_colour' came from")
    elif "colour_source" in order:
        errs.append("'colour_source' is given but 'brand_colour' is not")
    return errs


def logo_path(order, order_dir, errs):
    rel = str(order["logo_file"])
    path = os.path.abspath(os.path.join(order_dir, rel))
    ext = os.path.splitext(path)[1].lower()
    if ext not in LOGO_TYPES:
        errs.append(f"'logo_file' {rel!r} must be a PNG; re-export it first (RUNBOOK step 3.4, e.g. "
                    "sips -s format png -Z 256 logo.jpg --out logo-256.png)")
    elif not os.path.isfile(path):
        errs.append(f"'logo_file' {rel!r} does not exist (read from {order_dir})")
    else:
        try:
            with open(path, "rb") as f:
                data = f.read(LOGO_MAX + 1)
        except OSError as e:
            errs.append(f"'logo_file' {rel!r} cannot be read: {e.strerror or e}")
            return None
        if not data.startswith(LOGO_TYPES[ext]):
            errs.append(f"'logo_file' {rel!r} is not really a {ext[1:].upper()}")
        elif len(data) > LOGO_MAX:
            errs.append(f"'logo_file' {rel!r} is over {LOGO_MAX} bytes; use a copy of about 256 px")
        else:
            return path
    return None


CHANNELS = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}              # PNG colour type -> samples per pixel


DEPTHS = {0: (1, 2, 4, 8, 16), 2: (8, 16), 3: (1, 2, 4, 8), 4: (8, 16), 6: (8, 16)}   # the pairs the PNG spec defines
LOGO_PIXELS = 1024 * 1024                               # a card logo is about 256 px; anything far bigger is refused
LOGO_EDGE_MAX = 4096                                  # no million-pixel single scanline allocations


def unfilter(raw, row, bpp, height):
    """Undo the PNG row filters (spec section 7.3) and return the plain scanlines, filter bytes removed."""
    out, prev = bytearray(), bytearray(row - 1)
    for y in range(height):
        f, line = raw[y * row], bytearray(raw[y * row + 1:(y + 1) * row])
        for i in range(len(line)):
            left = line[i - bpp] if i >= bpp else 0
            up, ul = prev[i], (prev[i - bpp] if i >= bpp else 0)
            if f == 1:
                line[i] = (line[i] + left) & 255
            elif f == 2:
                line[i] = (line[i] + up) & 255
            elif f == 3:
                line[i] = (line[i] + ((left + up) >> 1)) & 255
            elif f == 4:
                p = left + up - ul
                pa, pb, pc = abs(p - left), abs(p - up), abs(p - ul)
                line[i] = (line[i] + (left if pa <= pb and pa <= pc else up if pb <= pc else ul)) & 255
        out += line
        prev = line
    return out


def samples(line, count, depth):
    """The first `count` samples of one scanline at `depth` bits; padding bits past them are never read."""
    if depth == 8:
        return list(line[:count])
    if depth == 16:
        return [(line[2 * i] << 8) | line[2 * i + 1] for i in range(count)]
    per, mask = 8 // depth, (1 << depth) - 1
    return [(line[i // per] >> (8 - depth * (i % per + 1))) & mask for i in range(count)]


def clean_png(data):
    """The same picture redrawn from its decoded pixels as a new 8-bit RGBA PNG. Only the colour and opacity
    of each pixel reach the output: text, EXIF, profiles, unused palette entries, padding bits, bits a
    decoder masks off and bytes after the picture data have nowhere to go."""
    chunks, pos = [], 8
    while pos + 12 <= len(data):
        n = struct.unpack(">I", data[pos:pos + 4])[0]
        kind, body, crc = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + n], data[pos + 8 + n:pos + 12 + n]
        if len(body) != n or len(crc) != 4 or struct.unpack(">I", crc)[0] != zlib.crc32(kind + body) & 0xffffffff:
            raise Refused("the logo is a damaged PNG (a chunk's checksum or length is wrong)")
        chunks.append((kind, body))
        pos += 12 + n
        if kind == b"IEND":
            break
    kinds = [k for k, _ in chunks]
    if not chunks or kinds[0] != b"IHDR" or kinds[-1] != b"IEND" or b"IDAT" not in kinds or len(chunks[0][1]) != 13:
        raise Refused("the logo is a damaged PNG (it needs IHDR, picture data and IEND)")
    if kinds.count(b"IHDR") != 1:
        raise Refused("the logo is a PNG with more than one header; save a fresh copy")
    width, height, depth, ctype, method, filtering, interlace = struct.unpack(">IIBBBBB", chunks[0][1])
    if method != 0 or filtering != 0:
        raise Refused("the logo is a PNG with an unknown compression or filter method")
    if interlace != 0:
        raise Refused("the logo is an interlaced PNG; save a copy without interlacing")
    if depth not in DEPTHS.get(ctype, ()) or not (0 < width and 0 < height):
        raise Refused("the logo is a PNG with an unsupported header")
    if width > LOGO_EDGE_MAX or height > LOGO_EDGE_MAX or width * height > LOGO_PIXELS:
        raise Refused(f"the logo is {width} x {height} px; re-export it at about 256 px (RUNBOOK step 3.4)")
    plte = [b for k, b in chunks if k == b"PLTE"]
    trns = [b for k, b in chunks if k == b"tRNS"]
    if len(plte) > 1 or len(trns) > 1:
        raise Refused("the logo is a PNG with more than one palette or transparency block; save a fresh copy")
    if ctype == 3 and (not plte or not plte[0] or len(plte[0]) % 3 or len(plte[0]) > 3 * 2 ** depth):
        raise Refused("the logo is a palette PNG whose palette does not fit its header")
    if trns and not (len(trns[0]) == 2 if ctype == 0 else len(trns[0]) == 6 if ctype == 2
                     else 0 < len(trns[0]) <= len(plte[0]) // 3 if ctype == 3 else False):
        raise Refused("the logo is a PNG with a transparency block that does not fit its picture")
    spp = CHANNELS[ctype]
    row = 1 + (width * spp * depth + 7) // 8
    d = zlib.decompressobj()
    try:
        raw = d.decompress(b"".join(b for k, b in chunks if k == b"IDAT"), row * height + 1)
    except zlib.error:
        raise Refused("the logo is a damaged PNG (its picture data cannot be read)")
    if not d.eof or d.unused_data or d.unconsumed_tail or len(raw) != row * height:
        raise Refused("the logo is a damaged PNG (its picture data is not exactly the size its header says)")
    if any(raw[i] > 4 for i in range(0, len(raw), row)):
        raise Refused("the logo is a damaged PNG (a row has an unknown filter)")
    lines = unfilter(raw, row, max(1, spp * depth // 8), height)
    mask = (1 << depth) - 1
    key = None
    if trns and ctype in (0, 2):                        # a decoder masks these to the image depth (PNG spec 11.3.2.1)
        key = tuple((trns[0][i] << 8 | trns[0][i + 1]) & mask for i in range(0, len(trns[0]), 2))
    pal = [tuple(plte[0][i:i + 3]) for i in range(0, len(plte[0]), 3)] if ctype == 3 else []
    alpha = list(trns[0]) if trns and ctype == 3 else []
    to8 = (lambda v: v >> 8) if depth == 16 else (lambda v: v * 255 // mask)
    out = bytearray()
    for y in range(height):
        vals = samples(lines[y * (row - 1):(y + 1) * (row - 1)], width * spp, depth)
        out.append(0)
        for x in range(width):
            px = vals[x * spp:(x + 1) * spp]
            if ctype == 3:
                if px[0] >= len(pal):
                    raise Refused("the logo is a palette PNG that uses a colour its palette does not have")
                rgba = pal[px[0]] + ((alpha[px[0]] if px[0] < len(alpha) else 255),)
            else:
                a = 0 if key is not None and tuple(px[:3] if ctype == 2 else px[:1]) == key else 255
                c = [to8(v) for v in px]
                rgba = ((c[0], c[0], c[0], a) if ctype == 0 else (c[0], c[1], c[2], a) if ctype == 2
                        else (c[0], c[0], c[0], c[1]) if ctype == 4 else tuple(c))
            out += bytes(rgba)
    pieces = [b"\x89PNG\r\n\x1a\n"]
    for k, b in [(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)),
                 (b"IDAT", zlib.compress(bytes(out), 9)), (b"IEND", b"")]:
        pieces.append(struct.pack(">I", len(b)) + k + b + struct.pack(">I", zlib.crc32(k + b) & 0xffffffff))
    return b"".join(pieces)


def clean_logo(path, data):
    return clean_png(data)


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60]


def showroom_film(name):
    """The ready-made film as the showroom kit holds it, or refuse: a missing film is never stood in for."""
    film = ((json.load(open(SHOWROOM_KIT, encoding="utf-8")).get("brand") or {}).get("editions") or {}).get(name) or {}
    for key in ("video", "poster"):
        if film.get("status") != "found" or not film.get(key) or not os.path.isfile(os.path.join(REPO, film[key])):
            raise Refused(f"the ready-made film {name!r} has no {key} file in {os.path.relpath(SHOWROOM_KIT, REPO)}")
    return {"status": "found", "fit": film.get("fit", "cover"), "video": film["video"], "poster": film["poster"],
            "stopAt": film.get("stopAt"), "source": f"Ready-made {name} edition from the showroom kit"}


TITLES = {"dr", "mr", "mrs", "ms", "miss", "prof"}


def first_name(buyer_name):
    """The name the shelf is called by: the first word that is not a title ("Dr Jane Smith" is Jane)."""
    words = buyer_name.split()
    return next((w for w in words if w.rstrip(".").lower() not in TITLES), words[0])


def buyer_template():
    """card.html without Phill's own example enquiry and notes (BUYER_TEMPLATE_CUTS), or refuse."""
    page = open(TEMPLATE, encoding="utf-8").read()
    for old, new in BUYER_TEMPLATE_CUTS:
        if page.count(old) != 1:
            raise Refused(f"card.html has changed: Phill's example text {old.strip()[:50]!r} should be there exactly once, "
                          "so build_order.py can leave it out of the buyer's card. Update BUYER_TEMPLATE_CUTS.")
        page = page.replace(old, new)
    return page


def make_kit(order, logo_rel, logo_sha):
    ref, main = order["order_ref"], order["businesses"][0]
    src = f"order {ref}"
    if order.get("brand_colour"):
        primary = {"value": order["brand_colour"].upper(), "source": f"{src}: {order['colour_source'].strip()}"}
    else:
        primary = {"status": "missing", "note": f"no brand colour came with {src}"}
    brand = {
        "name": main["name"].strip(),
        "logo": {"status": "found", "url": "file:" + logo_rel, "file": logo_rel,
                 "source": f"the buyer's own logo, supplied with {src} (sha256 {logo_sha})"},
        "colours": {"primary": primary},
        "about": {"status": "missing", "note": "not part of a card order"},
        # the template's shelf is the Unite-Group Nexus unless the kit names it
        "shelf": {"title": first_name(order["buyer_name"]) + "'s business" + ("es" if len(order["businesses"]) > 1 else ""),
                  "text": "Tap one to visit its website." if len(order["businesses"]) > 1 else "Tap to visit the website."},
    }
    if order["tier"] == "ready-made":
        brand["editions"] = {order["film"]: showroom_film(order["film"])}
        brand["rotation"] = [order["film"]]
    phone = order["phone"]
    person = {
        "name": order["buyer_name"].strip(),
        "title": order["role"].strip(),
        "org": main["name"].strip(),
        "phones": [{"label": "Mobile", "display": phone["display"].strip(), "tel": phone["tel"], "type": "CELL"}] if phone else [],
        "emails": [{"label": "Email", "value": order["email"].strip(), "primary": True}],
        "links": [dict({"label": b["name"].strip(), "url": b["url"], "visitor": True},
                       **({"note": b["note"].strip()} if b.get("note", "").strip() else {}))
                  for b in order["businesses"]],
        "contactPhoto": {"kind": "logo", "file": logo_rel, "source": f"the buyer's own logo, {src}"},
        "contactSource": src,
    }
    # buyerCard: the template leaves out what only Phill's own card carries (its example enquiry, its notes)
    return {"id": slug(order["buyer_name"]), "prepared": f"business-card/deliver/build_order.py from {src}",
            "buyerCard": True, "brand": brand, "person": person}


def no_duplicate_keys(pairs):
    """json.load hook: a key given twice is two answers to one question, so the order is refused, not guessed."""
    seen = set()
    for k, _ in pairs:
        if k in seen:
            raise ValueError(f"duplicate key {k!r}: give each field once")
        seen.add(k)
    return dict(pairs)


def unicode_problems(root):
    """Every text in the order that cannot be written to a file (an unpaired surrogate), by its path.
    Walks with a stack, not recursion, so a deeply nested order is refused by the checks, not by a crash."""
    bad, stack = [], [(root, "the order")]
    while stack:
        node, where = stack.pop()
        if isinstance(node, str):
            try:
                node.encode("utf-8")
            except UnicodeEncodeError:
                bad.append(where)
        elif isinstance(node, dict):
            for k, v in node.items():
                stack += [(k, f"{where} key"), (v, f"{where}.{k}")]
        elif isinstance(node, list):
            stack += [(v, f"{where}[{i}]") for i, v in enumerate(node)]
    return bad


def run(cmd):
    r = subprocess.run([sys.executable, "-I"] + cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise Refused(f"{os.path.basename(cmd[0])} refused:\n" + (r.stderr or r.stdout).strip())
    return r


def build(order_path, out):
    try:
        with open(order_path, encoding="utf-8") as f:
            order = json.load(f, object_pairs_hook=no_duplicate_keys)
    except (OSError, ValueError, RecursionError) as e:
        raise Refused(f"cannot read the order {order_path}: {e if not isinstance(e, RecursionError) else 'it is nested too deeply'}")
    bad = unicode_problems(order)
    if bad:
        raise Refused("the order has text that is not valid Unicode (an unpaired surrogate); nothing was built:\n"
                      + "\n".join("  - " + b for b in bad))
    order_dir = os.path.dirname(os.path.abspath(order_path))
    errs = check(order, order_dir)
    if errs:
        raise Refused("the order is incomplete or wrong; nothing was built:\n" + "\n".join("  - " + e for e in errs))
    if os.path.exists(out) and (not os.path.isdir(out) or os.listdir(out)):
        raise Refused(f"out_dir {out} already has files in it; give an empty or new folder so builds never mix")

    logo_src = logo_path(order, order_dir, [])
    data = clean_logo(logo_src, open(logo_src, "rb").read())   # the pixels only: what ships is what is hashed
    if len(data) > LOGO_MAX:                                   # recompressing can add bytes; check before writing
        raise Refused(f"the logo is {len(data)} bytes after cleaning, over the {LOGO_MAX}-byte limit; "
                      "use a copy of about 256 px")
    sha = hashlib.sha256(data).hexdigest()
    # Each invocation MUST have its own isolated staging folder. Deterministic
    # order_ref+SHA collides if two workers build the same paid order concurrently;
    # one worker could delete the other's logo/template in the finally block.
    # Cryptographic randomness isolates concurrent builds without shared locks.
    stage = os.path.join(WORK, "order-" + secrets.token_hex(12))
    logo_rel = os.path.relpath(os.path.join(stage, "logo" + os.path.splitext(logo_src)[1].lower()), REPO)
    kit = make_kit(order, logo_rel, sha)
    os.makedirs(out, exist_ok=True)
    kit_path = os.path.join(out, "brand-kit.json")
    with open(kit_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(kit, f, indent=2, ensure_ascii=False)
    with open(os.path.join(out, "order.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(order, f, indent=2, ensure_ascii=False)
    card = os.path.join(out, "card")
    try:
        os.makedirs(stage, exist_ok=True)
        with open(os.path.join(REPO, logo_rel), "wb") as f:
            f.write(data)
        template = os.path.join(stage, "card.html")
        with open(template, "w", encoding="utf-8", newline="\n") as f:
            f.write(buyer_template())
        run([VALIDATE, kit_path])
        run([BUILD, template, kit_path, card])
    finally:
        shutil.rmtree(stage, ignore_errors=True)
    built = verify(order, kit, card)
    with open(os.path.join(out, "PROOF.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write(proof(order, kit, sha, built))
    return built


def verify(order, kit, card):
    """Check the built folder holds what the order paid for; refuse loudly when it does not."""
    names = sorted(os.path.relpath(os.path.join(r, n), card) for r, _, ns in os.walk(card) for n in ns)
    for need in ("index.html", kit["id"] + ".vcf"):
        if need not in names:
            raise Refused(f"build.py finished but card/{need} is missing")
    films = [n for n in names if n.endswith((".mp4", ".webm"))]
    if order["tier"] == "ready-made":
        want = os.path.join("media", os.path.basename(kit["brand"]["editions"][order["film"]]["video"]))
        if films != [want]:
            raise Refused(f"the card should ship exactly {want}, but has {films or 'no film'}")
    elif films:
        raise Refused(f"a made-for-you card must ship no film before the custom film is approved, but has {films}")
    for name in names:
        if name.endswith(".html"):
            with open(os.path.join(card, name), encoding="utf-8") as f:
                page_text = f.read().lower()
            left = [w for w in PHILLS_EXAMPLE if w.lower() in page_text]
            if left:
                raise Refused(f"card/{name} still carries Phill's own example text {left}; it must not ship on a buyer's card")
    page = open(os.path.join(card, "index.html"), encoding="utf-8").read()
    m = re.search(r'<script id="brand-kit">window\.BRAND_KIT = (\{.*?\});</script>', page, re.S)
    if not m:
        raise Refused("build.py finished but card/index.html carries no brand kit")
    page_links = [l.get("url") for l in json.loads(m.group(1)).get("person", {}).get("links", [])]
    with open(os.path.join(card, kit["id"] + ".vcf"), encoding="utf-8", newline="") as f:
        vcf = f.read().replace("\r\n ", "")                  # unfold the contact's 75-character lines
    for b in order["businesses"]:
        if b["url"] not in page_links or b["url"] not in vcf:
            raise Refused(f"business {b['name']!r} ({b['url']}) is missing from the built card or contact")
    return names


def proof(order, kit, sha, built):
    ref, tier, n_extra = order["order_ref"], order["tier"], order["extra_businesses"]
    total = TIERS[tier] + EXTRA_PRICE * n_extra
    phone = order["phone"]
    L = [f"# Proof: card order {ref}", "",
         "Made by `business-card/deliver/build_order.py`. Nothing has been sent to the buyer, uploaded or hosted.", "",
         "## The order", "",
         f"- Buyer: {kit['person']['name']}, {kit['person']['title']}",
         f"- Email: {order['email'].strip()}",
         f"- Phone: {phone['display'].strip() + ' (' + phone['tel'] + ')' if phone else 'none (the buyer asked for no phone on the card)'}",
         f"- Package: {tier} (listed at AUD {TIERS[tier]}) with {n_extra} extra business(es) at AUD {EXTRA_PRICE} each: "
         f"listed total AUD {total}. Check this matches the Stripe payment before going on.",
         "", "## Businesses on the card", "", "| # | Business | Link | Line under it |", "| --- | --- | --- | --- |"]
    for i, b in enumerate(order["businesses"]):
        L.append(f"| {i + 1}{' (main)' if i == 0 else ' (extra)'} | {b['name'].strip()} | {b['url']} | {(b.get('note') or '').strip() or '(none)'} |")
    L += ["", "## Film", ""]
    if tier == "ready-made":
        L += [f"- Ready-made film: **{order['film']}** edition, file `card/media/{os.path.basename(kit['brand']['editions'][order['film']]['video'])}`.",
              "  It plays when the card opens.",
              "- WARNING: this is the showroom copy of the film. It ends on the Unite-Group logo, not the buyer's logo.",
              "  Phill decides whether ready-made cards ship this copy or a copy that ends on the buyer's logo.",
              "  Do not host until that is decided."]
    else:
        L += ["- **FILM PENDING.** This is a made-for-you order: the custom film has not been made yet.",
              "- No film was made, borrowed or stood in for it. Until the film is made and approved, the card opens on",
              "  the buyer's logo.",
              "- Next: make the custom film from the buyer's own website and photos (real images only), get the buyer's",
              "  OK on it, add it to `brand-kit.json` as the opener, and run build.py again."]
    missing = []
    if kit["brand"]["colours"]["primary"].get("status") == "missing":
        missing.append("Brand colour: none came with the order, so the card uses the template's default colour. Ask the buyer for it.")
    missing.append("Card web address: not chosen (hosting per buyer is an open decision for Phill). Until there is one, the "
                   "saved contact has no link back to the card and the QR code points nowhere useful.")
    missing.append("Review button: the card shows \"Worked with us? Leave a review\", which says \"Not connected yet\" until "
                   "the buyer's Google Business Profile is connected. Ask the buyer whether they want it.")
    L += ["", "## Still needed", ""] + [f"- {m}" for m in missing]
    L += ["", "## What was built", "",
          f"Folder `card/` (the only folder that is ever hosted): {len(built)} files, including:", "",
          "- `card/index.html`: the card page",
          f"- `card/{kit['id']}.vcf`: the Save contact file (name, role, email{', phone' if phone else ''}, every business link, the logo as its picture)",
          "- `card/preview.html`: the same card as one file, to look at without hosting",
          f"- `card/media/`: the buyer's logo (sha256 `{sha[:16]}...`){' and the film' if tier == 'ready-made' else ''}",
          "", "Beside it, never hosted: `brand-kit.json` (what build.py read), `order.json` (the order as built), this file.",
          "", "## Before this goes anywhere public", "",
          "- [ ] A person opened `card/index.html` on a phone-sized and a desktop-sized screen and looked at it.",
          "- [ ] The buyer approved their name and role exactly as written.",
          "- [ ] The buyer approved the email" + (" and phone." if phone else "."),
          "- [ ] Every business link was tapped and opened the right site.",
          "- [ ] The buyer approved the logo, and it is their own.",
          "- [ ] The logo re-exported with `sips -s format png` (macOS) or an equivalent re-encode, so no EXIF, GPS, author, "
          "comment or thumbnail data from the buyer's file comes along. (build_order.py also drops such blocks it can see.)",
          "- [ ] The film is approved: " + ("Phill has decided about the Unite-Group ending (see Film)." if tier == "ready-made"
                                           else "the custom film is made, added and approved by the buyer."),
          "- [ ] Save contact was tried on a real phone and the contact looked right.",
          "- [ ] Phill has chosen where buyer cards are hosted and on what address.",
          "- [ ] The payment matches the listed total above.", ""]
    return "\n".join(L)


def main(argv):
    if len(argv) != 2:
        sys.exit(__doc__)
    try:
        built = build(*argv)
    except Refused as e:
        sys.exit(f"REFUSED: {e}")
    except OSError as e:
        sys.exit(f"REFUSED: a file could not be read or written ({e}); out_dir may be part-written, so delete it and start again")
    print(f"Built {len(built)} files into {os.path.join(argv[1], 'card')}. Read {os.path.join(argv[1], 'PROOF.md')} next.")


if __name__ == "__main__":
    main(sys.argv[1:])
