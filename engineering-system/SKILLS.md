# Skills registry and loading policy

**As of:** 27/10/2026 | **Status:** registry, not copied skills.

| Need                      | Canonical existing skill or implementation                                    | Load when                         |
| ------------------------- | ----------------------------------------------------------------------------- | --------------------------------- |
| JEV / anti-fake green TDD | `.claude/skills/tdd-jev/SKILL.md`; `tests/eval/jev`                           | Any code/task evaluation          |
| Engineering orchestration | `.claude/skills/build-orchestrator/SKILL.md`; Pi Dev Ops `config/harness/`    | Multi-worker task                 |
| New project inspection    | `.claude/skills/project-scanner/SKILL.md`                                     | Before creating duplicate modules |
| Dependency restraint      | `.claude/skills/dependency-discipline/SKILL.md`                               | Packages/provider addition        |
| UI / accessibility        | `.claude/skills/design/SKILL.md`; project tests                               | Client dashboard/card changes     |
| API test surfaces         | `.claude/skills/api-testing/SKILL.md`                                         | Routes/integrations               |
| Security/evidence         | `.claude/rules/fabel-evidence-standard.md`, `docs/governance/CONSTITUTION.md` | Every PR and external action      |

## New lightweight role skills (spec only)

- `architecture-challenger`: inspect changed modules and list redundant abstractions, coupling and safe alternatives.
- `business-outcome-reviewer`: relate change to lead quality, margin, capacity, customer benefit, cost and measurement uncertainty.
- `freshness-curator`: compare dated official sources with active docs; propose exact edits with links, not date-stamp entire tree.
- `context-budgeter`: enforce bounded task manifest, unique canonical references and small handoffs.

**Implementation rule:** keep a role description in this registry until an actual recurring task justifies a new `SKILL.md`. No speculative agent directories. Existing Pi Dev Ops senior-harness council logic takes precedence; verify its tested API before changing it.
