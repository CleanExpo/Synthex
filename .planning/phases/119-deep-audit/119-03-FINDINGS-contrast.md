# 119-03-FINDINGS-contrast.md — UI Contrast Audit

**Plan:** 119-03
**Date:** 2026-03-17
**Scope:** components/ui/, components/onboarding/, app/(auth)/, app/(onboarding)/, components/dashboard/, all addon/integration files

---

## Methodology

Automated grep scans across `components/` and `app/` for:

- `text-white/[0-29]` (near-transparent text)
- `placeholder:text-transparent` / `placeholder:text-white/[0-29]`
- `border-transparent` on interactive elements
- `bg-transparent` in input/form contexts
- `text-gray-500` / `text-gray-400` on dark backgrounds
- `text-red-400` on `bg-red-500/[10-20]` backgrounds
- `text-cyan-400` on `bg-cyan-500/[5-10]` backgrounds

Each hit was reviewed with surrounding context (3-5 lines) for severity classification.

---

## CRITICAL Findings

[CONTRAST-01] CRITICAL
File: components/ui/prompt-input.tsx:132
Element: placeholder
Class: placeholder:text-white/30
Issue: low-contrast — placeholder text on the main AI prompt textarea at 30% white opacity. On a `bg-transparent` textarea inside a dark glassmorphic container, 30% white over ~#0a1628 background yields approximately 1.8:1 contrast ratio. Fails WCAG AA (requires 4.5:1 for normal text, 3:1 for large text).
Fix: placeholder:text-white/50 (raises to approximately 3.5:1, passes large-text WCAG AA minimum)

