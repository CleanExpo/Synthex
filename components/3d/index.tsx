/**
 * 3D Components - Dynamic Import Wrappers
 *
 * These components use @react-three/fiber and three.js which are heavy libraries.
 * They are dynamically imported to reduce initial bundle size.
 *
 * Usage:
 *   import { ActivityStream3D, SocialNetworkOrb } from '@/components/3d';
 *
 * Or use the loading wrapper:
 *   import { DynamicActivityStream3D } from '@/components/3d';
 *
 * @version 2.0.0
 * @updated 2026-01-18
 */

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Loading placeholder component
const LoadingPlaceholder = ({ height = '500px' }: { height?: string }) => (
  <div
    style={{ height }}
    className="w-full flex items-center justify-center bg-gradient-to-br from-purple-900/20 to-indigo-900/20 rounded-lg animate-pulse"
  >
    <div className="text-center">
      <div className="w-12 h-12 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
      <p className="text-sm text-gray-400">Loading 3D visualization...</p>
    </div>
  </div>
);

// Error boundary placeholder
const ErrorPlaceholder = ({ error }: { error?: Error }) => (
  <div className="w-full h-[500px] flex items-center justify-center bg-red-900/10 rounded-lg border border-red-500/20">
    <div className="text-center">
      <p className="text-red-400 mb-2">Failed to load 3D component</p>
      <p className="text-xs text-gray-500">{error?.message || 'Unknown error'}</p>
    </div>
  </div>
);

// =============================================================================
// Dynamic Imports - These split the bundle and load on demand
// =============================================================================

/**
 * Dynamic ActivityStream3D - loads Three.js only when rendered
 */
export const DynamicActivityStream3D = dynamic(
  () => import('./ActivityStream3D').then((mod) => mod.default),
  {
    loading: () => <LoadingPlaceholder height="500px" />,
    ssr: false, // Three.js requires browser APIs
  }
);

/**
 * Dynamic SocialNetworkOrb - loads Three.js only when rendered
 */
export const DynamicSocialNetworkOrb = dynamic(
  () => import('./SocialNetworkOrb').then((mod) => mod.default),
  {
    loading: () => <LoadingPlaceholder height="400px" />,
    ssr: false,
  }
);

/**
 * Dynamic FloatingPostCard - loads Three.js only when rendered
 */
export const DynamicFloatingPostCard = dynamic(
  () => import('./FloatingPostCard').then((mod) => mod.default),
  {
    loading: () => <LoadingPlaceholder height="300px" />,
    ssr: false,
  }
);

// =============================================================================
// Re-exports for direct imports (when dynamic loading not needed)
// =============================================================================

// These are for cases where the component is definitely needed
// and you want to pre-load it in the main bundle
export { default as ActivityStream3D } from './ActivityStream3D';
export { default as SocialNetworkOrb } from './SocialNetworkOrb';
export { default as FloatingPostCard } from './FloatingPostCard';

// =============================================================================
// Prefetch utility - preload 3D components when likely to be needed
// =============================================================================

/**
 * Prefetch 3D components to warm the cache
 * Call this when user hovers over a section that will show 3D content
 */
export async function prefetch3DComponents(): Promise<void> {
  const components = [
    () => import('./ActivityStream3D'),
    () => import('./SocialNetworkOrb'),
    () => import('./FloatingPostCard'),
  ];

  await Promise.all(components.map((load) => load().catch(() => null)));
}
