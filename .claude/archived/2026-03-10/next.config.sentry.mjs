import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    // Temporarily disabled due to false positives
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
    optimizeCss: false,
    scrollRestoration: true,
  },
  productionBrowserSourceMaps: true, // Enable for Sentry
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { 
      exclude: ['error', 'warn', 'info'] 
    } : false,
  },
  
  modularizeImports: {
    '@heroicons/react': {
      transform: '@heroicons/react/24/outline/{{member}}',
    },
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },
  
  images: {
    domains: [
      'localhost',
      'synthex.ai',
      'synthex.social',
      'images.unsplash.com',
      'avatars.githubusercontent.com',
      'lh3.googleusercontent.com',
      'platform-lookaside.fbsbx.com',
      'pbs.twimg.com',
      'media.licdn.com',
    ],
  },
  
  async headers() {
    const allowedOrigin = process.env.NODE_ENV === 'production' 
      ? 'https://synthex.social'
      : 'http://localhost:3000';
    
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: allowedOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, sentry-trace, baggage' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: '/api/:path*',
      },
      {
        source: '/api/v2/users/:path*',
        destination: '/api/user/:path*',
      },
      {
        source: '/api/v2/ai-content/generate',
        destination: '/api/ai/generate-content',
      },
      {
        source: '/api/v2/:path*',
        destination: '/api/:path*',
      },
    ];
  },
  
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
  
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Organization and project from your Sentry account
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  
  // Auth token for uploading source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,
  
  // Suppresses source map uploading logs during build
  silent: true,
  
  // Upload source maps for production builds
  hideSourceMaps: false,
  
  // Automatically release tracking
  autoInstrumentServerFunctions: true,
  
  // Tree shake Sentry code in development
  disableLogger: process.env.NODE_ENV === 'development',
  
  // Tunneling to avoid ad blockers
  tunnelRoute: "/monitoring",
  
  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
};

// Export with Sentry wrapper
export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);