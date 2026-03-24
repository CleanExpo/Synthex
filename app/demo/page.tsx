import { generateMetadata } from '@/lib/seo/metadata';
import DemoClient from './DemoClient';

export const metadata = generateMetadata({
  title: 'Live Demo',
  description:
    'Try Synthex AI in action. Generate a social media caption for your business in seconds — no signup required.',
  path: '/demo',
  keywords: [
    'AI demo',
    'social media caption generator',
    'free AI marketing demo',
  ],
});

export default function DemoPage() {
  return <DemoClient />;
}
