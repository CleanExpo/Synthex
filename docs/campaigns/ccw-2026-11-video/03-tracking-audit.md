# Tracking and schema audit: ccwonline.com.au (SYN-1404)

Checked 08/11/2026 in a real browser (Claude built-in browser, Chromium), region detected by Shopify as AUQLD. Read-only on CCW's site: no log-in and no admin access. One X-800 air mover was added to this browser's cart and removed again to test the cart events; nothing was ordered.

Pages: home `/`, collection `/collections/airmovers`, product `/products/xpower-airmover-x800-1hp-w-clamp`, cart `/cart`. Each campaign page was opened with the campaign UTM tags and loaded (HTTP 200).

Method: the page's own resource timing (`google-analytics.com/g/collect`, `facebook.com/tr`, `ccm/collect`), a hook on `sendBeacon` and `fetch` to read GA4 event names from batched request bodies, `window.dataLayer`, `fbq.getState()`, and the JSON-LD and microdata in the rendered page (after JavaScript). Limit: Shopify runs app pixels inside sandboxed web-pixel workers. Requests from those workers, and any server-side events (Meta Conversions API), cannot be seen from the page. An event that was not seen is marked UNKNOWN, not FAIL.

## Tags found on the site

| Tag                | ID              | How it loads                                    |
| ------------------ | --------------- | ----------------------------------------------- |
| Google Tag Manager | GTM-TV57JSHG    | theme                                           |
| Google tag         | GT-P3NSG7XV     | Shopify Google & YouTube channel config         |
| GA4 property 1     | G-L2FPX8MSFJ    | Google channel (`send_to` in its `gtag_events`) |
| GA4 property 2     | G-M1YCZ0KZLW    | gtag through GTM                                |
| Google Ads         | AW-867896284    | Google channel and gtag                         |
| Merchant Center    | MC-QHTVJ8NKFQ   | Google channel                                  |
| Meta Pixel         | 191213801448478 | `fbevents.js`, agent `shopify_web_pixel`        |
| Microsoft Clarity  | xatia2ygzl      | theme                                           |
| Hotjar             | 1963137         | theme                                           |

## Tracking: PASS, FAIL or UNKNOWN

| #   | Check                                          | Result                         | Evidence                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | GA4 G-L2FPX8MSFJ sends page_view               | PASS                           | Home: `analytics.google.com/g/collect tid=G-L2FPX8MSFJ en=page_view`. Product: request body `page_view,view_item`.                                                                                                                                        |
| T2  | GA4 G-L2FPX8MSFJ sends view_item               | PASS                           | Product page request body `en=view_item`; dataLayer `view_item send_to G-L2FPX8MSFJ`.                                                                                                                                                                     |
| T3  | GA4 G-L2FPX8MSFJ sends add_to_cart             | UNKNOWN                        | After a real click on Add to Cart, the dataLayer received `add_to_cart` and a G-L2FPX8MSFJ request followed, but the event name in that request body was not captured. `remove_from_cart` to G-L2FPX8MSFJ was captured by name. Confirm in GA4 DebugView. |
| T4  | Second GA4 property G-M1YCZ0KZLW               | FINDING                        | Sends page_view on all four pages. Two GA4 properties collect at once; reports can disagree. Toby to confirm which one is the reporting property.                                                                                                         |
| T5  | Meta Pixel PageView                            | PASS (home) / UNKNOWN (others) | Home: `facebook.com/tr id=191213801448478 ev=PageView`. Not seen from the page on the collection, product or cart pages.                                                                                                                                  |
| T6  | Meta Pixel ViewContent                         | UNKNOWN                        | Not seen from the page on the product page.                                                                                                                                                                                                               |
| T7  | Meta Pixel AddToCart                           | UNKNOWN                        | Not seen from the page after Add to Cart.                                                                                                                                                                                                                 |
| T8  | Shopify Facebook & Instagram channel connected | PASS                           | `fbq.getState()` reports pixel 191213801448478 with agent `shopify_web_pixel` and user data on; the pixel is installed through Shopify's channel, not hand-coded.                                                                                         |
| T9  | What is "G-120PSI"                             | PASS (false match)             | It is product text: "SOS PENGUIN 120PSI 5GAL (18.8L) BATTERY SPRAYER". Not a tag.                                                                                                                                                                         |
| T10 | Google Ads                                     | PASS                           | `AW-867896284` page_view and view-through conversion pings on every page checked.                                                                                                                                                                         |
| T11 | Search Console verification                    | PASS                           | `google-site-verification` meta tag present. Sitemap submission not checked (needs Search Console access).                                                                                                                                                |
| T12 | Meta domain verification                       | PASS                           | `facebook-domain-verification` meta tag present.                                                                                                                                                                                                          |
| T13 | Consent                                        | NOTE                           | Shopify customer privacy reports analytics and marketing allowed by default for this region.                                                                                                                                                              |
| T14 | Campaign links land and load                   | PASS                           | All 8 landing pages returned HTTP 200 with the campaign UTM tags (browser). Plain curl gets HTTP 429 from Shopify on collection and product pages, so link checks must use a browser.                                                                     |

