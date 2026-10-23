# Film harness build: one shot list in, a 4K master and a phone copy out.
# usage: python3 -I build.py <shotlist.json>
# Steps: prep (tool fixes on clips, cached) -> inserts (phone screens) -> chain overlay -> shots -> payoff with chain
#        -> logo -> picture -> licensed music + Margot lines, ducked and levelled -> master + phone copy.
# Every film then has to pass gates.py before it goes to Phill (see README.md).
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); TOOLS = os.path.join(HERE, "tools")
S = json.load(open(sys.argv[1]))
R = S["root"]; W, H = S["resolution"]; FPS = S.get("fps", 24)
PY = os.environ.get("FILM_PY", "/Volumes/Mini Mini 2T Storage/media/card-demos/.venv/bin/python")   # has OpenCV
WORK = os.path.join(R, S.get("work", "harness-work")); os.makedirs(WORK, exist_ok=True)
def P(x): return x if x.startswith("/") else os.path.join(R, x)
def run(*a): subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *a], check=True)
def dur(p): return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True).stdout)
def stale(out, *ins): return not os.path.exists(out) or any(os.path.getmtime(out) < os.path.getmtime(i) for i in ins)
base = f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},fps={FPS}"

# 1. prep: per-clip fixes made with the tools (cached unless the input or the tool changed)
for op in S.get("prep", []):
    src, out, tool = P(op["in"]), P(op["out"]), os.path.join(TOOLS, op["op"] + ".py")
    if not stale(out, src, tool): continue
    if op["op"] == "screentrack": args = [src, P(op["page"]), out, ",".join(map(str, op["seed"]))]
    elif op["op"] == "debolt": args = [src, out, ",".join(map(str, op["box"]))]
    elif op["op"] == "lampoff": args = [src, out, ",".join(map(str, op["region"]))]
    else: raise SystemExit(f"unknown prep op {op['op']}")
    subprocess.run([PY, tool, *args], check=True)

# 2. phone inserts
for ins in S.get("phones", []):
    out = P(ins["out"])
    if stale(out, P(ins["page"]), os.path.join(TOOLS, "phone.py"), sys.argv[1]):
        spec = dict(ins, page=P(ins["page"]), bg_clip=P(ins["bg_clip"]), out=out, width=W, height=H, fps=FPS)
        subprocess.run(["python3", "-I", os.path.join(TOOLS, "phone.py"), json.dumps(spec)], check=True)

# 3. chain overlay frames at full resolution
C = S["chain"]; CD = os.path.join(WORK, "chain")
subprocess.run(["python3", "-I", os.path.join(TOOLS, "chain.py"), CD, str(W), str(H), json.dumps(C)], check=True)
NL = len(C["names"])

# 4. shots
parts = []; starts = {}
for i, sh in enumerate(S["shots"]):
    out = os.path.join(WORK, f"p{i:02d}.mp4"); inp = ["-ss", str(sh.get("ss", 0)), "-t", str(sh["dur"]), "-i", P(sh["src"])]
    vf = base + ("," + sh["vf"] if sh.get("vf") else "") + ",format=yuv420p"
    if sh.get("amb") is not None:
        run(*inp, "-vf", vf, "-af", f"aresample=48000,aformat=channel_layouts=stereo,volume={sh['amb']}", "-c:v", "libx264", "-crf", "16", "-c:a", "aac", out)
    else:
        run(*inp, "-f", "lavfi", "-t", str(sh["dur"]), "-i", "anullsrc=r=48000:cl=stereo", "-map", "0:v", "-map", "1:a", "-vf", vf,
            "-c:v", "libx264", "-crf", "16", "-c:a", "aac", "-shortest", out)
    parts.append((sh["id"], out))

