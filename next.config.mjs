// Phase 114-02: Force clean build — cache bust 2026-03-13
// Authority Hub routes (/clients/[slug]) use ISR with revalidate=3600.
// These pages carry LocalBusiness + VideoObject schema for E.E.A.T. positioning.
// See SYN-512, SYN-516 for architectural context.
// createRequire: used to resolve heroicons to CJS paths (avoids ESM .js sibling import bug in v2.2.0)
import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
const skipBuildTypecheck = process.env.NEXT_SKIP_BUILD_TYPECHECK === '1';

// Conditionally load bundle analyzer only when ANALYZE=true
let withBundleAnalyzer = config => config;
if (process.env.ANALYZE === 'true') {
  try {
    const analyzer = await import('@next/bundle-analyzer');
    withBundleAnalyzer = analyzer.default({ enabled: true });
  } catch (e) {
    console.warn('Bundle analyzer not available, skipping...');
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // heroicons ESM uses .js extension imports that Turbopack can't resolve natively.
  // transpilePackages handles this for webpack; resolveAlias below handles Turbopack dev.
  transpilePackages: ['@heroicons/react'],

  // Use alternate build dir when NEXT_ALT_BUILD is set (avoids .next/trace lock conflicts)
  distDir: process.env.NEXT_ALT_BUILD || '.next',

  // Note: 'standalone' output is only needed for Docker deployments
  // Vercel handles deployment differently and doesn't need standalone mode
  output: process.env.DOCKER_BUILD === 'true' ? 'standalone' : undefined,
  reactStrictMode: true,
  turbopack: {},

  // Enable gzip compression
  compress: true,

  // Power by header removal for security
  poweredByHeader: false,

  // TypeScript configuration.
  //
  // History: SYN-877 previously set `ignoreBuildErrors: true` because a
  // batch of `withRateLimit` references were missing imports, causing
  // build-time `tsc` to fail and blocking direct admin deploys. The
  // workaround masked the underlying TS2304 errors and let broken code
  // ship to production (root cause of the Vercel CFR 21.99% / DORA Low
  // baseline measured 2026-05-16). Resolution: imports restored across
  // 16 route files; the build-time TS check is re-enabled so it acts as
  // a real gate on both PR merges (via CI) and direct admin pushes.
  // Exception: constrained preview projects may set NEXT_SKIP_BUILD_TYPECHECK=1
  // because CI type-check is already a required gate and the duplicated Vercel
  // type-check can OOM on 8GB preview builders.
  typescript: {
    ignoreBuildErrors: skipBuildTypecheck,
  },

  // Redirects for renamed/removed routes
  async redirects() {
    return [
      { source: '/platform', destination: '/features', permanent: true },
      { source: '/solutions', destination: '/about', permanent: true },
    ];
  },

  // HTTP headers for performance and security
  async headers() {
    return [
      {
        // Security headers applied to every route
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:;",
          },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
      {
        // Additional security headers scoped to API routes
        source: '/api/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:;",
          },
        ],
      },
      {
        // Cache static assets aggressively
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache fonts
        source: '/fonts/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache browser-delivery media aggressively. Source files remain as
        // compatibility fallbacks; generated WebP/AVIF/WebM sidecars are
        // immutable once committed.
        source: '/videos/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/icons/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/brands/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source:
          '/:file(logo|synthex-logo|apple-touch-icon).:extension(webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Server-external packages (native/binary packages that shouldn't be bundled by webpack)
  serverExternalPackages: [
    '@ffprobe-installer/ffprobe',
    '@ffmpeg-installer/ffmpeg',
    'fluent-ffmpeg',
    'bullmq',
    'ioredis',
    'puppeteer',
    // jspdf uses fflate which uses new Worker({eval:true}) — webpack can't
    // resolve dynamic workers at build time. Mark as server-external so
    // Node.js requires them at runtime instead of bundling.
    'jspdf',
    'jspdf-autotable',
    'fflate',
    // googleapis has broken internal module refs (missing beta API files)
    // that cause webpack to fail. Must be required at runtime by Node.js.
    'googleapis',
    'google-auth-library',
    // jsdom (via isomorphic-dompurify in lib/sanitize.ts) pulls
    // html-encoding-sniffer@6 → @exodus/bytes, which ships ESM-only. When
    // webpack bundles that chain into a serverless function its CJS require()
    // hits the ESM module and throws ERR_REQUIRE_ESM at cold start, 500-ing the
    // whole function before the handler runs (e.g. /api/cron/autopilot never
    // ran — 0 AutopilotRun rows). Node's native require() loads the module fine,
    // so leave the chain external and let Node require it at runtime.
    'isomorphic-dompurify',
    'jsdom',
    // Phase 114-02: @sentry/nextjs + OTel packages REMOVED from dependencies.
    // They registered require-in-the-middle / import-in-the-middle hooks that
    // hung ALL Lambda cold starts for 10+ seconds. No longer needed here.
  ],

  // Experimental features
  experimental: {
    // Note: forceSwcTransforms removed — deprecated in Next.js 15 and causes
    // Turbopack warnings. SWC is the default transformer.

    // Reduce peak memory during the production webpack build. Synthex's app
    // graph (219 Prisma models, large route tree) pushed `next build --webpack`
    // RSS past the 16GB Vercel build container, SIGKILLing it with exit 137
    // (OOM). Builds went flaky from #516 onward — sometimes passing on retry,
    // sometimes OOMing at the ceiling. This flag trades a little compile speed
    // for materially lower retained memory and is Next.js's documented fix for
    // build-time OOM. See .claude/skills/vercel-build-doctor/SKILL.md.
    webpackMemoryOptimizations: true,

    // Optimize package imports for smaller bundles
    optimizePackageImports: [
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-tooltip',
      'framer-motion',
      'react-icons',
      'date-fns',
      'lodash',
      '@heroicons/react',
      'recharts',
    ],
  },

  // Fix: Next.js 16.2.0 bug – console-file.js has an unconditional top-level
  // require('../dev/browser-logs/file-logger') even though the function that
  // uses it is guarded by NODE_ENV === 'development'. NFT dead-code analysis
  // excludes the dev folder from the Lambda bundle, causing every Lambda to
  // crash on cold start with "Cannot find module '../dev/browser-logs/file-logger'".
  // Force-include the folder so Node.js can resolve the require at runtime.
  outputFileTracingIncludes: {
    '*': [
      './node_modules/next/dist/server/dev/browser-logs/**',
      // SYN-835: AU postcodes CSV must be bundled into Vercel functions
      // so lib/postcode/dataset-loader.ts can fs.readFile it at runtime.
      './lib/postcode/data/au-postcodes.csv',
      // Reference-library manifest is fs.readFileSync'd at runtime by
      // lib/services/ai/reference-library.ts (process.cwd()/public/...).
      // public/ is CDN-served, NOT in the Lambda fs, so without this the read
      // ENOENTs → empty manifest → reference grounding silently falls back to
      // the text-only path. Same failure mode as the SYN-835 CSV above.
      './public/reference-library/manifest.json',
      // Skill invocation (lib/ai/skills) reads these at runtime. They sit
      // outside the import graph, so NFT cannot discover them and every read
      // would ENOENT in production while working in dev — the same trap as the
      // two entries above.
      //
      // Only the skills allowlisted in lib/ai/skills/policy.ts are listed, not
      // all 83 (920 KB): it keeps the bundle to ~270 KB and makes a
      // non-invocable skill physically absent in production. The two lists are
      // kept in step by tests/unit/ai/skills/bundling.test.ts — add a skill to
      // the allowlist without adding it here and that test fails rather than
      // production.
      './.claude/skills/analytics-lead/SKILL.md',
      './.claude/skills/brand-voice-enforce/SKILL.md',
      './.claude/skills/client-retention/SKILL.md',
      './.claude/skills/creative-director/SKILL.md',
      './.claude/skills/cro-specialist/SKILL.md',
      './.claude/skills/customer-insights-lead/SKILL.md',
      './.claude/skills/email-specialist/SKILL.md',
      './.claude/skills/local-seo-geo-veteran/SKILL.md',
      './.claude/skills/marketing-operations-director/SKILL.md',
      './.claude/skills/paid-performance-marketer/SKILL.md',
      './.claude/skills/performance-attribution-lead/SKILL.md',
      './.claude/skills/platform-content-adaptor/SKILL.md',
      './.claude/skills/platform-content-optimiser/SKILL.md',
      './.claude/skills/pr-communications-lead/SKILL.md',
      './.claude/skills/research-lead/SKILL.md',
      './.claude/skills/senior-cmo/SKILL.md',
      './.claude/skills/senior-copywriter/SKILL.md',
      './.claude/skills/senior-strategist/SKILL.md',
      // Foundation documents cited by those skills' `foundation_authority`.
      // A missing one degrades to an explicit "unavailable" note in the prompt
      // rather than an error, so omitting one here fails quietly — hence the
      // same test also checks these resolve.
      './.claude/memory/ceo-foundation.md',
      './.claude/memory/gap-audit-playbooks.md',
      './.claude/memory/reporting-templates.md',
      './.claude/memory/skill-orchestration-spec.md',
      './.claude/memory/verification-gates.md',
    ],
  },

  // Comprehensive exclusions to speed up build tracing (moved from experimental in Next.js 15)
  outputFileTracingExcludes: {
    '*': [
      // Platform-specific binaries
      'node_modules/@swc/core-linux-x64-gnu',
      'node_modules/@swc/core-linux-x64-musl',
      'node_modules/@swc/core-win32-x64-msvc',
      'node_modules/@swc/core-darwin-x64',
      'node_modules/@swc/core-darwin-arm64',
      'node_modules/@esbuild/linux-x64',
      'node_modules/@esbuild/darwin-x64',
      'node_modules/@esbuild/win32-x64',
      'node_modules/esbuild',
      'node_modules/sharp',
      // Testing tools
      'node_modules/playwright',
      'node_modules/@playwright',
      'node_modules/jest',
      'node_modules/@testing-library',
      'node_modules/cypress',
      // Dev tools
      'node_modules/storybook',
      'node_modules/@storybook',
      'node_modules/typescript',
      'node_modules/eslint',
      'node_modules/prettier',
      'node_modules/husky',
      'node_modules/lint-staged',
      // Build tools
      'node_modules/webpack',
      'node_modules/rollup',
      'node_modules/terser',
      'node_modules/@babel',
      'node_modules/babel-*',
      'node_modules/tsx',
      'node_modules/ts-node',
      'node_modules/concurrently',
      'node_modules/turbo',
      // Directories
      '.git',
      '.next/cache',
      '.vercel',
      '.husky',
      '.github',
      'tests',
      'stories',
      'coverage',
      'backup-before-cleanup',
      'deployment',
      'monitoring',
      'logs',
      // Large unused packages
      'node_modules/@next/bundle-analyzer',
      'node_modules/prisma/engines',
      // Large media/video binaries — must be excluded or functions exceed 250MB.
      // These are in serverExternalPackages (not webpack-bundled) but NFT still
      // traces their binary files into the deployment artifact without these exclusions.
      // NOTE: @ffmpeg-installer/@ffprobe-installer are NOT excluded here — see the
      // route-keyed entries below (SYN-1096).
      'node_modules/puppeteer/**',
      'node_modules/puppeteer-core/**',
      // Prisma schema/migration engines — build tools, NOT needed at runtime.
      // DO NOT exclude .prisma/client/libquery_engine-* — that is the runtime
      // query engine binary and Prisma will crash without it on Vercel.
      'node_modules/@prisma/engines/**',
    ],
    // SYN-1096: ffmpeg/ffprobe binaries were excluded under '*', which made
    // GET /api/cron/video-production 500 on every scheduled run — the route's
    // pipeline (lib/video/video-orchestrator.ts) requires
    // '@ffmpeg-installer/ffmpeg' at runtime (serverExternalPackages) and the
    // binary was stripped from the function bundle ("Cannot find module").
    // In Next 16 excludes are applied AFTER outputFileTracingIncludes
    // (collect-build-traces applies includes first, then filters the combined
    // set), so a route-scoped include CANNOT win over a '*' exclude. The only
    // working shape is the inverse: drop the installers from '*' and re-exclude
    // them on the routes that trace the installers but must NOT ship them.
    // Executing consumers that DO carry the binaries (~147MB linux-x64 pair each):
    // /api/cron/video-production and /api/cron/social-cut-render — both spawn
    // ffmpeg/ffprobe at runtime (lib/video/video-processor.ts,
    // lib/video/social-cut-renderer.ts).
    // '/api/video' matches all /api/video/** entries by substring: those routes
    // trace the installer imports through lib/video but never execute a render
    // in-function, so they keep the pre-existing exclusion to stay under the
    // 250MB function limit.
    '/api/video': [
      'node_modules/@ffmpeg-installer/**',
      'node_modules/@ffprobe-installer/**',
    ],
  },

  // Image optimization
  images: {
    // Enable remote images from these domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'pbs.twimg.com',
      },
      {
        protocol: 'https',
        hostname: 'platform-lookaside.fbsbx.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
    // Optimize images
    formats: ['image/avif', 'image/webp'],
    // Minimize number of image sizes generated
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // Webpack configuration
  webpack: (config, { dev, isServer, nextRuntime }) => {
    // SYN-910 / HER-1b — stub @linear/sdk out of the Edge runtime bundle.
    // The SDK's webhooks submodule does `import crypto from 'crypto'`. Edge
    // runtime has no node:crypto. instrumentation.ts is bundled for Edge and
    // pulls in lib/alerts/notification-channels.ts → lib/linear/client.ts →
    // @linear/sdk. Aliasing the SDK to `false` replaces the import with a
    // stub in the Edge bundle. Linear escalations only fire from Node-only
    // HERMES cron routes, so the stub never executes.
    if (nextRuntime === 'edge') {
      config.resolve = config.resolve ?? {};
      config.resolve.alias = {
        ...config.resolve.alias,
        '@linear/sdk': false,
      };
      // SYN P1 (#379) — instrumentation.ts now also pulls in the encryption-keys
      // startup self-test, whose chain (lib/encryption, lib/security/field-encryption,
      // lib/encryption/api-key-encryption) does `import crypto from 'crypto'`. Edge has
      // no node 'crypto' (and rejects the `node:crypto` scheme), but the self-test is
      // guarded to run ONLY in the Node.js runtime, so stub crypto out of the Edge
      // bundle — same approach as the client fallback below. Without this, `next build`
      // fails with "Module not found: Can't resolve 'crypto'" in the Edge compilation.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
      };
    }

    // File watcher optimization for Windows - fixes terminal freezing
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000, // Use polling mode (check every 1 second)
        aggregateTimeout: 300, // Delay rebuild after first change
        ignored: [
          '**/node_modules',
          '**/.git',
          '**/.next',
          '**/dist',
          '**/build',
          '**/.vercel',
          '**/logs',
          '**/backup-before-cleanup',
          '**/deployment',
          '**/monitoring',
          '**/coverage',
          '**/.cache',
          '**/tmp',
          '**/*.log',
        ],
      };
    }

    // Force heroicons to CJS entry points — their ESM build (v2.2.0) is missing
    // CalendarDaysIcon.js and other files, causing "Module not found" errors in
    // both webpack and Turbopack. _require.resolve() uses the 'require' condition
    // from package exports, which points to the complete CJS build.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@heroicons/react/24/outline': _require.resolve(
        '@heroicons/react/24/outline'
      ),
      '@heroicons/react/24/solid': _require.resolve(
        '@heroicons/react/24/solid'
      ),
      '@heroicons/react/20/solid': _require.resolve(
        '@heroicons/react/20/solid'
      ),
      '@heroicons/react/16/solid': _require.resolve(
        '@heroicons/react/16/solid'
      ),
    };

    // Existing fallback configuration
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        dns: false,
        child_process: false,
        pg: false,
        'pg-native': false,
      };

      // canvg (used by jspdf for SVG-in-PDF) depends on core-js internals that
      // were removed in core-js 3.x. Stub it out with an empty module so jspdf
      // loads in the browser bundle. SVG embedding in PDFs is not used here.
      config.resolve.alias = {
        ...config.resolve.alias,
        canvg: new URL('./lib/empty-module.cjs', import.meta.url).pathname,
      };
    }

    return config;
  },
  // Ensure environment variables are available
  env: {
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social',
  },
};

