# B1 — Identity Resolution Layer (L1)

> **Status:** Scoping only (SYN-812). Implementation is a separate ~2-week
> engineering epic gated on the prerequisites below.

## Scope

Unified customer record across the four nested Unite-Group brands:

- **DR** (Disaster Recovery)
- **NRPG** (National Restoration Professionals Group)
- **RA** (RestoreAssist)
- **CARSI** (Cleaning and Restoration Specialists Australia)

external client (Cleaning Care Warehouse) is **strictly excluded** per Phase 3.4 carve-out
(L1 isolation rule). Any cross-brand match logic must short-circuit when external client
data is on either side of the join.

Match logic must support cross-brand identification specifically for the
pooled frequency cap (Q2.5.3) — NOT for marketing reuse without consent.

## Foundation references

- Q2.5.4 — 9-layer infrastructure split (this is L1)
- Phase 3.4 — external client carve-out
- Q3.2.5 — P16 Right-to-Be-Forgotten with de-identified retention
- P10 — never store raw PII when a hash will do (recipient_hash pattern, see
  `sms_send_audit` table)
- VG-71 — external client client agreement (must be in place before pooling works)

## Schema

Single canonical table `identity_records` with:

- `id` — server-generated, never an external ID
- `email_hash` — SHA-256(email + per-tenant salt) for matching
- `phone_hash` — SHA-256(E.164 phone + per-tenant salt) for matching
- `brand_codes` — `text[]` of brand IDs the identity has touched (DR, NRPG, RA, CARSI)
- `last_touch_at` — for frequency cap windowing
- `consent_state` — `JSONB` per brand: `{ marketing: bool, transactional: bool, deleted_at: timestamptz | null }`
- `created_at` / `updated_at`

**Hard rule:** raw email and raw phone are never stored. Salt is rotated
quarterly; rotation requires re-hashing all rows offline.

## Cross-brand match logic

A match fires when:

1. `email_hash` exact match across brands, OR
2. `phone_hash` exact match across brands, AND
3. Neither side has `consent_state.deleted_at` set

When match fires, the existing `identity_records` row's `brand_codes` is
extended (set union); no row is created. P16 deletion path: setting
`consent_state.deleted_at` on a brand removes that brand from `brand_codes`
on next match attempt; if `brand_codes` is empty after removal, the row
itself is `DELETE`d.

## Privacy boundary enforcement

- **PII protection:** raw values never persisted. Hashing happens at the
  edge (Edge Function or App Router middleware) — application code never
  sees the unhashed value after the request boundary.
- **NDB process:** any breach of `identity_records.email_hash` or
  `phone_hash` is a Notifiable Data Breach. Incident runbook must include
  salt rotation as the first containment action.
- **external client isolation:** match logic checks `brand_codes` against a hard-coded
  exclusion list (`['external-client']` initially) and short-circuits before any join.

## Smoke test plan

1. Create two `identity_records` rows with same `email_hash`, different
   `brand_codes` → match logic should merge to one row.
2. Set `consent_state.deleted_at` on one brand → that brand drops from
   `brand_codes` on next match.
3. Set `consent_state.deleted_at` on all brands → row is hard-deleted.
4. Insert a external client-flagged record adjacent to a DR record with same hash →
   match logic must NOT merge them.
5. Rotate the salt → re-hash existing rows → matches that worked
   pre-rotation must still work post-rotation.

## CEO action items (must clear before engineering starts)

- [ ] external client agreement (VG-71) signed, with explicit identity-isolation clause
- [ ] Per-tenant salt provisioning policy approved (where stored, who can rotate)
- [ ] P16 deletion SLA defined (currently informal; needs hard hours-to-deletion target for legal)
- [ ] Confirm `recipient_hash` pattern in `sms_send_audit` is the canonical
      hashing approach to follow (or call out the divergence)

## Out of scope

- Marketing reuse of identity data — explicitly forbidden per P6
- Cross-brand identity for analytics other than frequency cap — different epic
- external client integration of any kind — see Phase 3.4 carve-out
