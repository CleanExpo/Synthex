'use client';

import dynamic from 'next/dynamic';
import { Skeleton, SkeletonChart, SkeletonCard } from '@/components/ui/skeleton';

// Lazy load heavy chart components
export const LazyLineChart = dynamic(
  () => import('recharts').then(mod => mod.LineChart),
  { 
    loading: () => <SkeletonChart />,
    ssr: false 
  }
);

export const LazyAreaChart = dynamic(
  () => import('recharts').then(mod => mod.AreaChart),
  { 
    loading: () => <SkeletonChart />,
    ssr: false 
  }
);

export const LazyBarChart = dynamic(
  () => import('recharts').then(mod => mod.BarChart),
  { 
    loading: () => <SkeletonChart />,
    ssr: false 
  }
);

// Note: DashboardCharts and ContentGenerator components need to be created
// export const LazyDashboardCharts = dynamic(
//   () => import('@/components/DashboardCharts'),
//   {
//     loading: () => (
//       <div className="grid gap-4 md:grid-cols-2">
//         <SkeletonChart />
//         <SkeletonChart />
//       </div>
//     ),
//     ssr: false
//   }
// );

// export const LazyContentGenerator = dynamic(
//   () => import('@/components/ContentGenerator'),
//   {
//     loading: () => (
//       <div className="space-y-4">
//         <SkeletonCard />
//         <SkeletonCard />
//       </div>
//     ),
//     ssr: false
//   }
// );

// Generic lazy component wrapper
export function LazyComponent<T extends React.ComponentType<any>>({
  loader,
  fallback = <Skeleton className="h-64 w-full" />,
  ...props
}: {
  loader: () => Promise<{ default: T }>;
  fallback?: React.ReactNode;
  [key: string]: any;
}) {
  const Component = dynamic(loader, {
    loading: () => <>{fallback}</>,
    ssr: false
  });
  
  return <Component {...props} />;
}