"""Write each film's search-ready YouTube details and the website's matching VideoObject.

Usage: python3 -I metadata.py <media dir> [id ...]
Reads films.json (seo block), tours.json and <media>/<id>/cine/film.json; writes <media>/<id>/cine/youtube.json
(title, description with the site link first and chapters, tags, category, playlist, captions, thumbnail) and
<media>/<id>/cine/videoobject.json (schema.org JSON-LD for the business's own site; the YouTube id is filled in by
upload.py once the video exists). Every claim comes from the business's own site via tours.json and films.json.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 30
CATEGORY = "28"   # Science & Technology


def stamp(frames):
    s = int(frames / FPS)
    return f"{s // 60:02d}:{s % 60:02d}"


def main():
    media, only = os.path.abspath(sys.argv[1]), sys.argv[2:]
    tours = {b["id"]: b for b in json.load(open(os.path.join(HERE, "..", "tours.json"), encoding="utf-8"))["businesses"]}
    films = json.load(open(os.path.join(HERE, "films.json"), encoding="utf-8"))["films"]
    for bid, plan in films.items():
        if only and bid not in only:
            continue
        cine = os.path.join(media, bid, "cine")
        film = json.load(open(os.path.join(cine, "film.json")))
        biz, seo = tours[bid], plan["seo"]
        raw, mp4 = os.path.join(cine, f"{bid}-film.mp4"), os.path.join(cine, f"{bid}-final.mp4")
        if not os.path.exists(mp4) or os.path.getmtime(mp4) < os.path.getmtime(raw):
            # YouTube plays at about -14 LUFS; the render comes out near -26 dB, so level it (picture copied untouched)
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", raw, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
                            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", mp4], check=True)
        secs = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4],
                                    capture_output=True, text=True).stdout or film["durationInFrames"] / FPS)
        # a scene under 10 s folds into the chapter before it (YouTube rejects chapters shorter than 10 s)
        long_enough = [s for s in film["scenes"][1:] if s["frames"] >= 10 * FPS]
        chapters = [f"00:00 {film['scenes'][0]['chapter']}"] + [f"{stamp(s['from'])} {s['chapter']}" for s in long_enough]
        desc = "\n".join([
            f"{seo['summary']}",
            "",
            f"Visit {biz['url']}",
            "",
            "Chapters",
            *chapters,   # YouTube needs 3+ chapters of 10 s or more; the 3.5 s logo lock stays inside the last one
            "",
            "Every screen shown is the live public website, captured 23/10/2026. Equipment shown is from real product photography.",
            "Narrated by Margot, Unite Group's product ambassador. Margot's voice is AI-generated (ElevenLabs).",
            "",
            " ".join(seo["hashtags"]),
        ])
        if len(desc) > 4900:
            sys.exit(f"{bid}: description too long ({len(desc)})")
        yt = {"title": seo["title"][:100], "description": desc, "tags": seo["tags"], "categoryId": CATEGORY, "privacyStatus": "unlisted",
              "playlist": seo["playlist"], "video": mp4, "captions": os.path.join(cine, "captions.srt"), "thumbnail": os.path.join(cine, "thumbnail.jpg"),
              "studioOnly": ["Altered or synthetic content: Yes (AI narration)", "Video language: English (Australia)",
                             "Caption language: English (Australia)", "Recording location: Australia"]}
        json.dump(yt, open(os.path.join(cine, "youtube.json"), "w"), indent=1, ensure_ascii=False)
        vo = {"@context": "https://schema.org", "@type": "VideoObject", "name": seo["title"], "description": seo["summary"],
              "thumbnailUrl": "https://i.ytimg.com/vi/{youtubeId}/maxresdefault.jpg", "uploadDate": "{uploadDate}",
              "duration": f"PT{int(secs // 60)}M{int(secs % 60)}S", "embedUrl": "https://www.youtube.com/embed/{youtubeId}",
              "contentUrl": "https://www.youtube.com/watch?v={youtubeId}", "inLanguage": "en-AU",
              "publisher": {"@type": "Organization", "name": biz["name"], "url": biz["url"]},
              "hasPart": [{"@type": "Clip", "name": s["chapter"], "startOffset": int(s["from"] / FPS),
                           "endOffset": int((s["from"] + s["frames"]) / FPS), "url": "https://www.youtube.com/watch?v={youtubeId}&t=" + str(int(s["from"] / FPS))}
                          for s in film["scenes"]]}
        json.dump(vo, open(os.path.join(cine, "videoobject.json"), "w"), indent=1, ensure_ascii=False)
        if len(chapters) < 3:
            sys.exit(f"{bid}: only {len(chapters)} chapters of 10 s or more; YouTube needs 3")
        print(f"{bid}: title {len(yt['title'])} chars, description {len(desc)} chars, {len(chapters)} chapters, {secs:.0f}s")


if __name__ == "__main__":
    main()
