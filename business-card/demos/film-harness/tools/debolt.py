# Remove the frozen lightning bolt from the door glass in shot 02 (inpaint a fixed mask on every frame).
import sys, subprocess, os, numpy as np, cv2
src, out = sys.argv[1], sys.argv[2]
BOX = tuple(map(int, sys.argv[3].split(","))) if len(sys.argv) > 3 else (655, 205, 760, 375)   # door glass, in 1920-wide units
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS)
W, Hh = int(cap.get(3)), int(cap.get(4)); k = W / 1920
x0, y0, x1, y1 = (int(v * k) for v in BOX)
frames = []
while True:
    ok, f = cap.read()
    if not ok: break
    frames.append(f)
med = np.median(np.stack([f[y0:y1, x0:x1] for f in frames[::4]]), axis=0).astype(np.uint8)
g = cv2.cvtColor(med, cv2.COLOR_BGR2GRAY).astype(np.int16)
th = cv2.morphologyEx(g.astype(np.uint8), cv2.MORPH_TOPHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(13 * k) | 1, int(13 * k) | 1)))
m = (th > 16).astype(np.uint8) * 255
n_, lab, st, _ = cv2.connectedComponentsWithStats(m)
m = np.isin(lab, [i for i in range(1, n_) if st[i, 4] > 60 * k * k]).astype(np.uint8) * 255  # keep the bolt, drop rain specks
m = cv2.dilate(m, np.ones((int(9 * k) | 1, int(9 * k) | 1), np.uint8))
mask = np.zeros((Hh, W), np.uint8); mask[y0:y1, x0:x1] = m
cv2.imwrite(out + ".mask.png", mask)
vw = cv2.VideoWriter(out + ".tmp.mp4", cv2.VideoWriter_fourcc(*"mp4v"), fps, (W, Hh))
for f in frames:
    vw.write(cv2.inpaint(f, mask, int(5 * k), cv2.INPAINT_TELEA))
vw.release()
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", out + ".tmp.mp4", "-i", src, "-map", "0:v", "-map", "1:a?",
                "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "copy", out], check=True)
os.remove(out + ".tmp.mp4")
print("frames", len(frames), "mask px", int((m > 0).sum()))
