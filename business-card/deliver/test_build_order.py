"""Paid order -> built card. Run from the repository root: python3 -m pytest -q business-card/deliver

Every test runs build_order.py the way a person does (a separate process) on a copy of the sample order
in a temporary folder, so nothing here touches the sample, the network or any live service.
"""
import copy
import json
import os
import re
import shutil
import subprocess
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "build_order.py")
SAMPLE = json.load(open(os.path.join(HERE, "sample", "sample-order.json"), encoding="utf-8"))
LOGO = os.path.join(HERE, "sample", "sample-plumbing-co-logo.png")
SCHEMA = json.load(open(os.path.join(HERE, "order.schema.json"), encoding="utf-8"))
TEN = ["portal", "restoration", "blueprint", "forge", "constellation", "ink", "rewind", "skyline", "origami", "magnet"]


def run(tmp_path, order, out_name="out"):
    folder = tmp_path / "order"
    folder.mkdir(exist_ok=True)
    shutil.copy(LOGO, folder / "sample-plumbing-co-logo.png")
    path = folder / "order.json"
    path.write_text(json.dumps(order), encoding="utf-8")
    out = tmp_path / out_name
    r = subprocess.run([sys.executable, "-I", SCRIPT, str(path), str(out)], capture_output=True, text=True)
    return r, out


def kit_in(page):
    m = re.search(r'<script id="brand-kit">window\.BRAND_KIT = (\{.*?\});</script>', page, re.S)
    assert m, "the built page carries no brand kit"
    return json.loads(m.group(1))


def files(out):
    return sorted(os.path.relpath(os.path.join(r, n), out) for r, _, ns in os.walk(out) for n in ns)


def made_for_you():
    o = copy.deepcopy(SAMPLE)
    o["tier"], o["film"] = "made-for-you", "custom, pending proof"
    return o


# A valid ready-made order builds the card: the chosen film, every business link and the contact file.
def test_ready_made_order_builds_card_with_film_links_and_contact(tmp_path):
    r, out = run(tmp_path, SAMPLE)
    assert r.returncode == 0, r.stderr
    page = (out / "card" / "index.html").read_text(encoding="utf-8")
    kit = kit_in(page)
    film = kit["brand"]["editions"]["restoration"]
    assert film["status"] == "found" and film["hostedVideo"] == "media/edition-restoration.mp4"
    assert (out / "card" / "media" / "edition-restoration.mp4").stat().st_size > 100_000
    assert kit["brand"]["rotation"] == ["restoration"]
    assert [l["url"] for l in kit["person"]["links"]] == ["https://example.com", "https://hotwater.example.com"]
    vcf = (out / "card" / f"{kit['id']}.vcf").read_text(encoding="utf-8")
    for line in ("FN:Sam Sample", "EMAIL;TYPE=WORK:sam@example.com", "TEL;TYPE=CELL:+61400555123",
                 "item1.URL:https://example.com", "item2.URL:https://hotwater.example.com", "PHOTO;ENCODING=b;TYPE=PNG:"):
        assert line in vcf, line
    proof = (out / "PROOF.md").read_text(encoding="utf-8")
    assert "SAMPLE-0001" in proof and "restoration" in proof
    assert "FILM PENDING" not in proof


# Only the chosen film ships: none of the other nine, and none of Margot's explainer films.
def test_ready_made_ships_only_the_chosen_film(tmp_path):
    r, out = run(tmp_path, SAMPLE)
    assert r.returncode == 0, r.stderr
    videos = [f for f in files(out) if f.endswith((".mp4", ".webm"))]
    assert videos == [os.path.join("card", "media", "edition-restoration.mp4")]


