import { generateMetadata } from '@/lib/seo/metadata';
import CareersClient from './CareersClient';

export const metadata = generateMetadata({
  title: 'Careers at Synthex',
  description:
    'Join the team building the future of AI marketing. Open roles at Synthex — engineers, marketers, and customer success.',
  path: '/careers',
  keywords: ['Synthex careers', 'AI marketing jobs', 'startup jobs Australia'],
});

export default function CareersPage() {
  return <CareersClient />;
}
