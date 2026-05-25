# Capability Matrix Heatmap

Derived from [capability-matrix.csv](./capability-matrix.csv) (32 tasks).

## By C3 status

| Status             | Count |   % |
| ------------------ | ----: | --: |
| IDE_ONLY           |    14 | 44% |
| UI_PARTIAL         |    15 | 47% |
| MISSING            |     3 |  9% |
| COMPLETE (product) |     0 |  0% |

## By service line (dominant C3)

| Service line                     | Tasks | IDE_ONLY | UI_PARTIAL | MISSING |
| -------------------------------- | ----: | -------: | ---------: | ------: |
| Orchestration                    |     1 |        1 |          0 |       0 |
| Copy / gate / queue              |     3 |        3 |          0 |       0 |
| Reporting                        |     4 |        1 |          3 |       0 |
| Brand / creative                 |     3 |        0 |          3 |       0 |
| CRO / email / paid / ops         |     4 |        4 |          0 |       0 |
| Insights / research / PR / local |     4 |        2 |          2 |       0 |
| Foundation / boundary            |     2 |        2 |          0 |       0 |
| Platform / advisor / product     |     8 |        1 |          5 |       2 |

## C1 / C2 (policy + IDE)

| Column    | COMPLETE | Partial / missing                           |
| --------- | -------- | ------------------------------------------- |
| C1 Policy | 31       | 1 (AT-027 Autonomous — no policy doc)       |
| C2 IDE    | 30       | 2 (AT-008, AT-022 — senior-cmo not shipped) |

## Interpretation

- **C1+C2 strong:** Senior skills and foundation are production-grade in Claude Code (SYN-806).
- **C3 weak:** No task reaches **COMPLETE** in product; the gap is **wiring**, not documentation.
- **Highest leverage:** AT-001–005, AT-026–029 (orchestration, gates, reporting, advisor, tasks taxonomy).
