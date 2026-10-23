# Phone-screen insert: a real page capture at true phone width (never cropped at the sides, Phill 23/10/2026: text
# cut off at the edge "is not correct"), on a blurred frame of the shot it follows, camera moved in so the type reads.
# Each state is a vertical window of the page; states change with a short slide-up, like a thumb scroll.
# usage: phone.py '<json spec>'   spec: page (png, 1170 px wide capture), bg_clip, bg_time, states [page y in capture px],
#        hold [seconds per state], zoom, width, height, fps, out
import json, os, subprocess, sys, tempfile
p = json.loads(sys.argv[1])
W, H, Z = p["width"], p["height"], p.get("zoom", 1.58)
s = W / 1920
T = tempfile.mkdtemp(prefix="phone-")
def m(*a): subprocess.run(["magick", *a], check=True)
sw, sh, r, b = int(470 * s), int(1010 * s), int(52 * s), int(18 * s)       # screen size, corner radius, bezel
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(p["bg_time"]), "-i", p["bg_clip"], "-frames:v", "1",
                "-vf", f"scale={W}:{H}", f"{T}/bg.png"], check=True)
m(f"{T}/bg.png", "-blur", f"0x{int(22 * s)}", "-modulate", "72", f"{T}/bgb.png")
m("-size", f"{sw + 2 * b}x{sh + 2 * b}", "xc:none", "-fill", "#0b0b0b", "-draw", f"roundrectangle 0,0 {sw + 2 * b - 1},{sh + 2 * b - 1} {r + b},{r + b}",
  "(", "-size", f"{sw + 2 * b}x{sh + 2 * b}", "xc:white", "-fill", "black", "-draw", f"roundrectangle {b},{b} {b + sw - 1},{b + sh - 1} {r},{r}", ")",
  "-alpha", "off", "-compose", "CopyOpacity", "-composite", f"{T}/bezel.png")
m(p["page"], "-filter", "Lanczos", "-resize", f"{sw}x", f"{T}/page.png")
for n, y in enumerate(p["states"]):
    m(f"{T}/page.png", "-crop", f"{sw}x{sh}+0+{int(y * sw / 1170)}", "+repage", f"{T}/win{n}.png")
    m(f"{T}/bgb.png", f"{T}/win{n}.png", "-gravity", "center", "-compose", "over", "-composite",
      f"{T}/bezel.png", "-gravity", "center", "-compose", "over", "-composite",
      "-filter", "Lanczos", "-resize", f"{int(Z * 100)}%", "-gravity", "center", "-crop", f"{W}x{H}+0+0", "+repage", f"{T}/state{n}.png")
ins, fc, t, prev = [], "", 0.0, "[0:v]format=yuv420p[s0]"
for n, hold in enumerate(p["hold"]):
    ins += ["-framerate", str(p["fps"]), "-loop", "1", "-t", str(hold), "-i", f"{T}/state{n}.png"]
fc = prev + ";"
cur = "s0"
for n in range(1, len(p["hold"])):
    t += p["hold"][n - 1] - 0.35
    fc += f"[{n}:v]format=yuv420p[i{n}];[{cur}][i{n}]xfade=transition=slideup:duration=0.35:offset={t:.2f}[s{n}];"
    cur = f"s{n}"
fc += f"[{cur}]format=yuv420p[o]"
subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", fc, "-map", "[o]", "-c:v", "libx264", "-crf", "14", p["out"]], check=True)
print("phone insert", p["out"])
