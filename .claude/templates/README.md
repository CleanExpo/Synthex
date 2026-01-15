# Spec Templates Guide

## Overview

This directory contains templates for creating specification documents for features and project phases in Node.js Starter V1. These templates enforce the project's requirements-first development principle and ensure Australian-first context.

**Principle**: Every feature and project phase must have a specification document (spec.md) before implementation begins.

---

## Template Types

### 1. Project Phase Template (`spec-project-phase.md`)

**Use for:**

- Major architectural changes (Phase 0-9 style from PROGRESS.md)
- New agent implementations
- System-wide refactors or enhancements
- Infrastructure or security changes
- Multi-week projects affecting core systems

**Location**: `docs/phases/phase-X-spec.md`

**Structure**: 10-section comprehensive specification

- Vision, Users, Technical, Design, Business, Implementation, Related Docs, Progress, Assumptions, Sign-Off

**Depth**: Comprehensive (designed for complex architectural planning)

**Duration to Create**: 2-3 hours (via Spec Builder Agent interview or template mode)

---

### 2. Feature Template (`spec-feature.md`)

**Use for:**

- UI components and forms
- API endpoints and services
- Focused feature implementations
- Bug fixes with explicit requirements
- Small to medium features (1-2 week scope)

**Location**: `docs/features/[feature-name]/spec.md`

**Structure**: 8-section focused specification

- Vision, Users, Technical, Design, Business, Implementation, Related Docs, Status

**Depth**: Focused (designed for quick iteration)

**Duration to Create**: 30-60 minutes (via template or lightweight interview)

---

## How to Use Templates

### Method 1: Automatic Generation (Recommended)

The system automatically detects when you start new work:

```
User: "Add dark mode toggle to settings"
      ↓
System detects: feature request
      ↓
Checks: docs/features/dark-mode-toggle/spec.md → NOT FOUND
      ↓
Prompts: "Generate spec.md? [Interview/Template/Skip]"
      ↓
User selects: Template
      ↓
System: Generates pre-filled spec.md
      ↓
Result: Ready for user to review and complete
```

**Command**: No command needed - automatic detection in pre-response hook

---

### Method 2: Manual Template Copy

Copy the appropriate template file to your feature/phase location:

**For Features:**

```bash
# Copy feature template
cp .claude/templates/spec-feature.md docs/features/[feature-name]/spec.md

# Edit with your feature details
nano docs/features/[feature-name]/spec.md
```

**For Project Phases:**

```bash
# Copy project phase template
cp .claude/templates/spec-project-phase.md docs/phases/phase-X-spec.md

# Edit with your phase details
nano docs/phases/phase-X-spec.md
```

---

### Method 3: Spec Builder Agent Interview (Best for Complex Requirements)

For complex, ambiguous, or large-scope work:

```bash
# Start interactive 6-phase interview
# System automatically routes to Spec Builder Agent when:
User: "Start Phase 8: API Rate Limiting"
# OR
User: "I need to implement a complex checkout flow"

# Spec Builder conducts:
# 1. Vision questions
# 2. Users questions
# 3. Technical questions
# 4. Design questions
# 5. Business questions
# 6. Implementation questions

# Result: Auto-generated spec.md file
```

---

## Spec Completeness Requirements

A spec.md is considered **complete** (≥80%) when it has:

### Content Completeness (ALL REQUIRED)

- ✅ All sections have meaningful content (not just section headings)
- ✅ Vision clearly states problem, beneficiaries, success criteria, why now
- ✅ Users includes personas and user stories
- ✅ Technical describes architecture and dependencies
- ✅ Design specifies components and requirements
- ✅ Business defines priority, scope, metrics, risks
- ✅ Implementation has specific build steps and verification criteria

### Australian Context (ALL REQUIRED)

- ✅ Language: en-AU (Australian English spelling)
- ✅ Date Format: DD/MM/YYYY (e.g., 15/01/2026)
- ✅ Currency: AUD (if applicable)
- ✅ Timezone: Australia/Brisbane (primary)
- ✅ Compliance: Privacy Act 1988, WCAG 2.1 AA mentioned

### Design System Compliance (ALL REQUIRED)

- ✅ References `.claude/data/design-tokens.json`
- ✅ Explicitly states "NO Lucide icons"
- ✅ Specifies 2025-2026 aesthetic (bento grid, glassmorphism)
- ✅ Includes WCAG 2.1 AA accessibility requirements

### Verification Standards (ALL REQUIRED)

- ✅ Test requirements specified (unit, integration, E2E)
- ✅ Lighthouse score threshold (>90)
- ✅ Independent verification method defined
- ✅ Measurable success metrics

