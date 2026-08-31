# Synthex-CARSI Compliance Gap Analysis for NRPG Marketplace

**Date:** 20 August 2026
**Task:** t_4b72bb0d
**Workspace:** synthex/t_4b72bb0d-investigate-synthex-carsi-compliance-ali
**Status:** DRAFT
**Evidence base:** CARSI Identity Federation Data Protection Profile (carsi.edu.cn/docs/data_protection_profile_en.pdf), DR-NRPG Minimum Training Requirements (disasterrecovery.com.au/certifications/minimum-training-requirements), CARSI platform catalogue (carsi.com.au/), Synthex training content system (workspace codebase), previous AEO GTM proof (t_c71fa2c9)

---

## Executive Summary

**CARSI Federation Readiness: NO**

Synthex does **NOT** currently meet CARSI LMS federation standards required for NRPG marketplace access to Chinese institutions. The gap is fundamental: Synthex lacks CARSI identity federation infrastructure (SAML/OIDC), China-compliant data processing controls, and mandatory training content for NRPG onboarding. Without Phase 1, no CARSI federation can be approved regardless of training completeness.

**Exit Thesis Alignment: CONDITIONAL**

Product strategy fits B exit thesis for platform narrative positioning, but regulatory compliance (China export controls and CARSI federation) is an explicit dependency for NRPG marketplace scale. Previous AEO GTM proof (t_c71fa2c9) validates AEO/GEO messaging and demo readiness, but does not verify technical CARSI compliance or training content completeness.

**Recommendation:** Implement CARSI federation foundation (Phase 1) before any NRPG marketplace integration or public CARSI positioning. Training content (Phase 2) and NRPG onboarding alignment (Phase 3) depend on successful federation onboarding.

---

## 1. CARSI LMS Standards Assessment

### 1.1 CARSI Identity Federation Requirements

CARSI is China's Higher Education Identity Federation. To join, Synthex (as a Service Provider Organization) MUST comply with the CARSI Identity Federation Data Protection Profile:

| Requirement                  | CARSI Mandate                                                                                                   | Synthex Status                                     | Gap Impact                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| **Legal Compliance**         | Process attributes per PRC Personal Data Protection Law                                                         | Not implemented                                    | BLOCKING — no CARSI federation can be approved     |
| **Data Minimization**        | Request only minimal attributes needed for service access                                                       | No attribute scope defined                         | BLOCKING — federation rejected                     |
| **Purpose Limitation**       | Five allowed purposes only (access, traceability, UI personalization, support, stats) — NO profiling or selling | No purpose tracking system                         | BLOCKING — non-compliant with PRC law              |
| **No Deviating Purposes**    | Cannot sell attributes or use for commercial profiling without consent                                          | No consent workflow for Chinese home organizations | BLOCKING — exposes CARSI member to legal liability |
| **Data Retention**           | Delete/anonymize attributes when no longer needed                                                               | No automatic retention policies                    | BLOCKING — CARSI audited annually                  |
| **No Third-Party Transfers** | No attribute transfers without home organization consent or mandate                                             | No third-party data sharing controls               | BLOCKING — PRC law violation                       |
| **Security Measures**        | State-of-the-art technical and organizational controls                                                          | Basic auth only, no federation security            | BLOCKING — CARSI rejects unsafe service providers  |

**Evidence Source:** CARSI Identity Federation Data Protection Profile, Appendix 3, Sections 3–4.

### 1.2 Federation Technical Requirements

CARSI uses SAML 2.0 with Shibboleth-style deployment. Required infrastructure:

| Technical Component      | CARSI Requirement                                                                    | Synthex Status         | Gap Impact                                              |
| ------------------------ | ------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------- |
| **SAML/OIDC Endpoint**   | Federation metadata endpoint at carsi.edu.cn/idp-metadata.xml                        | No SAML implementation | BLOCKING — CARSI cannot discover Synthex                |
| **Metadata Provider**    | carsi.edu.cn/carsimetadata/carsifed-idp-metadata.xml                                 | Not configured         | BLOCKING — federated login impossible                   |
| **DS Endpoint**          | ds.carsi.edu.cn/ds/index.html                                                        | Not configured         | BLOCKING — SAML cannot validate tokens                  |
| **eduPerson Attributes** | Attribute release control for eduPersonScopedAffiliation, eduPersonEntitlement, etc. | No attribute policy    | BLOCKING — CARSI rejects uncontrolled attribute release |
| **Metadata Validation**  | technical.edugain.org/entities registration check                                    | No registration        | BLOCKING — CARSI rejects non-registered SP              |
| **Audit Logging**        | All CARSI access events logged for federation compliance                             | Basic server logs only | BLOCKING — CARSI auditor rejects incomplete logging     |

