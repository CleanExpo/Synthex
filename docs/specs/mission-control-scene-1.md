# Mission Control — Scene 1 + Coming soon (IA)

## Pipeline

`Goal → GitHub analyse → Linear project gate → Draft tickets → Human approval → Linear create → Coming soon (code/tests/PR)`

## Routes

| Method   | Path                                   | Purpose                                     |
| -------- | -------------------------------------- | ------------------------------------------- |
| GET/POST | `/api/mission-control/missions`        | List / create mission                       |
| GET      | `/api/mission-control/repos`           | List GitHub repos                           |
| POST     | `/api/mission-control/analyze-repo`    | Analyse selected repo                       |
| GET/POST | `/api/mission-control/projects`        | List / create Linear projects               |
| POST     | `/api/mission-control/select-project`  | Bind project (required before draft)        |
| POST     | `/api/mission-control/draft-tickets`   | Draft only (blocked without project)        |
| POST     | `/api/mission-control/approve-tickets` | Create Linear issues (`approve: true` only) |

## UI

`/dashboard` → `MissionControlHome` (classic Command Centre behind toggle).

## Env

- `LINEAR_API_KEY` (required for projects/tickets)
- `GITHUB_TOKEN` or `GH_TOKEN` or `DR_REPO_GITHUB_TOKEN` (repo list/analyse)
- Optional: `HERMES_LINEAR_TEAM_ID`

## Persistence

`Organization.settings.missionControl.missions[]` (no Prisma migration for Scene 1).

## Out of scope (Coming soon UI only)

Code agents, tests automation, PR/CI, merge/deploy, role views.
