# Google Scope Justification Register

This register exists so Google OAuth consent, verification, and founder authority remain explainable.

| Platform | Scope | Sensitivity | Business Reason | User-Visible Feature | Approval State |
| --- | --- | --- | --- | --- | --- |
| Search Console | `https://www.googleapis.com/auth/webmasters` | Sensitive | Read Search Console properties, sitemaps, and search analytics for each business. | SEO/GEO dashboard, sitemap and query reporting. | Founder consent required |
| Search Console | `https://www.googleapis.com/auth/indexing` | Sensitive/Restricted depending Google review | Submit or inspect indexing where eligible. | Indexing status and crawl request workflow. | Board gate before mutation |
| GA4 | `https://www.googleapis.com/auth/analytics.readonly` | Sensitive | List and read GA4 properties for attribution and reporting. | Performance dashboard and weekly reports. | Founder consent required |
| GA4 | `https://www.googleapis.com/auth/analytics.edit` | Sensitive | Create/configure GA4 properties if Synthex is expected to do setup from scratch. | Autonomous GA4 provisioning. | Not currently requested by app scope |
| Google Business Profile | `https://www.googleapis.com/auth/business.manage` | Sensitive | Read and manage GBP locations, reviews, posts, and profile data. | Local SEO, reviews, NAP, GBP posting. | Founder consent required |
| YouTube | `https://www.googleapis.com/auth/youtube.readonly` | Sensitive | Read channel and video metadata/performance. | Video dashboard and content learning loop. | Founder consent required |
| YouTube | `https://www.googleapis.com/auth/youtube.upload` | Restricted | Upload approved videos to the business channel. | Video publishing workflow. | Board/security gate before broad rollout |
| YouTube | `https://www.googleapis.com/auth/youtube.force-ssl` | Restricted | Secure YouTube management operations when required by the provider client. | Secure video publishing workflow. | Scope consistency follow-up |
| Google Drive | `https://www.googleapis.com/auth/drive` | Sensitive/Restricted | Store and retrieve campaign/source assets. | Asset workspace and source handoff. | Consider `drive.file` if sufficient |
