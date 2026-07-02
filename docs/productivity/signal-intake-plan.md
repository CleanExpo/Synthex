# Synthex Signal Intake Plan

Status: planning-only
Created: 24/06/2026

## Problem

Synthex has research notes, wiki findings, cron outputs, reports, source registers, and ShipIt evidence. What is missing is the front-half bridge that turns these signals into proposed, deduped, PM-triaged work.

## Principle

Signal intake creates proposed work only. It does not auto-execute, publish, deploy, migrate, or contact clients.

## Proposed shape

```text
raw signal → SignalEnvelope → dedupe/relevance gate → proposed Work Packet → PM/Board review → approved lane
```

## SignalEnvelope

```ts
type SignalEnvelope = {
  source:
    | 'youtube'
    | 'obsidian'
    | 'wiki'
    | 'cron'
    | 'shipit'
    | 'repo'
    | 'manual';
  externalRef: string;
  observedAt: string;
  projectKey: 'synthex';
  title: string;
  summary: string;
  sourcePathOrUrl: string;
  confidenceLabel:
    | 'VERIFIED'
    | 'OPINION_SOURCE'
    | 'HYPOTHESIS_FOR_TESTING'
    | 'DATA_REQUIRED'
    | 'STALE_POINT_IN_TIME';
  risk: 'low' | 'medium' | 'high';
  suggestedLane:
    | 'research'
    | 'software'
    | 'content'
    | 'visual'
    | 'ops'
    | 'security'
    | 'pm';
  approvalBucket: 'auto' | 'approval' | 'never-autonomous';
};
```

## Dedupe and relevance rules

Skip a signal when:

- same `externalRef` already created a Work Packet;
- source is opinion-only and suggests direct execution;
- source path is not in the source registry;
- signal would expand blast radius while Synthex has open P0/P1 security or tenant-safety blockers;
- required data remains missing after both registered source roots are searched.

## First safe slice

Docs-only and read-only:

1. Create source registry.
2. Define SignalEnvelope.
3. Create manual Work Packet template.
4. Add evaluator rubric.
5. Do not wire routes, cron, or database writes until explicitly approved.

## Future implementation gates

Before implementation:

- Linear issue exists.
- ShipIt P0/P1 status rechecked.
- Database writes and route changes approved.
- Tests are designed before code.
- Human approval policy is documented.
