/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Required for Docker deployments
  reactStrictMode: true,
  typescript: {
    // We'll see TypeScript errors now but won't block builds for non-critical issues
    ignoreBuildErrors: false,
  },
  eslint: {
    // Disable ESLint during builds to prevent blocking on Vercel
    ignoreDuringBuilds: true,
  },
  experimental: {
    forceSwcTransforms: true,
  },
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

export default nextConfig;
