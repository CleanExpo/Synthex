# Analytics Tracking Plan

## Overview
Comprehensive tracking specification for the Auto Marketing platform, covering all user interactions, conversion events, and performance metrics across marketing campaigns.

---

## 1. Tracking Architecture

### Data Layer Structure
```javascript
window.dataLayer = {
  page: {
    type: 'landing',          // landing, product, checkout, confirmation
    category: 'marketing',     // marketing, sales, support
    subcategory: 'campaign',   // campaign, organic, referral
    title: 'Page Title',
    url: window.location.href,
    referrer: document.referrer
  },
  user: {
    id: 'user_123',           // Hashed user ID
    type: 'registered',       // guest, registered, premium
    persona: 'marketing_manager',
    segment: 'enterprise',
    first_visit: '2024-01-01',
    lifetime_value: 5000
  },
  session: {
    id: 'session_abc',
    source: 'google',         // Traffic source
    medium: 'cpc',           // Traffic medium
    campaign: 'q1_launch',   // Campaign name
    content: 'variant_a',    // A/B test variant
    keyword: 'marketing automation'
  }
};
```

### Event Taxonomy
```yaml
Category: [User Action]_[Object]
Action: [Specific Action]
Label: [Additional Context]
Value: [Numeric Value]

Examples:
  - Category: "engagement_content"
    Action: "scroll"
    Label: "75_percent"
    Value: 750
    
  - Category: "conversion_form"
    Action: "submit"
    Label: "lead_capture"
    Value: 1
```

---

## 2. Standard Events

### Page View Events
```javascript
// Enhanced Page View
gtag('event', 'page_view', {
  page_title: document.title,
  page_location: window.location.href,
  page_path: window.location.pathname,
  page_type: dataLayer.page.type,
  user_persona: dataLayer.user.persona,
  test_variant: dataLayer.session.content
});
```

### Engagement Events
```javascript
// Scroll Depth Tracking
gtag('event', 'scroll', {
  event_category: 'engagement',
  event_label: 'depth',
  value: scrollPercentage,
  page_section: currentSection,
  time_on_page: timeSpent
});

// Time on Page Milestones
gtag('event', 'read_time', {
  event_category: 'engagement',
  event_label: 'milestone',
  value: seconds,
  content_type: 'article',
  word_count: wordCount
});

// Video Engagement
gtag('event', 'video_progress', {
  event_category: 'engagement_video',
  video_title: videoTitle,
  video_percent: percentWatched,
  video_duration: totalDuration
});
```

### Interaction Events
```javascript
// Click Tracking
gtag('event', 'click', {
  event_category: 'interaction',
  event_label: elementText,
  click_type: 'button',        // button, link, image
  click_location: 'header',    // header, hero, footer
  click_text: buttonText,
  click_url: targetUrl
});

// Form Interactions
gtag('event', 'form_start', {
  event_category: 'interaction_form',
  form_id: formId,
  form_name: formName,
  form_type: 'lead_capture'
});

gtag('event', 'form_abandonment', {
  event_category: 'interaction_form',
  form_id: formId,
  last_field: lastFieldCompleted,
  completion_percent: percentComplete
});
```

---

## 3. Conversion Events

### Micro-Conversions
```javascript
// Newsletter Signup
gtag('event', 'sign_up', {
  method: 'email',
  value: 5,                    // Estimated value
  content_type: 'newsletter',
  source_page: currentPage
});

// Content Download
gtag('event', 'file_download', {
  event_category: 'conversion_micro',
  file_name: fileName,
  file_type: 'pdf',
  content_category: 'whitepaper',
  value: 10
});

// Social Share
gtag('event', 'share', {
  method: 'twitter',
  content_type: 'article',
  content_id: contentId,
  share_location: 'article_footer'
});
```

### Macro-Conversions
```javascript
// Lead Generation
gtag('event', 'generate_lead', {
  value: 50,
  currency: 'USD',
  lead_type: 'demo_request',
  lead_source: 'landing_page',
  persona: userPersona,
  company_size: companySize
});

// Purchase/Subscription
gtag('event', 'purchase', {
  transaction_id: '12345',
  value: 299.00,
  currency: 'USD',
  tax: 25.42,
  items: [{
    item_id: 'SKU123',
    item_name: 'Premium Plan',
    item_category: 'subscription',
    item_variant: 'annual',
    price: 299.00,
    quantity: 1
  }]
});
```

---

## 4. Custom Dimensions & Metrics

### Custom Dimensions (GA4)
```yaml
dimension1_user_persona:
  scope: user
  description: "Marketing persona type"
  values: ["marketing_manager", "designer", "developer", "executive"]

dimension2_test_variant:
  scope: session
  description: "A/B test variant"
  values: ["control", "variant_a", "variant_b"]

dimension3_content_stage:
  scope: event
  description: "Content funnel stage"
  values: ["awareness", "consideration", "decision", "retention"]

dimension4_hook_type:
  scope: event
  description: "Marketing hook style"
  values: ["humorous", "serious", "business", "playful", "meaningful"]
```

