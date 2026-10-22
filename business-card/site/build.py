"""Build one business's card from the template and its brand kit.

Usage: python3 -I build.py <card.html> <brand-kit.json> <out_dir>

Writes to out_dir:
  index.html      the hosted page (full document, window.CARD_HOSTED = true)
  <kit id>.vcf    the contact file the Save button opens
  preview.html    the same card for a claude.ai preview (not hosted mode)
  card-template.html  the unbranded template, which get-your-card.html fills for its live preview
  media/          the logo and hero clip named in the kit, served as files by the hosted page
The logo and hero clip ("file", "video", "poster", relative to the repository root) are copied into
media/ for the hosted page and embedded as data URIs in preview.html, so neither loads anything from
another host. vercel.json is kept by hand.
"""
import base64
import json
import os
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SLOT = '<script id="brand-kit" type="application/json">{}</script>'
HEAD = (
    '<!doctype html>\n<html lang="en-AU">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
    '<meta name="robots" content="noindex">\n'
    '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
    'body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
    '<script>window.CARD_HOSTED = true;</script>\n</head>\n<body>\n'
)
TAIL = "\n</body>\n</html>\n"
MIME = {".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".mp4": "video/mp4", ".webm": "video/webm"}


def esc(s):
    return str(s).replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")


def vcard(p):
    """Mirror of vcard() in card.html; vCard 3.0 with CRLF line ends."""
    parts = (p.get("name") or "").split(" ")
    last = parts.pop() if len(parts) > 1 else ""
    first = " ".join(parts)
    lines = ["BEGIN:VCARD", "VERSION:3.0", f"N:{esc(last)};{esc(first)};;;", f"FN:{esc(p.get('name', ''))}"]
    if p.get("org"):
        lines.append("ORG:" + esc(p["org"]))
    if p.get("title"):
        lines.append("TITLE:" + esc(p["title"].split(",")[0]))
    for ph in p.get("phones", []):
        lines.append(f"TEL;TYPE={ph.get('type', 'VOICE')}:{ph['tel']}")
    for e in p.get("emails", []):
        lines.append("EMAIL;TYPE=WORK:" + e["value"])
    for link in [l for l in p.get("links", []) if l.get("url")][:2]:
        lines.append("URL:" + link["url"])
    if p.get("vcardNote"):
        lines.append("NOTE:" + esc(p["vcardNote"]))
    lines.append("END:VCARD")
    return "\r\n".join(lines) + "\r\n"


def main(card_path, kit_path, out):
    page = open(card_path, encoding="utf-8").read()
    if SLOT not in page:
        sys.exit("card.html has no empty brand-kit slot")
    kit = json.load(open(kit_path, encoding="utf-8"))
    if not kit.get("id") or not (kit.get("person") or {}).get("name"):
        sys.exit("brand kit needs an id and person.name")
    os.makedirs(os.path.join(out, "media"), exist_ok=True)
    hosted = json.loads(json.dumps(kit))   # served as files next to index.html
    preview = json.loads(json.dumps(kit))  # self-contained for a claude.ai preview: media as data URIs
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
    # Editions (?edition=<name>): hosted only, so the preview stays small
    for name_, ed in ((kit.get("brand") or {}).get("editions") or {}).items():
        clip(ed, brand_h["editions"][name_], brand_p["editions"][name_], False)

    name = kit["person"]["name"]

    def render(k):
        embedded = json.dumps(k, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
        html = page.replace(SLOT, f'<script id="brand-kit" type="application/json">{embedded}</script>')
        return html.replace("<title>Living Card</title>", f"<title>{name} Card</title>", 1)

    with open(os.path.join(out, "index.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(HEAD + render(hosted) + TAIL)
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


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
