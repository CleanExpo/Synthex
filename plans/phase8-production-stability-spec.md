---
spec_type: project
phase_type: Phase 8
spec_version: 1.0.0
created_date: 16/01/2026
australian_context: true
design_tokens_version: 1.0.0
---

# Phase 8: Production Stability & Security Hardening Specification

## 1. Vision (Phase 1 of 6)

### Problem Statement

The production build is currently blocked by an invalid placeholder URL in the OAuth route (`/api/auth/oauth/[platform]`), and npm audit reveals 22 security vulnerabilities (2 critical, 8 high). These blockers prevent Phase 7 production cutover.

### Beneficiaries

- **Development Team**: Unblocked deployment pipeline
- **End Users**: Secure, stable platform access
- **Security/Compliance**: Reduced vulnerability surface
- **Operations**: Reliable production environment

### Success Criteria

1. Production build completes without errors (`npm run build` exits 0)
2. Critical and high vulnerabilities resolved (22 → 0 critical/high)
3. OAuth flows functional for all configured platforms
4. All existing tests continue to pass
5. Vercel deployment succeeds

### Why Now

Phase 7 production cutover is blocked. Cannot deploy until:
- Build passes
- Security vulnerabilities addressed
- OAuth configuration validated

---

## 2. Users (Phase 2 of 6)

### Primary User Personas

1. **Marketing Manager (Sarah)**
   - Role: Social media campaign coordinator
   - Technical level: Intermediate
   - Pain point: Cannot connect social accounts via OAuth
   - Goal: Link all social platforms for unified posting

2. **Platform Administrator (Alex)**
   - Role: System administrator
   - Technical level: Expert
   - Pain point: Security vulnerabilities in dependencies
   - Goal: Compliant, secure production deployment

### User Stories

- As a marketing manager, I want to connect my social accounts so that I can publish content across platforms
- As an administrator, I want zero critical vulnerabilities so that the platform meets security compliance
- As a developer, I want the build to pass so that I can deploy new features

### Key Pain Points

- OAuth integration fails silently due to placeholder configuration
- Security scan flags critical vulnerabilities blocking deployment approval
- Build failures prevent CI/CD pipeline completion

---

## 3. Technical Approach (Phase 3 of 6)

### Architecture Overview

This phase focuses on fixing configuration and dependency issues rather than architectural changes:

1. **OAuth Route Fix**: Replace placeholder URLs with environment-driven configuration
2. **Dependency Updates**: Patch vulnerable packages via npm audit fix
3. **Build Validation**: Ensure all routes compile successfully

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    SYNTHEX Platform                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐ │
│  │   OAuth      │     │   Next.js    │     │   Security   │ │
│  │   Routes     │────▶│   Build      │────▶│   Audit      │ │
│  │   [FIX]      │     │   [PASS]     │     │   [CLEAN]    │ │
│  └──────────────┘     └──────────────┘     └──────────────┘ │
│         │                    │                    │          │
│         ▼                    ▼                    ▼          │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              Vercel Production Deploy                    ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Data Model

No database changes required. Configuration-only phase.

### Integration Points

- **OAuth Providers**: Twitter, Instagram, LinkedIn, TikTok, YouTube, Pinterest, Reddit, Facebook
- **Vercel**: Production deployment target
- **npm Registry**: Dependency updates

### Key Dependencies

- **Internal**: `src/services/oauth.ts`, `app/api/auth/oauth/[platform]/route.ts`
- **External**: OAuth provider SDKs, Next.js 14.2.x
- **Infrastructure**: Environment variables in Vercel dashboard

### Technical Constraints

- Cannot use placeholder URLs in production build
- Some dependency updates may introduce breaking changes (jspdf, nodemailer)
- OAuth credentials must be configured per-platform in Vercel

---

## 4. Design Requirements (Phase 4 of 6)

### Australian Context REQUIRED

- **Language**: en-AU (Australian English spelling)
- **Currency**: AUD (Australian Dollars)
- **Date Format**: DD/MM/YYYY (e.g., 16/01/2026)
- **Timezone**: Australia/Brisbane (primary), AEST/AEDT
- **Compliance**: Privacy Act 1988, WCAG 2.1 AA minimum

### Aesthetic Requirements (2025-2026)

No UI changes in this phase. Backend/configuration only.

### UI Components

N/A - No UI changes

### Mobile Requirements

N/A - No UI changes

### Accessibility (WCAG 2.1 AA)

N/A - No UI changes

---

## 5. Business Context (Phase 5 of 6)

**Priority**: HIGH - Production blocker

**Scope Definition**

- MVP Scope: Fix build, resolve critical vulnerabilities
- Phase Scope: OAuth URL fix, npm audit fix, build verification
- Out of Scope: New features, UI changes, additional OAuth providers

**Success Metrics**

- Build status: FAILING → PASSING
- Critical vulnerabilities: 2 → 0
- High vulnerabilities: 8 → 0
- OAuth platforms: 0 working → All configured platforms working

