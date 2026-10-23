"""Upload the built demos to YouTube (unlisted) through the Composio YouTube connection, set each thumbnail,
and record the video IDs so the card can link to them.

Usage:
  python3 -I upload.py <out dir> channels            list the channel behind each connected YouTube account
  python3 -I upload.py <out dir> upload <account> [id ...]   upload (skips any already in videos.json, and any
                                                             business whose youtubeChannelId is not this account's channel)

Writes <out dir>/videos.json: {id: {"youtubeId", "account", "channel"}}. Never uploads twice.
Uploads are unlisted: anyone with the link (the card) can watch; they stay out of search until made public.
Tick "Altered or synthetic content" in YouTube Studio for each (the narration is a synthetic voice).
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CATEGORY = "28"   # Science & Technology


def composio(slug, data, account, file=None):
    cmd = ["composio", "execute", slug, "--account", account, "-d", json.dumps(data)]
    if file:
        cmd += ["--file", file]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    out = r.stdout
    try:
        res = json.loads(out[out.index("{"):])
    except ValueError:
        sys.exit(f"{slug}: unreadable reply\n{(out or r.stderr)[-600:]}")
    if res.get("error") or res.get("successful") is False:
        sys.exit(f"{slug} failed: {str(res.get('error'))[:600]}")
    return res


def accounts():
    out = subprocess.run(["composio", "connections", "list"], capture_output=True, text=True).stdout
    d = json.loads(out[out.index("{"):])
    return [c["word_id"] for c in d.get("youtube", []) if c.get("status") == "ACTIVE"]


def main():
    out, mode = os.path.abspath(sys.argv[1]), sys.argv[2]
    tours = json.load(open(os.path.join(HERE, "tours.json"), encoding="utf-8"))
    vpath = os.path.join(out, "videos.json")
    videos = json.load(open(vpath)) if os.path.exists(vpath) else {}
    if mode == "link":
        # Point the card at each uploaded video: the business's link gets {youtubeId, thumb} and is shown to visitors
        label = {"disaster-recovery": "Disaster Recovery", "carsi": "CARSI", "restoreassist": "RestoreAssist",
                 "synthex": "Synthex", "nrpg": "NRPG", "tradehall": "TradeHall"}
        kit_path = os.path.join(HERE, "..", "brand-kits", "phill-mcgurk.json")
        kit = json.load(open(kit_path, encoding="utf-8"))
        for l in kit["person"]["links"]:
            bid = next((k for k, v in label.items() if v == l["label"]), None)
            if bid and bid in videos and l.get("url"):
                l["video"] = {"youtubeId": videos[bid]["youtubeId"], "thumb": f"business-card/demos/thumbs/{bid}.jpg",
                              "source": "demos/upload.py, unlisted upload of the demo built from the live site"}
                l["visitor"] = True
                print(l["label"], "->", "https://youtu.be/" + videos[bid]["youtubeId"])
        with open(kit_path, "w", encoding="utf-8") as f:
            json.dump(kit, f, indent=2, ensure_ascii=False)
            f.write("\n")
        return
    if mode == "channels":
        for a in accounts():
            res = composio("YOUTUBE_GET_CHANNEL_STATISTICS", {"mine": True, "part": "snippet,statistics"}, a)
            items = (res.get("data") or {}).get("items") or (res.get("data") or {}).get("response_data", {}).get("items") or []
            for c in items:
                print(a, "|", c.get("id"), "|", c["snippet"]["title"], "|", c["snippet"].get("customUrl"))
            if not items:
                print(a, "| no channel found in reply")
        return
    account, only = sys.argv[3], sys.argv[4:]
    # each film goes only to its own business's channel (tours.json youtubeChannelId): never to whichever channel is connected
    res = composio("YOUTUBE_GET_CHANNEL_STATISTICS", {"mine": True, "part": "snippet"}, account)
    items = (res.get("data") or {}).get("items") or (res.get("data") or {}).get("response_data", {}).get("items") or []
    if len(items) != 1:
        sys.exit(f"{account}: expected one channel behind this connection, got {len(items)}")
    channel = items[0]["id"]
    print(account, "is", channel, items[0]["snippet"]["title"])
    by_id = {b["id"]: b for b in tours["businesses"]}
    for biz in tours["businesses"]:
        if (only and biz["id"] not in only) or biz["id"] in videos:
            continue
        # youtubeChannelOf: this business publishes on another business's channel (NRPG and TradeHall on Disaster Recovery's)
        own = by_id.get(biz.get("youtubeChannelOf"), biz).get("youtubeChannelId")
        if own != channel:
            print(f"{biz['id']}: skipped, its own channel is {own or 'not set up yet'}, not {channel}")
            continue
        d = os.path.join(out, biz["id"])
        # the cinematic film and its search-ready details (cinematic/metadata.py); never the old screen-scroll demo
        yt = json.load(open(os.path.join(d, "cine", "youtube.json"), encoding="utf-8"))
        res = composio("YOUTUBE_UPLOAD_VIDEO", {"title": yt["title"], "description": yt["description"], "tags": yt["tags"],
                                                "categoryId": yt["categoryId"], "privacyStatus": yt["privacyStatus"], "videoFilePath": yt["video"]},
                       account, file=yt["video"])
        vid = json.dumps(res)
        m = re.search(r'"id"\s*:\s*"([A-Za-z0-9_-]{11})"', vid)
        if not m:
            sys.exit(f"{biz['id']}: uploaded but no video id in the reply: {vid[:400]}")
        yid = m.group(1)
        videos[biz["id"]] = {"youtubeId": yid, "account": account, "channel": channel}
        json.dump(videos, open(vpath, "w"), indent=2)
        done = []
        # captions (Margot's words, timed) so search and accessibility read the film
        try:
            composio("YOUTUBE_UPLOAD_CAPTION_TRACK", {"videoId": yid, "language": "en-AU", "name": "English (Australia)", "isDraft": False},
                     account, file=yt["captions"])
            done.append("captions")
        except SystemExit as e:
            print(f"{biz['id']}: captions not uploaded ({e}); upload {yt['captions']} in YouTube Studio")
        # the business's playlist, made once and reused
        try:
            lists = json.dumps(composio("YOUTUBE_LIST_USER_PLAYLISTS", {"maxResults": 50}, account))
            pm = re.search(r'"id"\s*:\s*"(PL[A-Za-z0-9_-]+)"[^{}]*?"title"\s*:\s*"' + re.escape(yt["playlist"]) + '"', lists)
            pid = pm.group(1) if pm else re.search(r'"(PL[A-Za-z0-9_-]+)"', json.dumps(composio(
                "YOUTUBE_CREATE_PLAYLIST", {"title": yt["playlist"], "privacyStatus": "unlisted"}, account))).group(1)
            composio("YOUTUBE_ADD_VIDEO_TO_PLAYLIST", {"playlistId": pid, "videoId": yid}, account)
            done.append("playlist")
        except (SystemExit, AttributeError) as e:
            print(f"{biz['id']}: playlist not set ({e}); add it to '{yt['playlist']}' in YouTube Studio")
        # the thumbnail tool takes a public image URL: thumbs.json maps each id to one (e.g. a Higgsfield media URL)
        tpath = os.path.join(out, "thumbs.json")
        turl = (json.load(open(tpath)) if os.path.exists(tpath) else {}).get(biz["id"])
        try:
            if not turl:
                raise SystemExit("no public URL in thumbs.json")
            composio("YOUTUBE_UPDATE_THUMBNAIL", {"videoId": yid, "thumbnailUrl": turl}, account)
            done.append("thumbnail")
        except SystemExit as e:
            print(f"{biz['id']}: thumbnail not set ({e}); set it in YouTube Studio from {yt['thumbnail']}")
        # the website's VideoObject now points at the real video
        vpath_o = os.path.join(d, "cine", "videoobject.json")
        if os.path.exists(vpath_o):
            import datetime
            txt = open(vpath_o, encoding="utf-8").read().replace("{youtubeId}", yid).replace("{uploadDate}", datetime.date.today().isoformat())
            open(vpath_o, "w", encoding="utf-8").write(txt)
            done.append("videoobject")
        print(f"{biz['id']}: set {', '.join(done) or 'nothing extra'}; in YouTube Studio tick: {'; '.join(yt['studioOnly'])}")
        print(f"{biz['id']}: https://youtu.be/{m.group(1)}")


if __name__ == "__main__":
    main()
