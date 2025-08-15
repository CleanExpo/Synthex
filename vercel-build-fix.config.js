/**
 * Vercel Build Configuration Fix
 * This file contains build optimizations for Vercel deployment
 */

module.exports = {
  // Increase Node.js memory allocation for build process
  env: {
    NODE_OPTIONS: '--max-old-space-size=7680', // 7.5GB for 8GB container
  },
  
  // Build optimization settings
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Ignore optional dependencies that cause issues
    config.externals = config.externals || [];
    
    // Add fallbacks for Node.js modules not available in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        path: false,
        zlib: false,
        http: false,
        https: false,
        stream: false,
        os: false,
      };
    }
    
    // Optimize build performance
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          framework: {
            name: 'framework',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            priority: 40,
            enforce: true,
          },
          lib: {
            test: /[\\/]node_modules[\\/]/,
            name(module) {
              const packageName = module.context.match(
                /[\\/]node_modules[\\/](.*?)([[\\/]|$)/
              )?.[1];
              return `npm.${packageName?.replace('@', '')}`;
            },
            priority: 30,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          commons: {
            name: 'commons',
            minChunks: 2,
            priority: 20,
          },
        },
      },
    };
    
    return config;
  },
  
  // TypeScript configuration for build
  typescript: {
    // Allow production builds to succeed even with TypeScript errors
    ignoreBuildErrors: false,
    tsconfigPath: './tsconfig.build.json',
  },
  
  // Experimental features for better performance
  experimental: {
    // Use SWC for faster builds
    forceSwcTransforms: true,
    // Optimize CSS
    optimizeCss: true,
    // Reduce build trace file size
    outputFileTracingExcludes: {
      '*': [
        'node_modules/@swc/core-linux-x64-gnu',
        'node_modules/@swc/core-linux-x64-musl',
        'node_modules/@esbuild/linux-x64',
        'node_modules/webpack',
        'node_modules/rollup',
      ],
    },
  },
  
  // Image optimization
  images: {
    domains: ['localhost', 'vercel.app'],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  
  // Output configuration
  output: 'standalone',
  
  // Disable source maps in production for smaller builds
  productionBrowserSourceMaps: false,
  
  // Compress output
  compress: true,
  
  // Clean dist directory before build
  cleanDistDir: true,
};