[CONTRAST-02] CRITICAL
File: components/dashboard/tabs/analytics-tab.tsx:37
Element: label / informational text
Class: text-white/15
Issue: invisible — "Chart visualisation connected to backend" is rendered at 15% white opacity. On a dark surface (~#0a1628) this produces approximately 1.2:1 contrast ratio. Text is functionally invisible.
Fix: text-white/50 or text-white/40

[CONTRAST-03] CRITICAL
File: components/dashboard/SystemPulsePanel.tsx:279
Element: label
Class: text-white/15
Issue: invisible — "auto-refreshes every 30s" label rendered at 15% opacity. Approximately 1.2:1 contrast ratio. Functionally invisible.
Fix: text-white/40

[CONTRAST-04] CRITICAL
File: components/dashboard/UniteHubWidget.tsx:136
Element: label
Class: text-white/15
Issue: invisible — "(configure in Unite-Group)" helper text at 15% opacity. Approximately 1.2:1 contrast ratio. Functionally invisible.
Fix: text-white/40

[CONTRAST-05] CRITICAL
File: components/research/SASScore.tsx:110
Element: label/text
Class: text-white/10
Issue: invisible — text rendered at 10% white opacity. Approximately 1.1:1 contrast ratio. Completely invisible on dark background.
Fix: text-white/50

---

## HIGH Findings

[CONTRAST-06] HIGH
File: app/dashboard/layout.tsx:577
Element: placeholder
Class: placeholder:text-white/20
Issue: low-contrast — search bar placeholder in the main dashboard layout rendered at 20% opacity. Approximately 1.5:1 contrast ratio. Fails WCAG AA for normal and large text.
Fix: placeholder:text-white/40

[CONTRAST-07] HIGH
File: app/dashboard/competitors/page.tsx:344, 354, 364, 374, 384
Element: placeholder (5 input fields)
Class: placeholder:text-white/25
Issue: low-contrast — all 5 competitor analysis input placeholders at 25% opacity on bg-white/[0.03] dark background. Approximately 1.8:1 contrast ratio. Fails WCAG AA.
Fix: placeholder:text-white/45

[CONTRAST-08] HIGH
File: app/dashboard/seo/audit/page.tsx:393
Element: placeholder
Class: placeholder:text-white/25
Issue: low-contrast — SEO audit search input placeholder at 25% opacity. Same ~1.8:1 contrast. Fails WCAG AA.
Fix: placeholder:text-white/45

[CONTRAST-09] HIGH
File: components/ui/button.tsx:20
Element: button (ghost variant)
Class: text-white/40 (inactive state)
Issue: low-contrast — the `ghost` button variant uses `text-white/40` as its default state (40% opacity white). On dark backgrounds this is approximately 2.5:1 contrast ratio. Fails WCAG AA for normal text (4.5:1 required). Ghost buttons in forms and toolbars using this default state will be difficult to read. The hover state (text-white/70) is acceptable.
Fix: Raise ghost default text to text-white/60 (approximately 3.8:1, passes large-text AA)

[CONTRAST-10] HIGH
File: components/ui/button.tsx:16, 18 (outline and secondary variants)
Element: button (outline and secondary variants)
Class: text-white/50 (both variants)
Issue: low-contrast — outline and secondary button variants use text-white/50 as default text colour. On dark surface backgrounds (~#0a1628) this is approximately 3.1:1 contrast ratio. Fails WCAG AA for normal text (4.5:1), marginally passes large text (3:1). Given these are 12px (`text-xs`) buttons, they fail the large-text exception too.
Fix: Raise to text-white/70 (approximately 4.4:1) for both variants

[CONTRAST-11] HIGH
File: components/dashboard/SidebarGroup.tsx:61, 68, 73, 102
Element: icon / label (sidebar navigation inactive state)
Class: text-white/20 (inactive sidebar items and icons)
Issue: low-contrast — inactive sidebar navigation items and their icons use text-white/20 at 20% opacity. Navigation affordance requires at least 3:1 contrast per WCAG SC 1.4.11 (Non-text Contrast) for icons. At 20% opacity these are approximately 1.5:1.
Fix: Raise inactive sidebar items to text-white/40 for icons, text-white/50 for labels

[CONTRAST-12] HIGH
File: components/ui/toggle.tsx:17
Element: button (toggle inactive state)
Class: text-white/40
Issue: low-contrast — toggle buttons in inactive state use text-white/40, same concern as ghost button variant (approximately 2.5:1). Toggle interactive controls require 3:1 minimum per WCAG SC 1.4.11.
Fix: text-white/60

---

## MEDIUM Findings

[CONTRAST-13] MEDIUM
File: app/(auth)/login/page.tsx:326, 346, 361; app/(auth)/signup/page.tsx:453, 473, 493, 510, 543, 560
Element: icon (field icons in input fields)
Class: text-gray-500
Issue: low-contrast — input field prefix/suffix icons (Mail, Lock, Eye, User icons) use text-gray-500 (#6b7280) on dark glassmorphic card background (~#1e2d45). Approximate contrast ratio 2.8:1, which fails WCAG SC 1.4.11 Non-text Contrast (3:1 minimum for icons). Present on both login and signup pages — high-traffic critical user flow.
Fix: text-gray-400 (#9ca3af) which yields approximately 3.5:1 on dark backgrounds

[CONTRAST-14] MEDIUM
File: app/(auth)/login/page.tsx:333, 353; app/(auth)/signup/page.tsx:431, 460, 480, 503, 550
Element: placeholder
Class: placeholder:text-gray-500
Issue: low-contrast — all auth form input placeholders use text-gray-500 (#6b7280) on bg-white/5 dark surface. Approximately 2.8:1 contrast. Fails WCAG AA for normal text placeholders (4.5:1). Note: some accessibility guidance treats placeholders as supplementary, but they are the only visual hint for field purpose in unlabeled input contexts.
Fix: placeholder:text-gray-400 (#9ca3af) — approximately 3.5:1; acceptable under WCAG 2.1 SC 1.4.3 Note 1 (placeholders have lower bar if label is present)

[CONTRAST-15] MEDIUM
File: app/(onboarding)/onboarding/page.tsx:271, 288; app/(onboarding)/onboarding/review/page.tsx:495, 564, 684
Element: placeholder
Class: placeholder:text-gray-500
Issue: low-contrast — onboarding form input placeholders use text-gray-500 on bg-surface-dark/50. Same concern as CONTRAST-14. Onboarding is a first-use critical path.
Fix: placeholder:text-gray-400

[CONTRAST-16] MEDIUM
File: components/ui/form-field.tsx:136
Element: label (helper text)
Class: text-gray-500
Issue: low-contrast — form field helper text uses text-gray-500 on dark backgrounds. Approximately 2.8:1 contrast. Fails WCAG AA for normal text.
Fix: text-gray-400 (approximately 3.5:1)

[CONTRAST-17] MEDIUM
File: components/admin/audit-log-drawer.tsx:60, 65; components/admin/audit-log-viewer.tsx:97, 102; multiple other files (authority, affiliates, ai-pm, approval-workflow, benchmarks, awards, bayesian, etc.)
Element: badge / status indicator
Class: bg-red-500/20 text-red-400
Issue: low-contrast — red status badges use text-red-400 (#f87171) on bg-red-500/20 background. The effective background is a mix of red-500 at 20% opacity over dark (~#1a1025 approximate composite). text-red-400 on this computed background is approximately 2.9:1 — borderline, fails WCAG AA for normal text (4.5:1). Widespread pattern across 10+ components. Note: these are badge/tag elements, so the large-text threshold (3:1) is relevant only if font size is ≥18px/14px bold; most badges use text-xs (12px).
Fix: Use text-red-300 (#fca5a5) instead — approximately 4.2:1 on the dark/red-tinted composite, passes large text WCAG AA

[CONTRAST-18] MEDIUM
File: app/(onboarding)/onboarding/review/page.tsx:740
Element: badge
Class: bg-cyan-500/5 text-cyan-400
Issue: low-contrast — badge uses text-cyan-400 on bg-cyan-500/5 (5% opacity cyan background). The effective background is nearly identical to the dark surface. text-cyan-400 (#22d3ee) on #0a1628 base is approximately 6:1 which is acceptable — however the bg-cyan-500/5 provides almost no visual container distinction. The badge border (border-cyan-500/20) also has low visibility. The contrast of the text is acceptable but the badge shape/boundary is nearly invisible.
Fix: Raise background to bg-cyan-500/15 and border to border-cyan-500/40 for visible container

[CONTRAST-19] MEDIUM
File: components/ui/input.tsx:23 (subtle variant)
Element: input border (unfocused state)
Class: border-transparent
Issue: invisible-border — the `subtle` input variant has `border-transparent` in its unfocused state. Without a visible border, users cannot identify the input field boundaries until focus. On dark backgrounds where bg-muted/50 blends with the page, the input is visually indistinguishable. The focus state correctly shows the border.
Fix: Change to `border border-white/[0.08]` for the unfocused subtle variant, consistent with the glass variant

[CONTRAST-20] MEDIUM
File: components/dashboard/get-started-checklist.tsx:271
Element: button (text link)
Class: text-white/20
Issue: low-contrast — "View all" type text button link at 20% opacity. Approximately 1.5:1 contrast. Fails all WCAG text contrast thresholds.
Fix: text-white/50 (approximately 3.1:1)

[CONTRAST-21] MEDIUM
File: components/settings/billing-tab.tsx:81, 114
Element: label (section headers)
Class: text-white/25
Issue: low-contrast — "Included on free" and "Starter includes" section headers in billing tab at 25% opacity. These are content labels (not decorative), approximately 1.8:1 contrast.
Fix: text-white/50

---

## LOW Findings

[CONTRAST-22] LOW
File: components/dashboard/FirstWeekWidget.tsx:173, 177, 181, 206, 214, 239
Element: label (widget data labels)
Class: text-white/25
Issue: low-contrast — "Total", "Drafts", "Scheduled" and similar micro-labels in the first-week widget at 25% opacity. These are very small (9-10px) decorative labels, approximately 1.8:1 contrast. Intentional design aesthetic — low impact on core usability.
Fix: text-white/40 minimum if legibility is needed

[CONTRAST-23] LOW
File: components/ui/tabs.tsx:62 (underline variant)
Element: button (tab trigger inactive)
Class: border-transparent (inactive underline tab)
Issue: missing-border — the underline tab variant uses border-b-2 border-transparent for inactive tabs. This is the standard underline tab pattern and the tab label itself has text-white/70 which is visible. The border-transparent here is intentional design (no underline until active). Not an accessibility failure — the tab affordance is provided by text, not border alone.
Fix: No fix needed — pattern is intentional

[CONTRAST-24] LOW
File: components/ui/radio-group.tsx:40, 42 (checked state)
Element: input border (checked state)
Class: data-[state=checked]:border-transparent
Issue: invisible-border — radio items, when checked, lose their border (border-transparent). The checked state provides visual feedback through background gradient. Border-transparent on checked state removes the consistent outline affordance but the fill colour provides sufficient visual indication.
Fix: Consider data-[state=checked]:border-cyan-500/60 for additional clarity

[CONTRAST-25] LOW
File: components/dashboard/dashboard-header.tsx:21; components/dashboard/page-header.tsx:21
Element: label (page section superheadings)
Class: text-white/25
Issue: low-contrast — super-title labels above page headings (e.g. section category labels) at 25% opacity. Decorative context, approximately 1.8:1 contrast. Low impact on core usability.
Fix: text-white/40 if legibility is required

[CONTRAST-26] LOW
File: app/(auth)/login/page.tsx:259; app/(auth)/signup/page.tsx:292, 391
Element: label (card description text)
Class: text-gray-400
Issue: borderline-contrast — CardDescription uses text-gray-400 (#9ca3af) on dark card backgrounds. Approximately 3.5:1 contrast ratio. Passes WCAG AA for large text (3:1) but fails for normal text (4.5:1). Given these are body descriptions (14px regular weight), technically non-compliant under strict WCAG AA.
Fix: text-gray-300 (#d1d5db) — approximately 5.1:1, full WCAG AA compliance for normal text

[CONTRAST-27] LOW
File: components/ui/calendar.tsx:36, 48, 49
Element: label (calendar day labels, disabled/outside states)
Class: text-gray-400, text-gray-500 opacity-50
Issue: low-contrast — outside-month days use text-gray-500 opacity-50 — this stacks to ~1.4:1 on dark background. Intentional for "disabled" visual treatment but very low visibility. Disabled elements are exempt from WCAG 1.4.3 but the double-opacity stacking is extreme.
Fix: Use text-gray-600 opacity-100 instead of text-gray-500 opacity-50 (same visual result, avoids stacking opacity problems)

[CONTRAST-28] LOW
File: components/dashboard/tabs/overview-tab.tsx:78-79; components/dashboard/tabs/\* (multiple)
Element: label (tab section sub-labels)
Class: text-white/25
Issue: low-contrast — section sub-labels in dashboard tabs ("PLATFORM BREAKDOWN", "UPCOMING POSTS", etc.) at 25% opacity. Decorative uppercase tracking labels, approximately 1.8:1 contrast.
Fix: text-white/40 minimum for uppercase small labels (large-text exception at 14px bold may apply)

---

## Summary

| Severity  | Count  |
| --------- | ------ |
| CRITICAL  | 5      |
| HIGH      | 7      |
| MEDIUM    | 9      |
| LOW       | 7      |
| **Total** | **28** |
