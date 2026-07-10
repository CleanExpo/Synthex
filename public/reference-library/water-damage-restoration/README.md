# Water Damage Restoration — reference photos needed

This folder is intentionally empty. It's the slot for **real, first-party** water damage
restoration photos to ground AI image generation for this vertical.

## Why it's empty

The two water-damage images originally supplied were **screenshots of another person's
Instagram/Facebook reel** (creator "Nikoo Farez"). They were excluded because:

- Using someone else's content as brand reference/training data is a copyright risk.
- The screenshots include platform UI, likes/comments, and a creator watermark.
- They'd ground the model on **someone else's** job sites, not the business's own work.

## What to add here

Your own job-site photos, e.g.:

- Air movers and dehumidifiers positioned on a live drying job
- Moisture mapping / thermal readings in progress
- Extraction in action; affected vs. dried areas (before/after)
- Containment, drying chambers, equipment staged on site

Name them `water-damage-restoration-<subject>-NN.webp` and register them in
[`../manifest.json`](../manifest.json) under `industries.water-damage-restoration.subjects`.

IICRC references for this vertical: **S500** (water damage) and **S520** (mould remediation).
