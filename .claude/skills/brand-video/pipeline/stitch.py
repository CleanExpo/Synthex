#!/usr/bin/env python3
"""stitch.py <slug> — build list.txt from transcript.json beats (one image per
beat) and render <slug>/final-1080p.mp4 at 1920x1080@25. Falls back to an even
time-split if image count != beat count. Run AFTER tts.py and image generation."""
import sys, os, json, glob, subprocess
slug = sys.argv[1]
d = slug
beats = json.load(open(f"{d}/transcript.json"))
imgs = sorted(glob.glob(f"{d}/images/*.png"))
if not imgs:
    sys.exit(f"{slug}: no images in {d}/images/")
vo = f"{d}/voiceover.mp3"
vodur = float(subprocess.check_output(
    ["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",vo]).strip())

# starts: one per image. If counts match, use beat starts; else even split.
n = len(imgs)
if n == len(beats):
    starts = [b["start"] for b in beats]
else:
    starts = [i*vodur/n for i in range(n)]
starts.append(vodur)  # sentinel end

lines = []
for i, img in enumerate(imgs):
    dur = round(max(0.4, starts[i+1]-starts[i]), 3)
    lines.append(f"file '{os.path.relpath(img, d)}'")
    lines.append(f"duration {dur}")
lines.append(f"file '{os.path.relpath(imgs[-1], d)}'")  # concat needs last repeated
open(f"{d}/list.txt","w").write("\n".join(lines)+"\n")

subprocess.check_call([
    "ffmpeg","-y","-loglevel","error","-f","concat","-safe","0","-i",f"{d}/list.txt",
    "-i",vo,"-vf",
    "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=25,format=yuv420p",
    "-c:v","libx264","-preset","medium","-crf","19","-c:a","aac","-b:a","192k",
    "-shortest",f"{d}/final-1080p.mp4"])
fd = subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f"{d}/final-1080p.mp4"]).strip().decode()
print(f"{slug}: rendered {d}/final-1080p.mp4 ({fd}s, {n} imgs, {len(beats)} beats)")
