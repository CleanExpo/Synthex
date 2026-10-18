# Synthex goals — check report

Generated: {{GENERATED_AT}}
origin/main: `{{MAIN_SHA}}`

States: PASS, FAIL, INCONCLUSIVE (the subject could not be read; never a pass),
DISABLED (deliberately not run, with a reason).

**Summary:** {{SUMMARY}}

## G1

> Run the Synthex fleet to DONE (= Ready for payments): advance P-1 → P0 → … → P10.

State: **{{G1_STATE}}**

{{G1_EVIDENCE}}

## G2

> Follow the spec as amended, DECISIONS.md and scripts/fleet/policy.json.

State: **{{G2_STATE}}**

{{G2_EVIDENCE}}

## G3

> Never self-certify, never override a FAIL or a halt.

State: **{{G3_STATE}}**

{{G3_EVIDENCE}}

## G4

> Founder-gated items go to DECISIONS.md as OPEN; continue with the rest.

State: **{{G4_STATE}}**

{{G4_EVIDENCE}}

## G5

<!-- prettier-ignore -->
> The PC does all Git merges and PR actions; this thread builds and hands off via fleet-unit/* branches plus one note.

State: **{{G5_STATE}}**

{{G5_EVIDENCE}}

## G6

> Security hotfixes from the JEV J1/J11 findings are built, independently reviewed and handed to the PC.

State: **{{G6_STATE}}**

{{G6_EVIDENCE}}

## G7

> Fix the Synthex run/build issues (/pr-fix).

State: **{{G7_STATE}}**

{{G7_EVIDENCE}}

## G8

> Spec finish line, measured not asserted.

State: **{{G8_STATE}}**

{{G8_EVIDENCE}}
