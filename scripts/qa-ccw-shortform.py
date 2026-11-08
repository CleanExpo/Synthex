#!/usr/bin/env python3
"""SYN-1404: quality gate for one rendered CCW short-form video.

Usage: qa-ccw-shortform.py <video-id> <work-dir> [--whisper-model PATH]

Reads <work>/out/<id>.mp4 and <work>/<id>-props.json (written by
scripts/render-ccw-shortform.ts). Checks, each printed PASS or FAIL:
  format    length equals the planned end (+-0.5 s), at most 30.5 s, voice
            ends before the video does, 1080x1920, video and audio present
  loudness  integrated -16 LUFS (+-1), true peak at or below -1.0 dBTP
  frames    one frame per second saved to <work>/qa/<id>/ plus a contact
            sheet; no black or empty frame
  pacing    every shot 2.0 to 5.0 s, the end card at most 3.2 s
  captions  caption words equal the script voiceover words; no US spellings
  speech    (optional) whisper.cpp transcript matches the script, >= 90%
Exit 0 only when every check that ran passed. A skipped check is reported
as SKIPPED, never as PASS. Read-only apart from the qa/ folder.
"""

import difflib
import json
import os
import re
import subprocess
import sys

US_SPELLINGS = {
    "color", "colors", "center", "centers", "favorite", "organize", "organized",
    "mold", "moldy", "liter", "liters", "meter", "meters", "aluminum", "analyze",
    "behavior", "gray", "humor", "labor", "neighbor", "program", "tire", "tires",
    "catalog", "fiber", "license", "practice", "authorize", "customize",
}
# "meter" is right for an instrument (moisture meter); allow it after these words.
METER_OK = {"moisture", "pressure", "humidity", "power"}

results = []


def check(name, ok, detail):
    results.append((name, ok))
    print(f"{'PASS' if ok else 'FAIL'}  {name}: {detail}")


def skip(name, detail):
    results.append((name, None))
    print(f"SKIPPED  {name}: {detail}")


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def norm(words):
    return [re.sub(r"[^a-z0-9/]", "", w.lower()) for w in words if re.sub(r"[^a-z0-9/]", "", w.lower())]


def script_voiceover(root, vid):
    t = open(os.path.join(root, "docs/campaigns/ccw-2026-11-video/scripts", f"{vid}.md")).read()
    vo = t.split("## Voiceover")[1].split("## Shot list")[0]
    lines = [re.sub(r"^\d+\.\s*\([^)]*\)\s*", "", l).strip() for l in vo.splitlines() if re.match(r"^\d+\.", l)]
    return " ".join(lines)


def main():
    vid, work = sys.argv[1], os.path.abspath(sys.argv[2])
    model = sys.argv[sys.argv.index("--whisper-model") + 1] if "--whisper-model" in sys.argv else None
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    mp4 = os.path.join(work, "out", f"{vid}.mp4")
    props = json.load(open(os.path.join(work, f"{vid}-props.json")))

    # format
    p = json.loads(run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration",
                        "-of", "json", mp4]).stdout)
    dur = float(p["format"]["duration"])
    v = [s for s in p["streams"] if s["codec_type"] == "video"]
    a = [s for s in p["streams"] if s["codec_type"] == "audio"]
    planned = props["shots"][-1]["to"]
    voice_end = props["words"][-1]["to"]
    ok = (bool(v) and bool(a) and v[0]["width"] == 1080 and v[0]["height"] == 1920
          and abs(dur - planned) <= 0.5 and dur <= 30.5 and voice_end + 0.3 <= dur)
    check("format", ok, f"{dur:.2f} s (planned {planned:.2f}, voice ends {voice_end:.2f}), "
                        f"{v[0]['width']}x{v[0]['height']}, audio {'yes' if a else 'no'}")

    # loudness
    e = run(["ffmpeg", "-nostats", "-i", mp4, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr
    i_m = re.findall(r"I:\s+(-?[\d.]+) LUFS", e)
    tp_m = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", e)
    if i_m and tp_m:
        lufs, tp = float(i_m[-1]), float(tp_m[-1])
        check("loudness", abs(lufs + 16) <= 1 and tp <= -1.0, f"{lufs} LUFS, true peak {tp} dBTP")
    else:
        check("loudness", False, "could not read ebur128 output")

    # frames, one per second
    qa = os.path.join(work, "qa", vid)
    os.makedirs(qa, exist_ok=True)
    for f in os.listdir(qa):
        os.remove(os.path.join(qa, f))
    run(["ffmpeg", "-loglevel", "error", "-i", mp4, "-vf", "fps=1", os.path.join(qa, "f%02d.png")])
    frames = sorted(f for f in os.listdir(qa) if f.startswith("f"))
    stats = run(["ffmpeg", "-i", mp4, "-vf", "fps=1,signalstats,metadata=print:key=lavfi.signalstats.YAVG",
                 "-f", "null", "-"]).stderr
    yavg = [float(x) for x in re.findall(r"YAVG=([\d.]+)", stats)]
    dark = [i for i, y in enumerate(yavg) if y < 20]
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", mp4, "-vf", "fps=1,scale=216:384,tile=10x3",
         "-frames:v", "1", os.path.join(qa, "sheet.png")])
    check("frames", len(frames) >= int(dur) - 1 and not dark,
          f"{len(frames)} frames saved to {qa}; dark frames at seconds {dark or 'none'}; sheet.png written")

    # pacing
    bad = []
    for i, s in enumerate(props["shots"]):
        d = s["to"] - s["from"]
        limit = 3.2 if s["kind"] == "end" else 5.0
        if d < 2.0 or d > limit:
            bad.append(f"shot {i + 1} {d:.2f} s")
    longest = max(s["to"] - s["from"] for s in props["shots"] if s["kind"] != "end")
    check("pacing", not bad, f"{len(props['shots'])} shots, longest non-end {longest:.2f} s; {bad or 'all within limits'}")

    # captions
    script = script_voiceover(root, vid)
    cap = norm(w["text"] for w in props["words"])
    ref = norm(script.split())
    us = [w for i, w in enumerate(cap) if w in US_SPELLINGS and not (w.startswith("meter") and i and cap[i - 1] in METER_OK)]
    check("captions", cap == ref and not us,
          f"{len(cap)} caption words {'match' if cap == ref else 'DO NOT match'} the script; US spellings: {us or 'none'}")

    # speech, optional
    if model and os.path.exists(model):
        wav = os.path.join(qa, "audio.wav")
        run(["ffmpeg", "-loglevel", "error", "-y", "-i", mp4, "-ar", "16000", "-ac", "1", wav])
        out = run(["whisper-cli", "-m", model, "-f", wav, "-nt", "-l", "en"]).stdout
        heard = norm(out.split())
        ratio = difflib.SequenceMatcher(None, heard, ref).ratio()
        check("speech", ratio >= 0.9, f"whisper.cpp transcript matches the script at {ratio:.0%}")
    else:
        skip("speech", "no whisper.cpp model given; spoken words not checked")

    failed = [n for n, ok in results if ok is False]
    print("RESULT:", "FAIL " + ", ".join(failed) if failed else "PASS (skipped checks listed above)")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
