#!/usr/bin/env python3
"""Measure each harvested reel: duration, cuts, loudness, speech, frame sheets.

Usage: python3 -I analyze.py <outdir> <whisper-model.bin>
Reads  <outdir>/reels/<code>/{meta.json,video.mp4,audio.m4a}
Writes <outdir>/reels/<code>/{metrics.json,hook.jpg,sheet.jpg,transcript.json}

Single render (harness N13 craft QA on our own master):
       python3 -I analyze.py --single <video.mp4> <whisper-model.bin> <workdir>
Stages the file as <workdir>/reels/<stem>/ (video copy + extracted audio + meta.json),
measures it the same way, and prints that reel's metrics.json.

Requires ffmpeg/ffprobe and whisper-cli (whisper.cpp) on PATH. A measurement that
could not run is recorded as null with a reason, never as zero.
"""
import json, re, subprocess, sys
from pathlib import Path

SCENE_THRESHOLD = 0.30  # ffmpeg scene score; 0.3 is the common hard-cut threshold


def run(cmd):
    # whisper.cpp can emit non-UTF-8 bytes on stderr; never let decoding kill a batch.
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")


def probe(video):
    """Stream facts, or all-null with probe_error when ffprobe fails (never zero)."""
    r = run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(video)])
    try:
        j = json.loads(r.stdout or "{}") if r.returncode == 0 else {}
    except json.JSONDecodeError:
        j = {}
    v = next((s for s in j.get("streams", []) if s.get("codec_type") == "video"), None)
    if not v:
        return {"width": None, "height": None, "fps": None, "duration_s": None,
                "probe_error": "ffprobe failed or found no video stream"}
    num, den = (v.get("r_frame_rate", "0/1").split("/") + ["1"])[:2]
    fps = round(int(num) / int(den), 2) if num.isdigit() and den.isdigit() and int(num) and int(den) else None
    return {"width": v.get("width"), "height": v.get("height"), "fps": fps,
            "duration_s": float(j.get("format", {}).get("duration", 0) or 0) or None}


def cuts(video):
    """Hard-cut times, or None when ffmpeg failed (a failed read is unknown, never zero cuts)."""
    r = run(["ffmpeg", "-hide_banner", "-i", str(video), "-filter:v",
             f"select='gt(scene,{SCENE_THRESHOLD})',showinfo", "-f", "null", "-"])
    if r.returncode != 0:
        return None
    return [round(float(t), 2) for t in re.findall(r"pts_time:([\d.]+)", r.stderr)]


def loudness(audio):
    r = run(["ffmpeg", "-hide_banner", "-i", str(audio), "-af", "ebur128", "-f", "null", "-"])
    tail = r.stderr[r.stderr.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+) LUFS", tail)
    lra = re.search(r"LRA:\s+([\d.]+) LU", tail)
    return {"integrated_lufs": float(i.group(1)) if i else None, "lra_lu": float(lra.group(1)) if lra else None}


def transcribe(audio, model, d):
    wav = d / "audio16k.wav"
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(audio), "-ar", "16000", "-ac", "1", str(wav)])
    base = d / "transcript"
    r = run(["whisper-cli", "-m", str(model), "-f", str(wav), "-oj", "-of", str(base), "-ml", "1", "-np"])
    wav.unlink(missing_ok=True)
    p = base.with_suffix(".json")
    if not p.exists():
        return None, f"whisper failed: {r.stderr[-200:]}"
    segs = json.loads(p.read_text(errors="replace")).get("transcription", [])
    words = []
    for s in segs:
        t = s.get("text", "").strip()
        if not t or t.startswith("["):
            continue
        words.append({"w": t, "t0": s["offsets"]["from"] / 1000, "t1": s["offsets"]["to"] / 1000})
    return words, None


def sheet(video, times, out, cols):
    """Tile frames at given timestamps into one image (270px wide each)."""
    tmp = out.parent / "_f"
    tmp.mkdir(exist_ok=True)
    frames = []
    for i, t in enumerate(times):
        f = tmp / f"{i:02d}.jpg"
        run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", str(video), "-frames:v", "1",
             "-vf", "scale=270:-2", str(f)])
        if f.exists():
            frames.append(f)
    if frames:
        rows = -(-len(frames) // cols)
        run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "1", "-i", str(tmp / "%02d.jpg"),
             "-vf", f"tile={cols}x{rows}:padding=4:color=white", "-frames:v", "1", str(out)])
    for f in tmp.glob("*.jpg"):
        f.unlink()
    tmp.rmdir()
    return [round(t, 2) for t in times[:len(frames)]]


