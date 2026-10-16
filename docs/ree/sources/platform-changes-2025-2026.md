# Platform changes, July 2025 – October 2026

Source ledger for the REE spec ([`../REE-SPEC.md`](../REE-SPEC.md)). Every row was re-opened by the coordinator on 16/10/2026 and matched against a phrase on the page.

- `[VERIFIED]`: the page was fetched on 16/10/2026 and contains the stated fact.
- `[UNCONFIRMED]`: the research lane cited it, but the coordinator's fetch was blocked. Treat it as a lead.

A vendor's announcement proves the vendor said it. It does not prove an Australian rollout for a given account, or any ranking benefit. Check availability inside the real account before you build on it.

## Google Search — updates and policy

| Fact                                                                                                                                                                    | Tag        | Source                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| Ten confirmed ranking updates ran between July 2025 and October 2026 (June 2025 core through September 2026 spam). Synthex now reads them live from the dashboard feed. | [VERIFIED] | [status.search.google.com](https://status.search.google.com/incidents.json)                              |
| Google updated its site reputation abuse policy on 28/08/2026. Parasite-style third-party publishing remains a spam-policy risk.                                        | [VERIFIED] | [developers.google.com](https://developers.google.com/search/blog/2026/08/update-site-reputation-policy) |
| Google's guidance on generative-AI content (updated 01/10/2026) allows AI assistance but treats mass generation without added value as scaled content abuse.            | [VERIFIED] | [developers.google.com](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content)     |
| Google says E-E-A-T is not a specific ranking factor; it warns against invented authors, AI headshots and false credentials.                                            | [VERIFIED] | [developers.google.com](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |

## Google Search — AI features

| Fact                                                                                                                       | Tag        | Source                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| Google's AI optimisation guide says sites can ignore llms.txt and other special AI files or markup for Google Search.      | [VERIFIED] | [developers.google.com](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) |
| AI Overviews and AI Mode use the normal index: a page must be indexed and snippet-eligible; there is no special AI schema. | [VERIFIED] | [developers.google.com](https://developers.google.com/search/docs/appearance/ai-features)             |
| AI Mode launched in Australia (English) on 08/10/2025.                                                                     | [VERIFIED] | [blog.google](https://blog.google/intl/en-au/products/explore-get-answers/ai-mode-in-australia/)      |

## Google Search — measurement

| Fact                                                                                                                         | Tag        | Source                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| Search Console added dedicated generative-AI performance (impression) reports in June 2026.                                  | [VERIFIED] | [developers.google.com](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports)             |
| Search Console added a multimodal search type (Lens, Circle to Search, image inputs) in September 2026.                      | [VERIFIED] | [developers.google.com](https://developers.google.com/search/blog/2026/09/web-multimodal-in-sc)                   |
| Search Console platform properties (Instagram, TikTok, X, YouTube content on Google) became globally available in July 2026. | [VERIFIED] | [developers.google.com](https://developers.google.com/search/blog/2026/07/platform-properties-social-video-guide) |
| GA4 introduced a dedicated AI Assistant traffic channel on 13/05/2026.                                                       | [VERIFIED] | [support.google.com](https://support.google.com/analytics/answer/9164320?hl=en)                                   |

## Google Search — crawling and rich results

| Fact                                                                                                   | Tag        | Source                                                                                                 |
| ------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------ |
| Googlebot fetches only the first 2 MB of a resource (PDF: 64 MB); bytes beyond that are never indexed. | [VERIFIED] | [developers.google.com](https://developers.google.com/search/blog/2026/03/crawler-blog-post)           |
| Google removed the FAQ rich result documentation; FAQ rich results are no longer shown.                | [VERIFIED] | [developers.google.com](https://developers.google.com/search/updates)                                  |
| HTTP 304 tells Google the content is unchanged and can be reused from the previous crawl.              | [VERIFIED] | [developers.google.com](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes) |

## Google Business Profile and Maps

| Fact                                                                                                                                  | Tag           | Source                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| The My Business Q&A API was discontinued on 03/11/2025; Q&A can no longer be read or posted through the API.                          | [VERIFIED]    | [developers.google.com](https://developers.google.com/my-business/content/qanda/change-log)                             |
| GBP API changelog (2026): review reply state, recurring posts, review media, reply policy-violation fields.                           | [VERIFIED]    | [developers.google.com](https://developers.google.com/my-business/content/change-log)                                   |
| GBP API policy requires the business's express consent and forbids automatically reverting Google's edits.                            | [VERIFIED]    | [developers.google.com](https://developers.google.com/my-business/content/policies)                                     |
| Ask Maps (conversational Maps) is rolling out in Australia (announced 07/08/2026).                                                    | [VERIFIED]    | [blog.google](https://blog.google/intl/en-au/products/explore-get-answers/ask-maps-australia/)                          |
| Google's local ranking is relevance, distance and prominence; ranking cannot be bought.                                               | [VERIFIED]    | [support.google.com](https://support.google.com/business/answer/7091?hl=en)                                             |
| Video verification needs a continuous, unedited recording showing location, operations and management access.                         | [VERIFIED]    | [support.google.com](https://support.google.com/business/answer/14271705?hl=en)                                         |
| Google's Maps policy forbids incentivised reviews, selective (gated) solicitation and discouraging negative reviews.                  | [VERIFIED]    | [support.google.com](https://support.google.com/contributionpolicy/answer/7400114?hl=en)                                |
| The ACCC prohibits businesses creating fake reviews or suppressing genuine negative ones. (fetch blocked with HTTP 403 on 16/10/2026) | [UNCONFIRMED] | [www.accc.gov.au](https://www.accc.gov.au/consumers/advertising-and-promotions/online-reviews-for-product-and-services) |

## Bing and Microsoft

| Fact                                                                                                                                          | Tag        | Source                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bing Webmaster Tools AI Performance (public preview, 10/02/2026) reports citations and sampled grounding queries; it is not a ranking signal. | [VERIFIED] | [blogs.bing.com](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/)                         |
| Bing added Topics Portfolio (beta) to AI Performance on 13/10/2026: topic size, sites cited and query-level opportunities.                    | [VERIFIED] | [blogs.bing.com](https://blogs.bing.com/webmaster/2026/10/introducing-topics-portfolio-beta-in-ai-performance/)                                      |
| Bing Places moved to a rebuilt portal with Google import and bulk management (03/10/2025).                                                    | [VERIFIED] | [blogs.bing.com](https://blogs.bing.com/search/2025/10/Introducing-the-New-Bing-Places-for-Business-Built-for-Business-Owners,-Powered-by-Research/) |
| IndexNow lets a site notify participating engines of added, updated or deleted URLs (up to 10,000 per POST).                                  | [VERIFIED] | [www.indexnow.org](https://www.indexnow.org/documentation)                                                                                           |

## AI answer engines and crawlers

| Fact                                                                                             | Tag           | Source                                                                                                                                                |
| ------------------------------------------------------------------------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI separates OAI-SearchBot (search) from GPTBot (training); ChatGPT-User is user-triggered.  | [VERIFIED]    | [developers.openai.com](https://developers.openai.com/api/docs/bots)                                                                                  |
| Google-Extended controls Gemini training and grounding use, not Google Search ranking.           | [VERIFIED]    | [developers.google.com](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers)                                         |
| Anthropic separates ClaudeBot (training), Claude-SearchBot (search) and Claude-User (retrieval). | [VERIFIED]    | [support.claude.com](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) |
| Perplexity separates PerplexityBot (discovery) from Perplexity-User (user-triggered fetches).    | [VERIFIED]    | [docs.perplexity.ai](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)                                                                   |
| OpenAI retired the ChatGPT Atlas browser. (fetch blocked with HTTP 403 on 16/10/2026)            | [UNCONFIRMED] | [help.openai.com](https://help.openai.com/en/articles/20001371-chatgpt-atlas-retirement)                                                              |

## Tools and vendors

| Fact                                                                                                                                  | Tag        | Source                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| Adobe completed its acquisition of Semrush (28/04/2026).                                                                              | [VERIFIED] | [news.adobe.com](https://news.adobe.com/news/2026/04/adobe-completes-semrush-acquisition) |
| Semrush offers an official MCP server; OAuth is the default authentication. Unit costs and plan coverage must be checked per account. | [VERIFIED] | [developer.semrush.com](https://developer.semrush.com/api/v3/introduction/semrush-mcp/)   |

## Media and brand

| Fact                                                                                                                                                                           | Tag        | Source                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------- |
| Google's video guidance: a dedicated watch page per video; VideoObject needs name, thumbnailUrl and uploadDate.                                                                | [VERIFIED] | [developers.google.com](https://developers.google.com/search/docs/appearance/structured-data/video) |
| YouTube renamed 'repetitious' content to 'inauthentic' content (July 2025); mass-produced, repetitive content is not monetisable. It is not a blanket AI ban.                  | [VERIFIED] | [support.google.com](https://support.google.com/youtube/answer/1311392)                             |
| Ahrefs found brand mentions (YouTube ~0.737, web ~0.66–0.71) correlate with AI visibility across 75,000 brands. This is correlation in established brands, not a proven cause. | [VERIFIED] | [ahrefs.com](https://ahrefs.com/blog/ai-brand-visibility-correlations/)                             |

## Advertising

| Fact                                                                            | Tag        | Source                                                                            |
| ------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| Ads in AI Overviews are available in English in Australia (desktop and mobile). | [VERIFIED] | [support.google.com](https://support.google.com/google-ads/answer/16297775?hl=en) |

## Durable agent substrate

| Fact                                                                                                                              | Tag        | Source                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------ |
| Vercel Workflow: 'use workflow' / 'use step', persisted steps, retries, long pauses; billed per event plus functions and storage. | [VERIFIED] | [vercel.com](https://vercel.com/docs/workflows)                          |
| Inngest: completed step results persist; run lifetime limits by plan (Free 30 days, Pro 90 days).                                 | [VERIFIED] | [www.inngest.com](https://www.inngest.com/docs/durable-execution/limits) |

## Not established by any source

- No source gives a public ranking formula for Google AI Mode, ChatGPT, Perplexity, Gemini or Copilot. `[INFERENCE]` from the documents above: each engine's citations must be measured separately.
- No controlled study shows that adding brand mentions _causes_ AI citations. The Ahrefs data is correlational, in brands with DR above 40. `[VERIFIED]` source above; the causal claim is `[UNCONFIRMED]`.
- Australian eligibility for Local Services Ads, AI Mode ad formats and some GBP features is unverified. Check it in the live account. `[UNCONFIRMED]`.
