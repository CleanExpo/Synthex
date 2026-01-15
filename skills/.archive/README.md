# Archived Skills

**Archived Date:** 2025-01-06
**Reason:** Unite-Group AI Architecture Upgrade (Phase 5)

---

## What Happened

These skill files were archived as part of the Unite-Group AI Architecture upgrade. All skills have been migrated to the new `.skill.md` format with enhanced YAML frontmatter and Australian context.

## Archived Files (27 total)

### Old Format (without .skill.md extension)

These files used the old naming convention without the `.skill.md` extension. They have been replaced with new files in the proper format.

**Migrated to New Format:**
- `core/VERIFICATION.md` → `../verification/verification-first.skill.md`
- `core/FOUNDATION-FIRST.md` → `../design/foundation-first.skill.md`
- `core/ERROR-HANDLING.md` → `../verification/error-handling.skill.md`
- `backend/ADVANCED-TOOL-USE.md` → `../backend/advanced-tool-use.skill.md`
- `backend/LANGGRAPH.md` → `../backend/langgraph.skill.md`
- `backend/FASTAPI.md` → `../backend/fastapi.skill.md`
- `frontend/NEXTJS.md` → `../frontend/nextjs.skill.md`
- `database/SUPABASE.md` → `../database/supabase.skill.md`
- `database/MIGRATIONS.md` → `../database/migrations.skill.md`

**Replaced with New Skills:**
- Old generic skills → New specialized skills with Australian context
- Old flat structure → New categorized structure (australian/, design/, verification/, etc.)

## Key Improvements in New Format

### 1. YAML Frontmatter
```yaml
---
name: skill-name
category: category-name  # NEW: Categorization
version: 2.0.0
description: Enhanced description
priority: 1
auto_load: true  # NEW: Auto-loading capability
---
```

### 2. Australian Context
All new skills include Australian defaults:
- Language: en-AU (colour, organisation, licence)
- Date format: DD/MM/YYYY
- Currency: AUD with GST (10%)
- Phone numbers: 04XX XXX XXX
- Regulations: Privacy Act 1988, WCAG 2.1 AA

### 3. Categorization
Skills are now organized by category:
- `australian/` - Australian context, GEO
- `verification/` - Verification, truth-finding, error handling
- `design/` - Design system, foundation-first
- `context/` - Orchestration, project context
- `search-dominance/` - SEO, Blue Ocean, ranking
- `backend/` - FastAPI, LangGraph, tool use
- `frontend/` - Next.js, components
- `database/` - Supabase, migrations
- `workflow/` - Feature development, bug fixing

### 4. Enhanced Features
- Truth Finder integration for content verification
- SEO Intelligence for Australian market
- 2025-2026 design system (NO Lucide icons)
- Hook integration (pre-response, pre-publish, pre-deploy)
- Agent routing (orchestrator → specialists)

## Can I Use Archived Files?

**No - use the new .skill.md files instead.**

The archived files are kept for reference only. All functionality has been migrated and enhanced in the new format. See `../INDEX.md` for the complete skill catalog.

## Migration Summary

**Before Upgrade:**
- 27 skill files in old format
- Flat directory structure
- Generic content
- No Australian context
- No categorization

**After Upgrade:**
- 20 skill files in new `.skill.md` format
- Categorized structure (8 categories)
- Australian-first content
- Enhanced YAML frontmatter
- Auto-loading capabilities
- 4,603 total lines of documentation

---

🦘 **Australian-first. Truth-first. SEO-dominant.**

For current skills, see `../INDEX.md`