# A made-for-you order builds a proof that says plainly the film is pending, and ships no film at all.
def test_made_for_you_builds_proof_with_film_pending_and_no_film(tmp_path):
    r, out = run(tmp_path, made_for_you())
    assert r.returncode == 0, r.stderr
    proof = (out / "PROOF.md").read_text(encoding="utf-8")
    assert "FILM PENDING" in proof
    assert not [f for f in files(out) if f.endswith((".mp4", ".webm"))]
    kit = kit_in((out / "card" / "index.html").read_text(encoding="utf-8"))
    assert not kit["brand"].get("editions") and not kit["brand"].get("hero") and not kit["brand"].get("films")


# Every required field, left out, refuses the order with that field's name, and builds nothing.
@pytest.mark.parametrize("field", SCHEMA["required"])
def test_each_missing_required_field_refuses_by_name(tmp_path, field):
    order = copy.deepcopy(SAMPLE)
    del order[field]
    r, out = run(tmp_path, order)
    assert r.returncode != 0
    assert f"missing required field '{field}'" in r.stderr, r.stderr
    assert not out.exists() or not os.listdir(out)


# Blank text counts as missing: no name, role or link is ever filled in for the buyer.
@pytest.mark.parametrize("field", ["buyer_name", "role", "email"])
def test_blank_text_refuses_by_name(tmp_path, field):
    order = copy.deepcopy(SAMPLE)
    order[field] = "   "
    r, _ = run(tmp_path, order)
    assert r.returncode != 0 and f"'{field}'" in r.stderr, r.stderr


def test_business_without_link_refuses(tmp_path):
    order = copy.deepcopy(SAMPLE)
    del order["businesses"][1]["url"]
    r, _ = run(tmp_path, order)
    assert r.returncode != 0 and "businesses[1]" in r.stderr and "'url'" in r.stderr, r.stderr


def test_unsafe_link_refuses(tmp_path):
    order = copy.deepcopy(SAMPLE)
    order["businesses"][0]["url"] = "javascript:alert(1)"
    r, _ = run(tmp_path, order)
    assert r.returncode != 0 and "businesses[0]" in r.stderr, r.stderr


# The tier and the film must agree: no ready-made order without one of the ten films, no fake custom film.
def test_ready_made_without_one_of_the_ten_films_refuses(tmp_path):
    order = copy.deepcopy(SAMPLE)
    order["film"] = "custom, pending proof"
    r, _ = run(tmp_path, order)
    assert r.returncode != 0 and "'film'" in r.stderr, r.stderr


def test_made_for_you_with_a_ready_made_film_refuses(tmp_path):
    order = made_for_you()
    order["film"] = "portal"
    r, _ = run(tmp_path, order)
    assert r.returncode != 0 and "'film'" in r.stderr, r.stderr


def test_unknown_film_refuses(tmp_path):
    order = copy.deepcopy(SAMPLE)
    order["film"] = "sunset"
    r, _ = run(tmp_path, order)
    assert r.returncode != 0 and "'film'" in r.stderr, r.stderr


# Extra businesses paid for must match the businesses listed.
def test_extra_business_count_mismatch_refuses(tmp_path):
    order = copy.deepcopy(SAMPLE)
    order["extra_businesses"] = 0
    r, _ = run(tmp_path, order)
    assert r.returncode != 0 and "'extra_businesses'" in r.stderr, r.stderr


# No payment data in an order: any field the format does not name is refused.
def test_payment_data_refuses(tmp_path):
    order = copy.deepcopy(SAMPLE)
    order["card_number"] = "4242424242424242"
    r, _ = run(tmp_path, order)
    assert r.returncode != 0 and "'card_number'" in r.stderr, r.stderr


def test_missing_logo_file_refuses(tmp_path):
    order = copy.deepcopy(SAMPLE)
    order["logo_file"] = "not-there.png"
    r, _ = run(tmp_path, order)
    assert r.returncode != 0 and "'logo_file'" in r.stderr, r.stderr


def test_colour_without_source_refuses(tmp_path):
    order = copy.deepcopy(SAMPLE)
    del order["colour_source"]
    r, _ = run(tmp_path, order)
    assert r.returncode != 0 and "'colour_source'" in r.stderr, r.stderr


