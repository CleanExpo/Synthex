"""Build one business's card from the template and its brand kit.

Usage: python3 -I build.py <card.html> <brand-kit.json> <out_dir>

Writes to out_dir:
  index.html      the hosted page (full document, window.CARD_HOSTED = true)
  <kit id>.vcf    the contact file the Save button opens
  preview.html    the same card for a claude.ai preview (not hosted mode)
  card-template.html  the unbranded template, which get-your-card.html fills for its live preview
  media/          the logo and hero clip named in the kit, served as files by the hosted page
  manifest.webmanifest, sw.js  the home-screen app: icons from the kit, and an offline copy of the card
                  (the page, contact file, logo, QR library and the rotation posters) for a trade-show floor with no signal
The logo and hero clip ("file", "video", "poster", relative to the repository root) are copied into
media/ for the hosted page and embedded as data URIs in preview.html, so neither loads anything from
another host. vercel.json is kept by hand.
"""
import re
from html import escape
import base64
import hashlib
import json
import os
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SLOT = '<script id="brand-kit">window.BRAND_KIT = {};</script>'
HEAD = (
    '<!doctype html>\n<html lang="en-AU">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
    '<meta name="robots" content="noindex">\n'
    '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
    'body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
    '<script>window.CARD_HOSTED = true;</script>\n{app}</head>\n<body>\n'
)
# The kit's working record (where each value came from, earlier versions, consent, notes for the owner)
# never reaches the public page: the card reads none of it.
PRIVATE = {"sources", "prepared", "source", "decision", "likenessConsent", "conflicts", "resolved",
           "previousLogos", "previousHeroes", "previousEditions", "rotationReason", "supersededReason",
           "videoNote", "urlNote", "shopUrlNote", "contactSource", "visitorLinksSource", "reviewPromptsSource",
           "placeIdSource", "profileUrlSource", "titleSource"}
# Phill 24/10/2026: no certifications on the card. Checked at any length; the record check skips short text.
NO_CREDENTIALS = ("IICRC", "47496", "BFRS", "GBAC")


def public(v, removed, path=()):
    """The kit without its working record; every string left out is added to removed."""
    if isinstance(v, dict):
        out = {}
        for k, x in v.items():
            # a local file path is for the owner, and so is every note except a link's (the card shows that one)
            if k in PRIVATE or (k == "note" and path != ("person", "links")) or (isinstance(x, str) and x.startswith("file:")):
                removed.extend(strings(x))
            else:
                out[k] = public(x, removed, path + (k,))
        return out
    if isinstance(v, list):
        return [public(x, removed, path) for x in v]
    return v


def strings(v):
    if isinstance(v, dict):
        return [s for x in v.values() for s in strings(x)]
    if isinstance(v, list):
        return [s for x in v for s in strings(x)]
    return [v] if isinstance(v, str) else []