**Business Impact**

- Unblocks Phase 7 production cutover
- Reduces security risk exposure
- Enables marketing team OAuth connectivity

**Risks & Mitigations**

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Breaking changes from npm audit fix --force | Medium | High | Test thoroughly after each update |
| Missing OAuth credentials in Vercel | Medium | Medium | Document required env vars, validate before deploy |
| Build regression after fixes | Low | High | Run full test suite before commit |

---

## 6. Implementation Plan (Phase 6 of 6)

### Build Order (Sequential Steps)

1. **OAuth URL Fix**
   - Locate placeholder URL in OAuth route
   - Replace with environment variable fallback
   - Add validation for missing OAuth config
   - Dependencies: None

2. **Safe Dependency Updates**
   - Run `npm audit fix` (non-breaking)
   - Verify tests still pass
   - Dependencies: Step 1 complete

3. **Breaking Dependency Updates** (if needed)
   - Evaluate jspdf 4.0.0 migration
   - Evaluate nodemailer 7.0.12 migration
   - Test affected features thoroughly
   - Dependencies: Step 2 complete

4. **Build Verification**
   - Run `npm run build`
   - Verify all routes compile
   - Run `npm test`
   - Dependencies: Steps 1-3 complete

5. **Deploy Verification**
   - Deploy to Vercel preview
   - Test OAuth flows
   - Verify no console errors
   - Dependencies: Step 4 complete

### Parallelization Opportunities

- Steps 1 and 2 can be done in parallel (different concerns)
- Step 3 must wait for 1 and 2

### Verification Criteria (All Required)

- [x] All unit tests pass (100% of new code)
- [ ] All integration tests pass
- [ ] Build completes without errors
- [ ] npm audit shows 0 critical/high vulnerabilities
- [ ] OAuth flow tested for at least one platform
- [ ] Vercel preview deployment succeeds

---

## 7. Related Documentation & Resources

### CLAUDE.md References

- Security Requirements: `CLAUDE.md` line 150-200
- Deployment Workflow: `CLAUDE.md` line 100-130

### Skills Required

- `skills/verification/error-handling.skill.md`
- `skills/backend/fastapi.skill.md`

### Agents Involved

- Code Architecture: OAuth route analysis
- Debug & Error Resolution: Build failure investigation

### Hooks Triggered

- `pre-deploy.hook.md`: Verify build passes
- `pre-commit.hook.md`: Run tests before commit

### Design Tokens

N/A - No UI changes

---

## 8. Progress Tracking

**PROGRESS.md Link**: Phase 8 section

**Status**: In Progress

**Start Date**: 16/01/2026
**Target Completion**: 16/01/2026

**Phase Progress**

```
[██░░░░░░░░] 20% Complete
- OAuth URL Fix: 0%
- Safe Dependency Updates: 0%
- Breaking Dependency Updates: 0%
- Build Verification: 0%
- Deploy Verification: 0%
```

---

## 9. Assumptions & Constraints

### Assumptions

- OAuth provider credentials exist in Vercel dashboard (if not, features will be disabled gracefully)
- npm audit fix won't break existing functionality
- No new vulnerabilities introduced by updates

### Technical Constraints

- Must maintain backward compatibility with existing OAuth tokens
- Cannot skip security fixes for production deployment
- Build must pass for Vercel deployment

### Timeline Constraints

- Blocking Phase 7 production cutover
- Should complete same day if possible

---

## 10. Approval & Sign-Off

| Role                | Name         | Date         | Status   |
| ------------------- | ------------ | ------------ | -------- |
| Product Manager     | phill.mcgurk | 16/01/2026   | Pending  |
| Tech Lead           | Claude       | 16/01/2026   | Pending  |
| Design Lead         | N/A          | N/A          | N/A      |
| Architecture Review | Claude       | 16/01/2026   | Pending  |

---

## Appendix: Vulnerability Summary

### Critical (2)
- `jspdf <=3.0.4` - DoS, Path Traversal
  - Fix: Upgrade to 4.0.0 (breaking)

### High (8)
- `next 0.9.9 - 14.2.34` - SSRF, DoS
- `playwright <1.55.1` - SSL certificate validation
- `validator <=13.15.20` - URL validation bypass
- `jws <3.2.3` - HMAC signature verification
- `glob 10.2.0 - 10.4.5` - Command injection
- `preact 10.27.0 - 10.27.2` - JSON VNode injection

### Moderate (4)
- `body-parser 2.2.0` - DoS via URL encoding
- `cookie <0.7.0` - Out of bounds characters
- `nodemailer <=7.0.10` - Email domain confusion, DoS
- `mdast-util-to-hast 13.0.0 - 13.2.0` - Unsanitised class attribute

---

**Document Version**: 1.0.0
**Last Updated**: 16/01/2026
**Next Review**: 17/01/2026
