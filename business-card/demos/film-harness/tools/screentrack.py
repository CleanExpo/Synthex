# v4 screen tracker. Start from the frame where the screen outline is largest and cleanly four-sided (no hand over it),
# then carry the corners forward and backward with feature homographies on the device case, nudged toward clean
# measurements. Composite only onto near-white screen pixels inside the device, so gloves stay in front.
# usage: screentrack4.py src.mp4 page.png out.mp4 seedx,seedy
import sys, os, subprocess, numpy as np, cv2
src, page, out = sys.argv[1], sys.argv[2], sys.argv[3]
sx, sy = map(int, sys.argv[4].split(","))
pg = cv2.imread(page); ph, pw = pg.shape[:2]
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS); K = cap.get(3) / 1920
sx, sy = int(sx * K), int(sy * K)
F = []
while True:
    ok, f = cap.read()
    if not ok: break
    F.append(f)
G = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in F]; h, w = G[0].shape

def order(q):
    q = q.reshape(4, 2).astype(np.float32); s = q.sum(1); d = np.diff(q, axis=1).ravel()
    return np.array([q[s.argmin()], q[d.argmin()], q[s.argmax()], q[d.argmax()]], np.float32)
def measure(g, pt):
    _, bw = cv2.threshold(g, 200, 255, cv2.THRESH_BINARY)
    bw = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    cs, _ = cv2.findContours(bw, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cs = [c for c in cs if cv2.contourArea(c) > 4000 * K * K and cv2.pointPolygonTest(c, pt, True) > -60 * K]
    if not cs: return None, 0
    c = max(cs, key=cv2.contourArea); hl = cv2.convexHull(c)
    ap = cv2.approxPolyDP(hl, 0.03 * cv2.arcLength(hl, True), True)
    solid = cv2.contourArea(c) / max(cv2.contourArea(hl), 1)       # 1.0 = nothing biting into the screen
    return (order(ap), cv2.contourArea(hl)) if len(ap) == 4 and solid > 0.86 else (None, 0)
meas = [measure(g, (sx, sy)) for g in G]
ref = max(range(len(G)), key=lambda i: meas[i][1])
Q = [None] * len(G); Q[ref] = meas[ref][0]
def step(i, j):
    q = Q[i]; g0, g1 = G[i], G[j]
    area = np.zeros_like(g0); cv2.fillConvexPoly(area, ((q - q.mean(0)) * 1.35 + q.mean(0)).astype(np.int32), 255)
    inner = np.zeros_like(g0); cv2.fillConvexPoly(inner, ((q - q.mean(0)) * 0.8 + q.mean(0)).astype(np.int32), 255)
    p0 = cv2.goodFeaturesToTrack(g0, 300, 0.01, int(6 * K), mask=cv2.bitwise_and(area, cv2.bitwise_not(inner)))
    nq = q
    if p0 is not None and len(p0) >= 12:
        p1, st, _ = cv2.calcOpticalFlowPyrLK(g0, g1, p0, None, winSize=(int(21 * K) | 1, int(21 * K) | 1), maxLevel=3)
        a, b = p0[st == 1], p1[st == 1]
        if len(a) >= 12:
            H, inl = cv2.findHomography(a, b, cv2.RANSAC, 2.0 * K)
            if H is not None and inl.sum() >= 10: nq = cv2.perspectiveTransform(q.reshape(-1, 1, 2), H).reshape(4, 2)
    m = meas[j][0]
    if m is not None and np.abs(m - nq).max() < 25 * K: nq = 0.7 * nq + 0.3 * m
    Q[j] = nq.astype(np.float32)
for i in range(ref, len(G) - 1): step(i, i + 1)
for i in range(ref, 0, -1): step(i, i - 1)
vw = cv2.VideoWriter(out + ".tmp.mp4", cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
for fi, (f, g, q) in enumerate(zip(F, G, Q)):
    c = q.mean(0)
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [pw, 0], [pw, ph], [0, ph]]), ((q - c) * 1.12 + c).astype(np.float32))
    warped = cv2.warpPerspective(pg, M, (w, h), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REPLICATE)
    quad = np.zeros((h, w), np.uint8); cv2.fillConvexPoly(quad, ((q - c) * 1.07 + c).astype(np.int32), 255)
    # also cover the screen's own white area this frame (its convex hull), so no screen white is left past the tracked edge
    _, bw = cv2.threshold(g, 200, 255, cv2.THRESH_BINARY)
    bw = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    cs, _ = cv2.findContours(bw, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cs = [k for k in cs if cv2.contourArea(k) > 4000 * K * K and cv2.pointPolygonTest(k, tuple(map(float, c)), False) >= 0]
    if cs: cv2.fillConvexPoly(quad, cv2.convexHull(max(cs, key=cv2.contourArea)), 255)
    quad = cv2.GaussianBlur(quad, (3, 3), 0).astype(np.float32) / 255
    # glove/sleeve matte: the dark glove region with its holes filled (so fingertip highlights stay glove, not screen),
    # grown by 1 px; the edge ring is pushed to the glove's own dark tone so no pale outline is left behind
    dark = cv2.morphologyEx((g < 110).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))   # no closing: it would bridge the gaps between fingers
    glove = dark
    ring = cv2.dilate(glove, np.ones((5, 5), np.uint8)) - glove
    f = f.copy(); dk = cv2.erode(f, np.ones((5, 5), np.uint8)); sel = (ring > 0) & (quad > 0.5); f[sel] = dk[sel]
    keep = cv2.dilate(glove, np.ones((3, 3), np.uint8))
    near = cv2.dilate(glove, np.ones((9, 9), np.uint8)) > 0
    scr = np.where(near, g > 185, g > 120)      # beside the glove only clearly white pixels are screen, so grey shine on the glove stays glove
    key = cv2.GaussianBlur((scr & (keep == 0)).astype(np.float32), (3, 3), 0)
    m = (quad * key)[..., None]
    outf = (warped * m + f * (1 - m)).astype(np.uint8)
    if os.environ.get("DBG") and fi == int(os.environ["DBG"]):
        y0, x0 = 560, 560; cr = lambda a: a[y0:y0 + 300, x0:x0 + 360]
        tov = lambda a: cv2.cvtColor((np.clip(a, 0, 1) * 255).astype(np.uint8), cv2.COLOR_GRAY2BGR)
        cv2.imwrite(out + ".dbg.png", np.vstack([np.hstack([cr(F[fi]), cr(outf), cr(warped)]), np.hstack([tov(cr(quad)), tov(cr(key)), tov(cr(keep.astype(np.float32)))])]))
    vw.write(outf)
vw.release()
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", out + ".tmp.mp4", "-i", src, "-map", "0:v", "-map", "1:a?",
                "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "copy", out], check=True)
os.remove(out + ".tmp.mp4")
print(os.path.basename(out), len(F), "frames; reference frame", ref, "; clean measurements", sum(1 for m in meas if m[0] is not None))
