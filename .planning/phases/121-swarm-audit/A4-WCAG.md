# A4 — WCAG & Contrast Audit

Generated: 2026-03-18
Agent: A4 (web-design-guidelines)
Phase-119 baseline: CONTRAST-01 through CONTRAST-11 (5 critical, 3 high, 9 medium)

---

## Phase-119 Baseline Finding Status

### CONTRAST-01 → Phase-119 FINDING-008

```
[A4-FINDING-001] MEDIUM
Status: CONFIRMED-RESOLVED (partial — improved but not fully passing)
Phase-119 ref: FINDING-008 (CONTRAST-01)
File: components/ui/prompt-input.tsx:132
Issue: Placeholder was changed from text-white/30 to text-white/50 (~3.0:1 contrast ratio); passes WCAG AA for large text (3:1) but still fails for normal-size 14px (text-sm) text which requires 4.5:1.
Fix: Raise to text-white/70 (~4.6:1) to achieve full WCAG AA compliance for all text sizes.
Linear: CREATE-NEW
```

**Detail:** Phase 120 Sprint 1c fix is confirmed applied (value is `/50`). However `/50` ≈ 3.0:1 which passes WCAG AA only for large text (18px+ or 14px+ bold). The placeholder renders at `text-sm` (14px regular weight), so the 4.5:1 threshold applies. Marked MEDIUM rather than CRITICAL because the improvement from `/30` is meaningful; the remaining gap is partial.

---

### CONTRAST-02 → Phase-119 FINDING-009

```
[A4-FINDING-002] CRITICAL
Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-009 (CONTRAST-02)
File: components/dashboard/tabs/analytics-tab.tsx:37
Issue: "Chart visualisation connected to backend" helper text is still text-white/15 (~1.2:1 contrast ratio). Functionally invisible on any dark background. No change from Phase-119 baseline.
Fix: Change text-white/15 to text-white/70 (~4.6:1).
Linear: CREATE-NEW
```

**Additional note:** The same file contains a `BarChart3` icon on line 35 at `text-white/10` (≈1.1:1) and "Engagement Over Time" on line 36 at `text-white/30` (≈2.1:1). Both were not captured in Phase-119; see NEW findings section below.

---

### CONTRAST-03 → Phase-119 FINDING-010

```
[A4-FINDING-003] CRITICAL
Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-010 (CONTRAST-03)
File: components/dashboard/SystemPulsePanel.tsx:279
Issue: "auto-refreshes every 30s" informational label is still text-white/15 at text-[9px] (~1.2:1 contrast ratio). Unchanged from Phase-119 baseline.
Fix: Change text-white/15 to text-white/50 minimum; text-white/70 preferred.
Linear: CREATE-NEW
```

---

### CONTRAST-04 → Phase-119 FINDING-011

```
[A4-FINDING-004] CRITICAL
Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-011 (CONTRAST-04)
File: components/dashboard/UniteHubWidget.tsx:136
Issue: "(configure in Unite-Group)" hint text span is still text-white/15 (~1.2:1 contrast ratio). Unchanged from Phase-119 baseline.
Fix: Change text-white/15 to text-white/50.
Linear: CREATE-NEW
```

---

### CONTRAST-05 → Phase-119 FINDING-012

```
[A4-FINDING-005] CRITICAL
Status: CONFIRMED-OPEN (note: the element is an SVG circle stroke, not readable text)
Phase-119 ref: FINDING-012 (CONTRAST-05)
File: components/research/SASScore.tsx:110
Issue: SVG circle element uses text-white/10 as its currentColor stroke (~1.1:1). This is the background track ring of the score dial — it is a non-text UI component and falls under WCAG SC 1.4.11 Non-text Contrast (3:1 minimum for UI components). Still at /10, unchanged.
Fix: Change text-white/10 to text-white/30 minimum for the track ring (decorative track; consider text-white/20 with context that it is intentionally recessive, but /30 is safer).
Linear: CREATE-NEW
```

**Reclassification note:** Phase-119 classified this as a text contrast issue. After reviewing the code, `text-white/10` applies to an SVG `<circle>` element (the background track ring). The correct WCAG criterion is SC 1.4.11 Non-text Contrast (3:1). A track ring that is intentionally low-contrast to let the progress arc stand out is common design practice, but at 1.1:1 it is invisible. `/30` (≈2.1:1) is still a fail; the minimum compliant value is `/45` (≈2.8:1, borderline) or `/50` (≈3.0:1, passes SC 1.4.11).

---

### CONTRAST-06 → Phase-119 FINDING-029

