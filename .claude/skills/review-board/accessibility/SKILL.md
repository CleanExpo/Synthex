# Accessibility Review Specialist

---
name: accessibility
description: WCAG 2.1 AA compliance — ARIA labels, contrast ratios, keyboard navigation, focus management
type: review-specialist
severity_levels: [CRITICAL, HIGH, MEDIUM, LOW]
confidence_threshold: 80
---

## Context

This specialist validates **WCAG 2.1 Level AA** accessibility compliance across Synthex UI code. The target is dashboard + app surfaces where end users (SME owners, their team members) interact with marketing campaigns, analytics, and AI content generation features.

Accessibility is not optional for Synthex because:
- Users managing campaigns may have visual, motor, or cognitive accessibility needs
- Regulatory exposure (AODA in Canada, DAA in Australia, WC3 WCAG 2.1 AA is best practice)
- Trust signal — accessible products are perceived as more professional and inclusive

**Synthex accessibility baseline:**
- Dark glassmorphic theme (base color `bg-[#0f172a]`)
- Radix UI components (come with ARIA built-in — do not flag Radix internals unless misused)
- Tailwind contrast utilities (updated in SYN-456: `gray-300` for body text on dark backgrounds = 7.24:1 minimum)
- Protected dashboard (AA target, not AAA)
- Interactive surfaces: buttons, form inputs, modals, dropdowns, tabs

**Do NOT flag as bugs:**
- Radix UI's internal ARIA structure (Radix follows WAI-ARIA spec by default)
- `aria-hidden="true"` on decorative icons inside buttons with accessible text
- Intentional focus styling customisations that meet 3:1 contrast minimum

---

## Severity Mapping

### CRITICAL
Interactive element with no accessible name (button without text/aria-label), form input without corresponding label element, color as the only visual indicator of required field.

**Impact:** Element is completely unusable via screen reader; form cannot be submitted accessibly.

**Confidence:** Always report if you can visually confirm the element exists.

### HIGH
- Missing `alt` on informational image (decorative images should have `alt=""`)
- Contrast below 4.5:1 (3:1 for large text >18pt regular or 14pt bold)
- Focus trap without visible escape mechanism (modal without close button)
- Interactive element responding only to click (no keyboard handler for button, link, or focusable div)
- Missing focus indicator (outline, ring, or underline visible at >=3:1 contrast when focused)
- Inconsistent tab order (jumping backward or skipping focusable elements)

**Impact:** Feature is inaccessible to keyboard-only users or users relying on screen readers.

**Confidence:** Report at 85%+.

### MEDIUM
- Missing skip-to-content link on main layout (should skip navigation to main content)
- Missing `aria-live="polite"` on dynamically updated content (status messages, error corrections)
- Broken heading hierarchy (jumping from `<h1>` to `<h3>`, missing page title `<h1>`)
- Form validation messages not announced to screen readers
- Missing `aria-label` on icon-only buttons (must have explicit text or label)
- Image with `alt` that doesn't describe content ("image", "chart", "picture")
- Keyboard focus lost after action (submitting form, opening modal)

**Impact:** Some content or functionality is less discoverable but still accessible via alternative navigation.

**Confidence:** Report at 80%+.

### LOW
- Redundant ARIA role on semantic element (`<button role="button">`)
- `title` attribute instead of `aria-label` (tooltips alone do not satisfy labelling requirement)
- Missing `aria-describedby` for complex form fields with additional help text
- Inconsistent icon labelling across similar components
- Generic button text ("Click here", "More") instead of descriptive action
- Missing lang attribute on page or language change sections

**Impact:** Navigation or understanding is slightly harder but accessible.

**Confidence:** Report at 80%+.

---

## Checklist

Before reporting a finding:

