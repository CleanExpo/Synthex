"""Build one narrated demo video per business from the live-site captures (see capture.mjs).

Usage: python3 -I build.py <out dir> [id ...]

For each business in tours.json:
  1. narration: one ElevenLabs clip per segment (cached by voice and text), in Margot's voice
  2. picture:   each segment pans smoothly down its page capture for exactly as long as its narration
  3. a title card (blurred hero + name) at the start and an end card (name, address, card) at the finish
  4. captions burnt in, plus captions.srt for upload; loudness normalised to -14 LUFS
  5. thumbnail.jpg (1280x720 desktop screenshot + title), description.txt with chapters and the AI notice
Nothing is invented: every frame is the real public site, and the words come from tours.json.
Secrets are read from ~/.hermes/.env and never printed.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import textwrap
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
W, H, FPS = 1920, 1080, 30
GAP = 1.1           # breath after each narration clip (also leaves time to read the screen)
SPEED = 0.9         # ElevenLabs delivery speed: a calmer pace than the voice's default
INTRO, OUTRO = 4.0, 7.0
MARGOT_VOICE = "p43fx6U8afP2xoq1Ai9f"   # Margot, Product Ambassador: she voices every product film (never ELEVENLABS_VOICE_ID)
CARD_URL = "card.unite-group.ink"
CARD_LIVE = os.environ.get("CARD_LIVE") == "1"   # set once the card answers on its own address


def env():
    out = {}
    for line in open(os.path.expanduser("~/.hermes/.env"), encoding="utf-8"):
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit("command failed: " + " ".join(cmd[:6]) + "\n" + r.stderr[-1500:])
    return r.stdout


def duration(path):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).strip())


def tts(text, path, key, voice):
    if os.path.exists(path):
        return
    body = json.dumps({"text": text, "model_id": "eleven_multilingual_v2",
                       "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.15, "use_speaker_boost": True,
                                          "speed": SPEED}}).encode()
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
                                 data=body, headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    try:
        data = urllib.request.urlopen(req, timeout=120).read()
    except urllib.error.HTTPError as e:
        sys.exit(f"narration failed ({e.code}): {e.read().decode()[:300]}")
    with open(path, "wb") as f:
        f.write(data)


def esc(s):
    """Text for ffmpeg drawtext."""
    return s.replace("\\", "\\\\").replace(":", "\\:").replace("'", "’").replace("%", "\\%")


def srt_time(t):
    h, m = int(t // 3600), int(t % 3600 // 60)
    s = t - h * 3600 - m * 60
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", ",")


def chapter_label(seg, biz):
    first = re.split(r"(?<=[.?!])\s", seg["say"])[0]
    words = first.split()
    return " ".join(words[:7]).rstrip(",.") + ("…" if len(words) > 7 else "")


def build(biz, out, key, voice):
    d = os.path.join(out, biz["id"])
    os.makedirs(os.path.join(d, "audio"), exist_ok=True)
    os.makedirs(os.path.join(d, "parts"), exist_ok=True)
    pages = os.path.join(d, "pages")
    # 1. narration
    segs = []
    for i, s in enumerate(biz["segments"]):
        h = hashlib.sha1((voice + str(SPEED) + s["say"]).encode()).hexdigest()[:10]
        a = os.path.join(d, "audio", f"{i:02d}-{h}.mp3")
        tts(s["say"], a, key, voice)
        segs.append({**s, "audio": a, "dur": duration(a) + GAP})
    # 2. picture: title card, one pan per segment, end card
    parts = []
    hero = os.path.join(d, "hero.png")
    title = os.path.join(d, "parts", "00-title.mp4")
    opener = os.path.join(d, "opener-hf.mp4")   # Higgsfield push-in animated from this hero frame, when present
    intro = INTRO
    names = (f"drawtext=fontfile='{FONT}':text='{esc(biz['name'])}':fontcolor=white:fontsize=104:x=90:y=h-300:"
             f"box=1:boxcolor=0x04080E@0.72:boxborderw=24,"
             f"drawtext=fontfile='{FONT_REG}':text='{esc(biz['tagline'])}':fontcolor=0xF4A27E:fontsize=46:x=96:y=h-160,")
    if os.path.exists(opener):
        intro = duration(opener)
        run(["ffmpeg", "-y", "-i", opener, "-vf", f"scale={W}:{H},fps={FPS}," + names +
             f"fade=t=in:st=0:d=0.5,fade=t=out:st={intro - 0.5:.3f}:d=0.5,format=yuv420p",
             "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", title])
    else:
        run(["ffmpeg", "-y", "-loop", "1", "-framerate", str(FPS), "-i", hero, "-t", str(intro), "-vf",
             "boxblur=18:2,eq=brightness=-0.28," + names +
             f"fade=t=in:st=0:d=0.6,fade=t=out:st={intro - 0.5}:d=0.5,format=yuv420p",
             "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18", title])
    parts.append(title)
    for i, s in enumerate(segs):
        slug = "home" if s["path"] == "/" else s["path"].strip("/").replace("/", "-")
        img = os.path.join(pages, slug + ".png")
        ih = int(run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=height", "-of", "csv=p=0", img]).strip())
        y0 = min(max(0, int(s["from"] * ih)), max(0, ih - H))
        y1 = min(max(y0, int(s["to"] * ih) - H), max(0, ih - H))
        D = s["dur"]
        part = os.path.join(d, "parts", f"{i + 1:02d}.mp4")
        run(["ffmpeg", "-y", "-loop", "1", "-framerate", str(FPS), "-i", img, "-t", f"{D:.3f}", "-vf",
             f"crop={W}:{H}:0:'{y0}+({y1}-{y0})*(1-cos(PI*min(t\\,{D:.3f})/{D:.3f}))/2',"
             f"fade=t=in:st=0:d=0.35,fade=t=out:st={max(0, D - 0.35):.3f}:d=0.35,format=yuv420p",
             "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18", part])
        parts.append(part)
    end = os.path.join(d, "parts", "99-end.mp4")
    host = biz["url"].split("//")[1].split("/")[0].replace("www.", "")
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c=0x04080E:s={W}x{H}:r={FPS}", "-t", str(OUTRO), "-vf",
         f"drawtext=fontfile='{FONT}':text='{esc(biz['name'])}':fontcolor=white:fontsize=110:x=(w-text_w)/2:y=330,"
         f"drawtext=fontfile='{FONT_REG}':text='{esc(host)}':fontcolor=0xE55A2B:fontsize=64:x=(w-text_w)/2:y=490,"
         + (f"drawtext=fontfile='{FONT_REG}':text='Save Phill McGurk’s card at {esc(CARD_URL)}':fontcolor=white@0.85:fontsize=44:x=(w-text_w)/2:y=640," if CARD_LIVE else "")
         + "fade=t=in:st=0:d=0.5,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "18", end])
    parts.append(end)
    listing = os.path.join(d, "parts", "list.txt")
    with open(listing, "w") as f:
        f.writelines(f"file '{p}'\n" for p in parts)
    silent = os.path.join(d, "parts", "picture.mp4")
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", listing, "-c", "copy", silent])
    # 3. narration track: silence under the title card, each clip plus its breath, silence under the end card
    alist = os.path.join(d, "parts", "audio.txt")
    sil = lambda sec, name: (run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", f"{sec:.3f}",
                                  "-c:a", "pcm_s16le", os.path.join(d, "parts", name)]), os.path.join(d, "parts", name))[1]
    pieces = [sil(intro, "intro.wav")]
    for i, s in enumerate(segs):
        wav = os.path.join(d, "parts", f"a{i:02d}.wav")
        run(["ffmpeg", "-y", "-i", s["audio"], "-af", f"apad=whole_dur={s['dur']:.3f}", "-ar", "44100", "-ac", "2", "-c:a", "pcm_s16le", wav])
        pieces.append(wav)
    pieces.append(sil(OUTRO, "outro.wav"))
    with open(alist, "w") as f:
        f.writelines(f"file '{p}'\n" for p in pieces)
    voice_wav = os.path.join(d, "parts", "voice.wav")
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", alist, "-c", "copy", voice_wav])
    # 4. captions (sentence by sentence, timed by share of characters) and chapters
    srt, chapters, t = [], [], intro
    n = 1
    for s in segs:
        chapters.append((t, chapter_label(s, biz)))
        speech = s["dur"] - GAP
        # caption chunks: each sentence, wrapped into pieces that fit two caption lines
        sentences = [chunk for x in re.split(r"(?<=[.?!])\s+", s["say"]) if x for chunk in textwrap.wrap(x, 84)]
        total = sum(len(x) for x in sentences)
        st = t
        for x in sentences:
            en = st + speech * len(x) / total
            srt.append(f"{n}\n{srt_time(st)} --> {srt_time(en - 0.05)}\n{textwrap.fill(x, 52)}\n")
            n += 1
            st = en
        t += s["dur"]
    srt_path = os.path.join(d, "captions.srt")
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(srt))
    final = os.path.join(d, f"{biz['id']}-demo.mp4")
    style = "FontName=Arial,FontSize=15,PrimaryColour=&H00FFFFFF,BackColour=&H99000000,BorderStyle=4,Outline=0,Shadow=0,MarginV=34"
    run(["ffmpeg", "-y", "-i", silent, "-i", voice_wav, "-vf", f"subtitles='{srt_path}':force_style='{style}'",
         "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-shortest", final])
    # 5. thumbnail and description
    thumb = os.path.join(d, "thumbnail.jpg")
    run(["ffmpeg", "-y", "-i", hero, "-vf",
         "scale=1280:720,drawbox=x=0:y=430:w=1280:h=290:color=0x04080E@0.82:t=fill,"
         f"drawtext=fontfile='{FONT}':text='{esc(biz['name'])}':fontcolor=white:fontsize=86:x=60:y=470,"
         f"drawtext=fontfile='{FONT_REG}':text='{esc(biz['tagline'])}':fontcolor=0xF4A27E:fontsize=40:x=62:y=585,"
         "drawbox=x=0:y=712:w=1280:h=8:color=0xE55A2B:t=fill", "-q:v", "3", thumb])
    total_len = duration(final)
    lines = [f"{biz['name']}: {biz['tagline']}", "", f"Visit {biz['url']}"] + \
        ([f"Phill McGurk's card: https://{CARD_URL}"] if CARD_LIVE else []) + ["", "Chapters"]
    lines.append("00:00 Intro")
    for start, label in chapters:
        lines.append(f"{int(start // 60):02d}:{int(start % 60):02d} {label}")
    lines += ["", "Every frame is the live public website. Narration uses an ElevenLabs synthetic voice; "
              "flag the upload as altered or synthetic content in YouTube Studio."]
    with open(os.path.join(d, "description.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"{biz['id']}: {total_len:.1f}s -> {final}")
    return total_len


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    out = os.path.abspath(sys.argv[1])
    only = sys.argv[2:]
    e = env()
    tours = json.load(open(os.path.join(HERE, "tours.json"), encoding="utf-8"))
    for biz in tours["businesses"]:
        if only and biz["id"] not in only:
            continue
        build(biz, out, e["ELEVENLABS_API_KEY"], e.get("MARGOT_ELEVENLABS_VOICE_ID", MARGOT_VOICE))


if __name__ == "__main__":
    main()