```
[A4-FINDING-006] CRITICAL
Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-029 (CONTRAST-06)
File: app/dashboard/layout.tsx:577
Issue: Global search bar placeholder is still placeholder:text-white/20 (~1.5:1 contrast ratio). Present on every dashboard page. Unchanged from Phase-119 baseline.
Fix: Change placeholder:text-white/20 to placeholder:text-white/50 (~3.0:1, passes large-text AA) or placeholder:text-white/70 (~4.6:1, full AA).
Linear: CREATE-NEW
```

---

### CONTRAST-07/08 → Phase-119 FINDING-030

```
[A4-FINDING-007] HIGH
Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-030 (CONTRAST-07 + CONTRAST-08)
File: app/dashboard/competitors/page.tsx:344,354,364,374,384; app/dashboard/seo/audit/page.tsx:393
Issue: Five competitor analysis inputs still use placeholder:text-white/25 (~1.8:1); the SEO audit input uses placeholder:text-white/25 (~1.8:1). All unchanged from Phase-119 baseline.
Fix: Change placeholder:text-white/25 to placeholder:text-white/50 on all six inputs.
Linear: CREATE-NEW
```

---

### CONTRAST-09 → Phase-119 FINDING-031

```
[A4-FINDING-008] HIGH
Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-031 (CONTRAST-09)
File: components/ui/button.tsx:20
Issue: Ghost button variant default text is still text-white/40 (~2.5:1 contrast ratio). Affects every ghost button instance codebase-wide. Unchanged from Phase-119 baseline.
Fix: Change text-white/40 to text-white/60 (~3.8:1, passes large-text AA; preferred: text-white/70 for full AA).
Linear: CREATE-NEW
```

---

### CONTRAST-10 → Phase-119 FINDING-032

```
[A4-FINDING-009] MEDIUM
Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-032 (CONTRAST-10)
File: components/ui/button.tsx:16 (outline), :18 (secondary)
Issue: Both outline and secondary variants use text-white/50 (~3.0:1 contrast ratio). Passes WCAG AA for large text but fails for normal text (text-xs, 12px). Unchanged from Phase-119 baseline.
Fix: Change text-white/50 to text-white/70 (~4.6:1) on both variants.
Linear: CREATE-NEW
```

---

### CONTRAST-11 → Phase-119 FINDING-033

```
[A4-FINDING-010] HIGH
Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-033 (CONTRAST-11)
File: components/dashboard/SidebarGroup.tsx:61,68,73,102
Issue: Inactive sidebar navigation group headers still use text-white/20 (~1.5:1) at line 61; inactive group icons at text-white/20 (line 68, 73, 102). Active items correctly use text-white/50 or text-cyan-400/60. Unchanged from Phase-119 baseline.
Fix: Change inactive text-white/20 to text-white/40 for icons (SC 1.4.11 non-text, 3:1 min) and text-white/50 for labels (text contrast). Note: line 95 item labels already use text-white/40 (hover) and are acceptable.
Linear: CREATE-NEW
```

---

## New Findings from Phase-121 Scan (Step 10)

The following violations were not in the Phase-119 CONTRAST baseline.

---

### analytics-tab.tsx — additional violations at the same location as CONTRAST-02

```
[A4-FINDING-011] CRITICAL
Status: NEW
Phase-119 ref: N/A
File: components/dashboard/tabs/analytics-tab.tsx:35
Issue: BarChart3 placeholder icon uses text-white/10 (~1.1:1); a UI component icon inside an empty-state panel. Fails WCAG SC 1.4.11 (3:1 for non-text UI components).
Fix: Change text-white/10 to text-white/40 (~2.5:1 — borderline for SC 1.4.11) or text-white/50 for safe compliance.
Linear: CREATE-NEW
```

```
[A4-FINDING-012] HIGH
Status: NEW
Phase-119 ref: N/A
File: components/dashboard/tabs/analytics-tab.tsx:36
Issue: "Engagement Over Time" chart label uses text-white/30 (text-xs, ~2.1:1 contrast ratio). This is a visible content label, not decorative. Fails WCAG AA 4.5:1 for normal text.
Fix: Change text-white/30 to text-white/70 (~4.6:1).
Linear: CREATE-NEW
```

---

### prompt-input.tsx — additional low-contrast elements