- [ ] Is this a real interactive element (button, link, form control, focusable div) or decorative?
- [ ] For images: Is it informational (flag missing alt) or decorative (alt="" is correct)?
- [ ] For contrast: Did I measure against the actual background colour in the current dark theme?
- [ ] For focus: Did I test keyboard navigation (Tab, Shift+Tab, Enter, Space)?
- [ ] For labels: Does the element have visible text, `aria-label`, or parent label?
- [ ] Is this a Radix UI component? (If yes, verify the issue is not Radix's responsibility — check [Radix docs](https://www.radix-ui.com/primitives/docs/guides/accessibility))
- [ ] Have I checked both light and dark theme if applicable? (Synthex: dark is primary)
- [ ] Is this a pre-existing accessibility issue (not introduced by this PR)?

---

## Output Format

```json
{
  "specialist": "accessibility",
  "tier": "standard",
  "duration_ms": 0,
  "findings": [
    {
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "confidence": 85,
      "file": "components/path/ComponentName.tsx",
      "line": 42,
      "issue": "Button with no accessible name or aria-label; screen reader sees unnamed button",
      "fix": "Add aria-label='Close modal' or wrap text inside the button element",
      "reference": "components/dashboard/modals/ExampleModal.tsx"
    }
  ],
  "summary": {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 0
  },
  "verdict": "PASS"
}
```

**Rules:**
- `file` is relative path from repo root
- `line` is best-effort (line where the inaccessible element lives)
- `confidence` must be ≥80 to include in findings
- `verdict` = "BLOCK" if any CRITICAL, else "PASS"
- Do not include low-confidence guesses

---

## Synthex-Specific Rules

### Dark Theme Contrast Checks
- **Body text** on `bg-[#0f172a]` = `text-gray-300` (7.24:1) ✓
- **Secondary text** = `text-gray-400` is only for muted labels (fails 4.5:1 on dark background — should not be on high-contrast elements)
- **Links** = `text-blue-400` (meets 4.5:1 on dark background)
- **Error text** = `text-red-400` (meets 4.5:1 on dark background)
- Test contrast using [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) with actual hex values

### Radix UI Components (Do Not Flag Radix Internals)
Radix UI (Select, Combobox, Dialog, AlertDialog, etc.) comes with built-in ARIA. Do not flag:
- Radix's internal `aria-expanded`, `aria-selected`, `aria-controls` management
- Radix's focus management within dialogs
- Radix's keyboard event handling for dropdowns and tabs

**DO flag:**
- Missing `aria-label` on a button that triggers a Radix component
- Radix Dialog opened without a trap focus (Radix Dialog traps focus by default — if missing, flag the wrapping component)
- Misused Radix props (e.g., disabling focus trap when not appropriate)

### Form Accessibility
- **Every input** must have an associated `<label htmlFor="fieldId">` or `aria-label`
- **SWR data fetching** error states must include `aria-live="polite"` announcements for form validation
- **Checkbox/radio groups** should have `<fieldset><legend>` or `role="group" aria-labelledby`

### Dashboard-Specific
- **Campaign list tables** should have accessible headers (`<th scope="col">`) and row announcements
- **Chart components** must include text alternative (not image-only) or detailed `aria-label`
- **Status indicators** (colour-coded badges) should include text label or icon in addition to colour

### Known Accessible Patterns in Synthex
- Campaign modals: `components/dashboard/modals/CampaignModal.tsx` (focus trap, close on Escape)
- Form validation: `lib/forms/validation.ts` (error announcement pattern)
- Button component: `components/ui/Button.tsx` (text or aria-label required)

### Excluded from Review
- Pre-existing accessibility issues (not introduced by this PR) — note as informational only
- Template or example components in `__tests__/fixtures/` — review actual production code
- Third-party embedded content (Stripe widgets, social embeds) — flag wrapper accessibility only

---

## Methodology

1. **Parse HTML structure** — identify interactive elements, form controls, images
2. **Check naming** — does each interactive element have visible text, `aria-label`, or `<label>`?
3. **Contrast validation** — compare text colour hex against background hex using WCAG AA formula
4. **Keyboard navigation** — trace Tab order, look for focus traps without escape, missing handlers
5. **ARIA correctness** — check for redundant roles, missing `aria-live` on dynamic updates
6. **Radix compliance** — verify that Radix components are used correctly (not overridden in ways that break accessibility)
7. **Report findings** — only include confidence ≥80%, map to severity, provide actionable fix

---

## Examples

### Example 1: CRITICAL — Button with no accessible name
```tsx
// ❌ FAIL
<button onClick={handleClose} className="absolute right-2 top-2">
  <XIcon />
</button>

// ✅ PASS
<button
  onClick={handleClose}
  className="absolute right-2 top-2"
  aria-label="Close dialog"
>
  <XIcon />
</button>
```

**Finding:**
- Severity: CRITICAL
- Issue: Button has no accessible name; screen reader announces "button" with no action
- Fix: Add `aria-label="Close dialog"`

### Example 2: HIGH — Missing contrast on text
```tsx
// ❌ FAIL (gray-400 on bg-[#0f172a] = 2.8:1)
<p className="text-gray-400">Required field indicator</p>

// ✅ PASS (gray-300 on dark = 7.24:1)
<p className="text-gray-300">
  <span className="text-red-400">*</span> Required field
</p>
```

**Finding:**
- Severity: HIGH
- Issue: Text contrast 2.8:1 fails WCAG AA (4.5:1 required)
- Fix: Use `text-gray-300` or reduce font to 18pt bold and use 3:1 minimum

### Example 3: MEDIUM — Missing aria-label on icon button
```tsx
// ❌ FAIL
<button className="p-2">
  <SettingsIcon />
</button>

// ✅ PASS
<button className="p-2" aria-label="Open settings">
  <SettingsIcon />
</button>
```

**Finding:**
- Severity: MEDIUM
- Issue: Icon-only button missing accessible label
- Fix: Add `aria-label="Open settings"`

### Example 4: LOW — Generic button text
```tsx
// ❌ FAIL
<button>Click here</button>

// ✅ PASS
<button>Start campaign creation</button>
```

**Finding:**
- Severity: LOW
- Issue: Generic button text is less descriptive for screen reader users
- Fix: Use action-specific text like "Start campaign creation"

---

## References

- [WCAG 2.1 Level AA Checklist](https://www.a11ycheatsheet.com/)
- [Radix UI Accessibility Guide](https://www.radix-ui.com/primitives/docs/guides/accessibility)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- Synthex reference: `components/dashboard/modals/ExampleModal.tsx` (accessible modal pattern)
