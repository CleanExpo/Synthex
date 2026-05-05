#!/usr/bin/env python3
"""SYN-731 unit tests for the journey-moment rendering helpers in
``scripts/cvml/build_and_post.py``.

Synthex's main test runner is Jest (TypeScript). The CVML scorecard
renderer is the sole Python in the hot path, so it gets a small unittest
suite that runs in isolation:

    python3 -m unittest scripts.cvml.test_build_and_post

The tests cover:
- confidence_tier_label thresholds (None / <30 / 30-49 / >=50)
- trend_arrow over 4 weekly action_rate values (rising / falling / flat
  with dead-band, sparse data with leading None)
- is_journey_kill_candidate (BOTH conditions per SYN-731 §2)
- aggregate_journey_rows fold (1 row per moment_id, latest-week metrics,
  4-week trend list ordered oldest→newest)
- build_journey_blocks shape (header + body when rows present, divider
  + Manual Review section, empty state when no kill candidates)
- build_blocks integration: feature-only / feature+journey / journey-only
  / empty
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

# Allow running the test directly: `python3 scripts/cvml/test_build_and_post.py`
sys.path.insert(0, str(Path(__file__).parent))

from build_and_post import (  # noqa: E402
    DEFAULT_NOTION_REVIEW_URL,
    aggregate_journey_rows,
    build_blocks,
    build_journey_blocks,
    confidence_tier_label,
    is_journey_kill_candidate,
    journey_moment_line,
    trend_arrow,
)


# ─────────────────────────── helpers ─────────────────────────────────────────

def _journey_row(
    moment_id: str,
    week_start: str,
    *,
    stage: str = 'first_win',
    views: int = 100,
    acts: int = 30,
    shares: int = 5,
    action_rate: float | None = 0.30,
    share_rate: float | None = 0.05,
    worst_streak: int = 0,
    retention_correlation: float | None = None,
    retention_n: int | None = None,
    confidence_tier: str | None = None,
) -> dict:
    return {
        'moment_id': moment_id,
        'journey_stage': stage,
        'week_start': week_start,
        'views': views,
        'acts': acts,
        'shares': shares,
        'action_rate': action_rate,
        'share_rate': share_rate,
        'worst_streak': worst_streak,
        'retention_correlation': retention_correlation,
        'retention_n': retention_n,
        'confidence_tier': confidence_tier,
    }


# ─────────────────────────── tests ───────────────────────────────────────────

class ConfidenceTierLabelTests(unittest.TestCase):
    def test_none(self):
        self.assertEqual(confidence_tier_label(None), 'Insufficient Data (n<30)')

    def test_below_30(self):
        self.assertEqual(confidence_tier_label(21), 'Insufficient Data (n=21)')

    def test_low_band(self):
        self.assertEqual(confidence_tier_label(35), 'Low Confidence (n=35)')

    def test_confirmed(self):
        self.assertEqual(confidence_tier_label(75), 'Confirmed (n=75)')

    def test_string_input_falls_back_to_insufficient(self):
        self.assertEqual(confidence_tier_label('not-a-number'), 'Insufficient Data (n<30)')


class TrendArrowTests(unittest.TestCase):
    def test_rising(self):
        self.assertEqual(trend_arrow([0.10, 0.15, 0.20, 0.25]), '↑')

    def test_falling(self):
        self.assertEqual(trend_arrow([0.30, 0.25, 0.18, 0.12]), '↓')

    def test_flat_within_deadband(self):
        # 0.20 → 0.202 = +0.2pp delta, well inside the ±0.5pp dead-band
        self.assertEqual(trend_arrow([0.20, 0.21, 0.22, 0.202]), '→')

    def test_just_outside_deadband(self):
        # 0.20 → 0.21 = +1pp delta, outside dead-band → ↑
        self.assertEqual(trend_arrow([0.20, 0.20, 0.20, 0.21]), '↑')

    def test_single_value(self):
        self.assertEqual(trend_arrow([0.30]), '→')

    def test_all_none(self):
        self.assertEqual(trend_arrow([None, None, None]), '→')

    def test_leading_none_ignored(self):
        # First non-None is 0.10, last is 0.20 → ↑
        self.assertEqual(trend_arrow([None, 0.10, 0.15, 0.20]), '↑')


class IsJourneyKillCandidateTests(unittest.TestCase):
    def test_streak_too_short(self):
        row = _journey_row('m1', '2026-04-28',
                           worst_streak=2,
                           retention_correlation=-0.2,
                           retention_n=40)
        self.assertFalse(is_journey_kill_candidate(row))

    def test_streak_met_but_retention_null(self):
        # Per SYN-731: needs Low Confidence or higher AND correlation ≤ 0.
        # Null retention data means insufficient — no auto-flag.
        row = _journey_row('m1', '2026-04-28',
                           worst_streak=4,
                           retention_correlation=None,
                           retention_n=None)
        self.assertFalse(is_journey_kill_candidate(row))

    def test_streak_met_but_correlation_positive(self):
        row = _journey_row('m1', '2026-04-28',
                           worst_streak=4,
                           retention_correlation=0.15,
                           retention_n=40)
        self.assertFalse(is_journey_kill_candidate(row))

    def test_streak_met_but_below_low_confidence(self):
        # n=20 → Insufficient. Doesn't qualify even if correlation ≤ 0.
        row = _journey_row('m1', '2026-04-28',
                           worst_streak=5,
                           retention_correlation=-0.2,
                           retention_n=20)
        self.assertFalse(is_journey_kill_candidate(row))

    def test_both_conditions_met_low_confidence(self):
        row = _journey_row('m1', '2026-04-28',
                           worst_streak=4,
                           retention_correlation=-0.1,
                           retention_n=35)
        self.assertTrue(is_journey_kill_candidate(row))

    def test_both_conditions_met_confirmed(self):
        row = _journey_row('m1', '2026-04-28',
                           worst_streak=6,
                           retention_correlation=-0.4,
                           retention_n=80)
        self.assertTrue(is_journey_kill_candidate(row))

    def test_zero_correlation_at_low_confidence_qualifies(self):
        # SYN-731 §2: "≤ 0" — exactly zero counts as ≤.
        row = _journey_row('m1', '2026-04-28',
                           worst_streak=4,
                           retention_correlation=0.0,
                           retention_n=30)
        self.assertTrue(is_journey_kill_candidate(row))


class AggregateJourneyRowsTests(unittest.TestCase):
    def test_single_moment_4_weeks(self):
        rows = [
            _journey_row('first_win', '2026-04-07', action_rate=0.10),
            _journey_row('first_win', '2026-04-14', action_rate=0.15),
            _journey_row('first_win', '2026-04-21', action_rate=0.20),
            _journey_row('first_win', '2026-04-28',
                         action_rate=0.25, worst_streak=0,
                         retention_n=35, retention_correlation=0.1),
        ]
        out = aggregate_journey_rows(rows)
        self.assertEqual(len(out), 1)
        agg = out[0]
        self.assertEqual(agg['moment_id'], 'first_win')
        self.assertEqual(agg['latest_week'], '2026-04-28')
        self.assertEqual(agg['action_rate'], 0.25)
        self.assertEqual(agg['action_rate_trend'], [0.10, 0.15, 0.20, 0.25])
        self.assertEqual(agg['retention_n'], 35)

    def test_multiple_moments(self):
        rows = [
            _journey_row('first_win', '2026-04-28', action_rate=0.30),
            _journey_row('plan_review', '2026-04-28', action_rate=0.10),
        ]
        out = aggregate_journey_rows(rows)
        self.assertEqual({r['moment_id'] for r in out}, {'first_win', 'plan_review'})

    def test_unsorted_input_sorted_oldest_to_newest(self):
        rows = [
            _journey_row('m1', '2026-04-28', action_rate=0.40),
            _journey_row('m1', '2026-04-07', action_rate=0.10),
            _journey_row('m1', '2026-04-14', action_rate=0.20),
        ]
        out = aggregate_journey_rows(rows)
        self.assertEqual(out[0]['action_rate_trend'], [0.10, 0.20, 0.40])
        self.assertEqual(out[0]['latest_week'], '2026-04-28')

    def test_drops_rows_with_no_moment_id(self):
        rows = [
            {'moment_id': None, 'week_start': '2026-04-28'},
            _journey_row('m1', '2026-04-28'),
        ]
        out = aggregate_journey_rows(rows)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]['moment_id'], 'm1')


class JourneyMomentLineTests(unittest.TestCase):
    def test_renders_stage_action_share_confidence(self):
        agg = {
            'moment_id': 'first_win',
            'journey_stage': 'activation',
            'action_rate': 0.25,
            'share_rate': 0.05,
            'action_rate_trend': [0.20, 0.22, 0.24, 0.25],
            'worst_streak': 0,
            'retention_correlation': None,
            'retention_n': None,
        }
        line = journey_moment_line(agg)
        self.assertIn('first_win', line)
        self.assertIn('activation', line)
        self.assertIn('25.0%', line)  # action
        self.assertIn('5.0%', line)   # share
        self.assertIn('Insufficient Data', line)

    def test_appends_manual_review_badge_for_kill_candidate(self):
        agg = {
            'moment_id': 'plan_review',
            'journey_stage': 'reactivation',
            'action_rate': 0.05,
            'share_rate': 0.01,
            'action_rate_trend': [0.05, 0.05, 0.05, 0.05],
            'worst_streak': 4,
            'retention_correlation': -0.2,
            'retention_n': 35,
        }
        line = journey_moment_line(agg)
        self.assertIn('Manual Review', line)


class BuildJourneyBlocksTests(unittest.TestCase):
    NOTION_URL = 'https://example.com/notion-template'

    def test_empty_rows_returns_empty(self):
        self.assertEqual(build_journey_blocks([], self.NOTION_URL), [])

    def test_renders_section_with_one_moment(self):
        rows = [_journey_row('first_win', '2026-04-28', retention_n=21)]
        blocks = build_journey_blocks(rows, self.NOTION_URL)
        self.assertGreater(len(blocks), 0)
        # First block should be a divider, then the journey header section.
        self.assertEqual(blocks[0]['type'], 'divider')
        header_text = blocks[1]['text']['text']
        self.assertIn('Journey Moments', header_text)
        body_text = blocks[2]['text']['text']
        self.assertIn('first_win', body_text)
        # Notion link surfaces in the Manual Review section.
        joined = '\n'.join(b.get('text', {}).get('text', '') for b in blocks)
        self.assertIn(self.NOTION_URL, joined)

    def test_no_kill_candidates_renders_empty_state(self):
        rows = [_journey_row('first_win', '2026-04-28', retention_n=21)]
        blocks = build_journey_blocks(rows, self.NOTION_URL)
        last_text = blocks[-1]['text']['text']
        self.assertIn('No moments meet both sunset conditions', last_text)

    def test_kill_candidate_listed_in_manual_review(self):
        rows = [_journey_row(
            'plan_review',
            '2026-04-28',
            worst_streak=4,
            retention_correlation=-0.2,
            retention_n=35,
            action_rate=0.05,
        )]
        blocks = build_journey_blocks(rows, self.NOTION_URL)
        last_text = blocks[-1]['text']['text']
        self.assertIn('plan_review', last_text)
        self.assertIn('4 weeks', last_text)


class BuildBlocksIntegrationTests(unittest.TestCase):
    def test_features_only(self):
        rows = [
            {'feature_id': 'weekly_digest', 'engagement_rate': 0.40,
             'views': 100, 'acts': 30, 'converts': 5, 'worst_streak': 0},
        ]
        blocks = build_blocks(rows, '2026-04-28')
        joined = '\n'.join(b.get('text', {}).get('text', '') for b in blocks)
        self.assertIn('Top features', joined)
        self.assertNotIn('Journey Moments', joined)

    def test_features_plus_journey(self):
        rows = [
            {'feature_id': 'weekly_digest', 'engagement_rate': 0.40,
             'views': 100, 'acts': 30, 'converts': 5, 'worst_streak': 0},
        ]
        journey = [_journey_row('first_win', '2026-04-28', retention_n=21)]
        blocks = build_blocks(rows, '2026-04-28', journey)
        joined = '\n'.join(b.get('text', {}).get('text', '') for b in blocks)
        self.assertIn('Top features', joined)
        self.assertIn('Journey Moments', joined)
        self.assertIn('Manual Review', joined)

    def test_journey_only_no_features(self):
        journey = [_journey_row('first_win', '2026-04-28')]
        blocks = build_blocks([], '2026-04-28', journey)
        joined = '\n'.join(b.get('text', {}).get('text', '') for b in blocks)
        self.assertIn('Journey Moments', joined)
        # When rows is empty, the no-data message should NOT show because
        # journey rows are present.
        self.assertNotIn('No CVML events recorded', joined)

    def test_empty_both_renders_no_data(self):
        blocks = build_blocks([], '2026-04-28', [])
        joined = '\n'.join(b.get('text', {}).get('text', '') for b in blocks)
        self.assertIn('No CVML events recorded', joined)

    def test_default_notion_url_used_when_not_passed(self):
        journey = [_journey_row('first_win', '2026-04-28')]
        blocks = build_blocks([], '2026-04-28', journey)
        joined = '\n'.join(b.get('text', {}).get('text', '') for b in blocks)
        self.assertIn(DEFAULT_NOTION_REVIEW_URL, joined)


if __name__ == '__main__':
    unittest.main()
