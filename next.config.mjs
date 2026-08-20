import { createRequire } from 'module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const _require = createRequire(import.meta.url);
const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const skipBuildTypecheck = process.env.NEXT_SKIP_BUILD_TYPECHECK === '1';

let withBundleAnalyzer = config => config;
if (process.env.ANALYZE === 'true') {
  try {
    const analyzer = await import('@next/bundle-analyzer');
    withBundleAnalyzer = analyzer.default({ enabled: true });
  } catch {
    console.warn('Bundle analyzer not available, skipping...');
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@heroicons/react'],
  distDir: process.env.NEXT_ALT_BUILD || '.next',
  output: process.env.DOCKER_BUILD === 'true' ? 'standalone' : undefined,
  reactStrictMode: true,
  turbopack: {
    root: repoRoot,
  },
  compress: true,
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: skipBuildTypecheck,
  },
  async redirects() {
    return [
      { source: '/platform', destination: '/features', permanent: true },
      { source: '/solutions', destination: '/about', permanent: true },
    ];
  },
  async headers() {
    return [
      {
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
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/fonts/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
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
  serverExternalPackages: [
    '@ffprobe-installer/ffprobe',
    '@ffmpeg-installer/ffmpeg',
    'fluent-ffmpeg',
    'bullmq',
    'ioredis',
    'puppeteer',
    'jspdf',
    'jspdf-autotable',
    'fflate',
    'googleapis',
    'google-auth-library',
    'isomorphic-dompurify',
    'jsdom',
  ],
  experimental: {
    webpackMemoryOptimizations: true,
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
  outputFileTracingIncludes: {
    '*': [
      './node_modules/next/dist/server/dev/browser-logs/**',
      './lib/postcode/data/au-postcodes.csv',
      './public/reference-library/manifest.json',
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
      './.claude/memory/ceo-foundation.md',
      './.claude/memory/gap-audit-playbooks.md',
      './.claude/memory/reporting-templates.md',
      './.claude/memory/skill-orchestration-spec.md',
      './.claude/memory/verification-gates.md',
    ],
  },
  outputFileTracingExcludes: {
    '*': [
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
      'node_modules/playwright',
      'node_modules/@playwright',
      'node_modules/jest',
      'node_modules/@testing-library',
      'node_modules/cypress',
      'node_modules/typescript',
      'node_modules/eslint',
      'node_modules/prettier',
      'node_modules/husky',
      'node_modules/lint-staged',
      'node_modules/webpack',
      'node_modules/rollup',
      'node_modules/terser',
      'node_modules/@babel',
      'node_modules/babel-*',
      'node_modules/tsx',
      'node_modules/ts-node',
      'node_modules/turbo',
      '.git',
      '.next/cache',
      '.vercel',
      '.husky',
      '.github',
      'tests',
      'coverage',
      'logs',
      'node_modules/@next/bundle-analyzer',
      'node_modules/prisma/engines',
      'node_modules/puppeteer/**',
      'node_modules/puppeteer-core/**',
      'node_modules/@prisma/engines/**',
    ],
    '/api/video': [
      'node_modules/@ffmpeg-installer/**',
      'node_modules/@ffprobe-installer/**',
    ],
  },
  images: {
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
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  webpack: (config, { dev, isServer, nextRuntime }) => {
    if (nextRuntime === 'edge') {
      config.resolve = config.resolve ?? {};
      config.resolve.alias = {
        ...config.resolve.alias,
        '@linear/sdk': false,
      };
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
      };
    }

    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: [
          '**/node_modules',
          '**/.git',
          '**/.next',
          '**/dist',
          '**/build',
          '**/.vercel',
          '**/logs',
          '**/coverage',
          '**/.cache',
          '**/tmp',
          '**/*.log',
        ],
      };
    }

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

      config.resolve.alias = {
        ...config.resolve.alias,
        canvg: new URL('./lib/empty-module.cjs', import.meta.url).pathname,
      };
    }

    return config;
  },
  env: {
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social',
  },
};

export default withBundleAnalyzer(nextConfig);
