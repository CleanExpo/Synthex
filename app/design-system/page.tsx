import { generateMetadata } from '@/lib/seo/metadata';
import DesignSystemClient from './DesignSystemClient';

export const metadata = generateMetadata({
  title: 'Design System',
  description:
    'The Synthex design system — components, patterns, and guidelines for building consistent UI.',
  path: '/design-system',
  noIndex: true,
});

export default function DesignSystemPage() {
  return <DesignSystemClient />;
}