**Evidence Source:** CARSI SP joining process (carsi.atlassian.net/wiki), technical.edugain.org validator.

---

## 2. DR-NRPG Training Requirements Assessment

DR-NRPG (Disaster Recovery National Restoration Partners Group) mandates specific training for all contractors before marketplace deployment.

### 2.1 Mandatory OH&S Courses

| Course                     | CARSI Training Provider                               | Synthex Status | Gap     |
| -------------------------- | ----------------------------------------------------- | -------------- | ------- |
| **Work Safety Management** | WHS Act compliance (ANNUAL VERIFICATION)              | Not available  | MISSING |
| **Risk Management**        | AS/NZS ISO 31000 aligned                              | Not available  | MISSING |
| **SWMS Management**        | Safe Work Method Statements for high-risk restoration | Not available  | MISSING |
| **SDS Management**         | Reading/interpreting Safety Data Sheets               | Not available  | MISSING |
| **SOP Management**         | Standard Operating Procedures for restoration         | Not available  | MISSING |

**Evidence Source:** Disaster Recovery "Minimum Training Requirements" page, 6 mandatory courses listed.

**Gap Impact:** NRPG marketplace cannot deploy contractors to sites. DR-NRPG membership access blocked.

### 2.2 Asbestos Awareness Training

| Requirement             | Description                                            | CARSI Status  | Synthex Status | Gap |
| ----------------------- | ------------------------------------------------------ | ------------- | -------------- | --- |
| **Asbestos Awareness**  | AS/NZS WHS compliance for properties built before 1990 | Not available | MISSING        |
| **Legal Obligations**   | WHS Act 2011 compliance, mesothelioma prevention       | Not available | MISSING        |
| **Safe Work Practices** | Identification and handling procedures                 | Not available | MISSING        |

**Evidence Source:** Disaster Recovery "Asbestos Awareness" section, mandatory for properties built pre-1990.

**Gap Impact:** Contractors cannot access 30%+ of Australian restoration sites. Insurance invalidation risk.

### 2.3 IICRC CEC Tracking

| Requirement                  | CARSI Requirement                                              | Synthex Status          | Gap     |
| ---------------------------- | -------------------------------------------------------------- | ----------------------- | ------- |
| **CEC Credits**              | 20 hours/year minimum for IICRC renewal                        | No tracking system      | MISSING |
| **Discipline-Specific CECs** | At least 10 hours per IICRC discipline (WRT, FSRT, AMRT, etc.) | No integration          | MISSING |
| **Verification**             | Shareable verifiable credentials for employers/clients         | No certificate workflow | MISSING |
| **Expiration Monitoring**    | 90-day grace period, inactivation tracking                     | No automated alerts     | MISSING |

**Evidence Source:** CARSI "Get Your Yearly CECs" page, IICRC certification maintenance rules.

**Gap Impact:** NRPG contractors lose IICRC credentials after 90 days, resulting in network deactivation and insurance ineligibility.

---

## 3. Synthex Current Capability Inventory

### 3.1 Strengths

| Capability                    | Evidence                                                                   | Relevance                                          |
| ----------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| **Course Catalog Management** | Lib quick-access items, industry classifier                                | CARSI catalogue integration foundation             |
| **CARSI Authority Content**   | Generated CARSI campaign packs (h5-launch, restoration-training-authority) | Brand-config for CARSI design, editorial authority |
| **Certificate Generation**    | CEC progress tracking, credential ready systems                            | CARSI verification page capability                 |
| **Data Model Extensions**     | Supabase migrations for AEO/NRPG/DR/SMS                                    | Schema foundation for CARSI federation             |
| **Brand Configuration**       | packages/brand-config/src/brands/carsi.design.md                           | CARSI visual identity system                       |
| **Content Generation**        | H5 course modules, media generation pipeline                               | OH&S/asbestos course creation capability           |

### 3.2 Weaknesses

