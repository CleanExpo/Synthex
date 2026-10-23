# Film gates: automatic checks a film must pass before it goes to Phill. Exit 0 only if every gate passes.
# usage: python3 -I gates.py <shotlist.json> <film.mp4>
# Each gate is a lesson from The Relay (lessons.md). A gate that cannot run is a FAIL, never a pass.
import json, os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
S = json.load(open(sys.argv[1])); F = sys.argv[2]
W, H = S["resolution"]; FPS = S.get("fps", 24)
results = []
def gate(name, ok, detail): results.append((name, bool(ok), detail))
def probe(*a): return subprocess.run(["ffprobe", "-v", "error", *a], capture_output=True, text=True).stdout.strip()

# 1. resolution and frame rate: masters are 4K so text is drawn sharp (Phill: "need to be 4k")
wh = probe("-select_streams", "v", "-show_entries", "stream=width,height,r_frame_rate", "-of", "csv=p=0", F).split(",")
gate("resolution", wh[:2] == [str(W), str(H)] and wh[2] == f"{FPS}/1", f"{wh} want {W}x{H} @ {FPS}")

# 2. duration matches the shot list (within 1.5 s)
plan = sum(s["dur"] for s in S["shots"]) + S["payoff"]["out"] + 0.2 + S["logo"].get("hold", 3.6)
d = float(probe("-show_entries", "format=duration", "-of", "csv=p=0", F) or 0)
gate("duration", abs(d - plan) < 1.5, f"{d:.2f}s, plan {plan:.2f}s")

# 3. loudness: -16 to -12 LUFS integrated, true peak at or below -1 dBTP
r = subprocess.run(["ffmpeg", "-hide_banner", "-i", F, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
I = re.findall(r"I:\s+(-?[\d.]+) LUFS", r); TP = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)
gate("loudness", I and -16 <= float(I[-1]) <= -12 and TP and float(TP[-1]) <= -1.0, f"I={I[-1] if I else '?'} TP={TP[-1] if TP else '?'}")

# 4. speech: the only words in the mix are the script (catches watermark voices like "Artlist.io", generated chatter)
def stt(path):
    mp3 = path + ".gate.mp3"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-vn", "-ac", "1", "-b:a", "96k", mp3], check=True)
    out = subprocess.run(["python3", "-I", os.path.join(HERE, "tools", "stt.py"), mp3], capture_output=True, text=True)
    os.remove(mp3)
    if out.returncode != 0: return None
    first = out.stdout.splitlines()[0] if out.stdout else ""
    return re.sub(r"\[[^\]]*\]", " ", first.split("|", 1)[-1])
def words(t): return re.findall(r"[a-z']+", t.lower())
said = stt(F)
script = set(words(" ".join(S["script"])))
if said is None:
    gate("speech", False, "speech-to-text did not run")
else:
    heard = words(said); extra = [w for w in heard if w not in script]
    covered = len(set(heard) & script) / max(len(script), 1)
    gate("speech", len(extra) <= 1 and covered >= 0.8, f"extra words {extra[:8]}; script covered {covered:.0%}")

# 5. music: licensed source declared, never a library preview, and the music file itself has no words in it
M = S["music"]; mfile = M["file"] if M["file"].startswith("/") else os.path.join(S["root"], M["file"])
src_ok = M.get("source") in ("artlist-ai", "elevenlabs-music", "licensed-download") and "preview" not in mfile.lower()
msaid = stt(mfile)
gate("music", src_ok and msaid is not None and len(words(msaid)) == 0, f"source={M.get('source')} words={words(msaid)[:6] if msaid else 'stt failed'}")

# 6. picture: no flash frames (near-black or near-white) outside the planned dip into the logo, no one-frame flicker in the chain
cmd = ["ffmpeg", "-v", "error", "-i", F, "-vf", "scale=320:-1,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-", "-f", "null", "-"]
ys = [float(x.split("=")[1]) for x in subprocess.run(cmd, capture_output=True, text=True).stdout.splitlines() if "YAVG" in x]
tl = json.load(open(F + ".timeline.json")) if os.path.exists(F + ".timeline.json") else None
end_dip = int((d - S["logo"].get("hold", 3.6) - 1.5) * FPS)
flashes = [i for i, y in enumerate(ys) if (y < 6 or y > 245) and i < end_dip and i > FPS // 2]
gate("flash", ys and not flashes, f"{len(ys)} frames; flash frames {[round(i / FPS, 2) for i in flashes[:6]]}")
if tl:
    a = int((tl["payoff_at"] + S["payoff"]["clean"] + 0.1) * FPS); b = int((tl["payoff_at"] + S["payoff"]["out"]) * FPS)
    rev = [i for i in range(a + 1, min(b, len(ys) - 1)) if (ys[i] - ys[i - 1]) * (ys[i + 1] - ys[i]) < 0 and min(abs(ys[i] - ys[i - 1]), abs(ys[i + 1] - ys[i])) > 4]
    gate("chain-flicker", not rev, f"one-frame reversals at {[round(i / FPS, 2) for i in rev[:6]]}")
else:
    gate("chain-flicker", False, "no timeline file next to the film: build it with build.py")

# 7. story: the shot list must name the turn and the payoff (judges marked every film without a turn down)
st = S.get("story", {})
gate("story", st.get("turn") and st.get("payoff") and st.get("logline"), f"logline/turn/payoff present: {bool(st.get('logline'))}/{bool(st.get('turn'))}/{bool(st.get('payoff'))}")

# 8. checklist: the manual checks in lessons.md are signed off for this film
cl = S.get("checklist", {})
need = ["equipment_matches_reference", "legal_and_safety", "no_text_cut_off", "faces_and_hands_frame_checked", "watched_every_half_second"]
gate("checklist", all(cl.get(k) for k in need), f"missing {[k for k in need if not cl.get(k)]}")

w = max(len(n) for n, _, _ in results)
for n, ok, det in results: print(f"{'PASS' if ok else 'FAIL'}  {n:<{w}}  {det}")
sys.exit(0 if all(ok for _, ok, _ in results) else 1)
