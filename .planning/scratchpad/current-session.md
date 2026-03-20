## [14:55] Phase 126 Plans 01-05 COMPLETE

### Progress

- Done: Phase 126 — Marketing Site Redesign, all 5 plans executed
- Plans: design system (01), floating pill nav (02), hero+LiveDemoWidget (03), body sections (04), sub-pages (05)
- Issue: SYN-409 (pending creation)

### What was done

1. **Plan 01**: @phosphor-icons/react installed; charcoal color palette added to tailwind; Satoshi font via Fontshare CDN (fontsource package doesn't exist on npm); globals.css --font-sans updated; layout.tsx Inter removed
2. **Plan 02**: NavBar → floating pill (fixed centred, backdrop-blur, scroll shadow); BottomMenu → amber tokens, preserved dashboard interface
3. **Plan 03**: HeroSection → 55/45 asymmetric layout; LiveDemoWidget.tsx created (idle→loading→result state machine); /api/demo/caption (OpenRouter claude-haiku-4-5); /api/demo/image (Gemini 2.0 Flash, graceful fallback)
4. **Plan 04**: how-it-works, testimonials, cta-section, stats-section refreshed; pricing-section → 3 tiers (Enterprise removed), amber-highlighted Pro; footer → charcoal-950
5. **Plan 05**: MarketingLayout bg → charcoal-900; cyan grid removed; all orange→amber in nav/footer; about/page.tsx #0d1f35 → charcoal-800

### Verification

- npm run type-check → 0 errors ✅
- npm run lint → 0 errors, 75 warnings (pre-existing) ✅
- npm test → 1547 passed, 0 failures ✅

### Commits

- aac13361 feat(126-01): design system foundation
- ece543c9 feat(126-02): floating pill nav
- f8d3af2c feat(126-03): hero + LiveDemoWidget + demo API routes
- 49482083 feat(126-04): body sections warm amber refresh
- 14308c6b feat(126-05): sub-pages warm amber theme

### Next

- Create SUMMARY.md + metadata commit
- Create Linear issue SYN-409
- Update STATE.md
