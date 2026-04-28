# Prisma model additions to match Supabase migration `20260429000001_syn822_834_833_aeo_nrpg_dr_sms.sql`

After applying the SQL in Supabase, append these models to `prisma/schema.prisma` then run `npx prisma generate`.

**Order:** copy-paste in the order shown (some models reference earlier ones via `@relation`).

**Per CLAUDE.md / MEMORY.md feedback rule:** do NOT use `npx prisma db push` to sync these — the SQL has already created the tables. Just add the models to the schema and regenerate the client so TypeScript knows about them. The DB is already in sync.

---

## SYN-834 models

```prisma
// =============================================================================
// SYN-834 — NRPG → DR dynamic service-area expansion
// SQL migration: supabase/migrations/20260429000001_syn822_834_833_aeo_nrpg_dr_sms.sql
// =============================================================================

model ContractorOnboardingEvent {
  id                              String    @id @default(uuid()) @db.Uuid
  sourceOfTruthJobId              String    @unique @map("source_of_truth_job_id")
  contractorId                    String    @map("contractor_id")
  brand                           String    // 'NRPG' only
  baseLat                         Float     @map("base_lat")
  baseLng                         Float     @map("base_lng")
  addressHash                     String    @map("address_hash")
  radiusKm                        Int       @map("radius_km")
  serviceCategories               String[]  @map("service_categories")
  paymentConfirmedAt              DateTime  @map("payment_confirmed_at") @db.Timestamptz(6)
  consentForServiceAreaListing    Boolean   @map("consent_for_service_area_listing")
  expectedSuburbCount             Int?      @map("expected_suburb_count")
  expectedMonthlyBudgetAud        Decimal?  @map("expected_monthly_budget_aud") @db.Decimal(10, 2)
  emittedAt                       DateTime  @default(now()) @map("emitted_at") @db.Timestamptz(6)
  createdAt                       DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  serviceAreaCoverages            ServiceAreaCoverage[]
  serviceAreaCoverageContractors  ServiceAreaCoverageContractor[]
  locationBudgetLedgers           LocationBudgetLedger[]
  landingPagesGenerated           LandingPageGenerated[]

  @@index([contractorId])
  @@index([emittedAt(sort: Desc)])
  @@map("contractor_onboarding_event")
}

model ServiceAreaCoverage {
  id                          String    @id @default(uuid()) @db.Uuid
  brand                       String    @default("DR")
  postcode                    String
  suburb                      String
  state                       String
  openedByContractorId        String    @map("opened_by_contractor_id")
  openedAt                    DateTime  @default(now()) @map("opened_at") @db.Timestamptz(6)
  closedAt                    DateTime? @map("closed_at") @db.Timestamptz(6)
  status                      String    @default("active")
  gbpUpdatedAt                DateTime? @map("gbp_updated_at") @db.Timestamptz(6)
  bingUpdatedAt               DateTime? @map("bing_updated_at") @db.Timestamptz(6)
  sourceOfTruthJobId          String    @map("source_of_truth_job_id")
  createdAt                   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  contractorOnboardingEvent   ContractorOnboardingEvent @relation(fields: [sourceOfTruthJobId], references: [sourceOfTruthJobId])
  contractors                 ServiceAreaCoverageContractor[]
  locationBudgetLedgers       LocationBudgetLedger[]
  landingPagesGenerated       LandingPageGenerated[]
  locationKpis                LocationKpi[]

  @@unique([brand, postcode, suburb], map: "service_area_coverage_brand_postcode_suburb_unique")
  @@index([status, brand])
  @@index([openedAt(sort: Desc)])
  @@map("service_area_coverage")
}

model ServiceAreaCoverageContractor {
  serviceAreaCoverageId       String    @map("service_area_coverage_id") @db.Uuid
  contractorId                String    @map("contractor_id")
  sourceOfTruthJobId          String    @map("source_of_truth_job_id")
  addedAt                     DateTime  @default(now()) @map("added_at") @db.Timestamptz(6)
  removedAt                   DateTime? @map("removed_at") @db.Timestamptz(6)

  serviceAreaCoverage         ServiceAreaCoverage       @relation(fields: [serviceAreaCoverageId], references: [id], onDelete: Cascade)
  contractorOnboardingEvent   ContractorOnboardingEvent @relation(fields: [sourceOfTruthJobId], references: [sourceOfTruthJobId])

  @@id([serviceAreaCoverageId, contractorId])
  @@map("service_area_coverage_contractor")
}

model LocationBudgetLedger {
  id                          String    @id @default(uuid()) @db.Uuid
  serviceAreaCoverageId       String    @map("service_area_coverage_id") @db.Uuid
  sourceOfTruthJobId          String    @map("source_of_truth_job_id")
  contractorId                String    @map("contractor_id")
  postcode                    String
  suburb                      String
  monthlyAmountAud            Decimal   @default(55.00) @map("monthly_amount_aud") @db.Decimal(10, 2)
  openedAt                    DateTime  @default(now()) @map("opened_at") @db.Timestamptz(6)
  pausedAt                    DateTime? @map("paused_at") @db.Timestamptz(6)
  pausedReason                String?   @map("paused_reason")
  closedAt                    DateTime? @map("closed_at") @db.Timestamptz(6)
  status                      String    @default("active")
  createdAt                   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  serviceAreaCoverage         ServiceAreaCoverage       @relation(fields: [serviceAreaCoverageId], references: [id])
  contractorOnboardingEvent   ContractorOnboardingEvent @relation(fields: [sourceOfTruthJobId], references: [sourceOfTruthJobId])

  @@index([status, openedAt(sort: Desc)])
  @@index([contractorId])
  @@map("location_budget_ledger")
}

model LandingPageGenerated {
  id                          String    @id @default(uuid()) @db.Uuid
  serviceAreaCoverageId       String    @map("service_area_coverage_id") @db.Uuid
  sourceOfTruthJobId          String    @map("source_of_truth_job_id")
  serviceCategory             String    @map("service_category")
  urlSlug                     String    @unique @map("url_slug")
  schemaValidatedAt           DateTime? @map("schema_validated_at") @db.Timestamptz(6)
  brandVoiceEnforcePassed     Boolean   @default(false) @map("brand_voice_enforce_passed")
  committedToRepoAt           DateTime? @map("committed_to_repo_at") @db.Timestamptz(6)
  deployedAt                  DateTime? @map("deployed_at") @db.Timestamptz(6)
  createdAt                   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  serviceAreaCoverage         ServiceAreaCoverage       @relation(fields: [serviceAreaCoverageId], references: [id])
  contractorOnboardingEvent   ContractorOnboardingEvent @relation(fields: [sourceOfTruthJobId], references: [sourceOfTruthJobId])

  @@index([committedToRepoAt(sort: Desc)])
  @@map("landing_page_generated")
}

model LocationKpi {
  id                          String    @id @default(uuid()) @db.Uuid
  serviceAreaCoverageId       String    @map("service_area_coverage_id") @db.Uuid
  measuredAt                  DateTime  @default(now()) @map("measured_at") @db.Timestamptz(6)
  periodDays                  Int       @map("period_days") // 7 / 30 / 90
  impressions                 Int       @default(0)
  clicks                      Int       @default(0)
  conversions                 Int       @default(0)
  revenueAud                  Decimal   @default(0) @map("revenue_aud") @db.Decimal(10, 2)
  verificationState           String    @default("directional") @map("verification_state")
  verifiedAt                  DateTime? @map("verified_at") @db.Timestamptz(6)
  createdAt                   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  serviceAreaCoverage         ServiceAreaCoverage @relation(fields: [serviceAreaCoverageId], references: [id])

  @@index([serviceAreaCoverageId, measuredAt(sort: Desc)])
  @@map("location_kpi")
}
```

