# Current Specs

Product specifications for features currently in development.

## Active specs

| Spec                     | Branch                          | Status                    |
| ------------------------ | ------------------------------- | ------------------------- |
| Gruen self-approval gate | `feat/gruen-self-approval`      | In progress               |
| Media Run workflow       | `docs(design)` commit a775202ed | Designed — awaiting build |
| Real Images Only routing | `feat/gruen-self-approval`      | Shipped                   |

## How to use this folder

Add a spec file here when a new feature is approved. Claude reads specs before planning
or building a feature, so the more detail here, the fewer wrong assumptions.

### Spec file naming convention

```
spec/syn-NNN-feature-name.md
spec/media-run-2026-08.md
```

## Existing detailed specs

Full specs live in `.claude/specs/` and `docs/`. This folder holds the CURRENT ones only — the work Claude is being asked to build RIGHT NOW.
