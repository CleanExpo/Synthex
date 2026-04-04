---
spec_type: feature
feature_name: [kebab-case-feature-name]
spec_version: 1.0.0
created_date: DD/MM/YYYY
australian_context: true
design_tokens_version: 1.0.0
---

# Feature Specification: [Feature Name]

## 1. Vision

### Problem

[What problem does this feature solve? What's currently broken or missing?]

### Beneficiaries

[Who benefits from this feature? Users, admins, system?]

### Success Criteria

[What defines success? 2-3 measurable outcomes]

### Why Now

[Why is this important now? What drives urgency?]

---

## 2. Users

### Primary Users

- **[User Type 1]**: [1-2 sentence description and context]
- **[User Type 2]**: [1-2 sentence description and context]

### User Stories

- As a [user type], I want [goal] so that [benefit]
- As a [user type], I want [goal] so that [benefit]

### Pain Points Addressed

- [Pain point 1]: Current workaround, desired solution
- [Pain point 2]: Current workaround, desired solution

---

## 3. Technical Approach

### Architecture

[How does this feature fit into the system? Component placement, data flow]

### Components/Modules

[List main components needed]

- [Component 1]: [Purpose]
- [Component 2]: [Purpose]
- [Component 3]: [Purpose]

### API Endpoints (if applicable)

```
POST /api/[resource]
  Request: { [fields] }
  Response: { [fields] }
  Errors: [error codes]

GET /api/[resource]/:id
  Response: { [fields] }
```

### Database Changes (if applicable)

```typescript
interface [FeatureName] {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  // [other fields]
}
```

### Integrations

- [Service 1]: For [purpose]
- [Service 2]: For [purpose]

### Dependencies

- External packages: [package@version, ...]
- Internal modules: [module, ...]

---

## 4. Design Requirements

### Australian Context ✅ REQUIRED

- **Language**: en-AU (Australian English)
- **Date Format**: DD/MM/YYYY
- **Currency**: AUD (if applicable)
- **Timezone**: Australia/Brisbane
- **Compliance**: WCAG 2.1 AA

### Design System Compliance ✅ REQUIRED

- [ ] Uses design tokens from `.claude/data/design-tokens.json`
- [ ] NO Lucide icons (custom SVG only)
- [ ] Follows 2025-2026 aesthetic (bento grid, glassmorphism)
- [ ] Design token variables used consistently

### UI Components

[List specific components and their purpose]

- [Component]: [Purpose and where it appears]
- [Component]: [Purpose and where it appears]

### Mobile & Responsive

- [ ] Mobile-first approach
- [ ] Touch-friendly (≥48x48px targets)
- [ ] Landscape orientation
- [ ] Performance optimized for mobile

### Accessibility (WCAG 2.1 AA)

- [ ] Color contrast ≥4.5:1
- [ ] Keyboard navigation functional
- [ ] Screen reader tested
- [ ] Focus visible (≥2px)
- [ ] Form labels associated
- [ ] Error messages clear

---

## 5. Business Context

**Priority**: [🔴 High / 🟡 Medium / 🟢 Low]

**Scope**: MVP | Full Feature

**Success Metrics**

- [Metric 1]: [Target value]
- [Metric 2]: [Target value]
- [Metric 3]: [Target value]

**Risks**
| Risk | Mitigation |
|------|-----------|
| [Risk 1] | [Strategy] |
| [Risk 2] | [Strategy] |

---

## 6. Implementation Plan

### Build Order

1. [Foundation/prerequisites]
2. [Core implementation]
3. [Refinement/polish]

### Testing Strategy

**Unit Tests**

- Test [function/component 1]
- Test [function/component 2]
- Aim: [coverage %]

**Integration Tests**

- Test [flow 1] across components
- Test [flow 2] across services

**E2E Tests**

- Test [user journey 1]
- Test [user journey 2]

### Verification Criteria ✅ ALL REQUIRED

- [ ] All tests pass (unit, integration, E2E)
- [ ] Code review completed
- [ ] Design review completed
- [ ] Lighthouse score >90
- [ ] Australian context validated (dates, currency, language)
- [ ] WCAG 2.1 AA validated (automated + manual)
- [ ] Design system compliance verified
  - [ ] NO Lucide icons
  - [ ] Design tokens used
  - [ ] Responsive design tested
- [ ] Performance meets budget:
  - [ ] <3s page load
  - [ ] <100ms interactions
- [ ] Security scan passed (no vulnerabilities)

---

## 7. Related Documentation

**Skills**: [.claude/skills/skill-name.md]
**Design Tokens**: `.claude/data/design-tokens.json`
**Related Features**: [Links to related specs]

---

## 8. Status

**Branch**: [Feature branch name]
**Status**: Specification | In Development | Testing | Ready for Review | Complete

**Checklist**

- [ ] Spec reviewed and approved
- [ ] Foundation work complete
- [ ] Core implementation complete
- [ ] Tests written and passing
- [ ] Code review passed
- [ ] Design review passed
- [ ] Accessibility verified
- [ ] Performance verified
- [ ] Ready for merge

---

**Version**: 1.0.0
**Created**: [DD/MM/YYYY]
**Updated**: [DD/MM/YYYY]
