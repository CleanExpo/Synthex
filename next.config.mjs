// Conditionally load bundle analyzer only when ANALYZE=true
const withBundleAnalyzer = process.env.ANALYZE === 'true'
  ? (await import('@next/bundle-analyzer')).default({ enabled: true })
  : (config) => config;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Required for Docker deployments
  reactStrictMode: true,

  // TypeScript configuration
  typescript: {
    // We'll see TypeScript errors now but won't block builds for non-critical issues
    ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    // Disable ESLint during builds to prevent blocking on Vercel
    ignoreDuringBuilds: true,
  },

  // Experimental features
  experimental: {
    forceSwcTransforms: true,
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
      };
    }
    
    return config;
  },
  // Ensure environment variables are available
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.vercel.app',
  },
}

// Export with bundle analyzer wrapper
export default withBundleAnalyzer(nextConfig);