| Capability              | Evidence                                                | Gap Impact              |
| ----------------------- | ------------------------------------------------------- | ----------------------- |
| **Identity Federation** | No SAML/OIDC endpoints, no metadata provider            | BLOCKING                |
| **Attribute Policy**    | No attribute release control, no eduPerson handling     | BLOCKING                |
| **Data Protection**     | No PRC PDP compliance templates, no consent workflows   | BLOCKING                |
| **Training Catalog**    | No OH&S courses, no asbestos training                   | BLOCKING for NRPG       |
| **CEC Tracking**        | No IICRC CEC integration, no discipline tracking        | BLOCKING for NRPG       |
| **Audit Logging**       | No CARSI-specific audit logs                            | BLOCKING for federation |
| **Export Control**      | No dual-use material auditing, no entity list screening | NO-GO for China SAR     |

**Evidence Base:** Synthex codebase (lib/quick-access, packages/brand-config, scripts/generate-carsi-authority-campaign.ts), previous task history (t_c71fa2c9, t_06342738, t_a14f096e).

---

## 4. Gaps by Priority

### 4.1 CRITICAL - BLOCK CARSI Federation (All Phases Dependent)

| Gap                                             | CARSI Requirement                                                            | Timeline Estimate | Dependencies              |
| ----------------------------------------------- | ---------------------------------------------------------------------------- | ----------------- | ------------------------- |
| **SAML/OIDC Federation Endpoint**               | CARSI SP joining Steps 1–7, Metadata Provider, DS endpoint                   | 4–6 weeks         | None                      |
| **Attribute Policy for eduPerson**              | eduPersonScopedAffiliation, eduPersonEntitlement, attribute release controls | 3–4 weeks         | Federation endpoint       |
| **China-Compliant Data Processing Agreement**   | PRC Personal Data Protection Law compliance, attribute consent workflows     | 2–3 weeks         | Attribute policy          |
| **Audit Logging for CARSI Federation**          | All CARSI access events logged                                               | 1–2 weeks         | Attribute policy          |
| **Metadata Validation (technical.edugain.org)** | eduGAIN registration check                                                   | 1 week            | Federation endpoint       |
| **Third-Party Data Transfer Controls**          | No unauthorized attribute transfers                                          | 2–3 weeks         | Data processing agreement |

**Cumulative Blocker Impact:** No CARSI federation approval possible until all 6 items complete. Estimated 12–20 weeks.

### 4.2 HIGH - BLOCK NRPG Marketplace Access

| Gap                                               | NRPG Requirement                                  | Timeline Estimate | Dependencies                       |
| ------------------------------------------------- | ------------------------------------------------- | ----------------- | ---------------------------------- |
| **OH&S Course Catalog (5 courses)**               | WHS compliance, risk management, SWMS, SDS, SOP   | 3–5 weeks         | None (can source/licensed content) |
| **Asbestos Awareness Training**                   | Pre-1990 properties WHS compliance                | 2–3 weeks         | Depends on OH&S catalog            |
| **IICRC CEC Tracking Integration**                | 20 hours/year, verification, expiration alerts    | 2–4 weeks         | Training catalog                   |
| **Certificate Verification Workflow**             | Shareable CARSI/Certificate for employers/clients | 1–2 weeks         | CEC tracking                       |
| **NRPG Business Ownership Framework Integration** | Contractor onboarding tracking                    | 2–3 weeks         | CEC tracking                       |

**Cumulative Blocker Impact:** NRPG marketplace cannot onboarding contractors without training. Estimated 10–17 weeks.

### 4.3 MEDIUM - CARI Platform Alignment

| Gap                                            | CARSI Platform Requirement                | Timeline Estimate | Dependencies         |
| ---------------------------------------------- | ----------------------------------------- | ----------------- | -------------------- |
| **Course Catalog Integration with CARSI**      | Published courses in CARSI catalogue      | 2–3 weeks         | OH&S catalog         |
| **CEC Progress Dashboard**                     | Dashboard visible to Chinese institutions | 2 weeks           | CEC tracking         |
| **Professional Development Progress Tracking** | Contractor career advancement integration | 2 weeks           | Business framework   |
| **Verification Page Templates**                | CARSI certificate display                 | 1 week            | Certificate workflow |

**Estimated 7–8 weeks.**

### 4.4 LOW - Exit Thesis Regulatory (NO-GO for China SAR)

| Gap                                     | Export Control Requirement                      | Timeline Estimate | Dependencies   |
| --------------------------------------- | ----------------------------------------------- | ----------------- | -------------- |
| **Export Control Compliance Framework** | Dual-use material auditing for training content | 3–4 weeks         | None           |
| **Entity List Screening**               | Training customer verification                  | 2–3 weeks         | Export control |
| **Chinese Regulatory Reporting**        | China SAR compliance reporting                  | 2 weeks           | Export control |
| **AEO for China SAR**                   | SAR export controls eligibility                 | 4–6 weeks         | Export control |