def main(outdir, model):
    for d in sorted((Path(outdir) / "reels").iterdir()):
        meta_p = d / "meta.json"
        if not meta_p.exists():
            continue
        prev = d / "metrics.json"
        if prev.exists() and "sheet_frames_t" in json.loads(prev.read_text()):
            continue  # already fully measured
        meta = json.loads(meta_p.read_text())
        m = {"code": d.name, "status": meta.get("status")}
        video, audio = d / "video.mp4", d / "audio.m4a"
        if meta.get("status") != "OK" or not video.exists():
            (d / "metrics.json").write_text(json.dumps(m, indent=2))
            continue
        m.update(probe(video))
        dur = m["duration_s"] or 0
        c = cuts(video)
        m["cut_times"] = c
        if c is None:
            m["cut_count"] = m["avg_shot_len_s"] = m["cuts_first_3s"] = None
            m["cuts_error"] = "ffmpeg scene detection failed"
            c = []  # body sheet then falls back to a single mid-reel frame
        else:
            m["cut_count"] = len(c)
            m["avg_shot_len_s"] = round(dur / (len(c) + 1), 2) if dur else None
            m["cuts_first_3s"] = sum(1 for t in c if t <= 3)
        if audio.exists():
            m.update(loudness(audio))
            words, err = transcribe(audio, model, d)
            if words is None:
                m["speech"] = None
                m["speech_error"] = err
            else:
                spoken = [w for w in words if re.search(r"[A-Za-z0-9]", w["w"])]
                m["word_count"] = len(spoken)
                m["first_word_at_s"] = spoken[0]["t0"] if spoken else None
                m["words_per_sec"] = round(len(spoken) / dur, 2) if dur and spoken else 0
                m["first_3s_text"] = " ".join(w["w"] for w in spoken if w["t0"] < 3)
                m["full_text"] = " ".join(w["w"] for w in spoken)
        else:
            m["audio"] = None
            m["audio_note"] = "no audio track captured"
        # Hook sheet: 0-3s at 4 fps. Body sheet: one frame per shot (max 12) plus last frame.
        m["hook_frames_t"] = sheet(video, [i * 0.25 for i in range(12)], d / "hook.jpg", cols=6)
        mids = [0.0] + c
        body = [(a + b) / 2 for a, b in zip(mids, mids[1:] + [dur])]
        if len(body) > 11:
            step = len(body) / 11
            body = [body[int(i * step)] for i in range(11)]
        m["sheet_frames_t"] = sheet(video, body + [max(dur - 0.3, 0)], d / "sheet.jpg", cols=6)
        (d / "metrics.json").write_text(json.dumps(m, indent=2))
        print(d.name, m.get("duration_s"), "cuts", m["cut_count"], "lufs", m.get("integrated_lufs"),
              "wps", m.get("words_per_sec"), file=sys.stderr)


def single(video, model, workdir):
    """Stage one finished video in the reels/<stem>/ layout, measure it, print its metrics."""
    src = Path(video).resolve()
    stem = re.sub(r"[^A-Za-z0-9_-]", "_", src.stem) or "render"
    d = Path(workdir) / "reels" / stem
    d.mkdir(parents=True, exist_ok=True)
    (d / "metrics.json").unlink(missing_ok=True)
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-c", "copy", "-an", str(d / "video.mp4")])
    a = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vn", "-c:a", "aac", str(d / "audio.m4a")])
    if a.returncode != 0:
        (d / "audio.m4a").unlink(missing_ok=True)  # no audio track: recorded as audio null, not silence
    (d / "meta.json").write_text(json.dumps({"code": stem, "status": "OK", "source": str(src)}))
    main(workdir, model)
    print((d / "metrics.json").read_text())


if __name__ == "__main__":
    if sys.argv[1] == "--single":
        single(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        main(sys.argv[1], sys.argv[2])