# An explicit "no phone" is allowed and leaves the phone off the card and the contact.
def test_phone_null_means_no_phone(tmp_path):
    order = copy.deepcopy(SAMPLE)
    order["phone"] = None
    r, out = run(tmp_path, order)
    assert r.returncode == 0, r.stderr
    kit = kit_in((out / "card" / "index.html").read_text(encoding="utf-8"))
    assert kit["person"]["phones"] == []
    assert "TEL" not in (out / "card" / f"{kit['id']}.vcf").read_text(encoding="utf-8")


# A build never mixes with an earlier one.
def test_non_empty_out_dir_refuses(tmp_path):
    (tmp_path / "out").mkdir()
    (tmp_path / "out" / "old.txt").write_text("earlier build")
    r, _ = run(tmp_path, SAMPLE)
    assert r.returncode != 0 and "out_dir" in r.stderr, r.stderr


# An order with extra businesses renders every one of them: on the page, on the shelf and in the contact.
def test_extra_business_order_renders_every_business(tmp_path):
    order = copy.deepcopy(SAMPLE)
    order["businesses"].append({"name": "Sample Gas Fitting", "url": "https://gas.example.com", "note": "Gas, Brisbane"})
    order["extra_businesses"] = 2
    r, out = run(tmp_path, order)
    assert r.returncode == 0, r.stderr
    kit = kit_in((out / "card" / "index.html").read_text(encoding="utf-8"))
    links = kit["person"]["links"]
    assert [l["label"] for l in links] == ["Sample Plumbing Co", "Sample Hot Water", "Sample Gas Fitting"]
    assert all(l["visitor"] for l in links)
    vcf = (out / "card" / f"{kit['id']}.vcf").read_text(encoding="utf-8")
    assert "item3.URL:https://gas.example.com" in vcf and "item3.X-ABLabel:Sample Gas Fitting" in vcf
    proof = (out / "PROOF.md").read_text(encoding="utf-8")
    for b in order["businesses"]:
        assert b["name"] in proof and b["url"] in proof


# The schema file and the builder agree on the ten films and the required fields.
def test_schema_and_builder_agree():
    sys.path.insert(0, HERE)
    try:
        import build_order
    finally:
        sys.path.pop(0)
    assert list(build_order.REQUIRED) == SCHEMA["required"]
    assert list(build_order.FILMS) == TEN == SCHEMA["properties"]["film"]["enum"][:10]


# Only card/ is ever hosted: the proof, the kit and the order stay beside it, and no local path reaches the page.
def test_working_record_stays_out_of_the_hosted_folder(tmp_path):
    r, out = run(tmp_path, SAMPLE)
    assert r.returncode == 0, r.stderr
    assert sorted(os.listdir(out)) == ["PROOF.md", "brand-kit.json", "card", "order.json"]
    card = files(out / "card")
    assert not [f for f in card if f.endswith(("PROOF.md", "brand-kit.json", "order.json"))]
    page = (out / "card" / "index.html").read_text(encoding="utf-8")
    # repo-relative media paths ride along in the kit as they do on every card build.py makes; no machine path may
    assert "file:" not in page and str(tmp_path) not in page and os.path.dirname(os.path.dirname(HERE)) not in page


# The buyer's logo is staged inside the repository only while build.py runs.
def test_staged_logo_is_removed(tmp_path):
    r, _ = run(tmp_path, SAMPLE)
    assert r.returncode == 0, r.stderr
    work = os.path.join(HERE, ".work")
    assert not os.path.exists(work) or not os.listdir(work)


# A buyer's card is not the Unite-Group Nexus: its business shelf is named for the buyer, and says what a tap does.
def test_buyer_card_shelf_is_not_named_unite_group(tmp_path):
    r, out = run(tmp_path, SAMPLE)
    assert r.returncode == 0, r.stderr
    kit = kit_in((out / "card" / "index.html").read_text(encoding="utf-8"))
    assert kit["brand"]["shelf"] == {"title": "Sam's businesses", "text": "Tap one to visit its website."}
    template = open(os.path.join(os.path.dirname(HERE), "card.html"), encoding="utf-8").read()
    assert 'B.shelf' in template, "card.html does not read the kit's shelf heading"


