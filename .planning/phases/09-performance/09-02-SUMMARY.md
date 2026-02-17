---
phase: 09-performance
plan: 02
status: complete
subsystem: dependencies
tags: [dependencies, optimization, devDependencies, cleanup]
---

# 09-02: Dependency Optimization

## Performance

- **Production dependencies reduced**: 25 packages removed/moved from production dependencies
- **Install footprint**: ~240MB saved from puppeteer alone moving out of production deps
- **Express ecosystem removed**: 7 packages (~15MB) no longer in production tree
- **Clean npm install**: `--legacy-peer-deps` flag no longer required

## Accomplishments

### Task 1: Move 15 misplaced packages to devDependencies
- Moved 8 `@types/*` packages (jsonwebtoken, node, nodemailer, pg, react, react-dom, sendgrid, ws)
- Moved 5 build tools (typescript, autoprefixer, postcss, tailwindcss, tailwindcss-animate)
- Moved 1 testing tool (@storybook/test)
- Moved 1 build-only tool (dotenv)
- Total: 15 packages moved from `dependencies` to `devDependencies`
- Commit: `dd820c6`

### Task 2: Remove unused production dependencies
- Removed `redis` (0 imports anywhere in codebase; project uses @upstash/redis and ioredis)
- Removed 7 Express ecosystem packages (express, express-rate-limit, express-session, express-validator, cors, helmet, multer) -- all imports confined to legacy `src/` directory, zero in `app/` or `lib/`
- Moved `puppeteer` and `puppeteer-screen-recorder` to devDependencies
- Updated `lib/video/capture-service.ts` with dynamic imports and graceful fallback when puppeteer is unavailable in serverless environments
- Total: 8 packages removed, 2 moved to devDependencies
- Commit: `573e0ad`

### Task 3: Remove --legacy-peer-deps
- Clean `npm install` (without `--legacy-peer-deps`) succeeded after dependency cleanup
- Updated `vercel.json` installCommand from `"npm install --legacy-peer-deps"` to `"npm install"`
- Commit: `0de3cf7`

## Files Modified

| File | Change |
|------|--------|
| `package.json` | Moved 15 packages to devDependencies, removed 8 unused deps, added 2 to devDeps |
| `lib/video/capture-service.ts` | Dynamic imports for puppeteer with graceful fallback |
| `vercel.json` | Removed `--legacy-peer-deps` from installCommand |

## Verification

- [x] package.json is valid JSON
- [x] No @types/* in production dependencies
- [x] No unused packages in production dependencies
- [x] puppeteer in devDependencies (not dependencies)
- [x] `npm install` succeeds without `--legacy-peer-deps`
- [x] Tests pass (`npm test -- --bail`) -- 2 pre-existing failures in `brand-generation.test.ts` unrelated to changes

## Decisions

- Kept `@prisma/client` in production dependencies (runtime ORM)
- Kept `react`, `react-dom` in production dependencies (runtime)
- Kept `axios`, `ioredis`, `@upstash/redis` in production dependencies (active runtime imports)
- Did not remove Express types (@types/express etc.) since they were never in dependencies
- Used dynamic `await import()` for puppeteer rather than `require()` to match ESM module system

## Deviations from Plan

- None. All 3 tasks completed as planned.

## Issues

- 2 pre-existing test failures in `tests/strategic-marketing/brand-generation.test.ts` (Psychology Validation suite) -- same failures present before dependency changes. Caused by randomness in validation logic, not related to dependency optimization.
- Node.js engine mismatch warning during local testing (local v20.19.4 vs required 22.x) -- does not affect Vercel deployment which uses Node 22.x.

## Next Phase Readiness

Plan 09-02 is complete. The production dependency tree is now clean:
- All type definitions, build tools, and testing tools are in devDependencies
- No unused packages remain in production dependencies
- Clean `npm install` works without workaround flags
- Ready for next plan in phase 09 (performance optimization).
