"""Prepare each cinematic film for rendering: Margot's narration per segment, scene timings, captions.

Usage: python3 -I prepare.py <media dir> [id ...]
Reads tours.json (words), films.json (scene plan, brand) and the piece captures from slices.mjs, then writes
<media>/<id>/cine/film.json (the Remotion props), <media>/<id>/cine/vo/NN.mp3 and <media>/<id>/cine/captions.srt.
Narration reuses demos/build.py (same voice, speed and cache), so a line is only paid for once.
"""
import importlib.util
import json
import os
import re
import shutil
import sys
import textwrap

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("demo_build", os.path.join(HERE, "..", "build.py"))
B = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B)

FPS = 30
LEAD, TAIL, END = 0.5, 0.8, 3.5   # seconds: pieces start moving before Margot speaks; a breath after; the logo lock


def main():
    media, only = os.path.abspath(sys.argv[1]), sys.argv[2:]
    tours = json.load(open(os.path.join(HERE, "..", "tours.json"), encoding="utf-8"))
    films = json.load(open(os.path.join(HERE, "films.json"), encoding="utf-8"))["films"]
    e = B.env()
    key, voice = e["ELEVENLABS_API_KEY"], e.get("MARGOT_ELEVENLABS_VOICE_ID", B.MARGOT_VOICE)
    for biz in tours["businesses"]:
        if only and biz["id"] not in only:
            continue
        plan, d = films[biz["id"]], os.path.join(media, biz["id"])
        cine = os.path.join(d, "cine")
        os.makedirs(os.path.join(cine, "vo"), exist_ok=True)
        os.makedirs(os.path.join(d, "audio"), exist_ok=True)
        scenes, t, srt, n = [], 0, [], 1
        for i, s in enumerate(biz["segments"], 1):
            h = B.hashlib.sha1((voice + str(B.SPEED) + s["say"]).encode()).hexdigest()[:10]
            a = os.path.join(d, "audio", f"{i - 1:02d}-{h}.mp3")
            B.tts(s["say"], a, key, voice)
            vo = os.path.join(cine, "vo", f"{i:02d}.mp3")
            shutil.copyfile(a, vo)
            speech = B.duration(a)
            frames = round((LEAD + speech + TAIL) * FPS)
            seg = f"seg{i:02d}"
            if not os.path.exists(os.path.join(cine, seg, "pieces.json")):
                sys.exit(f"{biz['id']}: no capture for {seg}; run slices.mjs first")
            sc = {"type": "assemble", **plan.get("scenes", {}).get(str(i), {})}
            sc.update({"n": i, "seg": f"{biz['id']}/cine/{seg}", "vo": f"{biz['id']}/cine/vo/{i:02d}.mp3", "from": t, "frames": frames,
                       "ticker": i in plan.get("ticker", []), "chapter": B.chapter_label(s, biz)})
            if sc["type"] == "photo" and sc.get("slot"):
                ph = os.path.join(d, "photos", sc["slot"] + ".jpg")
                sc["image"] = f"{biz['id']}/photos/{sc['slot']}.jpg" if os.path.exists(ph) else None
            if sc.get("card"):
                cap = json.load(open(os.path.join(cine, f"seg{sc['card']['seg']:02d}", "pieces.json")))
                hit = next((p for p in cap["pieces"] if sc["card"]["text"] in p["text"]), None)
                sc["card"] = {"seg": f"{biz['id']}/cine/seg{sc['card']['seg']:02d}", "piece": hit} if hit else None
            scenes.append(sc)
            # captions: sentence by sentence, timed by share of characters
            sentences = [c for x in re.split(r"(?<=[.?!])\s+", s["say"]) if x for c in textwrap.wrap(x, 84)]
            total, st = sum(len(x) for x in sentences), t / FPS + LEAD
            for x in sentences:
                en = st + speech * len(x) / total
                srt.append(f"{n}\n{B.srt_time(st)} --> {B.srt_time(en - 0.05)}\n{textwrap.fill(x, 52)}\n")
                n, st = n + 1, en
            t += frames
        first = json.load(open(os.path.join(cine, "seg01", "pieces.json")))
        logo = next((p for p in first["pieces"] if p["i"] == first.get("logo")), None)
        film = {"id": biz["id"], "name": biz["name"], "url": biz["url"], "brand": plan["brand"], "topics": plan.get("topics", []),
                "scenes": scenes, "logo": {"seg": f"{biz['id']}/cine/seg01", "piece": logo}, "endFrom": t,
                "durationInFrames": t + round(END * FPS)}
        json.dump(film, open(os.path.join(cine, "film.json"), "w"), indent=1)
        json.dump({"film": film}, open(os.path.join(cine, "props.json"), "w"))   # Remotion --props
        open(os.path.join(cine, "captions.srt"), "w", encoding="utf-8").write("\n".join(srt))
        print(f"{biz['id']}: {len(scenes)} scenes, {film['durationInFrames'] / FPS:.1f}s, logo {'found' if logo else 'missing'}")


if __name__ == "__main__":
    main()
