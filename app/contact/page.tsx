import { generateMetadata } from '@/lib/seo/metadata';
import ContactClient from './ContactClient';

export const metadata = generateMetadata({
  title: 'Contact | Synthex',
  description:
    'Request pilot access, share a campaign idea or ask a question. Synthex returns a controlled planning path before anything is produced.',
  path: '/contact',
  keywords: [
    'contact Synthex',
    'pilot access',
    'campaign planning',
    'marketing command center',
  ],
});

export default function ContactPage() {
  return <ContactClient />;
}
