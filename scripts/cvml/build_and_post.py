#!/usr/bin/env python3
"""
SYN-725: Build the Block Kit payload for the weekly CVML scorecard and POST
it to the Slack webhook.

SYN-731 extension: render a Journey Moments section below Feature Engagement
with action rate + 4-week trend arrow + share rate + retention confidence
tier, plus a Manual Review Required subsection for any moment that trips the
modified sunset rule (action rate < 0.10 for 4 consecutive weeks AND
retention correlation <= 0 at Low Confidence or higher tier). No auto-
sunset during the first 90 days of operation — manual review only, link to
the Notion review template.

Reads:
  RAW                  JSON array — feature rows for the current week
  RAW_JOURNEY          JSON array — journey moment rows for 4 weeks (one
                       row per moment_id × week_start). Optional.
  WEEK_START           ISO date string (YYYY-MM-DD) of the scorecard week
  SLACK_WEBHOOK        Incoming webhook URL
  NOTION_REVIEW_URL    Optional. Notion review template URL surfaced in the
                       Manual Review subsection. Defaults to a placeholder
                       value the founder can swap to the real URL via env.

Exit codes:
  0  Posted successfully (or no rows to post)
  1  Slack POST failed

Kept separate from the GitHub Action YAML so Prettier can format the workflow
without mis-parsing the inline Python.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request


GREEN_THRESHOLD = 0.30
YELLOW_THRESHOLD = 0.15
KILL_CANDIDATE_STREAK = 4
LOW_ENGAGEMENT_THRESHOLD = 0.10

# SYN-731: modified sunset rule for journey moments. Both conditions must be
# true to flag a moment for Manual Review. Per Section 2 of the issue.
JOURNEY_KILL_ACTION_RATE_THRESHOLD = 0.10
JOURNEY_KILL_STREAK_WEEKS = 4

# Default Notion review template URL — overridden by env at workflow time.
DEFAULT_NOTION_REVIEW_URL = (
    'https://www.notion.so/synthex/Journey-Moment-Manual-Review'
)

# Confidence tier thresholds — match the SYN-679 retention correlation
# methodology. retention_n is the sample size; confidence labels rendered to
# Phill in the scorecard.
CONFIDENCE_INSUFFICIENT_BELOW = 30
CONFIDENCE_LOW_BELOW = 50  # 30 ≤ n < 50 → Low Confidence; n ≥ 50 → Confirmed


def fmt_rate(rate: object) -> str:
    if rate is None:
        return 'n/a'
    return f"{float(rate) * 100:.1f}%"


def dot(rate: object) -> str:
    if rate is None:
        return '⚪'
    r = float(rate)
    if r >= GREEN_THRESHOLD:
        return '🟢'
    if r >= YELLOW_THRESHOLD:
        return '🟡'
    return '🔴'


def feature_line(row: dict) -> str:
    return (
        f"{dot(row.get('engagement_rate'))} *{row['feature_id']}* — "
        f"{fmt_rate(row.get('engagement_rate'))} "
        f"(views {row.get('views', 0)}, acts {row.get('acts', 0)}, "
        f"converts {row.get('converts', 0)})"
    )


# ─────────────────────── SYN-731 journey moment helpers ─────────────────────

def confidence_tier_label(retention_n: object) -> str:
    """Render the confidence tier label from a retention sample size.

    Matches the SYN-679 methodology referenced in the SYN-731 done criteria.
    Returns the bare tier name; the caller wraps it in the line layout.
    """
    if retention_n is None:
        return 'Insufficient Data (n<30)'
    try:
        n = int(retention_n)
    except (TypeError, ValueError):
        return 'Insufficient Data (n<30)'
    if n < CONFIDENCE_INSUFFICIENT_BELOW:
        return f'Insufficient Data (n={n})'
    if n < CONFIDENCE_LOW_BELOW:
        return f'Low Confidence (n={n})'
    return f'Confirmed (n={n})'


def trend_arrow(action_rates: list[object]) -> str:
    """Render a 4-week trend arrow from a list of weekly action_rate values.

    Uses last vs. first comparison with a small dead-band so a flat trend
    renders as → instead of jittering between ↑/↓ on rounding noise. Any
    leading None values are skipped — the comparison uses the first and
    last non-None values present.
    """
    cleaned = [float(r) for r in action_rates if r is not None]
    if len(cleaned) < 2:
        return '→'
    delta = cleaned[-1] - cleaned[0]
    # Dead-band: ±0.5 percentage point delta is "flat enough" given the
    # small-n noise floor in the n=21 client cohort.
    if abs(delta) < 0.005:
        return '→'
    return '↑' if delta > 0 else '↓'


def is_journey_kill_candidate(row: dict) -> bool:
    """SYN-731 modified sunset rule — BOTH conditions must be true:

    1. action_rate < 0.10 for 4 consecutive weeks
       (worst_streak ≥ JOURNEY_KILL_STREAK_WEEKS)
    2. retention_correlation ≤ 0 at Low Confidence or higher tier
       (retention_n ≥ CONFIDENCE_INSUFFICIENT_BELOW)
    """
    streak = row.get('worst_streak') or 0
    if streak < JOURNEY_KILL_STREAK_WEEKS:
        return False
    correlation = row.get('retention_correlation')
    retention_n = row.get('retention_n')
    if correlation is None or retention_n is None:
        return False
    try:
        if float(correlation) > 0:
            return False
        if int(retention_n) < CONFIDENCE_INSUFFICIENT_BELOW:
            return False
    except (TypeError, ValueError):
        return False
    return True


def aggregate_journey_rows(rows: list[dict]) -> list[dict]:
    """Group raw weekly journey rows by moment_id.

    The SQL returns one row per (moment_id, week_start). The renderer
    needs one logical row per moment with the latest-week metrics on it
    plus a 4-week action_rate trend list. This function does that fold.

    Output row shape:
      moment_id, journey_stage, latest_week, action_rate, share_rate,
      action_rate_trend (sorted oldest→newest), worst_streak,
      retention_correlation, retention_n, confidence_tier
    """
    by_moment: dict[str, list[dict]] = {}
    for r in rows:
        mid = r.get('moment_id')
        if mid is None:
            continue
        by_moment.setdefault(mid, []).append(r)

    aggregated: list[dict] = []
    for mid, weekly in by_moment.items():
        weekly_sorted = sorted(weekly, key=lambda r: r.get('week_start', ''))
        latest = weekly_sorted[-1]
        aggregated.append({
            'moment_id': mid,
            'journey_stage': latest.get('journey_stage'),
            'latest_week': latest.get('week_start'),
            'action_rate': latest.get('action_rate'),
            'share_rate': latest.get('share_rate'),
            'action_rate_trend': [r.get('action_rate') for r in weekly_sorted],
            'worst_streak': latest.get('worst_streak'),
            'retention_correlation': latest.get('retention_correlation'),
            'retention_n': latest.get('retention_n'),
            'confidence_tier': latest.get('confidence_tier'),
        })
    return aggregated


def journey_moment_line(row: dict) -> str:
    """Render one aggregated journey moment row to a Slack mrkdwn line."""
    moment = row.get('moment_id', '?')
    stage = row.get('journey_stage') or '—'
    arrow = trend_arrow(row.get('action_rate_trend') or [])
    action = fmt_rate(row.get('action_rate'))
    share = fmt_rate(row.get('share_rate'))
    confidence = confidence_tier_label(row.get('retention_n'))
    badge = '  ⚠️ *Manual Review*' if is_journey_kill_candidate(row) else ''
    return (
        f"*{moment}* `{stage}` — "
        f"action {action} {arrow} · share {share} · {confidence}{badge}"
    )


def build_journey_blocks(rows: list[dict], notion_review_url: str) -> list[dict]:
    """Build the Journey Moments + Manual Review Required Slack sections."""
    if not rows:
        return []

    aggregated = aggregate_journey_rows(rows)
    if not aggregated:
        return []

    aggregated.sort(key=lambda r: r['moment_id'])
    kill_candidates = [r for r in aggregated if is_journey_kill_candidate(r)]

    blocks: list[dict] = [
        {"type": "divider"},
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    "*Journey Moments* — action rate (4-week trend) · share rate · retention confidence"
                ),
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "\n".join(journey_moment_line(r) for r in aggregated),
            },
        },
    ]

    # SYN-731 §2: no auto-sunset during first 90 days. Manual Review
    # Required subsection lists kill candidates with a direct link to the
    # Notion review template; humans make the keep / variant-test / sunset
    # call.
    blocks.extend([
        {"type": "divider"},
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    f"*Manual Review Required* — open <{notion_review_url}|Notion review template>"
                ),
            },
        },
    ])
    if kill_candidates:
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "\n".join(
                    f"• *{r['moment_id']}* `{r.get('journey_stage') or '—'}` — "
                    f"action {fmt_rate(r.get('action_rate'))} for "
                    f"{r.get('worst_streak')} weeks · retention "
                    f"{r.get('retention_correlation')} ({confidence_tier_label(r.get('retention_n'))})"
                    for r in kill_candidates
                ),
            },
        })
    else:
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "_No moments meet both sunset conditions this week._",
            },
        })
    return blocks


def build_blocks(
    rows: list[dict],
    week: str,
    journey_rows: list[dict] | None = None,
    notion_review_url: str = DEFAULT_NOTION_REVIEW_URL,
) -> list[dict]:
    header = {
        "type": "header",
        "text": {
            "type": "plain_text",
            "text": f"📊 CVML Scorecard — Week of {week}",
        },
    }

    journey_rows = journey_rows or []

    if not rows and not journey_rows:
        return [
            header,
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "_No CVML events recorded for this window._",
                },
            },
        ]

    blocks: list[dict] = [header]

    if rows:
        ranked = sorted(
            rows,
            key=lambda r: (r.get('engagement_rate') or -1),
            reverse=True,
        )
        top3 = ranked[:3]
        bottom3 = ranked[-3:] if len(ranked) > 3 else []
        kill = [r for r in rows if (r.get('worst_streak') or 0) >= KILL_CANDIDATE_STREAK]

        blocks.extend([
            {"type": "section", "text": {"type": "mrkdwn", "text": "*Top features*"}},
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": "\n".join(feature_line(r) for r in top3)},
            },
        ])

        if bottom3:
            blocks.extend([
                {"type": "section", "text": {"type": "mrkdwn", "text": "*Bottom features*"}},
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "\n".join(feature_line(r) for r in bottom3),
                    },
                },
            ])

        if kill:
            blocks.extend([
                {"type": "divider"},
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": (
                            f"⚠️ *Sunset-review candidates* — "
                            f"{KILL_CANDIDATE_STREAK}+ consecutive weeks below "
                            f"{int(LOW_ENGAGEMENT_THRESHOLD * 100)}% engagement:"
                        ),
                    },
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "\n".join(
                            f"• *{r['feature_id']}* — {r['worst_streak']} weeks"
                            for r in kill
                        ),
                    },
                },
            ])

    blocks.extend(build_journey_blocks(journey_rows, notion_review_url))

    return blocks


def post_to_slack(webhook: str, payload: dict) -> None:
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        webhook,
        data=data,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        if resp.status >= 300:
            raise RuntimeError(f"Slack webhook returned {resp.status}")


def main() -> int:
    raw = os.environ.get('RAW', '[]')
    raw_journey = os.environ.get('RAW_JOURNEY', '[]')
    week = os.environ.get('WEEK_START', '')
    webhook = os.environ.get('SLACK_WEBHOOK', '')
    notion_review_url = (
        os.environ.get('NOTION_REVIEW_URL') or DEFAULT_NOTION_REVIEW_URL
    )

    if not webhook:
        print("::warning::SLACK_WEBHOOK not set, skipping post", file=sys.stderr)
        return 0

    try:
        rows = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"::error::Failed to parse RAW payload: {exc}", file=sys.stderr)
        return 1

    try:
        journey_rows = json.loads(raw_journey) if raw_journey else []
    except json.JSONDecodeError as exc:
        # Journey data is best-effort — degrade to feature-only rendering
        # rather than failing the whole post.
        print(
            f"::warning::Failed to parse RAW_JOURNEY payload (rendering feature section only): {exc}",
            file=sys.stderr,
        )
        journey_rows = []

    payload = {
        "text": f"📊 CVML Scorecard — Week of {week}",
        "blocks": build_blocks(rows, week, journey_rows, notion_review_url),
    }

    try:
        post_to_slack(webhook, payload)
    except Exception as exc:  # noqa: BLE001
        print(f"::warning::Slack POST failed: {exc}", file=sys.stderr)
        return 1

    moments = len({r.get('moment_id') for r in journey_rows if r.get('moment_id')})
    print(
        f"Posted scorecard for week {week} "
        f"({len(rows)} features, {moments} journey moments)"
    )
    return 0


if __name__ == '__main__':
    sys.exit(main())
