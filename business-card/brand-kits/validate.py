"""Validate card brand kits. Usage: python3 -I validate.py kit.json [kit.json ...]

The rule (same as real-images-only): every brand value comes from the business's own sources and
says which one, or is marked missing. Nothing is invented and nothing is silently filled in.
Exit 0 when every kit passes; exit 1 and list the problems otherwise.
"""
import json
import re
import sys

HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")


def sourced(entry):
    return isinstance(entry, dict) and isinstance(entry.get("source"), str) and entry["source"].strip() != ""


def missing(entry):
    return isinstance(entry, dict) and entry.get("status") == "missing"


def check(kit):
    errs = []
    b = kit.get("brand")
    if not isinstance(b, dict) or not b.get("name"):
        return ["brand.name is required"]
    if not isinstance(kit.get("person"), dict) or not kit["person"].get("name"):
        errs.append("person.name is required")

    logo = b.get("logo")
    if not (missing(logo) or (sourced(logo) and logo.get("status") == "found" and logo.get("url"))):
        errs.append("logo must be found (url + source) or marked missing")

    colours = b.get("colours")
    if not isinstance(colours, dict) or not colours:
        errs.append("colours must list each role, found or missing")
    else:
        for role, c in colours.items():
            if missing(c):
                continue
            if not (sourced(c) and HEX.match(str(c.get("value", "")))):
                errs.append(f"colour '{role}' needs a #RRGGBB value and a source, or status missing")

    for role, f in (b.get("fonts") or {}).items():
        if missing(f):
            if not f.get("fallback"):
                errs.append(f"font '{role}' is missing but names no open fallback")
            continue
        if not (sourced(f) and f.get("family") and f.get("licence") and isinstance(f.get("embedAllowed"), bool)):
            errs.append(f"font '{role}' needs family, source, licence and embedAllowed")
        elif not f["embedAllowed"] and not f.get("fallback"):
            errs.append(f"font '{role}' may not be embedded and names no open fallback")

    about = b.get("about")
    if not (missing(about) or (sourced(about) and about.get("text"))):
        errs.append("about must have text + source, or be marked missing")

    for i, s in enumerate(b.get("services") or []):
        if not (sourced(s) and s.get("name")):
            errs.append(f"service #{i + 1} needs a name and a source")
    return errs


def main(paths):
    bad = 0
    for p in paths:
        try:
            kit = json.load(open(p, encoding="utf-8"))
        except (OSError, ValueError) as e:
            print(f"{p}: unreadable ({e})")
            bad += 1
            continue
        errs = check(kit)
        if errs:
            bad += 1
            print(f"{p}: FAIL")
            for e in errs:
                print(f"  - {e}")
        else:
            print(f"{p}: ok")
    return 1 if bad or not paths else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
