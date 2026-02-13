---
name: author-authority
description: >-
  Manages author profiles with verified credentials, builds cross-platform
  entity presence (Wikipedia, LinkedIn, YouTube mentions), generates Person
  schema markup, and tracks reputation signals. Implements the Verification
  and Reputation Signals pillar of GEO strategy. Use when creating author
  profiles, generating author schema, checking entity presence, or building
  author authority for E-E-A-T compliance.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: management-skill
  triggers:
    - author profile
    - author bio
    - credentials
    - expert author
    - author schema
    - reputation signals
    - entity presence
  requires:
    - .claude/skills/eeat-scorer
    - skills/search-dominance/authority-curator.skill.md
---

# Author Authority — Profile & Reputation Manager

## Purpose

Manage author profiles for E-E-A-T compliance. Build verifiable expert
identities with credentials, cross-platform entity presence (sameAs links),
Person schema markup, and reputation signal tracking. This implements
Pillar 3 (Verification & Reputation Signals) of the GEO strategy.

## When to Use

Activate this skill when:
- Creating or updating author profiles with credentials
- Generating Person + ProfilePage schema markup
- Checking cross-platform entity presence (Wikipedia, LinkedIn, YouTube)
- Building sameAs entity links for Schema.org
- Generating "About the Author" content blocks
- Linking authors to content for E-E-A-T attribution
- Monitoring author reputation signals

## When NOT to Use This Skill

- When scoring content quality (use eeat-scorer)
- When generating research reports (use research-report-engine)
- When doing local SEO work (use local-seo-generator)
- When creating content (use authority-curator)
- Instead use: `eeat-scorer` for scoring, `authority-curator` for content

## Instructions

1. **Create author profile** — Collect:
   - Full name, professional title
   - Bio (200-500 words, written in authority-curator voice)
   - Credentials: [{type, title, institution, year}]
   - Expertise areas (mapped to content topics)
   - Avatar/headshot URL
2. **Build entity links** — Collect and validate sameAs URLs:
   - LinkedIn profile
   - Twitter/X profile
   - YouTube channel (strongest AI citation signal per Ahrefs)
   - Google Scholar profile
   - Wikipedia/Wikidata entry
   - Industry association pages
3. **Generate Person schema** — JSON-LD with:
   - @type: Person
   - name, jobTitle, description
   - sameAs: [all validated URLs]
   - worksFor: Organization
   - alumniOf: Educational institutions
   - knowsAbout: Expertise areas
   - image: Avatar URL
4. **Generate ProfilePage schema** — JSON-LD with:
   - @type: ProfilePage
   - mainEntity: Person reference
   - dateCreated, dateModified
5. **Create author bio block** — HTML component with:
   - Avatar, name, title
   - Credential badges
   - Short bio (2-3 sentences)
   - Social links
   - "View full profile" link
6. **Check entity presence** — Query for:
   - Wikipedia mentions (47.9% of ChatGPT citations)
   - Reddit mentions (46.7% of Perplexity citations)
   - YouTube mentions (0.737 correlation with AI visibility)
   - LinkedIn mentions
7. **Score author E-E-A-T** — Via eeat-scorer, focused on author dimensions

## Input Specification

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | yes | Author full name |
| title | string | yes | Professional title |
| bio | string | yes | Author biography |
| credentials | array | no | [{type, title, institution, year}] |
| socialLinks | object | no | {linkedin, twitter, youtube, scholar, wikipedia} |
| expertiseAreas | array | no | Topic expertise list |

## Output Specification

| Field | Type | Description |
|-------|------|-------------|
| profile | object | Complete AuthorProfile data |
| personSchema | object | Person JSON-LD |
| profilePageSchema | object | ProfilePage JSON-LD |
| bioBlock | string | HTML author bio component |
| entityPresence | object | {wikipedia, reddit, youtube, linkedin} status |
| eeatScore | number | Author-specific E-E-A-T score |

## Error Handling

| Error | Action |
|-------|--------|
| Invalid social URL | Flag as unverified, continue without |
| No credentials provided | Warn about low expertise score, suggest adding |
| Duplicate slug | Auto-append number suffix |
| Wikipedia entity not found | Suggest creating Wikipedia entry as high-impact action |
