# Turn off the lit ceiling lamp in the doorway shot (power must be off in a flooded house): find the bright lamp blob
# near its position each frame and inpaint it, plus a soft darkening of its halo.
import sys, os, subprocess, numpy as np, cv2
src, out = sys.argv[1], sys.argv[2]
REG = tuple(map(int, sys.argv[3].split(","))) if len(sys.argv) > 3 else (1240, 60, 1480, 280)   # in 1920-wide units
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS); w, h = int(cap.get(3)), int(cap.get(4)); k = w / 1920
X0, Y0, X1, Y1 = (int(v * k) for v in REG)
vw = cv2.VideoWriter(out + ".tmp.mp4", cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h)); n = 0; hit = 0
while True:
    ok, f = cap.read()
    if not ok: break
    n += 1
    roi = f[Y0:Y1, X0:X1]; g = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    m = (g > 225).astype(np.uint8)
    cnt, lab, st, cen = cv2.connectedComponentsWithStats(m)
    keep = np.zeros_like(m)
    for i in range(1, cnt):
        if 15 * k * k < st[i, 4] < 3000 * k * k and st[i, 3] < 60 * k: keep[lab == i] = 1   # small round blob = lamp, not the window
    if keep.any():
        hit += 1
        halo = cv2.GaussianBlur(cv2.dilate(keep, np.ones((int(25 * k) | 1, int(25 * k) | 1), np.uint8)).astype(np.float32), (int(41 * k) | 1, int(41 * k) | 1), 0)
        roi2 = cv2.inpaint(roi, cv2.dilate(keep, np.ones((int(9 * k) | 1, int(9 * k) | 1), np.uint8)) * 255, int(7 * k), cv2.INPAINT_TELEA)
        roi2 = (roi2 * (1 - 0.25 * halo[..., None])).astype(np.uint8)
        f[Y0:Y1, X0:X1] = roi2
    vw.write(f)
vw.release()
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", out + ".tmp.mp4", "-i", src, "-map", "0:v", "-map", "1:a?",
                "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "copy", out], check=True)
os.remove(out + ".tmp.mp4"); print(n, "frames,", hit, "with lamp removed")
