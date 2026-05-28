# Synthex Google Connections Authority Packet

Generated: 2026-05-28T02:16:01.159Z
Owner account: phill.mcgurk@gmail.com
Mode: apply exact safe mappings

## Specialist Agent Loop

- Senior PM owns sequencing, evidence, and blocker escalation.
- Google Cloud Console Agent owns OAuth consent screen, enabled APIs, redirect URIs, and scope verification.
- Search Console Agent owns property discovery, ownership verification, sitemap/indexing checks, and GSCProperty mapping.
- GA4 Agent owns property discovery/selection, measurement ID capture, and GA4Property mapping.
- Google Business Profile Agent owns location discovery, profile verification state, NAP consistency, reviews, and GBPLocation mapping.
- YouTube/Drive Agent owns video channel and asset workspace links where required.
- Security/QA Agent verifies no secrets are logged, tokens are encrypted, and each route is org-scoped.

## Businesses

### Disaster Recovery (disaster-recovery)

- Website: https://disasterrecovery.com.au
- Status: needs_authority
- Google Search Console (required): ready - No action required.
  Evidence: 1 active OAuth connection(s); 2 stored mapping(s); 2 discoverable Search Console properties; 2 GSC mapping(s) upserted
- Google Analytics 4 (required): mapping_required - Select or sync the matching Google Analytics 4 property/location for this business.
  Evidence: 1 active OAuth connection(s); 0 discoverable GA4 properties
  Authority URL: https://synthex.social/api/auth/oauth/googleanalytics?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
  Follow-up: Creating GA4 properties autonomously requires analytics.edit scope; current app scope is read-only.
- Google Business Profile (required): authority_required - Provide Google authority for Google Business Profile while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/googlebusiness?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
- YouTube (recommended): authority_required - Provide Google authority for YouTube while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/youtube?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
- Google Drive (recommended): authority_required - Provide Google authority for Google Drive while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/googledrive?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations

### CARSI (carsi)

- Website: https://carsi.com.au
- Status: needs_authority
- Google Search Console (required): authority_required - Provide Google authority for Google Search Console while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/searchconsole?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
- Google Analytics 4 (required): authority_required - Provide Google authority for Google Analytics 4 while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/googleanalytics?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
  Follow-up: Creating GA4 properties autonomously requires analytics.edit scope; current app scope is read-only.
- Google Business Profile (required): authority_required - Provide Google authority for Google Business Profile while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/googlebusiness?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
- YouTube (recommended): authority_required - Provide Google authority for YouTube while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/youtube?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
- Google Drive (recommended): authority_required - Provide Google authority for Google Drive while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/googledrive?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations

### Synthex (synthex)

- Website: https://synthex.social
- Status: needs_authority
- Google Search Console (required): authority_required - Provide Google authority for Google Search Console while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/searchconsole?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
- Google Analytics 4 (required): authority_required - Provide Google authority for Google Analytics 4 while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/googleanalytics?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
  Follow-up: Creating GA4 properties autonomously requires analytics.edit scope; current app scope is read-only.
- Google Business Profile (required): authority_required - Provide Google authority for Google Business Profile while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/googlebusiness?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
- YouTube (recommended): authority_required - Provide Google authority for YouTube while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/youtube?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
- Google Drive (recommended): authority_required - Provide Google authority for Google Drive while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/googledrive?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations

### RestoreAssist (restoreassist)

- Website: https://restoreassist.app
- Status: needs_authority
- Google Search Console (required): authority_required - Provide Google authority for Google Search Console while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/searchconsole?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
- Google Analytics 4 (required): mapping_required - Select or sync the matching Google Analytics 4 property/location for this business.
  Evidence: 1 active OAuth connection(s); 0 discoverable GA4 properties
  Authority URL: https://synthex.social/api/auth/oauth/googleanalytics?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
  Follow-up: Creating GA4 properties autonomously requires analytics.edit scope; current app scope is read-only.