```
[A4-FINDING-013] HIGH
Status: NEW
Phase-119 ref: N/A
File: components/ui/prompt-input.tsx:168
Issue: "Shift+Enter for new line" keyboard hint text uses text-white/20 at text-[10px] (~1.5:1 contrast ratio). Although hidden on small screens, it is visible on sm+ breakpoints and is actionable guidance text.
Fix: Change text-white/20 to text-white/50 (~3.0:1) or text-white/60 (~3.7:1).
Linear: CREATE-NEW
```

```
[A4-FINDING-014] HIGH
Status: NEW
Phase-119 ref: N/A
File: components/ui/prompt-input.tsx:158
Issue: Attach-file icon button uses text-white/40 (~2.5:1) in its default state. Consistent with ghost button variant but the icon is an interactive control — WCAG SC 1.4.11 requires 3:1 for interactive UI components (non-text contrast).
Fix: Raise to text-white/50 or apply the same fix as the ghost button variant (FINDING-008).
Linear: CREATE-NEW
```

---

### QuickPostModal.tsx — placeholder and character counter

```
[A4-FINDING-015] HIGH
Status: NEW
Phase-119 ref: N/A
File: components/dashboard/QuickPostModal.tsx:203
Issue: Quick-post textarea uses placeholder:text-white/30 (~2.1:1 contrast ratio). The same class value as the original unfixed prompt-input placeholder from Phase-119.
Fix: Change placeholder:text-white/30 to placeholder:text-white/50.
Linear: CREATE-NEW
```

```
[A4-FINDING-016] HIGH
Status: NEW
Phase-119 ref: N/A
File: components/dashboard/QuickPostModal.tsx:206
Issue: Remaining character counter defaults to text-white/20 (~1.5:1) when not near limit. Text is informational and readable text at small size.
Fix: Change text-white/20 to text-white/50 for the default (non-warning) state.
Linear: CREATE-NEW
```

---

### SystemPulsePanel.tsx — additional low-contrast items beyond CONTRAST-03

```
[A4-FINDING-017] HIGH
Status: NEW
Phase-119 ref: N/A (FINDING-010 covers only line 279)
File: components/dashboard/SystemPulsePanel.tsx:178
Issue: Service URL text uses text-white/20 at font-mono text-[10px] (~1.5:1 contrast ratio). Displays actual endpoint URLs — user needs to read these values.
Fix: Change text-white/20 to text-white/50.
Linear: CREATE-NEW
```

```
[A4-FINDING-018] MEDIUM
Status: NEW
Phase-119 ref: N/A
File: components/dashboard/SystemPulsePanel.tsx:214
Issue: Service last-checked timestamp uses text-white/20 at text-[9px] font-mono (~1.5:1). Informational timestamp text.
Fix: Change text-white/20 to text-white/45.
Linear: CREATE-NEW
```

---

### UniteHubWidget.tsx — additional low-contrast items beyond CONTRAST-04

```
[A4-FINDING-019] HIGH
Status: NEW
Phase-119 ref: N/A (FINDING-011 covers only line 136)
File: components/dashboard/UniteHubWidget.tsx:199
Issue: "No events yet" / empty-state informational text at text-white/20 (~1.5:1). User-facing guidance text.
Fix: Change text-white/20 to text-white/50.
Linear: CREATE-NEW
```

---

### WelcomeCard.tsx — multiple low-contrast metadata labels

```
[A4-FINDING-020] HIGH
Status: NEW
Phase-119 ref: N/A
File: components/dashboard/WelcomeCard.tsx:337
Issue: "Re-run Analysis" and "Edit Settings" action links use text-white/30 (~2.1:1 contrast). These are interactive links — WCAG AA requires 4.5:1 for link text that is not underlined and not distinguished by colour alone.
Fix: Change text-white/30 to text-white/70 for interactive links.
Linear: CREATE-NEW
```

```
[A4-FINDING-021] HIGH
Status: NEW
Phase-119 ref: N/A
File: components/dashboard/WelcomeCard.tsx:337
Issue: The same file has text-white/20 at line 337 on an informational span in the footer. (~1.5:1 contrast).
Fix: Change text-white/20 to text-white/50.
Linear: CREATE-NEW
```

---

### get-started-checklist.tsx — action links and helper text

```
[A4-FINDING-022] HIGH
Status: NEW
Phase-119 ref: N/A
File: components/dashboard/get-started-checklist.tsx:303
Issue: "Dismiss" / action button text uses text-white/20 (~1.5:1 contrast ratio). Interactive action.
Fix: Change text-white/20 to text-white/50.
Linear: CREATE-NEW
```

---

### layout.tsx — additional low-contrast navigation items