# ---- review round 1 (Codex, head 192448df): loud refusals, one reading of the order, a clean hosted folder ----

def run_raw(tmp_path, order_text, logo_bytes=None, out_name="out"):
    """Like run(), but the order is given as JSON text and the logo may be any bytes (the buyer's file as it arrives)."""
    folder = tmp_path / "order"
    folder.mkdir(exist_ok=True)
    if logo_bytes is None:
        shutil.copy(LOGO, folder / "sample-plumbing-co-logo.png")
    else:
        (folder / "sample-plumbing-co-logo.png").write_bytes(logo_bytes)
    path = folder / "order.json"
    path.write_text(order_text, encoding="utf-8")
    out = tmp_path / out_name
    r = subprocess.run([sys.executable, "-I", SCRIPT, str(path), str(out)], capture_output=True, text=True)
    return r, out


def refused_cleanly(r, out):
    assert r.returncode != 0
    assert r.stderr.startswith("REFUSED:"), r.stderr[-400:]
    assert "Traceback" not in r.stderr
    assert not out.exists() or not os.listdir(out), "a refused order must build nothing"


def bad_value(field, value):
    o = made_for_you()
    o[field] = value
    return o


WRONG_TYPES = [("tier", []), ("tier", {}), ("order_ref", 123), ("order_ref", True), ("film", []), ("logo_file", ""),
               ("logo_file", False), ("logo_file", 0), ("logo_file", []), ("logo_file", {}),
               ("buyer_name", 123), ("role", []), ("email", 5), ("brand_colour", 123)]


# Wrong JSON types refuse by field name with the REFUSED prefix, never a Python traceback, and build nothing.
@pytest.mark.parametrize("field,value", WRONG_TYPES, ids=[f"{f}={v!r}" for f, v in WRONG_TYPES])
def test_wrong_json_type_refuses_without_traceback(tmp_path, field, value):
    o = bad_value(field, value)
    if field == "brand_colour":
        o["colour_source"] = "x"
    r, out = run(tmp_path, o)
    refused_cleanly(r, out)


@pytest.mark.parametrize("value", [123, True])
def test_colour_source_must_be_text(tmp_path, value):
    o = made_for_you()
    o["brand_colour"], o["colour_source"] = "#abcdef", value
    r, out = run(tmp_path, o)
    refused_cleanly(r, out)


# A value with a trailing line break is not the value it looks like: nothing may pass on that.
@pytest.mark.parametrize("field,value", [("order_ref", "ABC-123\n"), ("email", "sam@example.com\n"), ("tier", "made-for-you\n")])
def test_trailing_line_break_refuses(tmp_path, field, value):
    r, out = run(tmp_path, bad_value(field, value))
    refused_cleanly(r, out)


def test_trailing_line_break_in_colour_and_link_refuses(tmp_path):
    o = made_for_you()
    o["brand_colour"], o["colour_source"] = "#abcdef\n", "x"
    r, out = run(tmp_path, o)
    refused_cleanly(r, out)
    o = made_for_you()
    o["businesses"][0]["url"] = "https://example.com\n"
    r, out = run(tmp_path, o, "out2")
    refused_cleanly(r, out)


def test_order_that_is_not_an_object_refuses(tmp_path):
    r, out = run_raw(tmp_path, "[]")
    refused_cleanly(r, out)


# A key given twice is two answers to one question. The builder will not pick one for the buyer.
def test_duplicate_top_level_key_refuses(tmp_path):
    raw = json.dumps(made_for_you())
    r, out = run_raw(tmp_path, '{"tier": "ready-made", ' + raw[1:])
    refused_cleanly(r, out)
    assert "duplicate" in r.stderr and "tier" in r.stderr


