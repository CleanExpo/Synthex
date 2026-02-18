---
phase: 33-schema-markup-manager
plan: "01"
title: "Schema Markup Service + API Routes"
subsystem: seo
tags: [schema-markup, json-ld, validation, extraction, templates, rich-preview, api]
requires:
  - 30-01 # Technical SEO Dashboard (established SEO service patterns)
  - 32-01 # PageSpeed Integration (demo data fallback pattern, API route pattern)
provides:
  - Schema markup validation engine for 14 schema types
  - URL schema extraction with demo data fallback
  - Template library with 14 templates across 5 categories
  - Rich results preview generator for SERP display
  - 3 API routes (validate, extract, templates)
affects:
  - lib/seo/schema-markup-service.ts (new)
  - app/api/seo/schema-markup/validate/route.ts (new)
  - app/api/seo/schema-markup/extract/route.ts (new)
  - app/api/seo/schema-markup/templates/route.ts (new)
tech-stack: [Next.js 15, TypeScript, Zod]
key-files:
  - lib/seo/schema-markup-service.ts
  - app/api/seo/schema-markup/validate/route.ts
  - app/api/seo/schema-markup/extract/route.ts
  - app/api/seo/schema-markup/templates/route.ts
key-decisions:
  - Separate service from existing /api/seo/schema (generator vs validator/extractor)
  - VALIDATION_RULES record keyed by @type with required fields and type checks
  - Score formula 100 - (errors * 15) - (warnings * 5) with minimum 0
  - Demo data fallback for URL extraction with isDemo flag (consistent with pagespeed/search-console)
  - 14 templates across 5 categories (business, content, commerce, media, navigation)
  - Rich preview types match Google's actual rich result display formats
  - Templates endpoint is PUBLIC_READ (non-sensitive reference data)
duration: ~10 minutes
completed: 2026-02-18T18:00:00Z
---

# Phase 33 Plan 01: Schema Markup Service + API Routes Summary

**Built the Schema Markup Manager service layer with validation engine supporting 14 schema types, URL schema extraction with demo fallback, template library with 14 templates across 5 categories, rich results preview generation, and 3 API routes following established security patterns.**

## Performance

- **Duration**: ~10 minutes
- **Tasks**: 2 of 2 completed
- **Files**: 4 created, 0 modified

## Accomplishments

- Created `schema-markup-service.ts` with 4 exported functions: `validateSchema`, `extractSchemaFromUrl`, `getSchemaTemplates`, `generateRichPreview`
- Exported 6 types: `SchemaValidationResult`, `ValidationError`, `SchemaExtractionResult`, `ParsedSchema`, `SchemaTemplate`, `RichPreviewResult`
- Built validation engine with `VALIDATION_RULES` record covering all 14 schema types (Organization, LocalBusiness, Product, Article, BlogPosting, FAQ, HowTo, Event, Person, WebSite, BreadcrumbList, VideoObject, Review, Recipe)
- Validation checks: @context presence and value, @type presence, required fields per type, field type checks (string, url, date, number, array, object), scoring formula (100 - errors*15 - warnings*5)
- URL extraction fetches page HTML, parses `<script type="application/ld+json">` tags with regex, handles arrays of schemas, validates each parsed object, falls back to demo Organization + FAQ data on failure
- Template library provides 14 templates across 5 categories: business (Organization, LocalBusiness, Person), content (Article, BlogPosting, FAQ, HowTo), commerce (Product, Review), media (VideoObject, Recipe, Event), navigation (WebSite, BreadcrumbList)
- Rich preview generator covers 9 preview types (knowledge-panel, product-card, article, faq, event, video, recipe, review, generic) matching Google's actual SERP displays
- Created 3 API routes: POST `/api/seo/schema-markup/validate` (AUTHENTICATED_WRITE), POST `/api/seo/schema-markup/extract` (AUTHENTICATED_WRITE), GET `/api/seo/schema-markup/templates` (PUBLIC_READ)
- All paid routes require professional subscription plan with proper 402 response

## Task Commits

1. `feat(33-01): add schema markup validation service with templates and rich preview` (b65de3f)
2. `feat(33-01): add schema markup API routes for validate, extract, and templates` (dac750e)

## Files Created

- `lib/seo/schema-markup-service.ts` - Schema markup service with 4 functions, 6 exported types, validation rules for 14 types, demo data fallback, template library, rich preview generator
- `app/api/seo/schema-markup/validate/route.ts` - POST route for JSON-LD validation with Zod input validation
- `app/api/seo/schema-markup/extract/route.ts` - POST route for URL schema extraction with Zod URL validation
- `app/api/seo/schema-markup/templates/route.ts` - GET route for schema template library (public endpoint)

## Files Modified

None.

## Decisions Made

1. **Separate from existing schema API**: The existing `/api/seo/schema` route generates schemas from field data. This new service validates, extracts, and previews existing schemas - complementary but distinct functionality.
2. **VALIDATION_RULES pattern**: A flat record keyed by @type with field rules including required flag, expected type, and custom error messages. This makes adding new schema types straightforward.
3. **Score formula**: `100 - (errors * 15) - (warnings * 5)` with a floor of 0. Errors weigh 3x more than warnings, and a single error drops the score below "excellent" threshold.
4. **Demo data for extraction**: Consistent with the pagespeed and search-console fallback pattern. Returns realistic Organization + FAQ schemas with `isDemo: true` when URL fetch fails.
5. **Templates are PUBLIC_READ**: Templates are reference data (example JSON-LD structures), not user-generated content, so they don't require authentication.
6. **14 templates, not 14 types * N**: One template per type covers the most common use case. The FAQ template uses FAQPage @type in the fields (Google's preferred form) but the template type field says "FAQ" for consistency with the existing schema types list.

## Deviations from Plan

None. Both tasks completed as specified.

## Issues Encountered

None. Pre-existing TypeScript errors in `lib/prisma.ts` and `lib/video/capture-service.ts` are unrelated and documented in prior phase summaries.

## Next Phase Readiness

Phase 33 Plan 01 complete. Service layer and API routes are in place. Ready for Plan 02 (Hook + Enhanced Dashboard + Navigation).
