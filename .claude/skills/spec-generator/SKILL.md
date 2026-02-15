---
name: spec-generator
description: >
  "No implementation without specification" enforcement. Auto-generates
  specification documents before any feature or project work begins. Two
  templates: project-phase (10 sections) and feature (8 sections). Specs
  are written to `.claude/specs/`. Includes detection logic to intercept
  implementation tasks that lack a spec.
---

# Specification Generator

## Process

1. **Detect** -- when a task looks like implementation work, check for an existing spec
2. **Select template** -- choose project-phase or feature template based on scope
3. **Generate spec** -- fill in all template sections with available information
4. **Review** -- present spec for approval before implementation begins
5. **Store** -- write approved spec to `.claude/specs/`

## Detection Logic

Before starting any implementation task, apply these checks:

### Implementation Signals
A task is likely implementation if it involves:
- Writing or modifying application code (not config, not docs)
- Adding new API endpoints, components, or services
- Changing data models or database schema
- Integrating third-party services or APIs
- Modifying build pipeline or deployment configuration

### Spec Check Protocol
```
1. Identify the feature/project scope from the task description
2. Search `.claude/specs/` for matching spec file
3. If spec exists and status is "Approved" -> proceed with implementation
4. If spec exists but status is "Draft" -> prompt for approval first
5. If no spec exists -> generate spec before implementation
```

### Override
- Hotfixes and critical bug fixes may skip spec generation
- Tasks explicitly labeled "no-spec" by the operator bypass the check
- Typo fixes, dependency updates, and config tweaks are exempt

## Template: Project Phase (10 Sections)

Use for large initiatives spanning multiple sessions or involving architectural decisions.

**Filename**: `.claude/specs/project-{slug}-spec.md`

```markdown
---
id: spec-{NNN}
type: project-phase
title: {Project Title}
created: YYYY-MM-DD
status: Draft | Approved | In Progress | Complete
author: {agent or human}
---

# {Project Title} -- Specification

## 1. Vision & Goals
- **Problem statement**: What problem does this solve?
- **Success criteria**: How do we know it is done?
- **Non-goals**: What is explicitly out of scope?

## 2. Target Users
- **Primary persona**: Who benefits most?
- **Secondary personas**: Who else is affected?
- **User stories**: As a [user], I want [action], so that [benefit]

## 3. Technical Architecture
- **System design**: High-level architecture and data flow
- **Technology choices**: Frameworks, libraries, services
- **Data model changes**: New or modified database schemas
- **API contracts**: Endpoint definitions, request/response shapes
- **Dependencies**: External services, third-party integrations

## 4. Design & UX
- **Wireframes/Mockups**: Visual references (links or descriptions)
- **User flows**: Step-by-step interaction sequences
- **Accessibility requirements**: WCAG compliance targets
- **Responsive behavior**: Mobile, tablet, desktop considerations

## 5. Business & Metrics
- **KPIs**: Measurable success indicators
- **Revenue impact**: How this affects business metrics
- **Cost considerations**: Infrastructure, API costs, maintenance burden
- **Timeline**: Estimated effort and milestones

## 6. Implementation Plan
- **Phases**: Ordered list of implementation steps
- **Task breakdown**: Individual work items with estimates
- **Dependencies**: What must be done first
- **Risk mitigation**: Known risks and contingency plans

## 7. Documentation Plan
- **User-facing docs**: What needs to be documented for end users
- **Developer docs**: API references, architecture decisions
- **Runbooks**: Operational procedures for new functionality

## 8. Progress Tracking
- **Milestones**: Key checkpoints with dates
- **Completion criteria**: Definition of done for each milestone
- **Status updates**: Log of progress entries

## 9. Assumptions & Constraints
- **Assumptions**: What we believe to be true without verification
- **Constraints**: Technical, business, or timeline limitations
- **Open questions**: Unresolved items requiring answers

## 10. Approval
- **Reviewer**: [name/role]
- **Approved date**: [date or "Pending"]
- **Conditions**: [any conditional approvals]
```

## Template: Feature (8 Sections)

Use for individual features, enhancements, or bounded pieces of work.

**Filename**: `.claude/specs/feature-{slug}-spec.md`

```markdown
---
id: spec-{NNN}
type: feature
title: {Feature Title}
created: YYYY-MM-DD
status: Draft | Approved | In Progress | Complete
author: {agent or human}
---

# {Feature Title} -- Specification

## 1. Vision & Goals
- **What**: One-sentence description of the feature
- **Why**: Business or user justification
- **Success criteria**: Measurable outcomes

## 2. Target Users
- **Who uses this**: Primary user persona
- **User story**: As a [user], I want [action], so that [benefit]
- **Edge cases**: Unusual usage patterns to handle

## 3. Technical Design
- **Approach**: How to implement (high-level)
- **Files to modify**: Expected code changes
- **Data model**: Schema additions or changes
- **API changes**: New or modified endpoints
- **Dependencies**: Libraries or services needed

## 4. Design & UX
- **UI changes**: Visual modifications needed
- **Interaction flow**: User steps from start to finish
- **Error states**: How failures are communicated

## 5. Business Impact
- **Metrics affected**: Which KPIs change
- **Cost**: Additional infrastructure or API costs
- **Priority**: Critical / High / Medium / Low

## 6. Implementation Steps
1. [Step 1 with estimate]
2. [Step 2 with estimate]
3. [Step 3 with estimate]

## 7. Documentation
- **User docs**: What to document
- **Code comments**: Key areas needing inline docs
- **Changelog entry**: Summary for release notes

## 8. Status
- **Current phase**: Draft / Approved / In Progress / Complete
- **Blockers**: [any blocking issues]
- **Last updated**: YYYY-MM-DD
```

## Spec Storage

- **Location**: `.claude/specs/`
- **Naming convention**: `{type}-{slug}-spec.md` (e.g., `feature-stripe-webhooks-spec.md`)
- **Index**: maintain `.claude/specs/index.md` listing all specs with status

### Spec Index Format
```markdown
# Specification Index

| ID | Type | Title | Status | Created |
|----|------|-------|--------|---------|
| spec-001 | project-phase | [title] | Approved | YYYY-MM-DD |
| spec-002 | feature | [title] | Draft | YYYY-MM-DD |
```

## Output Format

When generating a spec:
```markdown
## Spec Generated
- **ID**: spec-{NNN}
- **Type**: project-phase / feature
- **Title**: {title}
- **File**: `.claude/specs/{filename}`
- **Status**: Draft (awaiting approval)
- **Action required**: Review and approve before implementation begins
```