def test_duplicate_key_inside_a_business_refuses(tmp_path):
    raw = json.dumps(made_for_you()).replace('"url": "https://example.com"',
                                              '"url": "https://a.example.com", "url": "https://example.com"')
    assert raw.count('"url": "https://a.example.com"') == 1
    r, out = run_raw(tmp_path, raw)
    refused_cleanly(r, out)
    assert "duplicate" in r.stderr and "url" in r.stderr


# ---- the buyer's logo reaches the hosted folder with its pixels and nothing else ----
MARK = b"PLANTED-PRIVATE-METADATA-MARKER"


def png_with_extra_chunks():
    import struct
    import zlib
    data = open(LOGO, "rb").read()

    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xffffffff)
    extra = (chunk(b"tEXt", b"Comment\0buyer_folder=/private/buyer/files " + MARK)
             + chunk(b"iTXt", b"XML:com.adobe.xmp\0\0\0\0\0" + MARK)
             + chunk(b"eXIf", MARK))
    head = data[:8 + 25]                   # signature + the whole IHDR chunk
    return head + extra + data[8 + 25:] + b"TRAILING-" + MARK


def decoded_views(blob):
    """The raw bytes, plus every long base64 run inside them decoded: the shapes a logo takes inside the page and contact."""
    import base64
    views = [blob]
    for m in re.finditer(rb"[A-Za-z0-9+/=\r\n ]{120,}", blob):
        try:
            views.append(base64.b64decode(re.sub(rb"[\r\n ]", b"", m.group(0))))
        except ValueError:
            pass
    return views


def hosted_has(out, needle):
    for root, _, names in os.walk(out / "card"):
        for n in names:
            blob = open(os.path.join(root, n), "rb").read()
            if any(needle in v for v in decoded_views(blob)):
                return os.path.join(root, n)
    return None


def test_planted_marker_is_found_when_present():
    """The search itself can fail: a hosted file that holds the marker, raw or inside base64, is reported."""
    import base64
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        os.makedirs(os.path.join(d, "card"))
        with open(os.path.join(d, "card", "a.html"), "wb") as f:
            f.write(b"<img src=\"data:image/png;base64," + base64.b64encode(b"A" * 100 + MARK + b"B" * 100) + b"\">")
        from pathlib import Path
        assert hosted_has(Path(d), MARK) is not None


def test_png_metadata_never_reaches_the_hosted_folder(tmp_path):
    raw = png_with_extra_chunks()
    assert MARK in raw
    r, out = run_raw(tmp_path, json.dumps(made_for_you()), raw)
    assert r.returncode == 0, r.stderr
    assert hosted_has(out, MARK) is None
    assert hosted_has(out, b"buyer_folder") is None
    shipped = list((out / "card" / "media").glob("*.png"))
    assert shipped
    for p in shipped:
        assert p.read_bytes().startswith(b"\x89PNG\r\n\x1a\n") and p.read_bytes().endswith(b"IEND\xaeB`\x82")


def test_png_with_a_bad_checksum_refuses(tmp_path):
    data = bytearray(open(LOGO, "rb").read())
    data[8 + 8 + 5] ^= 0xFF                # a byte inside IHDR: the checksum no longer matches
    r, out = run_raw(tmp_path, json.dumps(made_for_you()), bytes(data))
    refused_cleanly(r, out)


# ---- a valid link is never refused for being long or not plain ASCII ----
@pytest.mark.parametrize("url", ["https://example.com/service?campaign=" + "x" * 90,
                                 "https://example.com/café/店"])
def test_long_and_non_ascii_links_build(tmp_path, url):
    o = made_for_you()
    o["businesses"][0]["url"] = url
    r, out = run(tmp_path, o)
    assert r.returncode == 0, r.stderr
    page = (out / "card" / "index.html").read_text(encoding="utf-8")
    assert url in [l["url"] for l in kit_in(page)["person"]["links"]]