```
[A4-FINDING-023] HIGH
Status: NEW
Phase-119 ref: N/A (FINDING-029 covers only the search placeholder; this is a different element)
File: app/dashboard/layout.tsx:537
Issue: Sidebar navigation links in the main (non-group) list use text-white/30 (~2.1:1 contrast ratio) as their default state. These are core navigation elements. The hover state raises to text-white/60 but default must also meet 4.5:1 for link text.
Fix: Change text-white/30 to text-white/60 as the default; text-white/80 on hover.
Linear: CREATE-NEW
```

```
[A4-FINDING-024] HIGH
Status: NEW
Phase-119 ref: N/A
File: app/dashboard/layout.tsx:490
Issue: The sidebar notification/action icon buttons use text-white/30 as default (~2.1:1). These are interactive controls. WCAG SC 1.4.11 requires 3:1 for UI component icons.
Fix: Change text-white/30 to text-white/50.
Linear: CREATE-NEW
```

---

### analytics-tab.tsx — additional items (line 44, 46)

```
[A4-FINDING-025] MEDIUM
Status: NEW
Phase-119 ref: N/A
File: components/dashboard/tabs/analytics-tab.tsx:44,46
Issue: "Platform Breakdown" section label at text-white/25 (~1.8:1) and "No platform data yet" empty-state text at text-white/25 (~1.8:1). Both are user-readable content.
Fix: Change text-white/25 to text-white/50 for section labels; text-white/60 for body text.
Linear: CREATE-NEW
```

---

### InsightsWidget.tsx

```
[A4-FINDING-026] MEDIUM
Status: NEW
Phase-119 ref: N/A
File: components/insights/InsightsWidget.tsx:137
Issue: "High-confidence opportunities are auto-drafted to your content queue." helper text uses text-white/30 (~2.1:1). User-readable guidance.
Fix: Change text-white/30 to text-white/60.
Linear: CREATE-NEW
```

---

### ContentSuggestionsWidget.tsx

```
[A4-FINDING-027] MEDIUM
Status: NEW
Phase-119 ref: N/A
File: components/dashboard/ContentSuggestionsWidget.tsx:110
Issue: Edit action button on content suggestions uses opacity-0/group-hover:opacity-100 transition with text-white/30 (~2.1:1). Visible only on hover but when visible it must meet contrast.
Fix: Change text-white/30 to text-white/60 on hover-visible actions.
Linear: CREATE-NEW
```

---

### platforms/page.tsx — disconnected platform state text

```
[A4-FINDING-028] MEDIUM
Status: NEW
Phase-119 ref: N/A
File: app/dashboard/platforms/page.tsx:167,188
Issue: Platform description text at text-white/25 (~1.8:1) and "not connected" state indicator text at text-white/25 (~1.8:1). These communicate platform status.
Fix: Change text-white/25 to text-white/50 for descriptive/status text.
Linear: CREATE-NEW
```

---

## Focus-Ring / Keyboard Navigation Note

```
[A4-FINDING-029] MEDIUM
Status: NEW
Phase-119 ref: N/A
File: components/ui/button.tsx:7 (focus-visible:ring-white/30)
Issue: Focus-visible ring uses ring-white/30 (~2.1:1 contrast against dark backgrounds). WCAG SC 1.4.11 and 2.4.11 (AA, WCAG 2.2) require focus indicator to have at least 3:1 contrast against adjacent colours. The ring at /30 fails this threshold.
Fix: Change focus-visible:ring-white/30 to focus-visible:ring-white/60 or focus-visible:ring-cyan-400/70.
Linear: CREATE-NEW
```

---

## Summary

### Phase-119 Baseline Findings (CONTRAST-01 through CONTRAST-11)

| Phase-119 ID                 | A4 Finding | Status                                                | Severity |
| ---------------------------- | ---------- | ----------------------------------------------------- | -------- |
| CONTRAST-01 (FINDING-008)    | A4-001     | CONFIRMED-RESOLVED (partial — still fails at text-sm) | MEDIUM   |
| CONTRAST-02 (FINDING-009)    | A4-002     | CONFIRMED-OPEN                                        | CRITICAL |
| CONTRAST-03 (FINDING-010)    | A4-003     | CONFIRMED-OPEN                                        | CRITICAL |
| CONTRAST-04 (FINDING-011)    | A4-004     | CONFIRMED-OPEN                                        | CRITICAL |
| CONTRAST-05 (FINDING-012)    | A4-005     | CONFIRMED-OPEN (reclassified as SC 1.4.11 non-text)   | CRITICAL |
| CONTRAST-06 (FINDING-029)    | A4-006     | CONFIRMED-OPEN                                        | CRITICAL |
| CONTRAST-07/08 (FINDING-030) | A4-007     | CONFIRMED-OPEN                                        | HIGH     |
| CONTRAST-09 (FINDING-031)    | A4-008     | CONFIRMED-OPEN                                        | HIGH     |
| CONTRAST-10 (FINDING-032)    | A4-009     | CONFIRMED-OPEN                                        | MEDIUM   |
| CONTRAST-11 (FINDING-033)    | A4-010     | CONFIRMED-OPEN                                        | HIGH     |

