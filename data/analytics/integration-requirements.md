# Integration Requirements - Auto Marketing Platform

## Overview
Complete technical implementation guide for integrating analytics, tracking, and reporting systems across the Auto Marketing platform.

---

## 1. Google Tag Manager Setup

### Container Configuration
```javascript
// GTM Container Setup
const gtmConfig = {
  containerId: 'GTM-XXXXX',
  environments: {
    development: {
      auth: 'development_auth_token',
      preview: 'development_preview',
      cookieFlags: 'debug=true'
    },
    staging: {
      auth: 'staging_auth_token',
      preview: 'staging_preview',
      cookieFlags: 'debug=false'
    },
    production: {
      auth: 'production_auth_token',
      preview: 'production_preview',
      cookieFlags: 'secure;samesite=strict'
    }
  }
};

// DataLayer initialization
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  'gtm.start': new Date().getTime(),
  'event': 'gtm.js',
  'platform': 'auto_marketing',
  'version': '2.0.0'
});
```

### Tag Implementation
```yaml
tags:
  google_analytics_4:
    tag_type: "GA4 Configuration"
    measurement_id: "G-XXXXXXXXXX"
    triggers:
      - all_pages
    parameters:
      send_page_view: true
      enhanced_measurement: true
      
  facebook_pixel:
    tag_type: "Custom HTML"
    code: |
      <script>
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window,document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', 'PIXEL_ID');
        fbq('track', 'PageView');
      </script>
    triggers:
      - all_pages
      
  conversion_tracking:
    tag_type: "GA4 Event"
    event_name: "conversion"
    triggers:
      - form_submission
      - purchase_complete
    parameters:
      value: "{{transactionTotal}}"
      currency: "{{currencyCode}}"
      transaction_id: "{{transactionId}}"
```

### Variable Configuration
```javascript
// Custom JavaScript Variables
const customVariables = {
  userPersona: function() {
    return window.dataLayer.find(item => item.user_persona)?.user_persona || 'unknown';
  },
  
  hookStyle: function() {
    const element = document.querySelector('[data-hook-style]');
    return element ? element.dataset.hookStyle : 'none';
  },
  
  storyboardProgress: function() {
    const currentScene = parseInt(document.querySelector('.scene.active')?.dataset.scene || 0);
    const totalScenes = document.querySelectorAll('.scene').length;
    return totalScenes > 0 ? (currentScene / totalScenes * 100).toFixed(0) : 0;
  },
  
  engagementScore: function() {
    const interactions = window.userInteractions || [];
    const weights = { click: 5, scroll: 2, hover: 1, video_play: 10 };
    return interactions.reduce((score, action) => 
      score + (weights[action.type] || 0), 0
    );
  }
};
```

### Trigger Setup
```yaml
triggers:
  enhanced_engagement:
    type: "Timer"
    interval: 30000  # 30 seconds
    limit: 10
    conditions:
      - variable: "Page Path"
        operator: "contains"
        value: "/campaign"
        
  scroll_depth:
    type: "Scroll Depth"
    thresholds: [25, 50, 75, 90, 100]
    
  element_visibility:
    type: "Element Visibility"
    selector: ".cta-button, .persona-card, .storyboard-scene"
    threshold: 50  # 50% visible
    
  custom_events:
    type: "Custom Event"
    event_names:
      - hook_engagement
      - storyboard_completion
      - persona_interaction
      - workspace_action
```

---

## 2. Server-Side Tracking Configuration

### Server Container Setup
```javascript
// Google Cloud Run Configuration
const serverConfig = {
  endpoint: 'https://analytics.automarketing.com',
  region: 'us-central1',
  
  authentication: {
    method: 'API_KEY',
    key: process.env.SERVER_TRACKING_KEY,
    rotation: 'monthly'
  },
  
  routing: {
    ga4: {
      endpoint: '/g/collect',
      measurementId: process.env.GA4_MEASUREMENT_ID,
      apiSecret: process.env.GA4_API_SECRET
    },
    
    facebook: {
      endpoint: '/fb/events',
      pixelId: process.env.FB_PIXEL_ID,
      accessToken: process.env.FB_ACCESS_TOKEN
    },
    
    custom: {
      endpoint: '/custom/events',
      database: 'BigQuery',
      table: 'events_raw'
    }
  }
};
```

