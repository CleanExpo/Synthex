---
name: pre-response
type: hook
trigger: Before every Claude response
priority: 1
blocking: false
version: 1.0.0
---

# Pre-Response Hook

Fires before every Claude response to ensure Australian context and proper routing.

## Actions

1. **Load Australian Context**
   - Apply en-AU spelling defaults
   - Set currency to AUD
   - Set date format to DD/MM/YYYY
   - Load australian-context.skill.md

2. **Identify Task Type**
   - Visual/UI → Flag for design system
   - Content → Flag for truth verification
   - Code → Flag for verification tier
   - Research → Flag for source validation
   - SEO → Flag for Australian market context

3. **Route to Orchestrator**
   - Pass task type and context to orchestrator agent
   - Orchestrator determines specialist agent

4. **Pre-load Relevant Skills**
   - Based on task type, pre-load common skills
   - Reduces token usage in subsequent steps

5. **Spec.md Detection & Generation** ✅ NEW

   **Triggers:**
   - User mentions "Phase X" (0-9) from PROGRESS.md
   - User requests new feature or component
   - User resumes work without existing spec
   - Orchestrator detects new phase/feature task

   **Detection Logic:**
   - **Project Phase Indicators**: "Phase X", "architecture", "refactor", "system upgrade", "agent", "orchestrator", "PROGRESS.md"
   - **Feature Indicators**: "component", "endpoint", "api route", "feature", "implement", "add", "create", "UI/UX"
   - **Existing Work**: User mentions feature name from docs/features/

   **Actions:**
   1. Determine spec type: project phase vs feature
   2. Check if spec.md exists in expected location:
      - Project: `docs/phases/phase-X-spec.md`
      - Feature: `docs/features/[name]/spec.md`
   3. If spec exists:
      - Validate completeness (≥80%)
      - Load spec context for implementation
      - Alert if incomplete: "spec.md is X% complete. Complete: [list]"
   4. If spec missing:
      - Prompt: "Generate spec.md? [Interview/Template/Skip]"
      - Interview → Spec Builder Agent (comprehensive)
      - Template → Pre-filled template (quick)
      - Skip → Continue without spec (not recommended)

   **Non-Blocking**: Users can skip if truly not needed

## Never Skip

This hook fires on **EVERY response**. No exceptions.

## Integration

Called automatically by Claude Code before generating any response.

Spec detection enhancement coordinates with:

- `.claude/agents/spec-builder/` - Interview generation
- `.claude/templates/` - Template generation
- `docs/SPEC_GENERATION.md` - Spec system documentation
- `PROGRESS.md` - Phase tracking