# 5. payoff: its parts in order, then the chain built over it, tagline, chain fades, logo
PO = S["payoff"]; CLEAN, STEP, TAG, OUT, PD = PO["clean"], PO["step"], PO["tag"], PO["out"], PO["len"]
srcs = sum((["-ss", str(x["ss"]), "-t", str(x["dur"]), "-i", P(x["src"])] for x in PO["parts"]), [])
np_ = len(PO["parts"])
fc = "".join(f"[{k}:v]{base},setsar=1[v{k}];" for k in range(np_)) + "".join(f"[v{k}][{k}:a]" for k in range(np_)) + f"concat=n={np_}:v=1:a=1[v][a]"
run(*srcs, "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "14", "-c:a", "aac", os.path.join(WORK, "paysrc.mp4"))
cuts = [(0, CLEAN)] + [(CLEAN + (k - 1) * STEP, CLEAN + k * STEP) for k in range(1, NL)] + [(CLEAN + (NL - 1) * STEP, TAG), (TAG, PD)]
ins = sum((["-loop", "1", "-t", str(round(b - a, 3)), "-i", os.path.join(CD, f"ov{k}.png")] for k, (a, b) in enumerate(cuts)), [])
cc = "".join(f"[{k}:v]fps={FPS},format=rgba,setsar=1[c{k}];" for k in range(len(cuts))) + "".join(f"[c{k}]" for k in range(len(cuts)))
run(*ins, "-filter_complex", cc + f"concat=n={len(cuts)}:v=1:a=0,fade=t=in:st={CLEAN-0.4}:d=0.4:alpha=1,fade=t=out:st={OUT}:d=0.4:alpha=1[o]",
    "-map", "[o]", "-c:v", "qtrle", os.path.join(WORK, "ov.mov"))
run("-t", str(PD), "-i", os.path.join(WORK, "paysrc.mp4"), "-i", os.path.join(WORK, "ov.mov"), "-filter_complex", "[0:v][1:v]overlay=shortest=1,format=yuv420p[pv]",
    "-map", "[pv]", "-map", "0:a?", "-af", "aresample=48000,aformat=channel_layouts=stereo,volume=0.45", "-c:v", "libx264", "-crf", "16", "-c:a", "aac", os.path.join(WORK, "payoff.mp4"))
if dur(os.path.join(WORK, "payoff.mp4")) < PD - 0.05: raise SystemExit("payoff shorter than planned: a payoff clip is too short")
L = S["logo"]; LOGO = L.get("hold", 3.6); card = os.path.join(WORK, "logo-card.png")
subprocess.run(["magick", P(L["file"]), "-filter", "Lanczos", "-resize", f"{H}x{H}", "-gravity", "center", "-background", "black", "-extent", f"{W}x{H}",
                "(", "-size", f"{H}x{H}", "radial-gradient:white-black", "-gravity", "center", "-background", "black", "-extent", f"{W}x{H}", ")",
                "-compose", "multiply", "-composite", card], check=True)   # the approved logo file, never redrawn
run("-loop", "1", "-t", str(LOGO), "-i", card, "-f", "lavfi", "-t", str(LOGO), "-i", "anullsrc=r=48000:cl=stereo",
    "-vf", f"scale={int(W * 1.5)}:-1,zoompan=z='1+0.04*on/{int(LOGO * FPS)}':d={int(LOGO * FPS)}:s={W}x{H}:fps={FPS},format=yuv420p",
    "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "16", "-c:a", "aac", "-shortest", os.path.join(WORK, "logo.mp4"))
run("-i", os.path.join(WORK, "payoff.mp4"), "-i", os.path.join(WORK, "logo.mp4"), "-filter_complex",
    f"[0:v][1:v]xfade=transition=fadeblack:duration=1.0:offset={OUT + 0.2},format=yuv420p[v];[0:a][1:a]acrossfade=d=1.0[a]",
    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "16", "-c:a", "aac", os.path.join(WORK, "end.mp4"))
parts.append(("payoff", os.path.join(WORK, "end.mp4")))

# 6. picture
open(os.path.join(WORK, "list.txt"), "w").write("".join(f"file '{p}'\n" for _, p in parts))
run("-f", "concat", "-safe", "0", "-i", os.path.join(WORK, "list.txt"), "-c", "copy", os.path.join(WORK, "picture.mp4"))
t = 0
for sid, p in parts: starts[sid] = t; t += dur(p)
total = dur(os.path.join(WORK, "picture.mp4")); pay = starts["payoff"]

# 7. sound: licensed score placed so its lift lands on the payoff; Margot's lines; gentle ducking; -14 LUFS
M = S["music"]; delay = max(0.0, round(pay - M["lift_at"], 2))
run("-i", P(M["file"]), "-af", f"adelay={int(delay * 1000)}|{int(delay * 1000)},apad,atrim=0:{total},afade=t=out:st={total - 3}:d=3,aresample=48000,aformat=channel_layouts=stereo",
    os.path.join(WORK, "music.wav"))
vo = []
for v in S["voice"]:
    at = pay + PO["tag"] if v.get("at") == "tagline" else starts[v["shot"]] + v.get("offset", 0.4)
    vo.append((P(v["file"]), at, v.get("gain", 1.9)))
fc = f"[0:a]volume=1.0[amb];[1:a]volume={M.get('volume', 0.30)}[mus];"
for i, (f, at, g) in enumerate(vo): fc += f"[{i + 2}:a]adelay={int(at * 1000)}|{int(at * 1000)},volume={g}[vo{i}];"
fc += "".join(f"[vo{i}]" for i in range(len(vo))) + f"amix=inputs={len(vo)}:normalize=0,apad=whole_dur={total}[vox];[vox]asplit=2[va][vb];"
fc += "[mus][va]sidechaincompress=threshold=0.05:ratio=3:attack=40:release=900:makeup=1[md];[amb][md][vb]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[out]"
master = P(S["out"])
run("-i", os.path.join(WORK, "picture.mp4"), "-i", os.path.join(WORK, "music.wav"), *sum((["-i", f] for f, _, _ in vo), []), "-filter_complex", fc,
    "-map", "0:v", "-map", "[out]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", master)
phone = master.replace(".mp4", "-phone.mp4")
run("-i", master, "-vf", "scale=1920:1080:flags=lanczos", "-c:v", "libx264", "-crf", "21", "-preset", "slow", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", phone)
json.dump({"total": round(total, 2), "payoff_at": round(pay, 2), "starts": {k: round(v, 2) for k, v in starts.items()},
           "voice_at": [round(a, 2) for _, a, _ in vo], "music_delay": delay}, open(master + ".timeline.json", "w"), indent=1)
print("built", master, round(total, 2), "s; phone copy", phone)