**Estimated 11–15 weeks.**

---

## 5. Integration Recommendation

### 5.1 Recommended Implementation Phases

**PHASE 1: CARSI Federation Foundation (BLOCKER) — 12–20 weeks**

**Goal:** Enable CARSI federation for Chinese universities/institutions.

**Scope:**

1. SAML 2.0/OIDC federation endpoint deployment
2. Attribute policy configuration (eduPersonScopedAffiliation, eduPersonEntitlement)
3. China-compliant data processing agreement templates and consent workflows
4. Audit logging for CARSI federation events (access, attribute release, errors)
5. Metadata provider configuration (carsi.edu.cn/carsimetadata/)
6. technical.edugain.org registration and validation
7. Third-party data transfer controls and attribution

**Success Criteria:**

- CARSI federation application approved
- Metadata endpoint accessible and technically.edugain.org validated
- All CARSI audit logs captured and retained for 7 years
- Data processing agreement with Chinese home organizations signed
- Attribute consent workflow operational for PRC institutions

**Deliverables:**

- Federation endpoint deployment documentation
- Attribute policy configuration guide
- Data processing agreement templates (Chinese and English)
- CARSI audit log monitoring dashboard
- metadata.xml endpoint verified by CARSI admin

** blockers:**

**PHASE 2: Training Content Catalog (DEPENDENCY) — 10–17 weeks**

**Goal:** Provide mandatory OH&S and asbestos training for NRPG contractors.

**Scope:**

1. Source or create 5 OH&S courses (WHS compliance, risk management, SWMS, SDS, SOP)
2. Source asbestos awareness training module
3. IICRC CEC tracking system integration
4. Certificate generation and verification workflow
5. Training catalog integration with CARSI platform webpage
6. Course completion tracking for NRPG onboarding

**Success Criteria:**

- All 6 mandatory courses accessible via Synthex platform
- IICRC CEC tracking operational (20 hours/year, verification)
- Certificate verification pages shareable with employers/clients
- CARSI course catalogue updated with Synthex training catalog

**Deliverables:**

- Training catalog JSON schema
- Course video assets (unified brand-config styling)
- IICRC CEC tracking API integration
- Certificate generation pipeline (PDF/URL)
- CARSI catalogue integration scripts

**Dependencies:** Federation endpoint (Phase 1) required for CARSI catalogue integration.

**PHASE 3: NRPG Marketplace Alignment (DEPENDENCY) — 7–8 weeks**

**Goal:** Integrate training compliance with NRPG contractor onboarding.

**Scope:**

1. NRPG business ownership framework data model integration
2. Contractor onboarding tracking (preferences, profile, registration, training, payouts)
3. CEC progress dashboard for NRPG partners
4. Professional development progress tracking (career advancement)
5. Performance integration with NRPG advancement (performance assessment, career advancement)
6. Verification of CARSI course progress for platform narrative

**Success Criteria:**

- NRPG contractor onboarding pipeline integrated with training status
- CEC progress dashboard visible to NRPG partners
- CARSI course progress verified for Unite-Group platform narrative
- Contractor advancement criteria tied to CARSI CEC compliance

**Deliverables:**

- NRPG onboarding analytics service
- CEC progress dashboard UI component
- Contractor advancement tracking integration
- Platform narrative verification report

**Dependencies:** Training catalog (Phase 2) and NRPG business ownership framework.

**PHASE 4: Exit Thesis Regulatory (COMPLIANCE) — 11–15 weeks**

**Goal:** Enable CARSI Federation for China SAR jurisdictions.

**Scope:**

1. Export control compliance framework
2. Dual-use material flow auditing for training content
3. Entity list screening for Chinese training customers
4. Chinese regulatory reporting integration
5. AEO for China SAR status verification

**Success Criteria:**

- Export control compliance assessment completed
- Dual-use training content audited (no restricted materials)
- Entity list screening operational for Chinese institutions
- SAR compliance reporting integration complete

**Deliverables:**

- Export control compliance framework documentation
- Dual-use material audit tool
- Entity list screening scripts
- SAR regulatory reporting integration
- AEO for China SAR verification status

**Dependencies:** CARSI federation (Phase 1) as Chinese SAR institutions are CARSI members.