### Server-Side Event Processing
```python
# Python Flask server for server-side tracking
from flask import Flask, request, jsonify
import hashlib
import requests
from datetime import datetime

app = Flask(__name__)

class ServerTracker:
    def __init__(self):
        self.ga4_endpoint = 'https://www.google-analytics.com/mp/collect'
        self.fb_endpoint = 'https://graph.facebook.com/v15.0/PIXEL_ID/events'
        
    def hash_pii(self, value):
        """Hash PII data for privacy compliance"""
        return hashlib.sha256(value.encode()).hexdigest()
    
    def process_event(self, event_data):
        # Enrich event with server-side data
        enriched_event = {
            **event_data,
            'server_timestamp': datetime.utcnow().isoformat(),
            'ip_country': self.get_country_from_ip(request.remote_addr),
            'user_agent_parsed': self.parse_user_agent(request.headers.get('User-Agent')),
            'referrer_category': self.categorize_referrer(request.referrer)
        }
        
        # Hash any PII
        if 'email' in enriched_event:
            enriched_event['email_hash'] = self.hash_pii(enriched_event['email'])
            del enriched_event['email']
            
        return enriched_event
    
    def send_to_ga4(self, event):
        payload = {
            'client_id': event.get('client_id'),
            'events': [{
                'name': event.get('event_name'),
                'params': event.get('params', {})
            }]
        }
        
        response = requests.post(
            f"{self.ga4_endpoint}?measurement_id={GA4_ID}&api_secret={GA4_SECRET}",
            json=payload
        )
        return response.status_code == 204
    
    def send_to_facebook(self, event):
        payload = {
            'data': [{
                'event_name': event.get('event_name'),
                'event_time': int(datetime.utcnow().timestamp()),
                'user_data': {
                    'em': event.get('email_hash'),
                    'client_ip_address': request.remote_addr,
                    'client_user_agent': request.headers.get('User-Agent')
                },
                'custom_data': event.get('custom_data', {})
            }],
            'access_token': FB_ACCESS_TOKEN
        }
        
        response = requests.post(self.fb_endpoint, json=payload)
        return response.status_code == 200

@app.route('/track', methods=['POST'])
def track_event():
    tracker = ServerTracker()
    event_data = request.json
    
    # Process and enrich event
    processed_event = tracker.process_event(event_data)
    
    # Send to multiple platforms
    results = {
        'ga4': tracker.send_to_ga4(processed_event),
        'facebook': tracker.send_to_facebook(processed_event),
        'bigquery': store_in_bigquery(processed_event)
    }
    
    return jsonify({
        'success': all(results.values()),
        'results': results
    })
```

