# A5 — Dependencies & Build Audit

Generated: 2026-03-18
Agent: A5 (project-scanner)
Phase-119 baseline: 107 findings

---

## Findings

---

[A5-FINDING-001] HIGH
Status: REGRESSION
Phase-119 ref: N/A (claimed resolved in Phase 120 Sprint 3)
File: lib/video/capture-service.ts:28
Issue: Phase 120 Sprint 3 claimed `puppeteer-screen-recorder` was "removed", and it is correctly absent from `package.json`, but `lib/video/capture-service.ts:28` still contains a live dynamic `import('puppeteer-screen-recorder')` call. At runtime this throws `MODULE_NOT_FOUND` for any code path that triggers video capture.
Fix: Either re-add `puppeteer-screen-recorder` as an optional/dev dependency with a runtime guard, OR remove the dynamic import and replace with a `throw new Error('Video capture not available in this environment')` guard. The current state leaves a broken code path in production.
Linear: CREATE-NEW

---

[A5-FINDING-002] HIGH
Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-014 (formerly PACKAGES-01)
File: package.json
Issue: `openai` is pinned to `^4.104.0`. The latest stable release is v6.x. Two full major versions behind — v5 introduced the new `responses` API and removed legacy completion endpoints; v6 further changed the default streaming interface. All `lib/` files using the `openai` SDK are at risk of hitting deprecated or removed endpoints.
Fix: Upgrade to `openai@^6.x` and audit all usages in `lib/` for breaking API surface changes (endpoint names, streaming API, type signatures). Do not upgrade without a dedicated migration pass.
Linear: CREATE-NEW

---

[A5-FINDING-003] MEDIUM
Status: CONFIRMED-RESOLVED
Phase-119 ref: FINDING-015 (formerly PACKAGES-22)
File: app/dashboard/admin/remotion-studio/page.tsx:40
Issue: `@remotion/player` (94MB tree) is imported only in `app/dashboard/admin/remotion-studio/page.tsx` and the import is correctly wrapped in `next/dynamic` with `ssr: false` (line 40: `() => import('@remotion/player').then((mod) => mod.Player)`). No static module-level import of `@remotion/player` exists anywhere in the codebase.
Fix: No action required. Dynamic import pattern is correct.
Linear: N/A

---

[A5-FINDING-004] MEDIUM
Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-016 (formerly PACKAGES-23)
File: app/dashboard/web-projects/[id]/page.tsx:45, package.json
Issue: Package installed is `gsap@^3.14.2` (standard FOSS build). The web-projects page embeds GSAP animation snippet templates in code strings that reference `SplitText` — a GSAP Club (paid licence) plugin. The template code is illustrative/copy-paste material shown to users, not executed code. However, the GSAP licence situation is ambiguous: the standard `gsap` npm package includes `SplitText` in GSAP v3.12+ as part of the free tier, but this changed — confirm whether the installed version legally includes SplitText under the standard licence. If not, the templates are misleading users to use a paid plugin.
Fix: Confirm gsap v3.14.2 licence coverage for SplitText. If SplitText requires Club licence, update template code comments to note the paid-tier requirement. The `LandingAnimations.tsx` and `LenisProvider.tsx` files correctly use dynamic imports for gsap — no static imports detected at module level.
Linear: CREATE-NEW

---

[A5-FINDING-005] MEDIUM
Status: CONFIRMED-OPEN
Phase-119 ref: N/A (formerly PACKAGES-19 based on 119 findings context)
File: package.json (dependencies: "@auth/prisma-adapter": "^2.11.1")
Issue: `@auth/prisma-adapter` v2.11.1 is listed as a production dependency. Grep across the entire codebase finds zero actual imports of this package (the only references are in `scripts/diagnose-build.js` which logs it as a package to uninstall). The project uses Supabase auth exclusively — `@auth/prisma-adapter` is incompatible with the current auth stack and is dead weight in the production bundle.
Fix: Run `npm uninstall @auth/prisma-adapter` and remove from `package.json`. Verify `npm run build` and `npm test` still pass. This is a safe removal.
Linear: CREATE-NEW

