# Reel breakdown schema (v1.1)

One JSON object per reel. The measured half comes from `harness/analyze.py` and is never
estimated by eye. The observed half is read from `hook.jpg` (0–2.75 s at 4 fps, 6 per row)
and `sheet.jpg` (one frame per shot, then the last frame) plus the transcript.

Rules for the observer:
- Read what is in the frames. If a field cannot be seen, write `null`; never guess.
- Sizes are estimates against the 9:16 frame and are labelled `_est`.
- Quote on-screen text exactly as it appears, including capitals and emoji.
- `hook_text` is a separate title/label overlay; speech-synced captions go under `captions`.
- `audio_read` is inferred from the transcript (frames carry no sound); mark `audio_read_confidence`.
- `cut_count` is a hard-cut lower bound: speaker changes in matched framing and punch-ins can be missed.

v1.1 (2026-10-19) added `single_take`, `over_shoulder_pov`, `advice_qa` and `audio_read_confidence` after the first 67-reel pass.

## Measured (analyze.py)

| Field | Meaning |
|---|---|
| `duration_s`, `width`, `height`, `fps` | ffprobe |
| `cut_count`, `cut_times`, `avg_shot_len_s`, `cuts_first_3s` | ffmpeg scene score > 0.30 (hard cuts; whip-pans and punch-ins can miss) |
| `integrated_lufs`, `lra_lu` | EBU R128 on the delivered AAC track |
| `first_word_at_s`, `words_per_sec`, `word_count`, `first_3s_text`, `full_text` | whisper.cpp base.en; music-only reels give few or no words |

## Observed (vision + transcript)

```json
{
  "code": "DeRswhbsC5c",
  "frame1": {
    "shot_scale": "extreme_closeup | closeup | medium | wide",
    "subject": "face | problem_object | action | product | text_card | scene",
    "face_visible": true,
    "motion_at_open": "already_moving | static"
  },
  "hook_text": {
    "present": true,
    "first_visible_s": 0.0,
    "text": "exact words",
    "word_count": 5,
    "position": "top | upper_mid | center | lower_mid | bottom",
    "font_class": "heavy_sans_caps | sans_bold_mixed | native_ig_classic | native_tiktok_sans | serif | handwritten | condensed_caps | other",
    "cap_height_pct_frame_est": 4,
    "fill": "white | yellow | black | brand | other",
    "treatment": "stroke | box | shadow | none",
    "highlight": "none | colour word | colour box"
  },
  "captions": {
    "style": "word_by_word | chunk_1_3 | sentence | native_auto | none",
    "position": "upper_mid | center | lower_mid | bottom",
    "all_caps": true,
    "keyword_highlight": "none | yellow | green | red | other",
    "emoji_in_captions": false
  },
  "format": "talking_head | voiceover_broll | selfie_pip_over_broll | green_screen | pov_hands | skit | demo_tutorial | before_after | montage | interview | text_over_footage | single_take | over_shoulder_pov",
  "camera": "handheld | tripod | gimbal | mixed | screen",
  "graphics": ["zoom_punch_in", "arrows_circles", "stickers_emoji", "progress_bar", "split_screen", "counter_label", "lower_third", "none"],
  "colour_look": "natural | warm | cool | high_contrast | desaturated | mixed",
  "spoken_hook_type": "question | bold_claim | contrarian | number_list | you_address | story_open | none",
  "archetype": "did_you_know | listicle | myth_bust | tutorial | transformation | challenge_stunt | story | reaction | news | comedy_skit | review_demo | day_in_life | advice_qa",
  "payoff_position": "front | middle | end | none",
  "ending": "abrupt | loop_back | cta_card | payoff_reveal | fade_or_outro",
  "cta": "none | follow | comment | link | save | share",
  "audio_read": "voice_only | voice_plus_music | music_only | trending_sound | sfx_heavy",
  "audio_read_confidence": "transcript_inferred | unknown",
  "notes": "one line, anything a producer would copy"
}
```
