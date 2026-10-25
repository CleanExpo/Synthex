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