## SYN-833 model

```prisma
// =============================================================================
// SYN-833 — SMS provider audit trail
// SQL migration: supabase/migrations/20260429000001_syn822_834_833_aeo_nrpg_dr_sms.sql
// =============================================================================

model SmsSendAudit {
  id                          String    @id @default(uuid()) @db.Uuid
  sourceOfTruthJobId          String    @map("source_of_truth_job_id")
  brand                       String    // DR / NRPG / RestoreAssist / CARSI / CCW
  provider                    String    // 'twilio' / 'vonage' / etc.
  providerMessageId           String?   @map("provider_message_id")
  recipientHash               String    @map("recipient_hash") // sha256[0:12], NEVER raw phone
  bodyLength                  Int?      @map("body_length")    // length only, body never stored
  status                      String    // 'queued' / 'sent' / 'delivered' / 'failed'
  httpStatus                  Int?      @map("http_status")
  errorMessage                String?   @map("error_message")
  sentAt                      DateTime  @default(now()) @map("sent_at") @db.Timestamptz(6)
  deliveredAt                 DateTime? @map("delivered_at") @db.Timestamptz(6)
  createdAt                   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  @@index([sourceOfTruthJobId])
  @@index([brand, sentAt(sort: Desc)])
  @@index([status])
  @@map("sms_send_audit")
}
```

