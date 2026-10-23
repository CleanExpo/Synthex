"""Render one business's film in several styles, as stills, for the concept board and the critic.

Usage: python3 -I variants.py <media dir> <id> [style ...]   (no styles = every style in styles/)
Needs <media>/<id>/cine/film.json from prepare.py. Writes <media>/<id>/cine/variants/<style>--<shot>.png for four shots
(pieces arriving, the first site screen settled, the steps tiles, the logo lock) plus a contact sheet, board.jpg. Words, screens,
photos and narration are identical across styles; only the treatment changes.
"""
import glob
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))


def main():
    media, bid, wanted = os.path.abspath(sys.argv[1]), sys.argv[2], sys.argv[3:]
    cine = os.path.join(media, bid, "cine")
    film = json.load(open(os.path.join(cine, "film.json")))
    styles = wanted or sorted(os.path.basename(f)[:-5] for f in glob.glob(os.path.join(HERE, "styles", "*.json")))
    out = os.path.join(cine, "variants")
    os.makedirs(out, exist_ok=True)
    first = next(s for s in film["scenes"] if s["type"] == "assemble")
    steps = next((s for s in film["scenes"] if s["type"] == "steps"), None)
    # arrival: pieces mid-flight, so how each style arrives shows; assemble: settled, late in the hold
    shots = {"arrival": first["from"] + 22, "assemble": first["from"] + first["frames"] - 40}
    if steps:
        shots["steps"] = steps["from"] + min(steps["frames"] - 20, 70)
    shots["lockup"] = film["endFrom"] + 40
    for sid in styles:
        film["style"] = json.load(open(os.path.join(HERE, "styles", sid + ".json"), encoding="utf-8"))
        props = os.path.join(cine, f"props-{sid}.json")
        json.dump({"film": film}, open(props, "w"))
        for shot, frame in shots.items():
            png = os.path.join(out, f"{sid}--{shot}.png")
            r = subprocess.run(["npx", "remotion", "still", os.path.join(HERE, "index.tsx"), "Film", png, f"--frame={frame}",
                                f"--public-dir={media}", f"--props={props}", "--log=error"], cwd=ROOT, capture_output=True, text=True)
            if r.returncode or not os.path.exists(png):
                sys.exit(f"{sid} {shot}: render failed\n{r.stderr[-800:]}")
        print(sid, "rendered", ", ".join(shots))
    # contact sheet: one row per style, one column per shot
    rows = []
    for sid in styles:
        ins = []
        for shot in shots:
            ins += ["-i", os.path.join(out, f"{sid}--{shot}.png")]
        row = os.path.join(out, f"_row-{sid}.jpg")
        n = len(shots)
        fc = "".join(f"[{k}]scale=640:-1[v{k}];" for k in range(n)) + "".join(f"[v{k}]" for k in range(n)) + f"hstack={n}"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *ins, "-filter_complex", fc, row], check=True)
        rows.append(row)
    ins = [x for r in rows for x in ("-i", r)]
    fc = "".join(f"[{k}]" for k in range(len(rows))) + f"vstack={len(rows)}"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *ins, "-filter_complex", fc, os.path.join(out, "board.jpg")], check=True)
    for r in rows:
        os.remove(r)
    print("board:", os.path.join(out, "board.jpg"))


if __name__ == "__main__":
    main()
