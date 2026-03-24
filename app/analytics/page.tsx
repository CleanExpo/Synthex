import { generateMetadata } from '@/lib/seo/metadata';
import AnalyticsClient from './AnalyticsClient';

export const metadata = generateMetadata({
  title: 'Analytics',
  description:
    'Track your social media performance across all platforms. Real-time analytics, engagement metrics, and AI-powered insights.',
  path: '/analytics',
  keywords: [
    'social media analytics',
    'marketing analytics',
    'engagement metrics',
    'AI analytics',
  ],
});

export default function AnalyticsPage() {
  return <AnalyticsClient />;
}
