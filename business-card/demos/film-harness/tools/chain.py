# End chain overlay, drawn natively at the film's resolution so the type stays sharp (Phill, 23/10/2026: "they are 720
# at the best"). Frames ov0..ovN: ov0 all links unlit, ov1..ovN light one more link each, ov{N+1} adds the tagline.
# usage: chain.py out_dir width height '<json {"names":[...],"roles":[...],"tagline":"..."}>'
import json, os, subprocess, sys
out, W, H, spec = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), json.loads(sys.argv[4])
names, roles, tag = spec["names"], spec["roles"], spec["tagline"]
s = W / 3840                                   # every size below was set and checked at 3840x2160
F = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
ON, OFF = "#F26A21", "rgba(255,255,255,0.55)"
os.makedirs(out, exist_ok=True)
n = len(names); step = int(650 * s * 5 / max(n, 1)); first = W // 2 - step * (n - 1) // 2
def px(v): return str(int(v * s))
subprocess.run(["magick", "-size", f"{W}x{H}", "gradient:rgba(0,0,0,0)-rgba(0,0,0,0.72)", f"{out}/band.png"], check=True)
for k in range(n + 2):
    a = ["magick", f"{out}/band.png"]
    for i in range(n):
        cx = first + i * step; lit = i < min(k, n); y0 = int(1590 * s)
        a += ["-fill", "none", "-stroke", ON if lit else OFF, "-strokewidth", px(26),
              "-draw", f"roundrectangle {cx - int(200 * s)},{y0} {cx + int(200 * s)},{y0 + int(190 * s)} {px(95)},{px(95)}"]
        if i < n - 1:
            a += ["-stroke", ON if i < min(k, n) - 1 else OFF, "-draw", f"line {cx + int(200 * s)},{y0 + int(95 * s)} {cx + step - int(200 * s)},{y0 + int(95 * s)}"]
        col = "white" if lit else "rgba(255,255,255,0.7)"
        a += ["-stroke", "none", "-gravity", "north", "-fill", col, "-font", F,
              "-pointsize", px(62), "-annotate", f"{cx - W // 2:+d}+{y0 - int(92 * s)}", roles[i],
              "-pointsize", px(96), "-annotate", f"{cx - W // 2:+d}+{y0 + int(215 * s)}", names[i]]
    if k == n + 1:
        a += ["-fill", "white", "-pointsize", px(196), "-gravity", "north", "-annotate", f"+0+{px(1130)}", tag]
    subprocess.run(a + [f"{out}/ov{k}.png"], check=True)
print(n + 2, "overlay frames in", out)