### Offline Conversion Tracking
```javascript
// Offline conversion upload
const offlineConversionUpload = {
  schedule: 'daily_at_3am',
  
  sources: {
    crm: {
      query: `
        SELECT 
          gclid,
          conversion_time,
          conversion_value,
          conversion_currency
        FROM conversions
        WHERE date = CURRENT_DATE - 1
          AND gclid IS NOT NULL
      `,
      
      transform: (data) => ({
        gclid: data.gclid,
        conversion_time: data.conversion_time + '.000Z',
        conversion_value: parseFloat(data.conversion_value),
        currency_code: data.conversion_currency
      })
    },
    
    phone_calls: {
      integration: 'CallRail',
      mapping: {
        phone_to_gclid: 'lookup_table',
        value_assignment: 'fixed_50'
      }
    }
  },
  
  upload: async function(conversions) {
    const auth = await getOAuthToken();
    
    const response = await fetch(
      `https://googleads.googleapis.com/v11/customers/${CUSTOMER_ID}/offlineUserDataJobs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operations: conversions.map(c => ({
            create: {
              userIdentifiers: [{ hashedEmail: c.email_hash }],
              transactions: [{
                conversionAction: `customers/${CUSTOMER_ID}/conversionActions/${CONVERSION_ACTION_ID}`,
                gclid: c.gclid,
                conversionDateTime: c.conversion_time,
                conversionValue: c.conversion_value,
                currencyCode: c.currency_code
              }]
            }
          }))
        })
      }
    );
    
    return response.json();
  }
};
```

---

## 3. Cross-Domain Tracking Implementation

### Configuration Setup
```javascript
// Cross-domain tracking configuration
const crossDomainConfig = {
  domains: [
    'automarketing.com',
    'app.automarketing.com',
    'shop.automarketing.com',
    'support.automarketing.com'
  ],
  
  // Google Analytics 4
  ga4Setup: {
    config: {
      linker: {
        domains: this.domains,
        accept_incoming: true,
        decorate_forms: true
      }
    }
  },
  
  // Custom implementation
  customImplementation: {
    sessionPersistence: {
      method: 'localStorage_sync',
      key: 'am_session',
      sync_interval: 1000
    },
    
    parameterPassing: {
      parameters: ['utm_source', 'utm_medium', 'utm_campaign', 'user_id', 'session_id'],
      method: 'url_decoration',
      expiry: 30 * 60 * 1000 // 30 minutes
    }
  }
};