### Completeness Check

```bash
# System will automatically validate when you resume work:
User: "Continue working on OAuth feature"
     ↓
System checks: docs/features/auth-oauth/spec.md
     ↓
Validates completeness (≥80%)
     ↓
If incomplete: "spec.md is only 60% complete. Complete sections: [list]"
If complete: Loads spec context → proceeds with implementation
```

---

## Customization

### Customizing Templates

Both templates can be customized to match your project needs, but maintain the core structure:

**DO customize:**

- Section content and examples
- Additional fields relevant to your domain
- Integration instructions specific to your stack
- Team-specific verification criteria

**DON'T customize:**

- The 6-phase structure (Vision → Users → Technical → Design → Business → Implementation)
- Australian context requirements (en-AU, DD/MM/YYYY, AUD, WCAG 2.1 AA)
- Design system compliance (design tokens, NO Lucide icons)
- Verification requirements

### Creating Project-Specific Variations

If you need significant variations for specific domains:

1. Copy the base template
2. Name it descriptively: `spec-feature-api.md`, `spec-feature-ui.md`
3. Add project-specific sections
4. Document the variations in this README

---

## Integration with Systems

### With PROGRESS.md

Project phase specs link to PROGRESS.md:

```markdown
# PROGRESS.md

## Phase X: [Name]

**Spec**: [docs/phases/phase-X-spec.md](docs/phases/phase-X-spec.md)
**Status**: In Progress
**Progress**: [████░░░░░░] 40%
```

### With Spec Builder Agent

Spec Builder Agent supports three modes:

1. **Interview Mode** (default): Interactive 6-phase interview → generates comprehensive spec
2. **Template Mode**: Pre-fills template → user completes → ready to implement
3. **Validation Mode**: Reviews existing spec → reports completeness → flags gaps

### With Git/GitHub

Link to specs in PR descriptions:

```markdown
## Spec

This PR implements features defined in:

- [Dark Mode Toggle Spec](../../../docs/features/dark-mode-toggle/spec.md)

## Verification

All criteria from spec verified:

- [x] All tests pass
- [x] Lighthouse >90
- [x] WCAG 2.1 AA compliant
- [x] Australian context validated
```

---

## Examples

### Example 1: Feature Spec (Completed)

See: `docs/features/dark-mode-toggle/spec.md`

This example shows a complete feature spec with:

- Clear vision and user stories
- Concrete technical approach
- Design system compliance
- Verification criteria

### Example 2: Project Phase Spec (Completed)

See: `docs/phases/phase-2-spec.md`

This example shows a complete project phase spec with:

- Comprehensive architecture planning
- Multiple user personas
- Complex technical integrations
- Sign-off requirements

---

## Best Practices

1. **Start with a Template**: Don't write from scratch - use templates as guides

2. **Be Specific**: Generic specs are useless. Include concrete examples.

3. **Reference Design Tokens**: Don't describe colors - reference token names

4. **Link to Existing Docs**: Point to relevant CLAUDE.md sections, skills, agents

5. **Keep It Updated**: Spec.md evolves. Update as understanding improves.

6. **Validate Before PR**: Ensure ≥80% completeness before code review

7. **Archive When Done**: Move completed specs to `docs/archive/` for historical reference

---

## Troubleshooting

### Q: Can I skip spec.md for small changes?

**A**: For trivial changes (typos, formatting), spec.md is optional. For anything requiring logic changes, spec.md is required. When in doubt, create one.

### Q: What if requirements change mid-implementation?

**A**: Update spec.md first (source of truth), then adjust implementation. Document changes with timestamps.

### Q: How do I validate my spec.md?

**A**: The system validates when you resume work. Manual check against completeness requirements above.

### Q: Can I use a different template structure?

**A**: For most features/phases, no - maintain consistency. For domain-specific work, document variations and get team approval.

### Q: Where do I store specs?

**A**: Always use standard locations:

- Projects phases: `docs/phases/phase-X-spec.md`
- Features: `docs/features/[feature-name]/spec.md`
- After completion: `docs/archive/[year]/[feature]/spec.md`

---

## Related Documentation

- **CLAUDE.md**: Project architecture and quick start
- **PROGRESS.md**: Project phase tracking
- **docs/SPEC_GENERATION.md**: Spec system documentation
- **Design Tokens**: `.claude/data/design-tokens.json`

---

**Last Updated**: [DD/MM/YYYY]
**Template Version**: 1.0.0
**Maintainer**: Architecture Team