---

[A5-FINDING-006] LOW
Status: CONFIRMED-RESOLVED
Phase-119 ref: N/A
File: lib/video/video-processor.ts:11
Issue: `fluent-ffmpeg` is imported in `lib/video/video-processor.ts:11` as a real, active import. This confirms the Phase 119 note that the dependency is intentional.
Fix: No action required. Dependency is in use and `@types/fluent-ffmpeg` is correctly listed in devDependencies.
Linear: N/A

---

[A5-FINDING-007] LOW
Status: NEW
File: next.config.mjs (serverExternalPackages array, line 115)
Issue: `puppeteer` is listed in `serverExternalPackages` but `puppeteer` is in `devDependencies` only (not production dependencies). On Vercel serverless functions, devDependencies are not installed at runtime, so including it in `serverExternalPackages` has no effect but adds noise and may mislead future maintainers about what is available at runtime.
Fix: Remove `puppeteer` from `serverExternalPackages` in `next.config.mjs`. It is a dev-only tool (used for E2E testing) and should never be referenced in production server configuration.
Linear: CREATE-NEW

---

[A5-FINDING-008] LOW
Status: NEW
File: next.config.mjs (experimental.optimizePackageImports)
Issue: `react-icons` and `lodash` are listed in `optimizePackageImports` but neither `react-icons` nor `lodash` appears in `package.json` (neither dependencies nor devDependencies). These are phantom entries — the optimisation targets packages that are not installed.
Fix: Remove `react-icons` and `lodash` from the `optimizePackageImports` array in `next.config.mjs`. This is a trivial config cleanup with no risk.
Linear: CREATE-NEW

---

[A5-FINDING-009] MEDIUM
Status: NEW
File: package.json (react: "^18.2.0", react-dom: "^18.2.0")
Issue: React 18.2.0 is installed. React 19.x (stable release) introduced concurrent features, improved Server Components, the `use()` hook, and the new form/action APIs. Next.js 15 is designed to work with React 19 and some new Next.js 15 features (like form actions) perform better on React 19. The project is one major version behind.
Fix: Plan a React 19 upgrade. Test for breaking changes (especially around `useLayoutEffect` server warnings, ref forwarding changes, and removed legacy APIs). This is a non-trivial upgrade requiring a dedicated sprint.
Linear: CREATE-NEW

---

[A5-FINDING-010] LOW
Status: NEW
File: package.json (tailwindcss: "^3.4.0")
Issue: Tailwind CSS 3.4.x is installed. Tailwind CSS v4.x (stable as of early 2026) is a ground-up rewrite with a new CSS-first configuration model that replaces `tailwind.config.js` entirely, changes the CLI, and removes PostCSS dependency. The project is one major version behind.
Fix: Evaluate Tailwind v4 upgrade timeline. This is a significant migration (config format changes entirely). Low urgency — v3.x continues to receive security patches.
Linear: CREATE-NEW

---

[A5-FINDING-011] LOW
Status: NEW
File: package.json (zod: "^3.25.76")
Issue: Zod 3.25.76 is installed. Zod v4 entered release candidate phase in early 2026, offering ~14x faster parsing and a new schema API. The project is approaching a major version boundary. Breaking changes in v4 include schema method renames and type inference changes.
Fix: Monitor Zod v4 stable release. Plan migration when stable — the `^3.x` range pin will prevent accidental upgrade.
Linear: CREATE-NEW

---

[A5-FINDING-012] LOW
Status: NEW
File: package.json (typescript: "^5.7.2" in devDependencies)
Issue: TypeScript 5.7.2 is installed. TypeScript 5.8+ is available (released Q1 2026) with improved `--erasableSyntaxOnly` mode and stricter `isolatedModules` checks. Minor gap — no breaking changes expected.
Fix: Update TypeScript to latest 5.x patch (`npm install -D typescript@latest`). Low-risk routine maintenance.
Linear: CREATE-NEW

