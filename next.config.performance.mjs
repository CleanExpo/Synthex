/** @type {import('next').NextConfig} */

// Bundle analyzer setup
const withBundleAnalyzer = process.env.ANALYZE === 'true' 
  ? require('@next/bundle-analyzer')({ enabled: true })
  : (config) => config;

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  
  // Optimize production builds
  productionBrowserSourceMaps: false,
  
  // Experimental performance features
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
    optimizeCss: true,
    scrollRestoration: true,
  },
  
  // Image optimization
  images: {
    domains: [
      'localhost',
      'synthex.ai',
      'images.unsplash.com',
      'avatars.githubusercontent.com',
      'lh3.googleusercontent.com',
      'platform-lookaside.fbsbx.com',
      'pbs.twimg.com',
      'media.licdn.com',
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      {
        // Cache static assets
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache images
        source: '/_next/image(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
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
    ];
  },
  
  // Webpack optimizations
  webpack: (config, { dev, isServer, webpack }) => {
    // Production optimizations
    if (!dev && !isServer) {
      // Replace React with Preact in production (smaller bundle)
      // Commented out by default as it may cause compatibility issues
      // Object.assign(config.resolve.alias, {
      //   'react': 'preact/compat',
      //   'react-dom': 'preact/compat',
      // });
      
      // Optimize moment.js
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^\.\/locale$/,
          contextRegExp: /moment$/,
        })
      );
      
      // Tree shaking for lodash
      config.resolve.alias['lodash'] = 'lodash-es';
    }
    
    // Fix for server-side packages
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        dns: false,
        child_process: false,
      };
    }
    
    // Module federation for micro-frontends (optional)
    // Uncomment if you need to split the app into multiple deployments
    // if (!isServer) {
    //   config.plugins.push(
    //     new webpack.container.ModuleFederationPlugin({
    //       name: 'synthex',
    //       filename: 'static/chunks/remoteEntry.js',
    //       exposes: {},
    //       shared: {
    //         react: { singleton: true, requiredVersion: false },
    //         'react-dom': { singleton: true, requiredVersion: false },
    //       },
    //     })
    //   );
    // }
    
    return config;
  },
  
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  
  // Output configuration
  output: 'standalone',
  
  // Disable x-powered-by header
  poweredByHeader: false,
  
  // Enable ISR (Incremental Static Regeneration)
  staticPageGenerationTimeout: 60,
};

export default withBundleAnalyzer(nextConfig);