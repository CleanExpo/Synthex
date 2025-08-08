/** @type {import('next').NextConfig} */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// CDN Configuration
const CDN_ENABLED = process.env.CDN_ENABLED === 'true';
const CDN_URL = process.env.CDN_URL || '';

const nextConfig = {
  // Basic configuration
  reactStrictMode: true,
  swcMinify: true,
  
  // CDN and asset optimization
  assetPrefix: CDN_ENABLED && CDN_URL ? CDN_URL : undefined,
  
  // Image optimization
  images: {
    domains: [
      'synthex.social',
      'synthex.vercel.app',
      'localhost'
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [320, 420, 768, 1024, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400, // 1 day
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Compression and performance
  compress: true,
  poweredByHeader: false,
  generateEtags: true,

  // Build optimization
  experimental: {
    // Enable modern output for better performance
    outputFileTracingRoot: undefined,
    
    // Enable SWC minification
    swcMinify: true,
    
    // Modern JavaScript
    modernMode: true,
    
    // Optimize CSS
    optimizeCss: isProduction,
    
    // Enable font optimization
    optimizeFonts: true,
  },

  // Webpack configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Asset optimization
    if (isProduction) {
      // Add asset manifest generation
      config.plugins.push(
        new webpack.DefinePlugin({
          'process.env.BUILD_ID': JSON.stringify(buildId),
          'process.env.CDN_ENABLED': JSON.stringify(CDN_ENABLED),
          'process.env.CDN_URL': JSON.stringify(CDN_URL),
        })
      );
    }

    // Handle CSS optimization
    if (CDN_ENABLED && isProduction) {
      // Optimize CSS imports
      config.module.rules.push({
        test: /\.css$/,
        use: [
          defaultLoaders.babel,
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
              sourceMap: false,
              modules: false,
            }
          }
        ]
      });
    }

    // Bundle analyzer
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
        })
      );
    }

    return config;
  },

  // Headers for security and caching
  async headers() {
    const headers = [];

    // Static asset caching
    headers.push({
      source: '/static/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
        {
          key: 'Access-Control-Allow-Origin',
          value: '*',
        },
      ],
    });

    // Image optimization headers
    headers.push({
      source: '/:path*\\.(jpg|jpeg|png|gif|webp|avif|ico|svg)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=86400, s-maxage=86400',
        },
        {
          key: 'Vary',
          value: 'Accept',
        },
      ],
    });

    // Font optimization
    headers.push({
      source: '/:path*\\.(woff|woff2|eot|ttf|otf)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
        {
          key: 'Access-Control-Allow-Origin',
          value: '*',
        },
      ],
    });

    // CSS and JS caching
    headers.push({
      source: '/_next/static/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    });

    // API headers
    headers.push({
      source: '/api/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=300, s-maxage=300',
        },
        {
          key: 'Access-Control-Allow-Origin',
          value: '*',
        },
        {
          key: 'Access-Control-Allow-Methods',
          value: 'GET, POST, PUT, DELETE, OPTIONS',
        },
        {
          key: 'Access-Control-Allow-Headers',
          value: 'Content-Type, Authorization',
        },
      ],
    });

    // Security headers
    if (isProduction) {
      headers.push({
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
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
        ],
      });
    }

    return headers;
  },

  // Redirects and rewrites
  async redirects() {
    return [
      // Redirect old paths if needed
    ];
  },

  async rewrites() {
    return [
      // API rewrites if needed
    ];
  },

  // Environment variables
  env: {
    CDN_ENABLED: CDN_ENABLED,
    CDN_URL: CDN_URL,
    BUILD_TIME: new Date().toISOString(),
  },

  // Output configuration
  output: 'standalone',
  
  // Disable source maps in production for security
  productionBrowserSourceMaps: false,

  // Optimize builds
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  // Static optimization
  unstable_includeFiles: [
    'node_modules/next/dist/compiled/@edge-runtime/primitives/**/*.+(js|json)',
    'node_modules/next/dist/compiled/undici/**/*.+(js|json)',
  ],
};

// Additional configuration for development
if (isDevelopment) {
  nextConfig.experimental = {
    ...nextConfig.experimental,
    // Fast refresh
    fastRefresh: true,
    // Better error overlay
    errorOverlay: true,
  };
}

module.exports = nextConfig;