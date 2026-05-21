/**
 * Lighthouse CI Configuration
 *
 * Performance budgets and thresholds for automated performance testing.
 * Lighthouse analyses web app performance, accessibility, SEO, and best practices.
 *
 * Installation:
 * - npm install -D @lhci/cli
 *
 * Usage:
 * - Local: npm run lighthouse
 * - CI: Runs automatically in GitHub Actions
 *
 * Documentation:
 * https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
 */

module.exports = {
  ci: {
    collect: {
      // Number of runs per URL (more runs = more reliable averages)
      numberOfRuns: 1,

      // Chrome flags
      settings: {
        // Use headless Chrome
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',

        // Throttling settings (emulate slow 4G)
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          requestLatencyMs: 0,
          downloadThroughputKbps: 1638.4,
          uploadThroughputKbps: 675,
          cpuSlowdownMultiplier: 4,
        },

        // Emulate mobile device
        emulatedFormFactor: 'mobile',

        // Screen emulation
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 667,
          deviceScaleFactor: 2,
          disabled: false,
        },
      },
    },

    assert: {
      assertions: {
        // Core Web Vitals
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }], // FCP < 2s
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }], // LCP < 2.5s
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }], // CLS < 0.1
        'total-blocking-time': ['warn', { maxNumericValue: 300 }], // TBT < 300ms
        'speed-index': ['warn', { maxNumericValue: 3000 }], // SI < 3s

        // Overall scores (0-1, where 0.9 = 90%)
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],

        // Accessibility
        'color-contrast': 'error',
        'html-has-lang': 'error',
        'image-alt': 'error',
        'label': 'error',
        'meta-viewport': 'error',
        'aria-allowed-attr': 'error',
        'aria-required-attr': 'error',
        'aria-valid-attr': 'error',
        'button-name': 'error',
        'document-title': 'error',
        'link-name': 'error',

        // Best Practices
        'errors-in-console': 'warn',
        'uses-https': 'off',
        'no-vulnerable-libraries': 'off',
        'csp-xss': 'warn',
        'deprecations': 'warn',

        // Performance
        'uses-responsive-images': 'warn',
        'uses-optimized-images': 'warn',
        'modern-image-formats': 'warn',
        // Vercel serves production compression at the edge, but Lighthouse can
        // include third-party/static responses in this audit. Keep it visible
        // without treating provider-controlled responses as release blockers.
        'uses-text-compression': 'warn',
        'uses-rel-preconnect': 'warn',
        'font-display': 'warn',
        'unminified-css': 'error',
        'unminified-javascript': 'error',
        'unused-css-rules': 'warn',
        'unused-javascript': 'warn',
        'efficient-animated-content': 'warn',
        'total-byte-weight': ['warn', { maxNumericValue: 1000000 }], // < 1MB

        // SEO
        'meta-description': 'error',
        'robots-txt': 'warn',
        'canonical': 'warn',
        // Lighthouse 13 no longer emits a stable structured-data score. JSON-LD
        // is covered by app/layout.tsx and search-console validation instead.
        'structured-data': 'off',

        // PWA (disabled — not a PWA)
        'viewport': 'error',
        'installable-manifest': 'off',
        'service-worker': 'off',
        'works-offline': 'off',
      },
    },

    upload: {
      // Upload results to temporary public storage (30 days)
      target: 'temporary-public-storage',

      // To use LHCI server, uncomment and configure:
      // target: 'lhci',
      // serverBaseUrl: 'https://your-lhci-server.com',
      // token: process.env.LHCI_TOKEN,
    },
  },
}