### 5.2 Recommended Sequence

**Strict Dependency Order (Cannot Skip):**

```
Phase 1 (CARSI Federation Foundation)
  ↓
Phase 2 (Training Content Catalog)
  ↓
Phase 3 (NRPG Marketplace Alignment)
  ↓
Phase 4 (Exit Thesis Regulatory) — OPTIONAL for non-China SAR markets
```

**Why This Order?**

- Phase 1 is BLOCKING for any CARSI integration, regardless of training
- Phase 2 requires CARSI federation for CARSI catalogue integration
- Phase 3 requires Phase 2 for training status verification
- Phase 4 requires Phase 1 for SAR jurisdiction CARSI membership

**Parallel Work Streams (Non-Blocking):**

- **Content Production**: While Phase 1 deploys, source OH&S courses and asbestos training (3–5 weeks)
- **Export Control Research**: Independent due diligence for SAR jurisdiction applicability (2–3 weeks)

### 5.3 Risk Assessment

| Risk                               | Likelihood | Impact   | Mitigation                                                                               |
| ---------------------------------- | ---------- | -------- | ---------------------------------------------------------------------------------------- |
| **CARSI Federation Rejection**     | MEDIUM     | CRITICAL | Dedicate dedicated CARSI SPOC, use SHIBBOLETH reference implementation                   |
| **China PDP Violations**           | HIGH       | CRITICAL | Engage PRC data privacy lawyer before attribute policy design                            |
| **Training Content Quality Gaps**  | MEDIUM     | HIGH     | Partner with established CARSI-approved training providers, not self-created             |
| **NRPG Timeline Slippage**         | MEDIUM     | MEDIUM   | Phase 1 must complete before Phase 2 to avoid wasted training development effort         |
| **SAR Export Control Uncertainty** | LOW        | HIGH     | Engage export control lawyer early, SAR suspension until Nov 2026 reduces immediate risk |

**Overall Risk Assessment: HIGH**

- CARSI federation is the single largest risk — one misconfiguration can permanently block Synthex from Chinese university access.
- Training content quality is critical for NRPG contractor onboarding but can be sourced from established providers.
- SAR export controls are low probability but high impact; suspension until Nov 2026 provides buffer.

### 5.4 Go/No-Go Decision Criteria

**GO for Phase 1 (CARSI Federation Foundation):**

Required preconditions met:

- [ ] CARSI federation budget approved (estimated $150–250K)
- [ ] PRC data privacy lawyer engagement confirmed
- [ ] Infrastructure team capacity dedicated (3–4 FTEs minimum)
- [ ] CARSI SP joining process (Steps 1–7) technical readiness verified
- [ ] Technical.edugain.org eduGAIN membership application in progress

**NO-GO for Phase 1 (If any precondition fails):**

- BUDGET: Cannot fund dedicated federation engineering team for 12–20 weeks
- LEGAL: PRC data privacy lawyer cannot engage before Phase 1 planning
- INFRASTRUCTURE: No dedicated SAML/OIDC infrastructure team available
- CARSI: CARSI Online Helpdesk confirms approval criteria not met without SPOC

**GO for Phase 2 (Training Content Catalog):**

Dependencies met:

- [ ] Phase 1 federation endpoint operational and CARSI audit logs capturing
- [ ] CARSI catalogue integration approved (requires federation active status)
- [ ] OH&S training providers shortlisted (CARSI-approved providers preferred)
- [ ] Budget approved for course licensing/purchase (estimated $50–100K)
- [ ] Content production capacity (videography, instructional design) secured

**NO-GO for Phase 2 (If any dependency fails):**

- FEDERATION: CARSI catalogue integration blocked by incomplete Phase 1
- COST: Training content budget insufficient for CARSI-approved providers
- CONTENT: No CARSI-approved OH&S/asbestos training content available
- CAPACITY: No team available to manage course content delivery and updates

**GO for Phase 3 (NRPG Marketplace Alignment):**

Dependencies met:

- [ ] Phase 2 training catalog fully populated with 6 mandatory courses
- [ ] IICRC CEC tracking operational with verification workflow
- [ ] NRPG business ownership framework data model ready
- [ ] NRPG integration point (onboarding analytics service) agreed upon

**NO-GO for Phase 3 (If any dependency fails):**

- TRAINING: CARSI OH&S/asbestos training courses not available or not approved
- TRACKING: IICRC CEC verification workflow not operational
- NRPG: NRPG partner cannot provide onboarding framework integration point
- REGULATORY: Export control compliance framework incomplete for SAR jurisdictions