## SYN-822 model

```prisma
// =============================================================================
// SYN-822 / SYN-832 — Verification gate audit trail
// SQL migration: supabase/migrations/20260429000001_syn822_834_833_aeo_nrpg_dr_sms.sql
// =============================================================================

model VerificationGateAudit {
  id                          String    @id @default(uuid()) @db.Uuid
  gateId                      String    @map("gate_id") // 'VG-04' / 'VG-AEO-3' / etc.
  brand                       String?   // nullable; some gates are global
  previousState               String    @map("previous_state")
  newState                    String    @map("new_state")
  sourceDocReference          String?   @map("source_doc_reference")
  ceoConfirmationRecorded     Boolean   @default(false) @map("ceo_confirmation_recorded")
  changedBy                   String    @map("changed_by")
  reasoning                   String?
  changedAt                   DateTime  @default(now()) @map("changed_at") @db.Timestamptz(6)

  @@index([gateId, changedAt(sort: Desc)])
  @@map("verification_gate_audit")
}
```

---

## Apply order (CEO procedure)

1. **Open Supabase SQL editor** for project `joiswghkfvfevbowtanp` (or whichever is current Synthex prod — see [reference_synthex_db memory](file:///C:/Users/Disaster%20Recovery%204/.claude/projects/D--Synthex/memory/reference_synthex_db.md))
2. **Paste + run** `supabase/migrations/20260429000001_syn822_834_833_aeo_nrpg_dr_sms.sql`
3. **Run the verification queries** at the bottom of the SQL file. Expect 8 tables, 16 RLS policies, 8+ FKs.
4. **Append the Prisma models** above to `prisma/schema.prisma`
5. **Regenerate the Prisma client:** `npx prisma generate`
6. **Run pre-PR gate:** `npm run type-check && npm run lint && npm test`
7. **Commit + PR** with the schema additions
8. Linear update: SYN-832 (foundation-keeper VG-AEO-1..4) — record verification_gate_audit table now exists; gate state changes flow through it from this point on

## Rollback (in case anything goes sideways)

The SQL file ships with a rollback block at the bottom. Run inside `BEGIN; ... COMMIT;` to drop all 8 tables in dependency order. Data loss is total for these tables — confirm before running.

## Linear

- **Parent:** SYN-822 + SYN-833 + SYN-834
- **Affects:** SYN-832 (foundation-keeper VG audit) · SYN-836 (event emitter — has the persistence layer it needs) · SYN-837..843 (all NRPG-DR children — their persistence layer is now ready) · SYN-AEO-9 (post-job SMS rollout — sms_send_audit available)
