// Phase 114-02: Force clean build — cache bust 2026-03-13
// Authority Hub routes (/clients/[slug]) use ISR with revalidate=3600.
// These pages carry LocalBusiness + VideoObject schema for E.E.A.T. positioning.
// See SYN-512, SYN-516 for architectural context.
// createRequire: used to resolve heroicons to CJS paths (avoids ESM .js sibling import bug in v2.2.0)
import { createRequire } from 'module';
const _require = createRequire(import.meta.url);

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
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://api.fontshare.com; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' https: data:;",
          },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Link',
            value: '<https://api.fontshare.com>; rel=preconnect; crossorigin',
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
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://api.fontshare.com; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' https: data:;",
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
        source: '/:file(logo|synthex-logo|apple-touch-icon).:extension(webp|avif)',
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
    // Phase 114-02: @sentry/nextjs + OTel packages REMOVED from dependencies.
    // They registered require-in-the-middle / import-in-the-middle hooks that
    // hung ALL Lambda cold starts for 10+ seconds. No longer needed here.
  ],

  // Experimental features
  experimental: {
    // Note: forceSwcTransforms removed — deprecated in Next.js 15 and causes
    // Turbopack warnings. SWC is the default transformer.

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
      'lucide-react',
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
      'node_modules/@ffmpeg-installer/**',
      'node_modules/@ffprobe-installer/**',
      'node_modules/puppeteer/**',
      'node_modules/puppeteer-core/**',
      // Prisma schema/migration engines — build tools, NOT needed at runtime.
      // DO NOT exclude .prisma/client/libquery_engine-* — that is the runtime
      // query engine binary and Prisma will crash without it on Vercel.
      'node_modules/@prisma/engines/**',
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
