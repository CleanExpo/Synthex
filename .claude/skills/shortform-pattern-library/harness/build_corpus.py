#!/usr/bin/env python3
"""Merge per-reel meta/metrics/observed into references/corpus-reels.jsonl and write the
aggregates to references/corpus.json.

Usage: python3 -I build_corpus.py <datadir> <out corpus.json> <private key.json>

Only structure is kept: full transcripts and captions are dropped (first 3 s of speech stays,
as the hook under study). No media leaves the data dir. This repo is public, so reels and accounts
are written as reel-NNN / acct-NN; the id-to-handle/URL key goes to <private key.json>, which must
sit outside the repo.
"""
import json, re, statistics as st, sys
from collections import Counter, defaultdict
from pathlib import Path

KEEP_META = ("code", "url", "handle", "stratum", "views", "views_text", "observed_at", "status")
KEEP_METRICS = ("duration_s", "width", "height", "fps", "cut_count", "avg_shot_len_s", "cuts_first_3s",
                "integrated_lufs", "lra_lu", "first_word_at_s", "words_per_sec", "word_count", "first_3s_text")
NUMERIC = ("views", "duration_s", "cut_count", "avg_shot_len_s", "cuts_first_3s", "integrated_lufs",
           "first_word_at_s", "words_per_sec")


def load(p):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def q(vals):
    v = sorted(x for x in vals if x is not None)
    if not v:
        return None
    pick = lambda f: v[min(len(v) - 1, int(f * (len(v) - 1) + 0.5))]
    return {"n": len(v), "p25": pick(0.25), "median": st.median(v), "p75": pick(0.75), "min": v[0], "max": v[-1]}


