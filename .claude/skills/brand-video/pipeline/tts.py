#!/usr/bin/env python3
import os, json, base64, urllib.request, re, sys
KEY = os.environ["ELEVENLABS_API_KEY"]
VOICE = os.environ["ELEVENLABS_VOICE_ID"]
DIR = os.environ["DIR"]
text = open(os.path.join(DIR, "script.md")).read().strip()
url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps"
body = json.dumps({"text": text, "model_id": "eleven_multilingual_v2"}).encode()
req = urllib.request.Request(url, data=body, method="POST",
    headers={"xi-api-key": KEY, "content-type": "application/json"})
try:
    resp = urllib.request.urlopen(req, timeout=120)
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:300]); sys.exit(1)
data = json.loads(resp.read())
open(os.path.join(DIR, "voiceover.mp3"), "wb").write(base64.b64decode(data["audio_base64"]))
al = data["alignment"]; chars = al["characters"]; starts = al["character_start_times_seconds"]; ends = al["character_end_times_seconds"]
beats, buf, seg = [], "", None
for i, c in enumerate(chars):
    if seg is None and c.strip(): seg = starts[i]
    buf += c
    if c in ".?!" and (i+1 >= len(chars) or chars[i+1] == " "):
        t = buf.strip()
        if t: beats.append({"text": t, "start": round(seg,3), "end": round(ends[i],3)})
        buf, seg = "", None
if buf.strip(): beats.append({"text": buf.strip(), "start": round(seg or 0,3), "end": round(ends[-1],3)})
json.dump(beats, open(os.path.join(DIR, "transcript.json"), "w"), indent=2)
print(f"{os.path.basename(DIR)}: {ends[-1]:.1f}s, {len(beats)} beats")
for b in beats: print(f"  [{b['start']:5.2f}-{b['end']:5.2f}] {b['text'][:54]}")