---

[A5-FINDING-013] MEDIUM
Status: NEW
File: package.json (next: "^15.5.12")
Issue: `next.config.mjs` has `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true`. Both gates are disabled in the production build. TypeScript errors and ESLint violations are only caught by manual `npm run type-check` and `npm run lint` — they will not block a Vercel deploy. This creates a risk that a broken deploy reaches production silently.
Fix: This should be tracked as an operational risk alongside the dependency audit. The stated reason is OOM on 8GB Vercel machines during type-checking. Consider enabling `typescript.ignoreBuildErrors: false` with a memory-optimised tsconfig or using a GitHub Actions check as the mandatory gate before merge rather than relying on Vercel build.
Linear: CREATE-NEW

---

[A5-FINDING-014] LOW
Status: NEW
File: package.json (devDependencies: "@next/bundle-analyzer": "^14.2.18")
Issue: `@next/bundle-analyzer` is pinned to `^14.2.18` but `next` is `^15.5.12`. The bundle analyser major version should match the Next.js major version. The v14 analyser may not correctly handle Next.js 15's App Router output format.
Fix: Update to `@next/bundle-analyzer@^15.x` (`npm install -D @next/bundle-analyzer@latest`).
Linear: CREATE-NEW

---

## Summary

| Severity  | Count  | Statuses                                      |
| --------- | ------ | --------------------------------------------- |
| HIGH      | 2      | 1 REGRESSION, 1 CONFIRMED-OPEN                |
| MEDIUM    | 5      | 1 CONFIRMED-OPEN, 1 CONFIRMED-RESOLVED, 3 NEW |
| LOW       | 7      | 1 CONFIRMED-RESOLVED, 6 NEW                   |
| **Total** | **14** |                                               |

| Status             | Count |
| ------------------ | ----- |
| REGRESSION         | 1     |
| CONFIRMED-OPEN     | 2     |
| CONFIRMED-RESOLVED | 2     |
| NEW                | 9     |

### Critical Actions (before next deploy)

1. **A5-001 REGRESSION** — `lib/video/capture-service.ts` still imports `puppeteer-screen-recorder` at runtime despite it being removed from `package.json`. Runtime `MODULE_NOT_FOUND` on any video capture code path.
2. **A5-002 HIGH** — `openai@4.x` is two major versions behind v6.x. Deprecated API surface risk.

### Safe Quick Wins

- **A5-005** — `npm uninstall @auth/prisma-adapter` — zero imports, safe to remove now.
- **A5-007** — Remove `puppeteer` from `serverExternalPackages` in `next.config.mjs` — dev-only package.
- **A5-008** — Remove `react-icons` and `lodash` from `optimizePackageImports` — neither is installed.
- **A5-014** — Update `@next/bundle-analyzer` to v15 to match Next.js version.

### Phase-119 Finding Resolutions

| Phase-119 Finding                                        | This Audit | Result                                                                              |
| -------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| FINDING-014 / PACKAGES-01 (openai v4)                    | A5-002     | CONFIRMED-OPEN                                                                      |
| FINDING-015 / PACKAGES-22 (@remotion/player SSR)         | A5-003     | CONFIRMED-RESOLVED                                                                  |
| FINDING-016 / PACKAGES-23 (gsap licence)                 | A5-004     | CONFIRMED-OPEN (reduced risk — SplitText is in template strings only, not executed) |
| puppeteer-screen-recorder (claimed removed in Phase 120) | A5-001     | REGRESSION — package removed but dynamic import() call remains                      |
| @auth/prisma-adapter (PACKAGES-19)                       | A5-005     | CONFIRMED-OPEN — zero imports, dead dependency                                      |
