# Rescued: churn / cohort dashboard (not functional)

Recovered 2026-08-31 from work that existed **only** as untracked files and had never been
committed to any branch on any machine. It was one worktree removal away from being lost.

**This is preserved source, not shipped code.** It lives under `docs/archive/` deliberately —
see "Why it is not in `app/`" below.

## Where it came from

| Part                                           | Found in                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| API route, page, layout, 4 components, 2 hooks | untracked in agent worktree `t_64835c8f` on the external `Storage Unit` volume                  |
| `components/table.tsx`                         | orphaned under `.workputies/t_64835c8f/…` in the main checkout — **not in the worktree at all** |

The two halves were stranded in different places and neither was usable alone: `page.tsx`
imports `Table`, `TableHeader`, `TableBody`, `TableHead`, `TableRow` and `TableCell` from
`components/table`, which only existed in the stray fragment. Reuniting them is the only
reason the source is now complete.

Provenance, original paths and sha256 for every file: `~/synthex-rescue-20260831/MANIFEST.json`.

## Why it is not in `app/`

**It cannot run.** Three defects were found while landing it, all in `dashboard/churn/page.tsx`:

1. **The destructuring keys do not match the returned keys.** The `useMemo` returns
   `{ cohortsData, churnDriversData, pricingElasticityData, featureAdoptionData }`, but the
   result is destructured as `{ cohorts, churnDrivers, pricingElasticity, featureAdoption }`.
   All four are therefore always `undefined`.
2. **The memo reads the very consts it is initialising.** Inside the callback it evaluates
   `cohorts.length`, `churnDrivers`, `pricingElasticity` and `featureAdoption` — the same
   bindings being declared by that `const { … } = useMemo(…)` statement. Any render where the
   `!isLoading && !error` guard passes hits the temporal dead zone and throws
   `ReferenceError: Cannot access 'cohorts' before initialization`. ESLint surfaced this
   indirectly as `react-hooks/exhaustive-deps` "unnecessary dependencies".
3. **There is no data source.** `useCohortAnalysis()` returns only `isLoading`, `error`,
   `fetchCohortAnalysis` and `fetchChurnFlaggedUsers` — it never stores results in state. The
   page never calls the fetchers on mount either. Even with 1 and 2 fixed, it would render
   empty.

Placing this at `app/dashboard/churn/page.tsx` would publish a live Next.js route at
`/dashboard/churn` that throws as soon as loading completes. `docs/archive/` is excluded from
the eslint config and is not built by Next, so the source is preserved and reviewable without
shipping a broken route.

**No attempt was made to repair defect 3.** Supplying a data flow is building the feature, not
rescuing it, and the original intent is not recoverable from the source.

## The one modification made to the rescued source

An emoji in `dashboard/churn/components/skeleton.tsx` was replaced with the Lucide
`AlertTriangle` icon, to satisfy the repository's no-emoji rule. Everything else is
byte-identical to what was found.

## To finish this work

Fix 1 and 2 (both mechanical), then decide where cohort data comes from — either extend
`use-cohort-analysis` to hold fetched results in state, or fetch in the page and pass down.
The API route at `api/cohort-analysis/route.ts` appears complete and is the intended source.
Only then move the tree back under `app/` and let it face the normal gates.