**Phase-119 contrast findings resolved: 0 of 11** (CONTRAST-01 improved but not fully compliant)

### New Findings from Phase-121 Scan

| Finding | File                                                    | Severity |
| ------- | ------------------------------------------------------- | -------- |
| A4-011  | analytics-tab.tsx:35 (icon text-white/10)               | CRITICAL |
| A4-012  | analytics-tab.tsx:36 (label text-white/30)              | HIGH     |
| A4-013  | prompt-input.tsx:168 (hint text-white/20)               | HIGH     |
| A4-014  | prompt-input.tsx:158 (icon button text-white/40)        | HIGH     |
| A4-015  | QuickPostModal.tsx:203 (placeholder:text-white/30)      | HIGH     |
| A4-016  | QuickPostModal.tsx:206 (counter text-white/20)          | HIGH     |
| A4-017  | SystemPulsePanel.tsx:178 (URL text-white/20)            | HIGH     |
| A4-018  | SystemPulsePanel.tsx:214 (timestamp text-white/20)      | MEDIUM   |
| A4-019  | UniteHubWidget.tsx:199 (empty state text-white/20)      | HIGH     |
| A4-020  | WelcomeCard.tsx:337 (links text-white/30)               | HIGH     |
| A4-021  | WelcomeCard.tsx:337 (footer text-white/20)              | HIGH     |
| A4-022  | get-started-checklist.tsx:303 (action text-white/20)    | HIGH     |
| A4-023  | layout.tsx:537 (nav links text-white/30)                | HIGH     |
| A4-024  | layout.tsx:490 (icon buttons text-white/30)             | HIGH     |
| A4-025  | analytics-tab.tsx:44,46 (labels text-white/25)          | MEDIUM   |
| A4-026  | InsightsWidget.tsx:137 (helper text text-white/30)      | MEDIUM   |
| A4-027  | ContentSuggestionsWidget.tsx:110 (action text-white/30) | MEDIUM   |
| A4-028  | platforms/page.tsx:167,188 (status text text-white/25)  | MEDIUM   |
| A4-029  | button.tsx:7 (focus ring ring-white/30)                 | MEDIUM   |

### Totals

| Category                              | Count                              |
| ------------------------------------- | ---------------------------------- |
| Phase-119 CRITICAL still open         | 5 (A4-002 through A4-006)          |
| Phase-119 HIGH still open             | 4 (A4-007, A4-008, A4-009, A4-010) |
| Phase-119 MEDIUM (partially resolved) | 1 (A4-001)                         |
| New CRITICAL                          | 1 (A4-011)                         |
| New HIGH                              | 13 (A4-012 through A4-024)         |
| New MEDIUM                            | 5 (A4-025 through A4-029)          |
| **Total open findings**               | **29**                             |

### Key Observations

1. **Zero Phase-119 contrast findings were fully remediated** by Phase-120 Sprint 1c. The only change detected was `prompt-input.tsx` placeholder from `/30` to `/50` — an improvement but not compliant.

2. **Systemic pattern:** The codebase uses `text-white/20` and `text-white/25` as the de-facto "muted text" style across dozens of components. These values (≈1.5:1 and ≈1.8:1) are critically non-compliant. A design-token refactor that replaces these with `/50`–`/60` values at the Tailwind config level would fix the majority of issues in one change.

3. **Button variants are a force multiplier:** The `ghost`, `outline`, and `secondary` variants in `button.tsx` plus the focus ring affect every interactive button in the application. Fixing these three lines fixes contrast for every button instance automatically.

4. **Navigation is the highest-impact area:** `layout.tsx` (sidebar nav) and `SidebarGroup.tsx` together control all primary navigation contrast. Both are CONFIRMED-OPEN and unaddressed since Phase-119.

5. **No WCAG 2.1 AA colour contrast violations were found in the landing pages** (`components/landing/`) beyond decorative text-reveal animation elements which use `/20` intentionally as a reveal effect.
