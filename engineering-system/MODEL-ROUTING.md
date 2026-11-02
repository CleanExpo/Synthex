# Model capabilities and verification register

**Last researched:** 27/10/2026. **Model availability:** independent of this document; check approved actual CLI login/entitlement and record reported model each run.

## Verified provider announcements by 27 October

- Anthropic: Claude Fable 5.1 (September), Opus 5.5 (22 September), Sonnet 5.5 (28 September), Haiku 5.5 (7 October). Reference: https://www.anthropic.com/news/models
- OpenAI: GPT-6 Astra (3 September), Sol/Luna (22 September), GPT-6.1 Sol (29 September), **GPT-6.1 Terra (26 October)** optimised for faster computer-use/visual tasks, rather than highest-complexity coding; newer releases do not imply installed Codex subscription or API access. References: https://openai.com/research/index/release/ , https://openai.com/index/introducing-gpt-6-1-terra/ and https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex
- Cursor: Projects released 10 September, Agent SDK 20 October, changes to cloud-agent safety and skills Oct 19. Reference: https://cursor.com/changelog and https://cursor.com/docs/release-notes/cloud-agents
- The repo's `.cursor/rules/agent-stack.mdc` previously listed Composer 2.5 defaults. That guidance was changed on **27/10/2026** to require runtime-verified model discovery. The independent Cursor lane remains blocked by a separate protected-file gate until validated and approved.

## Proposed role routing (capability not hardcoded product)

| Task                                                    | Routing rule                                                                                                                |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Deterministic scans/tests                               | Scripts, no LLM                                                                                                             |
| Small scoped code/document change                       | Approved low-/mid-tier model, verify result                                                                                 |
| Architecture, complex refactor, consequential migration | Strongest available approved Claude builder after SPM context reduction                                                     |
| Reviewer                                                | Codex under current fleet policy; Cursor requested by founder but NOT released until policy controls pass. No self-approval |
| High-risk irreconcilable findings                       | Human Rana/Unite Group decision; additional model only with explicit reason                                                 |
| Source/research freshness                               | Web/source verifier + explicit dates, not model memory                                                                      |

## Pricing and capability discipline

Do not route to API just because provider publishes attractive per-token pricing. Previous founder policy is subscription-only unless separately approved. Retrieve effective capacity/usage from actual allowed provider, compare quality on **our** JEV/DeepSWE-style tasks. Provider benchmark scores are directional, not proof of superiority on Synthex. Model IDs, context windows, prices and service tiers expire; date any quote and rerun availability checks at task execution.

## Provenance

This file records source-backed capability categories and routing principles. It does not record that any particular model is logged in, callable, or cheaper under this customer's entitlements.