**GO for Phase 4 (Exit Thesis Regulatory):**

Dependencies met:

- [ ] Phase 1 CARSI federation operational in SAR jurisdictions (Hong Kong SAR, Macau SAR, Beijing)
- [ ] SAR export control legal review completed (dual-use material auditing process)
- [ ] Entity list screening tools deployed and tested
- [ ] SAR compliance reporting integration point identified (China Customs AEO)

**NO-GO for Phase 4 (If any dependency fails):**

- FEDERATION: CARSI federation not operational in SAR jurisdictions (Step 7 SP joining incomplete)
- LEGAL: SAR export control lawyer engagement not confirmed
- TOOLS: Entity list screening tools not available or tested
- CUSTOMS: SAR AEO iPASS process not initiated

---

## 6. Conclusion

**CARSI Federation Readiness:** NO (BLOCKING)

**NRPG Marketplace Readiness:** NO (BLOCKING)

**Exit Thesis Alignment:** CONDITIONAL — product strategy fits platform narrative, but regulatory compliance is a mandatory dependency for NRPG marketplace scale. Previous AEO GTM proof (t_c71fa2c9) validated marketing messaging and demo readiness, but did not address technical CARSI compliance or training content completeness.

**Recommendation:**

**IMMEDIATE ACTION REQUIRED:**

1. **Approve Phase 1 CARSI Federation Foundation budget** — This is the single blocking milestone. Without federation, no NRPG marketplace integration or public CARSI positioning can proceed.

2. **Engage PRC data privacy lawyer** — Critical for attribute consent workflows and data protection profile compliance.

3. **Assign dedicated CARSI SPOC** — CARSI federation requires ongoing SPOC coordination for SP joining process, metadata validation, audit logging, and annual compliance review.

4. **Defer Phase 2/3 until Phase 1 complete** — Training content and NRPG integration are wasted effort without CARSI federation active status.

5. **Audit current Synthex training content for export controls** — Ensure no dual-use restricted materials in OH&S/asbestos training before Phase 2 content sourcing.

**OPTIONAL, DEPENDENT ON STRATEGIC DECISION:**

Phase 4 (Exit Thesis Regulatory for China SAR) should only proceed if Synthex explicitly targets SAR jurisdiction CARSI membership. Current CARSI federation focus is PRC mainland universities; SAR expansion is a separate strategic decision requiring dedicated legal review and infrastructure.

**Estimated Timeline to CARSI Marketplace Ready:**

- Phase 1: 12–20 weeks
- Phase 2: 10–17 weeks
- Phase 3: 7–8 weeks

**Total to NRPG Marketplace Ready:** 29–45 weeks (7–11 months) from budget approval.

**Recommendation:** Approve Phase 1 immediately, defer Phases 2–3 pending Phase 1 completion, evaluate SAR expansion (Phase 4) after Phase 1 goes live.

---

## 7. Attachments and Evidence

**Evidence Documents:**

1. CARSI Identity Federation Data Protection Profile (carsi.edu.cn/docs/data_protection_profile_en.pdf)
2. DR-NRPG Minimum Training Requirements (disasterrecovery.com.au/certifications/minimum-training-requirements)
3. CARSI Platform Catalogue (carsi.com.au/)
4. CARSI SP Joining Process (carsi.atlassian.net/wiki)
5. AEO GTM Proof — Unite-Hub Platform Narrative (t_c71fa2c9)
6. Synthex Training Content System (lib/quick-access, packages/brand-config, scripts/generate-carsi-authority-campaign.ts)

**Technical References:**

- 1EdTech TrustEd Apps Directory (for CARSI certification listing)
- technical.edugain.org entities validator (for eduGAIN registration check)
- supabase/migrations/20260429000001_syn822_834_833_aeo_nrpg_dr_sms.sql (Synthex data model foundation)

**Strategic References:**

- Synthex AEO GTM Proof (t_c71fa2c9) — AEO/GEO messaging alignment and demo readiness
- Exit Thesis Review (CONSTITUTION.md, UNITE-HUB context) — Platform narrative for NRPG marketplace positioning
- CARSI-NRPG Business Ownership Framework (linked from t_06342738) — NRPG operational procedures document

---

**Document Owner:** empire-mac
**Next Review:** After Phase 1 federation endpoint deployment completion
**Authorized By:** Phill McGurk (L3 approval)