# ---- review round 2 (Codex, head 724a4633): text that cannot be written, and JSON nested too deep to read ----
@pytest.mark.parametrize("path", ["buyer_name", "role", "email", "colour_source", "businesses.0.name", "businesses.0.note",
                                  "businesses.0.url"])
def test_unpaired_surrogate_refuses_by_field_and_leaves_no_partial_output(tmp_path, path):
    o = made_for_you()
    o["brand_colour"], o["colour_source"] = "#abcdef", "from the buyer"
    o["businesses"][0]["note"] = "a note"
    node = o
    *head, last = path.split(".")
    for part in head:
        node = node[int(part)] if part.isdigit() else node[part]
    node[last] = {"url": "https://example.com/\ud800", "email": "sam\ud800@example.com"}.get(last, "Sam \ud800 Sample")
    r, out = run_raw(tmp_path, json.dumps(o))          # json.dumps writes the escape \ud800, as a buyer's JSON would
    refused_cleanly(r, out)
    assert "Unicode" in r.stderr


def test_json_nested_too_deep_refuses(tmp_path):
    r, out = run_raw(tmp_path, "[" * 5000 + "]" * 5000)
    refused_cleanly(r, out)


# Deeply nested but still readable JSON is refused by the order checks, not by a stack overflow.
@pytest.mark.parametrize("depth", [600, 900])
def test_deeply_nested_readable_json_refuses_cleanly(tmp_path, depth):
    raw = json.dumps(made_for_you())
    r, out = run_raw(tmp_path, raw[:-1] + ', "extra": ' + "[" * depth + "]" * depth + "}")
    refused_cleanly(r, out)


# ---- review round 3 (Codex, head 03ac4bf3): every byte of the logo that is not picture is dropped; unreadable logo refuses ----
def png_chunks(data):
    import struct
    out, pos = [], 8
    while pos < len(data):
        n = struct.unpack(">I", data[pos:pos + 4])[0]
        out.append((data[pos + 4:pos + 8], data[pos + 8:pos + 8 + n]))
        pos += 12 + n
    return out


def png_from(chunks):
    import struct
    import zlib
    return b"\x89PNG\r\n\x1a\n" + b"".join(
        struct.pack(">I", len(b)) + k + b + struct.pack(">I", zlib.crc32(k + b) & 0xffffffff) for k, b in chunks)


def build_with_logo(tmp_path, logo_bytes, ext="png"):
    o = made_for_you()
    o["logo_file"] = f"logo.{ext}"
    folder = tmp_path / "order"
    folder.mkdir()
    (folder / f"logo.{ext}").write_bytes(logo_bytes)
    (folder / "order.json").write_text(json.dumps(o), encoding="utf-8")
    out = tmp_path / "out"
    r = subprocess.run([sys.executable, "-I", SCRIPT, str(folder / "order.json"), str(out)], capture_output=True, text=True)
    return r, out


def png_variants():
    import zlib
    chunks = png_chunks(open(LOGO, "rb").read())
    ihdr = chunks[0][1]
    idat = b"".join(b for k, b in chunks if k == b"IDAT")
    return {
        "bytes-in-IEND": [c for c in chunks if c[0] != b"IEND"] + [(b"IEND", MARK)],
        "unused-bytes-after-the-zlib-stream": [(b"IHDR", ihdr), (b"IDAT", idat + MARK), (b"IEND", b"")],
        "hidden-in-a-second-IDAT": [(b"IHDR", ihdr), (b"IDAT", idat), (b"IDAT", MARK), (b"IEND", b"")],
    }


@pytest.mark.parametrize("name", ["bytes-in-IEND", "unused-bytes-after-the-zlib-stream", "hidden-in-a-second-IDAT"])
def test_png_payload_that_a_decoder_ignores_never_reaches_the_hosted_folder(tmp_path, name):
    raw = png_from(png_variants()[name])
    assert MARK in raw
    r, out = build_with_logo(tmp_path, raw)
    if r.returncode != 0:                      # refusing it is also a clean answer; shipping it is not
        refused_cleanly(r, out)
    else:
        assert hosted_has(out, MARK) is None


