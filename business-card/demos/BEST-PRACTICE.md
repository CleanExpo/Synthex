# Demo video production checklist (one per business, about 3:00)

Sources and tags: 2nd Brain `Wiki/living-card/lc-09-demo-videos.md` (23/10/2026). Not legal advice.

## Script

- [ ] About 150 words per minute (wpm) of narration, so 400–430 words for 3:00 (leaves room for pauses).
- [ ] 0:00–0:08: opener plus the problem in one line. Say the call to action (CTA) by 0:30, not only at the end. YouTube's Intro metric counts who is still watching at 30 s, and Wistia sees most viewers leave around the halfway point.
- [ ] Shape: problem → what the business does → 3–4 site sections, one idea each → proof → CTA plus URL.
- [ ] Every claim is one Phill can prove, including claims copied from the site ("24/7", "Australia-wide", "80 published courses", "trusted across Australia"). The ACCC says a business "must be able to prove any claim they advertise".
- [ ] CARSI: say "CEC hours on courses the IICRC has approved", per named course only. Never say "IICRC accredited", "IICRC certified" or "nationally recognised".
- [ ] Synthex: internal agency for Unite Group, with no pricing, launch or customer framing (FD-8).
- [ ] Testimonials: real, unedited, with any incentive disclosed (see lc-02 and lc-04). Before/after shots: owned job photos only, labelled as that job.
- [ ] Write numbers as they should be spoken ("twenty-four seven"); expand abbreviations.

## Capture

- [ ] Main footage: full-page PNG at 1920 wide (capture.mjs), panned in ffmpeg with an eased crop at 30 or 60 fps. Smooth and needs no cursor.
- [ ] Playwright `recordVideo` only for short interactions. It gives VP8 at 25 fps (tested), and `size` must be set or it shrinks to fit 800x800.
- [ ] Hide cookie and chat pop-ups. Never show an error page or a logged-in screen with real customer data.

## Opener (Higgsfield)

- [ ] Animate the real screenshot only (pan, parallax, light). No invented damage, people or results.
- [ ] Route it through the studio `generate_video` tool (real-images-only rule), not a direct provider call.

## Narration (ElevenLabs)

- [ ] Multilingual v2 for long-form (10,000 characters per request). Split by segment and pass previous/next text for consistent intonation.
- [ ] Start from the defaults: stability 0.5, similarity 0.75, style 0, speaker boost on, speed 1.0 (allowed range 0.7–1.2).
- [ ] `<break time="1.0s" />` works up to 3 s, but not on v3 or v4. Use only a few.
- [ ] Commercial-use rights for the ElevenLabs plan and Higgsfield output: check before publishing (UNCONFIRMED).

## Mix and captions (ffmpeg; tested 23/10/2026 with a test tone)

```
# inputs: 0 = video, 1 = narration, 2 = music
[2:a]volume=0.15[m];[m][1:a]sidechaincompress=threshold=0.02:ratio=20:attack=15:release=500[duck];
[duck][1:a]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a];
[0:v]subtitles=narration.srt:force_style='FontName=Helvetica,FontSize=22,Outline=2,MarginV=60'[v]
```

- [ ] Music at least 20 dB under the voice (WCAG 1.4.7 benchmark; that criterion formally covers audio-only content). Re-measure on real speech with `volumedetect`. The test gave about 25 dB, while looser settings gave only 11 dB.
- [ ] Final −14 LUFS integrated, measured with the `ebur128` filter (YouTube's reference level is from secondary sources).
- [ ] Captions: burned in for the card embed (WCAG 1.2.2, G93), and upload the SRT to YouTube too.
- [ ] Export: H.264, CRF 18, yuv420p, AAC 192k at 48 kHz, 1920x1080.

## YouTube

- [ ] Thumbnail: 16:9, 3840x2160 recommended (minimum width 640), JPG or PNG; 2 MB limit on mobile, 50 MB on desktop; the channel must be verified. Crop to one hero element and add 2–4 large words plus the logo.
- [ ] Title and description first (tags "play a minimal role"). Business URL in the first description line.
- [ ] Cards: up to 5. External link cards need YouTube Partner Program membership, so link the site in the description and end screen instead.
- [ ] Chapters: first 00:00, at least 3, each at least 10 s.
- [ ] End screen in the last 5–20 s, up to 4 elements (video at least 25 s, not made-for-kids).
- [ ] Altered or synthetic content: tick "yes" for the AI opener and AI voice. It costs no reach or monetisation.
- [ ] Unlisted first, with "Allow embedding" on. Embed via youtube-nocookie.com, and send a Referer header (otherwise error 153).
- [ ] Phill watches the exact rendered file before it goes public or onto the card.
