# AI Citation Readiness

Status: `HYPOTHESIS_FOR_TESTING` until measured
Created: 24/06/2026

## Purpose

Traditional SEO rank/click reporting is no longer enough for Synthex marketing intelligence. The latest imported research indicates that AI answers increasingly reward cited, structured, entity-consistent, multi-source authority.

This file defines a planning metric only. It must not be treated as verified performance data until measured against first-party or approved external data.

## Readiness dimensions

| Dimension            | Question                                                             | Evidence required                                        |
| -------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| Entity clarity       | Is the brand/person/product consistently named and described?        | Brand profile, page copy, schema, third-party references |
| Source attribution   | Are claims tied to inspectable sources?                              | Source register and claim ledger                         |
| Quotability          | Can one sentence be lifted into an AI answer without losing meaning? | Content review                                           |
| Completeness         | Does the asset answer the specific buyer/operator question fully?    | Content evaluator                                        |
| Third-party presence | Is the entity discussed outside its own site?                        | Approved PR/community/social/video/forum evidence        |
| Freshness            | Is the information current enough for the query class?               | GSC/crawl/update dates                                   |
| Trust proof          | Are proof, opinion, experience, and trust inputs present?            | POET-style capture                                       |

## Draft scoring

Each dimension: 0–2.

- 0 = absent or unknown
- 1 = partially present
- 2 = present with evidence

Readiness score = sum / 14.

## Gate

- Score may inform drafting only.
- Score must not trigger public publishing.
- Any score based on opinion-only sources remains `HYPOTHESIS_FOR_TESTING`.
- Any YMYL claim requires human approval and stronger evidence.

## Implementation note

Before building UI or automation for this score, Synthex should first implement:

1. source registry;
2. claim/source ledger;
3. content viewpoint/proof gate;
4. evaluator rubric;
5. measurement loop.
