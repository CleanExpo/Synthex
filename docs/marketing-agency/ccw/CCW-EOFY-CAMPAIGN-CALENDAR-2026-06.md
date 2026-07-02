# CCW EOFY Campaign Calendar 2026-06

Source of truth: `/Users/phill-mac/Synthex-Brain-2/06-Brands/ccw/Campaign Calendar/CCW-EOFY-Sales-Acceleration-2026.md`

Live Synthex package: `/dashboard/marketing-agency/ccw-eofy`

Campaign: `CCW EOFY Sales Acceleration 2026`  
Slug: `ccw-eofy-sales-2026`  
Calendar status: scheduled drafts only. External publishing remains blocked until CCW submits social credentials and final approval is recorded.

## Application

Apply or re-apply the calendar to production:

```bash
npx dotenv -e .env.local -- npx tsx scripts/apply-ccw-eofy-campaign-calendar.ts
```

The script deletes prior CCW EOFY calendar drafts attached to the same campaign and recreates 19 calendar posts with:

- `status = draft`
- `campaignId = CCW EOFY Sales Acceleration 2026`
- `tags` including `ccw-eofy-sales-2026`
- `metadata.externalPublishBlocked = true`
- source URLs recorded in metadata for review

## Calendar Summary

The calendar runs from 3 June 2026 to 30 June 2026 across LinkedIn, Facebook, Instagram, and Reddit.

Primary campaign arc:

1. Audit the equipment stack.
2. Build a practical shortlist.
3. Check stock, pricing, and finance enquiry pathway.
4. Focus product posts on verified CCW product pages.
5. Use final-week urgency tied only to the real 30 June EOFY date.

## Guardrails

- No invented sitewide EOFY discount.
- No stock scarcity claim unless CCW confirms it in writing.
- No finance approval, rate, repayment, or tax claim.
- Reddit posts stay educational and community-safe.
- Approved CCW imagery only for live/paid use.