// Sentry webpack plugin config — kept for reference but NOT applied.
//
// WHY REMOVED: @sentry/nextjs v8.55.0 ignores both `disableServerWebpackPlugin: true`
// and `autoInstrumentServerFunctions: false` (silently). The webpack plugin injects
// `wrapRouteHandlerWithSentry` into EVERY route bundle (confirmed in .next/server/app/api/
// health/live/route.js) plus `require-in-the-middle` / `import-in-the-middle` OTel hooks.
// These hooks hang the Lambda for exactly 10 s on cold start (the TCP connection timeout).
//
// Server error capture still works via instrumentation.ts → Sentry.init() (lazy, post-bundle-load).
// Client error capture still works via sentry.client.config.ts.
// Source map upload was already disabled (1424 files exceed the 45-min Vercel build timeout).
//
// To re-enable when Sentry fixes the serverless hang, uncomment the export line below
// and comment out the plain export.
const _sentryConfig_DISABLED = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  hideSourceMaps: false,
  disableLogger: process.env.NODE_ENV === 'development',
  tunnelRoute: '/monitoring',
  autoInstrumentServerFunctions: false,
  disableServerWebpackPlugin: true,
  sourcemaps: { disable: true },
};

// Export WITHOUT Sentry webpack plugin — prevents Lambda cold-start hang.
// Re-enable with: export default withSentryConfig(withBundleAnalyzer(nextConfig), _sentryConfig_DISABLED);
export default withBundleAnalyzer(nextConfig);
