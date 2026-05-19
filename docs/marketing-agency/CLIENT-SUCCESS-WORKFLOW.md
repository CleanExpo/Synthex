# Client Success Workflow

## Decision

Every campaign package must end with a client-success handoff. Creative output without approval context, revision policy, and evidence status is not complete.

## Workflow States

| State | Meaning | Next State |
| --- | --- | --- |
| intake | Source data and brand context being collected. | internal_review |
| internal_review | Board and specialists review draft outputs. | revision_requested or client_review |
| client_review | Client can review package and evidence status. | revision_requested or approved |
| revision_requested | Changes requested by internal or client reviewer. | internal_review |
| approved | Explicit approval recorded. | export_ready |
| export_ready | Export manifest and evidence pack complete. | published_externally |
| published_externally | Client or approved operator published outside this module. | performance_review |
| performance_review | Results and learnings reviewed. | intake |

## Handoff Contents

- campaign objective
- target persona
- strategic rationale
- creative variants
- recommended format usage
- evidence pass/fail summary
- consent summary
- licence summary
- unsupported or removed claims
- open risks
- client decisions needed
- revision history
- external publishing notes
- measurement plan

## Revision Policy

- Each revision must have requester, reason, timestamp, affected assets, and resolution.
- Evidence-related revisions require a new QA pass.
- Licence-related revisions require a new asset licence pass.
- Story/image/person-likeness revisions require a new consent pass.
- Approved campaigns cannot be edited in place; create a new revision.

## Approval Rules

Approval is explicit only. A campaign cannot be approved by silence, export download, or preview view.

Before `approved`:

- campaign brief exists
- client brand exists
- persona exists
- story and asset consent gates pass or unused
- asset licences pass
- claim evidence pass
- Meta creative QA pass
- client success handoff exists

## Client Success Metrics

- time from intake to first draft
- revision count
- blocked claim count
- blocked asset count
- evidence completeness score
- client approval time
- export package completion
- post-campaign performance notes when supplied

## Acceptance Criteria

- Every campaign has one current handoff.
- Every approval has a timestamp and actor.
- Every revision is traceable.
- No campaign moves to approved without evidence/licensing/consent pass.
