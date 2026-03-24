import { generateMetadata } from '@/lib/seo/metadata';
import SupportClient from './SupportClient';

export const metadata = generateMetadata({
  title: 'Support',
  description:
    'Get help with Synthex. Browse FAQs, contact support, or explore our documentation.',
  path: '/support',
  keywords: ['Synthex support', 'help center', 'FAQ', 'customer support'],
});

export default function SupportPage() {
  return <SupportClient />;
}