def test_png_pictures_still_look_the_same_after_cleaning(tmp_path):
    import zlib
    r, out = build_with_logo(tmp_path, open(LOGO, "rb").read())
    assert r.returncode == 0, r.stderr
    shipped = (next((out / "card" / "media").glob("*.png"))).read_bytes()
    pix = lambda d: zlib.decompress(b"".join(b for k, b in png_chunks(d) if k == b"IDAT"))
    assert pix(shipped) == pix(open(LOGO, "rb").read())


def test_interlaced_or_cut_short_png_refuses(tmp_path):
    chunks = png_chunks(open(LOGO, "rb").read())
    ihdr = bytearray(chunks[0][1])
    ihdr[12] = 1                                                   # Adam7 interlacing
    r, out = build_with_logo(tmp_path, png_from([(b"IHDR", bytes(ihdr))] + chunks[1:]))
    refused_cleanly(r, out)
    idat = b"".join(b for k, b in chunks if k == b"IDAT")
    (tmp_path / "b").mkdir()
    r, out2 = build_with_logo(tmp_path / "b", png_from([chunks[0], (b"IDAT", idat[:len(idat) // 2]), chunks[-1]]))
    refused_cleanly(r, out2)


def noise_png(width, height, seed=1):
    """Grey noise stored without compression: recompressing it adds a few bytes of block headers."""
    import random
    import struct
    import zlib
    rnd = random.Random(seed)
    raw = b"".join(b"\0" + bytes(rnd.getrandbits(8) for _ in range(width)) for _ in range(height))
    return png_from([(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0)),
                     (b"IDAT", zlib.compress(raw, 0)), (b"IEND", b"")])


def test_logo_that_grows_past_the_limit_when_cleaned_refuses_with_nothing_built(tmp_path):
    raw = noise_png(584, 205)
    assert len(raw) <= 120_000                 # the buyer's file is under the limit; the cleaned copy is not
    r, out = build_with_logo(tmp_path, raw)
    refused_cleanly(r, out)
    assert "after cleaning" in r.stderr


def palette_png(extra):
    """A 2x2 palette picture with any extra chunks placed between the palette and the picture data."""
    import struct
    import zlib
    return png_from([(b"IHDR", struct.pack(">IIBBBBB", 2, 2, 8, 3, 0, 0, 0)), (b"PLTE", bytes(6))] + extra
                    + [(b"IDAT", zlib.compress(b"\0\0\1\0\1\0")), (b"IEND", b"")])


@pytest.mark.parametrize("extra", [
    [(b"tRNS", b"\0"), (b"tRNS", MARK)],                        # a second transparency chunk
    [(b"PLTE", MARK)],                                          # a second palette
    [(b"tRNS", b"\0" * 3 + MARK)],                              # more transparency entries than colours
    [(b"IHDR", MARK)],                                          # a second header
], ids=["second-tRNS", "second-PLTE", "oversized-tRNS", "second-IHDR"])
def test_png_palette_or_transparency_carrying_extra_bytes_refuses(tmp_path, extra):
    raw = palette_png(extra)
    assert MARK in raw
    r, out = build_with_logo(tmp_path, raw)
    refused_cleanly(r, out)


def test_png_palette_with_transparency_still_builds(tmp_path):
    r, out = build_with_logo(tmp_path, palette_png([(b"tRNS", b"\0\xff")]))
    assert r.returncode == 0, r.stderr


def test_cleaned_png_writes_palette_before_transparency(tmp_path):
    import struct
    import zlib
    raw = png_from([(b"IHDR", struct.pack(">IIBBBBB", 2, 2, 8, 3, 0, 0, 0)), (b"tRNS", b"\0\xff"), (b"PLTE", bytes(6)),
                    (b"IDAT", zlib.compress(b"\0\0\1\0\1\0")), (b"IEND", b"")])
    r, out = build_with_logo(tmp_path, raw)
    if r.returncode != 0:
        refused_cleanly(r, out)
    else:
        shipped = next((out / "card" / "media").glob("*.png")).read_bytes()
        assert [k for k, _ in png_chunks(shipped)] == [b"IHDR", b"PLTE", b"tRNS", b"IDAT", b"IEND"]


def test_jpeg_logo_refuses_and_says_how_to_reexport(tmp_path):
    """A JPEG cannot be rebuilt from its pixels without an image library, so it is refused, never filtered."""
    jpeg = b"\xff\xd8\xff\xe1\x00\x30Exif\0\0" + MARK + b"\xff\xd9"
    r, out = build_with_logo(tmp_path, jpeg, "jpg")
    refused_cleanly(r, out)
    assert "must be a PNG" in r.stderr and "sips -s format png" in r.stderr
    assert not out.exists() or hosted_has(out, MARK) is None


def test_full_colour_png_suggested_palette_never_ships(tmp_path):
    import struct
    import zlib
    pad = MARK + b"\0" * (-len(MARK) % 3)                     # a legal-length suggested palette carrying text
    raw = png_from([(b"IHDR", struct.pack(">IIBBBBB", 2, 2, 8, 2, 0, 0, 0)), (b"PLTE", pad),
                    (b"IDAT", zlib.compress(b"\0" + bytes(6) + b"\0" + bytes(6))), (b"IEND", b"")])
    r, out = build_with_logo(tmp_path, raw)
    assert r.returncode == 0, r.stderr
    assert hosted_has(out, MARK) is None


def test_png_with_unknown_compression_method_refuses(tmp_path):
    import struct
    raw = png_from([(b"IHDR", struct.pack(">IIBBBBB", 2, 2, 8, 0, 1, 0, 0)),
                    (b"IDAT", __import__("zlib").compress(b"\0\0\0\0\0\0")), (b"IEND", b"")])
    r, out = build_with_logo(tmp_path, raw)
    refused_cleanly(r, out)


def test_unreadable_logo_refuses_by_name_with_nothing_built(tmp_path):
    o = made_for_you()
    folder = tmp_path / "order"
    folder.mkdir()
    logo = folder / "sample-plumbing-co-logo.png"
    shutil.copy(LOGO, logo)
    (folder / "order.json").write_text(json.dumps(o), encoding="utf-8")
    out = tmp_path / "out"
    os.chmod(logo, 0)
    try:
        r = subprocess.run([sys.executable, "-I", SCRIPT, str(folder / "order.json"), str(out)], capture_output=True, text=True)
    finally:
        os.chmod(logo, 0o644)
    if os.access(logo, os.R_OK) and r.returncode == 0:
        pytest.skip("this account can read a mode-000 file")
    refused_cleanly(r, out)
    assert "logo_file" in r.stderr


# ---- lead ruling 26/10: the pixel re-export is a required, recorded step ----
REEXPORT = "logo re-exported with `sips -s format png`"


def test_proof_checklist_has_an_unticked_logo_reexport_item(tmp_path):
    for order in (SAMPLE, made_for_you()):
        r, out = run(tmp_path, order, "out-" + order["tier"])
        assert r.returncode == 0, r.stderr
        proof = (out / "PROOF.md").read_text(encoding="utf-8")
        assert f"- [ ] The {REEXPORT}" in proof
        assert "equivalent re-encode" in proof and "EXIF, GPS" in proof
        assert not [l for l in proof.splitlines() if "re-exported" in l and "[x]" in l.lower()]


def test_runbook_tells_the_builder_to_reexport_the_logo():
    text = open(os.path.join(HERE, "RUNBOOK.md"), encoding="utf-8").read()
    assert "sips -s format png" in text and "equivalent re-encode" in text
