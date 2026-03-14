// Phase 114-02: Force clean build — cache bust 2026-03-13
// Conditionally load bundle analyzer only when ANALYZE=true
let withBundleAnalyzer = (config) => config;
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
  // Use alternate build dir when NEXT_ALT_BUILD is set (avoids .next/trace lock conflicts)
  distDir: process.env.NEXT_ALT_BUILD || '.next',

  // Note: 'standalone' output is only needed for Docker deployments
  // Vercel handles deployment differently and doesn't need standalone mode
  output: process.env.DOCKER_BUILD === 'true' ? 'standalone' : undefined,
  reactStrictMode: true,

  // Enable gzip compression
  compress: true,

  // Power by header removal for security
  poweredByHeader: false,

  // TypeScript configuration
  // INTENTIONAL: Type checking runs in CI/locally via `npm run type-check`.
  // Skipped during Vercel build to avoid OOM on 8GB build machines (1400+ files).
  // QA-AUDIT-2026-03-14: Confirmed 0 real TS errors — CI enforcement is sufficient.
  typescript: {
    ignoreBuildErrors: true,
  },

  // ESLint configuration
  // INTENTIONAL: Next.js 15's internal ESLint runner passes deprecated options
  // (useEslintrc, extensions) incompatible with flat config (eslint.config.mjs).
  // Run ESLint separately via `npm run lint` or in CI.
  // QA-AUDIT-2026-03-14: Confirmed this is a known Next.js 15 incompatibility.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // HTTP headers for performance and security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Link',
            value: '<https://fonts.googleapis.com>; rel=preconnect, <https://fonts.gstatic.com>; rel=preconnect; crossorigin',
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
    ];
  },

  // Server-external packages (native/binary packages that shouldn't be bundled by webpack)
  serverExternalPackages: [
    '@ffprobe-installer/ffprobe',
    '@ffmpeg-installer/ffmpeg',
    'bullmq',
    'ioredis',
    'puppeteer',
    'puppeteer-screen-recorder',
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
      '@heroicons/react',
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
  webpack: (config, { dev, isServer }) => {
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
          '**/*.log'
        ]
      };
    }
    
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
    }
    
    return config;
  },
  // Ensure environment variables are available
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social',
  },
}

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