- Google Business Profile (required): authority_required - Provide Google authority for Google Business Profile while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/googlebusiness?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
- YouTube (recommended): authority_required - Provide Google authority for YouTube while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/youtube?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
- Google Drive (recommended): authority_required - Provide Google authority for Google Drive while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/googledrive?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations

### NRPG (nrpg)

- Website: https://nrpg.com.au
- Status: needs_mapping
- Google Search Console (required): ready - No action required.
  Evidence: 1 active OAuth connection(s); 4 stored mapping(s); 4 discoverable Search Console properties; 4 GSC mapping(s) upserted
- Google Analytics 4 (required): mapping_required - Select or sync the matching Google Analytics 4 property/location for this business.
  Evidence: 1 active OAuth connection(s); 3 discoverable GA4 properties
  Authority URL: https://synthex.social/api/auth/oauth/googleanalytics?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
  Follow-up: Creating GA4 properties autonomously requires analytics.edit scope; current app scope is read-only.
- Google Business Profile (required): mapping_required - Select or sync the matching Google Business Profile property/location for this business.
  Evidence: 1 active OAuth connection(s); 0 discoverable GBP location(s)
  Authority URL: https://synthex.social/api/auth/oauth/googlebusiness?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
- YouTube (recommended): ready - No action required.
  Evidence: 1 active OAuth connection(s)
- Google Drive (recommended): ready - No action required.
  Evidence: 1 active OAuth connection(s)

### Unite-Group (unite-group)

- Website: https://unite-group.com.au
- Status: needs_authority
- Google Search Console (required): authority_required - Provide Google authority for Google Search Console while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/searchconsole?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
- Google Analytics 4 (required): mapping_required - Select or sync the matching Google Analytics 4 property/location for this business.
  Evidence: 2 active OAuth connection(s); 0 discoverable GA4 properties
  Authority URL: https://synthex.social/api/auth/oauth/googleanalytics?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
  Follow-up: Creating GA4 properties autonomously requires analytics.edit scope; current app scope is read-only.
- Google Business Profile (required): mapping_required - Select or sync the matching Google Business Profile property/location for this business.
  Evidence: 1 active OAuth connection(s); 0 discoverable GBP location(s)
  Authority URL: https://synthex.social/api/auth/oauth/googlebusiness?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
- YouTube (recommended): authority_required - Provide Google authority for YouTube while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/youtube?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
- Google Drive (recommended): ready - No action required.
  Evidence: 1 active OAuth connection(s)

### CCW (ccw)

- Website: https://ccwonline.com.au
- Status: needs_authority
- Google Search Console (required): authority_required - Provide Google authority for Google Search Console while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/searchconsole?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
- Google Analytics 4 (required): authority_required - Provide Google authority for Google Analytics 4 while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/googleanalytics?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
  Follow-up: Creating GA4 properties autonomously requires analytics.edit scope; current app scope is read-only.
- Google Business Profile (required): authority_required - Provide Google authority for Google Business Profile while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/googlebusiness?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
- YouTube (recommended): authority_required - Provide Google authority for YouTube while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/youtube?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations
- Google Drive (recommended): authority_required - Provide Google authority for Google Drive while the target business is active.
  Authority URL: https://synthex.social/api/auth/oauth/googledrive?returnTo=%2Fdashboard%2Fsettings%3Ftab%3Dintegrations

## Founder Authority Step

Log into Synthex as the founder, switch to the named business, then open the listed authority URLs. After Google consent/ownership gates are complete, rerun `npm run connections:google:audit` and then `npm run connections:google:apply` to sync exact safe mappings.

## Non-Negotiable Safety Rules

- Do not paste or commit Google tokens, passwords, client secrets, or service account JSON.
- Do not map a GA4 property or GBP location unless the business/domain match is explicit.
- Keep demo/mock organizations separate from founder/client production organizations.
- Treat OAuth app verification and Search Console ownership as Google authority gates, not engineering bugs.
