# Unite-Group Autonomous Command Center Authority

Date: 2026-05-19
Status: Accepted product mandate
Linear: live creation blocked locally because `LINEAR_API_KEY` is not available; replay packet is in `.planning/linear-packets/unite-autonomous-command-center-2026-05-19.json`.

## Technical Translation Blueprint

**User Intent:** Phill grants operating authority for Unite-Group CRM to become a full autonomous agent command center with Phill as human-in-the-loop, Board members able to input through Telegram/WhatsApp/Plaud/meetings, and the system able to route those inputs into plans, generation, presentations, local execution, and review gates.

**Target Architecture:** Extend the existing Synthex/Unite surfaces rather than creating a separate app. The relevant app surface is `app/unite-group`, `components/command-centre`, `app/api/command-centre/*`, `lib/ai/boardroom.ts`, `lib/alerts/notification-channels.ts`, Hermes/Margot services, Vision Board, and future service modules under `lib/unite-command-center/*`.

**Token Optimisation Strategy:** Add one service-layer control plane before UI expansion. First implement durable intake, authority, routing, gate, presentation, and handoff models; then wire channel adapters and UI around those models.

**Autonomous Tool Selection:** Service Layer Pattern + Nexus Ontology + Board/HITL Gate + Channel Adapter Boundary + Margot Handoff Queue + Presentation QA Gate.

## Authority Boundary

Phill authorises non-destructive implementation work to be pushed into the correct project surfaces or Linear when the scope is clear and reversible.

Allowed without extra founder interruption:

- create and update implementation docs, specs, Linear packets, and local plans
- create Linear issues when live Linear access is available
- implement draft/sandbox/local command-center features
- add service-layer modules, tests, mock adapters, and visual prototypes
- commit non-destructive changes
- push completed branches when repository policy allows it
- update wiki/memory/handoff artifacts after meaningful learning

Still blocked behind explicit approval gates:

- public publishing
- ad spend
- production deployment
- destructive migrations
- external client commitments
- paid provider jobs above configured caps
- exposing credentials, private notes, or client-sensitive data

## Product Goal

Unite-Group CRM becomes the operating command center for the business:

```text
Board/Founder/Client Input
  -> Channel Intake
  -> Margot Clarification
  -> Ontology Link
  -> Board/Senior Team Routing
  -> Scenario/Draft Execution
  -> Presentation or Build Packet
  -> Human Approval
  -> Local/Preview/Production Action
  -> Outcome Learning
```

The experience for Phill and Board members must feel simple:

- send a Telegram/WhatsApp message
- upload or sync Plaud notes
- drop meeting notes
- review a clear generated board packet
- approve, reject, defer, or ask for refinement

The system handles the operational complexity underneath.

## Core Objects

```ts
type BoardInput = {
  id: string;
  source: "telegram" | "whatsapp" | "plaud" | "meeting_notes" | "manual" | "obsidian";
  speaker: string;
  business: string;
  rawText: string;
  cleanedText: string;
  capturedAt: string;
  sensitivity: "public" | "internal" | "confidential" | "restricted";
};

type CommandCenterAction = {
  id: string;
  inputId: string;
  ontologyRefs: string[];
  owner: "ceo_board" | "senior_engineering" | "margot" | "marketing_team" | "client_success";
  actionType: "research" | "plan" | "build" | "presentation" | "video" | "client_brief" | "linear_issue";
  status: "draft" | "needs_evidence" | "ready_for_review" | "approved" | "blocked" | "done";
  approvalGate: string;
  evidenceRefs: string[];
  risk: number;
  nextAction: string;
};
```

## Service-Layer Target

```text
lib/unite-command-center/
  intake/
    channel-intake.service.ts
    plaud-note-normalise.service.ts
    founder-voice-cleanup.service.ts
  ontology/
    command-ontology.service.ts
    evidence-linker.service.ts
  routing/
    board-router.service.ts
    team-dispatch.service.ts
    margot-queue.service.ts
  actions/
    scenario-runner.service.ts
    presentation-packet.service.ts
    linear-packet.service.ts
  gates/
    approval-policy.service.ts
    publish-spend-policy.ts
  qa/
    presentation-qa.service.ts
    command-center-readiness.service.ts
  outcomes/
    outcome-learning.service.ts
```

Entry routes under `app/api/command-centre/*` should stay thin: auth, validation, service call, response.

## Board-Member UX

Board members should not need to learn the internal architecture.

Required modes:

- **Telegram/WhatsApp intake:** send ideas, meeting notes, photos, questions, or quick approvals.
- **Plaud intake:** upload/transcribe conversation notes into structured decisions, tasks, risks, and follow-ups.
- **Command Center review:** see generated board packets, live event presentation drafts, build plans, and action state.
- **Approval controls:** approve, request refinement, block, defer, or assign to Margot.
- **Local-first operation:** local draft and preview mode is the default; production action remains gated.

## Immediate Implementation Order

1. Add command-center authority and service design docs. Completed in this file.
2. Create Linear-ready work packets for the next implementation tranche.
3. Add `lib/unite-command-center/*` service shells and tests.
4. Add a draft-only `app/api/command-centre/intake` route.
5. Add a Command Center panel for `@team`, Margot queue, and Board input review.
6. Add presentation QA to generated visual boards before any board/client presentation.
7. Add Telegram/Plaud adapters behind existing credential gates.
8. Keep WhatsApp as a design target until provider, consent, and known-contact policy are verified.

## Reliability Rule

Execution reliability outranks cosmetic dashboard work:

- access parity first
- failure-state visibility second
- service-layer routing third
- presentation polish fourth
- production automation last

## Linear Packet

Replay packet:

```text
.planning/linear-packets/unite-autonomous-command-center-2026-05-19.json
```

Use project key `unite-group` when live Linear access is available.