def main(datadir, out, keyfile):
    reels = []
    for d in sorted((Path(datadir) / "reels").iterdir()):
        meta, met, obs = load(d / "meta.json"), load(d / "metrics.json"), load(d / "observed.json")
        if not meta:
            continue
        r = {k: meta.get(k) for k in KEEP_META}
        # A profile's reel grid also shows collab posts, so the grid handle is not always the poster.
        title = meta.get("og_title") or ""
        r["poster"] = title.split(" on Instagram")[0].strip() if " on Instagram" in title else None
        r["code"] = d.name
        r.update({k: met.get(k) for k in KEEP_METRICS})
        r["observed"] = {k: v for k, v in obs.items() if k != "code"} or None
        reels.append(r)

    # control_low = same accounts' reels under 500K views; kept apart so they never dilute the 1M+ stats.
    ctl = [r for r in reels if r["status"] == "OK" and r["stratum"] == "control_low"]
    ok = [r for r in reels if r["status"] == "OK" and r["stratum"] != "control_low"]
    # whisper hallucinates looping "speech" over music-only tracks, so speech stats use voiced reels only.
    SPEECH = ("first_word_at_s", "words_per_sec")
    voiced = lambda r: (r["observed"] or {}).get("audio_read") not in ("music_only", "trending_sound") \
        and (r.get("word_count") or 0) >= 5
    agg = {"all": {k: q([r.get(k) for r in (filter(voiced, ok) if k in SPEECH else ok)]) for k in NUMERIC}}
    agg["voiced_n"] = sum(1 for r in ok if voiced(r))
    NICHE = ("cleaning_restoration", "trades", "trades_au")
    niche = [r for r in ok if r["stratum"] in NICHE]
    agg["niche_trades_cleaning"] = {"n": len(niche), **{k: q([r.get(k) for r in (filter(voiced, niche) if k in SPEECH else niche)]) for k in NUMERIC}}
    by = defaultdict(list)
    for r in ok:
        by[r["stratum"]].append(r)
    agg["by_stratum"] = {s: {"n": len(rs), **{k: q([r.get(k) for r in (filter(voiced, rs) if k in SPEECH else rs)]) for k in NUMERIC}} for s, rs in by.items()}

    def count(path, rows=None):
        c = Counter()
        for r in (rows if rows is not None else ok):
            o = r["observed"] or {}
            for p in path.split("."):
                o = o.get(p) if isinstance(o, dict) else None
            for v in (o if isinstance(o, list) else [o]):
                c[str(v)] += 1
        return dict(c.most_common())

    fields = ["frame1.shot_scale", "frame1.subject", "frame1.face_visible", "frame1.motion_at_open",
              "hook_text.present", "hook_text.position", "hook_text.font_class", "hook_text.treatment",
              "hook_text.fill", "captions.style", "captions.position", "captions.all_caps",
              "captions.keyword_highlight", "format", "camera", "graphics", "colour_look",
              "spoken_hook_type", "archetype", "payoff_position", "ending", "cta", "audio_read"]
    agg["observed_counts"] = {f: count(f) for f in fields}
    agg["observed_counts_niche"] = {f: count(f, niche) for f in fields}

    if ctl:
        agg["control_low"] = {"n": len(ctl), **{k: q([r.get(k) for r in (filter(voiced, ctl) if k in SPEECH else ctl)]) for k in NUMERIC}}

        def share(rows, path, val):
            seen = [r for r in rows if r["observed"]]
            hit = 0
            for r in seen:
                o = r["observed"]
                for p in path.split("."):
                    o = o.get(p) if isinstance(o, dict) else None
                hit += (val in o) if isinstance(o, list) else (o == val)
            return {"share": round(hit / len(seen), 2) if seen else None, "n": len(seen)}

        probes = [("frame1.motion_at_open", "already_moving"), ("frame1.face_visible", True),
                  ("hook_text.present", True), ("captions.style", "none"), ("graphics", "counter_label"),
                  ("payoff_position", "end"), ("ending", "loop_back"), ("cta", "none"),
                  ("spoken_hook_type", "none"), ("archetype", "transformation"), ("archetype", "comedy_skit")]
        matched = {r["handle"] for r in ctl}
        hits_same_accounts = [r for r in ok if r["handle"] in matched]
        agg["contrast_1m_vs_control"] = {f"{p}={v}": {"viral": share(hits_same_accounts, p, v), "control": share(ctl, p, v)}
                                          for p, v in probes}
    agg["observed_n"] = sum(1 for r in ok if r["observed"])
    hw = [r["observed"]["hook_text"].get("word_count") for r in ok
          if r["observed"] and (r["observed"].get("hook_text") or {}).get("present")]
    agg["hook_text_words"] = q(hw)
    hs = [r["observed"]["hook_text"].get("first_visible_s") for r in ok
          if r["observed"] and (r["observed"].get("hook_text") or {}).get("present")]
    agg["hook_text_first_visible_s"] = q(hs)
    ch = [r["observed"]["hook_text"].get("cap_height_pct_frame_est") for r in ok
          if r["observed"] and (r["observed"].get("hook_text") or {}).get("present")]
    agg["hook_text_cap_height_pct"] = q(ch)

    # Per-reel rows go to a sibling JSON Lines file (one reel per line); this file keeps the aggregates.
    # Identities are replaced by pseudonyms; the key never enters the repo.
    acct, key, public = {}, [], []
    for i, r in enumerate(reels, 1):
        a = acct.setdefault(r["handle"], f"acct-{len(acct) + 1:02d}")
        key.append({"reel_id": f"reel-{i:03d}", "account_id": a, **{k: r[k] for k in ("code", "url", "handle", "poster")}})
        public.append({"reel_id": f"reel-{i:03d}", "account_id": a,
                       **{k: v for k, v in r.items() if k not in ("code", "url", "handle", "poster")}})
    # Free text (observer notes, transcripts) can name the source too: swap every known code, handle
    # and poster for its pseudonym, and blank any other @mention.
    swaps = sorted({(k[f], k["reel_id"] if f == "code" else k["account_id"])
                    for k in key for f in ("code", "handle", "poster") if k.get(f)},
                   key=lambda s: -len(s[0]))
    # Identities match only as whole tokens, so they cannot rewrite ordinary words or enum values
    # (a poster "Clean" must not touch "cleaning_restoration").
    pattern = re.compile("|".join(rf"(?<![A-Za-z0-9]){re.escape(s)}(?![A-Za-z0-9])" for s, _ in swaps),
                         re.I) if swaps else None
    lookup = {s.lower(): p for s, p in swaps}

    def scrub(v):
        if isinstance(v, dict):
            return {k: scrub(x) for k, x in v.items()}
        if isinstance(v, list):
            return [scrub(x) for x in v]
        if isinstance(v, str):
            v = re.sub(r"@[A-Za-z0-9._]+", "@[handle]", v)
            return pattern.sub(lambda m: lookup[m.group(0).lower()], v) if pattern else v
        return v

    public = [scrub(r) for r in public]
    Path(keyfile).write_text(json.dumps(key, indent=1, ensure_ascii=False), encoding="utf-8")
    rows = Path(out).with_name("corpus-reels.jsonl")
    rows.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in public), encoding="utf-8")
    doc = {"schema": "synthex.shortform.corpus/2", "built_from": "logged-out harvester (kept outside this repo) + analyze.py + vision breakdown",
           "sample_note": "Stratified, not random: latest-12 reels per public profile, logged out, kept if views >= 1M, capped per account; control_low = same accounts' reels under 500K. Views as shown on the profile grid on observed_at.",
           "reels_file": rows.name, "count": len(reels), "ok": len(ok), "control_low": len(ctl), "aggregates": agg}
    Path(out).write_text(json.dumps(doc, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"count": len(reels), "ok": len(ok), "control_low": len(ctl), "observed": agg["observed_n"],
                      "strata": {s: v["n"] for s, v in agg["by_stratum"].items()}}))


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[4]
    if Path(sys.argv[3]).resolve().is_relative_to(root):
        sys.exit("private key must be written outside the repo")
    main(sys.argv[1], sys.argv[2], sys.argv[3])