### Custom Metrics
```yaml
metric1_engagement_score:
  scope: event
  type: integer
  description: "Composite engagement score (0-100)"

metric2_content_depth:
  scope: event
  type: float
  description: "Percentage of content consumed"

metric3_quality_score:
  scope: event
  type: integer
  description: "Lead quality score (0-100)"
```

---

## 5. Enhanced E-commerce Tracking

### Product Impressions
```javascript
gtag('event', 'view_item_list', {
  currency: 'USD',
  value: 155.00,
  item_list_id: 'featured_products',
  item_list_name: 'Featured Products',
  items: [
    {
      item_id: 'HOOK_001',
      item_name: 'Humorous Hook Pack',
      item_category: 'content/hooks',
      item_variant: 'persona_a',
      price: 29.99,
      index: 0
    }
  ]
});
```

### Add to Cart
```javascript
gtag('event', 'add_to_cart', {
  currency: 'USD',
  value: 29.99,
  items: [{
    item_id: 'TEMPLATE_001',
    item_name: 'Social Media Template Pack',
    item_category: 'templates/social',
    item_variant: 'instagram',
    price: 29.99,
    quantity: 1
  }]
});
```

---

## 6. Cross-Domain Tracking

### Configuration
```javascript
gtag('config', 'GA_MEASUREMENT_ID', {
  linker: {
    domains: [
      'automarketing.com',
      'app.automarketing.com',
      'shop.automarketing.com'
    ]
  }
});
```

---

## 7. Server-Side Tracking

### Measurement Protocol (GA4)
```javascript
const measurement_id = 'G-XXXXXXXXXX';
const api_secret = 'SECRET_KEY';

fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${measurement_id}&api_secret=${api_secret}`, {
  method: 'POST',
  body: JSON.stringify({
    client_id: 'CLIENT_ID',
    events: [{
      name: 'offline_conversion',
      params: {
        value: 100,
        currency: 'USD',
        conversion_type: 'phone_call'
      }
    }]
  })
});
```

---

## 8. Privacy & Consent

### Consent Management
```javascript
// Check consent status
function hasConsent(type) {
  return window.cookieConsent && window.cookieConsent[type];
}

// Update tracking based on consent
if (hasConsent('analytics')) {
  gtag('consent', 'update', {
    'analytics_storage': 'granted'
  });
} else {
  gtag('consent', 'update', {
    'analytics_storage': 'denied'
  });
}
```

### Data Retention
```yaml
user_data: 14 months
event_data: 2 months
aggregated_data: 26 months
```

---

## 9. Testing & Validation

### Debug Mode
```javascript
// Enable debug mode
window.gtag_debug_mode = true;

// Validate events
gtag('event', 'test_event', {
  debug_mode: true,
  event_category: 'test',
  event_label: 'validation'
});
```

### Validation Checklist
- [ ] All page views firing correctly
- [ ] Event parameters properly formatted
- [ ] Custom dimensions populated
- [ ] E-commerce data accurate
- [ ] Cross-domain tracking working
- [ ] Consent management functioning
- [ ] No PII in tracking data
- [ ] Performance impact < 100ms

---

## 10. Implementation Priority

### Phase 1 (Week 1)
- Basic page view tracking
- Core conversion events
- Form submission tracking

### Phase 2 (Week 2)
- Engagement metrics
- Custom dimensions
- Enhanced e-commerce

### Phase 3 (Week 3)
- Advanced interactions
- Server-side tracking
- Cross-domain setup

### Phase 4 (Week 4)
- Testing & optimization
- Documentation
- Team training

---

## Appendix: Event Reference

### Quick Reference Table
| Event Name | Category | Trigger | Value | Priority |
|------------|----------|---------|-------|----------|
| page_view | pageview | Page load | - | Critical |
| scroll_depth | engagement | 25/50/75/100% | % | High |
| click_cta | interaction | CTA click | - | Critical |
| form_submit | conversion | Form submission | Lead value | Critical |
| video_play | engagement | Video start | - | Medium |
| share | social | Share button | - | Low |
| download | conversion_micro | File download | 10 | Medium |
| purchase | conversion | Transaction | Revenue | Critical |

---

## Support & Documentation

### Resources
- [GA4 Documentation](https://developers.google.com/analytics)
- [GTM Templates](https://tagmanager.google.com/gallery/)
- [Privacy Guidelines](https://privacy.google.com/businesses/)

### Contact
- Technical Support: analytics@automarketing.com
- Implementation Help: support@automarketing.com