// Link decoration function
function decorateLink(url) {
  const params = new URLSearchParams();
  
  // Add client ID
  params.append('_gl', getClientId());
  
  // Add session data
  params.append('_sid', getSessionId());
  
  // Add campaign parameters
  const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  utmParams.forEach(param => {
    const value = getURLParameter(param);
    if (value) params.append(param, value);
  });
  
  // Append to URL
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${params.toString()}`;
}

// Automatic link decoration
document.addEventListener('DOMContentLoaded', function() {
  const crossDomainLinks = document.querySelectorAll('a');
  
  crossDomainLinks.forEach(link => {
    const hostname = new URL(link.href).hostname;
    
    if (crossDomainConfig.domains.includes(hostname)) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = decorateLink(link.href);
      });
    }
  });
});
```

### iFrame Tracking
```javascript
// Cross-domain iFrame tracking
const iframeTracking = {
  parent: {
    setup: function() {
      window.addEventListener('message', function(event) {
        // Verify origin
        if (!crossDomainConfig.domains.includes(new URL(event.origin).hostname)) {
          return;
        }
        
        // Process tracking data
        if (event.data.type === 'tracking_event') {
          gtag('event', event.data.eventName, event.data.parameters);
        }
      });
    }
  },
  
  child: {
    sendEvent: function(eventName, parameters) {
      const message = {
        type: 'tracking_event',
        eventName: eventName,
        parameters: parameters,
        timestamp: Date.now()
      };
      
      window.parent.postMessage(message, '*');
    }
  }
};
```

---

## 4. Privacy Compliance Implementation

### GDPR Compliance
```javascript
// GDPR Cookie Consent Implementation
const gdprCompliance = {
  consentCategories: {
    necessary: {
      name: 'Necessary',
      description: 'Essential for website operation',
      required: true,
      cookies: ['session_id', 'csrf_token']
    },
    analytics: {
      name: 'Analytics',
      description: 'Help us understand usage',
      required: false,
      cookies: ['_ga', '_gid', 'fbp']
    },
    marketing: {
      name: 'Marketing',
      description: 'Personalized advertising',
      required: false,
      cookies: ['_gcl_au', 'fr', 'tr']
    }
  },
  
  implementation: {
    checkConsent: function() {
      const consent = localStorage.getItem('cookie_consent');
      return consent ? JSON.parse(consent) : null;
    },
    
    updateGtagConsent: function(consent) {
      gtag('consent', 'update', {
        'ad_storage': consent.marketing ? 'granted' : 'denied',
        'analytics_storage': consent.analytics ? 'granted' : 'denied',
        'functionality_storage': 'granted',
        'personalization_storage': consent.marketing ? 'granted' : 'denied',
        'security_storage': 'granted'
      });
    },
    
    initializeWithConsent: function() {
      // Default to denied
      gtag('consent', 'default', {
        'ad_storage': 'denied',
        'analytics_storage': 'denied',
        'wait_for_update': 500
      });
      
      // Check for existing consent
      const consent = this.checkConsent();
      if (consent) {
        this.updateGtagConsent(consent);
      } else {
        this.showConsentBanner();
      }
    }
  }
};
```

### CCPA Compliance
```javascript
// CCPA Privacy Rights Implementation
const ccpaCompliance = {
  detectCalifornia: function() {
    // Use IP geolocation or timezone
    return Intl.DateTimeFormat().resolvedOptions().timeZone.includes('Los_Angeles');
  },
  
  implementation: {
    optOutLink: function() {
      if (this.detectCalifornia()) {
        return `
          <a href="#" onclick="ccpaOptOut()">
            Do Not Sell My Personal Information
          </a>
        `;
      }
    },
    
    handleOptOut: function() {
      // Set opt-out cookie
      document.cookie = 'ccpa_opt_out=true;max-age=31536000;path=/';
      
      // Disable tracking
      window['ga-disable-' + GA_MEASUREMENT_ID] = true;
      
      // Notify user
      alert('Your data will not be sold. Tracking has been disabled.');
    },
    
    checkOptOut: function() {
      return document.cookie.includes('ccpa_opt_out=true');
    }
  }
};
```

### Data Retention Policy
```yaml
data_retention:
  user_data:
    retention_period: "14 months"
    deletion_method: "automated_purge"
    
  event_data:
    retention_period: "26 months"
    aggregation_after: "3 months"
    
  pii_data:
    encryption: "AES-256"
    hashing: "SHA-256"
    access_control: "role_based"
    
  deletion_requests:
    process_time: "30 days"
    verification_required: true
    scope: ["all_systems", "backups"]
```

---

## 5. Reporting Automation

### Automated Email Reports
```javascript
// Email Report Configuration
const emailReports = {
  daily: {
    schedule: '09:00 UTC',
    recipients: ['marketing@company.com'],
    template: 'daily_performance',
    
    metrics: [
      'sessions',
      'conversions',
      'revenue',
      'conversion_rate',
      'top_campaigns'
    ],
    
    format: {
      subject: 'Daily Performance Report - {{date}}',
      preheader: 'Revenue: {{revenue}} | Conversions: {{conversions}}',
      sections: [
        'executive_summary',
        'channel_performance',
        'campaign_highlights',
        'alerts_and_issues'
      ]
    }
  },
  
  weekly: {
    schedule: 'Monday 10:00 UTC',
    recipients: ['marketing@company.com', 'executives@company.com'],
    template: 'weekly_insights',
    
    content: {
      test_results: true,
      optimization_recommendations: true,
      competitive_analysis: true,
      upcoming_campaigns: true
    }
  },
  
  monthly: {
    schedule: 'First Monday of month',
    recipients: ['c-suite@company.com'],
    template: 'executive_dashboard',
    
    attachments: [
      'performance_deck.pdf',
      'detailed_analytics.xlsx',
      'campaign_roi.csv'
    ]
  }
};

// Report Generation Function
async function generateReport(config) {
  const data = await fetchReportData(config.metrics);
  const html = await renderTemplate(config.template, data);
  
  const report = {
    to: config.recipients,
    subject: interpolate(config.format.subject, data),
    html: html,
    attachments: await generateAttachments(config.attachments, data)
  };
  
  return sendEmail(report);
}
```

### Slack/Teams Notifications
```javascript
// Slack Integration
const slackNotifications = {
  webhook: process.env.SLACK_WEBHOOK_URL,
  
  alerts: {
    conversion_spike: {
      trigger: 'conversion_rate > baseline * 1.5',
      channel: '#marketing-wins',
      template: {
        text: '🎉 Conversion Rate Spike!',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Conversion rate increased to {{rate}}%*\nBaseline: {{baseline}}%\nIncrease: {{increase}}%`
            }
          }
        ]
      }
    },
    
    campaign_launched: {
      trigger: 'campaign_status = active',
      channel: '#marketing-campaigns',
      template: {
        text: '🚀 Campaign Launched: {{campaign_name}}'
      }
    },
    
    test_completed: {
      trigger: 'test_status = completed',
      channel: '#ab-testing',
      template: {
        text: '✅ Test Completed: {{test_name}}',
        blocks: [
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Winner:* {{winner}}`
              },
              {
                type: 'mrkdwn',
                text: `*Lift:* {{lift}}%`
              }
            ]
          }
        ]
      }
    }
  }
};

// Teams Integration
const teamsNotifications = {
  webhook: process.env.TEAMS_WEBHOOK_URL,
  
  sendAlert: async function(alert) {
    const card = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: alert.summary,
      themeColor: alert.color || '0078D7',
      sections: [
        {
          activityTitle: alert.title,
          activitySubtitle: alert.subtitle,
          facts: alert.facts || [],
          markdown: true
        }
      ],
      potentialAction: alert.actions || []
    };
    
    return fetch(this.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card)
    });
  }
};
```

### Executive Dashboard Access
```yaml
executive_dashboard:
  access_control:
    authentication: "SSO"
    roles:
      - executive_viewer
      - executive_admin
    
  custom_views:
    ceo_view:
      widgets:
        - revenue_trend
        - market_share
        - customer_acquisition_cost
        - lifetime_value
      
    cmo_view:
      widgets:
        - campaign_performance
        - channel_attribution
        - brand_metrics
        - competitive_analysis
    
    cfo_view:
      widgets:
        - revenue_forecast
        - budget_utilization
        - roi_by_channel
        - cost_analysis
  
  features:
    - drill_down_enabled
    - export_to_pdf
    - schedule_reports
    - annotations
    - goal_tracking
```

### Client Reporting Templates
```javascript
// White-label client reporting
const clientReporting = {
  templates: {
    standard: {
      branding: 'client_logo',
      sections: [
        'executive_summary',
        'performance_metrics',
        'campaign_results',
        'recommendations'
      ],
      
      customization: {
        colors: 'client_brand_colors',
        fonts: 'client_fonts',
        footer: 'client_contact_info'
      }
    },
    
    advanced: {
      includes_standard: true,
      additional_sections: [
        'competitive_analysis',
        'market_trends',
        'predictive_insights',
        'custom_analysis'
      ]
    }
  },
  
  delivery: {
    methods: ['email', 'client_portal', 'api'],
    frequency: ['daily', 'weekly', 'monthly', 'quarterly'],
    formats: ['pdf', 'interactive_html', 'powerpoint']
  },
  
  portal: {
    url: 'https://reports.automarketing.com',
    features: [
      'real_time_data',
      'historical_comparison',
      'export_capabilities',
      'comment_system'
    ]
  }
};
```

---

## 6. Proactive Activation Protocols

### Automatic Activation Triggers
```javascript
const proactiveActivation = {
  triggers: {
    visual_design_complete: {
      condition: 'phase_3_status = completed',
      actions: [
        'setup_tracking_codes',
        'configure_conversion_goals',
        'initialize_dashboards',
        'schedule_reports'
      ]
    },
    
    campaign_launch: {
      condition: 'campaign_status = pending_launch',
      actions: [
        'verify_tracking_implementation',
        'setup_utm_parameters',
        'configure_alerts',
        'initialize_a_b_tests'
      ]
    },
    
    performance_monitoring: {
      condition: 'campaign_status = active',
      actions: [
        'activate_real_time_monitoring',
        'enable_anomaly_detection',
        'start_optimization_protocols',
        'generate_insights'
      ]
    },
    
    optimization_opportunity: {
      condition: 'performance_below_threshold OR test_completed',
      actions: [
        'analyze_bottlenecks',
        'generate_recommendations',
        'create_test_hypotheses',
        'implement_improvements'
      ]
    }
  },
  
  execution: async function(trigger) {
    console.log(`Activating: ${trigger}`);
    
    for (const action of this.triggers[trigger].actions) {
      await this.executeAction(action);
    }
    
    // Log activation
    gtag('event', 'agent_activation', {
      agent: 'performance_optimizer',
      trigger: trigger,
      timestamp: Date.now()
    });
  }
};
```

### Continuous Optimization Loop
```javascript
// Automated optimization cycle
const continuousOptimization = {
  schedule: 'every_6_hours',
  
  cycle: async function() {
    // 1. Collect data
    const metrics = await this.collectMetrics();
    
    // 2. Analyze performance
    const analysis = await this.analyzePerformance(metrics);
    
    // 3. Identify opportunities
    const opportunities = await this.identifyOpportunities(analysis);
    
    // 4. Generate recommendations
    const recommendations = await this.generateRecommendations(opportunities);
    
    // 5. Implement changes
    for (const rec of recommendations) {
      if (rec.confidence > 0.8 && rec.risk < 0.2) {
        await this.autoImplement(rec);
      } else {
        await this.requestApproval(rec);
      }
    }
    
    // 6. Monitor results
    await this.scheduleResultsMonitoring(recommendations);
  },
  
  autoImplementable: [
    'bid_adjustments',
    'budget_reallocation',
    'keyword_pausing',
    'ad_scheduling',
    'audience_targeting'
  ]
};
```

---

## 7. Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Install Google Tag Manager
- [ ] Configure GA4 property
- [ ] Set up Facebook Pixel
- [ ] Implement basic tracking
- [ ] Configure data layer

### Phase 2: Advanced Tracking (Week 2)
- [ ] Set up server-side tracking
- [ ] Implement cross-domain tracking
- [ ] Configure enhanced ecommerce
- [ ] Set up custom events
- [ ] Implement offline conversions

### Phase 3: Privacy & Compliance (Week 3)
- [ ] Implement GDPR consent
- [ ] Configure CCPA compliance
- [ ] Set up data retention
- [ ] Implement PII hashing
- [ ] Document privacy policy

### Phase 4: Automation (Week 4)
- [ ] Configure automated reports
- [ ] Set up Slack/Teams alerts
- [ ] Build executive dashboards
- [ ] Create client templates
- [ ] Enable proactive activation

---

## 8. Validation & Testing

### Tracking Validation
```javascript
// Automated tracking validation
const trackingValidation = {
  tests: [
    {
      name: 'Page View Tracking',
      validate: () => {
        return window.dataLayer.some(event => 
          event.event === 'page_view'
        );
      }
    },
    {
      name: 'Conversion Tracking',
      validate: () => {
        // Trigger test conversion
        const testConversion = simulateConversion();
        return verifyInGA4(testConversion);
      }
    },
    {
      name: 'Cross-Domain Tracking',
      validate: () => {
        const links = document.querySelectorAll('a[href*="automarketing.com"]');
        return Array.from(links).every(link => 
          link.href.includes('_gl=')
        );
      }
    }
  ],
  
  runValidation: async function() {
    const results = [];
    
    for (const test of this.tests) {
      const passed = await test.validate();
      results.push({
        test: test.name,
        status: passed ? 'PASSED' : 'FAILED'
      });
    }
    
    return results;
  }
};
```

---

## Support & Documentation

### Resources
- Implementation Guide: `/docs/implementation`
- API Reference: `/docs/api`
- Troubleshooting: `/docs/troubleshooting`
- Best Practices: `/docs/best-practices`

### Technical Support
- Email: analytics-support@automarketing.com
- Slack: #analytics-help
- Documentation: https://docs.automarketing.com/analytics