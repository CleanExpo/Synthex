# Business demo videos

One narrated demo per business, made from its **live public website**, uploaded to YouTube (unlisted) and
linked from Phill's card. Built 23/10/2026 at Phill's request ("build the live demos ... 1 for each of
the businesses ... use the Higgsfield ... connect the business card to that link").

| Business          | Site                                 |
| ----------------- | ------------------------------------ |
| Disaster Recovery | https://www.disasterrecovery.com.au  |
| CARSI             | https://carsi.com.au                 |
| RestoreAssist     | https://restoreassist.app            |
| Synthex           | https://synthex.social               |
| NRPG              | https://nrpg.business                |
| NRPG Trade Hall   | https://cleanexpo247-hall.vercel.app |

Unite Group has no public site yet (unite-group.in is a login page); Restoration World's page is not live.

## How it is made (re-run whenever a site changes)

```bash
node business-card/demos/capture.mjs "/Volumes/Mini Mini 2T Storage/media/card-demos"
python3 -I business-card/demos/build.py "/Volumes/Mini Mini 2T Storage/media/card-demos"
python3 -I business-card/demos/upload.py "/Volumes/Mini Mini 2T Storage/media/card-demos" channels
python3 -I business-card/demos/upload.py "/Volumes/Mini Mini 2T Storage/media/card-demos" upload <youtube account>
```

1. **capture.mjs** loads every page in `tours.json` from the live site (1920 wide), declines optional
   cookies, and saves a full-page capture plus a 1920x1080 hero frame. A page that does not answer 200
   stops that business, so a demo never shows an error page.
2. **Opener** (Higgsfield, Seedance 2.5, 5 s, 1080p, 80 credits each): a slow push-in animated from the
   real hero frame, prompted to keep every word and image unchanged. Checked frame by frame; the text
   stays intact. 480 credits for six. Saved as `<out>/<id>/opener-hf.mp4`.
3. **build.py** narrates each segment with ElevenLabs (library voice "Steve – Australian Male", speed 0.9),
   pans down the page capture for exactly as long as each line, adds the opener with the business name,
   an end card with the address, burnt-in captions (and `captions.srt`), loudness at -14 LUFS, a
   1280x720 desktop-screenshot thumbnail, and `description.txt` with chapters.
4. **upload.py** uploads each video unlisted, sets the thumbnail (from a public URL in `thumbs.json`),
   and records the YouTube IDs in `videos.json`.

Narration only repeats what each site says about itself (headings captured 23/10/2026 in
`capture-report.json`); no prices are quoted. Video files stay on the 2 TB drive, never in git (the
repo is public). See `BEST-PRACTICE.md` and the wiki page `living-card/lc-09-demo-videos.md`.

## Before making a video public

- Confirm the claims each video repeats from its site (for example "24/7", "IICRC-certified contractors").
- In YouTube Studio, tick **Altered or synthetic content** (the narration is a synthetic voice).
- The end card does not mention the card's address until the card is live (`CARD_LIVE=1`).
