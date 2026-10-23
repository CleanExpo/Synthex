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
    for biz in tours["businesses"]:
        if (only and biz["id"] not in only) or biz["id"] in videos:
            continue
        if biz.get("youtubeChannelId") != channel:
            print(f"{biz['id']}: skipped, its own channel is {biz.get('youtubeChannelId') or 'not set up yet'}, not {channel}")
            continue
        d = os.path.join(out, biz["id"])
        desc = open(os.path.join(d, "description.txt"), encoding="utf-8").read()
        title = f"{biz['name']}: {biz['tagline']} (demo)"[:100]
        tags = [biz["name"], "restoration", "Australia", "demo"]
        res = composio("YOUTUBE_UPLOAD_VIDEO", {"title": title, "description": desc, "tags": tags, "categoryId": CATEGORY,
                                                "privacyStatus": "unlisted", "videoFilePath": os.path.join(d, f"{biz['id']}-demo.mp4")},
                       account, file=os.path.join(d, f"{biz['id']}-demo.mp4"))
        vid = json.dumps(res)
        m = re.search(r'"id"\s*:\s*"([A-Za-z0-9_-]{11})"', vid)
        if not m:
            sys.exit(f"{biz['id']}: uploaded but no video id in the reply: {vid[:400]}")
        videos[biz["id"]] = {"youtubeId": m.group(1), "account": account, "channel": channel}
        json.dump(videos, open(vpath, "w"), indent=2)
        # the thumbnail tool takes a public image URL: thumbs.json maps each id to one (e.g. a Higgsfield media URL)
        tpath = os.path.join(out, "thumbs.json")
        turl = (json.load(open(tpath)) if os.path.exists(tpath) else {}).get(biz["id"])
        if turl:
            try:
                composio("YOUTUBE_UPDATE_THUMBNAIL", {"videoId": m.group(1), "thumbnailUrl": turl}, account)
            except SystemExit as e:
                print(f"{biz['id']}: thumbnail not set ({e}); set it in YouTube Studio from {d}/thumbnail.jpg")
        else:
            print(f"{biz['id']}: no public thumbnail URL; set it in YouTube Studio from {d}/thumbnail.jpg")
        print(f"{biz['id']}: https://youtu.be/{m.group(1)}")


if __name__ == "__main__":
    main()