## Schema (rendered page, after JavaScript)

| Page            | JSON-LD                                                                                              | Microdata                                  | Missing                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Home            | none                                                                                                 | Organization (`url` only; `logo` empty)    | Organization JSON-LD with name, logo, phone and address; WebSite with SearchAction |
| Collection      | BreadcrumbList                                                                                       | Organization                               | Organization, WebSite                                                              |
| Product (X-800) | BreadcrumbList; Product with brand, SKU F65-X800C, images, Offer (price 585.0, AUD, InStock, seller) | Product and Offer (duplicates the JSON-LD) | Organization, WebSite. Product passes.                                             |
| Cart            | BreadcrumbList                                                                                       | Organization                               | none needed                                                                        |

Result: Product PASS, BreadcrumbList PASS, Organization FAIL (no JSON-LD, microdata logo empty), WebSite FAIL (absent).

## Fix list for Toby (needs his Shopify, Google and Meta admin; decision A7)

1. Schema: add the snippet below to the theme (`layout/theme.liquid`, before `</head>`). Remove or fix the header microdata whose `logo` is empty.
2. GA4: confirm which property (G-L2FPX8MSFJ or G-M1YCZ0KZLW) is the reporting one. Keep the other only if it is used on purpose. Confirm `add_to_cart` in GA4 DebugView.
3. Meta: in Events Manager, use Test Events for pixel 191213801448478 and confirm ViewContent and AddToCart arrive (browser or server). In the Shopify Facebook & Instagram channel, set data sharing to "Maximum" so server events are sent too.
4. Instagram: set the profile link from the calendar's `-bio` link for each new video, and add the Story link sticker. This needs the CCW Instagram account.
5. Search Console: confirm the sitemap is submitted and Product rich results show no errors.
6. Product copy: the air movers collection page (https://ccwonline.com.au/collections/airmovers, read 08/11/2026) gives the XPOWER PL-700A two different power figures: "the PL700A low profile at 2400 W" in the range text and "XPOWER PL-700A Low Profile Air Mover 240W" in the product title. Check the manufacturer's rating and correct whichever is wrong. Until it is fixed, the campaign videos state no wattage for this unit.

```liquid
{%- comment -%} Organization and WebSite schema (SYN-1404 audit, 08/11/2026) {%- endcomment -%}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "{{ shop.url }}/#organization",
      "name": {{ shop.name | json }},
      "url": "{{ shop.url }}",
      "logo": "{{ settings.logo | image_url: width: 600 | prepend: 'https:' }}",
      "telephone": "1800 686 869",
      "sameAs": []
    },
    {
      "@type": "WebSite",
      "@id": "{{ shop.url }}/#website",
      "url": "{{ shop.url }}",
      "name": {{ shop.name | json }},
      "publisher": { "@id": "{{ shop.url }}/#organization" },
      "potentialAction": {
        "@type": "SearchAction",
        "target": "{{ shop.url }}/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    }
  ]
}
</script>
```

The logo line assumes the theme setting is called `logo`; this older theme may use another name. Check it in the theme editor, and fill `sameAs` with CCW's Facebook, Instagram and YouTube page URLs. The phone number is the one in the campaign calendar's CTA.

## Synthex side (attribution)

- Wiring: `lib/marketing-agency/ccw-video-campaign-2026-11.ts` builds every link (`ccwVideoLink`, `ccwVideoPlacementLinks`) and the 40 draft calendar posts. `scripts/apply-ccw-video-campaign-2026-11.ts` writes them as a Campaign plus `calendar_posts` rows.
- Status: NOT PROVISIONED. The apply script has only run as a dry run. Writing to the production database is decision A2.
- Reading results back: the UTM visits land in CCW's GA4, not in Synthex. Synthex can read them only through its GA4 integration (`/api/integrations/ga4/connect`, GA4Property record) on the CCW organisation. Whether CCW's organisation has that connection in production was not checked here: UNKNOWN.
