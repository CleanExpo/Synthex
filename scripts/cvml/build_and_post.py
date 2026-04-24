#!/usr/bin/env python3
"""
SYN-725: Build the Block Kit payload for the weekly CVML scorecard and POST
it to the Slack webhook.

Reads:
  RAW          JSON array returned by the Supabase exec_sql RPC
  WEEK_START   ISO date string (YYYY-MM-DD) of the scorecard week
  SLACK_WEBHOOK  Incoming webhook URL

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


def build_blocks(rows: list[dict], week: str) -> list[dict]:
    header = {
        "type": "header",
        "text": {
            "type": "plain_text",
            "text": f"📊 CVML Scorecard — Week of {week}",
        },
    }

    if not rows:
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

    ranked = sorted(
        rows,
        key=lambda r: (r.get('engagement_rate') or -1),
        reverse=True,
    )
    top3 = ranked[:3]
    bottom3 = ranked[-3:] if len(ranked) > 3 else []
    kill = [r for r in rows if (r.get('worst_streak') or 0) >= KILL_CANDIDATE_STREAK]

    blocks = [
        header,
        {"type": "section", "text": {"type": "mrkdwn", "text": "*Top features*"}},
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": "\n".join(feature_line(r) for r in top3)},
        },
    ]

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
    week = os.environ.get('WEEK_START', '')
    webhook = os.environ.get('SLACK_WEBHOOK', '')

    if not webhook:
        print("::warning::SLACK_WEBHOOK not set, skipping post", file=sys.stderr)
        return 0

    try:
        rows = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"::error::Failed to parse RAW payload: {exc}", file=sys.stderr)
        return 1

    payload = {
        "text": f"📊 CVML Scorecard — Week of {week}",
        "blocks": build_blocks(rows, week),
    }

    try:
        post_to_slack(webhook, payload)
    except Exception as exc:  # noqa: BLE001
        print(f"::warning::Slack POST failed: {exc}", file=sys.stderr)
        return 1

    print(f"Posted scorecard for week {week} ({len(rows)} features)")
    return 0


if __name__ == '__main__':
    sys.exit(main())