QR_LIB = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"
# Service worker: pages come from the network when there is one and from the saved copy when there isn't;
# everything else is saved on first use. Clips are streamed (range requests) and never saved.
SW = """// Built by build.py; do not edit by hand. Version {version}
const CACHE = "card-{version}";
const SHELL = {shell};
const OFFLINE = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<p style="font:16px/1.5 system-ui,sans-serif;padding:24px">You are offline, and this page was not saved on your phone. ' +
  '<a href="./">Open the card</a></p>';
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u =>
  c.add(new Request(u, u.startsWith("http") ? {{ mode: "no-cors" }} : {{}})).catch(() => {{}})))).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
  .then(() => self.clients.claim())));
self.addEventListener("fetch", e => {{
  const r = e.request;
  if (r.method !== "GET" || r.headers.has("range") || /\\.(mp4|webm)$/.test(new URL(r.url).pathname)) return;
  if (r.mode === "navigate") {{
    // only the card page itself replaces the offline copy: the contact file, the order page or an error page never do
    const u = new URL(r.url), scope = new URL(self.registration.scope).pathname;
    const card = u.origin === location.origin && (u.pathname === scope || u.pathname === scope + "index.html");
    e.respondWith(fetch(r).then(res => {{
      if (card && res.ok && (res.headers.get("content-type") || "").includes("text/html")) {{
        const copy = res.clone(); caches.open(CACHE).then(c => c.put("./", copy));
      }}
      return res;
    }}).catch(() => card ? caches.match("./") : caches.match(r, {{ ignoreSearch: true }}).then(hit => hit || new Response(OFFLINE,
      {{ status: 503, headers: {{ "Content-Type": "text/html; charset=utf-8" }} }}))));
    return;
  }}
  e.respondWith(caches.match(r, {{ ignoreSearch: true }}).then(hit => hit || fetch(r).then(res => {{
    if (res.ok || res.type === "opaque") {{ const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }}
    return res;
  }})));
}});
"""
TAIL = "\n</body>\n</html>\n"
MIME = {".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".mp4": "video/mp4", ".webm": "video/webm"}


# Same rule as SAFE_URL in card.html: plain https, no whitespace, quote or angle bracket (no javascript:, no CRLF injection)
SAFE_URL = re.compile(r'^https://[^\s"<>]+$')


# Phill 24/10/2026: the contact picture is the owner's logo or a photo of the owner. Never Margot, a film
# still or an edition poster, and small enough to sit inside a contact file.
PHOTO_KINDS = ("logo", "owner")
PHOTO_TYPES = {".png": ("PNG", b"\x89PNG\r\n\x1a\n"), ".jpg": ("JPEG", b"\xff\xd8\xff"), ".jpeg": ("JPEG", b"\xff\xd8\xff")}
PHOTO_NOT = re.compile(r"margot|films?/|edition|poster|reveal|hero", re.I)
PHOTO_MAX = 120_000


def contact_photo(person):
    """The contact picture as (vCard TYPE, base64), or the build stops with the reason."""
    cp = person.get("contactPhoto")
    if not isinstance(cp, dict):
        sys.exit("contact photo: the kit needs person.contactPhoto, the owner's logo or a photo of the owner")
    if cp.get("kind") not in PHOTO_KINDS:
        sys.exit(f"contact photo: kind must be logo or owner, not {cp.get('kind')!r}")
    rel = str(cp.get("file") or "")
    if not rel or PHOTO_NOT.search(rel):
        sys.exit(f"contact photo: {rel or 'no file'} is not the owner's logo or photo (no Margot, film or edition stills)")
    kind = PHOTO_TYPES.get(os.path.splitext(rel)[1].lower())
    path = os.path.join(REPO, rel)
    if not kind or not os.path.isfile(path):
        sys.exit(f"contact photo: {rel} must be an existing PNG or JPEG file")
    data = open(path, "rb").read()
    if not data.startswith(kind[1]):
        sys.exit(f"contact photo: {rel} is not really a {kind[0]}")
    if len(data) > PHOTO_MAX:
        sys.exit(f"contact photo: {rel} is {len(data)} bytes; use a copy of about 256 px (at most {PHOTO_MAX} bytes)")
    return kind[0], base64.b64encode(data).decode()


def esc(s):
    """vCard text value: escape \\ ; , and turn line breaks into \\n so no value can start a new field."""
    s = str(s).replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
    return re.sub(r"\r\n|\r|\n", r"\\n", s)


def raw(s):
    """vCard raw value (phone, email): line breaks dropped."""
    return re.sub(r"[\r\n]", "", str(s))


def vcard(p):
    """Mirror of vcard() in card.html; vCard 3.0 with CRLF line ends."""
    parts = (p.get("name") or "").split(" ")
    last = parts.pop() if len(parts) > 1 else ""
    first = " ".join(parts)
    lines = ["BEGIN:VCARD", "VERSION:3.0", f"N:{esc(last)};{esc(first)};;;", f"FN:{esc(p.get('name', ''))}"]
    if p.get("org"):
        lines.append("ORG:" + esc(p["org"]))
    if p.get("title"):
        lines.append("TITLE:" + esc(p.get("vcardTitle") or p["title"]))
    if p.get("vcardNicknames"):
        lines.append("NICKNAME:" + ",".join(esc(n) for n in p["vcardNicknames"]))
    for ph in p.get("phones", []):
        lines.append("TEL;TYPE=" + re.sub(r"[^A-Za-z,]", "", raw(ph.get("type", "VOICE"))) + ":" + raw(ph["tel"]))
    for e in p.get("emails", []):
        lines.append("EMAIL;TYPE=WORK:" + raw(e["value"]))
    # the saved contact always leads back to the live card
    if SAFE_URL.match(str(p.get("cardUrl") or "")):
        lines.append("URL:" + p["cardUrl"].rstrip("/") + "/")
    # the first two live links are the homepages; every other live business follows as a labelled link
    for i, link in enumerate([l for l in p.get("links", []) if SAFE_URL.match(str(l.get("url") or ""))], 1):
        lines += [f"item{i}.URL:{link['url']}", f"item{i}.X-ABLabel:" + ("_$!<HomePage>!$_" if i <= 2 else esc(link["label"]))]
    if p.get("vcardNote"):
        lines.append("NOTE:" + esc(p["vcardNote"]))
    photo_type, photo = contact_photo(p)
    lines.append(f"PHOTO;ENCODING=b;TYPE={photo_type}:{photo}")
    lines.append("END:VCARD")
    # Fold at 75 UTF-8 octets, including continuation spaces; never split a character.
    folded = []
    for line in lines:
        chunk = ""
        for char in line:
            if len((chunk + char).encode("utf-8")) > 75:
                folded.append(chunk)
                chunk = " "
            chunk += char
        folded.append(chunk)
    return "\r\n".join(folded) + "\r\n"


def main(card_path, kit_path, out):
    page = open(card_path, encoding="utf-8").read()
    if SLOT not in page:
        sys.exit("card.html has no empty brand-kit slot")
    kit = json.load(open(kit_path, encoding="utf-8"))
    if not kit.get("id") or not (kit.get("person") or {}).get("name"):
        sys.exit("brand kit needs an id and person.name")
    os.makedirs(os.path.join(out, "media"), exist_ok=True)
    photo_type, photo = contact_photo(kit["person"])
    hosted = json.loads(json.dumps(kit))   # served as files next to index.html
    preview = json.loads(json.dumps(kit))  # self-contained for a claude.ai preview: media as data URIs
    # the page's own Save builds the same contact, so it carries the picture itself, not its file path
    for k in (hosted, preview):
        k["person"]["contactPhoto"] = {"kind": kit["person"]["contactPhoto"]["kind"],
                                       "dataUri": f"data:image/{photo_type.lower()};base64,{photo}"}
    brand_h, brand_p = hosted.get("brand") or {}, preview.get("brand") or {}

    def media(rel):
        path = os.path.join(REPO, rel)
        mime = MIME.get(os.path.splitext(path)[1].lower())
        if not mime:
            sys.exit(f"unsupported media type: {path}")
        data = open(path, "rb").read()
        name = os.path.basename(path)
        with open(os.path.join(out, "media", name), "wb") as f:
            f.write(data)
        return "media/" + name, f"data:{mime};base64," + base64.b64encode(data).decode()

    logo = (kit.get("brand") or {}).get("logo") or {}
    if logo.get("status") == "found" and logo.get("file"):
        brand_h["logo"]["hostedUrl"], brand_p["logo"]["dataUri"] = media(logo["file"])
    # Demo video thumbnails (desktop screenshots) for the business panel; the videos themselves stay on YouTube
    for lh, lp in zip((hosted.get("person") or {}).get("links", []), (preview.get("person") or {}).get("links", [])):
        v = lh.get("video") or {}
        if v.get("youtubeId") and v.get("thumb"):
            lh["video"]["hostedThumb"], lp["video"]["thumbDataUri"] = media(v["thumb"])

    def clip(src, dst_h, dst_p, inline):
        """Ship one opener: files for the hosted page; data URIs in the preview only when inline is set."""
        if src.get("status") == "found" and src.get("video"):
            dst_h["hostedVideo"], uri = media(src["video"])
            if inline:
                dst_p["videoDataUri"] = uri
            if src.get("poster"):
                dst_h["hostedPoster"], puri = media(src["poster"])
                if inline:
                    dst_p["posterDataUri"] = puri

    hero = (kit.get("brand") or {}).get("hero") or {}
    clip(hero, brand_h.get("hero", {}), brand_p.get("hero", {}), True)
    # Margot's films: hosted only, so the preview stays small
    for name_, film in ((kit.get("brand") or {}).get("films") or {}).items():
        clip(film, brand_h["films"][name_], brand_p["films"][name_], False)
    # Editions (?edition=<name>): hosted only, so the preview stays small
    for name_, ed in ((kit.get("brand") or {}).get("editions") or {}).items():
        clip(ed, brand_h["editions"][name_], brand_p["editions"][name_], False)

    name = kit["person"]["name"]

    def render(k):
        removed = []
        shown = public(k, removed)
        # JSON is a JS literal; "<" never appears outside a string, so escaping it inside strings stops
        # </script> and <!-- from ending the script; U+2028/2029 are escaped for older parsers.
        embedded = (json.dumps(shown, ensure_ascii=False, separators=(",", ":"))
                    .replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))
        html = page.replace(SLOT, f'<script id="brand-kit">window.BRAND_KIT = {embedded};</script>')
        html = html.replace("<title>Living Card</title>", f"<title>{escape(name, quote=False)} Card</title>", 1)
        # the page must not carry anything the strip left out (unless the visitor-facing kit holds the same text)
        kept = set(strings(shown))
        leaked = sorted({r for r in removed if len(r) >= 12 and r not in kept
                         and (r in html or json.dumps(r, ensure_ascii=False)[1:-1].replace("<", "\\u003c") in html)})
        if leaked:
            sys.exit("kit working record reached the page: " + "; ".join(x[:60] for x in leaked))
        # any spelling, any neighbours; only inline media is left out, as its base64 holds these letters by chance
        text = re.sub(r"data:[\w.+-]+/[\w.+-]+;base64,[A-Za-z0-9+/=]+", "", html).lower()
        banned = [t for t in NO_CREDENTIALS if t.lower() in text]
        if banned:
            sys.exit("certification text reached the page: " + ", ".join(banned))
        return html

    # Home-screen app: only when the kit names its own app icons
    icons = (kit.get("brand") or {}).get("appIcons") or {}
    app = ""
    if icons.get("status") == "found" and icons.get("files"):
        shipped = {size: media(path)[0] for size, path in icons["files"].items()}
        theme = ((kit.get("brand") or {}).get("colours") or {}).get("primary", {}).get("value", "#000000")
        bg = icons.get("background", "#000000")
        manifest = {"name": name + " Card", "short_name": name.split(" ")[0] + "'s card", "id": "./",
                    "start_url": "./?me=1", "scope": "./", "display": "standalone",
                    "background_color": bg, "theme_color": bg,
                    "icons": [{"src": src, "sizes": f"{s}x{s}", "type": "image/png", "purpose": "any"}
                              for s, src in sorted(shipped.items(), key=lambda kv: int(kv[0])) if s != "180"]}
        with open(os.path.join(out, "manifest.webmanifest"), "w", encoding="utf-8", newline="\n") as f:
            json.dump(manifest, f, indent=2)
        # kit text reaches the head as HTML text or attribute values, so it is escaped there
        app = ('<link rel="manifest" href="manifest.webmanifest">\n'
               f'<link rel="apple-touch-icon" href="{escape(shipped.get("180", shipped[max(shipped, key=int)]))}">\n'
               f'<meta name="theme-color" content="{escape(bg)}">\n'
               '<meta name="apple-mobile-web-app-capable" content="yes">\n'
               '<meta name="mobile-web-app-capable" content="yes">\n'
               '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
               f'<meta name="apple-mobile-web-app-title" content="{escape(manifest["short_name"])}">\n')
        page_html = HEAD.replace("{app}", app) + render(hosted) + TAIL
        shell = ["./", kit["id"] + ".vcf", "manifest.webmanifest", QR_LIB] + sorted(set(shipped.values()))
        if brand_h.get("logo", {}).get("hostedUrl"):
            shell.append(brand_h["logo"]["hostedUrl"])
        for n in (kit.get("brand") or {}).get("rotation") or []:
            src = brand_h.get("hero") if n == "signature" else (brand_h.get("editions") or {}).get(n)
            if src and src.get("hostedPoster"):
                shell.append(src["hostedPoster"])
    else:
        shell = None
        page_html = HEAD.replace("{app}", "") + render(hosted) + TAIL
    with open(os.path.join(out, "index.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(page_html)
    with open(os.path.join(out, "preview.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(render(preview))
    with open(os.path.join(out, kit["id"] + ".vcf"), "w", encoding="utf-8", newline="") as f:
        f.write(vcard(kit["person"]))
    # Edition catalogue for the order page (and the unite-group.in showroom): portable plain data
    cat = []
    if (brand_h.get("hero") or {}).get("hostedPoster"):
        cat.append({"name": "signature", "label": "Signature reveal", "poster": brand_h["hero"]["hostedPoster"],
                    "video": brand_h["hero"].get("hostedVideo")})
    for n, e in (brand_h.get("editions") or {}).items():
        if e.get("hostedPoster"):
            cat.append({"name": n, "label": n.title() + " edition", "poster": e["hostedPoster"], "video": e.get("hostedVideo")})
    with open(os.path.join(out, "editions.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(cat, f, indent=2)
    # The unbranded template, for the live preview on get-your-card.html
    with open(os.path.join(out, "card-template.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(page)
    # Written last: the cache version covers every file the worker can save (pages, catalogue, media), so any
    # change to any of them gives a new cache and the old one is dropped
    if shell is not None:
        h = hashlib.sha256()
        for root, dirs, files in sorted(os.walk(out)):
            dirs.sort()
            for name in sorted(files):
                if name == "sw.js" or name.endswith(".pyc"):
                    continue
                p = os.path.join(root, name)
                h.update(os.path.relpath(p, out).encode("utf-8")); h.update(open(p, "rb").read())
        with open(os.path.join(out, "sw.js"), "w", encoding="utf-8", newline="\n") as f:
            f.write(SW.format(version=h.hexdigest()[:12], shell=json.dumps(shell)))


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
